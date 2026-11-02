import { FilterTabs } from '@/components/filter-tabs'
import { PageHeader } from '@/components/page-header'
import { appAuth } from '@/lib/app-auth'
import { pageTitle } from '@/lib/brand'
import { featureAccess, tierBadge } from '@/lib/membership'
import { getMembershipContext } from '@/lib/membership-policy'
import { PLUGIN_STAGES, PLUGINS, type PluginStage } from '@/plugins'
import { getPluginFlags } from '@/plugins/state'

import { PluginList, type PluginViewItem } from './plugin-list'
import { redirectToLogin } from '@/lib/login-redirect'

export const metadata = { title: pageTitle('插件市场') }

const isStage = (v: unknown): v is PluginStage => PLUGIN_STAGES.some((s) => s.key === v)

export default async function PluginsPage({ searchParams }: { searchParams: Promise<{ stage?: string; plugin?: string }> }) {
  const user = await appAuth.getCurrentUser()
  if (!user) return redirectToLogin()
  const [sp, flags, access] = await Promise.all([searchParams, getPluginFlags(user.id), getMembershipContext(user)])
  const stage = isStage(sp.stage) ? sp.stage : null

  const items: PluginViewItem[] = PLUGINS.filter((p) => p.status === 'ready').map((p) => {
    const tier = featureAccess(access.membership, p.tier, access.strict)
    return {
      id: p.id,
      name: p.name,
      tagline: p.tagline,
      description: p.description,
      status: p.status,
      stage: p.stage,
      entry: p.entry?.label ?? null,
      provides: p.provides,
      enabled: flags[p.id],
      tierBadge: p.tier === 'free' ? null : tierBadge(p.tier),
      locked: !tier.allowed,
    }
  })

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <PageHeader
        title="插件市场"
        actions={
          <FilterTabs
            label="插件阶段"
            items={[
              { key: 'all', label: '全部', href: '/plugins', active: !stage },
              ...PLUGIN_STAGES.map((s) => ({
                key: s.key,
                label: s.label,
                href: `/plugins?stage=${s.key}`,
                active: stage === s.key,
              })),
            ]}
          />
        }
      />
      <PluginList
        items={stage ? items.filter((p) => p.stage === stage) : items}
        stages={[]}
        selectedId={sp.plugin ?? null}
        upgradeHint={access.upgradeHint}
      />
    </section>
  )
}
