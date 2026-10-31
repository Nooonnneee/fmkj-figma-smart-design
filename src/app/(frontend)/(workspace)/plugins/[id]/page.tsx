import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Bot, Clock, ExternalLink, FolderKanban, Settings } from 'lucide-react'

import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { appAuth } from '@/lib/app-auth'
import { pageTitle } from '@/lib/brand'
import { getCompanyInfo } from '@/lib/cached-data'
import { getPayloadClient } from '@/lib/payload'
import { isPluginId, PLUGINS } from '@/plugins'
import { DEFAULT_AI_TEMPLATES, enabledAiModels } from '@/plugins/ai-copilot/templates'
import { PLUGIN_DOC_STYLES } from '@/plugins/doc-styles/styles'
import { PROPOSAL_TEMPLATES } from '@/plugins/proposal/templates'
import { getPluginFlags } from '@/plugins/state'

import { PluginDetailToggle } from './plugin-detail-toggle'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const plugin = PLUGINS.find((p) => p.id === id)
  return { title: pageTitle(plugin ? `${plugin.name} · 插件市场` : '插件详情') }
}

export default async function PluginDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await appAuth.getCurrentUser()
  if (!user) redirect('/login')
  if (!isPluginId(id)) notFound()

  const plugin = PLUGINS.find((p) => p.id === id)
  if (!plugin) notFound()

  const payload = await getPayloadClient()
  const [flags, company, projectsRes] = await Promise.all([
    getPluginFlags(user.id),
    getCompanyInfo(user.id),
    payload.find({
      collection: 'projects',
      where: { status: { not_equals: 'archived' } },
      sort: '-updatedAt',
      limit: 8,
      depth: 0,
      user,
      overrideAccess: false,
      select: { name: true, customerName: true, platform: true, pointCount: true },
    }),
  ])

  const enabled = flags[plugin.id]
  const pending = plugin.status === 'coming-soon'
  const activeAiModels = enabledAiModels(company.aiModels)
  const projects = projectsRes.docs.map((p) => ({
    id: String(p.id),
    name: p.name,
    customerName: p.customerName ?? null,
    platform: p.platform ?? null,
    points: p.pointCount ?? 0,
  }))

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link href="/plugins">
            <ArrowLeft className="size-4" />
            返回插件市场
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/ai?plugin=${plugin.id}`}>
            <Bot className="size-4" />
            在 AI 对话中连接
          </Link>
        </Button>
      </div>

      <PageHeader
        title={plugin.name}
        description={plugin.description}
        actions={<PluginDetailToggle id={plugin.id} name={plugin.name} status={plugin.status} initialEnabled={enabled} />}
      />

      <Card>
        <CardHeader>
          <CardTitle>插件能力与接入位置</CardTitle>
          <CardDescription>
            {pending ? `规划接入位置：${plugin.where}` : `当前生效位置：${plugin.where}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {plugin.provides.map((item) => (
              <Badge key={item} variant="secondary">
                {item}
              </Badge>
            ))}
          </div>

          {plugin.id === 'ai-copilot' ? (
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">内置对话技能模板（{DEFAULT_AI_TEMPLATES.length} 套）</span>
                  <Button asChild variant="outline" size="xs">
                    <Link href="/ai">
                      <Bot className="size-3.5" />
                      打开 AI 对话工作台
                    </Link>
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {DEFAULT_AI_TEMPLATES.map((tpl) => {
                    const m = activeAiModels.find((x) => x.id === tpl.recommendedModelId) ?? activeAiModels[0]
                    return (
                      <div key={tpl.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{tpl.name}</span>
                          <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                            {tpl.category}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{tpl.description}</p>
                        <div className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">
                          推荐模型：{m?.name}（{m?.cost} 积分/次）· 自动连接 {tpl.requiredPlugins.length} 个插件
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-2 border-t pt-3">
                <div className="text-xs font-medium text-muted-foreground">支持切换的模型与积分定价</div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {activeAiModels.map((m) => (
                    <div key={m.id} className="rounded-lg border p-2.5 text-xs">
                      <div className="flex items-center justify-between font-medium">
                        <span>{m.name}</span>
                        <span className="text-muted-foreground tabular-nums">{m.cost} 积分</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">{m.tag}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {plugin.id === 'doc-styles' ? (
            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">包含的 4 套扩展打印风格</span>
                <Button asChild variant="outline" size="xs">
                  <Link href="/settings">
                    <Settings className="size-3.5" />
                    设置默认模板
                  </Link>
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {PLUGIN_DOC_STYLES.map((s) => (
                  <div key={s.id} className="flex items-start gap-2.5 rounded-lg border p-3">
                    <span className="mt-0.5 flex shrink-0 overflow-hidden rounded-sm ring-1 ring-foreground/10" aria-hidden>
                      <span className="size-3.5" style={{ backgroundColor: s.colors.paper }} />
                      <span className="size-3.5" style={{ backgroundColor: s.colors.accent }} />
                      <span className="size-3.5" style={{ backgroundColor: s.colors.headBg }} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{s.name}</div>
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {plugin.id === 'proposal' ? (
            <div className="space-y-2 border-t pt-4">
              <div className="text-xs font-medium text-muted-foreground">包含的横版方案模板</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {PROPOSAL_TEMPLATES.map((tpl) => (
                  <div key={tpl.value} className="rounded-lg border p-3">
                    <div className="text-sm font-medium">{tpl.label}</div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{tpl.description}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {pending ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
          <Clock className="size-6 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">「{plugin.name}」尚在待开发阶段</p>
            <p className="max-w-md text-xs text-muted-foreground">
              该插件已纳入插件清单（规划能力：{plugin.provides.join('、')}），开发完成后可直接在此开启并接入主流程，不影响现有项目数据。
            </p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button asChild variant="outline" size="sm">
              <Link href="/plugins">返回插件市场</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/ai?plugin=${plugin.id}`}>去 AI 对话推演需求</Link>
            </Button>
          </div>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>在项目中使用</CardTitle>
            <CardDescription>
              {enabled
                ? '选择下方项目，直接进入该插件对应的工作台或文档预览'
                : '当前插件已关闭；开启后即可在项目点位图、方案和打印页中使用'}
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {projects.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">还没有进行中的项目，请先在「项目」中创建。</p>
            ) : (
              projects.map((proj) => {
                const targetHref =
                  plugin.id === 'proposal'
                    ? `/print/projects/${proj.id}/proposal?template=qixu`
                    : plugin.id === 'doc-styles'
                      ? `/print/projects/${proj.id}/plans?style=qixu`
                      : `/projects/${proj.id}/point-map`
                const targetLabel =
                  plugin.id === 'proposal'
                    ? '预览栖序提案'
                    : plugin.id === 'doc-styles'
                      ? '预览文档风格'
                      : '打开点位图使用'
                return (
                  <div key={proj.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <FolderKanban className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm font-medium">{proj.name}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                        {proj.customerName ? `${proj.customerName} · ` : ''}
                        {proj.platform || '平台待定'} · {proj.points} 个点位
                      </p>
                    </div>
                    <Button asChild variant="outline" size="xs" disabled={!enabled}>
                      <Link href={targetHref}>
                        {targetLabel}
                        <ExternalLink className="size-3" />
                      </Link>
                    </Button>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      )}
    </section>
  )
}
