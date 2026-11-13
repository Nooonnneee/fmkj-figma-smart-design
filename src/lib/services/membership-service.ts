import { sql } from '@payloadcms/db-postgres'

import { relId } from '@/lib/access'
import { getPayloadClient } from '@/lib/payload'
import { lockRow } from '@/lib/pg-row-lock'
import type { User } from '@/payload-types'

export type RedeemResult =
  | {
      ok: true
      message: string
      creditsAdded: number
      aiCredits: number
    }
  | { ok: false; error: string }

type RedemptionCodeDoc = {
  id: string | number
  code: string
  label?: string | null
  credits?: number | null
  maxUses?: number | null
  usedCount?: number | null
  status?: string | null
  expiresAt?: string | null
  redeemedBy?: Array<{ user?: unknown; redeemedAt?: string | null }> | null
}

/**
 * 核销兑换码：
 * - 在同一事务里锁定兑换码行，再校验状态、过期时间、剩余次数及当前用户是否已兑换过；
 * - 发放 AI 积分（写入 `ai-credit-ledger`，由集合钩子自动更新 `users.aiCredits`）；
 * - 记录兑换明细并在达到最大次数时自动标记为 `disabled`。
 *
 * 并发安全性：`usedCount` 是「读 → 写」、`redeemedBy` 是「查重 → 写」，过去没有任何锁，
 * 两笔并发兑换可以都读到 `usedCount = 0` 并通过查重，然后双双入账（多发积分 / 同一账号重复领）。
 * 现在整段「读兑换码 → 写兑换码 → 写积分流水」在同一个事务里，并先对兑换码行加
 * `SELECT ... FOR UPDATE` 行锁：第二笔会等第一笔提交后再重读，于是计数与查重都基于最新值。
 * 平台已取消会员分级，兑换码只发 AI 积分。
 */
export async function redeemCodeForUser(user: User, rawCode: unknown): Promise<RedeemResult> {
  const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : ''
  if (!code || code.length < 4 || code.length > 40) {
    return { ok: false, error: '请输入有效的兑换码' }
  }

  const payload = await getPayloadClient()
  // 先按 code 定位（不加锁）：无效/输错的码快速失败，不必为它开事务。
  const found = await payload.find({
    collection: 'redemption-codes',
    where: { code: { equals: code } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const prelim = found.docs[0] as { id: string | number } | undefined
  if (!prelim) return { ok: false, error: '兑换码不存在，请核对后重试' }

  // 读兑换码、写兑换码、写积分流水放进同一个事务，并在开始时锁住兑换码行。
  const transactionID = await payload.db.beginTransaction()
  const req = { transactionID: transactionID ?? undefined }
  const rollback = async () => {
    if (transactionID) await payload.db.rollbackTransaction(transactionID).catch(() => undefined)
  }
  const fail = async (error: string): Promise<RedeemResult> => {
    await rollback()
    return { ok: false, error }
  }

  try {
    // 行锁：并发的第二笔兑换会等第一笔提交，然后读到更新后的 usedCount / redeemedBy。
    await lockRow(
      payload,
      transactionID,
      sql`SELECT id FROM redemption_codes WHERE id = ${String(prelim.id)} FOR UPDATE`,
    )

    const doc = (await payload.findByID({
      collection: 'redemption-codes',
      id: prelim.id,
      depth: 0,
      overrideAccess: true,
      req,
    })) as RedemptionCodeDoc | null

    if (!doc) return fail('兑换码不存在，请核对后重试')
    if (doc.status !== 'active') return fail('该兑换码已失效或已被使用')
    if (doc.expiresAt && new Date(doc.expiresAt).getTime() < Date.now()) {
      return fail('该兑换码已过有效期')
    }

    const maxUses = Math.max(1, Number(doc.maxUses ?? 1))
    const usedCount = Math.max(0, Number(doc.usedCount ?? 0))
    if (usedCount >= maxUses) return fail('该兑换码已被领完')

    const redeemedList = Array.isArray(doc.redeemedBy) ? doc.redeemedBy : []
    const uid = String(user.id)
    if (redeemedList.some((r) => relId(r.user) === uid)) {
      return fail('你已经使用过这个兑换码了')
    }

    const creditsAdded = Math.max(0, Math.trunc(Number(doc.credits ?? 0)))
    if (creditsAdded === 0) return fail('该兑换码未配置有效权益')

    // 1. 更新兑换码使用次数与兑换人列表
    const nextUsedCount = usedCount + 1
    await payload.update({
      collection: 'redemption-codes',
      id: doc.id,
      data: {
        usedCount: nextUsedCount,
        status: nextUsedCount >= maxUses ? 'disabled' : 'active',
        redeemedBy: [
          ...redeemedList.map((r) => ({
            user: relId(r.user)!,
            redeemedAt: r.redeemedAt ?? new Date().toISOString(),
          })),
          { user: user.id, redeemedAt: new Date().toISOString() },
        ],
      } as never,
      overrideAccess: true,
      depth: 0,
      req,
    })

    // 2. 写入积分流水（钩子自动更新 users.aiCredits，与上面的兑换码更新同属一个事务）
    const reason = `兑换码充值：${doc.label?.trim() || doc.code}`
    const ledger = await payload.create({
      collection: 'ai-credit-ledger',
      data: {
        user: user.id,
        delta: creditsAdded,
        reason: reason.slice(0, 120),
      },
      overrideAccess: true,
      depth: 0,
      req,
    })

    if (transactionID) await payload.db.commitTransaction(transactionID)

    // 流水的 balanceAfter 由集合钩子在加锁后写回，正常情况下一定有值。
    return {
      ok: true,
      message: `到账 ${creditsAdded} AI 积分`,
      creditsAdded,
      aiCredits: ledger.balanceAfter ?? creditsAdded,
    }
  } catch (error) {
    await rollback()
    throw error
  }
}
