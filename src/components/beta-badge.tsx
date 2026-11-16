'use client'

import { Badge } from '@astryxdesign/core/Badge'
import { Tooltip } from '@astryxdesign/core/Tooltip'

import { BETA_DOC_HINT } from '@/components/beta-doc-link'
import { cn } from '@/lib/utils'

/**
 * 「开发中的模块」统一 Beta 标签。
 *
 * 口径与 BetaDocLink 保持一致（见 components/beta-doc-link.tsx）：
 * `variant="warning"` + 文案 `BETA_DOC_HINT`，不另造一套。
 * 侧栏折叠成图标时由调用方传 `group-data-[collapsible=icon]:hidden` 隐藏。
 */
export function BetaBadge({ className }: { className?: string }) {
  return (
    <Tooltip content={BETA_DOC_HINT} placement="below">
      <Badge variant="warning" label="Beta" className={cn('shrink-0', className)} />
    </Tooltip>
  )
}
