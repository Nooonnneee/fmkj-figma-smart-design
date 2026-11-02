'use client'

import { useState } from 'react'
import { Check, Share2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

export function CopyClientLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const url = `${window.location.origin}/share/${encodeURIComponent(token)}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('已复制业主只读预览链接，可直接发给客户微信')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('复制失败，请手动复制')
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={() => void handleCopy()}>
      {copied ? <Check className="size-4 text-success" /> : <Share2 className="size-4" />}
      {copied ? '已复制业主预览链接' : '复制业主预览链接'}
    </Button>
  )
}
