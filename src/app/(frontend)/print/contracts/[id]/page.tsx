import { notFound, redirect } from 'next/navigation'

import { PrintToolbar } from '@/components/print-toolbar'
import { DocArticle, DocFooter, DocHeader, DocRoot, DocSectionHeading, DocTitle, docTable } from '@/documents/parts'
import { docToolbarGroups, resolveDocSetup } from '@/documents/registry'
import { appAuth } from '@/lib/app-auth'
import { fmtLongDate, paymentAmounts, rmbUpper } from '@/lib/contracts'
import { getPayloadClient } from '@/lib/payload'
import { yuan } from '@/lib/quotes'
import { cn } from '@/lib/utils'
import type { Project, Quote } from '@/payload-types'

export const metadata = { title: '合同', robots: { index: false, follow: false } }

const NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

/** 打印给客户签字的合同：A4 纵向，正文 + 附件《报价明细》（附件从新的一页开始）。 */
export default async function PrintContractPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ style?: string; layout?: string }> }) {
  const { id } = await params
  const sp = await searchParams
  const user = await appAuth.getCurrentUser()
  if (!user) redirect(`/login?from=/print/contracts/${id}`)
  const payload = await getPayloadClient()
  const [contract, setup] = await Promise.all([
    payload
      .findByID({
        collection: 'contracts',
        id,
        depth: 1,
        user,
        overrideAccess: false,
        populate: {
          projects: { name: true, platform: true },
          quotes: { title: true, items: true, fees: true, discount: true, productTotal: true, feeTotal: true, total: true },
        },
      })
      .catch(() => null),
    resolveDocSetup('contract', sp),
  ])
  if (!contract) notFound()
  const { style, company, layout } = setup
  const project = typeof contract.project === 'object' ? (contract.project as Project) : null
  const quote = typeof contract.quote === 'object' ? (contract.quote as Quote) : null
  const amount = contract.amount ?? 0
  const payments = contract.payments ?? []
  const amounts = paymentAmounts(amount, payments)
  const items = quote?.items ?? []
  const fees = quote?.fees ?? []
  const differs = quote ? Math.abs((quote.total ?? 0) - amount) > 0.001 : false
  const t = docTable(style)
  const withAttachment = layout === 'full' && Boolean(quote)
  const clauses: { title: string; body: React.ReactNode }[] = [
    {
      title: '项目概况',
      body: (
        <div className="space-y-1">
          <p>项目名称：{project?.name ?? '—'}</p>
          <p>施工地址：{contract.address || '—'}</p>
          {project?.platform ? <p>智能平台：{project.platform}</p> : null}
          <p>服务内容：{withAttachment ? '按附件《报价明细》' : '按双方确认的报价'}提供智能家居设备，并负责安装、调试和使用培训。</p>
        </div>
      ),
    },
    {
      title: '合同金额',
      body: (
        <p>
          合同总金额为人民币 <strong className="doc-strong tabular-nums">{yuan(amount)}</strong>（大写：{rmbUpper(amount)}）。
          {differs ? '合同金额与报价合计不一致的，以本条约定的合同金额为准。' : ''}
        </p>
      ),
    },
    {
      title: '付款方式',
      body: payments.length ? (
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className={t.head}>
              <th className={cn(t.th, 'w-12')}>期次</th>
              <th className={t.th}>款项</th>
              <th className={cn(t.th, 'w-20 text-right')}>比例</th>
              <th className={cn(t.th, 'w-32 text-right')}>金额</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p, i) => (
              <tr key={p.id ?? i} className={t.row(i)}>
                <td className={cn(t.td, 'py-1.5 tabular-nums')}>{i + 1}</td>
                <td className={cn(t.td, 'py-1.5')}>{p.name}</td>
                <td className={cn(t.td, 'py-1.5 text-right tabular-nums text-doc-accent')}>{p.percent}%</td>
                <td className={cn(t.td, 'py-1.5 text-right tabular-nums')}>{yuan(amounts[i])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>由双方另行约定。</p>
      ),
    },
    ...(contract.durationDays ? [{ title: '工期', body: <p>自甲方具备安装条件之日起 {contract.durationDays} 天内完成安装调试。</p> }] : []),
    ...(contract.warrantyMonths ? [{ title: '质保', body: <p>设备质保期为 {contract.warrantyMonths} 个月，自验收合格之日起计算。</p> }] : []),
    ...(contract.terms ? [{ title: '其他约定', body: <p className="whitespace-pre-line">{contract.terms}</p> }] : []),
  ]
  const party = (role: string, name: string | null | undefined, lines: (string | null | undefined)[]) => (
    <div className="space-y-1">
      <div className="text-doc-muted">{role}</div>
      <div className="doc-display text-[14px]">{name || '—'}</div>
      {lines.filter(Boolean).map((l) => (
        <div key={l} className="text-doc-muted">{l}</div>
      ))}
    </div>
  )
  const base = `/print/contracts/${id}`
  const href = (patch: { style?: string; layout?: string }) => `${base}?${new URLSearchParams({ style: patch.style ?? style.id, layout: patch.layout ?? layout }).toString()}`

  return (
    <div className="min-h-screen bg-muted/40 pb-8 print:bg-white print:pb-0">
      <PrintToolbar
        back={{ href: project ? `/projects/${project.id}/contract` : '/projects', label: '返回合同' }}
        exportName={`${project?.name ?? '项目'}-合同-${contract.number}`}
        groups={docToolbarGroups(setup, href)}
      />
      <DocRoot style={style}>
        <DocArticle className="px-[16mm] py-[16mm]">
          <DocHeader
            style={style}
            company={company}
            meta={
              <>
                <div>合同编号：<span className="doc-latin text-doc-ink">{contract.number}</span></div>
                {contract.signedAt ? <div>签订日期：{fmtLongDate(contract.signedAt)}</div> : null}
              </>
            }
          />
          <div className="pt-9 pb-7">
            <DocTitle style={style} center title="智能家居工程合同" subtitle={style.header === 'editorial' ? `合同编号 ${contract.number}` : undefined} />
          </div>

          <section data-pdf-block className="grid grid-cols-2 gap-8 rounded-doc border border-doc-rule p-4 text-[12px]">
            {party('甲方（委托方）', contract.customerName, [contract.customerPhone && `电话：${contract.customerPhone}`, contract.address && `地址：${contract.address}`])}
            {party('乙方（承接方）', company.name, [company.phone && `电话：${company.phone}`, company.address && `地址：${company.address}`])}
          </section>

          <p className="mt-5 indent-[2em]">甲乙双方本着平等自愿、诚实信用的原则，就甲方智能家居系统的设备供货及安装调试事宜，经协商一致，订立本合同，共同遵守。</p>

          <div className="mt-5 space-y-5">
            {clauses.map((c, i) => (
              <section key={c.title} data-pdf-block className="break-inside-avoid">
                <DocSectionHeading
                  style={style}
                  className="mb-2"
                  title={
                    <>
                      <span className="text-doc-accent">{NUMERALS[i]}、</span>
                      {c.title}
                    </>
                  }
                />
                <div className="pl-[2em] text-[12.5px]">{c.body}</div>
              </section>
            ))}
          </div>

          <footer className="mt-14 grid grid-cols-2 gap-10 text-[12px] break-inside-avoid">
            <div className="space-y-7">
              <div>甲方（签字）：</div>
              <div className="border-b border-doc-ink/40 pb-1 text-doc-muted">日期：</div>
            </div>
            <div className="space-y-7">
              <div>乙方（盖章）：{company.name}</div>
              <div className="border-b border-doc-ink/40 pb-1 text-doc-muted">日期：</div>
            </div>
          </footer>

          {withAttachment && quote ? (
            <section data-pdf-break-before className="mt-12 break-before-page pt-2 print:mt-0">
              <DocSectionHeading style={style} className="mb-1" title="附件：报价明细" note={quote.title} />
              <table className="mt-3 w-full border-collapse text-[11.5px]">
                <thead>
                  <tr className={t.head}>
                    <th className={cn(t.th, 'w-10')}>序号</th>
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
                      <td className={cn(t.td, 'py-1.5 tabular-nums')}>{i + 1}</td>
                      <td className={cn(t.td, 'py-1.5')}>{item.name}</td>
                      <td className={cn(t.td, 'py-1.5 text-doc-muted')}>{item.sku}</td>
                      <td className={cn(t.td, 'py-1.5 text-right whitespace-nowrap tabular-nums')}>{yuan(item.price)}</td>
                      <td className={cn(t.td, 'py-1.5 text-right whitespace-nowrap tabular-nums')}>{item.quantity}{item.unit ? ` ${item.unit}` : ''}</td>
                      <td className={cn(t.td, 'py-1.5 text-right whitespace-nowrap tabular-nums')}>{yuan(item.price * item.quantity)}</td>
                    </tr>
                  ))}
                  {fees.map((fee, i) => (
                    <tr key={fee.id ?? `fee-${i}`} className={t.row(items.length + i)}>
                      <td className={cn(t.td, 'py-1.5 tabular-nums')}>{items.length + i + 1}</td>
                      <td className={cn(t.td, 'py-1.5')} colSpan={4}>{fee.name}</td>
                      <td className={cn(t.td, 'py-1.5 text-right tabular-nums')}>{yuan(fee.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div data-pdf-block className="mt-3 ml-auto w-60 space-y-1 text-[12px]">
                <div className="flex justify-between"><span className="text-doc-muted">产品小计</span><span className="tabular-nums">{yuan(quote.productTotal)}</span></div>
                {quote.feeTotal ? <div className="flex justify-between"><span className="text-doc-muted">附加费用</span><span className="tabular-nums">{yuan(quote.feeTotal)}</span></div> : null}
                {quote.discount ? <div className="flex justify-between"><span className="text-doc-muted">优惠</span><span className="tabular-nums">-{yuan(quote.discount)}</span></div> : null}
                <div className="flex items-baseline justify-between border-t border-doc-ink/30 pt-1.5">
                  <span className="doc-strong">报价合计</span>
                  <span className="doc-strong tabular-nums">{yuan(quote.total)}</span>
                </div>
              </div>
            </section>
          ) : null}
          <DocFooter className="mt-10" left={contract.address || project?.name || ''} center={contract.number} right={company.name} />
        </DocArticle>
      </DocRoot>
    </div>
  )
}
