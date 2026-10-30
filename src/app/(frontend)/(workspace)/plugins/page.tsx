import { redirect } from 'next/navigation'

import { FilterTabs } from '@/components/filter-tabs'
import { appAuth } from '@/lib/app-auth'
import { pageTitle } from '@/lib/brand'
import { PLUGINS } from '@/plugins'
import { getPluginFlags } from '@/plugins/state'

import { PluginList, type PluginViewItem } from './plugin-list'

export const metadata = { title: pageTitle('插件') }

type Tab = 'all' | 'ready' | 'coming-soon'

export default async function PluginsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; plugin?: string }>
}) {
  const user = await appAuth.getCurrentUser()
  if (!user) redirect('/login')
  const [sp, flags] = await Promise.all([searchParams, getPluginFlags()])
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
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">插件</h1>
          <p className="text-sm text-muted-foreground">
            核心主链路（项目信息 → 点位 → 报价 → 合同 → 归档）独立运行；外围功能按插件启用，尚未开发的功能标为「待开发」
          </p>
        </div>
        <FilterTabs
          label="插件状态筛选"
          items={[
            { key: 'all', label: '全部', href: '/plugins', active: tab === 'all', count: allItems.length },
            { key: 'ready', label: '已开发', href: '/plugins?tab=ready', active: tab === 'ready', count: readyCount },
            { key: 'coming-soon', label: '待开发', href: '/plugins?tab=coming-soon', active: tab === 'coming-soon', count: comingSoonCount },
          ]}
        />
      </header>
      <PluginList items={shown} selectedId={sp.plugin ?? null} />
    </section>
  )
}
