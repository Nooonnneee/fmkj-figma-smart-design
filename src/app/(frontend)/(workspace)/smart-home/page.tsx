import { Home } from 'lucide-react'

import { BetaBadge } from '@/components/beta-badge'
import { EmptyState } from '@/components/empty-state'
import { PageHeader, PageShell } from '@/components/page-header'
import { loadOverview } from '@/plugins/ha-mcp/overview-loader'
import { assembleOverview } from '@/plugins/ha-mcp/overview'
import { appAuth } from '@/lib/app-auth'
import { pageTitle } from '@/lib/brand'
import { redirectToLogin } from '@/lib/login-redirect'

import { SmartHomeClient } from './smart-home-client'

export const metadata = { title: pageTitle('智能家居') }

/**
 * 智能家居独立页（SM-2，第一期只读）。
 *
 * Server Component 职责：
 *   1. 校验登录（工作台页统一入口）；
 *   2. 读配置 + 拉现场数据（overview-loader）→ 纯函数聚合（overview.ts）；
 *   3. 把聚合好的纯结构 `SmartHomeData` 传进客户端组件渲染。
 *
 * 刻意不做（第一期）：控制开关（ha_call_service）、历史图表（ha_get_history）。
 */
export default async function SmartHomePage() {
  const user = await appAuth.getCurrentUser()
  if (!user) return redirectToLogin()

  const source = await loadOverview()
  const data = assembleOverview(source)

  return (
    <PageShell className="gap-5">
      <PageHeader
        title="智能家居"
        description="只读查看已连接现场 Home Assistant 的总览、实体列表与系统健康。"
        badge={<BetaBadge />}
      />
      {data.configured ? (
        <SmartHomeClient data={data} />
      ) : (
        <EmptyState
          icon={<Home className="size-5" />}
          title="还没有连接 Home Assistant"
          description={data.hint}
        />
      )}
    </PageShell>
  )
}
