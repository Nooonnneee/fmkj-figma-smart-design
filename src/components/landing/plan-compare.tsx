'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronsLeftRight } from 'lucide-react'

import { PlanFigure } from '@/components/plan-figure'
import type { LandingPlan } from '@/lib/landing-plan'

/**
 * 原始图纸 ↔ 设计后点位图 对照：分割线自动往返扫过，访客拖动后交由手动控制。
 * 左侧为设计后（分区 + 点位），右侧为原始图纸。
 */
export function PlanCompare({ plan }: { plan: LandingPlan }) {
  const [pos, setPos] = useState(50)
  const [auto, setAuto] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!auto) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = ref.current
    let raf = 0
    let visible = false
    let t0 = performance.now()
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible) t0 = performance.now()
    })
    if (el) io.observe(el)
    const PERIOD = 7000
    const tick = (now: number) => {
      if (visible) {
        // 余弦往返：两端稍作停留，中段平滑扫过
        const phase = ((now - t0) % PERIOD) / PERIOD
        setPos(50 - 44 * Math.cos(phase * Math.PI * 2))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
    }
  }, [auto])

  const fromPointer = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)))
  }

  return (
    <div
      ref={ref}
      className="relative cursor-ew-resize touch-pan-y overflow-hidden rounded-xl select-none"
      onPointerDown={(e) => {
        setAuto(false)
        e.currentTarget.setPointerCapture(e.pointerId)
        fromPointer(e.clientX)
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e.clientX)
      }}
    >
      <PlanFigure sheetUrl={plan.sheetUrl} points={[]} showAreas={false} dim={1} />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <PlanFigure sheetUrl={plan.sheetUrl} points={plan.points} areas={plan.areas} showCodes={false} dim={0.4} className="size-full" />
      </div>

      <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-neutral-900/80 px-2.5 py-1 text-xs font-medium text-white">智能设计 · {plan.points.length} 个点位</span>
      <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-neutral-700 shadow-sm">原始图纸</span>

      <div aria-hidden className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-primary shadow-[0_0_12px_var(--color-primary)]" style={{ left: `${pos}%` }}>
        <span className="absolute top-1/2 left-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
          <ChevronsLeftRight className="size-4" />
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(pos)}
        aria-label="拖动对比原始图纸与设计后点位图"
        onChange={(e) => {
          setAuto(false)
          setPos(Number(e.target.value))
        }}
        className="sr-only"
      />
    </div>
  )
}
