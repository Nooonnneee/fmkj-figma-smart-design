/**
 * 方案演示插件：「栖序提案」——来自 Figma 设计稿（08 服务交付 · 付款与确认）的整套横版方案。
 * 页面按设计稿原尺寸 1440px 宽排版（A4 横向比例 1440 × 1018），打印时整页缩放到 A4。
 * 颜色和字体来自「栖序雅致」风格变量：暖白纸 #f8f7f4、灰紫 #7773b8、Inter Light 大编号、Noto Sans SC。
 */
import Image from 'next/image'
import { AlertTriangle, Check } from 'lucide-react'

import { PlanFigure } from '@/components/plan-figure'
import { PointMarker } from '@/components/point-marker'
import { ProductThumb } from '@/components/product-thumb'
import { brandLatin, DocCheckbox } from '@/documents/parts'
import { paymentAmounts } from '@/lib/contracts'
import { categoryOfType, deviceTypeOf, DEVICE_TYPE_ORDER } from '@/lib/device-types'
import { acceptanceChecks, docNumber, sceneNames, type ProjectDocsData } from '@/lib/project-docs'
import { yuan } from '@/lib/quotes'
import { cn } from '@/lib/utils'

type Ctx = { d: ProjectDocsData; markers: 'symbol' | 'product'; date: string; docNo: string }

const pad = (n: number) => String(n).padStart(2, '0')
const money = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const chunk = <T,>(list: T[], n: number) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n))

/** 没有合同时的付款节点（设计稿原文）。 */
const SERVICE_NODES = [
  { name: '方案及合同确认后 / 备货前', percent: 40 },
  { name: '设备到场核验后 / 安装前', percent: 50 },
  { name: '联调验收、资料移交后', percent: 10 },
]

/** 页眉：品牌标记 + 名称，右侧英文副标。 */
function Header({ d }: { d: ProjectDocsData }) {
  const logo = d.company.logo
  const tagline = [brandLatin(d.company.name), 'RESIDENTIAL INTELLIGENCE'].filter(Boolean).join('  /  ')
  return (
    <div className="flex h-[32px] w-full shrink-0 items-center justify-between overflow-hidden">
      <div className="flex shrink-0 items-center gap-[10px] overflow-hidden">
        {logo ? (
          <Image src={logo.url} alt={logo.alt || d.company.name} width={logo.width ?? 96} height={logo.height ?? 96} className="h-[22px] w-auto object-contain" unoptimized />
        ) : (
          <span aria-hidden className="size-[22px] shrink-0 bg-linear-to-r from-doc-soft to-doc-soft-to" />
        )}
        <p className="doc-display text-[17px] leading-normal whitespace-nowrap text-doc-ink">{d.company.name}</p>
      </div>
      <p className="doc-latin text-[11px] leading-normal whitespace-pre text-doc-muted">{tagline}</p>
    </div>
  )
}

/** 章节标题：细体大编号 + 标题与说明 + 英文标签。 */
function Chapter({ no, title, subtitle, tag }: { no: number; title: string; subtitle: string; tag: string }) {
  return (
    <div className="flex h-[92px] w-full shrink-0 items-end gap-[24px] overflow-hidden">
      <p className="doc-numeral text-[68px] leading-normal whitespace-nowrap text-doc-accent">{pad(no)}</p>
      <div className="flex min-w-px flex-1 flex-col gap-[6px] overflow-hidden">
        <p className="doc-display w-full truncate text-[40px] leading-[1.25] text-doc-ink">{title}</p>
        <p className="doc-body w-full truncate text-[14px] leading-normal text-doc-muted">{subtitle}</p>
      </div>
      <p className="doc-latin text-[11px] leading-normal whitespace-nowrap text-doc-muted">{tag}</p>
    </div>
  )
}

/** 分节标题：粗体标题 + 灰紫旁注。 */
function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex w-full items-center justify-between overflow-hidden leading-normal whitespace-nowrap">
      <p className="doc-display text-[23px] text-doc-ink">{title}</p>
      {note ? <p className="doc-body text-[13px] text-doc-accent">{note}</p> : null}
    </div>
  )
}

/** 顶部灰紫细线的阶段块（服务流程、摘要数字、房间块共用）。 */
function Step({ no, title, note, className, children }: { no?: string; title: string; note?: string; className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn('flex min-w-px flex-1 flex-col gap-[8px] overflow-hidden border-t-2 border-doc-accent pt-[12px]', className)}>
      <div className="flex items-center gap-[12px] leading-normal whitespace-nowrap">
        {no ? <p className="doc-latin text-[22px] text-doc-accent">{no}</p> : null}
        <p className="doc-strong truncate text-[20px] text-doc-ink">{title}</p>
      </div>
      {note ? <p className="doc-body text-[13px] leading-[1.65] text-doc-muted">{note}</p> : null}
      {children}
    </div>
  )
}

function Footer({ ctx, no, total }: { ctx: Ctx; no: number; total: number }) {
  const { d } = ctx
  const place = [[d.project.community, d.project.address].filter(Boolean).join(''), d.project.customerName].filter(Boolean).join(' / ')
  const left = [place || d.project.name, `${d.project.platform && d.project.platform !== '待定' ? `${d.project.platform} · ` : ''}全屋智能方案`].join('　 ·　 ')
  return (
    <div className="absolute inset-x-[56px] bottom-[26px] flex flex-col gap-[12px] overflow-hidden">
      <div className="h-px w-full bg-doc-rule" />
      <div className="flex w-full items-start justify-between overflow-hidden leading-normal">
        <p className="doc-body text-[11px] whitespace-pre text-doc-muted">{left}</p>
        <p className="doc-latin text-[11px] whitespace-pre text-doc-muted">{`${ctx.docNo}  /  V1.0  /  ${ctx.date}`}</p>
        <p className="doc-latin text-[12px] whitespace-nowrap text-doc-ink">{`${pad(no)} / ${pad(total)}`}</p>
      </div>
    </div>
  )
}

function Page({ ctx, no, total, children }: { ctx: Ctx; no: number; total: number; children: React.ReactNode }) {
  return (
    <section
      data-export-page
      className="relative mx-auto flex h-[1018px] w-[1440px] flex-col items-start gap-[24px] overflow-hidden bg-doc-paper px-[56px] pt-[36px] pb-[72px] shadow-sm break-after-page print:shadow-none print:[zoom:0.7795]"
    >
      <Header d={ctx.d} />
      {children}
      <Footer ctx={ctx} no={no} total={total} />
    </section>
  )
}

/** 明细表：深灰表头 + 暖白 / 浅灰交替行（来自设计稿「付款节点」）。 */
function Table({ columns, rows }: { columns: { label: string; className: string }[]; rows: React.ReactNode[][] }) {
  return (
    <div className="flex w-full flex-col items-start overflow-hidden">
      <div className="doc-strong flex h-[38px] w-full items-center overflow-hidden bg-doc-head text-[12px] leading-normal text-doc-head-fg">
        {columns.map((c) => (
          <p key={c.label} className={cn('shrink-0 pl-[12px]', c.className)}>{c.label}</p>
        ))}
      </div>
      {rows.map((cells, i) => (
        <div key={i} className={cn('flex min-h-[50px] w-full items-center overflow-hidden border-b border-doc-rule text-[14px] leading-[1.4]', i % 2 ? 'bg-doc-stripe' : 'bg-doc-paper')}>
          {cells.map((cell, j) => (
            <div key={j} className={cn('shrink-0 py-[8px] pl-[12px]', columns[j].className)}>{cell}</div>
          ))}
        </div>
      ))}
    </div>
  )
}

function Cover({ ctx, no, total }: { ctx: Ctx; no: number; total: number }) {
  const { d } = ctx
  const brands = new Set(d.products.map((r) => r.product.brand?.name).filter(Boolean)).size
  const main = d.sheets.slice().sort((a, b) => d.points.filter((p) => p.sheetId === b.id).length - d.points.filter((p) => p.sheetId === a.id).length)[0]
  const facts: [string, string][] = [
    ['客户', d.project.customerName || '—'],
    ['地址', [d.project.community, d.project.address].filter(Boolean).join(' ') || '—'],
    ['主平台', d.project.platform ?? '待定'],
    ['设计师', [d.owner?.name, d.owner?.phone].filter(Boolean).join(' ') || '—'],
    ['日期', ctx.date],
  ]
  return (
    <Page ctx={ctx} no={no} total={total}>
      <Chapter no={no} title={d.project.name} subtitle={`全屋智能设计方案 / ${d.points.length} 个点位，${d.rooms.length} 个房间`} tag="SMART HOME PROPOSAL" />
      <div className="flex h-[106px] w-full shrink-0 items-start gap-[28px] overflow-hidden">
        <Step no={String(d.points.length)} title="智能点位" note={`覆盖 ${d.rooms.length} 个房间、${d.sheets.length} 张图纸`} />
        <Step no={String(d.products.length)} title="设备型号" note={brands ? `来自 ${brands} 个品牌` : '按项目默认型号'} />
        <Step no={String(d.categories.length)} title="设备类别" note={d.categories.slice(0, 4).map((c) => c.name).join('、') || '—'} />
        <Step no={yuan(d.total).replace('.00', '')} title="方案预算" note={d.pending ? `另有 ${d.pending} 个点位待选型` : '按当前选型的产品售价'} />
      </div>
      <div className="flex min-h-0 w-full flex-1 items-start gap-[40px] overflow-hidden">
        <div className="flex w-[600px] shrink-0 flex-col gap-[15px] overflow-hidden">
          <SectionTitle title="项目信息" note="以现场勘测为准" />
          <dl className="flex flex-col">
            {facts.map(([k, v]) => (
              <div key={k} className="flex items-baseline gap-[24px] border-b border-doc-rule py-[11px] text-[15px] leading-[1.65]">
                <dt className="doc-body w-[72px] shrink-0 text-[13px] text-doc-muted">{k}</dt>
                <dd className="doc-body min-w-0 truncate text-doc-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-[6px] overflow-hidden bg-linear-to-r from-doc-soft to-doc-soft-to p-[18px] text-doc-ink">
            <p className="doc-strong text-[16px] leading-[1.65]">{d.company.name}</p>
            <p className="doc-body text-[13px] leading-[1.65] whitespace-pre-wrap">
              {[d.company.slogan, [d.company.phone && `电话 ${d.company.phone}`, d.company.address].filter(Boolean).join('　 ')].filter(Boolean).join('\n') || '全屋智能方案 · 设计 · 安装 · 售后'}
            </p>
          </div>
        </div>
        <div className="flex h-full w-[688px] shrink-0 flex-col gap-[18px] overflow-hidden">
          <SectionTitle title={main ? main.name : '户型图'} note={main ? `${d.points.filter((p) => p.sheetId === main.id).length} 个点位` : '尚未上传图纸'} />
          <div className="flex min-h-0 flex-1 items-center justify-center border border-doc-rule bg-white p-[16px]">
            {main ? (
              <PlanFigure
                sheetUrl={main.url}
                points={d.points.filter((p) => p.sheetId === main.id).map((p) => ({ ...p, image: p.productId ? d.productById.get(p.productId)?.image?.url : null }))}
                mode={ctx.markers}
                showCodes={false}
                showAreas={false}
                className="max-h-full w-full"
              />
            ) : (
              <p className="doc-body text-[13px] text-doc-muted">在点位图里上传户型图后，这里显示主楼层的点位布置。</p>
            )}
          </div>
        </div>
      </div>
    </Page>
  )
}

function Overview({ ctx, no, total }: { ctx: Ctx; no: number; total: number }) {
  const { d } = ctx
  const max = Math.max(...d.categories.map((c) => c.count), 1)
  return (
    <Page ctx={ctx} no={no} total={total}>
      <Chapter no={no} title="每一个点位，都有明确的用途。" subtitle="设备构成与方案亮点 / 按类别核对数量和预算" tag="OVERVIEW" />
      <div className="flex w-full items-start gap-[40px] overflow-hidden">
        <div className="flex w-[600px] shrink-0 flex-col gap-[15px] overflow-hidden">
          <SectionTitle title="设备构成" note={`共 ${d.points.length} 个点位 / ${yuan(d.total)}`} />
          <div className="flex flex-col">
            {d.categories.map((c) => (
              <div key={c.slug} className="grid grid-cols-[96px_1fr_48px_120px] items-center gap-[16px] border-b border-doc-rule py-[12px] text-[15px] leading-[1.4]">
                <span className="doc-body flex items-center gap-[8px] text-doc-ink">
                  <span className="size-[8px] shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </span>
                <span className="h-[6px] bg-doc-stripe">
                  <span className="block h-full" style={{ width: `${(c.count / max) * 100}%`, backgroundColor: c.color }} />
                </span>
                <span className="doc-latin text-right text-doc-ink">{c.count}</span>
                <span className="doc-latin text-right text-[13px] text-doc-muted">{money(c.amount)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex w-[688px] shrink-0 flex-col gap-[15px] overflow-hidden">
          <SectionTitle title="方案亮点" note="依据户型图设计" />
          <div className="flex flex-col gap-[13px] text-[15px] leading-[1.65] text-doc-ink">
            {d.analysis.highlights.slice(0, 6).map((h) => (
              <p key={h} className="doc-body flex gap-[10px]">
                <Check className="mt-[5px] size-[16px] shrink-0 text-doc-accent" />
                {h}
              </p>
            ))}
          </div>
          {d.pending || d.analysis.warnings.length ? (
            <>
              <div className="h-px w-full bg-doc-rule" />
              <div className="flex flex-col gap-[8px] text-[13px] leading-[1.65] text-doc-muted">
                {d.pending ? (
                  <p className="doc-body flex gap-[8px]">
                    <AlertTriangle className="mt-[3px] size-[14px] shrink-0 text-warning" />
                    {d.pending} 个点位暂未选型，未计入预算
                  </p>
                ) : null}
                {d.analysis.warnings.slice(0, 4).map((w) => (
                  <p key={w} className="doc-body flex gap-[8px]">
                    <AlertTriangle className="mt-[3px] size-[14px] shrink-0 text-warning" />
                    {w}
                  </p>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </Page>
  )
}

function PlanPage({ ctx, no, total, sheetId }: { ctx: Ctx; no: number; total: number; sheetId: string }) {
  const { d, markers } = ctx
  const sheet = d.sheets.find((s) => s.id === sheetId)!
  const pts = d.points.filter((p) => p.sheetId === sheetId)
  const areas = d.areas
    .filter((a) => a.sheetId === sheetId)
    .map((a) => ({ id: a.id, name: a.name, x0: (a.x - sheet.x) / sheet.width, y0: (a.y - sheet.y) / sheet.height, x1: (a.x + a.width - sheet.x) / sheet.width, y1: (a.y + a.height - sheet.y) / sheet.height }))
  const types = DEVICE_TYPE_ORDER.filter((t) => pts.some((p) => p.deviceType === t))
  return (
    <Page ctx={ctx} no={no} total={total}>
      <Chapter no={no} title={sheet.name} subtitle={`点位布置 / ${pts.length} 个点位，${new Set(pts.map((p) => p.areaId).filter(Boolean)).size} 个房间`} tag="FLOOR PLAN" />
      <div className="flex min-h-0 w-full flex-1 items-stretch gap-[40px] overflow-hidden">
        <div className="flex min-w-0 flex-1 items-center justify-center border border-doc-rule bg-white p-[16px]">
          <PlanFigure
            sheetUrl={sheet.url}
            points={pts.map((p) => ({ ...p, image: p.productId ? d.productById.get(p.productId)?.image?.url : null }))}
            areas={areas}
            mode={markers}
            className="max-h-full w-full"
          />
        </div>
        <div className="flex w-[380px] shrink-0 flex-col gap-[15px] overflow-hidden">
          <SectionTitle title="图例" note={`${types.length} 类设备`} />
          <Table
            columns={[{ label: '设备', className: 'w-[260px]' }, { label: '数量', className: 'w-[120px]' }]}
            rows={types.slice(0, 11).map((t) => {
              const list = pts.filter((p) => p.deviceType === t)
              const product = list[0]?.productId ? d.productById.get(list[0].productId) : null
              return [
                <span key="n" className="flex items-center gap-[10px]">
                  {markers === 'product' && product?.image ? <ProductThumb src={product.image.url} alt={product.name} className="size-[28px] rounded-full" /> : <PointMarker type={t} className="size-[24px]" />}
                  <span className="min-w-0">
                    <span className="doc-strong block text-[14px] text-doc-ink">{deviceTypeOf(t)?.name}</span>
                    <span className="doc-body block truncate text-[11px] text-doc-muted">{product ? product.name : '待选型'}</span>
                  </span>
                </span>,
                <span key="c" className="doc-latin text-doc-accent">× {list.length}</span>,
              ]
            })}
          />
          {types.length > 11 ? <p className="doc-body text-[12px] text-doc-muted">另有 {types.length - 11} 类设备，见设备清单。</p> : null}
        </div>
      </div>
    </Page>
  )
}

function RoomsPage({ ctx, no, total, rooms, part }: { ctx: Ctx; no: number; total: number; rooms: ProjectDocsData['rooms']; part: string }) {
  return (
    <Page ctx={ctx} no={no} total={total}>
      <Chapter no={no} title={`房间配置${part}`} subtitle="按房间核对设备、补充建议与场景 / 配置完整度供参考" tag="ROOMS" />
      <div className="grid w-full grid-cols-3 gap-x-[28px] gap-y-[24px] overflow-hidden">
        {rooms.map((r) => {
          const core = r.missing.filter((m) => m.level !== 'optional')
          return (
            <Step key={r.areaId} title={r.name} note={`${r.typeLabel} · ${r.total} 个点位 · 完整度 ${r.score}%`} className="h-[330px] flex-none">
              <div className="flex flex-wrap gap-[6px]">
                {r.devices.map((x) => (
                  <span key={x.deviceType} className="doc-body inline-flex items-center gap-[4px] border border-doc-rule px-[6px] py-[2px] text-[12px] text-doc-ink">
                    <PointMarker type={x.deviceType} className="size-[14px]" />
                    {deviceTypeOf(x.deviceType)?.name}
                    <span className="doc-latin text-doc-muted">×{x.count}</span>
                  </span>
                ))}
              </div>
              <div className="doc-body flex flex-col gap-[4px] text-[13px] leading-[1.65]">
                {core.slice(0, 2).map((m) => (
                  <p key={m.label} className="text-doc-ink">
                    <span className="text-doc-accent">建议补充</span> {m.label}：<span className="text-doc-muted">{m.reason}</span>
                  </p>
                ))}
                {r.scenes.slice(0, 2).map((s) => (
                  <p key={s} className="text-doc-muted">{s}</p>
                ))}
              </div>
              <p className="doc-latin mt-auto text-right text-[13px] text-doc-ink">{yuan(r.subtotal)}</p>
            </Step>
          )
        })}
      </div>
    </Page>
  )
}

function EquipmentPage({ ctx, no, total, rows, part }: { ctx: Ctx; no: number; total: number; rows: ProjectDocsData['products']; part: string }) {
  return (
    <Page ctx={ctx} no={no} total={total}>
      <Chapter no={no} title={`设备清单${part}`} subtitle="型号、数量与金额 / 单价按当前产品库售价" tag="EQUIPMENT" />
      <Table
        columns={[
          { label: '设备', className: 'w-[520px]' },
          { label: '型号', className: 'w-[280px]' },
          { label: '数量', className: 'w-[120px]' },
          { label: '单价 / 元', className: 'w-[200px]' },
          { label: '小计 / 元', className: 'w-[208px]' },
        ]}
        rows={rows.map((r) => [
          <span key="p" className="flex items-center gap-[12px]">
            <ProductThumb src={r.product.image?.url} alt={r.product.name} className="size-[34px]" />
            <span className="min-w-0">
              <span className="doc-body block truncate text-doc-ink">{r.product.name}</span>
              <span className="doc-body flex items-center gap-[6px] text-[11px] text-doc-muted">
                <span className="size-[6px] rounded-full" style={{ backgroundColor: categoryOfType(r.deviceType)?.color }} />
                {deviceTypeOf(r.deviceType)?.name}
                {r.product.brand ? ` · ${r.product.brand.name}` : ''}
              </span>
            </span>
          </span>,
          <span key="s" className="doc-latin block truncate text-[13px] text-doc-muted">{r.product.sku}</span>,
          <span key="c" className="doc-strong text-doc-accent">{r.count}</span>,
          <span key="u" className="doc-latin text-doc-ink">{money(r.product.price)}</span>,
          <span key="t" className="doc-latin text-doc-ink">{money(r.subtotal)}</span>,
        ])}
      />
    </Page>
  )
}

function BudgetPage({ ctx, no, total }: { ctx: Ctx; no: number; total: number }) {
  const { d } = ctx
  return (
    <Page ctx={ctx} no={no} total={total}>
      <Chapter no={no} title="预算清楚，再开始施工。" subtitle="预算汇总 / 按类别核对设备金额" tag="BUDGET" />
      <div className="flex w-full items-start gap-[40px] overflow-hidden">
        <div className="flex w-[688px] shrink-0 flex-col gap-[18px] overflow-hidden">
          <SectionTitle title="分类汇总" note={`${d.categories.length} 类 / ${d.points.length} 个点位`} />
          <Table
            columns={[{ label: '类别', className: 'w-[300px]' }, { label: '点位', className: 'w-[160px]' }, { label: '金额 / 元', className: 'w-[228px]' }]}
            rows={[
              ...d.categories.map((c) => [
                <span key="n" className="doc-body flex items-center gap-[8px] text-doc-ink">
                  <span className="size-[8px] rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </span>,
                <span key="c" className="doc-strong text-doc-accent">{c.count}</span>,
                <span key="a" className="doc-latin text-doc-ink">{money(c.amount)}</span>,
              ]),
              [
                <span key="n" className="doc-strong text-doc-ink">设备合计</span>,
                <span key="c" className="doc-strong text-doc-accent">{d.points.length}</span>,
                <span key="a" className="doc-strong text-doc-ink">{money(d.total)}</span>,
              ],
            ]}
          />
        </div>
        <div className="flex w-[600px] shrink-0 flex-col gap-[15px] overflow-hidden">
          <SectionTitle title="方案设备预算" note="不含安装调试与辅材" />
          <p className="doc-numeral text-[68px] leading-normal text-doc-accent">{yuan(d.total)}</p>
          <p className="doc-body text-[13px] leading-[1.65] text-doc-muted">
            按当前选型的产品售价计算。{d.pending ? `另有 ${d.pending} 个点位待选型，未计入。` : ''}安装调试、布线、辅材等费用以正式报价为准。
          </p>
          {d.quote ? (
            <div className="flex flex-col gap-[6px] border border-doc-rule bg-white p-[22px]">
              <p className="doc-strong text-[16px] text-doc-ink">正式报价</p>
              <p className="doc-body text-[13px] text-doc-muted">{d.quote.title}</p>
              <p className="doc-latin text-[22px] text-doc-ink">{yuan(d.quote.total)}</p>
            </div>
          ) : null}
        </div>
      </div>
    </Page>
  )
}

/** 服务交付 · 付款与确认（设计稿原页）：服务流程、共同验收清单、付款节点、边界确认与签署。 */
function ServicePage({ ctx, no, total }: { ctx: Ctx; no: number; total: number }) {
  const { d } = ctx
  const scenes = sceneNames(d)
  const checks = acceptanceChecks(d)
  const nodes = d.contract?.payments?.length ? d.contract.payments.map((p) => ({ name: p.name, percent: p.percent })) : SERVICE_NODES
  const amount = d.contract?.amount ?? d.quote?.total ?? d.total
  const amounts = paymentAmounts(amount, nodes)
  const blank = '________'
  return (
    <Page ctx={ctx} no={no} total={total}>
      <Chapter no={no} title="从一张方案，到每天安心使用。" subtitle="服务流程、付款与验收 / 让每个承诺，都有可核对的交付物" tag="SERVICE & HANDOVER" />
      <div className="flex h-[106px] w-full shrink-0 items-start gap-[28px] overflow-hidden">
        <Step no="01" title="现场勘测" note="复核户型、供电、网络与安装条件" />
        <Step no="02" title="方案确认" note={scenes.length ? `核对${d.points.length}点、${scenes.length}场景、价格及边界` : `核对${d.points.length}个点位、价格及边界`} />
        <Step no="03" title="安装联调" note="设备到场核验，逐点安装与测试" />
        <Step no="04" title="验收培训" note="共同测试、账号移交与使用培训" />
      </div>
      <div className="flex w-full shrink-0 items-start gap-[40px] overflow-hidden">
        <div className="flex w-[600px] shrink-0 flex-col items-start gap-[15px] overflow-hidden">
          <SectionTitle title="共同验收，逐项打勾" note="现场记录 / 双方签认" />
          <div className="doc-body flex w-full flex-col items-start gap-[13px] text-[15px] leading-[1.65] text-doc-ink">
            {checks.map((c) => (
              <p key={c} className="flex w-full items-start gap-[10px]">
                <DocCheckbox className="mt-[0.4em]" />
                {c}
              </p>
            ))}
          </div>
          <div className="h-px w-full bg-doc-rule" />
          <p className="doc-body w-full text-[13px] leading-[1.65] text-doc-muted">
            验收资料：点位与设备清单、场景规则、实测记录、账号交接及维护说明。设备保修与售后期限以正式合同、厂家条款为准；变更需先书面确认。
          </p>
          <div className="flex w-full flex-col items-start gap-[6px] overflow-hidden bg-linear-to-r from-doc-soft to-doc-soft-to p-[18px] text-doc-ink">
            <p className="doc-strong w-full text-[16px] leading-[1.65]">{d.company.name}</p>
            <div className="doc-body w-full text-[13px] whitespace-pre-wrap">
              <p className="leading-[1.65]">{`项目顾问：${d.owner?.name || blank}　 电话：${d.owner?.phone || d.company.phone || blank}`}</p>
              <p className="leading-[1.65]">{`服务地址 / 微信：${[d.company.address, d.company.qrCaption].filter(Boolean).join(' / ') || '________________________'}`}</p>
            </div>
          </div>
        </div>
        <div className="flex w-[688px] shrink-0 flex-col items-start gap-[18px] overflow-hidden">
          <SectionTitle title="付款节点" note={`合计 ${yuan(amount)} / 比例可替换`} />
          <Table
            columns={[{ label: '比例', className: 'w-[90px]' }, { label: '金额 / 元', className: 'w-[164px]' }, { label: '支付条件', className: 'w-[434px]' }]}
            rows={nodes.map((n, i) => [
              <span key="p" className="doc-strong text-doc-accent">{n.percent}%</span>,
              <span key="a" className="doc-body text-doc-ink">{money(amounts[i])}</span>,
              <span key="c" className="doc-body text-doc-ink">{n.name}</span>,
            ])}
          />
          <div className="flex w-full flex-col items-start gap-[13px] overflow-hidden border border-doc-rule bg-white p-[22px] leading-[1.65]">
            <p className="doc-strong w-full text-[20px] text-doc-ink">方案与实施边界确认</p>
            <p className="doc-body w-full text-[13px] text-doc-muted">
              请核对项目资料、{d.points.length}个点位、设备规格、费用及不含项后签署。此处确认方案与实施边界，不替代施工图审查或竣工验收；现场差异与增减费用须另行书面确认。
            </p>
            <div className="doc-body flex w-full items-start gap-[30px] overflow-hidden pt-[8px]">
              <div className="flex min-w-px flex-1 flex-col items-start gap-[14px] overflow-hidden">
                <p className="w-full text-[13px] text-doc-ink">客户签字：________________</p>
                <p className="w-full text-[12px] text-doc-muted">日期：______年____月____日</p>
              </div>
              <div className="flex min-w-px flex-1 flex-col items-start gap-[14px] overflow-hidden">
                <p className="w-full text-[13px] text-doc-ink">服务商 / 负责人：____________</p>
                <p className="w-full text-[12px] text-doc-muted">日期：______年____月____日</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Page>
  )
}

/** 生成「栖序提案」的全部页面。roomInsights 关闭时不出房间配置页。 */
export function qixuDeckPages(d: ProjectDocsData, markers: 'symbol' | 'product', roomInsights: boolean) {
  const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }).replaceAll('-', '.')
  const docNo = docNumber(d, 'FA')
  const ctx: Ctx = { d, markers, date, docNo }
  const all = d.scope === 'all'
  const pages: ((no: number, total: number) => React.ReactNode)[] = []
  pages.push((no, total) => <Cover ctx={ctx} no={no} total={total} />)
  if (all && d.categories.length) pages.push((no, total) => <Overview ctx={ctx} no={no} total={total} />)
  for (const s of d.sheets) if (all || d.points.some((p) => p.sheetId === s.id)) pages.push((no, total) => <PlanPage ctx={ctx} no={no} total={total} sheetId={s.id} />)
  const roomPages = roomInsights && all ? chunk(d.rooms, 6) : []
  for (const [i, rooms] of roomPages.entries()) pages.push((no, total) => <RoomsPage ctx={ctx} no={no} total={total} rooms={rooms} part={roomPages.length > 1 ? `（${i + 1}）` : ''} />)
  const productPages = chunk(d.products, 12)
  for (const [i, rows] of productPages.entries())
    pages.push((no, total) => <EquipmentPage ctx={ctx} no={no} total={total} rows={rows} part={productPages.length > 1 ? `（${i + 1}/${productPages.length}）` : ''} />)
  if (d.categories.length) pages.push((no, total) => <BudgetPage ctx={ctx} no={no} total={total} />)
  pages.push((no, total) => <ServicePage ctx={ctx} no={no} total={total} />)
  return pages.map((render, i) => <div key={i}>{render(i + 1, pages.length)}</div>)
}
