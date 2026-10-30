import { redirect } from 'next/navigation'

import { appAuth } from '@/lib/app-auth'
import { pageTitle } from '@/lib/brand'
import { DEFAULT_CONTRACT_TERMS } from '@/lib/contracts'
import { getPayloadClient } from '@/lib/payload'
import type { Media } from '@/payload-types'

import { CompanyForm } from './company-form'

export const metadata = { title: pageTitle('设置') }

export default async function SettingsPage() {
  const user = await appAuth.getCurrentUser()
  if (!user) redirect('/login')
  const payload = await getPayloadClient()
  const settings = await payload.findGlobal({ slug: 'company-settings', depth: 1, user, overrideAccess: false })
  const img = (m: unknown) => (m && typeof m === 'object' ? ((m as Media).url ?? null) : null)

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">设置</h1>
        <p className="text-sm text-muted-foreground">报价单、合同上的抬头和联系方式，以及新报价、新合同的默认内容</p>
      </header>
      <CompanyForm
        initial={{
          name: settings.name ?? '',
          slogan: settings.slogan ?? '',
          phone: settings.phone ?? '',
          email: settings.email ?? '',
          address: settings.address ?? '',
          qrCaption: settings.qrCaption ?? '',
          quoteNotes: settings.quoteNotes ?? '',
          contractTerms: settings.contractTerms ?? DEFAULT_CONTRACT_TERMS,
          printProductImages: settings.printProductImages !== false,
          logoUrl: img(settings.logo),
          qrCodeUrl: img(settings.qrCode),
        }}
      />
    </section>
  )
}
