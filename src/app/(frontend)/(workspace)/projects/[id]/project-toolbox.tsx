import Link from 'next/link'
import { Blocks, Lock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { featureAccess, tierBadge, type MembershipState } from '@/lib/membership'
import { cn } from '@/lib/utils'
import { PLUGIN_STAGES, PLUGINS } from '@/plugins'
import type { PluginFlags } from '@/plugins/state'

import { PLUGIN_ICONS } from '../../plugins/plugin-icons'

/**
 * 项目工具箱：按项目流程列出本项目能用的插件。
 * 已启用的直接在本项目里打开；未启用的去插件市场启用；会员等级不够（严格模式）的显示所需等级。
 */
export function ProjectToolbox({ projectId, flags, membership, strict }: { projectId: string; flags: PluginFlags; membership: Pick<MembershipState, 'effectiveTier'>; strict: boolean }) {
  const ready = PLUGINS.filter((p) => p.status === 'ready')
  const groups = PLUGIN_STAGES.map((s, i) => ({ ...s, step: s.key === 'global' ? null : i + 1, plugins: ready.filter((p) => p.stage === s.key) })).filter((g) => g.plugins.length)
  return (
    <section aria-labelledby="toolbox-title" className="rounded-xl bg-card shadow-xs ring-1 ring-border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
        <h2 id="toolbox-title" className="text-base font-semibold">项目工具箱</h2>
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link href="/plugins">
            <Blocks className="size-4" />
            插件市场
          </Link>
        </Button>
      </div>
      <ul className="divide-y">
        {groups.map((g) => (
          <li key={g.key} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
            <span className="flex shrink-0 items-center gap-1.5 text-sm whitespace-nowrap text-muted-foreground sm:w-32">
              {g.step ? <span className="flex size-4.5 items-center justify-center rounded-full bg-muted text-xs tabular-nums">{g.step}</span> : null}
              {g.label}
            </span>
            <div className="flex flex-wrap gap-2">
              {g.plugins.map((p) => {
                const Icon = PLUGIN_ICONS[p.id] ?? Blocks
                const access = featureAccess(membership, p.tier, strict)
                const on = flags[p.id]
                if (on && p.entry) {
                  return (
                    <Button key={p.id} asChild variant="outline" size="sm" title={p.entry.label}>
                      <Link href={p.entry.href(projectId)}>
                        <Icon className="size-4" />
                        {p.name.replace(/（.*?）/, '')}
                      </Link>
                    </Button>
                  )
                }
                return (
                  <Link
                    key={p.id}
                    href={`/plugins/${p.id}`}
                    className={cn('inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed px-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground')}
                    title={access.allowed ? '未启用，去插件市场启用' : `需要${tierBadge(p.tier)}`}
                  >
                    {access.allowed ? <Icon className="size-4" /> : <Lock className="size-3.5" />}
                    {p.name.replace(/（.*?）/, '')}
                    <span className="text-xs">{access.allowed ? '未启用' : tierBadge(p.tier)}</span>
                  </Link>
                )
              })}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
