// preload 契约测试：用 mock electron 模块加载 preload.js，核对 §3 暴露的字段名。
import assert from 'node:assert/strict'
import Module from 'node:module'
import { createRequire } from 'node:module'
import test from 'node:test'

const requireCjs = createRequire(import.meta.url)
const PRELOAD = requireCjs.resolve('../src/preload.js')

function loadPreload(protocol) {
  const exposed = []
  const invokes = []
  const originalLoad = Module._load

  Module._load = function mockLoad(request, ...args) {
    if (request === 'electron') {
      return {
        contextBridge: {
          exposeInMainWorld: (name, value) => exposed.push({ name, value }),
        },
        ipcRenderer: {
          invoke: (...callArgs) => {
            invokes.push(callArgs)
            return Promise.resolve(callArgs)
          },
        },
      }
    }
    return originalLoad.call(this, request, ...args)
  }

  const previousLocation = globalThis.location
  globalThis.location = { protocol }
  try {
    delete requireCjs.cache[PRELOAD]
    requireCjs(PRELOAD)
  } finally {
    Module._load = originalLoad
    globalThis.location = previousLocation
  }

  assert.equal(exposed.length, 1)
  assert.equal(exposed[0].name, 'fanmengDesktop')
  return { api: exposed[0].value, invokes }
}

const HA_METHODS = ['available', 'status', 'discover', 'configure', 'clear', 'getStates', 'callService']

test('工作台来源：暴露 ha 契约，且不暴露设置页 API', async () => {
  const { api, invokes } = loadPreload('https:')

  assert.ok(api.ha, '缺少 fanmengDesktop.ha')
  assert.deepEqual(Object.keys(api.ha).sort(), [...HA_METHODS].sort(), 'ha 字段名必须与提案 §3 一致')
  assert.equal(api.settings, undefined, '非 file:// 页面不应拿到设置 API')
  assert.equal(await api.ha.available(), true)

  await api.ha.status()
  assert.deepEqual(invokes.pop(), ['ha:status'])

  await api.ha.discover({ timeoutMs: 1200, extra: 'drop' })
  assert.deepEqual(invokes.pop(), ['ha:discover', { timeoutMs: 1200 }])

  await api.ha.configure({ baseUrl: 'http://ha.local:8123', token: 't', extra: 'drop' })
  assert.deepEqual(invokes.pop(), ['ha:configure', { baseUrl: 'http://ha.local:8123', token: 't' }])

  await api.ha.getStates()
  assert.deepEqual(invokes.pop(), ['ha:get-states'])

  await api.ha.callService({ domain: 'light', service: 'turn_on', entityId: 'light.kitchen', data: { brightness: 1 }, extra: 'drop' })
  assert.deepEqual(invokes.pop(), [
    'ha:call-service',
    { domain: 'light', service: 'turn_on', entityId: 'light.kitchen', data: { brightness: 1 } },
  ])

  await api.ha.clear()
  assert.deepEqual(invokes.pop(), ['ha:clear'])
})

test('本地设置页：额外暴露 settings，ha 契约不变', () => {
  const { api } = loadPreload('file:')
  assert.ok(api.settings, '本地页面必须保留设置 API')
  assert.deepEqual(Object.keys(api.settings).sort(), ['close', 'get', 'reset', 'save', 'test'])
  assert.deepEqual(Object.keys(api.ha).sort(), [...HA_METHODS].sort())
})
