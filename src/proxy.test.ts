import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import { channelNotFoundResponse } from '@/lib/ai-channels-http'
import { config, proxy } from './proxy'

/**
 * 真实 HTTP 回归之外的 proxy 层用例。
 *
 * 为什么必须有这一层：Next 16 的路由匹配层在调用 route handler **之前**就对动态段
 * `decodeURIComponent`，畸形编码会抛 `DecodeError` → 500，handler 里的兜底永远收不到。
 * 所以修复点在 `src/proxy.ts`，而不是 `ai-channels-http.ts`。
 *
 * 和真实 standalone 服务的差距：这里直接调用 proxy 函数，验证的是「proxy 会不会拦」；
 * 它不能证明 Next 的 matcher 配置真的把请求交给了 proxy。matcher 由下面单独的静态
 * 断言覆盖，最终仍以真实服务证据为准（见交付报告）。
 */

const BASE = 'http://127.0.0.1:13082'

function request(path: string, method = 'PATCH') {
  return new NextRequest(new URL(path, BASE), { method })
}

describe('proxy：渠道 key 的畸形百分号编码', () => {
  it('前提：nextUrl.pathname 保留原始编码（%63%31 不会被提前解码）', () => {
    expect(request('/api/ai/channels/%63%31').nextUrl.pathname).toBe('/api/ai/channels/%63%31')
  })

  it.each([
    ['PATCH', '/api/ai/channels/%E0%A4%A'],
    ['DELETE', '/api/ai/channels/%E0%A4%A'],
    ['POST', '/api/ai/channels/%FF/test'],
    ['PATCH', '/api/ai/channels/%'],
    ['PATCH', '/api/ai/channels/%zz'],
    ['DELETE', '/api/ai/channels/%E0%A4%A0%A4'],
    ['DELETE', '/api/ai/channels/%FF'],
  ])('%s %s → 404 + JSON（不再是 500 text/plain）', async (method, path) => {
    const res = await proxy(request(path, method))
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toEqual({ ok: false, error: '找不到这个渠道' })
  })

  it('与正常「渠道不存在」的响应逐字节同形', async () => {
    const res = await proxy(request('/api/ai/channels/%E0%A4%A'))
    const normal = channelNotFoundResponse()
    expect(res.status).toBe(normal.status)
    expect(res.headers.get('content-type')).toBe(normal.headers.get('content-type'))
    expect(await res.json()).toEqual(await normal.json())
  })

  it.each([
    ['PATCH', '/api/ai/channels/no-such-key'],
    ['PATCH', '/api/ai/channels/%63%31'],
    ['POST', '/api/ai/channels/c1/test'],
    ['GET', '/api/ai/channels'],
  ])('%s %s → 放行给路由（不被 proxy 误拦）', async (method, path) => {
    const res = await proxy(request(path, method))
    expect(res.status).toBe(200)
    expect(res.headers.get('x-middleware-next')).toBe('1')
  })
})

describe('proxy matcher 必须覆盖渠道路由', () => {
  it('matcher 包含 /api/ai/channels/:path*', () => {
    expect(config.matcher).toContain('/api/ai/channels/:path*')
  })
})
