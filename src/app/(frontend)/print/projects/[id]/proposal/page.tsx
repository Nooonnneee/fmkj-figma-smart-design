import { Fragment } from 'react'
import { notFound, redirect } from 'next/navigation'

import { PrintToolbar } from '@/components/print-toolbar'
import { DocEmpty } from '@/documents/parts'
import { appAuth } from '@/lib/app-auth'
import { isPointScope, loadProjectDocs, POINT_SCOPES } from '@/lib/project-docs'
import { constructionDeckPages } from '@/plugins/proposal/construction-deck'
import { DeckRoot, deckPages } from '@/plugins/proposal/deck'
import {
  DEFAULT_PROPOSAL_TEMPLATE,
  isProposalMarkers,
  resolveProposalTemplate,
  PROPOSAL_TEMPLATES,
  type ProposalMarkers,
  type ProposalTemplate,
} from '@/plugins/proposal/templates'
import { getPluginFlags } from '@/plugins/state'

export const metadata = { title: '智能家居方案', robots: { index: false, follow: false } }

/** 方案演示（插件）：三种风格的 8 章横版提案 + 施工交底，可打印、导出 PDF 或图片。 */
export default async function ProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ template?: string; markers?: string; scope?: string; quoteId?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const user = await appAuth.getCurrentUser()
  if (!user) redirect(`/login?from=/print/projects/${id}/proposal`)
  const scope = isPointScope(sp.scope) ? sp.scope : 'all'
  const d = await loadProjectDocs(id, user, scope, sp.quoteId ?? null)
  if (!d) notFound()
  const flags = await getPluginFlags(d.owner?.id ?? user.id)
  if (!flags.proposal) notFound()
  // 模板：网址参数 → 设置里的默认方案模板 → 栖序雅致
  const saved = d.company.documentDefaults.proposal?.layout
  const t: ProposalTemplate = resolveProposalTemplate(sp.template) ?? resolveProposalTemplate(saved) ?? DEFAULT_PROPOSAL_TEMPLATE
  const tpl = PROPOSAL_TEMPLATES.find((x) => x.value === t)!
  const deck = t !== 'construction'
  const markerOptions: { value: ProposalMarkers; label: string }[] = deck
    ? [
        { value: 'number', label: '编号' },
        { value: 'symbol', label: '设备图标' },
      ]
    : [
        { value: 'symbol', label: '设备图标' },
        { value: 'product', label: '产品图' },
      ]
  const markers: ProposalMarkers = isProposalMarkers(sp.markers) && markerOptions.some((o) => o.value === sp.markers) ? sp.markers : tpl.markers
  const date = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric' })
  const base = `/print/projects/${id}/proposal`
  const activeQuoteId = d.quote ? String(d.quote.id) : ''
  const href = (patch: { template?: string; markers?: string; scope?: string; quoteId?: string }) => {
    const q = new URLSearchParams({
      template: patch.template ?? t,
      markers: patch.markers ?? markers,
      scope: patch.scope ?? scope,
    })
    const nextQuoteId = patch.quoteId !== undefined ? patch.quoteId : patch.scope && patch.scope !== scope ? '' : activeQuoteId
    if (nextQuoteId) q.set('quoteId', nextQuoteId)
    return `${base}?${q.toString()}`
  }
  const empty = d.points.length === 0 ? <DocEmpty projectId={id}>点位图里还没有点位。布置好设备后，这里会生成整套方案。</DocEmpty> : null

  return (
    <div className="min-h-screen bg-neutral-200/70 print:min-h-0 print:bg-white">
      <style>{'@media print { @page { size: A4 landscape; margin: 0; } }'}</style>
      <PrintToolbar
        back={{ href: `/projects/${id}/archive`, label: '返回归档' }}
        exportName={`${d.project.name}-${tpl.label}${scope === 'all' ? '' : '-' + POINT_SCOPES.find((x) => x.value === scope)!.label}`}
        wide={deck}
        groups={[
          ...(d.projectList.length > 1
            ? [
                {
                  label: '项目',
                  value: id,
                  options: d.projectList.slice(0, 5).map((p) => ({
                    value: p.id,
                    label: `${p.name}（${p.pointCount}点）`,
                    href: `/print/projects/${p.id}/proposal?template=${t}&scope=${scope}`,
                  })),
                },
              ]
            : []),
          { label: '模板', value: t, options: PROPOSAL_TEMPLATES.map((x) => ({ value: x.value, label: x.label, href: `${base}?template=${x.value}&scope=${scope}` })) },
          { label: '范围', value: scope, options: POINT_SCOPES.map((x) => ({ value: x.value, label: x.label, href: href({ scope: x.value }) })) },
          ...(d.quotes.length > 1
            ? [
                {
                  label: '报价版本',
                  value: activeQuoteId,
                  options: d.quotes.slice(0, 4).map((q) => ({
                    value: q.id,
                    label: `${q.title.replace(d.project.name, '').trim() || '报价'} ¥${q.total.toLocaleString('zh-CN')}`,
                    href: href({ quoteId: q.id, scope: q.scope }),
                  })),
                },
              ]
            : []),
          { label: '点位', value: markers, options: markerOptions.map((o) => ({ ...o, href: href({ markers: o.value }) })) },
        ]}
      />
      {deck ? (
        <DeckRoot themeId={t}>
          {empty}
          {deckPages(d, t, { markers, insights: flags['room-insights'] })}
        </DeckRoot>
      ) : (
        <div className="space-y-6 py-6 print:space-y-0 print:py-0">
          {empty}
          {constructionDeckPages(d, markers === 'product' ? 'product' : 'symbol', flags['room-insights'], date).map((render, i) => (
            <Fragment key={i}>{render(i + 1)}</Fragment>
          ))}
        </div>
      )}
    </div>
  )
}
