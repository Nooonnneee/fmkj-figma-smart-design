import { describe, expect, it } from 'vitest'

import { checkSameOrigin, rejectCrossOrigin, readJsonBody } from './ai-channels-http'

/** 构造一个带指定头的请求（不走网络）。 */
const req = (headers: Record<string, string>, url = 'https://fmkj.top/api/ai/channels') =>
  new Request(url, { method: 'POST', headers, body: '{}' })

describe('checkSameOrigin（/api/ai/channels* 的 CSRF 校验）', () => {
  it('同站 Origin 放行', () => {
    expect(checkSameOrigin(req({ host: 'fmkj.top', origin: 'https://fmkj.top' })).ok).toBe(true)
  })

  it('跨站 Origin 拒绝（复核里那条 curl 的形态）', () => {
    const r = checkSameOrigin(req({ host: 'fmkj.top', origin: 'https://evil.example.com' }))
    expect(r.ok).toBe(false)
  })

  it('只认 Host：代理原样透传 Host 时同站照常放行', () => {
    // nginx 的 `proxy_set_header Host $host` / Caddy 默认透传 → Host 就是公网域名
    expect(
      checkSameOrigin(
        req({ host: 'fmkj.top', 'x-forwarded-host': 'fmkj.top', origin: 'https://fmkj.top' }),
      ).ok,
    ).toBe(true)
  })

  it('不认 X-Forwarded-Host：伪造 XFH 不能绕过（复核那条 201 的形态）', () => {
    const foreign = checkSameOrigin(
      req({
        host: 'fmkj.top',
        'x-forwarded-host': 'evil.example.com',
        origin: 'https://evil.example.com',
      }),
    )
    expect(foreign.ok).toBe(false)

    // 即便 Host 是内网地址（代理没透传 Host），XFH 也不能把它洗成同站
    const proxied = checkSameOrigin(
      req({
        host: '127.0.0.1:3000',
        'x-forwarded-host': 'fmkj.top',
        origin: 'https://fmkj.top',
      }),
    )
    expect(proxied.ok).toBe(false)
  })

  it('端口不同算跨站（origin 带端口时按 host 比较）', () => {
    const r = checkSameOrigin(req({ host: 'fmkj.top', origin: 'https://fmkj.top:8443' }))
    expect(r.ok).toBe(false)
  })

  it('Origin 畸形 → 拒绝', () => {
    expect(checkSameOrigin(req({ host: 'fmkj.top', origin: 'not-a-url' })).ok).toBe(false)
  })

  it('没有 Origin 时看 Sec-Fetch-Site：cross-site 拒绝', () => {
    expect(checkSameOrigin(req({ host: 'fmkj.top', 'sec-fetch-site': 'cross-site' })).ok).toBe(
      false,
    )
    expect(checkSameOrigin(req({ host: 'fmkj.top', 'sec-fetch-site': 'same-origin' })).ok).toBe(
      true,
    )
  })

  it('两者都没有（curl / 服务间调用）放行 —— 此时没有浏览器的自动附带 Cookie 语义', () => {
    expect(checkSameOrigin(req({ host: 'fmkj.top' })).ok).toBe(true)
  })

  it('rejectCrossOrigin：跨站返回 403 JSON', async () => {
    const res = rejectCrossOrigin(req({ host: 'fmkj.top', origin: 'https://evil.example.com' }))
    expect(res).not.toBeNull()
    expect(res!.status).toBe(403)
    const body = (await res!.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toContain('跨站')
  })

  it('rejectCrossOrigin：同站返回 null（继续走正常流程）', () => {
    expect(rejectCrossOrigin(req({ host: 'fmkj.top', origin: 'https://fmkj.top' }))).toBeNull()
  })
})

describe('readJsonBody：请求体里的 userId 绝对进不来', () => {
  /**
   * 复核指出：把 `userId` 加进 readJsonBody 的白名单，16 条测试全绿 ——
   * 说明「请求体里的 userId 进不来」这个性质**没有测试直接覆盖**。
   * 这一条就是补它：直接断言输出对象的键集合。
   */
  it('输出只包含 6 个白名单字段，userId / id / lastCheck* 全部被丢弃', async () => {
    const body = await readJsonBody(
      new Request('https://fmkj.top/api/ai/channels', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          key: 'c1',
          label: 'C1',
          baseUrl: 'https://api.example.com/v1',
          apiKey: 'sk-x',
          models: ['m'],
          enabled: true,
          // 下面这些都不该出现
          userId: 'victim-user-id',
          id: 'row-id',
          lastCheckOk: true,
          lastCheckedAt: '2020-01-01T00:00:00.000Z',
          lastCheckError: 'I verified this myself',
          apiKeyCipher: 'PLAINTEXT-NOT-ENCRYPTED',
          companyProfile: { name: 'hijack' },
        }),
      }),
    )
    expect(Object.keys(body).sort()).toEqual(
      ['apiKey', 'baseUrl', 'enabled', 'key', 'label', 'models'].sort(),
    )
    expect(JSON.stringify(body)).not.toContain('victim-user-id')
    expect(JSON.stringify(body)).not.toContain('lastCheck')
    expect(JSON.stringify(body)).not.toContain('PLAINTEXT-NOT-ENCRYPTED')
  })

  it('非对象 / 数组 / 坏 JSON 都返回空对象', async () => {
    const mk = (raw: string) =>
      new Request('https://fmkj.top/api/ai/channels', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: raw,
      })
    expect(await readJsonBody(mk('[]'))).toEqual({})
    expect(await readJsonBody(mk('"str"'))).toEqual({})
    expect(await readJsonBody(mk('not json'))).toEqual({})
  })
})
