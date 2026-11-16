import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, Blocks, Contact, Palette } from 'lucide-react'

import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { Button } from '@astryxdesign/core/Button'
import { appAuth } from '@/lib/app-auth'
import { pageTitle } from '@/lib/brand'
import { PLUGIN_TOOLS } from '@/lib/plugin-tools'
import { getPluginFlags } from '@/plugins/state'
import { redirectToLogin } from '@/lib/login-redirect'
import { filterFeaturedTools, TOOL_CARD_META } from './page-data'

export const metadata = { title: pageTitle('工具') }

const ICONS = {
  'floor-plan-style': Palette,
  'business-card': Contact,
} as const

export default async function PluginToolsPage() {
  const user = await appAuth.getCurrentUser()
  if (!user) return redirectToLogin()
  const flags = await getPluginFlags(user.id)
  const available = PLUGIN_TOOLS.filter((tool) => flags[tool.pluginId])
  const tools = filterFeaturedTools(available)

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit text-muted-foreground"
        href="/capabilities"
        icon={<ArrowLeft />}
        label="返回能力中心"
      />
      <PageHeader title="工具" description="点开即用的工具，无需项目上下文，直接打开就能用。" />
      <div className="grid gap-4 sm:grid-cols-2">
        {tools.map((tool) => {
          const Icon = ICONS[tool.id as keyof typeof ICONS] ?? Blocks
          const meta = TOOL_CARD_META[tool.id as keyof typeof TOOL_CARD_META]
          return (
            <Link
              key={tool.id}
              href={tool.href}
              className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`flex size-11 items-center justify-center rounded-xl bg-linear-to-br ${meta.gradient} ${meta.iconOnGradient} shadow-sm`}
                >
                  <Icon className="size-5" />
                </span>
                <ArrowUpRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
              </div>
              <div className={`mt-4 text-lg font-semibold ${meta.tintText}`}>{tool.name}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {tool.description}
              </p>
            </Link>
          )
        })}
      </div>
      {tools.length === 0 ? (
        <EmptyState
          icon={<Blocks className="size-5" />}
          title="还没有可用的工具"
          description="启用能力中心的插件后，工具会自动出现在这里。"
        />
      ) : null}
    </section>
  )
}
