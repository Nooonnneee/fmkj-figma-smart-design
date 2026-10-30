/**
 * 方案演示插件：经典三套横版 A4 方案（现代简约、高端提案、施工交底）。
 * 栖序提案见 qixu-deck.tsx。
 */
import Image from 'next/image'
import { AlertTriangle, Check, Lightbulb, Plus } from 'lucide-react'

import { BrandLogo } from '@/components/brand-logo'
import { PlanFigure } from '@/components/plan-figure'
import { PointMarker } from '@/components/point-marker'
import { ProductThumb } from '@/components/product-thumb'
import { LEVEL_LABEL } from '@/lib/area-analysis'
import { categoryOfType, deviceTypeOf, DEVICE_TYPE_ORDER } from '@/lib/device-types'
import type { ProjectDocsData as ProposalData, Room } from '@/lib/project-docs'
import { yuan } from '@/lib/quotes'
import { cn } from '@/lib/utils'

import type { ProposalTemplate } from './templates'

const chunk = <T,>(list: T[], n: number) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n))

type Ctx = { d: ProposalData; t: Exclude<ProposalTemplate, 'qixu'>; markers: 'symbol' | 'product'; showPrice: boolean; date: string }

function Page({ ctx, title, no, children, dark = false }: { ctx: Ctx; title?: string; no: number; children: React.ReactNode; dark?: boolean }) {
  const premium = ctx.t === 'premium'
  return (
    <section data-export-page className={cn('relative mx-auto flex h-[210mm] w-[297mm] flex-col overflow-hidden bg-white px-[14mm] py-[11mm] text-neutral-900 shadow-sm break-after-page print:shadow-none', dark && 'bg-neutral-950 text-white')}>
      {title ? (
        <header className={cn('mb-[6mm] flex items-end justify-between border-b pb-[3mm]', premium ? 'border-neutral-900' : 'border-neutral-200')}>
          <h2 className={cn('font-semibold tracking-tight', premium ? 'text-[22px]' : 'text-[19px]')}>{title}</h2>
          <span className="text-[10px] text-neutral-500">{ctx.d.company.name} · {ctx.d.project.name}</span>
        </header>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      {title ? (
        <footer className="mt-[4mm] flex justify-between text-[9px] text-neutral-400">
          <span>{ctx.t === 'construction' ? '施工交底 · 以现场复核为准' : '本方案依据户型图设计，实际以现场勘测为准'}</span>
          <span className="tabular-nums">{String(no).padStart(2, '0')}</span>
        </footer>
      ) : null}
    </section>
  )
}

function Cover({ ctx }: { ctx: Ctx }) {
  const { d, t } = ctx
  const logo = d.company.logo
  const facts = [
    ['客户', d.project.customerName],
    ['地址', [d.project.community, d.project.address].filter(Boolean).join(' ') || '—'],
    ['主平台', d.project.platform ?? '待定'],
    ['设计师', d.owner?.name ?? '—'],
    ['日期', ctx.date],
  ]
  if (t === 'premium') {
    const sheet = d.sheets.slice().sort((a, b) => d.points.filter((p) => p.sheetId === b.id).length - d.points.filter((p) => p.sheetId === a.id).length)[0]
    return (
      <Page ctx={ctx} no={1} dark>
        <div className="flex h-full gap-[10mm]">
          <div className="flex w-[105mm] flex-col justify-between">
            <div className="flex items-center gap-3">
              {logo ? <Image src={logo.url} alt={logo.alt} width={logo.width ?? 96} height={logo.height ?? 96} className="h-10 w-auto rounded bg-white p-1" unoptimized /> : null}
              <span className="text-sm tracking-wide text-neutral-300">{d.company.name}</span>
            </div>
            <div className="space-y-4">
              <p className="text-xs tracking-[0.3em] text-neutral-400">WHOLE-HOME SMART LIVING</p>
              <h1 className="text-[34px] leading-tight font-semibold">{d.project.name}</h1>
              <p className="text-lg text-neutral-300">全屋智能设计方案</p>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-[12px]">
              {facts.map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-neutral-500">{k}</dt><dd className="text-neutral-200">{v}</dd></div>
              ))}
            </dl>
          </div>
          <div className="flex flex-1 items-center rounded-xl bg-white p-[4mm]">
            {sheet ? <PlanFigure sheetUrl={sheet.url} points={d.points.filter((p) => p.sheetId === sheet.id).map((p) => ({ ...p, image: p.productId ? d.productById.get(p.productId)?.image?.url : null }))} mode="product" showCodes={false} showAreas={false} className="w-full" /> : null}
          </div>
        </div>
      </Page>
    )
  }
  return (
    <Page ctx={ctx} no={1}>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logo ? <Image src={logo.url} alt={logo.alt} width={logo.width ?? 96} height={logo.height ?? 96} className="h-11 w-auto" unoptimized /> : null}
            <div>
              <div className="text-base font-semibold">{d.company.name}</div>
              {d.company.slogan ? <div className="text-[11px] text-neutral-500">{d.company.slogan}</div> : null}
            </div>
          </div>
          <div className="flex h-2 w-40 overflow-hidden rounded-full">{d.categories.map((c) => <span key={c.slug} className="h-full" style={{ backgroundColor: c.color, flex: c.count }} />)}</div>
        </div>
        <div className="my-auto space-y-5">
          <p className="text-sm text-neutral-500">{t === 'construction' ? '施工交底 · 点位布置与设备清单' : '全屋智能设计方案'}</p>
          <h1 className="text-[40px] leading-tight font-bold tracking-tight">{d.project.name}</h1>
          <div className="flex gap-10 text-[13px]">
            <div><div className="text-3xl font-semibold tabular-nums">{d.points.length}</div><div className="text-neutral-500">智能点位</div></div>
            <div><div className="text-3xl font-semibold tabular-nums">{d.rooms.length}</div><div className="text-neutral-500">覆盖房间</div></div>
            <div><div className="text-3xl font-semibold tabular-nums">{d.sheets.length}</div><div className="text-neutral-500">设计图纸</div></div>
            {ctx.showPrice ? <div><div className="text-3xl font-semibold tabular-nums">{yuan(d.total).replace('.00', '')}</div><div className="text-neutral-500">方案预算</div></div> : null}
          </div>
        </div>
        <dl className="grid grid-cols-5 gap-4 border-t border-neutral-200 pt-4 text-[12px]">
          {facts.map(([k, v]) => <div key={k}><dt className="text-neutral-500">{k}</dt><dd className="mt-0.5 font-medium">{v}</dd></div>)}
        </dl>
      </div>
    </Page>
  )
}

function Overview({ ctx, no }: { ctx: Ctx; no: number }) {
  const { d } = ctx
  const max = Math.max(...d.categories.map((c) => c.count), 1)
  return (
    <Page ctx={ctx} no={no} title="方案概览">
      <div className="grid flex-1 grid-cols-[1.1fr_1fr] gap-[10mm]">
        <div className="space-y-[6mm]">
          <div className="grid grid-cols-4 gap-3">
            {[
              ['智能点位', d.points.length],
              ['房间', d.rooms.length],
              ['设备型号', d.products.length],
              [ctx.showPrice ? '方案预算' : '待选型', ctx.showPrice ? yuan(d.total).replace('.00', '') : d.pending],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-neutral-200 p-3">
                <div className="text-[10px] text-neutral-500">{k}</div>
                <div className="mt-1 text-xl font-semibold tabular-nums">{v}</div>
              </div>
            ))}
          </div>
          <div>
            <h3 className="mb-2 text-[12px] font-semibold">设备构成</h3>
            <div className="space-y-1.5">
              {d.categories.map((c) => (
                <div key={c.slug} className="grid grid-cols-[4.5rem_1fr_2.5rem_5.5rem] items-center gap-2 text-[11px]">
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />{c.name}</span>
                  <span className="h-2 rounded-full bg-neutral-100"><span className="block h-full rounded-full" style={{ width: `${(c.count / max) * 100}%`, backgroundColor: c.color }} /></span>
                  <span className="text-right tabular-nums">{c.count}</span>
                  <span className="text-right text-neutral-500 tabular-nums">{ctx.showPrice ? yuan(c.amount).replace('.00', '') : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-[6mm]">
          <div>
            <h3 className="mb-2 text-[12px] font-semibold">方案亮点</h3>
            <ul className="space-y-2 text-[12px]">
              {d.analysis.highlights.map((h) => <li key={h} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />{h}</li>)}
            </ul>
          </div>
          {d.analysis.warnings.length || d.pending ? (
            <div>
              <h3 className="mb-2 text-[12px] font-semibold">需要确认</h3>
              <ul className="space-y-1.5 text-[11px] text-neutral-600">
                {d.pending ? <li className="flex gap-2"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />{d.pending} 个点位暂未选型，未计入预算</li> : null}
                {d.analysis.warnings.map((w) => <li key={w} className="flex gap-2"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />{w}</li>)}
              </ul>
            </div>
          ) : null}
          {d.rooms.length ? (
            <div>
              <h3 className="mb-2 text-[12px] font-semibold">房间配置完整度{d.analysis.score !== null ? <span className="ml-2 font-normal text-neutral-500">平均 {d.analysis.score}%</span> : null}</h3>
              <div className="grid grid-cols-3 gap-1.5">
                {d.rooms.map((r) => (
                  <div key={r.areaId} className="rounded-md border border-neutral-200 px-2 py-1.5 text-[10px]">
                    <div className="flex justify-between"><span className="font-medium">{r.name}</span><span className="tabular-nums text-neutral-500">{r.score}%</span></div>
                    <div className="mt-1 h-1 rounded-full bg-neutral-100"><div className={cn('h-full rounded-full', r.score >= 100 ? 'bg-emerald-500' : r.score >= 60 ? 'bg-neutral-700' : 'bg-amber-500')} style={{ width: `${r.score}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Page>
  )
}

function PlanPage({ ctx, no, sheetId }: { ctx: Ctx; no: number; sheetId: string }) {
  const { d, markers } = ctx
  const sheet = d.sheets.find((s) => s.id === sheetId)!
  const pts = d.points.filter((p) => p.sheetId === sheetId)
  const areas = d.areas.filter((a) => a.sheetId === sheetId).map((a) => ({ id: a.id, name: a.name, x0: (a.x - sheet.x) / sheet.width, y0: (a.y - sheet.y) / sheet.height, x1: (a.x + a.width - sheet.x) / sheet.width, y1: (a.y + a.height - sheet.y) / sheet.height }))
  const types = DEVICE_TYPE_ORDER.filter((t) => pts.some((p) => p.deviceType === t))
  return (
    <Page ctx={ctx} no={no} title={`${sheet.name} · ${ctx.d.scope === 'switch' ? '开关布局图' : ctx.d.scope === 'switch-light' ? '灯光开关布局图' : '点位图'}`}>
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_56mm] gap-[6mm]">
        <div className="flex items-center rounded-lg border border-neutral-200">
          <PlanFigure
            sheetUrl={sheet.url}
            points={pts.map((p) => ({ ...p, image: p.productId ? d.productById.get(p.productId)?.image?.url : null }))}
            areas={areas}
            mode={markers}
            showCodes={ctx.t !== 'premium'}
            showAreas={ctx.t !== 'premium'}
            className="w-full"
          />
        </div>
        <div className="min-h-0 space-y-1 overflow-hidden text-[10px]">
          <div className="mb-1.5 flex justify-between text-[11px] font-semibold"><span>图例</span><span className="font-normal text-neutral-500">{pts.length} 个点位</span></div>
          {types.map((t) => {
            const list = pts.filter((p) => p.deviceType === t)
            const product = list[0]?.productId ? d.productById.get(list[0].productId) : null
            return (
              <div key={t} className="flex items-center gap-1.5 border-b border-neutral-100 pb-1">
                {markers === 'product' && product?.image ? <ProductThumb src={product.image.url} alt={product.name} className="size-6 rounded-full" /> : <PointMarker type={t} className="size-5" />}
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{deviceTypeOf(t)?.name}</span>
                  {product ? <span className="block truncate text-[9px] text-neutral-500">{product.name}</span> : <span className="block text-[9px] text-amber-600">待选型</span>}
                </span>
                <span className="tabular-nums">×{list.length}</span>
              </div>
            )
          })}
        </div>
      </div>
    </Page>
  )
}

function RoomCard({ r, ctx }: { r: Room; ctx: Ctx }) {
  const { d } = ctx
  const core = r.missing.filter((m) => m.level !== 'optional')
  return (
    <div className="flex min-h-0 flex-col rounded-lg border border-neutral-200 p-[4mm] text-[10px]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[14px] font-semibold">{r.name}</div>
          <div className="text-neutral-500">{r.typeLabel} · {r.total} 个点位{r.sheets.length ? ` · ${r.sheets.join('、')}` : ''}</div>
        </div>
        <div className="text-right">
          <div className={cn('text-[16px] font-semibold tabular-nums', r.score >= 100 ? 'text-emerald-600' : r.score >= 60 ? 'text-neutral-900' : 'text-amber-600')}>{r.score}%</div>
          <div className="text-[9px] text-neutral-500">配置完整度</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {r.devices.map((x) => (
          <span key={x.deviceType} className="inline-flex items-center gap-1 rounded border border-neutral-200 px-1 py-0.5">
            <PointMarker type={x.deviceType} className="size-3.5" />{deviceTypeOf(x.deviceType)?.name}<span className="text-neutral-500 tabular-nums">×{x.count}</span>
          </span>
        ))}
      </div>
      {ctx.t === 'construction' ? (
        <p className="mt-2 leading-relaxed text-neutral-600"><span className="font-medium text-neutral-900">点位：</span>{r.points.map((p) => p.code).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).join('、')}</p>
      ) : null}
      <div className="mt-2 space-y-1">
        {r.met.map((m) => <p key={m.label} className="flex gap-1"><Check className="size-3 shrink-0 text-emerald-600" /><span><span className="font-medium">{m.label}</span><span className="text-neutral-500">：{m.reason}</span></span></p>)}
        {core.map((m) => <p key={m.label} className="flex gap-1 text-amber-700"><Plus className="size-3 shrink-0" /><span>建议补充{m.label}（{LEVEL_LABEL[m.level]}）：{m.reason}</span></p>)}
        {r.warnings.filter((w) => !w.includes('还没有放置')).map((w) => <p key={w} className="flex gap-1 text-amber-700"><AlertTriangle className="size-3 shrink-0" />{w}</p>)}
      </div>
      {r.scenes.length && ctx.t !== 'construction' ? (
        <div className="mt-auto space-y-0.5 border-t border-neutral-100 pt-2">
          {r.scenes.map((s) => <p key={s} className="flex gap-1 text-neutral-600"><Lightbulb className="size-3 shrink-0 text-amber-500" />{s}</p>)}
        </div>
      ) : null}
      {ctx.showPrice ? <div className="mt-2 text-right text-neutral-500">本区域设备 <span className="font-semibold text-neutral-900 tabular-nums">{yuan(r.subtotal)}</span></div> : null}
    </div>
  )
}

function ProductsPage({ ctx, no, rows, title }: { ctx: Ctx; no: number; rows: ProposalData['products']; title: string }) {
  return (
    <Page ctx={ctx} no={no} title={title}>
      <div className="grid grid-cols-4 grid-rows-3 gap-[4mm]">
        {rows.map((r) => (
          <div key={r.product.id} className="flex gap-[3mm] rounded-lg border border-neutral-200 p-[3mm] text-[10px]">
            <ProductThumb src={r.product.image?.url} alt={r.product.name} className="size-[24mm]" />
            <div className="flex min-w-0 flex-1 flex-col">
              <BrandLogo name={r.product.brand?.name ?? ''} logo={r.product.brand?.logo ?? null} className="h-3 max-w-14" />
              <div className="mt-1 line-clamp-2 font-medium leading-snug">{r.product.name}</div>
              <div className="truncate text-[9px] text-neutral-500">{r.product.sku}</div>
              <div className="mt-auto flex items-baseline justify-between">
                <span className="flex items-center gap-1 text-neutral-500"><span className="size-1.5 rounded-full" style={{ backgroundColor: categoryOfType(r.deviceType)?.color }} />{deviceTypeOf(r.deviceType)?.name} ×{r.count}</span>
                {ctx.showPrice ? <span className="font-semibold tabular-nums">{yuan(r.subtotal).replace('.00', '')}</span> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Page>
  )
}

function SchedulePage({ ctx, no, rows, title }: { ctx: Ctx; no: number; rows: ProposalData['points']; title: string }) {
  const { d } = ctx
  const area = new Map(d.areas.map((a) => [a.id, a.name]))
  const sheet = new Map(d.sheets.map((s) => [s.id, s.name]))
  return (
    <Page ctx={ctx} no={no} title={title}>
      <table className="w-full border-collapse text-[9.5px]">
        <thead><tr className="border-y border-neutral-300 bg-neutral-50 text-left"><th className="py-1 pl-2">代号</th><th>设备</th><th>房间</th><th>图纸</th><th>型号</th><th className="pr-2 text-right">完成</th></tr></thead>
        <tbody>
          {rows.map((p) => {
            const product = p.productId ? d.productById.get(p.productId) : null
            return (
              <tr key={p.id} className="border-b border-neutral-100">
                <td className="py-[1.1mm] pl-2 font-semibold tabular-nums" style={{ color: categoryOfType(p.deviceType)?.color }}>{p.code}</td>
                <td>{deviceTypeOf(p.deviceType)?.name}</td>
                <td>{p.areaId ? area.get(p.areaId) : '—'}</td>
                <td className="text-neutral-500">{p.sheetId ? sheet.get(p.sheetId) : '—'}</td>
                <td className="max-w-[90mm] truncate text-neutral-600">{product ? `${product.name}（${product.sku}）` : '待选型'}</td>
                <td className="pr-2 text-right text-neutral-300">□</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Page>
  )
}

function BudgetPage({ ctx, no }: { ctx: Ctx; no: number }) {
  const { d } = ctx
  const qr = d.company.qrCode
  return (
    <Page ctx={ctx} no={no} title="预算汇总">
      <div className="grid flex-1 grid-cols-[1.3fr_1fr] gap-[10mm]">
        <table className="h-fit w-full border-collapse text-[11px]">
          <thead><tr className="border-y border-neutral-300 bg-neutral-50 text-left"><th className="py-2 pl-2">类别</th><th className="text-right">点位</th><th className="pr-2 text-right">金额</th></tr></thead>
          <tbody>
            {d.categories.map((c) => (
              <tr key={c.slug} className="border-b border-neutral-100"><td className="py-1.5 pl-2"><span className="mr-2 inline-block size-2 rounded-full" style={{ backgroundColor: c.color }} />{c.name}</td><td className="text-right tabular-nums">{c.count}</td><td className="pr-2 text-right tabular-nums">{yuan(c.amount)}</td></tr>
            ))}
            <tr className="border-t border-neutral-400"><td className="py-2 pl-2 font-semibold">设备合计</td><td className="text-right tabular-nums">{d.points.length}</td><td className="pr-2 text-right text-[15px] font-semibold tabular-nums">{yuan(d.total)}</td></tr>
          </tbody>
        </table>
        <div className="flex flex-col gap-4 text-[11px]">
          <div className="rounded-lg bg-neutral-50 p-4">
            <div className="text-neutral-500">方案设备预算</div>
            <div className="mt-1 text-[26px] font-semibold tabular-nums">{yuan(d.total)}</div>
            <p className="mt-2 text-neutral-500">按当前选型的产品售价计算，不含安装调试、辅材等费用。{d.pending ? `另有 ${d.pending} 个点位待选型。` : ''}</p>
            {d.quote ? <p className="mt-2">正式报价：{d.quote.title} · <span className="font-semibold tabular-nums">{yuan(d.quote.total)}</span></p> : null}
          </div>
          <div className="mt-auto flex items-end justify-between gap-4 border-t border-neutral-200 pt-3">
            <div className="space-y-0.5 text-neutral-600">
              <div className="font-medium text-neutral-900">{d.company.name}</div>
              {d.company.phone ? <div>电话：{d.company.phone}</div> : null}
              {d.company.address ? <div>地址：{d.company.address}</div> : null}
              {d.owner ? <div>设计师：{d.owner.name}{d.owner.phone ? ` ${d.owner.phone}` : ''}</div> : null}
            </div>
            {qr ? <Image src={qr.url} alt={qr.alt} width={80} height={80} className="size-20 object-contain" unoptimized /> : null}
          </div>
        </div>
      </div>
    </Page>
  )
}

/** 生成经典方案的各页。roomInsights 关闭时不出「区域智能分析」页。 */
export function classicDeckPages(d: ProposalData, t: Exclude<ProposalTemplate, 'qixu'>, markers: 'symbol' | 'product', roomInsights: boolean, date: string) {
  const ctx: Ctx = { d, t, markers, showPrice: t !== 'construction', date }
  const scope = d.scope
  const pages: ((no: number) => React.ReactNode)[] = []
  pages.push(() => <Cover ctx={ctx} />)
  if (scope === 'all') pages.push((no) => <Overview ctx={ctx} no={no} />)
  for (const s of d.sheets) if (scope === 'all' || d.points.some((p) => p.sheetId === s.id)) pages.push((no) => <PlanPage ctx={ctx} no={no} sheetId={s.id} />)
  const roomGroups = roomInsights && scope === 'all' ? chunk(d.rooms, 3) : []
  for (const [i, group] of roomGroups.entries())
    pages.push((no) => (
      <Page ctx={ctx} no={no} title={`区域智能分析${roomGroups.length > 1 ? `（${i + 1}）` : ''}`}>
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-[5mm]">{group.map((r) => <RoomCard key={r.areaId} r={r} ctx={ctx} />)}</div>
      </Page>
    ))
  const productPages = chunk(d.products, 12)
  for (const [i, rows] of productPages.entries()) pages.push((no) => <ProductsPage ctx={ctx} no={no} rows={rows} title={`设备清单${productPages.length > 1 ? `（${i + 1}/${productPages.length}）` : ''}`} />)
  if (t === 'construction') {
    const sorted = d.points.slice().sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }))
    const sch = chunk(sorted, 26)
    for (const [i, rows] of sch.entries()) pages.push((no) => <SchedulePage ctx={ctx} no={no} rows={rows} title={`点位清单（${i + 1}/${sch.length}）`} />)
  } else pages.push((no) => <BudgetPage ctx={ctx} no={no} />)
  return pages
}
