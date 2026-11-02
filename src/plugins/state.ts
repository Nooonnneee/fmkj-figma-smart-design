import { cache } from 'react'

import { appAuth } from '@/lib/app-auth'
import { getCompanyInfo } from '@/lib/cached-data'
import { featureAccess, resolveMembership, type MembershipTier } from '@/lib/membership'
import { getMembershipPolicy } from '@/lib/membership-policy'
import { getPayloadClient } from '@/lib/payload'

import { PLUGINS, type PluginId } from '.'

export type PluginFlags = Record<PluginId, boolean>

/** 账号的会员等级（严格模式下判断插件能否使用）；同一次请求只查一次 */
const tierOf = cache(async (userId: string) => {
  const payload = await getPayloadClient()
  const u = await payload.findByID({ collection: 'users', id: userId, depth: 0, overrideAccess: true, select: { membershipTier: true, membershipExpiresAt: true } }).catch(() => null)
  return resolveMembership(u as never).effectiveTier
})

/**
 * 各插件当前是否启用（服务端读取；设置里关闭的插件为 false，新安装的插件默认开启）。
 * 会员设置为严格模式时，账号等级不够的插件也视为关闭。
 */
export async function getPluginFlags(userId?: string | number | null): Promise<PluginFlags> {
  let resolvedUserId = userId
  if (resolvedUserId === undefined) {
    const currentUser = await appAuth.getCurrentUser().catch(() => null)
    resolvedUserId = currentUser?.id ?? null
  }
  const [{ disabledPlugins }, tier, policy] = await Promise.all([getCompanyInfo(resolvedUserId), userTier(resolvedUserId), getMembershipPolicy()])
  const disabled = new Set(disabledPlugins)
  return Object.fromEntries(
    PLUGINS.map((p) => [p.id, p.status === 'ready' && !disabled.has(p.id) && featureAccess({ effectiveTier: tier }, p.tier, policy.strict).allowed]),
  ) as PluginFlags
}

/** 账号当前生效的会员等级（同一次请求只查一次） */
export const userTier = (userId: string | number | null | undefined): Promise<MembershipTier> =>
  userId === null || userId === undefined ? Promise.resolve('free') : tierOf(String(userId))
