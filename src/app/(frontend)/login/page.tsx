import Image from 'next/image'
import { redirect } from 'next/navigation'

import { appAuth } from '@/lib/app-auth'
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE, pageTitle } from '@/lib/brand'

import { LoginForm } from './login-form'

export const metadata = { title: pageTitle('登录') }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  if (await appAuth.getCurrentUser()) redirect('/projects')
  const { from } = await searchParams
  const redirectTo = from?.startsWith('/') && !from.startsWith('//') ? from : '/projects'

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-2">
      <div className="hidden border-r bg-muted/40 p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <Image src="/brand/fmkj-logo.svg" alt={APP_NAME} width={436} height={120} unoptimized priority className="h-10 w-auto dark:hidden" />
          <Image src="/brand/fmkj-logo-white.svg" alt={APP_NAME} width={436} height={120} unoptimized priority className="hidden h-10 w-auto dark:block" />
          <span className="border-l pl-3 text-xs text-muted-foreground">{APP_TAGLINE}</span>
        </div>
        <div className="max-w-xl space-y-5">
          <p className="text-3xl font-semibold tracking-normal">在户型图上布好点位，几分钟出报价和合同</p>
          <p className="text-base leading-7 text-muted-foreground">{APP_DESCRIPTION}</p>
        </div>
      </div>
      <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex justify-center lg:hidden">
            <Image src="/brand/fmkj-logo-vertical.svg" alt={APP_NAME} width={200} height={290} unoptimized priority className="h-28 w-auto dark:hidden" />
            <Image src="/brand/fmkj-logo-vertical-white.svg" alt={APP_NAME} width={200} height={290} unoptimized priority className="hidden h-28 w-auto dark:block" />
          </div>
          <LoginForm redirectTo={redirectTo} />
        </div>
      </div>
    </main>
  )
}
