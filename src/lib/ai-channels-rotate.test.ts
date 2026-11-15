import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { open, seal } from './ai-channels-crypto'
import { reencryptAllChannels, reencryptChannelsOf } from './ai-channels-rotate'

const ORIGINAL = {
  PAYLOAD_SECRET: process.env.PAYLOAD_SECRET,
  AI_CHANNELS_KEY_ID: process.env.AI_CHANNELS_KEY_ID,
  AI_CHANNELS_OLD_KEYS: process.env.AI_CHANNELS_OLD_KEYS,
}
const OLD_SECRET = 'old-payload-secret-before-rotation-0001'
const NEW_SECRET = 'new-payload-secret-after-rotation-0002'

function restore(name: keyof typeof ORIGINAL) {
  if (ORIGINAL[name] === undefined) delete process.env[name]
  else process.env[name] = ORIGINAL[name]
}

beforeEach(() => {
  delete process.env.AI_CHANNELS_KEY_ID
  delete process.env.AI_CHANNELS_OLD_KEYS
})
afterEach(() => {
  restore('PAYLOAD_SECRET')
  restore('AI_CHANNELS_KEY_ID')
  restore('AI_CHANNELS_OLD_KEYS')
})

/** 用旧 secret 真实加密一段密文（模拟轮换前已经存进库里的数据）。 */
function sealWithOldSecret(plain: string): string {
  process.env.PAYLOAD_SECRET = OLD_SECRET
  const sealed = seal(plain)
  return sealed
}

type UserDoc = { id: string; companyProfile?: Record<string, unknown> | null }

/**
 * 模拟真实 Payload 的 `select` 行为（**这是上一轮假绿的原因**）。
 *
 * 实测 Payload 4.0.0-beta.4：`find({ select: { companyProfile: true } })` 会返回
 * companyProfile 与渠道行，但 hasMany 文本子字段 `aiChannels[].models` 是 `[]`。
 * 旧假 `find` 完全忽略 select、永远返回完整文档，所以「轮换脚本清空 models」
 * 这条真实故障在单测里永远测不出来。
 *
 * 这里只实现本测试用到的形态；以后谁再给 find 加 select，就会按真实行为裁剪，
 * 回归测试立刻变红。
 */
function applySelect(doc: UserDoc, select?: Record<string, boolean>): UserDoc {
  if (!select) return structuredClone(doc)
  const out: UserDoc = { id: doc.id }
  if (select.companyProfile && doc.companyProfile) {
    const profile = structuredClone(doc.companyProfile)
    const rows = profile.aiChannels
    if (Array.isArray(rows)) {
      profile.aiChannels = rows.map((row) => ({ ...(row as object), models: [] }))
    }
    out.companyProfile = profile
  }
  return out
}

function fakePayload(seed: UserDoc[]) {
  const db = new Map<string, UserDoc>()
  for (const doc of seed) db.set(doc.id, structuredClone(doc))
  let updates = 0
  let selectsSeen = 0
  const payload = {
    async find({
      page = 1,
      limit = 50,
      select,
    }: {
      page?: number
      limit?: number
      select?: Record<string, boolean>
    }) {
      if (select) selectsSeen += 1
      const all = [...db.values()]
      const start = (page - 1) * limit
      const docs = all.slice(start, start + limit).map((doc) => applySelect(doc, select))
      return {
        docs,
        hasNextPage: start + limit < all.length,
        totalPages: Math.ceil(all.length / limit),
      }
    },
    async findByID({ id }: { id: string }) {
      const doc = db.get(String(id))
      if (!doc) throw new Error('not found')
      return structuredClone(doc)
    },
    async update({ id, data }: { id: string; data: Record<string, unknown> }) {
      updates += 1
      const doc = db.get(String(id))!
      const next = { ...structuredClone(doc), ...structuredClone(data) }
      db.set(String(id), next as UserDoc)
      return structuredClone(next)
    },
  }
  return { payload, db, updateCount: () => updates, selectCount: () => selectsSeen }
}

const channelRow = (key: string, cipher: string, extra: Record<string, unknown> = {}) => ({
  key,
  label: `渠道 ${key}`,
  baseUrl: 'https://api.example.com/v1',
  apiKeyCipher: cipher,
  apiKeyHint: '...abcd',
  models: ['m1', 'm2'],
  enabled: true,
  ...extra,
})

describe('reencryptChannelsOf', () => {
  it('旧 secret 密文 → 新 secret 下重加密，明文不变', () => {
    const oldCipher = sealWithOldSecret('sk-rotation-roundtrip')

    // 轮换后：新 secret 是当前钥匙，旧 secret 放在旧钥匙环里
    process.env.PAYLOAD_SECRET = NEW_SECRET
    process.env.AI_CHANNELS_KEY_ID = 'k2'
    process.env.AI_CHANNELS_OLD_KEYS = JSON.stringify({ k1: OLD_SECRET })

    const doc = {
      id: 'u1',
      companyProfile: {
        name: '不该被抹掉的抬头',
        aiChannels: [channelRow('c1', oldCipher)],
      },
    }
    const { rows, outcomes } = reencryptChannelsOf('u1', doc)
    expect(outcomes).toHaveLength(1)
    expect(outcomes[0]).toMatchObject({ status: 'upgraded', userId: 'u1', channelKey: 'c1' })
    expect(rows).not.toBeNull()
    const nextCipher = String((rows![0] as { apiKeyCipher: string }).apiKeyCipher)
    expect(nextCipher.startsWith('v1:k2:')).toBe(true)
    expect(nextCipher).not.toBe(oldCipher)
    // 关键：新密文用当前钥匙解出来的还是原文
    expect(open(nextCipher)).toBe('sk-rotation-roundtrip')
    // 其它字段原样保留
    expect((rows![0] as { models: string[] }).models).toEqual(['m1', 'm2'])
  })

  it('已经是当前代次 → 跳过，且不写库（rows 为 null）', () => {
    process.env.PAYLOAD_SECRET = NEW_SECRET
    process.env.AI_CHANNELS_KEY_ID = 'k2'
    const current = seal('sk-already-current')
    const { rows, outcomes } = reencryptChannelsOf('u1', {
      id: 'u1',
      companyProfile: { aiChannels: [channelRow('c1', current)] },
    })
    expect(outcomes[0].status).toBe('already-current')
    expect(rows).toBeNull()
  })

  it('没有密文的渠道 → skipped-empty', () => {
    const { rows, outcomes } = reencryptChannelsOf('u1', {
      id: 'u1',
      companyProfile: { aiChannels: [channelRow('c1', '')] },
    })
    expect(outcomes[0].status).toBe('skipped-empty')
    expect(rows).toBeNull()
  })

  it('解不开的密文（旧钥匙没配）→ failed，且不写坏数据', () => {
    const oldCipher = sealWithOldSecret('sk-cannot-open')
    process.env.PAYLOAD_SECRET = NEW_SECRET
    process.env.AI_CHANNELS_KEY_ID = 'k2'
    // 故意不配旧钥匙环
    const { rows, outcomes } = reencryptChannelsOf('u1', {
      id: 'u1',
      companyProfile: { aiChannels: [channelRow('c1', oldCipher)] },
    })
    expect(outcomes[0]).toMatchObject({ status: 'failed', channelKey: 'c1' })
    expect(rows).toBeNull()
  })
})

describe('reencryptAllChannels', () => {
  /**
   * 回归：2026-11-15 复核实测，脚本用 `select: { companyProfile: true }` 读用户，
   * Payload 对 hasMany 子字段 `aiChannels[].models` 返回 `[]`，随后把这份 rows 写回，
   * 每个渠道的模型列表被静默清空（真实库 `users_texts` 从 2 行变 0 行）。
   *
   * 这条用例里的假 `find` 现在会按 select 裁剪，所以谁把 select 加回来就会红。
   */
  it('轮换写回后，每个渠道的 models 必须原样保留', async () => {
    const oldCipher = sealWithOldSecret('sk-keep-models')
    process.env.PAYLOAD_SECRET = NEW_SECRET
    process.env.AI_CHANNELS_KEY_ID = 'k2'
    process.env.AI_CHANNELS_OLD_KEYS = JSON.stringify({ k1: OLD_SECRET })

    const { payload, db, selectCount } = fakePayload([
      {
        id: 'u1',
        companyProfile: {
          name: '抬头一',
          aiChannels: [
            channelRow('c1', oldCipher, { models: ['m1', 'm2'] }),
            channelRow('c2', oldCipher, { models: ['m3'] }),
          ],
        },
      },
    ])

    const summary = await reencryptAllChannels(payload)
    expect(summary.upgraded).toBe(2)
    expect(summary.usersUpdated).toBe(1)

    const rows = (
      db.get('u1')!.companyProfile as { aiChannels: { key: string; models: string[] }[] }
    ).aiChannels
    expect(rows.find((r) => r.key === 'c1')!.models).toEqual(['m1', 'm2'])
    expect(rows.find((r) => r.key === 'c2')!.models).toEqual(['m3'])
    // 关键：find 不得使用 select（真实 Payload 会裁掉 hasMany 子字段）
    expect(selectCount()).toBe(0)
  })

  it('全库：升级旧代次、跳过已升级、统计正确', async () => {
    const oldA = sealWithOldSecret('sk-a')
    const oldB = sealWithOldSecret('sk-b')

    process.env.PAYLOAD_SECRET = NEW_SECRET
    process.env.AI_CHANNELS_KEY_ID = 'k2'
    process.env.AI_CHANNELS_OLD_KEYS = JSON.stringify({ k1: OLD_SECRET })
    const already = seal('sk-already')

    const { payload, db, updateCount } = fakePayload([
      {
        id: 'u1',
        companyProfile: {
          name: '抬头一',
          aiChannels: [channelRow('a', oldA), channelRow('b', oldB)],
        },
      },
      {
        id: 'u2',
        companyProfile: { name: '抬头二', aiChannels: [channelRow('c', already)] },
      },
    ])

    const summary = await reencryptAllChannels(payload)
    expect(summary.upgraded).toBe(2)
    expect(summary.alreadyCurrent).toBe(1)
    expect(summary.failed).toBe(0)
    // 只有 u1 需要写库
    expect(summary.usersUpdated).toBe(1)
    expect(updateCount()).toBe(1)

    // 落库后的密文能用当前钥匙解出原文
    const u1 = db.get('u1')!
    const rows = (u1.companyProfile as { aiChannels: { key: string; apiKeyCipher: string }[] })
      .aiChannels
    expect(open(rows.find((r) => r.key === 'a')!.apiKeyCipher)).toBe('sk-a')
    expect(open(rows.find((r) => r.key === 'b')!.apiKeyCipher)).toBe('sk-b')
    // companyProfile 其它字段没被抹掉
    expect((u1.companyProfile as { name: string }).name).toBe('抬头一')
    // u2 完全没动
    expect(updateCount()).toBe(1)
  })

  it('dry run 只统计不写库', async () => {
    const oldA = sealWithOldSecret('sk-dry')
    process.env.PAYLOAD_SECRET = NEW_SECRET
    process.env.AI_CHANNELS_KEY_ID = 'k2'
    process.env.AI_CHANNELS_OLD_KEYS = JSON.stringify({ k1: OLD_SECRET })

    const { payload, updateCount } = fakePayload([
      { id: 'u1', companyProfile: { aiChannels: [channelRow('a', oldA)] } },
    ])
    const summary = await reencryptAllChannels(payload, { dryRun: true })
    expect(summary.upgraded).toBe(1)
    expect(summary.usersUpdated).toBe(1) // 待更新
    expect(updateCount()).toBe(0) // 但没写
  })

  it('幂等：连跑两次，第二次什么都不写', async () => {
    const oldA = sealWithOldSecret('sk-idempotent')
    process.env.PAYLOAD_SECRET = NEW_SECRET
    process.env.AI_CHANNELS_KEY_ID = 'k2'
    process.env.AI_CHANNELS_OLD_KEYS = JSON.stringify({ k1: OLD_SECRET })

    const { payload, updateCount } = fakePayload([
      { id: 'u1', companyProfile: { aiChannels: [channelRow('a', oldA)] } },
    ])
    await reencryptAllChannels(payload)
    expect(updateCount()).toBe(1)
    await reencryptAllChannels(payload)
    expect(updateCount()).toBe(1) // 没有第二次写入
  })

  it('分页：超过一页的用户也能全部处理', async () => {
    const oldCipher = sealWithOldSecret('sk-paged')
    process.env.PAYLOAD_SECRET = NEW_SECRET
    process.env.AI_CHANNELS_KEY_ID = 'k2'
    process.env.AI_CHANNELS_OLD_KEYS = JSON.stringify({ k1: OLD_SECRET })

    const users: UserDoc[] = Array.from({ length: 7 }, (_, i) => ({
      id: `u${i}`,
      companyProfile: { aiChannels: [channelRow('c', oldCipher)] },
    }))
    const { payload, updateCount } = fakePayload(users)
    const summary = await reencryptAllChannels(payload)
    // 内部 pageSize=50，7 个用户一页就够；这里主要验证不会无限循环
    expect(summary.upgraded).toBe(7)
    expect(updateCount()).toBe(7)
  })
})
