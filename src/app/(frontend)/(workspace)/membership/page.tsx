import { redirect } from 'next/navigation'

import { appAuth } from '@/lib/app-auth'
import { pageTitle } from '@/lib/brand'
import { BENEFIT_ROWS, MEMBERSHIP_TIERS, meetsTier, resolveMembership, type MembershipTier } from '@/lib/membership'
import { getMembershipPolicy } from '@/lib/membership-policy'
import { getPayloadClient } from '@/lib/payload'
import { PLUGINS } from '@/plugins'
import { loadProposalTemplates } from '@/plugins/proposal/registry'

import { monthlyCreditReason } from './actions'
import { MembershipClient } from './membership-client'

export const metadata = { title: pageTitle('会员与积分') }

export default async function MembershipPage() {
  const user = await appAuth.getCurrentUser()
  if (!user) redirect('/login')

  const payload = await getPayloadClient()
  const reason = await monthlyCreditReason()
  const [freshUser, activeProjects, ledgerRes, claimed, policy, templates] = await Promise.all([
    payload.findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: true }).catch(() => user),
    payload.count({
      collection: 'projects',
      where: { and: [{ owner: { equals: user.id } }, { status: { equals: 'active' } }] },
      overrideAccess: true,
    }),
    payload.find({
      collection: 'ai-credit-ledger',
      where: { user: { equals: user.id } },
      sort: '-createdAt',
      limit: 30,
      depth: 0,
      overrideAccess: true,
    }),
    payload.count({ collection: 'ai-credit-ledger', where: { and: [{ user: { equals: user.id } }, { reason: { equals: reason } }] }, overrideAccess: true }),
    getMembershipPolicy(),
    loadProposalTemplates(user),
  ])

  const membership = resolveMembership(freshUser as never)
  const ledger = ledgerRes.docs.map((row) => ({
    id: String(row.id),
    delta: row.delta,
    balanceAfter: row.balanceAfter ?? 0,
    reason: row.reason ?? (row.delta > 0 ? '积分发放' : 'AI 对话扣减'),
    model: row.model ?? null,
    createdAt: row.createdAt,
  }))

  // 权益对比：方案模板、插件按清单实际统计，其余为固定行
  const tiers = MEMBERSHIP_TIERS.map((t) => t.value)
  const count = (need: { tier: MembershipTier }[], tier: MembershipTier) => need.filter((x) => meetsTier(tier, x.tier)).length
  const readyPlugins = PLUGINS.filter((p) => p.status === 'ready')
  const perTier = (fn: (t: MembershipTier) => string) => Object.fromEntries(tiers.map((t) => [t, fn(t)])) as Record<MembershipTier, string>
  const benefitRows = [
    BENEFIT_ROWS[0],
    BENEFIT_ROWS[1],
    BENEFIT_ROWS[2],
    {
      label: '方案模板',
      hint: templates.filter((t) => t.tier !== 'free').map((t) => t.label).join('、') || undefined,
      values: perTier((t) => `${count(templates, t)} 套`),
    },
    {
      label: '扩展插件',
      hint: readyPlugins.filter((p) => p.tier !== 'free').map((p) => p.name).join('、') || undefined,
      values: perTier((t) => `${count(readyPlugins, t)} 个`),
    },
    ...BENEFIT_ROWS.slice(3),
  ]

  return (
    <MembershipClient
      initial={{
        name: freshUser.name,
        email: freshUser.email,
        aiCredits: freshUser.aiCredits ?? 0,
        activeProjectCount: activeProjects.totalDocs,
        membership,
        claimedThisMonth: claimed.totalDocs > 0,
        strict: policy.strict,
        upgradeHint: policy.upgradeHint,
        tiers: MEMBERSHIP_TIERS.map((t) => ({ value: t.value, label: t.label, badge: t.badge, price: t.price, description: t.description })),
        benefitRows,
        ledger,
      }}
    />
  )
}
