'use client'

import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

const format = (n: number, decimals: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

/**
 * 进入视口后从 0 滚动到目标数字。
 * 服务端渲染和「减少动态效果」时直接显示最终值，不会出现空白或错误数字。
 */
export function CountUp({
  value,
  duration = 1600,
  delay = 0,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
}: {
  value: number
  duration?: number
  delay?: number
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    let timer = 0
    setDisplay(0)
    const run = () => {
      const start = performance.now()
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / duration)
        setDisplay(value * (1 - Math.pow(1 - progress, 3)))
        if (progress < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        io.disconnect()
        timer = window.setTimeout(run, delay)
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
    }
  }, [value, duration, delay])

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {prefix}
      {format(display, decimals)}
      {suffix}
    </span>
  )
}
