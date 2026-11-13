'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileSignature, Loader2 } from 'lucide-react'

import { Button } from '@astryxdesign/core/Button'
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList'
import { useToast } from '@astryxdesign/core/Toast'
import { quoteStatusLabel, yuan } from '@/lib/quotes'

import { createContract, type ContractInput } from './actions'

export type QuoteOption = { id: string; title: string; total: number; status: string }
export type ContractValues = Omit<ContractInput, 'payments'> & {
  id: string
  status: string
  signedAt: string | null
  payments: { name: string; percent: number; received: boolean }[]
}

/** 还没有合同：选一份报价生成。默认选客户已确认的报价，没有则选最新的。 */
export function CreateContractPanel({
  projectId,
  quotes,
  defaultQuoteId,
}: {
  projectId: string
  quotes: QuoteOption[]
  defaultQuoteId: string
}) {
  const router = useRouter()
  const showToast = useToast()
  const [quoteId, setQuoteId] = useState(defaultQuoteId)
  const [pending, startTransition] = useTransition()
  return (
    <div className="rounded-[var(--radius-container)] bg-card shadow-xs ring-1 ring-border">
      <div className="border-b px-5 py-4">
        <h3 className="text-base font-semibold">选择报价生成合同</h3>
        <p className="text-sm text-muted-foreground">
          自动带入报价金额、客户资料与默认条款，生成后可修改。
        </p>
      </div>
      <RadioList
        label="合同依据的报价"
        isLabelHidden
        width="100%"
        value={quoteId}
        onChange={(v) => setQuoteId(v)}
      >
        {quotes.map((q) => (
          <RadioListItem
            key={q.id}
            value={q.id}
            label={q.title}
            description={quoteStatusLabel(q.status)}
            endContent={<span className="text-sm font-semibold tabular-nums">{yuan(q.total)}</span>}
          />
        ))}
      </RadioList>
      <div className="flex justify-end border-t px-5 py-4">
        <Button
          isDisabled={pending || !quoteId}
          onClick={() =>
            startTransition(async () => {
              const result = await createContract(projectId, quoteId)
              if (!result.ok) return void showToast({ body: result.error, type: 'error' })
              showToast({ body: '合同已生成，请核对内容' })
              router.refresh()
            })
          }
          icon={<Loader2 />}
          label="生成合同"
        />
      </div>
    </div>
  )
}
