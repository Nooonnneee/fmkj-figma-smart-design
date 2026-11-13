'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BadgeCheck } from 'lucide-react'

import { Button } from '@astryxdesign/core/Button'
import { useToast } from '@astryxdesign/core/Toast'

import { setDeliverables } from '../archive/actions'

/** 把这份报价设为定稿：交付资料包、方案默认都用它 */
export function SetFinalQuoteButton({
  projectId,
  quoteId,
}: {
  projectId: string
  quoteId: string
}) {
  const router = useRouter()
  const showToast = useToast()
  const [pending, start] = useTransition()
  return (
    <Button
      variant="ghost"
      size="sm"
      className="relative z-10 text-muted-foreground"
      isDisabled={pending}
      onClick={() =>
        start(async () => {
          const res = await setDeliverables(projectId, { finalQuote: quoteId })
          if (!res.ok) return void showToast({ body: res.error, type: 'error' })
          showToast({ body: '已设为定稿报价，交付资料包和方案默认使用这一份' })
          router.refresh()
        })
      }
      isLoading={pending}
      icon={<BadgeCheck />}
      label="设为定稿"
    />
  )
}
