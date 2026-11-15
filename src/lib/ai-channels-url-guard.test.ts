import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ChannelUrlError,
  assertChannelBaseUrl,
  isBlockedIPv4,
  isBlockedIPv6,
  safeChannelFetch,
} from './ai-channels-url-guard'

/** 断言抛出的确实是 ChannelUrlError（而非别的运行时错误）。 */
const expectReject = (fn: () => unknown) => {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(ChannelUrlError)
    return error as ChannelUrlError
  }
  throw new Error('期望抛出 ChannelUrlError，实际没有抛错')
}

describe('assertChannelBaseUrl：SSRF 拒绝清单', () => {
  const blocked: [string, string][] = [
    ['http://127.0.0.1', 'IPv4 回环'],
    ['https://127.0.0.1', 'IPv4 回环（HTTPS 也不行）'],
    ['https://127.1.2.3:443/v1', '127/8 任意地址'],
    ['https://10.0.0.5/v1', '10/8'],
    ['https://172.16.0.1/v1', '172.16/12'],
    ['https://172.31.255.255/v1', '172.16/12 上界'],
    ['https://192.168.1.1/v1', '192.168/16'],
    ['https://169.254.169.254/latest/meta-data/', '云元数据'],
    ['https://0.0.0.0/v1', '未指定地址'],
    ['http://2130706433/', '十进制写法的 127.0.0.1'],
    ['http://0x7f000001/', '十六进制写法的 127.0.0.1'],
    ['https://0x7f000001/', '十六进制写法（HTTPS 也不行）'],
    ['http://0177.0.0.1/', '八进制写法'],
    ['https://[::1]/v1', 'IPv6 回环'],
    ['https://[fe80::1]/v1', 'IPv6 链路本地'],
    ['https://[fc00::1]/v1', 'IPv6 ULA'],
    ['https://[fd12:3456::1]/v1', 'IPv6 ULA fd00::/8'],
    ['https://[::ffff:127.0.0.1]/v1', 'IPv4 映射回环'],
    ['http://example.com/v1', '非 HTTPS'],
    ['https://user:pass@example.com/v1', 'URL 带用户名密码'],
    ['https://user@example.com/v1', 'URL 只带用户名'],
    ['https://example.com:8443/v1', '非 443 端口'],
    ['https://localhost/v1', 'localhost'],
    ['https://foo.local/v1', '.local 内网域名'],
    ['https://metadata.google.internal/v1', '云元数据域名'],
    ['ftp://example.com/v1', '非 HTTP 协议'],
    ['not a url', '完全不是 URL'],
    ['', '空串'],
  ]

  for (const [url, label] of blocked) {
    it(`拒绝 ${url}（${label}）`, () => {
      expectReject(() => assertChannelBaseUrl(url))
    })
  }
})

describe('assertChannelBaseUrl：合法地址', () => {
  it('接受公网 HTTPS 并去掉结尾斜杠', () => {
    expect(assertChannelBaseUrl('https://api.example.com/v1')).toBe('https://api.example.com/v1')
    expect(assertChannelBaseUrl('https://api.example.com/v1/')).toBe('https://api.example.com/v1')
  })

  it('接受带端口号 443 的写法', () => {
    expect(assertChannelBaseUrl('https://api.example.com:443/v1')).toBe(
      'https://api.example.com:443/v1',
    )
  })

  it('去掉客户多写的 /chat/completions（沿用 normalizeCustomBaseUrl 的行为）', () => {
    expect(assertChannelBaseUrl('https://api.example.com/v1/chat/completions')).toBe(
      'https://api.example.com/v1',
    )
  })
})

describe('IP 判定函数', () => {
  it('IPv4 内网段全部为真', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '172.31.255.254',
      '192.168.0.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
    ])
      expect(isBlockedIPv4(ip)).toBe(true)
  })

  it('IPv4 公网段为假', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '104.20.23.154', '172.32.0.1'])
      expect(isBlockedIPv4(ip)).toBe(false)
  })

  it('IPv6 内网段为真、公网为假', () => {
    for (const ip of ['::1', '::', 'fe80::1', 'fc00::1', 'fd00::1', '::ffff:127.0.0.1'])
      expect(isBlockedIPv6(ip)).toBe(true)
    for (const ip of ['2606:4700:4700::1111', '2001:4860:4860::8888'])
      expect(isBlockedIPv6(ip)).toBe(false)
  })
})

describe('safeChannelFetch：不跟随重定向 / DNS 层拦截', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('目标域名解析失败时直接拒绝，连 fetch 都不发', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    await expect(safeChannelFetch('https://rebind.invalid', 'models')).rejects.toBeInstanceOf(
      ChannelUrlError,
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('DNS rebinding：域名解析到回环时被第二道闸拦住（真实 DNS 解析）', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    // loca.lt / 127.0.0.1.nip.io 这类域名会解析回环；本机 resolver 可能离线，
    // 所以这里同时接受「解析失败」与「解析到内网被拒」——两者都不允许发请求。
    const error = await safeChannelFetch('https://127.0.0.1.nip.io', 'models').then(
      () => null,
      (e) => e,
    )
    expect(error).toBeInstanceOf(ChannelUrlError)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('3xx 重定向一律不跟随，按失败返回', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(null, { status: 302, headers: { Location: 'https://169.254.169.254/' } }),
      ),
    )
    // 用真实公网域名（静态校验 + DNS 都过得去），只把 fetch 换成返回 302 的桩
    await expect(safeChannelFetch('https://api.openai.com/v1', 'models')).rejects.toBeInstanceOf(
      ChannelUrlError,
    )
  })
})
