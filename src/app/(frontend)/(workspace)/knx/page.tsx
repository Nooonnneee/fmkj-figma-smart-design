import { Cable } from 'lucide-react'

import { EmptyState } from '@/components/empty-state'
import { PageHeader, PageShell } from '@/components/page-header'
import { pageTitle } from '@/lib/brand'

export const metadata = { title: pageTitle('KNX / ETS') }

/**
 * KNX / ETS 模块占位页（NV-3）。
 *
 * 第一期只保留模块位：不请求任何数据，登录守卫由 workspace layout 统一处理。
 */
export default function KnxPage() {
  return (
    <PageShell className="gap-5">
      <PageHeader
        title="KNX / ETS"
        description="面向使用 KNX 总线的现场：工程配置、设备清单与调试入口。"
      />
      <EmptyState
        icon={<Cable className="size-5" />}
        title="KNX 工程正在建设中"
        description="该模块正在建设中，敬请期待。"
      />
    </PageShell>
  )
}
