import { notFound, redirect } from 'next/navigation'

import { PrintToolbar } from '@/components/print-toolbar'
import { DocEmpty, DocRoot } from '@/documents/parts'
import { appAuth } from '@/lib/app-auth'
import { isPointScope, loadProjectDocs, POINT_SCOPES } from '@/lib/project-docs'
import { QIXU_STYLE } from '@/plugins/doc-styles/styles'
import { classicDeckPages } from '@/plugins/proposal/classic-deck'
import { qixuDeckPages } from '@/plugins/proposal/qixu-deck'
import { isProposalTemplate, PROPOSAL_TEMPLATES, type ProposalTemplate } from '@/plugins/proposal/templates'
import { getPluginFlags } from '@/plugins/state'

export const metadata = { title: '智能家居方案', robots: { index: false, follow: false } }

/** 方案演示（插件）：横版多页方案，可打印、导出 PDF 或图片。 */
export default async function ProposalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ template?: string; markers?: string; scope?: string }> }) {
  const { id } = await params
  const sp = await searchParams
  const user = await appAuth.getCurrentUser()
  if (!user) redirect(`/login?from=/print/projects/${id}/proposal`)
  const flags = await getPluginFlags()
  if (!flags.proposal) notFound()
  const scope = isPointScope(sp.scope) ? sp.scope : 'all'
  const d = await loadProjectDocs(id, user, scope)
  if (!d) notFound()
  const t: ProposalTemplate = isProposalTemplate(sp.template) ? sp.template : 'qixu'
  const tpl = PROPOSAL_TEMPLATES.find((x) => x.value === t)!
  const markers = sp.markers === 'product' || sp.markers === 'symbol' ? sp.markers : tpl.markers
  const date = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric' })
  const pages = t === 'qixu' ? qixuDeckPages(d, markers, flags['room-insights']) : classicDeckPages(d, t, markers, flags['room-insights'], date).map((render, i) => <div key={i}>{render(i + 1)}</div>)
  const base = `/print/projects/${id}/proposal`
  const href = (patch: { template?: string; markers?: string; scope?: string }) =>
    `${base}?${new URLSearchParams({ template: patch.template ?? t, markers: patch.markers ?? markers, scope: patch.scope ?? scope }).toString()}`

  return (
    <div className="min-h-screen bg-neutral-200/70 print:bg-white">
      <style>{'@media print { @page { size: A4 landscape; margin: 0; } }'}</style>
      <PrintToolbar
        back={{ href: `/projects/${id}/point-map`, label: '返回点位' }}
        exportName={`${d.project.name}-${tpl.label}${scope === 'all' ? '' : '-' + POINT_SCOPES.find((x) => x.value === scope)!.label}`}
        wide={t === 'qixu'}
        groups={[
          { label: '模板', value: t, options: PROPOSAL_TEMPLATES.map((x) => ({ value: x.value, label: x.label, href: `${base}?template=${x.value}&scope=${scope}` })) },
          { label: '范围', value: scope, options: POINT_SCOPES.map((x) => ({ value: x.value, label: x.label, href: href({ scope: x.value }) })) },
          { label: '点位', value: markers, options: [{ value: 'symbol', label: '设备图标', href: href({ markers: 'symbol' }) }, { value: 'product', label: '产品图', href: href({ markers: 'product' }) }] },
        ]}
      />
      {t === 'qixu' ? (
        // 栖序提案的页面按设计稿 1440px 宽排版，窄屏时横向滚动
        <DocRoot style={QIXU_STYLE} className="overflow-x-auto print:overflow-visible">
          <div className="min-w-[1440px] space-y-6 py-6 print:min-w-0 print:space-y-0 print:py-0">
            {d.points.length === 0 ? <DocEmpty projectId={id}>点位图里还没有点位。布置好设备后，这里会生成整套方案。</DocEmpty> : null}
            {pages}
          </div>
        </DocRoot>
      ) : (
        <div className="space-y-6 py-6 print:space-y-0 print:py-0">
          {d.points.length === 0 ? <DocEmpty projectId={id}>点位图里还没有点位。布置好设备后，这里会生成整套方案。</DocEmpty> : null}
          {pages}
        </div>
      )}
    </div>
  )
}
