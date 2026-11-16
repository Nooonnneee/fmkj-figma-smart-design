'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useRef, type ComponentProps, type FocusEvent, type MouseEvent } from 'react'

type HoverPrefetchLinkProps = Omit<ComponentProps<typeof Link>, 'href' | 'prefetch'> & {
  href: string
}

/** 同一时刻内最多发起一次预取，避免扫过多张卡片时把链路打满。 */
const PREFETCH_INTERVAL_MS = 300

/**
 * 只在鼠标移入 / 键盘聚焦时预取的路由链接。
 *
 * 默认 `next/link` 会在链接进入视口时预取整页 RSC。模板中心一屏十几张模板卡片，
 * 每张详情页的 RSC 约 100KB，生产线路 ~2Mbps 时会被预取并发占满，表现为
 * 「点了十几秒不跳」。这里关掉视口预取，改成用户真的把指针放上去、或 Tab 聚焦时
 * 才预取，语义不变（还是 `<a href>`，可键盘操作、可读屏）。
 */
export function HoverPrefetchLink({
  href,
  onMouseEnter,
  onFocus,
  ...props
}: HoverPrefetchLinkProps) {
  const router = useRouter()
  const prefetched = useRef(new Set<string>())
  const lastPrefetchAt = useRef(0)

  const prefetch = useCallback(() => {
    if (prefetched.current.has(href)) return
    const now = Date.now()
    if (now - lastPrefetchAt.current < PREFETCH_INTERVAL_MS) return
    lastPrefetchAt.current = now
    prefetched.current.add(href)
    router.prefetch(href)
  }, [href, router])

  return (
    <Link
      {...props}
      href={href}
      prefetch={false}
      onMouseEnter={(event: MouseEvent<HTMLAnchorElement>) => {
        prefetch()
        onMouseEnter?.(event)
      }}
      onFocus={(event: FocusEvent<HTMLAnchorElement>) => {
        prefetch()
        onFocus?.(event)
      }}
    />
  )
}
