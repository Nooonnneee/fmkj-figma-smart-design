
import { PageHeader } from '@/components/page-header'
import { allStyles, availableStyles, DOC_KIND_LIST, DOC_KINDS } from '@/documents/registry'
import { appAuth } from '@/lib/app-auth'
import { pageTitle } from '@/lib/brand'
import { getCompanyInfo } from '@/lib/cached-data'
import { DEFAULT_CONTRACT_TERMS } from '@/lib/contracts'
import { getPluginFlags } from '@/plugins/state'

import { AppearanceSettings } from './appearance-settings'
import { CompanyForm } from './company-form'
import { redirectToLogin } from '@/lib/login-redirect'

export const metadata = { title: pageTitle('设置') }

export default async function SettingsPage() {
  const user = await appAuth.getCurrentUser()
  if (!user) return redirectToLogin()
  const [company, flags] = await Promise.all([getCompanyInfo(user.id), getPluginFlags(user.id)])
  const enabledStyles = new Set(availableStyles(flags).map((s) => s.id))

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <PageHeader title="设置" />
      <AppearanceSettings />
      <CompanyForm
        initial={{
          name: company.name ?? '',
          slogan: company.slogan ?? '',
          phone: company.phone ?? '',
          email: company.email ?? '',
          address: company.address ?? '',
          qrCaption: company.qrCaption ?? '',
          quoteNotes: company.quoteNotes ?? '',
          contractTerms: company.contractTerms ?? DEFAULT_CONTRACT_TERMS,
          printProductImages: company.printProductImages !== false,
          logoUrl: company.logo?.url ?? null,
          qrCodeUrl: company.qrCode?.url ?? null,
        }}
        documents={{
          kinds: DOC_KIND_LIST.map((kind) => ({ kind, label: DOC_KINDS[kind].label, layouts: DOC_KINDS[kind].layouts.map((l) => ({ value: l.value, label: l.label })) })),
          styles: allStyles().map((s) => ({ id: s.id, name: s.name, description: s.description, swatch: [s.colors.paper, s.colors.accent, s.colors.headBg], enabled: enabledStyles.has(s.id) })),
          defaults: company.documentDefaults,
        }}
      />
    </section>
  )
}
