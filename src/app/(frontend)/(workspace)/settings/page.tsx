
import { PageHeader } from '@/components/page-header'
import { allStyles, availableStyles, DOC_KIND_LIST, DOC_KINDS } from '@/documents/registry'
import { appAuth } from '@/lib/app-auth'
import { pageTitle } from '@/lib/brand'
import { getBrands, getCatalog, getCompanyInfo } from '@/lib/cached-data'
import { DEFAULT_CONTRACT_TERMS } from '@/lib/contracts'
import { loadCostSettings } from '@/lib/services/cost-settings-service'
import { getPluginFlags } from '@/plugins/state'

import { AppearanceSettings } from './appearance-settings'
import { CompanyForm } from './company-form'
import { CostSettingsCard, type CostBrandOption } from './cost-settings'
import { redirectToLogin } from '@/lib/login-redirect'

export const metadata = { title: pageTitle('设置') }

export default async function SettingsPage() {
  const user = await appAuth.getCurrentUser()
  if (!user) return redirectToLogin()
  const [company, flags, costSettings, brands, catalog] = await Promise.all([getCompanyInfo(user.id), getPluginFlags(user.id), loadCostSettings(user), getBrands(), getCatalog()])
  const enabledStyles = new Set(availableStyles(flags).map((s) => s.id))
  // 品牌按在售产品数排序：常用品牌排在前面
  const productCount = new Map<string, number>()
  for (const p of catalog) if (p.brand && (p.status ?? 'active') === 'active') productCount.set(p.brand.slug, (productCount.get(p.brand.slug) ?? 0) + 1)
  const costBrands: CostBrandOption[] = brands
    .map((b) => ({ slug: b.slug, name: b.name, logo: b.logo, products: productCount.get(b.slug) ?? 0 }))
    .filter((b) => b.products > 0 || costSettings.brandRates.some((r) => r.brand === b.slug))
    .sort((a, b) => b.products - a.products || a.name.localeCompare(b.name, 'zh'))

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <PageHeader title="设置" description="外观主题、报价单与合同抬头、联系方式，以及报价内部成本与毛利规则" />
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
      <CostSettingsCard initial={costSettings} brands={costBrands} />
    </section>
  )
}
