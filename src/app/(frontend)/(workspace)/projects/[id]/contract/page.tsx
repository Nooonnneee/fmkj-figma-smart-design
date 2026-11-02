import Link from 'next/link'
import { FileSignature, ReceiptText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { relId } from '@/lib/access'
import { DEFAULT_CONTRACT_TERMS } from '@/lib/contracts'

import { getProject, getProjectDeals } from '../project-data'
import { ContractEditor, CreateContractPanel, type QuoteOption } from './contract-editor'
import { quoteShortTitle } from '@/lib/project-name'

/** 合同：每个项目一份，由报价生成；签订后锁定内容，继续登记收款。 */
export default async function ProjectContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [{ project, archived, readOnly }, { quotes, contract }] = await Promise.all([getProject(id), getProjectDeals(id)])
  const pid = String(project.id)
  const options: QuoteOption[] = quotes.map((q) => ({ id: String(q.id), title: quoteShortTitle(q.title, project.name), total: q.total ?? 0, status: q.status }))

  if (!contract) {
    const defaultQuote = options.find((q) => q.status === 'accepted') ?? options[0]
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <header>
          <h2 className="text-xl font-semibold tracking-tight">合同</h2>
        </header>
        {readOnly ? (
          <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
            {archived ? '项目已归档，没有合同记录。' : '该项目尚未生成合同（当前为仅查看权限）。'}
          </p>
        ) : defaultQuote ? (
          <CreateContractPanel projectId={pid} quotes={options} defaultQuoteId={defaultQuote.id} />
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-14 text-center">
            <FileSignature className="size-8 text-muted-foreground" />
            <p className="font-medium">先生成一份报价</p>
            <p className="max-w-md text-sm text-muted-foreground">合同按报价生成，金额和设备清单都来自报价。</p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href={`/projects/${pid}/quotes`}><ReceiptText className="size-4" />去报价</Link>
            </Button>
          </div>
        )}
      </div>
    )
  }

  // 合同依据的报价一定在选项里（即使被移到列表之外，也补上）
  const quoteId = relId(contract.quote) ?? ''
  if (quoteId && !options.some((q) => q.id === quoteId)) options.push({ id: quoteId, title: '依据的报价', total: contract.amount ?? 0, status: 'accepted' })

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <ContractEditor
        readOnly={readOnly}
        archived={archived}
        quotes={options}
        initial={{
          id: String(contract.id),
          number: contract.number,
          status: contract.status,
          signedAt: contract.signedAt ?? null,
          quoteId,
          amount: contract.amount ?? 0,
          customerName: contract.customerName ?? '',
          customerPhone: contract.customerPhone ?? '',
          address: contract.address ?? '',
          durationDays: contract.durationDays ?? null,
          warrantyMonths: contract.warrantyMonths ?? null,
          terms: contract.terms ?? DEFAULT_CONTRACT_TERMS,
          payments: (contract.payments ?? []).map((p) => ({ name: p.name, percent: p.percent, received: Boolean(p.received) })),
        }}
      />
    </div>
  )
}
