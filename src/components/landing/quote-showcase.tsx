'use client'

import { useState } from 'react'
import { FileDown, FileSignature, LayoutGrid, Palette, ShieldCheck } from 'lucide-react'

import { PointMarker } from '@/components/point-marker'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DocFacts, DocHeader, DocRoot, DocSignatures, DocTitle, docTable } from '@/documents/parts'
import { docVars } from '@/documents/theme'
import type { DocLayout, DocStyle } from '@/documents/types'
import type { CompanyInfo } from '@/lib/cached-data'
import { yuan } from '@/lib/quotes'
import { cn } from '@/lib/utils'

import { DEMO_QUOTE, DEMO_QUOTE_TOTALS } from './demo-data'
import { SectionEyebrow } from './section-heading'

/** 首页样张用的示例抬头 */
const DEMO_COMPANY: CompanyInfo = {
  name: 'FMKJ 智能家居',
  slogan: '全屋智能方案 · 设计 · 安装 · 售后',
  phone: null,
  email: null,
  address: null,
  qrCaption: null,
  quoteNotes: null,
  contractTerms: null,
  printProductImages: true,
  documentDefaults: {},
  disabledPlugins: [],
  aiModels: [],
  logo: null,
  qrCode: null,
}

/** 报价单展示：用真实的文档模板部件渲染样张，切换风格即时换装。 */
export function QuoteShowcase({ styles, layouts }: { styles: DocStyle[]; layouts: DocLayout[] }) {
  const [value, setValue] = useState(() => (styles.some((s) => s.id === 'qixu') ? 'qixu' : (styles[0]?.id ?? '')))
  const features = [
    { icon: LayoutGrid, text: '按楼层、房间分区报价，客户一眼看懂每个空间花了多少' },
    { icon: Palette, text: `${styles.map((s) => s.name).join('、')}，一键换装` },
    { icon: FileDown, text: '导出 A4 PDF 与图片，打印不跑版' },
    { icon: FileSignature, text: '确认后一键生成合同，金额与付款节点自动带入' },
  ]

  return (
    <section id="quote" aria-labelledby="quote-title" className="relative isolate scroll-mt-20 overflow-hidden py-20 sm:py-28">
      <div aria-hidden className="pointer-events-none absolute top-1/4 right-0 -z-10 size-160 translate-x-1/3 rounded-full bg-chart-4/15 blur-3xl" />
      <Tabs value={value} onValueChange={setValue} className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
        <div className="lg:col-span-5">
          <SectionEyebrow>报价单</SectionEyebrow>
          <h2 id="quote-title" className="mt-5 text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
            一份让客户眼前一亮的报价单
          </h2>
          <p className="mt-5 text-base text-pretty text-muted-foreground sm:text-lg">
            同一份数据，{layouts.length} 种版式、{styles.length} 套风格随心切换。分区明细、产品图文、签字盖章一应俱全，金额由系统自动核算。
          </p>
          <div className="mt-8">
            <p className="text-sm font-medium">换一套风格看看</p>
            <TabsList aria-label="报价单风格" className="mt-3 h-auto flex-wrap justify-start gap-1 p-1 group-data-horizontal/tabs:h-auto">
              {styles.map((s) => (
                <TabsTrigger key={s.id} value={s.id} className="h-8 flex-none rounded-xl px-3">
                  <span aria-hidden style={docVars(s)} className="size-2.5 rounded-full bg-doc-accent ring-1 ring-foreground/25" />
                  {s.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <ul className="mt-8 space-y-3.5">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3 text-sm text-muted-foreground">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-chart-1/15 text-chart-1">
                  <Icon className="size-4" />
                </span>
                <span className="pt-1">{text}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">版式</span>
            {layouts.map((l) => (
              <Badge key={l.value} variant="outline" title={l.description} className="h-7 rounded-full px-3">
                {l.label}
              </Badge>
            ))}
          </div>
        </div>

        <div className="relative isolate lg:col-span-7">
          <div aria-hidden className="absolute inset-x-10 -top-5 bottom-6 -z-10 rotate-3 rounded-2xl border border-border bg-card/50" />
          <div aria-hidden className="absolute inset-x-5 -top-2.5 bottom-3 -z-10 -rotate-2 rounded-2xl border border-border bg-card/70" />
          {styles.map((s) => (
            <TabsContent
              key={s.id}
              value={s.id}
              className="lg:perspective-distant data-[state=active]:animate-in data-[state=active]:duration-500 data-[state=active]:fade-in-0 data-[state=active]:zoom-in-95 motion-reduce:animate-none"
            >
              <div
                role="img"
                aria-label={`报价单样张（${s.name}风格）：${DEMO_QUOTE.title}，合计 ${yuan(DEMO_QUOTE_TOTALS.total)}`}
                className="transition-transform duration-700 ease-out lg:rotate-x-2 lg:-rotate-y-6 lg:hover:rotate-x-0 lg:hover:rotate-y-0 motion-reduce:transform-none"
              >
                <QuoteSheet style={s} />
              </div>
            </TabsContent>
          ))}
          <div
            aria-hidden
            className="absolute -top-4 -left-2 z-10 hidden items-center gap-2 rounded-xl border border-border bg-card/90 px-3 py-2 text-xs shadow-xl backdrop-blur sm:flex motion-safe:animate-float"
          >
            <FileDown className="size-4 text-chart-1" />
            导出 A4 PDF · 打印不跑版
          </div>
          <div
            aria-hidden
            className="absolute -right-2 bottom-16 z-10 hidden items-center gap-2 rounded-xl border border-border bg-card/90 px-3 py-2 text-xs shadow-xl backdrop-blur sm:flex motion-safe:animate-float [--landing-delay:-3.5s]"
          >
            <ShieldCheck className="size-4 text-chart-2" />
            合计自动核算 · 不会算错
          </div>
        </div>
      </Tabs>
    </section>
  )
}

function QuoteSheet({ style }: { style: DocStyle }) {
  const t = docTable(style)
  const q = DEMO_QUOTE
  const totals = DEMO_QUOTE_TOTALS
  return (
    <DocRoot style={style} className="rounded-xl shadow-2xl ring-1 ring-foreground/10">
      <div className="bg-doc-paper p-5 text-xs leading-relaxed sm:p-8">
        <DocHeader style={style} company={DEMO_COMPANY} meta={`报价编号 ${q.number}`} />
        <div className="mt-6">
          <DocTitle style={style} no="01" title={q.title} subtitle={q.subtitle} tag="QUOTATION" />
        </div>
        <DocFacts
          cols={2}
          className="mt-5 border-y border-doc-rule py-3"
          items={[
            ['客户', q.customer],
            ['项目', q.project],
            ['主平台', q.platform],
            ['有效期', '30 天'],
          ]}
        />
        <table className="mt-5 w-full border-collapse">
          <thead>
            <tr className={t.head}>
              <th className={cn(t.th, 'hidden w-8 sm:table-cell')}>#</th>
              <th className={t.th}>设备</th>
              <th className={cn(t.th, 'hidden sm:table-cell')}>型号</th>
              <th className={cn(t.th, 'text-right')}>单价</th>
              <th className={cn(t.th, 'text-right')}>数量</th>
              <th className={cn(t.th, 'text-right')}>小计</th>
            </tr>
          </thead>
          <tbody>
            {q.items.map((item, i) => (
              <tr key={item.sku} className={t.row(i)}>
                <td className={cn(t.td, 'hidden py-2 text-doc-muted tabular-nums sm:table-cell')}>{i + 1}</td>
                <td className={cn(t.td, 'py-2')}>
                  <span className="flex items-center gap-2">
                    <PointMarker type={item.type} className="size-4" />
                    {item.name}
                  </span>
                </td>
                <td className={cn(t.td, 'hidden py-2 text-doc-muted sm:table-cell')}>{item.sku}</td>
                <td className={cn(t.td, 'py-2 text-right whitespace-nowrap tabular-nums')}>{yuan(item.price)}</td>
                <td className={cn(t.td, 'py-2 text-right whitespace-nowrap tabular-nums')}>
                  {item.qty} {item.unit}
                </td>
                <td className={cn(t.td, 'py-2 text-right whitespace-nowrap tabular-nums')}>{yuan(item.price * item.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 ml-auto w-full max-w-60 space-y-1">
          <SumRow label="产品小计" value={yuan(totals.productTotal)} />
          {q.fees.map((fee) => (
            <SumRow key={fee.name} label={fee.name} value={yuan(fee.amount)} />
          ))}
          <SumRow label="优惠" value={`-${yuan(totals.discount)}`} />
          <div className="flex items-baseline justify-between border-t border-doc-ink/30 pt-2">
            <span className="doc-strong">合计</span>
            <span className="doc-numeral text-xl text-doc-accent">{yuan(totals.total)}</span>
          </div>
        </div>
        <DocSignatures className="mt-8" parties={[{ label: '客户确认签字' }, { label: `${DEMO_COMPANY.name} 盖章` }]} />
      </div>
    </DocRoot>
  )
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-doc-muted">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
