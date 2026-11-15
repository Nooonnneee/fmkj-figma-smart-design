import { isIP } from 'node:net'

import { normalizeCustomBaseUrl } from '@/plugins/ai-copilot/templates'

/**
 * 成员自填 AI 渠道的出口地址校验（SSRF 防御）。
 *
 * 背景：渠道地址是**客户填的**，却由**我们的服务器**去请求 —— 等于把服务器放进客户的
 * 出网通道。只靠 `normalizeCustomBaseUrl`（只要求公网 HTTPS）不够，它会放过
 * `https://127.0.0.1/`、`https://169.254.169.254/`（云元数据）、十六进制/十进制
 * 写法的 IP、`user:pass@host` 形式，也不防 DNS rebinding。
 *
 * 这里的策略是「静态拒之门外 + 请求前再验一次解析结果」：
 * 1. `assertChannelBaseUrl` —— 存储/使用前的静态校验，在 `normalizeCustomBaseUrl`
 *    的结果上再收紧（**只 import 那个函数，不修改它**）。
 * 2. `resolveAndAssertPublicHost` —— 真正发请求前用 `dns.lookup(all:true)` 拿到解析结果，
 *    **每个** IP 都必须过公网黑名单。这一步防的就是 DNS rebinding。
 *
 * 残余风险（不假装它不存在）：`fetch` 自己会再解析一次域名，理论上仍存在
 * 「校验时解析到公网、连接时解析到内网」的竞态窗口。彻底的做法是自建 socket 把已
 * 校验 IP 钉死。我们已把窗口压到一次请求内，并且禁止跟随重定向（见 `safeChannelFetch`），
 * 对「客户自带渠道」这个场景够用。
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '0.0.0.0',
  '127.0.0.1',
  '::1',
  '::',
  'metadata',
  'metadata.google.internal',
  'instance-data',
])

const PRIVATE_HOST_SUFFIXES = ['.local', '.internal', '.localhost', '.home.arpa']

export class ChannelUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChannelUrlError'
  }
}

/** IPv4 点分十进制 → 32 位整数；非法输入返回 null。 */
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let value = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const n = Number(part)
    if (n > 255) return null
    value = value * 256 + n
  }
  return value >>> 0
}

/** 判断 IPv4 是否落在必须拒绝的内网 / 保留网段。 */
export function isBlockedIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip)
  if (n === null) return true // 解析不了的一律拒绝
  const inRange = (base: string, bits: number) => {
    const baseInt = ipv4ToInt(base)!
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
    return (n & mask) === (baseInt & mask)
  }
  return (
    inRange('0.0.0.0', 8) || // 「本网络」
    inRange('10.0.0.0', 8) ||
    inRange('100.64.0.0', 10) || // 运营商级 NAT，内网常借道
    inRange('127.0.0.0', 8) ||
    inRange('169.254.0.0', 16) || // 云元数据 169.254.169.254
    inRange('172.16.0.0', 12) ||
    inRange('192.0.0.0', 24) ||
    inRange('192.168.0.0', 16) ||
    inRange('198.18.0.0', 15) || // 基准测试网段
    inRange('224.0.0.0', 4) || // 组播
    inRange('240.0.0.0', 4) // 保留
  )
}

/**
 * IPv6 文本 → 16 字节数组。支持 `::` 压缩与末尾内嵌 IPv4（`::ffff:127.0.0.1`）。
 * 只做「判断是否内网」用；解析失败返回 null（调用方按可疑处理）。
 */
function parseIPv6(input: string): number[] | null {
  let text = input.toLowerCase()
  const zone = text.indexOf('%')
  if (zone !== -1) text = text.slice(0, zone) // 去掉 fe80::1%en0 的 zone id

  // 抽出末尾内嵌的 IPv4，换成两个 16 位组（::ffff:127.0.0.1 → ::ffff:7f00:1）
  const tail: number[] = []
  const lastColon = text.lastIndexOf(':')
  if (lastColon !== -1 && text.slice(lastColon + 1).includes('.')) {
    const v4 = ipv4ToInt(text.slice(lastColon + 1))
    if (v4 === null) return null
    tail.push(v4 >>> 16, v4 & 0xffff)
    text = text.slice(0, lastColon + 1)
  }

  const halves = text.split('::')
  if (halves.length > 2) return null
  const headRaw = halves[0] === '' ? [] : halves[0].split(':')
  // 去掉 IPv4 后可能残留一个空段（`::ffff:`）
  const restRaw =
    halves.length === 2 && halves[1] !== '' ? halves[1].split(':').filter((g) => g !== '') : []
  const words: number[] = []
  for (const g of [...headRaw, ...restRaw]) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null
    words.push(parseInt(g, 16))
  }
  const targetLen = 8 - tail.length
  let fullWords: number[]
  if (halves.length === 2) {
    const missing = targetLen - words.length
    if (missing < 0) return null
    const headLen = headRaw.filter((g) => g !== '').length
    fullWords = [...words.slice(0, headLen), ...Array(missing).fill(0), ...words.slice(headLen)]
  } else {
    if (words.length !== targetLen) return null
    fullWords = words
  }
  const bytes: number[] = []
  for (const w of [...fullWords, ...tail]) {
    bytes.push(w >>> 8, w & 0xff)
  }
  return bytes
}

/**
 * 判断 IPv6 是否落在必须拒绝的网段。
 *
 * 覆盖：未指定 / 回环、IPv4 的每一种内嵌写法（映射 `::ffff:0:0/96`、兼容 `::a.b.c.d`、
 * IPv4-translated `::ffff:0:0:0/96`、NAT64 `64:ff9b::/96`、6to4 `2002::/16`）、
 * 链路本地、唯一本地、deprecated site-local、组播、以及文档/保留网段。
 *
 * 复核说这些「实际不可利用」（本机 EHOSTUNREACH，且 `dns.lookup` 对字面量原样返回），
 * 但补进黑名单成本极低，属防御纵深。
 */
export function isBlockedIPv6(ip: string): boolean {
  const b = parseIPv6(ip)
  if (!b) return true
  const isV4 = (from: number) =>
    isBlockedIPv4(`${b[from]}.${b[from + 1]}.${b[from + 2]}.${b[from + 3]}`)
  const zeros = (from: number, to: number) => b.slice(from, to).every((x) => x === 0)

  if (b.every((x) => x === 0)) return true // ::
  if (zeros(0, 15) && b[15] === 1) return true // ::1
  // ::ffff:a.b.c.d —— IPv4 映射地址（::ffff:0:0/96），取内嵌 IPv4 再判
  if (zeros(0, 10) && b[10] === 0xff && b[11] === 0xff) return isV4(12)
  // ::a.b.c.d —— IPv4 兼容地址（deprecated），同样取内嵌 IPv4 再判。
  // 注意这条必须放在「回环/未指定」之后，否则 ::1 会被误当成 0.0.0.1。
  if (zeros(0, 12)) return isV4(12)
  // ::ffff:0:a.b.c.d —— IPv4-translated（::ffff:0:0:0/96）
  if (zeros(0, 8) && b[8] === 0xff && b[9] === 0xff && zeros(10, 12)) return isV4(12)
  // 64:ff9b::/96 —— NAT64，内嵌 IPv4 也要判
  if (b[0] === 0 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b && zeros(4, 12)) return isV4(12)
  // 2002::/16 —— 6to4，内嵌 IPv4 在第 2~5 字节
  if (b[0] === 0x20 && b[1] === 0x02) return isV4(2)
  // fe80::/10 链路本地
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return true
  // fec0::/10 —— deprecated site-local，行为等同内网，历史配置里还可能出现
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0xc0) return true
  // fc00::/7 唯一本地地址（含 fd00::/8）
  if ((b[0] & 0xfe) === 0xfc) return true
  // ff00::/8 组播
  if (b[0] === 0xff) return true
  // 100::/64 —— 丢弃前缀（RFC 6666）
  if (b[0] === 0x01 && b[1] === 0x00 && zeros(2, 8)) return true
  // 2001:db8::/32 —— 文档专用
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) return true
  return false
}

/** 任意 IP（v4 / v6）是否被禁止访问。非 IP 文本按「可疑」拒绝。 */
export function isBlockedIp(ip: string): boolean {
  const family = isIP(ip)
  if (family === 4) return isBlockedIPv4(ip)
  if (family === 6) return isBlockedIPv6(ip)
  return true
}

/**
 * 静态校验客户填的渠道地址，通过则返回规范化后的 base（无结尾斜杠），否则抛
 * `ChannelUrlError`（消息可以直接回给前端）。
 *
 * 相比 `normalizeCustomBaseUrl` 额外拒绝：
 * - 用户名/密码形式（`https://user:pass@host`）；
 * - 任何 IP 字面值 —— 包括 `http://2130706433/`、`http://0x7f000001/`、
 *   `http://0177.0.0.1/`：浏览器 URL 解析器会把这些写法归一成 `127.0.0.1`，
 *   所以只看解析后的 `hostname` 就足以挡住十进制/十六进制/八进制绕过；
 * - 非 443 的显式端口 —— 否则等于给了一个端口扫描器。
 */
export function assertChannelBaseUrl(raw: unknown): string {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new ChannelUrlError('请填写渠道接口地址')
  }
  const trimmed = raw.trim()
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new ChannelUrlError('接口地址格式不正确（需要完整的 https:// 地址）')
  }
  if (url.protocol !== 'https:') {
    throw new ChannelUrlError('接口地址必须是 https://（不允许 http 或其它协议）')
  }
  if (url.username || url.password) {
    throw new ChannelUrlError('接口地址不能包含用户名或密码')
  }
  if (url.port && url.port !== '443') {
    throw new ChannelUrlError('接口地址只能是默认的 443 端口')
  }

  const host = url.hostname.toLowerCase()
  if (BLOCKED_HOSTNAMES.has(host)) throw new ChannelUrlError('不允许使用本机或内网地址')
  if (PRIVATE_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new ChannelUrlError('不允许使用内网域名')
  }
  if (isIP(host) !== 0) throw new ChannelUrlError('接口地址必须使用域名，不能直接填 IP 地址')
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(host)) {
    throw new ChannelUrlError('接口地址的域名格式不正确')
  }

  // 最后交给现有规范化函数做一次「公网 HTTPS」复核（只 import，不修改）
  const normalized = normalizeCustomBaseUrl(trimmed)
  if (!normalized) throw new ChannelUrlError('请填写公网 HTTPS 地址')
  return normalized
}

/**
 * 发请求前的 DNS 解析校验：解析结果里的**每一个** IP 都必须是公网地址。
 * 这是防 DNS rebinding 的关键一步 —— 静态字符串校验看不出域名会解析到哪。
 */
export async function resolveAndAssertPublicHost(hostname: string): Promise<string[]> {
  const { lookup } = await import('node:dns/promises')
  let records: { address: string; family: number }[]
  try {
    records = await lookup(hostname, { all: true, verbatim: true })
  } catch {
    throw new ChannelUrlError('渠道地址的域名无法解析')
  }
  if (!records.length) throw new ChannelUrlError('渠道地址的域名没有解析结果')
  for (const record of records) {
    if (isBlockedIp(record.address)) {
      throw new ChannelUrlError(
        `渠道地址解析到了内网地址（${record.address}），已拒绝：这可能是 DNS rebinding`,
      )
    }
  }
  return records.map((r) => r.address)
}

export type SafeFetchResult = {
  ok: boolean
  status: number
  body: string
}

const MAX_RESPONSE_BYTES = 256 * 1024

/**
 * 请求客户填的地址：全套防护都在这里，避免调用方漏掉某一条。
 * - 先做静态地址校验，再做 DNS 解析校验（防 rebinding）；
 * - `redirect: 'manual'`，**不跟随重定向**（跟随等于把白名单绕过去）；
 * - 硬超时（`AbortSignal.timeout`），不挂死；
 * - 响应体上限 256KB，防止被人灌大文件。
 */
export async function safeChannelFetch(
  rawBaseUrl: string,
  path: string,
  init: {
    method?: string
    headers?: Record<string, string>
    body?: string
    timeoutMs?: number
  } = {},
): Promise<SafeFetchResult> {
  const base = assertChannelBaseUrl(rawBaseUrl)
  const url = new URL(`${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`)
  await resolveAndAssertPublicHost(url.hostname)

  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers: init.headers,
    body: init.body,
    redirect: 'manual',
    signal: AbortSignal.timeout(init.timeoutMs ?? 15_000),
  })
  // 3xx 一律当失败：手动模式下拿到的是重定向响应，跟随它就绕过了上面所有校验。
  if (res.status >= 300 && res.status < 400) {
    throw new ChannelUrlError('渠道地址返回了重定向，已拒绝跟随')
  }
  const reader = res.body?.getReader()
  if (!reader) return { ok: res.ok, status: res.status, body: '' }
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel().catch(() => null)
      break
    }
    chunks.push(value)
  }
  const body = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8')
  return { ok: res.ok, status: res.status, body }
}
