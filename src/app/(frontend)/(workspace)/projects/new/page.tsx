import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { appAuth } from '@/lib/app-auth'
import { pageTitle } from '@/lib/brand'
import { getPayloadClient } from '@/lib/payload'
import { DEFAULT_PLATFORM, isProjectPlatform } from '@/lib/projects'

import { ProjectForm } from '../project-form'

export const metadata = { title: pageTitle('新建项目') }

export default async function NewProjectPage() {
  const user = await appAuth.getCurrentUser()
  if (!user) redirect('/login')
  // 主平台默认沿用自己上一个项目，通常同一个人长期做同一个平台
  const payload = await getPayloadClient()
  const last = await payload.find({
    collection: 'projects',
    where: { owner: { equals: user.id } },
    sort: '-createdAt',
    limit: 1,
    depth: 0,
    user,
    overrideAccess: false,
    select: { platform: true },
  })
  const lastPlatform = last.docs[0]?.platform
  const platform = isProjectPlatform(lastPlatform) && lastPlatform !== '待定' ? lastPlatform : DEFAULT_PLATFORM

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground">
        <Link href="/projects"><ChevronLeft className="size-4" />项目</Link>
      </Button>
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">新建项目</h1>
        <p className="text-sm text-muted-foreground">都可以先空着，之后在项目「信息」里补充。</p>
      </header>
      <ProjectForm initial={{ platform }} />
    </section>
  )
}
