'use strict'

// 主进程 HA 桥：IPC 来源校验 + 服务/实体白名单 + 令牌不出主进程。
//
// 依赖注入是为了让 scripts/test-ha-bridge.mjs 不启动 Electron 也能跑：
// ipcMain、tokenStore、clientFactory、discover 都可以由调用方传入。

const { createHaClient, normalizeHaBaseUrl } = require('./client')
const { discover: defaultDiscover } = require('./discovery')

// 提案 §3：第一期只放行这四类设备、六个服务。
const ALLOWED_DOMAINS = new Set(['light', 'switch', 'cover', 'climate'])
const ALLOWED_SERVICES = new Set(['turn_on', 'turn_off', 'toggle', 'set_cover_position', 'set_temperature', 'set_hvac_mode'])

function sanitizeData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
  try {
    const parsed = JSON.parse(JSON.stringify(data))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    // 只允许调用用户点选的那个实体：目标选择类字段一律剔除（大小写变体一起）。
    const blocked = new Set(['entity_id', 'area_id', 'device_id', 'floor_id', 'label_id', 'exclude'])
    for (const key of Object.keys(parsed)) {
      if (blocked.has(key.toLowerCase())) delete parsed[key]
    }
    return parsed
  } catch {
    return {}
  }
}

function createHaBridge({ ipcMain, fromTrusted, fromLocal, tokenStore, clientFactory = createHaClient, discover = defaultDiscover } = {}) {
  if (!ipcMain || typeof ipcMain.handle !== 'function') throw new Error('IPC_MAIN_REQUIRED')
  if (typeof fromTrusted !== 'function' || typeof fromLocal !== 'function') throw new Error('GUARDS_REQUIRED')
  if (!tokenStore || typeof tokenStore.load !== 'function') throw new Error('TOKEN_STORE_REQUIRED')

  // 最近一次成功 getStates 返回的实体；callService 只认这个集合。
  const lastEntities = new Set()

  // 与 main.js 相同的来源校验模式：顶层框架 URL 不合法就直接抛 FORBIDDEN。
  const guard = (check, handler) => (event, ...args) => {
    if (!check(event)) throw new Error('FORBIDDEN')
    return handler(event, ...args)
  }

  const loadConfig = () => tokenStore.load()
  const clientFor = (config) => clientFactory({ baseUrl: config.baseUrl, token: config.token })

  ipcMain.handle(
    'ha:status',
    guard(fromTrusted, async () => {
      const config = loadConfig()
      if (!config) return { configured: false, baseUrl: null, connected: false }

      const result = await clientFor(config).getApi()
      if (!result.ok) {
        return { configured: true, baseUrl: config.baseUrl, connected: false, error: result.error }
      }
      const version = result.data && result.data.version
      return {
        configured: true,
        baseUrl: config.baseUrl,
        connected: true,
        ...(version ? { version: String(version) } : {}),
      }
    }),
  )

  ipcMain.handle(
    'ha:discover',
    guard(fromLocal, async (_event, options) => {
      const requested = options && Number(options.timeoutMs)
      const timeoutMs = Number.isFinite(requested) ? Math.min(Math.max(requested, 250), 15000) : 3000
      try {
        const found = await discover({ timeoutMs })
        return Array.isArray(found) ? found : []
      } catch {
        return []
      }
    }),
  )

  ipcMain.handle(
    'ha:configure',
    guard(fromLocal, async (_event, input) => {
      const value = input && typeof input === 'object' ? input : {}
      const baseUrl = normalizeHaBaseUrl(value.baseUrl)
      if (!baseUrl) return { ok: false, error: '请输入有效的地址，例如 http://homeassistant.local:8123' }

      const existing = loadConfig()
      const typedToken = typeof value.token === 'string' ? value.token.trim() : ''
      const token = typedToken || (existing ? existing.token : '')
      if (!token) return { ok: false, error: '请填写 Home Assistant 长期访问令牌' }

      // basic_text 后端虽然 isEncryptionAvailable() 为 true，但用的是硬编码密钥，
      // 等同于弱加密；必须和「完全不可用」一样拒绝保存。
      const secureStorage =
        typeof tokenStore.isSecureStorageAvailable === 'function'
          ? tokenStore.isSecureStorageAvailable()
          : tokenStore.isEncryptionAvailable()
      if (!secureStorage) {
        return { ok: false, error: '系统密钥环不可用，无法安全保存令牌（Linux 请安装并解锁 gnome-keyring 或 KWallet）' }
      }

      try {
        tokenStore.save({ baseUrl, token })
      } catch {
        return { ok: false, error: '保存配对信息失败' }
      }

      // 地址变了以后，旧实体集合不能继续用于新实例。
      lastEntities.clear()
      return { ok: true }
    }),
  )

  ipcMain.handle(
    'ha:clear',
    guard(fromLocal, () => {
      lastEntities.clear()
      try {
        tokenStore.clear()
      } catch {
        return { ok: false, error: '清除配对信息失败' }
      }
      return { ok: true }
    }),
  )

  ipcMain.handle(
    'ha:get-states',
    guard(fromTrusted, async () => {
      const config = loadConfig()
      // 未配置按契约返回空数组；读取失败必须 reject，让调用方走错误视图，
      // 不能用 [] 伪装成「已连接但没有实体」。
      if (!config) return []

      const result = await clientFor(config).getStates()
      if (!result || !result.ok) throw new Error((result && result.error) || '读取实体失败')
      if (!Array.isArray(result.data)) throw new Error('Home Assistant 返回的实体列表格式不正确')

      lastEntities.clear()
      const states = []
      for (const item of result.data) {
        if (!item || typeof item.entity_id !== 'string' || !item.entity_id) continue
        lastEntities.add(item.entity_id)
        states.push({
          entityId: item.entity_id,
          state: item.state == null ? '' : String(item.state),
          attributes: item.attributes && typeof item.attributes === 'object' ? item.attributes : {},
          lastChanged: item.last_changed == null ? '' : String(item.last_changed),
        })
      }
      return states
    }),
  )

  ipcMain.handle(
    'ha:call-service',
    guard(fromTrusted, async (_event, input) => {
      const value = input && typeof input === 'object' ? input : {}
      const domain = typeof value.domain === 'string' ? value.domain : ''
      const service = typeof value.service === 'string' ? value.service : ''
      const entityId = typeof value.entityId === 'string' ? value.entityId : ''

      if (!ALLOWED_DOMAINS.has(domain) || !ALLOWED_SERVICES.has(service)) {
        return { ok: false, error: '该服务不在允许范围内' }
      }
      // 必须先成功拉过一次状态，且实体必须出现在那份结果里。
      if (!entityId || !lastEntities.has(entityId)) {
        return { ok: false, error: '该实体不在最近一次读取的实体列表中' }
      }

      const config = loadConfig()
      if (!config) return { ok: false, error: '还没有配置 Home Assistant' }

      const result = await clientFor(config).callService({ domain, service, entityId, data: sanitizeData(value.data) })
      // 契约只暴露 ok/error，不透传 HA 的原始响应体。
      return result.ok ? { ok: true } : { ok: false, error: result.error || '调用服务失败' }
    }),
  )

  return { channels: ['ha:status', 'ha:discover', 'ha:configure', 'ha:clear', 'ha:get-states', 'ha:call-service'] }
}

module.exports = { ALLOWED_DOMAINS, ALLOWED_SERVICES, createHaBridge }
