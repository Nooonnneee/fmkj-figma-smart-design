import { notFound, redirect } from 'next/navigation'

import { PlanFigure } from '@/components/plan-figure'
import { PointMarker } from '@/components/point-marker'
import { PrintToolbar } from '@/components/print-toolbar'
import { DocArticle, DocCheckbox, DocFacts, DocFooter, DocHeader, DocRoot, DocSectionHeading, DocSignatures, DocTitle, docTable } from '@/documents/parts'
import { docToolbarGroups, resolveDocSetup } from '@/documents/registry'
import { appAuth } from '@/lib/app-auth'
import { categoryOfType, deviceTypeOf, DEVICE_TYPE_ORDER } from '@/lib/device-types'
import { acceptanceChecks, docNumber, isPointScope, loadProjectDocs, POINT_SCOPES, scopeTitle, type DocPoint, type ProjectDocsData } from '@/lib/project-docs'
import { cn } from '@/lib/utils'

export const metadata = { title: '点位交底清单', robots: { index: false, follow: false } }

type Group = { key: string; title: string; note: string; points: DocPoint[]; sheetId?: string }

const byCode = (a: DocPoint, b: DocPoint) => a.code.localeCompare(b.code, 'en', { numeric: true })

/** 按版式分组：按房间（楼层 → 房间）/ 按设备类型 / 按图纸。 */
function groupPoints(d: ProjectDocsData, layout: string): Group[] {
  const sheetName = new Map(d.sheets.map((s) => [s.id, s.name]))
  const areaName = new Map(d.areas.map((a) => [a.id, a.name]))
  if (layout === 'type') {
    return DEVICE_TYPE_ORDER.filter((t) => d.points.some((p) => p.deviceType === t)).map((t) => {
      const points = d.points.filter((p) => p.deviceType === t).sort(byCode)
      return { key: t, title: deviceTypeOf(t)?.name ?? t, note: `${points.length} 个`, points }
    })
  }
  if (layout === 'sheet') {
    return d.sheets
      .map((s) => {
        const points = d.points.filter((p) => p.sheetId === s.id).sort(byCode)
        return { key: s.id, title: s.name, note: `${points.length} 个点位`, points, sheetId: s.id }
      })
      .filter((g) => g.points.length)
  }
  const groups: Group[] = []
  for (const s of [...d.sheets, null]) {
    const onSheet = d.points.filter((p) => (s ? p.sheetId === s.id : !p.sheetId))
    const areaIds = [...new Set(onSheet.map((p) => p.areaId ?? ''))]
    for (const areaId of areaIds) {
      const points = onSheet.filter((p) => (p.areaId ?? '') === areaId).sort(byCode)
      if (!points.length) continue
      const floor = s ? sheetName.get(s.id) : '未放到图纸'
      groups.push({ key: `${s?.id ?? 'none'}-${areaId}`, title: `${floor} · ${areaId ? (areaName.get(areaId) ?? '房间') : '未分区'}`, note: `${points.length} 个点位`, points })
    }
  }
  return groups
}

/** 点位交底清单：给安装团队的逐点清单（代号、设备、型号、位置），带安装 / 调试勾选、验收要点和三方签字。 */
export default async function ChecklistPrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ style?: string; layout?: string; scope?: string }> }) {
  const { id } = await params
  const sp = await searchParams
  const user = await appAuth.getCurrentUser()
  if (!user) redirect(`/login?from=/print/projects/${id}/checklist`)
  const scope = isPointScope(sp.scope) ? sp.scope : 'all'
  const [d, setup] = await Promise.all([loadProjectDocs(id, user, scope), resolveDocSetup('checklist', sp)])
  if (!d) notFound()
  const { style, layout, company } = setup
  const t = docTable(style)
  const groups = groupPoints(d, layout)
  const areaName = new Map(d.areas.map((a) => [a.id, a.name]))
  const sheetName = new Map(d.sheets.map((s) => [s.id, s.name]))
  const types = DEVICE_TYPE_ORDER.filter((type) => d.points.some((p) => p.deviceType === type))
  const date = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric' })
  const docNo = docNumber(d, 'JD')
  const address = [d.project.community, d.project.address].filter(Boolean).join(' ')
  const title = scopeTitle(scope) ? `点位交底清单（${scopeTitle(scope)}）` : '点位交底清单'
  const base = `/print/projects/${id}/checklist`
  const href = (patch: { style?: string; layout?: string; scope?: string }) =>
    `${base}?${new URLSearchParams({ style: patch.style ?? style.id, layout: patch.layout ?? layout, scope: patch.scope ?? scope }).toString()}`
  const location = (p: DocPoint) => {
    const room = p.areaId ? areaName.get(p.areaId) : null
    const sheet = p.sheetId ? sheetName.get(p.sheetId) : null
    return layout === 'room' ? (room ?? '—') : [sheet, room].filter(Boolean).join(' · ') || '—'
  }

  return (
    <div className="min-h-screen bg-muted/40 pb-8 print:bg-white print:pb-0">
      <PrintToolbar
        back={{ href: `/projects/${id}/point-map`, label: '返回点位' }}
        exportName={`${d.project.name}-${title}`}
        groups={[...docToolbarGroups(setup, href), { label: '范围', value: scope, options: POINT_SCOPES.map((s) => ({ value: s.value, label: s.label, href: href({ scope: s.value }) })) }]}
      />
      <DocRoot style={style}>
        <DocArticle>
          <DocHeader style={style} company={company} meta={`编号 ${docNo}`} />
          <div className="mt-7">
            <DocTitle style={style} no={String(d.points.length)} title={title} subtitle={`${d.project.name} · 以点位代号对照图纸安装，逐点打勾`} tag="INSTALLATION CHECKLIST" />
          </div>
          <DocFacts
            cols={3}
            className="mt-6 border-y border-doc-rule py-4"
            items={[
              ['项目', d.project.name],
              ['客户', d.project.customerName],
              ['地址', address],
              ['主平台', d.project.platform],
              ['设计师', [d.owner?.name, d.owner?.phone].filter(Boolean).join(' ')],
              ['交底日期', date],
            ]}
          />

          <section className="mt-6 break-inside-avoid">
            <DocSectionHeading style={style} title="设备汇总" note={`${d.points.length} 个点位 · ${types.length} 类设备 · ${d.sheets.length} 张图纸`} />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {types.map((type) => (
                <span key={type} className="inline-flex items-center gap-1 rounded-doc border border-doc-rule px-2 py-0.5 text-[11px]">
                  <PointMarker type={type} className="size-3.5" />
                  {deviceTypeOf(type)?.name}
                  <span className="tabular-nums text-doc-muted">×{d.points.filter((p) => p.deviceType === type).length}</span>
                </span>
              ))}
            </div>
          </section>

          <section className="mt-6 break-inside-avoid">
            <DocSectionHeading style={style} title="交底说明" note="安装前请逐条确认" />
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[11.5px] text-doc-ink">
              <li>点位代号与图纸一一对应，安装前核对设备型号和位置。</li>
              <li>墙面设备（开关、插座、面板、门锁）的安装高度按现场规范或设计说明执行。</li>
              <li>现场与图纸不符时，先拍照记录，与设计师确认后再调整。</li>
              <li>每完成一个点位在「安装」栏打勾，联调通过后在「调试」栏打勾。</li>
            </ul>
          </section>

          <div className="mt-6 space-y-6">
            {groups.map((g) => {
              const sheet = g.sheetId ? d.sheets.find((s) => s.id === g.sheetId) : null
              return (
                <section key={g.key}>
                  <DocSectionHeading style={style} className="mb-2" title={g.title} note={g.note} />
                  {sheet ? (
                    <div data-pdf-block className="mb-3 overflow-hidden rounded-doc border border-doc-rule bg-white break-inside-avoid">
                      <PlanFigure
                        sheetUrl={sheet.url}
                        points={g.points}
                        areas={d.areas
                          .filter((a) => a.sheetId === sheet.id)
                          .map((a) => ({ id: a.id, name: a.name, x0: (a.x - sheet.x) / sheet.width, y0: (a.y - sheet.y) / sheet.height, x1: (a.x + a.width - sheet.x) / sheet.width, y1: (a.y + a.height - sheet.y) / sheet.height }))}
                        className="w-full"
                      />
                    </div>
                  ) : null}
                  <table className="w-full border-collapse text-[11px]">
                    <thead>
                      <tr className={t.head}>
                        <th className={cn(t.th, 'w-14')}>代号</th>
                        <th className={cn(t.th, 'w-20')}>设备</th>
                        <th className={t.th}>型号 / 产品</th>
                        <th className={cn(t.th, 'w-28')}>位置</th>
                        <th className={cn(t.th, 'w-10 text-center')}>安装</th>
                        <th className={cn(t.th, 'w-10 text-center')}>调试</th>
                        <th className={cn(t.th, 'w-24')}>备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.points.map((p, i) => {
                        const product = p.productId ? d.productById.get(p.productId) : null
                        return (
                          <tr key={p.id} className={t.row(i)}>
                            <td className={cn(t.td, 'doc-strong py-1.5 tabular-nums')} style={{ color: categoryOfType(p.deviceType)?.color }}>{p.code}</td>
                            <td className={cn(t.td, 'py-1.5')}>{deviceTypeOf(p.deviceType)?.name}</td>
                            <td className={cn(t.td, 'max-w-0 truncate py-1.5', !product && 'text-doc-muted')}>{product ? `${product.name}（${product.sku}）` : '待选型'}</td>
                            <td className={cn(t.td, 'py-1.5 text-doc-muted')}>{location(p)}</td>
                            <td className={cn(t.td, 'py-1.5 text-center text-doc-muted')}><DocCheckbox className="align-middle" /></td>
                            <td className={cn(t.td, 'py-1.5 text-center text-doc-muted')}><DocCheckbox className="align-middle" /></td>
                            <td className={cn(t.td, 'py-1.5')} />
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </section>
              )
            })}
            {groups.length === 0 ? <p className="rounded-doc border border-dashed border-doc-rule p-6 text-center text-doc-muted">点位图里还没有点位。</p> : null}
          </div>

          <section data-pdf-block className="mt-8 break-inside-avoid">
            <DocSectionHeading style={style} title="共同验收，逐项打勾" note="现场记录 / 双方签认" />
            <div className="mt-3 space-y-1.5 text-[12px] leading-[1.65]">
              {acceptanceChecks(d).map((c) => (
                <p key={c} className="flex items-start gap-2">
                  <DocCheckbox className="mt-[0.4em]" />
                  {c}
                </p>
              ))}
            </div>
          </section>

          <DocSignatures className="mt-12" parties={[{ label: '设计方', name: d.owner?.name }, { label: '施工方' }, { label: '业主（验收）', name: d.project.customerName }]} />
          <DocFooter className="mt-10" left={address || d.project.name} center={`${docNo}  /  ${date}`} right={company.name} />
        </DocArticle>
      </DocRoot>
    </div>
  )
}
