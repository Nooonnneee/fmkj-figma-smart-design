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

export default async function PluginsPage({ searchParams }: { searchParams: Promise<{ stage?: string; tier?: string; plugin?: string }> }) {
  const user = await appAuth.getCurrentUser()
  if (!user) return redirectToLogin()
  const [sp, flags, access] = await Promise.all([searchParams, getPluginFlags(user.id), getMembershipContext(user)])
  const stage = isStage(sp.stage) ? sp.stage : null
  const tierFilter = sp.tier === 'free' || sp.tier === 'pro' || sp.tier === 'team' ? sp.tier : null

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
      tier: p.tier,
      tierBadge: tierBadge(p.tier),
      locked: !tier.allowed,
    }
  })
  const filtered = items.filter((p) => (!stage || p.stage === stage) && (!tierFilter || p.tier === tierFilter))

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <PageHeader
        title="插件市场"
        description="每个插件均标明所属会员档位（Go 基础 / Plus 进阶 / Pro 旗舰），按需开启扩展能力。"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <FilterTabs
              label="会员档位"
              items={[
                { key: 'all-tier', label: '全部档位', href: stage ? `/plugins?stage=${stage}` : '/plugins', active: !tierFilter },
                { key: 'free', label: 'Go 基础', href: stage ? `/plugins?stage=${stage}&tier=free` : '/plugins?tier=free', active: tierFilter === 'free' },
                { key: 'pro', label: 'Plus 进阶', href: stage ? `/plugins?stage=${stage}&tier=pro` : '/plugins?tier=pro', active: tierFilter === 'pro' },
                { key: 'team', label: 'Pro 旗舰', href: stage ? `/plugins?stage=${stage}&tier=team` : '/plugins?tier=team', active: tierFilter === 'team' },
              ]}
            />
            <FilterTabs
              label="插件阶段"
              items={[
                { key: 'all', label: '全部阶段', href: tierFilter ? `/plugins?tier=${tierFilter}` : '/plugins', active: !stage },
                ...PLUGIN_STAGES.map((s) => ({
                  key: s.key,
                  label: s.label,
                  href: tierFilter ? `/plugins?stage=${s.key}&tier=${tierFilter}` : `/plugins?stage=${s.key}`,
                  active: stage === s.key,
                })),
              ]}
            />
          </div>
        }
      />
      <PluginList
        items={filtered}
        stages={[]}
        selectedId={sp.plugin ?? null}
        upgradeHint={access.upgradeHint}
      />
    </section>
  )
}
