import Link from 'next/link'
import { Check, Circle, FileText, Printer } from 'lucide-react'

import { relId } from '@/lib/access'
import { contractStatusLabel, fmtLongDate, paymentAmounts } from '@/lib/contracts'
import { PROPOSAL_TEMPLATES } from '@/plugins/proposal/templates'
import { getPluginFlags } from '@/plugins/state'
import { quoteStatusLabel, yuan } from '@/lib/quotes'
import { cn } from '@/lib/utils'

import { getProject, getProjectDeals } from '../project-data'
import { ArchiveButton } from './archive-button'

/** 归档：交付前核对资料是否齐全，打印留档，然后归档（项目转为只读）。 */
export default async function ProjectArchivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [{ project, archived }, { quotes, contract }, flags] = await Promise.all([getProject(id), getProjectDeals(id), getPluginFlags()])
  const pid = String(project.id)
  const points = project.pointCount ?? 0
  const finalQuote = quotes.find((q) => String(q.id) === relId(contract?.quote)) ?? quotes.find((q) => q.status === 'accepted') ?? quotes[0] ?? null
  const payments = contract?.payments ?? []
  const amounts = paymentAmounts(contract?.amount ?? 0, payments)
  const received = payments.filter((p) => p.received).length

  const checks = [
    { label: '点位图', done: points > 0, note: points ? `${points} 个点位` : '还没有布置点位', href: `/projects/${pid}/point-map` },
    {
      label: '定稿报价',
      done: Boolean(finalQuote && (finalQuote.status === 'accepted' || contract)),
      note: finalQuote ? `${finalQuote.title} · ${quoteStatusLabel(finalQuote.status)} · ${yuan(finalQuote.total)}` : '还没有报价',
      href: finalQuote ? `/projects/${pid}/quotes/${finalQuote.id}` : `/projects/${pid}/quotes`,
    },
    {
      label: '合同',
      done: contract?.status === 'signed',
      note: contract ? `${contract.number} · ${contractStatusLabel(contract.status)}${contract.signedAt ? ` · ${fmtLongDate(contract.signedAt)}` : ''}` : '还没有合同',
      href: `/projects/${pid}/contract`,
    },
    {
      label: '收款',
      done: payments.length > 0 && received === payments.length,
      note: payments.length
        ? `${received}/${payments.length} 期已收 · ${yuan(payments.reduce((s, p, i) => s + (p.received ? amounts[i] : 0), 0))}`
        : contract
          ? '合同里没有付款计划'
          : '签订合同后在「合同」里登记收款',
      href: `/projects/${pid}/contract`,
    },
  ]
  const ready = checks.every((c) => c.done)

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">归档</h2>
        <p className="text-sm text-muted-foreground">
          {archived ? `项目于 ${fmtLongDate(project.archivedAt)} 归档，所有资料只读保存。` : '交付完成后归档：项目移到「已归档」，点位、报价、合同都转为只读。'}
        </p>
      </header>

      <section aria-labelledby="checks-title" className="rounded-xl bg-card shadow-sm ring-1 ring-foreground/5 dark:ring-foreground/10">
        <h3 id="checks-title" className="border-b px-5 py-3.5 text-base font-semibold">资料核对</h3>
        <ul className="divide-y">
          {checks.map((c) => (
            <li key={c.label}>
              <Link href={c.href} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40">
                {c.done ? <Check className="size-4 shrink-0 text-success" aria-label="已完成" /> : <Circle className="size-4 shrink-0 text-muted-foreground" aria-label="未完成" />}
                <span className={cn('w-20 shrink-0 text-sm font-medium', !c.done && 'text-muted-foreground')}>{c.label}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{c.note}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="docs-title" className="rounded-xl bg-card shadow-sm ring-1 ring-foreground/5 dark:ring-foreground/10">
        <div className="border-b px-5 py-3.5">
          <h3 id="docs-title" className="text-base font-semibold">打印留档</h3>
          <p className="text-sm text-muted-foreground">都可以打印或导出 PDF、图片；版式和风格在打印页顶部切换，默认值在「设置 → 文档模板」。</p>
        </div>
        <div className="divide-y">
          <DocLink href={points ? `/print/projects/${pid}/plans` : null} title="点位图" note={points ? '每张图纸一页，附设备图例和统计' : '还没有布置点位'} />
          <DocLink href={points ? `/print/projects/${pid}/checklist` : null} title="点位交底清单" note={points ? `${points} 个点位，给安装团队逐点核对` : '还没有布置点位'} />
          <DocLink href={finalQuote ? `/print/quotes/${finalQuote.id}` : null} title="报价单" note={finalQuote ? finalQuote.title : '还没有报价'} />
          <DocLink href={contract ? `/print/contracts/${contract.id}` : null} title="合同" note={contract ? `${contract.number}（含报价明细附件）` : '还没有合同'} />
          {flags.proposal
            ? PROPOSAL_TEMPLATES.map((t) => (
                <DocLink key={t.value} href={points ? `/print/projects/${pid}/proposal?template=${t.value}` : null} title={`方案 · ${t.label}`} note={t.description} />
              ))
            : null}
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed px-5 py-4">
        <div className="text-sm">
          <div className="font-medium">{archived ? '恢复项目' : ready ? '资料齐全，可以归档' : '可以随时归档'}</div>
          <div className="text-muted-foreground">{archived ? '恢复后回到「进行中」，可以继续修改。' : ready ? '归档后仍然可以随时查看和打印。' : '未完成的项也可以先归档，之后恢复再补。'}</div>
        </div>
        <ArchiveButton projectId={pid} archived={archived} primary={ready} />
      </section>
    </div>
  )
}

function DocLink({ href, title, note }: { href: string | null; title: string; note: string }) {
  const body = (
    <>
      {href ? <Printer className="size-4 shrink-0 text-muted-foreground" /> : <FileText className="size-4 shrink-0 text-muted-foreground/50" />}
      <span className="min-w-0">
        <span className={cn('block text-sm font-medium', !href && 'text-muted-foreground')}>{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{note}</span>
      </span>
    </>
  )
  return href ? (
    <Link href={href} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40">{body}</Link>
  ) : (
    <div aria-disabled className="flex items-center gap-3 px-5 py-3">{body}</div>
  )
}
