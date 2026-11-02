import { notFound, redirect } from 'next/navigation'

import { PrintToolbar } from '@/components/print-toolbar'
import { BrandMark, DocArticle, DocFooter, DocHeader, DocRoot, DocSectionHeading, DocTitle, docTable } from '@/documents/parts'
import { docToolbarGroups, resolveDocSetup } from '@/documents/registry'
import { relId } from '@/lib/access'
import { appAuth } from '@/lib/app-auth'
import { fmtLongDate, paymentAmounts, rmbUpper } from '@/lib/contracts'
import { getPayloadClient } from '@/lib/payload'
import { yuan } from '@/lib/quotes'
import { cn } from '@/lib/utils'
import type { Project, Quote } from '@/payload-types'

export const metadata = { title: '合同', robots: { index: false, follow: false } }

const NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四']

/**
 * 打印给客户签字的合同：A4 纵向。版式：含报价附件 / 仅正文 / 正式版（封面 + 「第 X 条」+ 签署页 + 附件）/ 订单确认书（单页）。
 * 附件从新的一页开始。
 */
export default async function PrintContractPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ style?: string; layout?: string }> }) {
  const { id } = await params
  const sp = await searchParams
  const user = await appAuth.getCurrentUser()
  if (!user) redirect(`/login?from=/print/contracts/${id}`)
  const payload = await getPayloadClient()
  const contract = await payload
    .findByID({
      collection: 'contracts',
      id,
      depth: 1,
      user,
      overrideAccess: false,
      populate: {
        projects: { name: true, platform: true, owner: true },
        quotes: { title: true, items: true, fees: true, discount: true, productTotal: true, feeTotal: true, total: true },
      },
    })
    .catch(() => null)
  if (!contract) notFound()
  const project = typeof contract.project === 'object' ? (contract.project as Project) : null
  const setup = await resolveDocSetup('contract', sp, (project ? relId(project.owner) : null) || user.id)
  const { style, company, layout } = setup
  const quote = typeof contract.quote === 'object' ? (contract.quote as Quote) : null
  const amount = contract.amount ?? 0
  const payments = contract.payments ?? []
  const amounts = paymentAmounts(amount, payments)
  const items = quote?.items ?? []
  const fees = quote?.fees ?? []
  const differs = quote ? Math.abs((quote.total ?? 0) - amount) > 0.001 : false
  const t = docTable(style)
  const formal = layout === 'formal'
  const confirm = layout === 'confirm'
  const withAttachment = (layout === 'full' || formal) && Boolean(quote)
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
    // 正式版补齐常见条款（条款里已经写到的不重复）
    ...(formal && !/违约/.test(contract.terms ?? '')
      ? [{ title: '违约责任', body: <p>任何一方未按本合同约定履行义务的，应承担相应的违约责任，并赔偿由此给对方造成的直接损失。</p> }]
      : []),
    ...(formal && !/争议|诉讼|仲裁/.test(contract.terms ?? '')
      ? [{ title: '争议解决', body: <p>因本合同引起的争议，双方应友好协商解决；协商不成的，任何一方均可依法向有管辖权的人民法院提起诉讼。</p> }]
      : []),
  ]
  const clauseLabel = (i: number) => (formal ? `第${NUMERALS[i]}条　` : `${NUMERALS[i]}、`)
  const signedDate = contract.signedAt ? fmtLongDate(contract.signedAt) : '　　　　年　　月　　日'
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
        back={{ href: project ? `/projects/${project.id}/archive` : '/projects', label: '返回归档' }}
        exportName={`${project?.name ?? '项目'}-${confirm ? '订单确认书' : '合同'}-${contract.number}`}
        groups={docToolbarGroups(setup, href)}
      />
      <DocRoot style={style}>
        <DocArticle className="px-[14mm] py-[12mm]">
          {formal ? (
            <section className="flex min-h-[262mm] flex-col items-center justify-between py-[16mm] text-center break-after-page">
              <div className="flex flex-col items-center gap-3">
                <BrandMark company={company} className="h-12" />
                <div className="doc-display text-[15px]">{company.name}</div>
              </div>
              <div>
                <div className="doc-display text-[32px] tracking-[0.35em]">智能家居工程合同</div>
                <div className="doc-latin mt-4 text-[13px] text-doc-muted">合同编号　{contract.number}</div>
              </div>
              <dl className="w-[125mm] space-y-4 text-left text-[13.5px]">
                {[
                  ['项目名称', project?.name ?? '—'],
                  ['甲方（委托方）', contract.customerName || '—'],
                  ['乙方（承接方）', company.name],
                  ['合同金额', `${yuan(amount)}（${rmbUpper(amount)}）`],
                  ['签订日期', signedDate],
                ].map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[30mm_1fr] items-end gap-3 border-b border-doc-ink/40 pb-1.5">
                    <dt className="text-doc-muted">{k}</dt>
                    <dd className="doc-strong">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="space-y-0.5 text-[11px] text-doc-muted">
                {[company.phone && `电话：${company.phone}`, company.address && `地址：${company.address}`].filter(Boolean).map((l) => (
                  <div key={l as string}>{l}</div>
                ))}
              </div>
            </section>
          ) : null}

          <div data-pdf-break-before={formal ? true : undefined}>
            <DocHeader
              style={style}
              company={company}
              meta={
                <>
                  <div>
                    {confirm ? '确认书编号' : '合同编号'}：<span className="doc-latin text-doc-ink">{contract.number}</span>
                  </div>
                  {contract.signedAt ? <div>签订日期：{fmtLongDate(contract.signedAt)}</div> : null}
                </>
              }
            />
            <div className="pt-6 pb-5">
              <DocTitle
                style={style}
                center
                title={confirm ? '智能家居订单确认书' : '智能家居工程合同'}
                subtitle={style.header === 'editorial' ? `${confirm ? '编号' : '合同编号'} ${contract.number}` : undefined}
              />
            </div>

            <section data-pdf-block className="grid grid-cols-2 gap-8 rounded-doc border border-doc-rule p-4 text-[12px]">
              {party('甲方（委托方）', contract.customerName, [contract.customerPhone && `电话：${contract.customerPhone}`, contract.address && `地址：${contract.address}`])}
              {party('乙方（承接方）', company.name, [company.phone && `电话：${company.phone}`, company.address && `地址：${company.address}`])}
            </section>

            {confirm ? (
              <>
                <table data-pdf-block className="mt-5 w-full border-collapse text-[12.5px]">
                  <tbody>
                    {[
                      ['项目名称', project?.name ?? '—'],
                      ['施工地址', contract.address || '—'],
                      ...(project?.platform ? [['智能平台', project.platform]] : []),
                      ...(quote ? [['报价依据', quote.title]] : []),
                      ['确认金额', `${yuan(amount)}（大写：${rmbUpper(amount)}）`],
                      ...(contract.durationDays ? [['工期', `具备安装条件后 ${contract.durationDays} 天内完成安装调试`]] : []),
                      ...(contract.warrantyMonths ? [['质保', `${contract.warrantyMonths} 个月，自验收合格之日起计算`]] : []),
                    ].map(([k, v], i) => (
                      <tr key={k} className={t.row(i)}>
                        <th scope="row" className={cn(t.td, 'w-28 py-2 text-left font-normal text-doc-muted')}>{k}</th>
                        <td className={cn(t.td, 'py-2', k === '确认金额' && 'doc-strong')}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <section data-pdf-block className="mt-5 break-inside-avoid">
                  <DocSectionHeading style={style} className="mb-1.5" title="付款方式" />
                  {clauses.find((c) => c.title === '付款方式')?.body}
                </section>
                <section data-pdf-block className="mt-5 text-[11.5px] break-inside-avoid">
                  <DocSectionHeading style={style} className="mb-1.5" title="约定事项" />
                  <p className="whitespace-pre-line text-doc-muted">
                    {contract.terms || '设备清单以双方确认的报价单为准；安装、调试、验收与质保按双方约定执行。'}
                  </p>
                </section>
              </>
            ) : (
              <>
                <p className="mt-4 indent-[2em]">甲乙双方本着平等自愿、诚实信用的原则，就甲方智能家居系统的设备供货及安装调试事宜，经协商一致，订立本合同，共同遵守。</p>
                <div className="mt-4 space-y-3.5">
                  {clauses.map((c, i) => (
                    <section key={c.title} data-pdf-block className="break-inside-avoid">
                      <DocSectionHeading
                        style={style}
                        className="mb-1.5"
                        title={
                          <>
                            <span className="text-doc-accent">{clauseLabel(i)}</span>
                            {c.title}
                          </>
                        }
                      />
                      <div className="pl-[2em] text-[12.5px]">{c.body}</div>
                    </section>
                  ))}
                </div>
              </>
            )}

            {formal ? (
              <section data-pdf-block className="mt-8 break-inside-avoid">
                <p className="mb-3 text-[12px] text-doc-muted">（以下无正文，为签署页）</p>
                <table className="w-full border-collapse text-[12.5px]">
                  <thead>
                    <tr className={t.head}>
                      <th className={cn(t.th, 'w-1/2')}>甲方（委托方）</th>
                      <th className={cn(t.th, 'w-1/2')}>乙方（承接方）</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['签字：', `盖章：${company.name}`],
                      ['身份证号：', '委托代理人：'],
                      [`电话：${contract.customerPhone ?? ''}`, `电话：${company.phone ?? ''}`],
                      ['日期：　　　　年　　月　　日', '日期：　　　　年　　月　　日'],
                    ].map(([a, b], i) => (
                      <tr key={i} className="border-b border-doc-rule">
                        <td className="h-12 border-r border-doc-rule px-3 align-bottom">{a}</td>
                        <td className="h-12 px-3 align-bottom">{b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : (
              <footer data-pdf-block className="mt-8 grid grid-cols-2 gap-10 text-[12px] break-inside-avoid">
                <div className="space-y-6">
                  <div>甲方（签字）：</div>
                  <div className="border-b border-doc-ink/40 pb-1 text-doc-muted">日期：</div>
                </div>
                <div className="space-y-6">
                  <div>乙方（盖章）：{company.name}</div>
                  <div className="border-b border-doc-ink/40 pb-1 text-doc-muted">日期：</div>
                </div>
              </footer>
            )}
          </div>
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
          <DocFooter className="mt-6" left={contract.address || project?.name || ''} center={contract.number} right={company.name} />
        </DocArticle>
      </DocRoot>
    </div>
  )
}
