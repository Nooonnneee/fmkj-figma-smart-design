'use client'

import { useState } from 'react'

import { PointMarker } from '@/components/point-marker'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DocFacts, DocHeader, DocRoot, DocSignatures, DocTitle, docTable } from '@/documents/parts'
import { docVars } from '@/documents/theme'
import type { DocLayout, DocStyle } from '@/documents/types'
import type { CompanyInfo } from '@/lib/cached-data'
import type { LandingShowcase, ShowcaseQuote } from '@/lib/landing-showcase'
import { yuan } from '@/lib/quotes'
import { cn } from '@/lib/utils'

import { money } from './section'

/**
 * 报价单：用真实的文档模板部件渲染示例项目已确认的报价，切换风格即时换装。
 * 默认「简约」：它走站点自托管的字体链，不额外下载字体；其他风格（如栖序雅致的思源黑体可变字体，十几 MB）
 * 只在访客点选时才加载。
 */
export function QuoteShowcase({
  data,
  quote,
  styles,
  layouts,
  company,
}: {
  data: LandingShowcase
  quote: ShowcaseQuote
  styles: DocStyle[]
  layouts: DocLayout[]
  company: CompanyInfo
}) {
  const [value, setValue] = useState(() => (styles.some((s) => s.id === 'minimal') ? 'minimal' : (styles[0]?.id ?? '')))
  const active = styles.find((s) => s.id === value) ?? styles[0]!
  return (
    <Tabs value={value} onValueChange={setValue} className="grid gap-12 lg:grid-cols-12 lg:gap-16">
      <div className="lg:sticky lg:top-28 lg:col-span-5 lg:self-start xl:col-span-4">
        <h2 id="quote-title" className="text-headline font-medium">
          报价单，
          <br />
          直接交给客户
        </h2>
        <p className="mt-5 text-lead text-muted-foreground">同一份报价，{styles.length} 套风格一键换装。产品小计、服务费和优惠自动核算，换型号后金额即时更新。</p>
        <TabsList aria-label="报价单风格" className="mt-8 grid h-auto w-full grid-cols-2 gap-1 p-1 group-data-horizontal/tabs:h-auto">
          {styles.map((s) => (
            <TabsTrigger key={s.id} value={s.id} aria-controls="quote-preview" className="h-9 justify-start gap-2.5 px-3 font-normal data-[state=active]:font-medium data-[state=active]:shadow-sm">
              <span aria-hidden style={docVars(s)} className="size-2.5 rounded-full bg-doc-accent ring-1 ring-foreground/15 dark:ring-foreground/40" />
              {s.name}
            </TabsTrigger>
          ))}
        </TabsList>
        <dl className="mt-8 divide-y divide-border border-y border-border text-sm">
          {[
            ['版式', layouts.map((l) => l.label).join('、')],
            ['导出', 'A4 打印、另存 PDF 或导出长图，带公司 Logo、联系方式与二维码'],
            ['下一步', '客户确认后一键生成合同，金额与付款节点自动带入'],
          ].map(([k, v]) => (
            <div key={k} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-4 py-3.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="leading-relaxed">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="min-w-0 rounded-2xl bg-muted/60 p-3 sm:p-8 lg:col-span-7 lg:p-10 xl:col-span-8">
        {/* 只渲染当前风格的样张；各风格页签都指向这一块 */}
        <div id="quote-preview" role="img" aria-label={`报价单样张（${active.name}风格）：${quote.title}，合计 ${money(quote.total)}`}>
          <QuoteSheet style={active} quote={quote} data={data} company={company} />
        </div>
      </div>
    </Tabs>
  )
}

function QuoteSheet({ style, quote, data, company }: { style: DocStyle; quote: ShowcaseQuote; data: LandingShowcase; company: CompanyInfo }) {
  const t = docTable(style)
  // 手机上只列前几行，其余折成一行说明，避免样张拉得过长
  const mobileRows = 6
  const folded = quote.lines.length - mobileRows
  return (
    <DocRoot style={style} className="mx-auto max-w-3xl overflow-hidden rounded-md shadow-sm ring-1 ring-foreground/10">
      <div className="bg-doc-paper p-4 text-xs leading-relaxed sm:p-8">
        <DocHeader style={style} company={company} meta="报价单" />
        <div className="mt-6">
          <DocTitle style={style} no="01" title={quote.title} subtitle={`${data.sheets.length} 层 · ${data.pointCount} 个点位`} tag="QUOTATION" />
        </div>
        <DocFacts
          cols={2}
          className="mt-5 border-y border-doc-rule py-3"
          items={[
            ['客户', data.project.customer || '—'],
            ['项目', [data.project.community, data.project.address].filter(Boolean).join(' ') || data.project.name],
            ['主平台', data.project.platform || '—'],
            ['有效期', '30 天'],
          ]}
        />
        <table className="mt-5 w-full border-collapse">
          <thead>
            <tr className={t.head}>
              <th className={cn(t.th, 'hidden w-8 sm:table-cell')}>#</th>
              <th className={t.th}>设备</th>
              <th className={cn(t.th, 'hidden md:table-cell')}>型号</th>
              <th className={cn(t.th, 'text-right')}>单价</th>
              <th className={cn(t.th, 'text-right')}>数量</th>
              <th className={cn(t.th, 'text-right')}>小计</th>
            </tr>
          </thead>
          <tbody>
            {quote.lines.map((item, i) => (
              <tr key={`${item.sku}-${i}`} className={cn(t.row(i), i >= mobileRows && 'max-sm:hidden')}>
                <td className={cn(t.td, 'hidden py-2 text-doc-muted tabular-nums sm:table-cell')}>{i + 1}</td>
                <td className={cn(t.td, 'py-2')}>
                  <span className="flex items-center gap-2">
                    <PointMarker type={item.type} className="size-4" />
                    {item.name}
                  </span>
                </td>
                <td className={cn(t.td, 'hidden py-2 text-doc-muted md:table-cell')}>{item.sku}</td>
                <td className={cn(t.td, 'py-2 text-right whitespace-nowrap tabular-nums')}>{yuan(item.price)}</td>
                <td className={cn(t.td, 'py-2 text-right whitespace-nowrap tabular-nums')}>
                  {item.qty} {item.unit}
                </td>
                <td className={cn(t.td, 'py-2 text-right whitespace-nowrap tabular-nums')}>{yuan(item.price * item.qty)}</td>
              </tr>
            ))}
            {folded > 0 ? (
              <tr className="sm:hidden">
                <td colSpan={4} className={cn(t.td, 'py-2 text-center text-doc-muted')}>
                  …… 另有 {folded} 行设备
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <div className="mt-4 ml-auto w-full max-w-72 space-y-1">
          <SumRow label="产品小计" value={yuan(quote.productTotal)} />
          {quote.fees.map((fee) => (
            <SumRow key={fee.name} label={fee.name} value={yuan(fee.amount)} />
          ))}
          {quote.discount ? <SumRow label="优惠" value={`-${yuan(quote.discount)}`} /> : null}
          <div className="flex items-baseline justify-between border-t border-doc-ink/30 pt-2">
            <span className="doc-strong">合计</span>
            <span className="doc-numeral text-xl text-doc-accent">{yuan(quote.total)}</span>
          </div>
        </div>
        <DocSignatures className="mt-8" parties={[{ label: '客户确认签字' }, { label: `${company.name} 盖章` }]} />
      </div>
    </DocRoot>
  )
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-doc-muted">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
