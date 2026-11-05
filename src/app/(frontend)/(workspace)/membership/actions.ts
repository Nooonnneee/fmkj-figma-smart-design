'use server'

import { appAuth } from '@/lib/app-auth'
import { CREDIT_TASKS, grantTaskCreditIfEligible, loadAndSyncUserCreditTasks, type CreditTaskId } from '@/lib/credit-tasks'
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

/**
 * 领取成长/绑定任务奖励积分（绑定邮箱 +10、绑定微信 +10、关注公众号 +5、完善抬头 +5、首份报价 +5）。
 */
export async function claimTaskCredit(taskId: CreditTaskId): Promise<{ ok: true; credits: number; message: string } | { ok: false; error: string }> {
  const user = await appAuth.getCurrentUser()
  if (!user) return { ok: false, error: '登录已过期，请重新登录' }
  const spec = CREDIT_TASKS.find((t) => t.id === taskId)
  if (!spec) return { ok: false, error: '未知的积分任务' }

  const { tasks } = await loadAndSyncUserCreditTasks(user)
  const item = tasks.find((t) => t.id === taskId)
  if (!item) return { ok: false, error: '任务状态读取失败' }
  if (item.claimed) return { ok: false, error: '该项任务奖励已领取过' }
  if (!item.eligible) {
    if (taskId === 'bind_email') return { ok: false, error: '请先使用真实邮箱注册或在个人设置中绑定真实邮箱' }
    if (taskId === 'bind_wechat') return { ok: false, error: '请先在微信小程序登录并绑定当前账号' }
    if (taskId === 'complete_company_profile') return { ok: false, error: '请先在「设置」中填写公司抬头名称与联系电话' }
    if (taskId === 'first_quote') return { ok: false, error: '请先在任意项目中生成第一份报价单' }
    return { ok: false, error: '尚未达成该任务条件' }
  }

  const res = await grantTaskCreditIfEligible(String(user.id), taskId)
  if (!res.granted) return { ok: false, error: res.reason }
  return { ok: true, credits: res.credits, message: `已领取「${spec.title}」奖励 +${res.credits} 积分` }
}
