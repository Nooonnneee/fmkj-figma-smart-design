import { redirect } from 'next/navigation'

import { appAuth } from '@/lib/app-auth'
import { pageTitle } from '@/lib/brand'
import { MEMBERSHIP_TIERS, resolveMembership } from '@/lib/membership'
import { getPayloadClient } from '@/lib/payload'

import { MembershipClient } from './membership-client'

export const metadata = { title: pageTitle('会员与积分') }

export default async function MembershipPage() {
  const user = await appAuth.getCurrentUser()
  if (!user) redirect('/login')

  const payload = await getPayloadClient()
  const [freshUser, activeProjects, ledgerRes] = await Promise.all([
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

  return (
    <MembershipClient
      initial={{
        name: freshUser.name,
        email: freshUser.email,
        aiCredits: freshUser.aiCredits ?? 0,
        activeProjectCount: activeProjects.totalDocs,
        membership,
        tiers: MEMBERSHIP_TIERS.map((t) => ({
          value: t.value,
          label: t.label,
          badge: t.badge,
          activeProjectLimit: t.activeProjectLimit,
          description: t.description,
          features: [...t.features],
        })),
        ledger,
      }}
    />
  )
}
