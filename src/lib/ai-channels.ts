import { apiKeyHint, open, seal } from '@/lib/ai-channels-crypto'
import {
  ChannelUrlError,
  assertChannelBaseUrl,
  safeChannelFetch,
  type SafeFetchResult,
} from '@/lib/ai-channels-url-guard'
import { consumeRateLimit } from '@/lib/rate-limit'

/**
 * 成员自填 AI 渠道的存取与连通性检查（服务端唯一入口）。
 *
 * 安全边界（改这个文件前必须读）：
 * 1. **所有函数只认 `userId` 参数，而这个参数只能来自 `req.user`**。这里没有任何
 *    按 key 查全局渠道的逻辑 —— 渠道永远挂在某个 user 的 `companyProfile.aiChannels` 下，
 *    所以「A 用户改 B 用户的渠道」在结构上不可能发生。
 * 2. `apiKeyCipher` 字段在 schema 里是 `read: () => false`，只有 `overrideAccess: true`
 *    的内部读库才能拿到；因此**所有出站数据必须走 `publicChannel()`**，绝不能直接
 *    把库里的 row 返回给调用方。
 * 3. 写库同样是 `overrideAccess: true`：字段级 update 权限对 overrideAccess 不生效，
 *    所以**入参必须在进这个文件时就已经白名单化**（见 `normalizeChannelInput`）。
 * 4. 请求客户填的地址一律走 `safeChannelFetch`（静态校验 + DNS 解析校验 + 不跟随重定向 + 超时）。
 */

export const CHANNEL_KEY_RE = /^[A-Za-z0-9_-]{1,40}$/
const MAX_CHANNELS = 20
const MAX_MODELS = 50
const MAX_MODEL_LEN = 120
const TEST_TIMEOUT_MS = 10_000

/** 库里的一行（含密文，只在服务端内部流动）。 */
export type AiChannelRow = {
  id?: string | null
  key?: string | null
  label?: string | null
  baseUrl?: string | null
  apiKeyCipher?: string | null
  apiKeyHint?: string | null
  models?: string[] | null
  enabled?: boolean | null
  lastCheckedAt?: string | null
  lastCheckOk?: boolean | null
  lastCheckError?: string | null
}

/** 可以直接放进 API 响应的视图：**没有** apiKeyCipher。 */
export type PublicAiChannel = {
  key: string
  label: string
  baseUrl: string
  apiKeyHint: string | null
  models: string[]
  enabled: boolean
  lastCheckedAt: string | null
  lastCheckOk: boolean | null
  lastCheckError: string | null
}

export class AiChannelInputError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message)
    this.name = 'AiChannelInputError'
  }
}

/** 库里的 row → 响应视图。唯一允许出站的形状（测试会扫描响应 JSON 断言无密文）。 */
export function publicChannel(row: AiChannelRow): PublicAiChannel {
  return {
    key: String(row.key ?? ''),
    label: String(row.label ?? ''),
    baseUrl: String(row.baseUrl ?? ''),
    apiKeyHint: row.apiKeyHint ? String(row.apiKeyHint) : null,
    models: Array.isArray(row.models)
      ? row.models.filter((m): m is string => typeof m === 'string')
      : [],
    enabled: row.enabled !== false,
    lastCheckedAt: row.lastCheckedAt ? String(row.lastCheckedAt) : null,
    lastCheckOk: typeof row.lastCheckOk === 'boolean' ? row.lastCheckOk : null,
    lastCheckError: row.lastCheckError ? String(row.lastCheckError) : null,
  }
}

/** 从用户文档里取出渠道数组（没有则空数组）。 */
export function readChannels(userDoc: unknown): AiChannelRow[] {
  const profile = (userDoc as { companyProfile?: Record<string, unknown> | null } | null)
    ?.companyProfile
  const rows = profile?.aiChannels
  if (!Array.isArray(rows)) return []
  return rows.filter((r): r is AiChannelRow => Boolean(r) && typeof r === 'object')
}

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/** 模型名数组：去空、去重、限长限数量。 */
export function normalizeModels(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const raw of value) {
    const name = cleanText(raw, MAX_MODEL_LEN)
    if (name && !out.includes(name)) out.push(name)
    if (out.length >= MAX_MODELS) break
  }
  return out
}

export type ChannelInputBody = {
  key?: unknown
  label?: unknown
  baseUrl?: unknown
  apiKey?: unknown
  models?: unknown
  enabled?: unknown
}

export type NormalizedChannelInput = {
  key: string
  label: string
  baseUrl: string
  /** 明文 key；空串表示「不换 key」（仅更新时合法） */
  apiKey: string
  models: string[]
  enabled: boolean
}

/**
 * 白名单化入参。只认这几个字段，其余（包括 userId、lastCheckedAt、apiKeyHint 等）
 * 全部丢弃 —— 防止客户端自己伪造检查结果或往别的账号写数据。
 */
export function normalizeChannelInput(
  body: ChannelInputBody,
  opts: { requireApiKey: boolean },
): NormalizedChannelInput {
  const key = cleanText(body.key, 40)
  if (!CHANNEL_KEY_RE.test(key)) {
    throw new AiChannelInputError('渠道标识只能使用字母、数字、- 和 _，最多 40 字')
  }
  const label = cleanText(body.label, 60)
  if (!label) throw new AiChannelInputError('请填写渠道显示名')

  let baseUrl: string
  try {
    baseUrl = assertChannelBaseUrl(body.baseUrl)
  } catch (error) {
    throw new AiChannelInputError(error instanceof ChannelUrlError ? error.message : '接口地址无效')
  }

  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
  if (opts.requireApiKey && !apiKey) throw new AiChannelInputError('请填写 API Key')
  if (apiKey.length > 4096) throw new AiChannelInputError('API Key 过长')

  return {
    key,
    label,
    baseUrl,
    apiKey,
    models: normalizeModels(body.models),
    enabled: body.enabled !== false,
  }
}

/**
 * 只声明本文件用到的两个 Payload 能力（而不是 Pick 整个 Payload 类型）：
 * 测试里的假 payload 只需要实现这两个方法，不必伪造庞大的泛型签名。
 */
export type PayloadLike = {
  findByID(args: {
    collection: 'users'
    id: string
    depth?: number
    overrideAccess?: boolean
  }): Promise<unknown>
  update(args: {
    collection: 'users'
    id: string
    data: Record<string, unknown>
    overrideAccess?: boolean
    depth?: number
  }): Promise<unknown>
}

/** 读取当前用户（内部用：允许读到密文）。找不到用户按未登录处理。 */
async function loadUser(payload: PayloadLike, userId: string) {
  try {
    return await payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    throw new AiChannelInputError('登录已过期，请重新登录', 401)
  }
}

/** 写回渠道数组：保留 companyProfile 其它字段，避免把抬头/Logo/模板一起抹掉。 */
async function saveChannels(
  payload: PayloadLike,
  userId: string,
  userDoc: unknown,
  rows: AiChannelRow[],
) {
  const profile =
    (userDoc as { companyProfile?: Record<string, unknown> | null } | null)?.companyProfile ?? {}
  await payload.update({
    collection: 'users',
    id: userId,
    data: {
      companyProfile: {
        ...profile,
        // 行里的 `id` 是 Payload 生成的子行 id；保留它，编辑时才不会整段重建。
        aiChannels: rows.map(
          ({
            id,
            key,
            label,
            baseUrl,
            apiKeyCipher,
            apiKeyHint,
            models,
            enabled,
            lastCheckedAt,
            lastCheckOk,
            lastCheckError,
          }) => ({
            ...(id ? { id } : {}),
            key,
            label,
            baseUrl,
            apiKeyCipher,
            apiKeyHint,
            models,
            enabled,
            lastCheckedAt,
            lastCheckOk,
            lastCheckError,
          }),
        ),
      },
    } as never,
    overrideAccess: true,
    depth: 0,
  })
}

/** 列出当前用户自己的渠道（只回可见字段，绝不回密文）。 */
export async function listChannels(
  payload: PayloadLike,
  userId: string,
): Promise<PublicAiChannel[]> {
  const userDoc = await loadUser(payload, userId)
  return readChannels(userDoc).map(publicChannel)
}

/** 新增渠道：加密存 key，回可见视图。 */
export async function createChannel(
  payload: PayloadLike,
  userId: string,
  body: ChannelInputBody,
): Promise<PublicAiChannel> {
  const input = normalizeChannelInput(body, { requireApiKey: true })
  const userDoc = await loadUser(payload, userId)
  const rows = readChannels(userDoc)
  if (rows.length >= MAX_CHANNELS) {
    throw new AiChannelInputError(`最多只能配置 ${MAX_CHANNELS} 个渠道`)
  }
  if (rows.some((r) => r.key === input.key)) {
    throw new AiChannelInputError('这个渠道标识已经用过了，换一个')
  }
  const row: AiChannelRow = {
    key: input.key,
    label: input.label,
    baseUrl: input.baseUrl,
    apiKeyCipher: seal(input.apiKey),
    apiKeyHint: apiKeyHint(input.apiKey),
    models: input.models,
    enabled: input.enabled,
  }
  await saveChannels(payload, userId, userDoc, [...rows, row])
  return publicChannel(row)
}

/**
 * 修改渠道。渠道标识（URL 里的 :key）不可改；`apiKey` 留空表示不换 key。
 * 注意：检查结果（lastCheck*）不允许通过这个接口写 —— 只能由 /test 写，避免伪造「已验证」。
 */
export async function updateChannel(
  payload: PayloadLike,
  userId: string,
  channelKey: string,
  body: ChannelInputBody,
): Promise<PublicAiChannel> {
  const userDoc = await loadUser(payload, userId)
  const rows = readChannels(userDoc)
  const index = rows.findIndex((r) => r.key === channelKey)
  if (index === -1) throw new AiChannelInputError('找不到这个渠道', 404)

  const input = normalizeChannelInput(
    { ...body, key: channelKey, enabled: body.enabled ?? rows[index].enabled },
    { requireApiKey: false },
  )
  const prev = rows[index]
  const next: AiChannelRow = {
    ...prev,
    label: input.label,
    baseUrl: input.baseUrl,
    models: input.models,
    enabled: input.enabled,
    // 地址或密钥变了，旧的检查结果就不再代表当前配置，清掉避免误导
    ...(input.apiKey || input.baseUrl !== prev.baseUrl
      ? { lastCheckedAt: null, lastCheckOk: null, lastCheckError: null }
      : {}),
    ...(input.apiKey
      ? { apiKeyCipher: seal(input.apiKey), apiKeyHint: apiKeyHint(input.apiKey) }
      : {}),
  }
  const nextRows = [...rows]
  nextRows[index] = next
  await saveChannels(payload, userId, userDoc, nextRows)
  return publicChannel(next)
}

/** 删除渠道。 */
export async function deleteChannel(
  payload: PayloadLike,
  userId: string,
  channelKey: string,
): Promise<{ ok: true }> {
  const userDoc = await loadUser(payload, userId)
  const rows = readChannels(userDoc)
  const nextRows = rows.filter((r) => r.key !== channelKey)
  if (nextRows.length === rows.length) throw new AiChannelInputError('找不到这个渠道', 404)
  await saveChannels(payload, userId, userDoc, nextRows)
  return { ok: true }
}

/** 把可能出现在外部响应体里的密钥抹掉，再截断到错误字段长度。 */
function scrubSecret(text: string, secret: string): string {
  let out = text
  if (secret.length >= 4) out = out.split(secret).join('***')
  return out.replace(/\s+/g, ' ').trim().slice(0, 300)
}

type ModelListResponse = { data?: { id?: unknown }[]; models?: { name?: unknown }[] }

/** 从 OpenAI 兼容的 /models 响应里尽力取出模型名（取不到就给空数组，不影响检查结论）。 */
function extractModelNames(body: string): string[] {
  try {
    const json = JSON.parse(body) as ModelListResponse
    const rows = Array.isArray(json.data)
      ? json.data
      : Array.isArray(json.models)
        ? json.models
        : []
    return normalizeModels(
      rows.map(
        (r) => (r as { id?: unknown; name?: unknown })?.id ?? (r as { name?: unknown })?.name,
      ),
    )
  } catch {
    return []
  }
}

export type ChannelTestResult = {
  ok: boolean
  status: number
  error: string | null
  models: string[]
  testedAt: string
}

/**
 * 用该渠道真实请求一次 `/models`，把结果写回 lastCheck*。
 *
 * - 限流：每用户每渠道 10 次 / 分钟，另加每用户 30 次 / 分钟（多实例下不准确，见 rate-limit.ts）。
 * - 日志：只记 userId / 渠道标识 / 结果 / 耗时，**绝不记 key 明文或密文**。
 * - `fetchImpl` 只用于测试注入，生产调用不传。
 */
export async function testChannel(
  payload: PayloadLike,
  userId: string,
  channelKey: string,
  fetchImpl: (
    baseUrl: string,
    path: string,
    init?: { method?: string; headers?: Record<string, string>; timeoutMs?: number },
  ) => Promise<SafeFetchResult> = safeChannelFetch,
): Promise<ChannelTestResult> {
  const perChannel = consumeRateLimit(`ai-channel-test:${userId}:${channelKey}`, 10, 60_000)
  const perUser = consumeRateLimit(`ai-channel-test-user:${userId}`, 30, 60_000)
  if (!perChannel.ok || !perUser.ok) {
    const retry = Math.max(
      perChannel.ok ? 0 : perChannel.retryAfterSeconds,
      perUser.ok ? 0 : perUser.retryAfterSeconds,
    )
    throw new AiChannelInputError(`检查太频繁，请 ${retry} 秒后再试`, 429)
  }

  const userDoc = await loadUser(payload, userId)
  const rows = readChannels(userDoc)
  const index = rows.findIndex((r) => r.key === channelKey)
  if (index === -1) throw new AiChannelInputError('找不到这个渠道', 404)
  const row = rows[index]
  if (!row.apiKeyCipher) throw new AiChannelInputError('这个渠道还没有填 API Key', 400)
  if (!row.baseUrl) throw new AiChannelInputError('这个渠道还没有填接口地址', 400)

  // 解密失败（换过 PAYLOAD_SECRET / 密文损坏）必须显式报错，不能当成「未配置」放过
  let secret: string
  try {
    secret = open(String(row.apiKeyCipher))
  } catch {
    const error = '这个渠道的密钥无法解密（PAYLOAD_SECRET 可能已更换），请重新填写'
    const nextRows = [...rows]
    nextRows[index] = {
      ...row,
      lastCheckedAt: new Date().toISOString(),
      lastCheckOk: false,
      lastCheckError: error,
    }
    await saveChannels(payload, userId, userDoc, nextRows)
    console.warn('[ai-channels] decrypt failed', { userId, key: channelKey })
    return { ok: false, status: 0, error, models: [], testedAt: nextRows[index].lastCheckedAt! }
  }

  const startedAt = Date.now()
  let result: ChannelTestResult
  try {
    const res = await fetchImpl(row.baseUrl, 'models', {
      method: 'GET',
      headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' },
      timeoutMs: TEST_TIMEOUT_MS,
    })
    const ok = res.ok
    const models = ok ? extractModelNames(res.body) : []
    const error = ok
      ? null
      : res.status === 401 || res.status === 403
        ? '密钥无效或没有权限'
        : `渠道返回 HTTP ${res.status}`
    result = { ok, status: res.status, error, models, testedAt: new Date().toISOString() }
  } catch (error) {
    const message =
      error instanceof ChannelUrlError
        ? error.message
        : (error as Error)?.name === 'TimeoutError' || (error as Error)?.name === 'AbortError'
          ? '检查超时（10 秒），请确认地址是否可达'
          : '无法连接到这个地址'
    result = {
      ok: false,
      status: 0,
      error: message,
      models: [],
      testedAt: new Date().toISOString(),
    }
  }

  const nextRows = [...rows]
  nextRows[index] = {
    ...row,
    lastCheckedAt: result.testedAt,
    lastCheckOk: result.ok,
    lastCheckError: result.error ? scrubSecret(result.error, secret) : null,
  }
  await saveChannels(payload, userId, userDoc, nextRows)

  // 只记可公开的元信息；key 明文/密文都不进日志。
  console.info('[ai-channels] connectivity test', {
    userId,
    key: channelKey,
    ok: result.ok,
    status: result.status,
    ms: Date.now() - startedAt,
  })
  return result
}
