import { redirect } from 'next/navigation'

import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { appAuth } from '@/lib/app-auth'
import { getCompanyInfo } from '@/lib/cached-data'

/** 需要成员登录的系统页面。 */
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const [user, company] = await Promise.all([appAuth.getCurrentUser(), getCompanyInfo()])
  if (!user) redirect('/login')

  return (
    <SidebarProvider>
      <AppSidebar user={{ name: user.name, email: user.email }} brand={{ name: company.name, logo: company.logo?.url ?? null }} />
      <SidebarInset>
        <SiteHeader />
        <main className="flex flex-1 flex-col gap-6 px-4 py-5 md:px-8 md:py-7">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
