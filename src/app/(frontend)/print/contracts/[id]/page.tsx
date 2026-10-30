import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'

import { PrintToolbar } from '@/components/print-toolbar'
import { appAuth } from '@/lib/app-auth'
import { getCompanyInfo } from '@/lib/cached-data'
import { fmtLongDate, paymentAmounts, rmbUpper } from '@/lib/contracts'
import { getPayloadClient } from '@/lib/payload'
import { yuan } from '@/lib/quotes'
import type { Project, Quote } from '@/payload-types'

export const metadata = { title: '合同', robots: { index: false, follow: false } }

/** 打印给客户签字的合同：A4 纵向，正文 + 附件《报价明细》（附件从新的一页开始）。 */
export default async function PrintContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await appAuth.getCurrentUser()
  if (!user) redirect(`/login?from=/print/contracts/${id}`)
  const payload = await getPayloadClient()
  const [contract, company] = await Promise.all([
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
    getCompanyInfo(),
  ])
  if (!contract) notFound()
  const project = typeof contract.project === 'object' ? (contract.project as Project) : null
  const quote = typeof contract.quote === 'object' ? (contract.quote as Quote) : null
  const amount = contract.amount ?? 0
  const payments = contract.payments ?? []
  const amounts = paymentAmounts(amount, payments)
  const items = quote?.items ?? []
  const fees = quote?.fees ?? []
  const differs = quote ? Math.abs((quote.total ?? 0) - amount) > 0.001 : false
  const clauses: { title: string; body: React.ReactNode }[] = [
    {
      title: '项目概况',
      body: (
        <div className="space-y-1">
          <p>项目名称：{project?.name ?? '—'}</p>
          <p>施工地址：{contract.address || '—'}</p>
          {project?.platform ? <p>智能平台：{project.platform}</p> : null}
          <p>服务内容：按附件《报价明细》提供智能家居设备，并负责安装、调试和使用培训。</p>
        </div>
      ),
    },
    {
      title: '合同金额',
      body: (
        <p>
          合同总金额为人民币 <strong className="tabular-nums">{yuan(amount)}</strong>（大写：{rmbUpper(amount)}）。
          {differs ? '合同金额与附件报价合计不一致的，以本条约定的合同金额为准。' : ''}
        </p>
      ),
    },
    {
      title: '付款方式',
      body: payments.length ? (
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-y border-neutral-300 bg-neutral-50 text-left">
              <th className="w-12 py-1.5 pl-2 font-medium">期次</th>
              <th className="py-1.5 font-medium">款项</th>
              <th className="w-20 py-1.5 text-right font-medium">比例</th>
              <th className="w-32 py-1.5 pr-2 text-right font-medium">金额</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p, i) => (
              <tr key={p.id ?? i} className="border-b border-neutral-200">
                <td className="py-1.5 pl-2 tabular-nums">{i + 1}</td>
                <td className="py-1.5">{p.name}</td>
                <td className="py-1.5 text-right tabular-nums">{p.percent}%</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{yuan(amounts[i])}</td>
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
  const numerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
  const party = (role: string, name: string | null | undefined, lines: (string | null | undefined)[]) => (
    <div className="space-y-1">
      <div className="text-neutral-500">{role}</div>
      <div className="text-[14px] font-semibold">{name || '—'}</div>
      {lines.filter(Boolean).map((l) => <div key={l} className="text-neutral-600">{l}</div>)}
    </div>
  )

  return (
    <div className="min-h-screen bg-muted/40 pb-8 print:bg-white print:pb-0">
      <PrintToolbar
        back={{ href: project ? `/projects/${project.id}/contract` : '/projects', label: '返回合同' }}
        exportName={`${project?.name ?? '项目'}-合同-${contract.number}`}
        groups={[]}
      />
      <article data-export-page className="mx-auto mt-6 max-w-[210mm] bg-white px-[16mm] py-[16mm] text-[13px] leading-relaxed text-neutral-900 shadow-sm print:mt-0 print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b border-neutral-300 pb-4">
          <div className="flex items-center gap-3">
            {company.logo ? (
              <Image src={company.logo.url} alt={company.logo.alt || company.name} width={company.logo.width ?? 96} height={company.logo.height ?? 96} className="h-10 w-auto object-contain" unoptimized />
            ) : null}
            <div className="text-[14px] font-semibold">{company.name}</div>
          </div>
          <div className="text-right text-[12px] text-neutral-500">
            <div>合同编号：<span className="font-mono text-neutral-800">{contract.number}</span></div>
            {contract.signedAt ? <div>签订日期：{fmtLongDate(contract.signedAt)}</div> : null}
          </div>
        </header>

        <h1 className="pt-8 pb-6 text-center text-2xl font-semibold tracking-[0.2em]">智能家居工程合同</h1>

        <section data-pdf-block className="grid grid-cols-2 gap-8 rounded-md border border-neutral-200 p-4 text-[12px]">
          {party('甲方（委托方）', contract.customerName, [contract.customerPhone && `电话：${contract.customerPhone}`, contract.address && `地址：${contract.address}`])}
          {party('乙方（承接方）', company.name, [company.phone && `电话：${company.phone}`, company.address && `地址：${company.address}`])}
        </section>

        <p className="mt-5 indent-[2em]">
          甲乙双方本着平等自愿、诚实信用的原则，就甲方智能家居系统的设备供货及安装调试事宜，经协商一致，订立本合同，共同遵守。
        </p>

        <div className="mt-4 space-y-4">
          {clauses.map((c, i) => (
            <section key={c.title} data-pdf-block className="break-inside-avoid">
              <h2 className="mb-1.5 text-[13px] font-semibold">{numerals[i]}、{c.title}</h2>
              <div className="pl-[2em] text-[12.5px]">{c.body}</div>
            </section>
          ))}
        </div>

        <footer className="mt-14 grid grid-cols-2 gap-10 text-[12px] break-inside-avoid">
          <div className="space-y-6">
            <div>甲方（签字）：</div>
            <div className="border-b border-neutral-400 pb-1 text-neutral-500">日期：</div>
          </div>
          <div className="space-y-6">
            <div>乙方（盖章）：{company.name}</div>
            <div className="border-b border-neutral-400 pb-1 text-neutral-500">日期：</div>
          </div>
        </footer>

        {quote ? (
          <section data-pdf-break-before className="mt-12 break-before-page pt-2 print:mt-0">
            <h2 data-pdf-keep-next className="mb-1 text-[14px] font-semibold">附件：报价明细</h2>
            <p className="mb-3 text-[12px] text-neutral-500">{quote.title}</p>
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr className="border-y border-neutral-300 bg-neutral-50 text-left">
                  <th className="w-10 py-1.5 pl-2 font-medium">序号</th>
                  <th className="py-1.5 font-medium">产品</th>
                  <th className="py-1.5 font-medium">型号</th>
                  <th className="px-2 py-1.5 text-right font-medium">单价</th>
                  <th className="px-2 py-1.5 text-right font-medium">数量</th>
                  <th className="py-1.5 pr-2 text-right font-medium">金额</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id ?? i} className="border-b border-neutral-200">
                    <td className="py-1.5 pl-2 tabular-nums">{i + 1}</td>
                    <td className="py-1.5">{item.name}</td>
                    <td className="py-1.5 text-neutral-500">{item.sku}</td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">{yuan(item.price)}</td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">{item.quantity}{item.unit ? ` ${item.unit}` : ''}</td>
                    <td className="py-1.5 pr-2 text-right whitespace-nowrap tabular-nums">{yuan(item.price * item.quantity)}</td>
                  </tr>
                ))}
                {fees.map((fee, i) => (
                  <tr key={fee.id ?? `fee-${i}`} className="border-b border-neutral-200">
                    <td className="py-1.5 pl-2 tabular-nums">{items.length + i + 1}</td>
                    <td className="py-1.5" colSpan={4}>{fee.name}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{yuan(fee.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div data-pdf-block className="mt-3 ml-auto w-60 space-y-1 text-[12px]">
              <div className="flex justify-between"><span className="text-neutral-500">产品小计</span><span className="tabular-nums">{yuan(quote.productTotal)}</span></div>
              {quote.feeTotal ? <div className="flex justify-between"><span className="text-neutral-500">附加费用</span><span className="tabular-nums">{yuan(quote.feeTotal)}</span></div> : null}
              {quote.discount ? <div className="flex justify-between"><span className="text-neutral-500">优惠</span><span className="tabular-nums">-{yuan(quote.discount)}</span></div> : null}
              <div className="flex items-baseline justify-between border-t border-neutral-300 pt-1.5">
                <span className="font-medium">报价合计</span>
                <span className="font-semibold tabular-nums">{yuan(quote.total)}</span>
              </div>
            </div>
          </section>
        ) : null}
      </article>
    </div>
  )
}
