import { BetaBadge } from '@/components/beta-badge'
import { PageHeader, PageShell } from '@/components/page-header'
import { loadOverview } from '@/plugins/ha-mcp/overview-loader'
import { assembleOverview } from '@/plugins/ha-mcp/overview'
import { appAuth } from '@/lib/app-auth'
import { pageTitle } from '@/lib/brand'
import { redirectToLogin } from '@/lib/login-redirect'

import { SmartHomeClient } from './smart-home-client'

export const metadata = { title: pageTitle('智能家居') }

/**
 * 智能家居独立页（服务器总览 + 桌面客户端直连 / 控制）。
 *
 * Server Component 职责：
 *   1. 校验登录（工作台页统一入口）；
 *   2. 读配置 + 拉现场数据（overview-loader）→ 纯函数聚合（overview.ts）；
 *   3. 把聚合好的纯结构 `SmartHomeData` 传进客户端组件作为回退数据。
 *
 * HC-3：客户端组件挂载后会检测桌面桥 `window.fanmengDesktop.ha`；有桥时
 * 改用主进程的实时数据，无桥时仍用这里的服务器数据（行为与改造前一致）。
 * 因此即使服务器未配置，也要把客户端组件挂载起来，否则桌面端永远没机会接管。
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
        description="查看已连接现场 Home Assistant 的状态；桌面客户端内可直接控制设备。"
        badge={<BetaBadge />}
      />
      <SmartHomeClient data={data} />
    </PageShell>
  )
}
