import { redirect } from 'next/navigation'

import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { appAuth } from '@/lib/app-auth'
import { getCompanyInfo } from '@/lib/cached-data'
import { resolveMembership } from '@/lib/membership'
import { getPayloadClient } from '@/lib/payload'
import { PLUGINS } from '@/plugins'
import { aiConfigured } from '@/plugins/ai-copilot/server'
import { enabledAiModels } from '@/plugins/ai-copilot/templates'

/** 需要成员登录的系统页面。 */
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await appAuth.getCurrentUser()
  if (!user) redirect('/login')
  const payload = await getPayloadClient()
  const [company, projectsRes] = await Promise.all([
    getCompanyInfo(user.id),
    payload
      .find({
        collection: 'projects',
        where: { status: { not_equals: 'archived' } },
        sort: '-updatedAt',
        limit: 12,
        depth: 0,
        user,
        overrideAccess: false,
        select: { name: true, customerName: true, platform: true, pointCount: true },
      })
      .catch(() => ({ docs: [] })),
  ])

  const disabled = new Set(company.disabledPlugins)
  const plugins = PLUGINS.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    enabled: p.status === 'ready' && !disabled.has(p.id),
    where: p.where,
    provides: p.provides,
  }))
  const projects = projectsRes.docs.map((proj) => ({
    id: String(proj.id),
    name: proj.name,
    customerName: proj.customerName ?? null,
    platform: proj.platform ?? null,
    pointCount: proj.pointCount ?? 0,
  }))

  const activeAiModels = enabledAiModels(company.aiModels)
  const membership = resolveMembership(user as never)

  return (
    <SidebarProvider>
      <AppSidebar
        user={{ name: user.name, email: user.email, membershipBadge: membership.badge }}
        brand={{ name: company.name, logo: company.logo?.url ?? null }}
        plugins={plugins}
        projects={projects}
        ai={{ credits: user.aiCredits ?? 0, configured: aiConfigured(activeAiModels), models: activeAiModels }}
      />
      <SidebarInset>
        <SiteHeader />
        {/* SidebarInset 本身就是 <main>，这里用 div，避免页面出现两个 main 区域 */}
        <div data-slot="workspace-page" className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-5 md:px-8 md:py-7">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
