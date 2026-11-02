import { cache } from 'react'

import { getPayloadClient } from '@/lib/payload'
import type { User } from '@/payload-types'

import { resolveMembership } from './membership'

export type MembershipPolicy = { strict: boolean; upgradeHint: string }

const DEFAULT_HINT = '联系服务顾问获取兑换码，在「会员与积分」页输入兑换码即可开通或续期。'

/**
 * 后台「会员设置」：是否严格限制、升级方式说明（同一次请求只读一次）。
 * 这是平台自己的规则配置（不含任何用户数据），服务端判断权益时直接读取。
 */
export const getMembershipPolicy = cache(async (): Promise<MembershipPolicy> => {
  const payload = await getPayloadClient()
  const doc = await payload.findGlobal({ slug: 'membership-settings', depth: 0, overrideAccess: true }).catch(() => null)
  return { strict: doc?.enforcement === 'strict', upgradeHint: doc?.upgradeHint?.trim() || DEFAULT_HINT }
})

/** 当前用户的会员状态 + 会员设置（方案模板、插件、资料包等处判断权益用） */
export const getMembershipContext = cache(async (user: User) => {
  const policy = await getMembershipPolicy()
  return { membership: resolveMembership(user as never), ...policy }
})

/**
 * 项目还能加多少协作成员：严格模式下按项目负责人的会员等级限制；提示模式或旗舰版不限（返回 null）。
 */
export async function collaboratorLimitFor(ownerId: string | null): Promise<number | null> {
  const policy = await getMembershipPolicy()
  if (!policy.strict || !ownerId) return null
  const payload = await getPayloadClient()
  const owner = await payload.findByID({ collection: 'users', id: ownerId, depth: 0, overrideAccess: true, select: { membershipTier: true, membershipExpiresAt: true } }).catch(() => null)
  return resolveMembership(owner as never).collaboratorLimit
}
