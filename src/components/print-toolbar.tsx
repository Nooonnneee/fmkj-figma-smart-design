'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, FileDown, ImageDown, Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { exportPagesAsPdf } from '@/lib/export-pdf'
import { cn } from '@/lib/utils'

type Option = { value: string; label: string; href: string }

/** 打印页顶部工具条：切换模板 / 选项、直接导出 PDF、导出图片、浏览器打印。 */
export function PrintToolbar({
  back,
  groups,
  exportName,
  wide = false,
}: {
  back: { href: string; label: string }
  groups: { label: string; value: string; options: Option[] }[]
  exportName: string
  /** 页面比 A4 宽（例如按 1440px 设计稿排版的方案）时，工具条跟着加宽 */
  wide?: boolean
}) {
  const [busy, setBusy] = useState<'pdf' | 'img' | null>(null)
  const searchParams = useSearchParams()
  const autoTriggered = useRef(false)

  const exportPdf = useCallback(async () => {
    setBusy('pdf')
    try {
      const pages = [...document.querySelectorAll<HTMLElement>('[data-export-page]')]
      if (!pages.length) return
      const count = await exportPagesAsPdf(pages, exportName)
      toast.success(`已导出 PDF（共 ${count} 页）`)
    } catch {
      toast.error('PDF 导出失败，请稍后重试')
    } finally {
      setBusy(null)
    }
  }, [exportName])

  useEffect(() => {
    if (autoTriggered.current || searchParams.get('auto') !== 'pdf') return
    const t = setTimeout(() => {
      autoTriggered.current = true
      void exportPdf()
    }, 500)
    return () => clearTimeout(t)
  }, [searchParams, exportPdf])

  const exportImages = async () => {
    setBusy('img')
    try {
      const { toPng } = await import('html-to-image')
      const pages = [...document.querySelectorAll<HTMLElement>('[data-export-page]')]
      for (const [i, el] of pages.entries()) {
        const url = await toPng(el, {
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          cacheBust: false,
          style: { margin: '0', boxShadow: 'none' },
        })
        const a = document.createElement('a')
        a.href = url
        a.download = pages.length > 1 ? `${exportName}-${String(i + 1).padStart(2, '0')}.png` : `${exportName}.png`
        a.click()
        await new Promise((r) => setTimeout(r, 250))
      }
      toast.success(pages.length > 1 ? `已导出 ${pages.length} 张图片` : '已导出图片')
    } catch {
      toast.error('导出失败，请稍后重试')
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="sticky top-0 z-20 border-b bg-background/95 print:hidden">
      <div className={cn('mx-auto flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2', wide ? 'max-w-[1440px]' : 'max-w-[297mm]')}>
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link href={back.href}><ChevronLeft className="size-4" />{back.label}</Link>
        </Button>
        {groups.map((g) => (
          <div key={g.label} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{g.label}</span>
            <div className="flex rounded-lg bg-muted p-0.5">
              {g.options.map((o) => (
                <Button key={o.value} asChild size="xs" variant="ghost" className={cn('h-7 rounded-md px-2.5', o.value === g.value && 'bg-background shadow-sm')}>
                  <Link href={o.href} replace scroll={false}>{o.label}</Link>
                </Button>
              ))}
            </div>
          </div>
        ))}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void exportImages()}>
            {busy === 'img' ? <Loader2 className="size-4 animate-spin" /> : <ImageDown className="size-4" />}导出图片
          </Button>
          <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => window.print()}>
            <Printer className="size-4" />打印
          </Button>
          <Button size="sm" disabled={busy !== null} onClick={() => void exportPdf()}>
            {busy === 'pdf' ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}导出 PDF
          </Button>
        </div>
      </div>
    </div>
  )
}
