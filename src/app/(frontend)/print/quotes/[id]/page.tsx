import { notFound, redirect } from 'next/navigation'

import { appAuth } from '@/lib/app-auth'
import { getPayloadClient } from '@/lib/payload'
import { yuan } from '@/lib/quotes'
import Image from 'next/image'

import { getCompanyInfo } from '@/lib/cached-data'
import type { Media, Project, User } from '@/payload-types'

import { PrintToolbar } from '@/components/print-toolbar'
import { PlanFigure } from '@/components/plan-figure'
import { ProductThumb } from '@/components/product-thumb'
import { PointMarker } from '@/components/point-marker'
import { BrandLogo } from '@/components/brand-logo'
import { getCatalog } from '@/lib/cached-data'
import { categoryOfType, DEVICE_CATEGORIES } from '@/lib/device-types'
import type { StoredScene } from '@/lib/point-scene'
import { buildQuoteFloorGroups } from '@/lib/quote-areas'
import { cn } from '@/lib/utils'

/** 报价单模板：分区版（按楼层房间）、标准版、图文版、精简版。 */
const QUOTE_TEMPLATES = [
  { value: 'area', label: '分区版（按楼层房间）' },
  { value: 'standard', label: '标准版' },
  { value: 'detailed', label: '图文版' },
  { value: 'compact', label: '精简版' },
] as const
type QuoteTemplate = (typeof QUOTE_TEMPLATES)[number]['value']

export const metadata = { title: '报价单' }

/** 给客户的报价单：独立于系统外框，A4 打印 / 另存为 PDF。 */
export default async function PrintQuotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ template?: string; markers?: string; plans?: string }> }) {
  const { id } = await params
  const sp = await searchParams
  const user = await appAuth.getCurrentUser()
  if (!user) redirect(`/login?from=/print/quotes/${id}`)
  const payload = await getPayloadClient()
  const quote = await payload.findByID({ collection: 'quotes', id, depth: 2, user, overrideAccess: false }).catch(() => null)
  if (!quote) notFound()
  const project = typeof quote.project === 'object' ? (quote.project as Project) : null
  const company = await getCompanyInfo()
  const catalog = await getCatalog()
  const logo = company.logo
  const qr = company.qrCode
  const contact = [company.phone && `电话：${company.phone}`, company.email && `邮箱：${company.email}`, company.address && `地址：${company.address}`].filter(Boolean) as string[]
  const owner = project && typeof project.owner === 'object' ? (project.owner as User | null) : null
  const imageOf = (i: { image?: unknown }) => (i.image && typeof i.image === 'object' ? ((i.image as Media).url ?? null) : null)
  const items = quote.items ?? []
  const brandOf = new Map(catalog.map((p) => [p.id, p.brand]))
  const productIdOf = (i: (typeof items)[number]) => (typeof i.product === 'object' ? (i.product ? String(i.product.id) : null) : (i.product ?? null))
  // 分区版：按点位图里的「楼层 → 房间」统计设备，单价与型号取自当前报价单
  const floors = project
    ? buildQuoteFloorGroups(
        project.pointMap as Partial<StoredScene> | null,
        project.defaultProducts,
        catalog,
        items.map((i) => ({
          product: productIdOf(i),
          deviceType: i.deviceType ?? null,
          image: imageOf(i),
          name: i.name,
          sku: i.sku ?? '',
          unit: i.unit ?? '',
          price: i.price,
          quantity: i.quantity,
        })),
      )
    : []
  const t: QuoteTemplate = QUOTE_TEMPLATES.some((x) => x.value === sp.template)
    ? (sp.template as QuoteTemplate)
    : floors.length > 0
      ? 'area'
      : 'standard'
  const markers: 'symbol' | 'product' = sp.markers === 'product' ? 'product' : 'symbol'
  const showPlans = sp.plans !== '0' && floors.some((f) => Boolean(f.sheetUrl))
  const showImages = t !== 'compact' && company.printProductImages && items.some((i) => imageOf(i))
  const groups = DEVICE_CATEGORIES.map((c) => ({ c, rows: items.map((item, i) => ({ item, i })).filter(({ item }) => categoryOfType(item.deviceType)?.slug === c.slug) })).filter((g) => g.rows.length)
  const ungrouped = items.map((item, i) => ({ item, i })).filter(({ item }) => !categoryOfType(item.deviceType))
  const date = new Date(quote.updatedAt).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric' })
  const base = `/print/quotes/${id}`

  return (
    <div className="min-h-screen bg-muted/40 pb-8 print:bg-white print:pb-0">
      <PrintToolbar
        back={{ href: `/quotes/${id}`, label: '返回报价' }}
        exportName={`${quote.title}-${QUOTE_TEMPLATES.find((x) => x.value === t)!.label}`}
        groups={[
          { label: '模板', value: t, options: QUOTE_TEMPLATES.map((x) => ({ value: x.value, label: x.label, href: `${base}?template=${x.value}&markers=${markers}` })) },
          ...(floors.some((f) => Boolean(f.sheetUrl))
            ? [
                {
                  label: '点位图',
                  value: showPlans ? markers : 'hide',
                  options: [
                    { value: 'symbol', label: '设备图标', href: `${base}?template=${t}&markers=symbol` },
                    { value: 'product', label: '产品图', href: `${base}?template=${t}&markers=product` },
                    { value: 'hide', label: '不含点位图', href: `${base}?template=${t}&plans=0` },
                  ],
                },
              ]
            : []),
        ]}
      />
      <article data-export-page className="mt-6 mx-auto max-w-[210mm] bg-white px-[14mm] py-[16mm] text-[13px] leading-relaxed text-neutral-900 shadow-sm print:mt-0 print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between border-b border-neutral-300 pb-5">
          <div className="flex items-center gap-3">
            {logo ? (
              <Image src={logo.url} alt={logo.alt || company.name} width={logo.width ?? 96} height={logo.height ?? 96} className="h-12 w-auto object-contain" unoptimized />
            ) : null}
            <div>
              <div className="text-lg font-semibold">{company.name}</div>
              {company.slogan ? <div className="text-xs text-neutral-500">{company.slogan}</div> : null}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold tracking-wide">报价单</div>
            <div className="text-xs text-neutral-500">{date}</div>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-x-8 gap-y-1 py-5 text-[12px]">
          <div><span className="text-neutral-500">客户：</span>{project?.customerName ?? '—'}</div>
          <div><span className="text-neutral-500">项目：</span>{project?.name ?? quote.title}</div>
          <div><span className="text-neutral-500">电话：</span>{project?.customerPhone ?? '—'}</div>
          <div><span className="text-neutral-500">地址：</span>{[project?.community, project?.address].filter(Boolean).join(' ') || '—'}</div>
          {owner ? <div><span className="text-neutral-500">联系人：</span>{owner.name}{owner.phone ? ` ${owner.phone}` : ''}</div> : null}
        </section>

        {t === 'detailed' ? (
          <div className="space-y-5">
            {[...groups.map((g) => ({ key: g.c.slug, name: g.c.name, color: g.c.color as string, rows: g.rows })), ...(ungrouped.length ? [{ key: 'none', name: '其他', color: '#525252', rows: ungrouped }] : [])].map((g) => (
              <section key={g.key} className="break-inside-avoid-page">
                <div className="mb-2 flex items-center justify-between border-b border-neutral-300 pb-1 text-[12px]">
                  <span className="flex items-center gap-2 font-semibold"><span className="size-2 rounded-full" style={{ backgroundColor: g.color }} />{g.name}</span>
                  <span className="tabular-nums text-neutral-500">小计 {yuan(g.rows.reduce((s, { item }) => s + item.price * item.quantity, 0))}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {g.rows.map(({ item, i }) => {
                    const brand = brandOf.get(productIdOf(item) ?? '')
                    return (
                      <div key={item.id ?? i} className="flex gap-3 rounded-md border border-neutral-200 p-2 break-inside-avoid">
                        <ProductThumb src={imageOf(item)} alt={item.name} className="size-16" />
                        <div className="flex min-w-0 flex-1 flex-col text-[11px]">
                          {brand ? <BrandLogo name={brand.name} logo={brand.logo} className="h-3 max-w-14" /> : null}
                          <div className="mt-0.5 line-clamp-2 font-medium leading-snug">{item.name}</div>
                          <div className="truncate text-[10px] text-neutral-500">{item.sku}</div>
                          <div className="mt-auto flex justify-between tabular-nums"><span className="text-neutral-500">{yuan(item.price)} × {item.quantity}{item.unit ?? ''}</span><span className="font-semibold">{yuan(item.price * item.quantity)}</span></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
            {(quote.fees ?? []).length ? (
              <table className="w-full border-collapse text-[12px]"><tbody>
                {(quote.fees ?? []).map((fee, i) => <tr key={fee.id ?? i} className="border-b border-neutral-200"><td className="py-2 pl-2">{fee.name}</td><td className="py-2 pr-2 text-right tabular-nums">{yuan(fee.amount)}</td></tr>)}
              </tbody></table>
            ) : null}
          </div>
        ) : (
          <>
            {t === 'area' ? (
              <section className="mb-6 space-y-5">
                <h2 data-pdf-keep-next className="text-[13px] font-semibold">一、按楼层 · 点位图与房间配置明细</h2>
                {floors.length === 0 ? <p className="text-[12px] text-neutral-500">点位图里还没有划分区域，以下为整单明细。</p> : null}
                {floors.map((floor) => (
                  <div key={floor.sheetId} className="space-y-2.5">
                    <div data-pdf-keep-next className="flex items-baseline justify-between border-b border-neutral-300 bg-neutral-50 px-2.5 py-1.5 text-[12px]">
                      <div>
                        <span className="font-semibold">{floor.floorName}</span>
                        <span className="ml-2 text-[11px] text-neutral-500">{floor.sheetName} · {floor.rooms.length} 个房间 · {floor.pointCount} 个点位</span>
                      </div>
                      <span className="font-semibold tabular-nums">楼层小计 {yuan(floor.subtotal)}</span>
                    </div>
                    {showPlans && floor.sheetUrl ? (
                      <div data-pdf-block className="overflow-hidden rounded-md border border-neutral-200 bg-white break-inside-avoid">
                        <PlanFigure
                          sheetUrl={floor.sheetUrl}
                          points={floor.planPoints}
                          areas={floor.planAreas}
                          mode={markers}
                          className="w-full"
                        />
                      </div>
                    ) : null}
                    <div className="grid grid-cols-2 gap-2.5">
                      {floor.rooms.map((r) => (
                        <div key={r.id} className="rounded-md border border-neutral-200 p-2.5 text-[11px] break-inside-avoid">
                          <div className="mb-1.5 flex items-baseline justify-between border-b border-neutral-100 pb-1 font-semibold">
                            <span>{r.name}<span className="ml-1.5 font-normal text-neutral-500">（{r.pointCount} 点位）</span></span>
                            <span className="tabular-nums">{yuan(r.subtotal)}</span>
                          </div>
                          <div className="divide-y divide-neutral-100">
                            {r.lines.map((l) => (
                              <div key={`${r.id}-${l.deviceType}-${l.productId}`} className="flex items-center gap-1.5 py-1 first:pt-0 last:pb-0">
                                <PointMarker type={l.deviceType} className="size-3.5" />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate font-medium">{l.name}</div>
                                  <div className="truncate text-[10px] text-neutral-500">
                                    {l.typeName}{l.sku ? ` · ${l.sku}` : ''}
                                  </div>
                                </div>
                                <div className="shrink-0 text-right tabular-nums">
                                  <div className="font-medium">{yuan(l.subtotal)}</div>
                                  <div className="text-[10px] text-neutral-500">{yuan(l.price)} × {l.quantity}{l.unit || '个'}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <h2 data-pdf-keep-next className="pt-2 text-[13px] font-semibold">二、整单产品汇总</h2>
              </section>
            ) : null}
            <table className={cn('w-full border-collapse', t === 'compact' ? 'text-[11px]' : 'text-[12px]')}>
              <thead>
                <tr className="border-y border-neutral-300 bg-neutral-50 text-left">
                  <th className="w-10 py-2 pl-2 font-medium">序号</th>
                  {showImages ? <th className="w-14 py-2 font-medium">图片</th> : null}
                  <th className="py-2 font-medium">产品</th>
                  <th className="py-2 font-medium">型号</th>
                  <th className="px-2 py-2 text-right font-medium">单价</th>
                  <th className="px-2 py-2 text-right font-medium">数量</th>
                  <th className="py-2 pr-2 pl-2 text-right font-medium">金额</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id ?? i} className="border-b border-neutral-200 break-inside-avoid">
                    <td className={cn('pl-2 tabular-nums', t === 'compact' ? 'py-1' : 'py-2')}>{i + 1}</td>
                    {showImages ? <td className="py-1.5"><ProductThumb src={imageOf(item)} alt={item.name} className="size-10" /></td> : null}
                    <td className={t === 'compact' ? 'py-1' : 'py-2'}>{item.name}</td>
                    <td className="text-neutral-500">{item.sku}</td>
                    <td className="px-2 text-right whitespace-nowrap tabular-nums">{yuan(item.price)}</td>
                    <td className="px-2 text-right whitespace-nowrap tabular-nums">{item.quantity}{item.unit ? ` ${item.unit}` : ''}</td>
                    <td className="pr-2 pl-2 text-right whitespace-nowrap tabular-nums">{yuan(item.price * item.quantity)}</td>
                  </tr>
                ))}
                {(quote.fees ?? []).map((fee, i) => (
                  <tr key={fee.id ?? `fee-${i}`} className="border-b border-neutral-200 break-inside-avoid">
                    <td className="py-2 pl-2 tabular-nums">{items.length + i + 1}</td>
                    <td className="py-2" colSpan={showImages ? 5 : 4}>{fee.name}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{yuan(fee.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <section data-pdf-block className="ml-auto mt-4 w-64 space-y-1 text-[12px] break-inside-avoid">
          <div className="flex justify-between"><span className="text-neutral-500">产品小计</span><span className="tabular-nums">{yuan(quote.productTotal)}</span></div>
          {quote.feeTotal ? <div className="flex justify-between"><span className="text-neutral-500">附加费用</span><span className="tabular-nums">{yuan(quote.feeTotal)}</span></div> : null}
          {quote.discount ? <div className="flex justify-between"><span className="text-neutral-500">优惠</span><span className="tabular-nums">-{yuan(quote.discount)}</span></div> : null}
          <div className="flex items-baseline justify-between border-t border-neutral-300 pt-2">
            <span className="font-medium">合计</span>
            <span className="text-lg font-semibold tabular-nums">{yuan(quote.total)}</span>
          </div>
        </section>

        {t !== 'area' && showPlans ? (
          <section className="mt-6 space-y-4">
            <h2 data-pdf-keep-next className="text-[13px] font-semibold">附：各层点位布置图</h2>
            {floors
              .filter((f) => f.sheetUrl)
              .map((floor) => (
                <div key={floor.sheetId} data-pdf-block className="space-y-1.5 break-inside-avoid">
                  <div className="flex items-baseline justify-between text-[12px]">
                    <span className="font-semibold">{floor.floorName} · {floor.sheetName}</span>
                    <span className="text-[11px] text-neutral-500">{floor.pointCount} 个点位 · 小计 {yuan(floor.subtotal)}</span>
                  </div>
                  <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
                    <PlanFigure
                      sheetUrl={floor.sheetUrl}
                      points={floor.planPoints}
                      areas={floor.planAreas}
                      mode={markers}
                      className="w-full"
                    />
                  </div>
                </div>
              ))}
          </section>
        ) : null}

        {quote.notes ? (
          <section data-pdf-block className="mt-8 break-inside-avoid border-t border-neutral-200 pt-3 text-[12px]">
            <div className="mb-1 font-medium">备注</div>
            <p className="whitespace-pre-line text-neutral-600">{quote.notes}</p>
          </section>
        ) : null}

        {contact.length || qr?.url ? (
          <section className="mt-8 flex items-center justify-between gap-6 border-t border-neutral-200 pt-3 text-[12px] break-inside-avoid">
            <div>
              <div className="mb-1 font-medium">联系我们</div>
              {contact.map((line) => <p key={line} className="text-neutral-600">{line}</p>)}
            </div>
            {qr ? (
              <figure className="flex flex-col items-center gap-1">
                <Image src={qr.url} alt={qr.alt || '二维码'} width={88} height={88} className="size-[88px] object-contain" unoptimized />
                {company.qrCaption ? <figcaption className="text-[10px] text-neutral-500">{company.qrCaption}</figcaption> : null}
              </figure>
            ) : null}
          </section>
        ) : null}

        <footer className="mt-12 grid grid-cols-2 gap-8 text-[12px] break-inside-avoid">
          <div className="border-t border-neutral-400 pt-2 text-neutral-500">客户确认签字 / 日期</div>
          <div className="border-t border-neutral-400 pt-2 text-neutral-500">{company.name} 盖章 / 日期</div>
        </footer>
      </article>
    </div>
  )
}
