import { PageHeader } from '@/components/page-header'
import { appAuth } from '@/lib/app-auth'
import { pageTitle } from '@/lib/brand'
import { redirectToLogin } from '@/lib/login-redirect'
import { loadCustomerUsageReport } from '@/lib/usage-diagnostics'

import { UsageReportsClient } from './reports-client'

export const metadata = { title: pageTitle('客户使用与诊断报告') }

export default async function CustomerUsageReportsPage() {
  const user = await appAuth.getCurrentUser()
  if (!user) return redirectToLogin()
  const report = await loadCustomerUsageReport()

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <PageHeader
        title="客户使用与运维诊断报告"
        description="实时汇总客户项目转化漏斗、户型图 CAD 识别复盘、AI 模型 Auto 路由分布与异常排障日志"
      />
      <UsageReportsClient report={report} />
    </section>
  )
}
