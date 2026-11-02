'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'fmkj:products-sidebar-width'
const DEFAULT_WIDTH = 208
const MIN_WIDTH = 148
const MAX_WIDTH = 360

export function ProductsResizableLayout({
  mobileToggle,
  sidebar,
  children,
}: {
  mobileToggle: React.ReactNode
  sidebar: React.ReactNode
  children: React.ReactNode
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [widthPx, setWidthPx] = useState<number>(DEFAULT_WIDTH)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      const parsed = saved ? Number(saved) : NaN
      if (Number.isFinite(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
        setWidthPx(Math.round(parsed))
      }
    } catch {
      // ignore storage errors
    }
  }, [])

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    const leftEdge = rect ? rect.left : 0
    let latest = widthPx
    setDragging(true)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    const onMove = (ev: PointerEvent) => {
      const next = Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, ev.clientX - leftEdge)))
      latest = next
      setWidthPx(next)
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      setDragging(false)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      try {
        window.localStorage.setItem(STORAGE_KEY, String(latest))
      } catch {
        // ignore storage errors
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const handleDoubleClick = () => {
    setWidthPx(DEFAULT_WIDTH)
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore storage errors
    }
  }

  return (
    <div
      ref={containerRef}
      style={{ '--products-sidebar-w': `${widthPx}px` } as React.CSSProperties}
      className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-0"
    >
      {mobileToggle}
      <aside className="hidden w-full shrink-0 flex-col gap-5 peer-checked:flex lg:sticky lg:top-16 lg:flex lg:w-(--products-sidebar-w) lg:max-h-[calc(100vh-5rem)] lg:self-start lg:overflow-y-auto lg:pr-2">
        {sidebar}
      </aside>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="拖拽调整筛选栏宽度"
        title="左右拖拽调整筛选栏宽度 · 双击恢复默认宽度"
        data-dragging={dragging ? 'true' : undefined}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        className={cn(
          'group/resizer relative mx-2 hidden w-3 shrink-0 cursor-col-resize self-stretch select-none lg:flex lg:items-stretch lg:justify-center',
        )}
      >
        <span
          className={cn(
            'w-px rounded-full bg-border/70 transition-colors group-hover/resizer:w-0.5 group-hover/resizer:bg-primary/50',
            dragging && 'w-0.5 bg-primary',
          )}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4">{children}</div>
    </div>
  )
}
