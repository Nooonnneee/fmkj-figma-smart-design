import Image from 'next/image'
import { redirect } from 'next/navigation'
import { FileSignature, MapPinned, ReceiptText } from 'lucide-react'

import { BrandMark } from '@/components/brand/brand-mark'
import { appAuth } from '@/lib/app-auth'
import { APP_NAME, APP_TAGLINE, COMPANY_NAME, pageTitle } from '@/lib/brand'

import { LoginForm } from './login-form'

export const metadata = { title: pageTitle('登录') }

const HIGHLIGHTS = [
  { icon: MapPinned, title: '户型点位', description: '上传户型图，拖拽布置灯光、安防、影音等设备点位' },
  { icon: ReceiptText, title: '一键报价', description: '按点位自动汇总产品与安装费，多套方案随时对比' },
  { icon: FileSignature, title: '合同归档', description: '客户确认报价即生成合同，签字交付后一键归档' },
] as const

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  if (await appAuth.getCurrentUser()) redirect('/projects')
  const { from } = await searchParams
  const redirectTo = from?.startsWith('/') && !from.startsWith('//') ? from : '/projects'

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-brand-night p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="pointer-events-none absolute -top-32 -left-32 size-120 rounded-full bg-brand-indigo/30 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <Image src="/brand/fmkj-logo-white.svg" alt={APP_NAME} width={436} height={120} unoptimized priority className="h-10 w-auto" />
          <span className="border-l border-white/20 pl-3 text-xs text-white/60">{APP_TAGLINE}</span>
        </div>

        <div className="relative max-w-md space-y-8">
          <BrandMark decorative className="size-16" />
          <p className="text-3xl font-semibold tracking-normal">在户型图上布好点位，几分钟出报价和合同</p>
          <ul className="space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="block text-sm text-white/60">{description}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} {COMPANY_NAME}</p>
      </aside>

      <div className="flex min-h-svh flex-col items-center justify-center px-4 py-10 sm:px-6">
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
