import { redirect } from 'next/navigation'

import { FilterTabs } from '@/components/filter-tabs'
import { PageHeader } from '@/components/page-header'
import { appAuth } from '@/lib/app-auth'
import { pageTitle } from '@/lib/brand'
import { PLUGINS } from '@/plugins'
import { getPluginFlags } from '@/plugins/state'

import { PluginList, type PluginViewItem } from './plugin-list'

export const metadata = { title: pageTitle('插件市场') }

type Tab = 'all' | 'ready' | 'coming-soon'

export default async function PluginsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; plugin?: string }>
}) {
  const user = await appAuth.getCurrentUser()
  if (!user) redirect('/login')
  const [sp, flags] = await Promise.all([searchParams, getPluginFlags(user.id)])
  const tab: Tab = sp.tab === 'ready' || sp.tab === 'coming-soon' ? sp.tab : 'all'

  const allItems: PluginViewItem[] = PLUGINS.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    where: p.where,
    provides: p.provides,
    enabled: flags[p.id],
  }))
  const readyCount = allItems.filter((p) => p.status === 'ready').length
  const comingSoonCount = allItems.filter((p) => p.status === 'coming-soon').length
  const shown = tab === 'all' ? allItems : allItems.filter((p) => p.status === tab)

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        title="插件市场"
        description="按需启用外围扩展能力，关闭后不影响已有项目数据"
        actions={
          <FilterTabs
            label="插件状态筛选"
            items={[
              { key: 'all', label: '全部', href: '/plugins', active: tab === 'all', count: allItems.length },
              { key: 'ready', label: '已开发', href: '/plugins?tab=ready', active: tab === 'ready', count: readyCount },
              { key: 'coming-soon', label: '待开发', href: '/plugins?tab=coming-soon', active: tab === 'coming-soon', count: comingSoonCount },
            ]}
          />
        }
      />
      <PluginList items={shown} selectedId={sp.plugin ?? null} />
    </section>
  )
}
