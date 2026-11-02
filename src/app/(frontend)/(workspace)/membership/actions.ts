'use server'

import { appAuth } from '@/lib/app-auth'
import { resolveMembership } from '@/lib/membership'
import { getPayloadClient } from '@/lib/payload'

/** 本月的积分领取说明（积分流水里的 reason，用来判断本月是否已领） */
export const monthlyCreditReason = async (date = new Date()) => `会员月度积分 ${date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 7)}`

/**
 * 领取本月会员积分：专业版 / 旗舰版每个自然月（北京时间）可领一次，写入积分流水（余额由流水钩子更新）。
 * 积分数量只按当前会员等级计算，不接受前端传入。
 */
export async function claimMonthlyCredits(): Promise<{ ok: true; credits: number } | { ok: false; error: string }> {
  const user = await appAuth.getCurrentUser()
  if (!user) return { ok: false, error: '登录已过期，请重新登录' }
  const payload = await getPayloadClient()
  const fresh = await payload.findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: true, select: { membershipTier: true, membershipExpiresAt: true } }).catch(() => null)
  const m = resolveMembership(fresh as never)
  if (!m.monthlyCredits) return { ok: false, error: `「${m.label}」没有每月赠送积分，升级后可每月领取` }
  const reason = await monthlyCreditReason()
  const claimed = await payload.count({ collection: 'ai-credit-ledger', where: { and: [{ user: { equals: user.id } }, { reason: { equals: reason } }] }, overrideAccess: true })
  if (claimed.totalDocs) return { ok: false, error: '本月的会员积分已经领取过了' }
  try {
    await payload.create({ collection: 'ai-credit-ledger', data: { user: user.id, delta: m.monthlyCredits, reason }, overrideAccess: true, depth: 0 })
    return { ok: true, credits: m.monthlyCredits }
  } catch (error) {
    console.error('[membership] monthly credits failed', error)
    return { ok: false, error: '领取失败，请稍后重试' }
  }
}
