/**
 * Figma 方案模板公共画布与原子组件（对应 Figma 文件 FGGahF8jZGnRLwcgZfJloK 栖序设计规范）
 * 画布标准尺寸：1440 × 1018（A4 横向黄金比例，打印时自动等比缩放到 A4）
 */
import Image from 'next/image'

import { brandLatin } from '@/documents/parts'
import type { ProjectDocsData } from '@/lib/project-docs'
import { cn } from '@/lib/utils'

export type FigmaTemplateCtx = {
  d: ProjectDocsData
  markers: 'symbol' | 'product'
  date: string
  docNo: string
  /** 方案最终应付总额（优先取当前匹配的正式报价单总额或合同总额，否则取设备合计） */
  finalAmount: number
}

export const pad = (n: number) => String(n).padStart(2, '0')
export const money = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const chunk = <T,>(list: T[], n: number) =>
  Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n))

/** 页眉：品牌标记 + 服务商名称，右侧英文副标（node 8:6730） */
export function FigmaHeader({ d }: { d: ProjectDocsData }) {
  const logo = d.company.logo
  const tagline = [brandLatin(d.company.name) || 'QIXU', 'RESIDENTIAL INTELLIGENCE'].filter(Boolean).join('  /  ')
  return (
    <div className="flex h-[32px] w-full shrink-0 items-center justify-between overflow-hidden" data-name="页眉">
      <div className="flex shrink-0 items-center gap-[10px] overflow-hidden" data-name="服务商品牌">
        {logo ? (
          <Image
            src={logo.url}
            alt={logo.alt || d.company.name}
            width={logo.width ?? 96}
            height={logo.height ?? 96}
            className="h-[22px] w-auto object-contain"
            unoptimized
          />
        ) : (
          <span aria-hidden className="size-[22px] shrink-0 bg-linear-to-r from-doc-soft to-doc-soft-to" />
        )}
        <p className="doc-display text-[17px] leading-normal whitespace-nowrap text-doc-ink">{d.company.name}</p>
      </div>
      <p className="doc-latin text-[11px] leading-normal whitespace-pre text-doc-muted">{tagline}</p>
    </div>
  )
}

/** 章节标题：Inter Light 68px 灰紫大编号 + Noto Sans SC Bold 40px 标题与说明 + 右下角英文标签（node 8:6735） */
export function FigmaChapter({
  no,
  title,
  subtitle,
  tag,
}: {
  no: number
  title: string
  subtitle: string
  tag: string
}) {
  return (
    <div className="flex h-[92px] w-full shrink-0 items-end gap-[24px] overflow-hidden" data-name="章节标题">
      <p className="doc-numeral text-[68px] leading-normal whitespace-nowrap text-doc-accent">{pad(no)}</p>
      <div className="flex min-w-px flex-1 flex-col gap-[6px] overflow-hidden" data-name="标题与说明">
        <p className="doc-display w-full truncate text-[40px] leading-[1.25] text-doc-ink">{title}</p>
        <p className="doc-body w-full truncate text-[14px] leading-normal text-doc-muted">{subtitle}</p>
      </div>
      <p className="doc-latin text-[11px] leading-normal whitespace-nowrap text-doc-muted">{tag}</p>
    </div>
  )
}

/** 分节标题：23px 粗体标题 + 13px 灰紫旁注（node 8:6764） */
export function FigmaSectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex w-full shrink-0 items-center justify-between overflow-hidden leading-normal whitespace-nowrap" data-name="分节标题">
      <p className="doc-display text-[23px] text-doc-ink">{title}</p>
      {note ? <p className="doc-body text-[13px] text-doc-accent">{note}</p> : null}
    </div>
  )
}

/** 顶部 2px 灰紫细线阶段块（node 8:6742） */
export function FigmaStepCard({
  no,
  title,
  badge,
  note,
  className,
  children,
}: {
  no?: string
  title: string
  badge?: React.ReactNode
  note?: string
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex min-w-px flex-1 flex-col gap-[8px] overflow-hidden border-t-2 border-doc-accent pt-[12px]',
        className,
      )}
      data-name="服务阶段"
    >
      <div className="flex items-center justify-between gap-[12px] leading-normal whitespace-nowrap">
        <div className="flex min-w-0 items-center gap-[10px]">
          {no ? <p className="doc-latin shrink-0 text-[22px] text-doc-accent">{no}</p> : null}
          <p className="doc-strong truncate text-[20px] text-doc-ink">{title}</p>
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      {note ? <p className="doc-body text-[13px] leading-[1.55] text-doc-muted">{note}</p> : null}
      {children}
    </div>
  )
}

/** 明细表：深灰表头 #333338 + 暖白 #f8f7f4 / 浅灰 #efeee9 交替斑马纹（node 8:6783） */
export function FigmaTable({
  columns,
  rows,
  rowClassName = 'min-h-[50px] text-[14px]',
}: {
  columns: { label: string; className: string }[]
  rows: React.ReactNode[][]
  rowClassName?: string
}) {
  return (
    <div className="flex w-full flex-col items-start overflow-hidden" data-name="明细表">
      <div className="doc-strong flex h-[38px] w-full shrink-0 items-center overflow-hidden bg-doc-head text-[12px] leading-normal text-doc-head-fg">
        {columns.map((c) => (
          <p key={c.label} className={cn('shrink-0 pl-[12px]', c.className)}>
            {c.label}
          </p>
        ))}
      </div>
      {rows.map((cells, i) => (
        <div
          key={i}
          className={cn(
            'flex w-full items-center overflow-hidden border-b border-doc-rule leading-[1.4]',
            rowClassName,
            i % 2 ? 'bg-doc-stripe' : 'bg-doc-paper',
          )}
        >
          {cells.map((cell, j) => (
            <div key={j} className={cn('shrink-0 py-[6px] pl-[12px]', columns[j].className)}>
              {cell}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** 文档页脚：分隔线 + 项目地址/客户 · 方案类型 | 文档编号/版本/日期 | 页码（node 8:6810） */
export function FigmaFooter({ ctx, no, total }: { ctx: FigmaTemplateCtx; no: number; total: number }) {
  const { d } = ctx
  const addr = [d.project.community, d.project.address].filter(Boolean).join('')
  const place = [addr || d.project.name, d.project.customerName].filter(Boolean).join(' / ')
  const scopeLabel =
    d.scope === 'no-light'
      ? '智能控制方案（不含灯具）'
      : d.scope === 'switch'
        ? '智能开关面板方案'
        : d.scope === 'switch-light'
          ? '智能灯光开关方案'
          : '全屋智能设计方案'
  const left = [place, `${d.project.platform && d.project.platform !== '待定' ? `${d.project.platform} · ` : ''}${scopeLabel}`].join('　 ·　 ')
  return (
    <div className="absolute inset-x-[56px] top-[906px] flex flex-col gap-[12px] overflow-hidden" data-name="文档页脚">
      <div className="h-px w-full bg-doc-rule" />
      <div className="flex w-full items-start justify-between overflow-hidden leading-normal">
        <p className="doc-body text-[11px] whitespace-pre text-doc-muted">{left}</p>
        <p className="doc-latin text-[11px] whitespace-pre text-doc-muted">{`${ctx.docNo}  /  V1.0  /  ${ctx.date}`}</p>
        <p className="doc-latin text-[12px] whitespace-nowrap text-doc-ink">{`${pad(no)} / ${pad(total)}`}</p>
      </div>
    </div>
  )
}

/** Figma 1440×1018 标准画布页容器 */
export function FigmaSlidePage({
  ctx,
  no,
  total,
  frameName,
  children,
}: {
  ctx: FigmaTemplateCtx
  no: number
  total: number
  frameName: string
  children: React.ReactNode
}) {
  return (
    <section
      data-export-page
      data-figma-frame={frameName}
      className="relative mx-auto flex h-[1018px] w-[1440px] flex-col items-start gap-[24px] overflow-hidden bg-doc-paper px-[56px] pt-[36px] pb-[72px] shadow-sm break-after-page print:shadow-none print:[zoom:0.7795]"
    >
      <FigmaHeader d={ctx.d} />
      {children}
      <FigmaFooter ctx={ctx} no={no} total={total} />
    </section>
  )
}
