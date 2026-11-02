import Link from 'next/link'
import { AlertCircle, FileText, MapPinned } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { relId } from '@/lib/access'
import { resolveFinalQuote } from '@/lib/deliverables'
import { fmtDate } from '@/lib/projects'
import { quoteStatusLabel, quoteStatusVariant, yuan } from '@/lib/quotes'

import { getProject, getProjectDeals } from '../project-data'
import { DeleteQuoteButton, GenerateQuoteForm } from './quote-controls'
import { SetFinalQuoteButton } from './set-final-button'
import { quoteShortTitle } from '@/lib/project-name'

/** 报价：项目里的全部报价。从点位图生成，逐行换型号、改价后打印给客户。 */
export default async function ProjectQuotesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params
  const { error } = await searchParams
  const [{ project, readOnly }, { quotes, contract }] = await Promise.all([getProject(id), getProjectDeals(id)])
  const pid = String(project.id)
  const points = project.pointCount ?? 0
  const contractQuoteId = relId(contract?.quote)
  // 定稿：合同依据 → 手动设为定稿 → 已接受 → 最新；交付资料包与方案默认用它
  const final = resolveFinalQuote(quotes, { contractQuoteId, finalQuoteId: relId(project.finalQuote) })
  const finalId = final.quote ? String(final.quote.id) : null

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">报价</h2>
          <p className="text-sm text-muted-foreground">
            {points ? `已关联点位图 ${points} 个点位` : '未布置点位，可新建空白报价'}
          </p>
        </div>
        {readOnly ? null : <GenerateQuoteForm projectId={pid} hasPoints={points > 0} />}
      </header>

      {error ? (
        <div role="alert" className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive-strong">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {quotes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-14 text-center">
          <FileText className="size-8 text-muted-foreground" />
          <p className="font-medium">还没有报价</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {points ? '按点位图自动生成设备清单与金额' : '布置点位后可自动汇总设备数量与型号'}
          </p>
          {points ? null : (
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href={`/projects/${pid}/point-map`}><MapPinned className="size-4" />去布置点位</Link>
            </Button>
          )}
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-foreground/5 dark:ring-foreground/10">
          {quotes.map((q) => {
            const qid = String(q.id)
            const usedByContract = qid === contractQuoteId
            const isFinal = qid === finalId
            return (
              <li key={qid} className="group relative flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 sm:px-5">
                <div className="min-w-0 flex-1">
                  <Link href={`/projects/${pid}/quotes/${qid}`} className="block truncate font-medium after:absolute after:inset-0 hover:underline">
                    {quoteShortTitle(q.title, project.name)}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {isFinal && quotes.length > 1 ? <Badge>定稿</Badge> : null}
                    <Badge variant={quoteStatusVariant(q.status)}>{quoteStatusLabel(q.status)}</Badge>
                    {usedByContract ? <span>已用于合同 {contract?.number}</span> : null}
                    <span className="tabular-nums">更新于 {fmtDate(q.updatedAt)}</span>
                  </div>
                </div>
                <span className="text-right text-base font-semibold tabular-nums">{yuan(q.total)}</span>
                {readOnly || usedByContract ? null : (
                  <div className="flex items-center gap-1">
                    {!isFinal && !contractQuoteId ? <SetFinalQuoteButton projectId={pid} quoteId={qid} /> : null}
                    <DeleteQuoteButton quoteId={qid} title={q.title} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
