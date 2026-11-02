import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { PageHeader } from '@/components/page-header'
import { appAuth } from '@/lib/app-auth'
import { pageTitle } from '@/lib/brand'
import { featureAccess, tierBadge } from '@/lib/membership'
import { getMembershipContext } from '@/lib/membership-policy'
import { cn } from '@/lib/utils'
import { PLUGIN_STAGES, PLUGINS, type PluginStage } from '@/plugins'
import { getPluginFlags } from '@/plugins/state'

import { PluginList, type PluginViewItem } from './plugin-list'
import { redirectToLogin } from '@/lib/login-redirect'

export const metadata = { title: pageTitle('插件市场') }

const isStage = (v: unknown): v is PluginStage => PLUGIN_STAGES.some((s) => s.key === v)

/** 插件市场：插件按项目流程分组——在哪个阶段用、入口在哪、需要什么会员，一眼看清。 */
export default async function PluginsPage({ searchParams }: { searchParams: Promise<{ stage?: string; plugin?: string }> }) {
  const user = await appAuth.getCurrentUser()
  if (!user) return redirectToLogin()
  const [sp, flags, access] = await Promise.all([searchParams, getPluginFlags(user.id), getMembershipContext(user)])
  const stage = isStage(sp.stage) ? sp.stage : null

  const items: PluginViewItem[] = PLUGINS.map((p) => {
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
  const stats = PLUGIN_STAGES.map((s, i) => {
    const list = items.filter((p) => p.stage === s.key)
    return { ...s, step: s.key === 'global' ? null : i + 1, total: list.length, on: list.filter((p) => p.status === 'ready' && p.enabled).length }
  })

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader title="插件市场" description="插件按项目流程接入：启用后出现在对应阶段的页面里，关闭不影响已有项目数据" />

      <nav aria-label="按项目阶段筛选插件" className="-mx-1 overflow-x-auto px-1 pb-1">
        <ol className="flex min-w-max items-stretch gap-1.5">
          <li>
            <Link
              href="/plugins"
              aria-current={stage === null ? 'page' : undefined}
              className={cn(
                'flex h-full flex-col justify-center rounded-lg border px-3 py-2 text-sm transition-colors',
                stage === null ? 'border-primary/30 bg-primary/10 text-foreground' : 'bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              <span className="font-medium">全部</span>
              <span className="text-xs tabular-nums">{items.length} 个插件</span>
            </Link>
          </li>
          {stats.map((s, i) => (
            <li key={s.key} className="flex items-center gap-1.5">
              {i > 1 ? <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground/50" /> : null}
              <Link
                href={`/plugins?stage=${s.key}`}
                aria-current={stage === s.key ? 'page' : undefined}
                className={cn(
                  'flex h-full flex-col justify-center rounded-lg border px-3 py-2 text-sm transition-colors',
                  stage === s.key ? 'border-primary/30 bg-primary/10 text-foreground' : 'bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="font-medium">
                  {s.step ? <span className="mr-1 text-xs text-muted-foreground tabular-nums">{s.step}</span> : null}
                  {s.label}
                </span>
                <span className="text-xs tabular-nums">
                  {s.on}/{s.total} 已启用
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      <PluginList items={stage ? items.filter((p) => p.stage === stage) : items} stages={stats.filter((s) => !stage || s.key === stage).map((s) => ({ key: s.key, label: s.label, hint: s.hint, step: s.step }))} selectedId={sp.plugin ?? null} upgradeHint={access.upgradeHint} />
    </section>
  )
}
