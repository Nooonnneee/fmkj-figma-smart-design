// HA REST 客户端的错误映射测试：node desktop/scripts/test-ha-client.mjs
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const { createHaClient, normalizeHaBaseUrl } = require('../src/ha/client.js')

const TOKEN = 'super-secret-token'

function jsonResponse(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data }
}

test('normalizeHaBaseUrl：只接受 http/https，省略协议按 http', () => {
  assert.equal(normalizeHaBaseUrl('http://homeassistant.local:8123'), 'http://homeassistant.local:8123')
  assert.equal(normalizeHaBaseUrl('homeassistant.local:8123'), 'http://homeassistant.local:8123')
  assert.equal(normalizeHaBaseUrl('https://ha.example.com/'), 'https://ha.example.com')
  assert.equal(normalizeHaBaseUrl('ftp://ha.local:21'), null)
  assert.equal(normalizeHaBaseUrl('javascript:alert(1)'), null)
  assert.equal(normalizeHaBaseUrl('http://user:pass@ha.local:8123'), null)
  assert.equal(normalizeHaBaseUrl(''), null)
})

test('getApi：成功返回版本，并带 Bearer 令牌', async () => {
  let seen = null
  const client = createHaClient({
    baseUrl: 'http://ha.local:8123',
    token: TOKEN,
    fetchImpl: async (url, init) => {
      seen = { url, init }
      return jsonResponse({ message: 'API running.', version: '2024.10.2' })
    },
  })

  const result = await client.getApi()
  assert.deepEqual(result, { ok: true, data: { message: 'API running.', version: '2024.10.2' } })
  assert.equal(seen.url, 'http://ha.local:8123/api/')
  assert.equal(seen.init.headers.Authorization, `Bearer ${TOKEN}`)
  assert.equal(seen.init.redirect, 'manual', '不能自动跟随重定向')
})

test('HTTP 重定向不跟随，直接映射为 HTTP 错误', async () => {
  let calls = 0
  const client = createHaClient({
    baseUrl: 'http://ha.local:8123',
    token: TOKEN,
    fetchImpl: async () => {
      calls += 1
      return jsonResponse({}, 302)
    },
  })
  const result = await client.getApi()
  assert.equal(result.ok, false)
  assert.match(result.error, /HTTP 302/)
  assert.equal(calls, 1, '重定向后不应再发第二次请求')
})

test('getStates：解析数组；返回非数组时映射为错误', async () => {
  const okClient = createHaClient({
    baseUrl: 'http://ha.local:8123',
    token: TOKEN,
    fetchImpl: async () => jsonResponse([{ entity_id: 'light.kitchen', state: 'on' }]),
  })
  const ok = await okClient.getStates()
  assert.equal(ok.ok, true)
  assert.equal(ok.data[0].entity_id, 'light.kitchen')

  const badClient = createHaClient({
    baseUrl: 'http://ha.local:8123',
    token: TOKEN,
    fetchImpl: async () => jsonResponse({ not: 'an array' }),
  })
  const bad = await badClient.getStates()
  assert.equal(bad.ok, false)
  assert.match(bad.error, /格式/)
})

test('callService：POST 到白名单路径，entity_id 不会被 data 覆盖', async () => {
  let seen = null
  const client = createHaClient({
    baseUrl: 'http://ha.local:8123',
    token: TOKEN,
    fetchImpl: async (url, init) => {
      seen = { url, init }
      return jsonResponse([])
    },
  })

  const result = await client.callService({
    domain: 'light',
    service: 'turn_on',
    entityId: 'light.kitchen',
    data: { brightness: 128, entity_id: 'light.evil' },
  })

  assert.equal(result.ok, true)
  assert.equal(seen.url, 'http://ha.local:8123/api/services/light/turn_on')
  assert.equal(seen.init.method, 'POST')
  assert.equal(seen.init.headers['Content-Type'], 'application/json')
  assert.deepEqual(JSON.parse(seen.init.body), { brightness: 128, entity_id: 'light.kitchen' })
})

test('HTTP 401/403 映射为令牌错误，500 映射为 HTTP 错误', async () => {
  for (const status of [401, 403]) {
    const client = createHaClient({
      baseUrl: 'http://ha.local:8123',
      token: TOKEN,
      fetchImpl: async () => jsonResponse({}, status),
    })
    const result = await client.getApi()
    assert.equal(result.ok, false)
    assert.match(result.error, /令牌/)
    assert.ok(!result.error.includes(TOKEN), '错误信息不能包含令牌')
  }

  const serverError = createHaClient({
    baseUrl: 'http://ha.local:8123',
    token: TOKEN,
    fetchImpl: async () => jsonResponse({}, 500),
  })
  const result = await serverError.getApi()
  assert.equal(result.ok, false)
  assert.match(result.error, /HTTP 500/)
})

test('断网/连接失败映射为网络错误', async () => {
  const client = createHaClient({
    baseUrl: 'http://ha.local:8123',
    token: TOKEN,
    fetchImpl: async () => {
      throw new TypeError('fetch failed')
    },
  })
  const result = await client.getApi()
  assert.equal(result.ok, false)
  assert.match(result.error, /无法连接/)
  assert.ok(!result.error.includes(TOKEN))
})

test('超时时间可配置，并映射为超时错误', async () => {
  const client = createHaClient({
    baseUrl: 'http://ha.local:8123',
    token: TOKEN,
    timeoutMs: 30,
    fetchImpl: (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const error = new Error('aborted')
          error.name = 'AbortError'
          reject(error)
        })
      }),
  })

  const started = Date.now()
  const result = await client.getApi()
  const elapsed = Date.now() - started
  assert.equal(result.ok, false)
  assert.match(result.error, /超时/)
  assert.ok(elapsed >= 20 && elapsed < 1000, `超时用时异常：${elapsed}ms`)
})

// 用挂起的 fetch + 被注入的 AbortSignal 观察每个方法真正的超时时间。
// 不用真实等待 12/15/8 秒：node:test 的假时钟推进到边界毫秒。
function hangingFetch(seen) {
  return (_url, init) => {
    seen.signal = init.signal
    return new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const error = new Error('aborted')
        error.name = 'AbortError'
        reject(error)
      })
    })
  }
}

test('getApi 12s / getStates 15s / callService 8s 各自使用对应超时', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })

  async function assertTimeout(label, invoke, expected) {
    const seen = {}
    const client = createHaClient({
      baseUrl: 'http://ha.local:8123',
      token: TOKEN,
      fetchImpl: hangingFetch(seen),
    })

    const resultPromise = invoke(client)
    assert.ok(seen.signal, `${label} 没有发出请求`)

    t.mock.timers.tick(expected - 1)
    assert.equal(seen.signal.aborted, false, `${label} 在 ${expected - 1}ms 时不应超时`)
    t.mock.timers.tick(1)
    assert.equal(seen.signal.aborted, true, `${label} 应在 ${expected}ms 超时`)

    const result = await resultPromise
    assert.equal(result.ok, false)
    assert.match(result.error, /超时/)
  }

  await assertTimeout('getApi', (client) => client.getApi(), 12000)
  await assertTimeout('getStates', (client) => client.getStates(), 15000)
  await assertTimeout(
    'callService',
    (client) =>
      client.callService({ domain: 'light', service: 'turn_on', entityId: 'light.kitchen' }),
    8000,
  )
})

test('显式 timeoutMs 覆盖所有方法的默认超时', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })

  const seen = {}
  const client = createHaClient({
    baseUrl: 'http://ha.local:8123',
    token: TOKEN,
    timeoutMs: 50,
    fetchImpl: hangingFetch(seen),
  })

  const resultPromise = client.getStates()
  t.mock.timers.tick(49)
  assert.equal(seen.signal.aborted, false)
  t.mock.timers.tick(1)
  assert.equal(seen.signal.aborted, true)

  const result = await resultPromise
  assert.equal(result.ok, false)
  assert.match(result.error, /超时/)
})

test('地址无效时不发请求', async () => {
  let called = false
  const client = createHaClient({
    baseUrl: 'file:///etc/passwd',
    token: TOKEN,
    fetchImpl: async () => {
      called = true
      return jsonResponse({})
    },
  })
  const result = await client.getApi()
  assert.equal(result.ok, false)
  assert.match(result.error, /地址无效/)
  assert.equal(called, false)
})

test('响应无法解析时映射为格式错误', async () => {
  const client = createHaClient({
    baseUrl: 'http://ha.local:8123',
    token: TOKEN,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('bad json')
      },
    }),
  })
  const result = await client.getApi()
  assert.equal(result.ok, false)
  assert.match(result.error, /无法解析/)
})
