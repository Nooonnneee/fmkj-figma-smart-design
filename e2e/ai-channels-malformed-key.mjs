#!/usr/bin/env node
/**
 * 真实 HTTP 回归：畸形百分号编码的渠道 key 必须是 404 + JSON。
 *
 * 为什么不用单测代替：Next 16 的路由匹配层在调用 route handler **之前**就
 * `decodeURIComponent` 动态段，畸形编码会抛 `DecodeError` → 500 text/plain，
 * 请求根本到不了 handler。上一轮只测纯函数，绿灯是假信心。
 *
 * 用法（需要一个已经启动的服务）：
 *   BASE=http://127.0.0.1:3000 \
 *   EMAIL=demo@fmkj.local PASS=demo12345 \
 *     node e2e/ai-channels-malformed-key.mjs
 *
 * 脚本会真实登录拿 app-session Cookie，再用原始 `%` 路径发请求。
 */
import http from 'node:http'

const BASE = process.env.BASE || process.env.SMOKE_BASE || 'http://127.0.0.1:3000'
const EMAIL = process.env.EMAIL || process.env.SMOKE_EMAIL || 'demo@fmkj.local'
const PASS = process.env.PASS || process.env.SMOKE_PASS || 'demo12345'
const NOT_FOUND = { ok: false, error: '找不到这个渠道' }

const base = new URL(BASE)

function request(method, path, { cookie, body } = {}) {
  return new Promise((resolve, reject) => {
    const headers = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (cookie) headers.Cookie = cookie
    const req = http.request(
      {
        hostname: base.hostname,
        port: base.port || 80,
        path, // 故意原样传：%E0%A4%A / %FF / % / %zz 不能被客户端提前解码
        method,
        headers,
      },
      (res) => {
        let text = ''
        res.on('data', (chunk) => (text += chunk))
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            contentType: res.headers['content-type'] || '',
            setCookie: res.headers['set-cookie'] || [],
            text,
          }),
        )
      },
    )
    req.on('error', reject)
    if (body !== undefined) req.write(body)
    req.end()
  })
}

async function login() {
  const res = await request('POST', '/auth/login', {
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  })
  if (res.status !== 200) {
    throw new Error(`登录失败：HTTP ${res.status} ${res.text.slice(0, 200)}`)
  }
  const cookie = res.setCookie
    .map((line) => line.split(';')[0])
    .find((c) => c.startsWith('app-session='))
  if (!cookie) throw new Error('登录成功但响应里没有 app-session Cookie')
  return cookie
}

const CASES = [
  ['PATCH', '/api/ai/channels/%E0%A4%A'],
  ['DELETE', '/api/ai/channels/%E0%A4%A'],
  ['POST', '/api/ai/channels/%FF/test'],
  ['PATCH', '/api/ai/channels/%'],
  ['PATCH', '/api/ai/channels/%zz'],
  ['DELETE', '/api/ai/channels/%E0%A4%A0%A4'],
  ['DELETE', '/api/ai/channels/%FF'],
]

const cookie = await login()
let failed = 0

for (const [method, path] of CASES) {
  // DELETE 不带 body（带 chunked body 会被服务端在 proxy 之前以 400 拒绝，和本回归无关）
  const res = await request(method, path, { cookie, body: method === 'DELETE' ? undefined : '{}' })
  const json = (() => {
    try {
      return JSON.parse(res.text)
    } catch {
      return null
    }
  })()
  const ok =
    res.status === 404 &&
    res.contentType.includes('application/json') &&
    json?.ok === NOT_FOUND.ok &&
    json?.error === NOT_FOUND.error
  console.log(
    `${ok ? '✓' : '✗'} ${method} ${path} → ${res.status} ${res.contentType} ${res.text.slice(0, 80)}`,
  )
  if (!ok) failed += 1
}

// 对照：正常「渠道不存在」必须同形（不泄露 key 存在性）
const control = await request('PATCH', '/api/ai/channels/no-such-key', { cookie, body: '{}' })
const controlJson = (() => {
  try {
    return JSON.parse(control.text)
  } catch {
    return null
  }
})()
const controlOk =
  control.status === 404 &&
  control.contentType.includes('application/json') &&
  controlJson?.ok === NOT_FOUND.ok &&
  controlJson?.error === NOT_FOUND.error
console.log(
  `${controlOk ? '✓' : '✗'} PATCH /api/ai/channels/no-such-key → ${control.status} ${control.contentType} ${control.text.slice(0, 80)}`,
)
if (!controlOk) failed += 1

if (failed > 0) {
  console.error(`\n失败 ${failed} 项`)
  process.exit(1)
}
console.log(`\n全部通过（${CASES.length + 1} 项）`)
