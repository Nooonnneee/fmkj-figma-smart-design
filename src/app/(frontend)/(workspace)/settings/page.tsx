import { redirect } from 'next/navigation'

import { allStyles, availableStyles, DOC_KIND_LIST, DOC_KINDS } from '@/documents/registry'
import { appAuth } from '@/lib/app-auth'
import { pageTitle } from '@/lib/brand'
import { getCompanyInfo } from '@/lib/cached-data'
import { DEFAULT_CONTRACT_TERMS } from '@/lib/contracts'
import { getPayloadClient } from '@/lib/payload'
import type { Media } from '@/payload-types'
import { getConfiguredEnvStatus } from '@/plugins/ai-copilot/server'
import { getPluginFlags } from '@/plugins/state'

import { CompanyForm } from './company-form'

export const metadata = { title: pageTitle('设置') }

export default async function SettingsPage() {
  const user = await appAuth.getCurrentUser()
  if (!user) redirect('/login')
  const payload = await getPayloadClient()
  const [settings, company, flags] = await Promise.all([payload.findGlobal({ slug: 'company-settings', depth: 1, user, overrideAccess: false }), getCompanyInfo(), getPluginFlags()])
  const enabledStyles = new Set(availableStyles(flags).map((s) => s.id))
  const img = (m: unknown) => (m && typeof m === 'object' ? ((m as Media).url ?? null) : null)

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">设置</h1>
        <p className="text-sm text-muted-foreground">抬头和联系方式、新报价和合同的默认内容、各类文档默认模板，以及多 AI 模型与网关配置</p>
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
        documents={{
          kinds: DOC_KIND_LIST.map((kind) => ({ kind, label: DOC_KINDS[kind].label, layouts: DOC_KINDS[kind].layouts.map((l) => ({ value: l.value, label: l.label })) })),
          styles: allStyles().map((s) => ({ id: s.id, name: s.name, description: s.description, swatch: [s.colors.paper, s.colors.accent, s.colors.headBg], enabled: enabledStyles.has(s.id) })),
          defaults: company.documentDefaults,
        }}
        aiModels={company.aiModels}
        aiEnvStatus={getConfiguredEnvStatus(company.aiModels)}
      />
    </section>
  )
}
