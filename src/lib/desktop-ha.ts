/**
 * 桌面客户端 Home Assistant 桥（`window.fanmengDesktop.ha`）的类型与运行时守卫。
 *
 * 契约严格按已批准提案 `docs/proposals/ha-client-pairing.md` §3：
 *   available / status / discover / configure / clear / getStates / callService
 *
 * 页面侧只应通过这里的 `detectDesktopHa` / `readHaStatus` / `readHaStates` /
 * `callHaService` 使用桥：
 *   - 浏览器 / 非桌面端：桥不存在，返回 null，页面继续用服务器数据；
 *   - 主进程桥未就绪（`available()` 为 false 或抛错）：同样按无桥处理；
 *   - 任何一次桥调用异常都在这里吞掉并转成 null / `{ ok:false }`，
 *     绝不让一个异常把整页打崩。
 *
 * 令牌永远不进渲染进程 —— 这里没有任何读取令牌的通道。
 */

/** `status()` 的返回：只描述连接态，不含令牌。 */
export type HaStatus = {
  configured: boolean
  baseUrl: string | null
  connected: boolean
  version?: string
  error?: string
}

/** mDNS / 手填列表里的一项。 */
export type HaDiscoveredInstance = {
  name: string
  baseUrl: string
}

/** `getStates()` 的一条实体状态。 */
export type HaEntityState = {
  entityId: string
  state: string
  attributes: Record<string, unknown>
  lastChanged: string
}

/** `callService()` 的入参；`data` 只用于白名单服务（位置 / 温度 / 模式）。 */
export type HaCallServiceInput = {
  domain: string
  service: string
  entityId: string
  data?: Record<string, unknown>
}

export type HaActionResult = {
  ok: boolean
  error?: string
}

/** 渲染进程能看到的完整 HA 桥（提案 §3）。 */
export type DesktopHaBridge = {
  available(): Promise<boolean>
  status(): Promise<HaStatus>
  discover(opts?: { timeoutMs?: number }): Promise<HaDiscoveredInstance[]>
  configure(input: { baseUrl: string; token: string }): Promise<HaActionResult>
  clear(): Promise<{ ok: true }>
  getStates(): Promise<HaEntityState[]>
  callService(input: HaCallServiceInput): Promise<HaActionResult>
}

/** 提案 §3 的白名单：页面只允许对这几类实体显示控制。 */
export const HA_CONTROL_DOMAINS = ['light', 'switch', 'cover', 'climate'] as const
export type HaControlDomain = (typeof HA_CONTROL_DOMAINS)[number]

/** 提案 §3 的白名单：不做任意 service 透传。 */
export const HA_CONTROL_SERVICES = [
  'turn_on',
  'turn_off',
  'toggle',
  'set_cover_position',
  'set_temperature',
  'set_hvac_mode',
] as const
export type HaControlService = (typeof HA_CONTROL_SERVICES)[number]

export function isHaControlDomain(value: string): value is HaControlDomain {
  return (HA_CONTROL_DOMAINS as readonly string[]).includes(value)
}

export function isHaControlService(value: string): value is HaControlService {
  return (HA_CONTROL_SERVICES as readonly string[]).includes(value)
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const HA_BRIDGE_METHODS = [
  'available',
  'status',
  'discover',
  'configure',
  'clear',
  'getStates',
  'callService',
] as const

type WindowWithDesktop = { fanmengDesktop?: unknown }

/** 取顶层 `window.fanmengDesktop`；非桌面端 / 形状不对 → null。 */
function desktopBridge(): UnknownRecord | null {
  if (typeof window === 'undefined') return null
  const bridge = (window as unknown as WindowWithDesktop).fanmengDesktop
  return isRecord(bridge) ? bridge : null
}

/**
 * 运行时守卫：只有 `fanmengDesktop.ha` 存在且七个方法都是函数时才认这个桥。
 * 不做 `as` 盲转 —— 网页里任何脚本都能伪造 `window.fanmengDesktop`。
 */
export function getDesktopHa(): DesktopHaBridge | null {
  const bridge = desktopBridge()
  const ha = bridge?.ha
  if (!isRecord(ha)) return null
  for (const method of HA_BRIDGE_METHODS) {
    if (typeof ha[method] !== 'function') return null
  }
  return ha as unknown as DesktopHaBridge
}

/**
 * 挂载时探测：有桥且主进程桥就绪才返回桥，否则返回 null。
 * `available()` 抛错按「无桥」处理，页面回退服务器数据。
 */
export async function detectDesktopHa(): Promise<DesktopHaBridge | null> {
  const ha = getDesktopHa()
  if (!ha) return null
  try {
    return (await ha.available()) === true ? ha : null
  } catch {
    return null
  }
}

/** 读连接态；桥异常 / 返回形状不对 → null（页面显示明确的错误态）。 */
export async function readHaStatus(
  bridge: DesktopHaBridge | null = getDesktopHa(),
): Promise<HaStatus | null> {
  if (!bridge) return null
  try {
    const raw: unknown = await bridge.status()
    if (!isRecord(raw)) return null

    const status: HaStatus = {
      configured: raw.configured === true,
      baseUrl: typeof raw.baseUrl === 'string' && raw.baseUrl.trim() ? raw.baseUrl.trim() : null,
      connected: raw.connected === true,
    }
    if (typeof raw.version === 'string' && raw.version.trim()) status.version = raw.version.trim()
    if (typeof raw.error === 'string' && raw.error.trim()) status.error = raw.error.trim()
    return status
  } catch {
    return null
  }
}

function normalizeEntityState(raw: unknown): HaEntityState | null {
  if (!isRecord(raw)) return null
  const entityId = typeof raw.entityId === 'string' ? raw.entityId.trim() : ''
  if (!entityId) return null
  return {
    entityId,
    state: typeof raw.state === 'string' && raw.state.trim() ? raw.state.trim() : 'unknown',
    attributes: isRecord(raw.attributes) ? raw.attributes : {},
    lastChanged: typeof raw.lastChanged === 'string' ? raw.lastChanged : '',
  }
}

/** 读实体状态；桥异常 / 返回不是数组 → null。单条形状不对的实体直接跳过。 */
export async function readHaStates(
  bridge: DesktopHaBridge | null = getDesktopHa(),
): Promise<HaEntityState[] | null> {
  if (!bridge) return null
  try {
    const raw: unknown = await bridge.getStates()
    if (!Array.isArray(raw)) return null
    return raw
      .map(normalizeEntityState)
      .filter((entity): entity is HaEntityState => entity !== null)
  } catch {
    return null
  }
}

/**
 * 调服务。页面侧先过一次白名单（主进程还会再校验一次），
 * 异常统一转成 `{ ok:false, error }`，不向渲染层抛。
 */
export async function callHaService(
  input: HaCallServiceInput,
  bridge: DesktopHaBridge | null = getDesktopHa(),
): Promise<HaActionResult> {
  if (!bridge) return { ok: false, error: '当前不在桌面客户端中，无法控制设备。' }
  if (!isHaControlDomain(input.domain)) {
    return { ok: false, error: `不支持的设备类型：${input.domain}` }
  }
  if (!isHaControlService(input.service)) {
    return { ok: false, error: `不支持的操作：${input.service}` }
  }

  try {
    const raw: unknown = await bridge.callService(input)
    if (isRecord(raw) && raw.ok === true) return { ok: true }
    if (isRecord(raw) && typeof raw.error === 'string' && raw.error.trim()) {
      return { ok: false, error: raw.error.trim() }
    }
    return { ok: false, error: '操作失败，请稍后重试。' }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error && error.message ? error.message : '操作失败，请稍后重试。',
    }
  }
}

/**
 * 打开客户端本地设置页。`openSettings` 是顶层桥能力（desktop/src/preload.js），
 * 不在 `ha` 子对象里；没有这个能力时静默返回 false。
 */
export async function openDesktopSettings(): Promise<boolean> {
  const bridge = desktopBridge()
  const open = bridge?.openSettings
  if (typeof open !== 'function') return false
  try {
    await (open as () => Promise<unknown>)()
    return true
  } catch {
    return false
  }
}
