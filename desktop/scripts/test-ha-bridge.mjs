// HA 主进程桥测试：不启动 Electron，用假的 ipcMain/tokenStore/client 验证
// 来源校验、服务白名单、实体白名单，以及返回值不含令牌。
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const { createHaBridge } = require('../src/ha/bridge.js')

const TOKEN = 'super-secret-token'

function harness(options = {}) {
  const handlers = new Map()
  const ipcMain = { handle: (channel, handler) => handlers.set(channel, handler) }

  const tokenStore = {
    config: options.config || null,
    isEncryptionAvailable: () => options.encryptionAvailable !== false,
    load() {
      return this.config
    },
    save(value) {
      if (options.failSave) throw new Error('disk full')
      this.config = { ...value }
    },
    clear() {
      this.config = null
    },
  }

  const calls = []
  const discoverCalls = []
  const statesResult = options.statesResult || {
    ok: true,
    data: [
      {
        entity_id: 'light.kitchen',
        state: 'on',
        attributes: { brightness: 180 },
        last_changed: '2026-01-01T00:00:00.000Z',
        ignored: 'drop me',
      },
    ],
  }
  const apiResult = options.apiResult || { ok: true, data: { version: '2024.10.2' } }

  const clientFactory = (config) => ({
    getApi: async () => apiResult,
    getStates: async () => statesResult,
    callService: async (input) => {
      calls.push({ config, input })
      return options.serviceResult || { ok: true }
    },
  })

  createHaBridge({
    ipcMain,
    fromTrusted: (event) => Boolean(event && event.trusted),
    fromLocal: (event) => Boolean(event && event.local),
    tokenStore,
    clientFactory,
    discover: async (opts) => {
      discoverCalls.push(opts)
      return options.devices || [{ name: 'Home', baseUrl: 'http://192.168.1.50:8123' }]
    },
  })

  const invoke = (channel, event = { trusted: true, local: true }, ...args) => {
    const handler = handlers.get(channel)
    assert.ok(handler, `没有注册 ${channel}`)
    return handler(event, ...args)
  }

  return { calls, discoverCalls, handlers, invoke, tokenStore }
}

test('configure/status 的返回值都不含令牌', async () => {
  const h = harness()

  const configured = await h.invoke('ha:configure', { local: true }, { baseUrl: 'http://ha.local:8123', token: TOKEN })
  assert.deepEqual(configured, { ok: true })
  assert.ok(!JSON.stringify(configured).includes(TOKEN))

  const status = await h.invoke('ha:status')
  assert.deepEqual(status, { configured: true, baseUrl: 'http://ha.local:8123', connected: true, version: '2024.10.2' })
  assert.ok(!JSON.stringify(status).includes(TOKEN), 'status 不能带出令牌')

  const states = await h.invoke('ha:get-states')
  assert.ok(!JSON.stringify(states).includes(TOKEN))
})

test('未配置时 status 返回 configured=false，getStates 返回空数组', async () => {
  const h = harness()
  assert.deepEqual(await h.invoke('ha:status'), { configured: false, baseUrl: null, connected: false })
  assert.deepEqual(await h.invoke('ha:get-states'), [])
  assert.equal(h.calls.length, 0)
})

test('连接失败时 status 暴露 error，但不暴露令牌', async () => {
  const h = harness({
    config: { baseUrl: 'http://ha.local:8123', token: TOKEN },
    apiResult: { ok: false, error: '无法连接到 Home Assistant，请检查地址和网络' },
  })
  const status = await h.invoke('ha:status')
  assert.equal(status.configured, true)
  assert.equal(status.connected, false)
  assert.match(status.error, /无法连接/)
  assert.ok(!JSON.stringify(status).includes(TOKEN))
})

test('来源校验：数据类拒绝非信任来源，设置类拒绝非本地页面', async () => {
  const h = harness({ config: { baseUrl: 'http://ha.local:8123', token: TOKEN } })

  await assert.rejects(async () => h.invoke('ha:status', { trusted: false, local: true }), /FORBIDDEN/)
  await assert.rejects(async () => h.invoke('ha:get-states', { trusted: false, local: true }), /FORBIDDEN/)
  await assert.rejects(async () => h.invoke('ha:call-service', { trusted: false, local: true }, {}), /FORBIDDEN/)

  await assert.rejects(async () => h.invoke('ha:configure', { trusted: true, local: false }, {}), /FORBIDDEN/)
  await assert.rejects(async () => h.invoke('ha:clear', { trusted: true, local: false }), /FORBIDDEN/)
  await assert.rejects(async () => h.invoke('ha:discover', { trusted: true, local: false }), /FORBIDDEN/)
})

test('configure：地址/令牌格式校验、加密不可用、写入失败都返回 ok=false', async () => {
  const invalidUrl = harness()
  assert.equal((await invalidUrl.invoke('ha:configure', { local: true }, { baseUrl: 'ftp://x', token: TOKEN })).ok, false)

  const noToken = harness()
  const missing = await noToken.invoke('ha:configure', { local: true }, { baseUrl: 'http://ha.local:8123' })
  assert.equal(missing.ok, false)
  assert.match(missing.error, /令牌/)

  const noStorage = harness({ encryptionAvailable: false })
  const refused = await noStorage.invoke('ha:configure', { local: true }, { baseUrl: 'http://ha.local:8123', token: TOKEN })
  assert.equal(refused.ok, false)
  assert.match(refused.error, /安全存储/)
  assert.equal(noStorage.tokenStore.config, null)

  const saveFails = harness({ failSave: true })
  const failed = await saveFails.invoke('ha:configure', { local: true }, { baseUrl: 'http://ha.local:8123', token: TOKEN })
  assert.equal(failed.ok, false)
})

test('configure：令牌留空时沿用已保存的令牌，只改地址', async () => {
  const h = harness({ config: { baseUrl: 'http://old.local:8123', token: TOKEN } })
  const result = await h.invoke('ha:configure', { local: true }, { baseUrl: 'http://new.local:8123', token: '' })
  assert.deepEqual(result, { ok: true })
  assert.deepEqual(h.tokenStore.config, { baseUrl: 'http://new.local:8123', token: TOKEN })
})

test('getStates 映射字段，未知字段不在返回值里', async () => {
  const h = harness({ config: { baseUrl: 'http://ha.local:8123', token: TOKEN } })
  const states = await h.invoke('ha:get-states')
  assert.deepEqual(states, [
    {
      entityId: 'light.kitchen',
      state: 'on',
      attributes: { brightness: 180 },
      lastChanged: '2026-01-01T00:00:00.000Z',
    },
  ])
})

test('callService：白名单拒绝任意 domain/service', async () => {
  const h = harness({ config: { baseUrl: 'http://ha.local:8123', token: TOKEN } })
  await h.invoke('ha:get-states')

  const badDomain = await h.invoke('ha:call-service', undefined, {
    domain: 'automation',
    service: 'turn_on',
    entityId: 'light.kitchen',
  })
  assert.equal(badDomain.ok, false)

  const badService = await h.invoke('ha:call-service', undefined, {
    domain: 'light',
    service: 'restart',
    entityId: 'light.kitchen',
  })
  assert.equal(badService.ok, false)
  assert.equal(h.calls.length, 0, '白名单拒绝的请求不能到达客户端')
})

test('callService：实体必须出现在最近一次 getStates 结果里', async () => {
  const h = harness({ config: { baseUrl: 'http://ha.local:8123', token: TOKEN } })

  const beforeStates = await h.invoke('ha:call-service', undefined, {
    domain: 'light',
    service: 'turn_on',
    entityId: 'light.kitchen',
  })
  assert.equal(beforeStates.ok, false)

  await h.invoke('ha:get-states')

  const unknown = await h.invoke('ha:call-service', undefined, {
    domain: 'light',
    service: 'turn_on',
    entityId: 'light.bedroom',
  })
  assert.equal(unknown.ok, false)

  const allowed = await h.invoke('ha:call-service', undefined, {
    domain: 'light',
    service: 'turn_on',
    entityId: 'light.kitchen',
    data: { brightness: 80, entity_id: 'light.evil' },
  })
  assert.deepEqual(allowed, { ok: true })
  assert.equal(h.calls.length, 1)
  assert.deepEqual(h.calls[0].input, {
    domain: 'light',
    service: 'turn_on',
    entityId: 'light.kitchen',
    data: { brightness: 80 },
  })
})

test('getStates 失败后返回空数组，也不会放行任何实体', async () => {
  const h = harness({ statesResult: { ok: false, error: 'HTTP 500' } })
  assert.deepEqual(await h.invoke('ha:get-states'), [])
  const result = await h.invoke('ha:call-service', undefined, {
    domain: 'light',
    service: 'toggle',
    entityId: 'light.kitchen',
  })
  assert.equal(result.ok, false)
})

test('clear 清除配置后 status 回到未配置', async () => {
  const h = harness({ config: { baseUrl: 'http://ha.local:8123', token: TOKEN } })
  assert.deepEqual(await h.invoke('ha:clear', { local: true }), { ok: true })
  assert.deepEqual(await h.invoke('ha:status'), { configured: false, baseUrl: null, connected: false })
})

test('discover：本地页面可调用，超时被限制在 250ms–15s', async () => {
  const h = harness({ devices: [{ name: '客厅', baseUrl: 'http://192.168.1.50:8123' }] })

  const devices = await h.invoke('ha:discover', { local: true }, { timeoutMs: 99999 })
  assert.deepEqual(devices, [{ name: '客厅', baseUrl: 'http://192.168.1.50:8123' }])
  assert.equal(h.discoverCalls[0].timeoutMs, 15000)

  await h.invoke('ha:discover', { local: true }, { timeoutMs: 1 })
  assert.equal(h.discoverCalls[1].timeoutMs, 250)

  await h.invoke('ha:discover', { local: true })
  assert.equal(h.discoverCalls[2].timeoutMs, 3000)
})

test('discover 内部异常时返回空数组而不是抛错', async () => {
  const handlers = new Map()
  createHaBridge({
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    fromTrusted: () => true,
    fromLocal: () => true,
    tokenStore: { load: () => null, isEncryptionAvailable: () => true },
    discover: async () => {
      throw new Error('network down')
    },
  })
  const result = await handlers.get('ha:discover')({ local: true }, {})
  assert.deepEqual(result, [])
})
