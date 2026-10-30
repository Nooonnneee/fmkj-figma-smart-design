import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'

import { BrandLogo } from '@/components/brand-logo'
import { PlanFigure } from '@/components/plan-figure'
import { PointMarker } from '@/components/point-marker'
import { PrintToolbar } from '@/components/print-toolbar'
import { ProductThumb } from '@/components/product-thumb'
import { DocArticle, DocFacts, DocFooter, DocHeader, DocRoot, DocSectionHeading, DocSignatures, DocTitle, docTable } from '@/documents/parts'
import { docToolbarGroups, resolveDocSetup } from '@/documents/registry'
import { appAuth } from '@/lib/app-auth'
import { getCatalog } from '@/lib/cached-data'
import { categoryOfType, DEVICE_CATEGORIES } from '@/lib/device-types'
import { getPayloadClient } from '@/lib/payload'
import type { StoredScene } from '@/lib/point-scene'
import { buildQuoteFloorGroups } from '@/lib/quote-areas'
import { yuan } from '@/lib/quotes'
import { cn } from '@/lib/utils'
import type { Media, Project, User } from '@/payload-types'

export const metadata = { title: '报价单', robots: { index: false, follow: false } }

type Search = { layout?: string; template?: string; style?: string; markers?: string; plans?: string }

/** 给客户的报价单：A4 纵向，版式（分区 / 标准 / 图文 / 精简）× 风格，可打印、导出 PDF 或图片。 */
export default async function PrintQuotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const { id } = await params
  const sp = await searchParams
  const user = await appAuth.getCurrentUser()
  if (!user) redirect(`/login?from=/print/quotes/${id}`)
  const payload = await getPayloadClient()
  const [quote, catalog, setup] = await Promise.all([
    payload.findByID({ collection: 'quotes', id, depth: 2, user, overrideAccess: false }).catch(() => null),
    getCatalog(),
    resolveDocSetup('quote', { style: sp.style, layout: sp.layout ?? sp.template }),
  ])
  if (!quote) notFound()
  const { style, company } = setup
  const project = typeof quote.project === 'object' ? (quote.project as Project) : null
  const owner = project && typeof project.owner === 'object' ? (project.owner as User | null) : null
  const siblingQuotes = project
    ? (
        await payload.find({
          collection: 'quotes',
          where: { project: { equals: project.id } },
          sort: '-updatedAt',
          limit: 6,
          depth: 0,
          user,
          overrideAccess: false,
          select: { title: true, total: true },
        })
      ).docs
    : []
  const imageOf = (i: { image?: unknown }) => (i.image && typeof i.image === 'object' ? ((i.image as Media).url ?? null) : null)
  const items = quote.items ?? []
  const fees = quote.fees ?? []
  const brandOf = new Map(catalog.map((p) => [p.id, p.brand]))
  const productIdOf = (i: (typeof items)[number]) => (typeof i.product === 'object' ? (i.product ? String(i.product.id) : null) : (i.product ?? null))
  // 分区版：按点位图里的「楼层 → 房间」统计设备，单价与型号取自当前报价单
  const floors = project
    ? buildQuoteFloorGroups(
        project.pointMap as Partial<StoredScene> | null,
        project.defaultProducts,
        catalog,
        items.map((i) => ({ product: productIdOf(i), deviceType: i.deviceType ?? null, image: imageOf(i), name: i.name, sku: i.sku ?? '', unit: i.unit ?? '', price: i.price, quantity: i.quantity })),
      )
    : []
  // 没有楼层分区时，分区版退回标准版
  const layout = setup.layout === 'area' && floors.length === 0 ? 'standard' : setup.layout
  const hasPlans = floors.some((f) => Boolean(f.sheetUrl))
  const markers: 'symbol' | 'product' = sp.markers === 'product' ? 'product' : 'symbol'
  const showPlans = sp.plans !== '0' && hasPlans
  const showImages = layout !== 'compact' && company.printProductImages && items.some((i) => imageOf(i))
  const groups = DEVICE_CATEGORIES.map((c) => ({ c, rows: items.map((item, i) => ({ item, i })).filter(({ item }) => categoryOfType(item.deviceType)?.slug === c.slug) })).filter((g) => g.rows.length)
  const ungrouped = items.map((item, i) => ({ item, i })).filter(({ item }) => !categoryOfType(item.deviceType))
  const date = new Date(quote.updatedAt).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric' })
  const contact = [company.phone && `电话：${company.phone}`, company.email && `邮箱：${company.email}`, company.address && `地址：${company.address}`].filter(Boolean) as string[]
  const t = docTable(style)
  const base = `/print/quotes/${id}`
  const href = (patch: Partial<Search>) => {
    const q = new URLSearchParams({ layout, style: style.id, markers, ...(sp.plans === '0' ? { plans: '0' } : {}) })
    for (const [k, v] of Object.entries(patch)) if (v === undefined) q.delete(k); else q.set(k, v)
    return `${base}?${q.toString()}`
  }
  const address = [project?.community, project?.address].filter(Boolean).join(' ')

  return (
    <div className="min-h-screen bg-muted/40 pb-8 print:bg-white print:pb-0">
      <PrintToolbar
        back={{ href: project ? `/projects/${project.id}/quotes/${id}` : '/projects', label: '返回报价' }}
        exportName={`${project ? `${project.name}-` : ''}${quote.title}-${setup.layouts.find((l) => l.value === layout)?.label ?? ''}`}
        groups={[
          ...(siblingQuotes.length > 1
            ? [
                {
                  label: '版本',
                  value: String(quote.id),
                  options: siblingQuotes.slice(0, 4).map((sq) => ({
                    value: String(sq.id),
                    label: `${sq.title.replace(project?.name ?? '', '').trim() || '报价'} ¥${(sq.total ?? 0).toLocaleString('zh-CN')}`,
                    href: `/print/quotes/${sq.id}?layout=${layout}&style=${style.id}&markers=${markers}`,
                  })),
                },
              ]
            : []),
          ...docToolbarGroups({ ...setup, layout }, (p) => href(p)),
          ...(hasPlans
            ? [
                {
                  label: '点位图',
                  value: showPlans ? markers : 'hide',
                  options: [
                    { value: 'symbol', label: '设备图标', href: href({ markers: 'symbol', plans: undefined }) },
                    { value: 'product', label: '产品图', href: href({ markers: 'product', plans: undefined }) },
                    { value: 'hide', label: '不含', href: href({ plans: '0' }) },
                  ],
                },
              ]
            : []),
        ]}
      />
      <DocRoot style={style}>
        <DocArticle>
          <DocHeader style={style} company={company} meta={date} />
          <div className="mt-7">
            <DocTitle
              style={style}
              no={yuan(quote.total).replace('.00', '')}
              title="报价单"
              subtitle={[project?.name ?? quote.title, quote.title].filter((v, i, a) => a.indexOf(v) === i).join(' · ')}
              tag="QUOTATION"
            />
          </div>
          <DocFacts
            className="mt-6 border-y border-doc-rule py-4"
            items={[
              ['客户', project?.customerName],
              ['电话', project?.customerPhone],
              ['项目', project?.name ?? quote.title],
              ['地址', address],
              ...(owner ? ([['联系人', `${owner.name}${owner.phone ? ` ${owner.phone}` : ''}`]] as [string, string][]) : []),
              ...(project?.platform ? ([['主平台', project.platform]] as [string, string][]) : []),
            ]}
          />

          <div className="mt-6">
            {layout === 'detailed' ? (
              <div className="space-y-5">
                {[...groups.map((g) => ({ key: g.c.slug, name: g.c.name, color: g.c.color as string, rows: g.rows })), ...(ungrouped.length ? [{ key: 'none', name: '其他', color: '#525252', rows: ungrouped }] : [])].map((g) => (
                  <section key={g.key} className="break-inside-avoid-page">
                    <DocSectionHeading
                      style={style}
                      className="mb-2"
                      title={
                        <span className="flex items-center gap-2">
                          <span className="size-2 rounded-full" style={{ backgroundColor: g.color }} />
                          {g.name}
                        </span>
                      }
                      note={`小计 ${yuan(g.rows.reduce((s, { item }) => s + item.price * item.quantity, 0))}`}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      {g.rows.map(({ item, i }) => {
                        const brand = brandOf.get(productIdOf(item) ?? '')
                        return (
                          <div key={item.id ?? i} className="flex gap-3 rounded-doc border border-doc-rule p-2 break-inside-avoid">
                            <ProductThumb src={imageOf(item)} alt={item.name} className="size-16" />
                            <div className="flex min-w-0 flex-1 flex-col text-[11px]">
                              {brand ? <BrandLogo name={brand.name} logo={brand.logo} className="h-3 max-w-14" /> : null}
                              <div className="doc-strong mt-0.5 line-clamp-2 leading-snug">{item.name}</div>
                              <div className="truncate text-[10px] text-doc-muted">{item.sku}</div>
                              <div className="mt-auto flex justify-between tabular-nums">
                                <span className="text-doc-muted">{yuan(item.price)} × {item.quantity}{item.unit ?? ''}</span>
                                <span className="doc-strong">{yuan(item.price * item.quantity)}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                ))}
                {fees.length ? (
                  <table className="w-full border-collapse text-[12px]">
                    <tbody>
                      {fees.map((fee, i) => (
                        <tr key={fee.id ?? i} className={t.row(i)}>
                          <td className={cn(t.td, 'py-2')}>{fee.name}</td>
                          <td className={cn(t.td, 'py-2 text-right tabular-nums')}>{yuan(fee.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </div>
            ) : (
              <>
                {layout === 'area' ? (
                  <section className="mb-6 space-y-5">
                    <DocSectionHeading style={style} title="按楼层 · 点位图与房间配置" note={`${floors.length} 层 · ${floors.reduce((s, f) => s + f.rooms.length, 0)} 个房间`} />
                    {floors.map((floor) => (
                      <div key={floor.sheetId} className="space-y-2.5">
                        <div data-pdf-keep-next className="flex items-baseline justify-between bg-doc-stripe px-2.5 py-1.5 text-[12px]">
                          <div>
                            <span className="doc-strong">{floor.floorName}</span>
                            <span className="ml-2 text-[11px] text-doc-muted">{floor.sheetName} · {floor.rooms.length} 个房间 · {floor.pointCount} 个点位</span>
                          </div>
                          <span className="doc-strong tabular-nums">楼层小计 {yuan(floor.subtotal)}</span>
                        </div>
                        {showPlans && floor.sheetUrl ? (
                          <div data-pdf-block className="overflow-hidden rounded-doc border border-doc-rule bg-white break-inside-avoid">
                            <PlanFigure sheetUrl={floor.sheetUrl} points={floor.planPoints} areas={floor.planAreas} mode={markers} className="w-full" />
                          </div>
                        ) : null}
                        <div className="grid grid-cols-2 gap-2.5">
                          {floor.rooms.map((r) => (
                            <div key={r.id} className="rounded-doc border border-doc-rule p-2.5 text-[11px] break-inside-avoid">
                              <div className="doc-strong mb-1.5 flex items-baseline justify-between border-b border-doc-rule/60 pb-1">
                                <span>
                                  {r.name}
                                  <span className="doc-body ml-1.5 text-doc-muted">（{r.pointCount} 点位）</span>
                                </span>
                                <span className="tabular-nums">{yuan(r.subtotal)}</span>
                              </div>
                              <div className="divide-y divide-doc-rule/60">
                                {r.lines.map((l) => (
                                  <div key={`${r.id}-${l.deviceType}-${l.productId}`} className="flex items-center gap-1.5 py-1 first:pt-0 last:pb-0">
                                    <PointMarker type={l.deviceType} className="size-3.5" />
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate">{l.name}</div>
                                      <div className="truncate text-[10px] text-doc-muted">{l.typeName}{l.sku ? ` · ${l.sku}` : ''}</div>
                                    </div>
                                    <div className="shrink-0 text-right tabular-nums">
                                      <div>{yuan(l.subtotal)}</div>
                                      <div className="text-[10px] text-doc-muted">{yuan(l.price)} × {l.quantity}{l.unit || '个'}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    <DocSectionHeading style={style} className="pt-2" title="整单产品汇总" />
                  </section>
                ) : null}
                <table className={cn('w-full border-collapse', layout === 'compact' ? 'text-[11px]' : 'text-[12px]')}>
                  <thead>
                    <tr className={t.head}>
                      <th className={cn(t.th, 'w-10')}>序号</th>
                      {showImages ? <th className={cn(t.th, 'w-14')}>图片</th> : null}
                      <th className={t.th}>产品</th>
                      <th className={t.th}>型号</th>
                      <th className={cn(t.th, 'text-right')}>单价</th>
                      <th className={cn(t.th, 'text-right')}>数量</th>
                      <th className={cn(t.th, 'text-right')}>金额</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={item.id ?? i} className={t.row(i)}>
                        <td className={cn(t.td, 'tabular-nums', layout === 'compact' ? 'py-1' : 'py-2')}>{i + 1}</td>
                        {showImages ? (
                          <td className={cn(t.td, 'py-1.5')}>
                            <ProductThumb src={imageOf(item)} alt={item.name} className="size-10" />
                          </td>
                        ) : null}
                        <td className={cn(t.td, layout === 'compact' ? 'py-1' : 'py-2')}>{item.name}</td>
                        <td className={cn(t.td, 'text-doc-muted')}>{item.sku}</td>
                        <td className={cn(t.td, 'text-right whitespace-nowrap tabular-nums')}>{yuan(item.price)}</td>
                        <td className={cn(t.td, 'text-right whitespace-nowrap tabular-nums')}>{item.quantity}{item.unit ? ` ${item.unit}` : ''}</td>
                        <td className={cn(t.td, 'text-right whitespace-nowrap tabular-nums')}>{yuan(item.price * item.quantity)}</td>
                      </tr>
                    ))}
                    {fees.map((fee, i) => (
                      <tr key={fee.id ?? `fee-${i}`} className={t.row(items.length + i)}>
                        <td className={cn(t.td, 'py-2 tabular-nums')}>{items.length + i + 1}</td>
                        <td className={cn(t.td, 'py-2')} colSpan={showImages ? 5 : 4}>{fee.name}</td>
                        <td className={cn(t.td, 'py-2 text-right tabular-nums')}>{yuan(fee.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>

          <section data-pdf-block className="mt-4 ml-auto w-64 space-y-1 text-[12px] break-inside-avoid">
            <div className="flex justify-between"><span className="text-doc-muted">产品小计</span><span className="tabular-nums">{yuan(quote.productTotal)}</span></div>
            {quote.feeTotal ? <div className="flex justify-between"><span className="text-doc-muted">附加费用</span><span className="tabular-nums">{yuan(quote.feeTotal)}</span></div> : null}
            {quote.discount ? <div className="flex justify-between"><span className="text-doc-muted">优惠</span><span className="tabular-nums">-{yuan(quote.discount)}</span></div> : null}
            <div className="flex items-baseline justify-between border-t border-doc-ink/30 pt-2">
              <span className="doc-strong">合计</span>
              <span className="doc-numeral text-[20px] text-doc-accent">{yuan(quote.total)}</span>
            </div>
          </section>

          {layout !== 'area' && showPlans ? (
            <section className="mt-6 space-y-4">
              <DocSectionHeading style={style} title="附：各层点位布置图" />
              {floors.filter((f) => f.sheetUrl).map((floor) => (
                <div key={floor.sheetId} data-pdf-block className="space-y-1.5 break-inside-avoid">
                  <div className="flex items-baseline justify-between text-[12px]">
                    <span className="doc-strong">{floor.floorName} · {floor.sheetName}</span>
                    <span className="text-[11px] text-doc-muted">{floor.pointCount} 个点位 · 小计 {yuan(floor.subtotal)}</span>
                  </div>
                  <div className="overflow-hidden rounded-doc border border-doc-rule bg-white">
                    <PlanFigure sheetUrl={floor.sheetUrl} points={floor.planPoints} areas={floor.planAreas} mode={markers} className="w-full" />
                  </div>
                </div>
              ))}
            </section>
          ) : null}

          {quote.notes ? (
            <section data-pdf-block className="mt-8 border-t border-doc-rule pt-3 text-[12px] break-inside-avoid">
              <div className="doc-strong mb-1">备注</div>
              <p className="whitespace-pre-line text-doc-muted">{quote.notes}</p>
            </section>
          ) : null}

          {contact.length || company.qrCode?.url ? (
            <section className="mt-8 flex items-center justify-between gap-6 border-t border-doc-rule pt-3 text-[12px] break-inside-avoid">
              <div>
                <div className="doc-strong mb-1">联系我们</div>
                {contact.map((line) => (
                  <p key={line} className="text-doc-muted">{line}</p>
                ))}
              </div>
              {company.qrCode ? (
                <figure className="flex flex-col items-center gap-1">
                  <Image src={company.qrCode.url} alt={company.qrCode.alt || '二维码'} width={88} height={88} className="size-[88px] object-contain" unoptimized />
                  {company.qrCaption ? <figcaption className="text-[10px] text-doc-muted">{company.qrCaption}</figcaption> : null}
                </figure>
              ) : null}
            </section>
          ) : null}

          <DocSignatures className="mt-12" parties={[{ label: '客户确认签字' }, { label: `${company.name} 盖章` }]} />
          <DocFooter className="mt-10" left={address || project?.name || ''} center={date} right={company.name} />
        </DocArticle>
      </DocRoot>
    </div>
  )
}
