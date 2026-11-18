'use client'

import Link from 'next/link'

import { Badge } from '@astryxdesign/core/Badge'

import { cn } from '@/lib/utils'

/**
 * 「客户端可用」入口标签。
 *
 * 替代 HA 助手「智能家居」旧的 Beta 标签：文案不再是「开发中」，
 * 而是引导去 `/download` 下载桌面客户端。与 BetaBadge 不同，
 * 这个标签本身是真正的链接 —— 点击它直接进下载页，不触发行的其它跳转。
 * 侧栏折叠成图标时由调用方传 `group-data-[collapsible=icon]:hidden` 隐藏。
 */
export function ClientAvailableBadge({ className }: { className?: string }) {
  return (
    <Link
      href="/download"
      aria-label="客户端可用，前往下载"
      className={cn(
        'inline-flex shrink-0 no-underline transition-opacity',
        'hover:opacity-80 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-hidden rounded-full',
        className,
      )}
    >
      <Badge variant="success" label="客户端可用" />
    </Link>
  )
}
