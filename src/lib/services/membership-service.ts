import { relId } from '@/lib/access'
import { higherTier, isMembershipTier, resolveMembership, tierMeta, type MembershipTier } from '@/lib/membership'
import { getPayloadClient } from '@/lib/payload'
import type { User } from '@/payload-types'

export type RedeemResult =
  | {
      ok: true
      message: string
      creditsAdded: number
      aiCredits: number
      membershipTier: MembershipTier
      membershipLabel: string
      membershipExpiresAt: string | null
    }
  | { ok: false; error: string }

/**
 * 核销兑换码：
 * - 校验兑换码状态、过期时间、剩余次数及当前用户是否已兑换过；
 * - 发放 AI 积分（写入 `ai-credit-ledger`，由集合钩子自动更新 `users.aiCredits`）；
 * - 升级并顺延会员到期时间（若原会员未过期则在原到期时间上叠加天数）；
 * - 记录兑换明细并在达到最大次数时自动标记为 `disabled`。
 */
export async function redeemCodeForUser(user: User, rawCode: unknown): Promise<RedeemResult> {
  const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : ''
  if (!code || code.length < 4 || code.length > 40) {
    return { ok: false, error: '请输入有效的兑换码' }
  }

  const payload = await getPayloadClient()
  const found = await payload.find({
    collection: 'redemption-codes',
    where: { code: { equals: code } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = found.docs[0] as
    | {
        id: string | number
        code: string
        label?: string | null
        grantTier?: string | null
        durationDays?: number | null
        credits?: number | null
        maxUses?: number | null
        usedCount?: number | null
        status?: string | null
        expiresAt?: string | null
        redeemedBy?: Array<{ user?: unknown; redeemedAt?: string | null }> | null
      }
    | undefined

  if (!doc) return { ok: false, error: '兑换码不存在，请核对后重试' }
  if (doc.status !== 'active') return { ok: false, error: '该兑换码已失效或已被使用' }
  if (doc.expiresAt && new Date(doc.expiresAt).getTime() < Date.now()) {
    return { ok: false, error: '该兑换码已过有效期' }
  }

  const maxUses = Math.max(1, Number(doc.maxUses ?? 1))
  const usedCount = Math.max(0, Number(doc.usedCount ?? 0))
  if (usedCount >= maxUses) {
    return { ok: false, error: '该兑换码已被领完' }
  }

  const redeemedList = Array.isArray(doc.redeemedBy) ? doc.redeemedBy : []
  const uid = String(user.id)
  if (redeemedList.some((r) => relId(r.user) === uid)) {
    return { ok: false, error: '你已经使用过这个兑换码了' }
  }

  const freshUser = (await payload.findByID({
    collection: 'users',
    id: user.id,
    depth: 0,
    overrideAccess: true,
  })) as User

  const creditsAdded = Math.max(0, Math.trunc(Number(doc.credits ?? 0)))
  const grantTier = isMembershipTier(doc.grantTier) ? doc.grantTier : null
  const durationDays = Math.max(0, Math.trunc(Number(doc.durationDays ?? 0)))

  if (creditsAdded === 0 && (!grantTier || durationDays === 0)) {
    return { ok: false, error: '该兑换码未配置有效权益' }
  }

  // 1. 先更新兑换码使用次数与兑换人列表
  const nextUsedCount = usedCount + 1
  await payload.update({
    collection: 'redemption-codes',
    id: doc.id,
    data: {
      usedCount: nextUsedCount,
      status: nextUsedCount >= maxUses ? 'disabled' : 'active',
      redeemedBy: [
        ...redeemedList.map((r) => ({ user: relId(r.user)!, redeemedAt: r.redeemedAt ?? new Date().toISOString() })),
        { user: user.id, redeemedAt: new Date().toISOString() },
      ],
    } as never,
    overrideAccess: true,
    depth: 0,
  })

  // 2. 若包含会员等级与时长，更新用户的会员等级与到期时间
  const current = resolveMembership(freshUser as never)
  let nextTier: MembershipTier = current.effectiveTier
  let nextExpiresAt: string | null = current.expired ? null : current.expiresAt

  if (grantTier && grantTier !== 'free' && durationDays > 0) {
    nextTier = higherTier(current.effectiveTier, grantTier)
    const baseTime =
      current.effectiveTier !== 'free' && current.expiresAt && new Date(current.expiresAt).getTime() > Date.now()
        ? new Date(current.expiresAt).getTime()
        : Date.now()
    nextExpiresAt = new Date(baseTime + durationDays * 24 * 60 * 60 * 1000).toISOString()

    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        membershipTier: nextTier,
        membershipExpiresAt: nextExpiresAt,
      } as never,
      overrideAccess: true,
      depth: 0,
    })
  }

  // 3. 若包含积分，写入积分流水（钩子自动更新 users.aiCredits）
  let finalCredits = freshUser.aiCredits ?? 0
  if (creditsAdded > 0) {
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
    })
    finalCredits = ledger.balanceAfter ?? finalCredits + creditsAdded
  }

  const parts: string[] = []
  if (grantTier && grantTier !== 'free' && durationDays > 0) {
    parts.push(`已开通「${tierMeta(nextTier).label}」${durationDays} 天`)
  }
  if (creditsAdded > 0) {
    parts.push(`到账 ${creditsAdded} AI 积分`)
  }

  return {
    ok: true,
    message: parts.join('，') || '兑换成功',
    creditsAdded,
    aiCredits: finalCredits,
    membershipTier: nextTier,
    membershipLabel: tierMeta(nextTier).label,
    membershipExpiresAt: nextExpiresAt,
  }
}
