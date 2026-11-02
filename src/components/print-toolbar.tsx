'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronLeft, FileDown, ImageDown, Loader2, Lock } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { COLLECT_MESSAGE, type CollectResult } from '@/lib/doc-collect'
import { exportPagesAsPdf, renderPagesToJpegs, waitForPageAssets } from '@/lib/export-pdf'
import { cn } from '@/lib/utils'

type Option = { value: string; label: string; href: string }

/**
 * 打印页顶部工具条：切换模板 / 选项、直接导出 PDF、导出图片。
 * - locked：当前内容需要更高会员等级（严格模式），可以预览但不能导出；
 * - note：右侧的小提示（例如「专业版模板」）；
 * - 网址带 auto=pdf 时自动导出；带 auto=collect 时把 PDF 页发回交付资料包页面（见 lib/doc-collect）。
 */
export function PrintToolbar({
  back,
  groups,
  exportName,
  wide = false,
  locked,
  note,
}: {
  back: { href: string; label: string }
  groups: { label: string; value: string; options: Option[] }[]
  exportName: string
  /** 页面比 A4 宽（例如按 1440px 设计稿排版的方案）时，工具条跟着加宽 */
  wide?: boolean
  locked?: { message: string; href: string }
  note?: string
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
    const auto = searchParams.get('auto')
    if (autoTriggered.current || (auto !== 'pdf' && auto !== 'collect')) return
    const t = setTimeout(() => {
      autoTriggered.current = true
      if (auto === 'pdf') {
        if (!locked) void exportPdf()
        return
      }
      // 交付资料包：渲染 PDF 页并发回打开这个页面的资料包页面
      const key = searchParams.get('collect') ?? ''
      const reply = (msg: CollectResult, transfer: Transferable[] = []) => window.parent.postMessage(msg, window.location.origin, transfer)
      void (async () => {
        try {
          if (locked) throw new Error(locked.message)
          await waitForPageAssets()
          const pages = await renderPagesToJpegs([...document.querySelectorAll<HTMLElement>('[data-export-page]')])
          if (!pages.length) throw new Error('页面没有可导出的内容')
          reply({ type: COLLECT_MESSAGE, key, ok: true, pages }, pages.map((p) => p.bytes.buffer as ArrayBuffer))
        } catch (e) {
          reply({ type: COLLECT_MESSAGE, key, ok: false, error: e instanceof Error ? e.message : '生成失败' })
        }
      })()
    }, 500)
    return () => clearTimeout(t)
  }, [searchParams, exportPdf, locked])

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
        <div className="ml-auto flex items-center gap-2">
          {note && !locked ? <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{note}</span> : null}
          {locked ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3.5" />
              {locked.message}
              <Link href={locked.href} className="font-medium text-primary underline-offset-4 hover:underline">
                升级
              </Link>
            </span>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" disabled={busy !== null || Boolean(locked)}>
                {busy !== null ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
                导出
                <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onSelect={() => void exportPdf()}>
                <FileDown className="size-4" />
                导出 PDF
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void exportImages()}>
                <ImageDown className="size-4" />
                导出图片
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
