import type { Payload } from 'payload'

import { keyIdOf, needsReencrypt, open, seal } from '@/lib/ai-channels-crypto'
import { readChannels } from '@/lib/ai-channels'

/**
 * `PAYLOAD_SECRET` 轮换后的「重加密渠道密钥」逻辑。
 *
 * 背景：密文带钥匙代次（`v1:<keyId>:...`）。轮换顺序是
 *   1. 旧钥匙留在 `AI_CHANNELS_OLD_KEYS`，新 secret 写进 `PAYLOAD_SECRET`；
 *   2. 跑本脚本，把每条旧代次的密文用旧钥匙解开、用新钥匙重新加密、写回；
 *   3. 确认全部升级完，再删掉 `AI_CHANNELS_OLD_KEYS`。
 *
 * 这一步**必须先备份数据库**：脚本是就地改写密文，中途被打断会留下新旧混排，
 * 但只要旧钥匙还在环境变量里，重跑脚本就能继续（幂等）。
 *
 * 本文件只放可测的纯逻辑；CLI 在 `scripts/rotate-ai-channels-key.ts`。
 */

/** 一条渠道的重加密结果。 */
export type ReencryptOutcome =
  | { status: 'upgraded'; userId: string; channelKey: string; from: string | null; to: string }
  | { status: 'already-current'; userId: string; channelKey: string }
  | { status: 'skipped-empty'; userId: string; channelKey: string }
  | { status: 'failed'; userId: string; channelKey: string; reason: string }

export type ReencryptSummary = {
  /** 真实写库的用户数 */
  usersUpdated: number
  upgraded: number
  alreadyCurrent: number
  skippedEmpty: number
  failed: number
  /** 逐条结果（dry run 也返回） */
  outcomes: ReencryptOutcome[]
}

type UserDocLike = {
  id: string
  companyProfile?: Record<string, unknown> | null
}

type PayloadLike = {
  find(args: {
    collection: 'users'
    depth?: number
    overrideAccess?: boolean
    limit?: number
    page?: number
  }): Promise<{ docs: UserDocLike[]; hasNextPage?: boolean; totalPages?: number }>
  update(args: {
    collection: 'users'
    id: string
    data: Record<string, unknown>
    overrideAccess?: boolean
    depth?: number
  }): Promise<unknown>
}

async function* iterateUsers(payload: PayloadLike, pageSize = 50): AsyncGenerator<UserDocLike> {
  let page = 1
  for (;;) {
    // **不要加 `select: { companyProfile: true }`**：实测 Payload 4.0.0-beta.4 对
    // hasMany 文本子字段（`aiChannels[].models`）会返回 `[]`。本函数的结果会被
    // 原样写回 `companyProfile.aiChannels`，加了 select 就会把每个渠道的模型列表清空。
    // `depth: 0` 已经足够轻（不展开关系），不需要再用 select 省字段。
    const result = await payload.find({
      collection: 'users',
      depth: 0,
      overrideAccess: true,
      limit: pageSize,
      page,
    })
    for (const doc of result.docs) yield doc
    if (result.hasNextPage === false) return
    if (result.totalPages !== undefined && page >= result.totalPages) return
    if (!result.docs.length) return
    page += 1
  }
}

/**
 * 把某个 user 文档里所有渠道的密文升级到当前钥匙。
 * 返回 null 表示不需要写库（没有可升级的），否则返回「写回用的渠道数组」。
 */
export function reencryptChannelsOf(
  userId: string,
  userDoc: unknown,
): { rows: Record<string, unknown>[] | null; outcomes: ReencryptOutcome[] } {
  const rows = readChannels(userDoc)
  const outcomes: ReencryptOutcome[] = []
  let changed = false

  const nextRows = rows.map((row) => {
    const channelKey = String(row.key ?? '')
    const cipher = typeof row.apiKeyCipher === 'string' ? row.apiKeyCipher : ''
    if (!cipher) {
      outcomes.push({ status: 'skipped-empty', userId, channelKey })
      return row
    }
    try {
      if (!needsReencrypt(cipher)) {
        outcomes.push({ status: 'already-current', userId, channelKey })
        return row
      }
      const from = keyIdOf(cipher)
      const plaintext = open(cipher)
      const resealed = seal(plaintext)
      changed = true
      outcomes.push({
        status: 'upgraded',
        userId,
        channelKey,
        from: from ?? null,
        to: String(keyIdOf(resealed) ?? ''),
      })
      return { ...row, apiKeyCipher: resealed }
    } catch (error) {
      // 解密失败（旧钥匙没配 / 密文坏）→ 计入失败，不写坏数据，由人工处理
      outcomes.push({
        status: 'failed',
        userId,
        channelKey,
        reason: (error as Error)?.message || '未知错误',
      })
      return row
    }
  })

  return { rows: changed ? (nextRows as Record<string, unknown>[]) : null, outcomes }
}

/**
 * 全库重加密。`dryRun` 只统计不写库。
 *
 * 写库时保留 `companyProfile` 其它字段，避免把抬头 / Logo / 模板抹掉
 * （与 `src/lib/ai-channels.ts` 的 saveChannels 同样的做法）。
 */
export async function reencryptAllChannels(
  payload: PayloadLike,
  opts: { dryRun?: boolean; log?: (line: string) => void } = {},
): Promise<ReencryptSummary> {
  const log = opts.log ?? (() => {})
  const summary: ReencryptSummary = {
    usersUpdated: 0,
    upgraded: 0,
    alreadyCurrent: 0,
    skippedEmpty: 0,
    failed: 0,
    outcomes: [],
  }

  for await (const doc of iterateUsers(payload)) {
    const { rows, outcomes } = reencryptChannelsOf(String(doc.id), doc)
    summary.outcomes.push(...outcomes)
    for (const o of outcomes) {
      if (o.status === 'upgraded') summary.upgraded += 1
      else if (o.status === 'already-current') summary.alreadyCurrent += 1
      else if (o.status === 'skipped-empty') summary.skippedEmpty += 1
      else {
        summary.failed += 1
        log(`  ✗ 用户 ${o.userId} / 渠道 ${o.channelKey}：${o.reason}`)
      }
    }
    if (!rows) continue

    if (opts.dryRun) {
      summary.usersUpdated += 1
      continue
    }

    // `find` 已经返回完整文档（没有 select），直接用它的 companyProfile 写回。
    const profile = doc.companyProfile ?? {}
    await payload.update({
      collection: 'users',
      id: String(doc.id),
      data: { companyProfile: { ...profile, aiChannels: rows } } as never,
      overrideAccess: true,
      depth: 0,
    })
    summary.usersUpdated += 1
    log(`  ✓ 用户 ${doc.id}：已重加密 ${outcomes.filter((o) => o.status === 'upgraded').length} 条`)
  }

  return summary
}

export type { PayloadLike as RotatePayloadLike }
/** 仅为类型完整性：生产调用传真实 `Payload`，测试传假实现。 */
export type AnyPayload = Payload
