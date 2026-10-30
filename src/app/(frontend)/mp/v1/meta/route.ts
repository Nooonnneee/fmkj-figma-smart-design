import { AREA_TYPES } from '@/lib/area-types'
import { getCompanyInfo } from '@/lib/cached-data'
import { CONTRACT_STATUSES } from '@/lib/contracts'
import { DEVICE_CATEGORIES, DEVICE_TYPE_ORDER } from '@/lib/device-types'
import { wechatConfigured } from '@/lib/mp/auth'
import { mpRoute, ok } from '@/lib/mp/http'
import { presentType } from '@/lib/mp/present'
import { POINT_SCOPES } from '@/lib/point-scopes'
import { PROJECT_PLATFORMS } from '@/lib/projects'
import { QUOTE_STATUSES } from '@/lib/quotes'
import { PLUGINS } from '@/plugins'
import { aiConfigured } from '@/plugins/ai-copilot/server'
import { AI_MODELS, DEFAULT_AI_TEMPLATES, fillPromptTemplate } from '@/plugins/ai-copilot/templates'
import { SELECTION_TIERS } from '@/plugins/smart-select/auto-select'
import { getPluginFlags } from '@/plugins/state'

/** 字典与配置：设备类别和类型、平台、状态、点位范围、AI 模型和模板、已启用插件、公司抬头。 */
export const GET = mpRoute(async () => {
  const [company, flags] = await Promise.all([getCompanyInfo(), getPluginFlags()])
  return ok({
    categories: DEVICE_CATEGORIES.map((c) => ({ slug: c.slug, name: c.name, code: c.code, color: c.color })),
    deviceTypes: DEVICE_TYPE_ORDER.map((t) => presentType(t)),
    platforms: PROJECT_PLATFORMS,
    quoteStatuses: QUOTE_STATUSES.map((s) => ({ value: s.value, label: s.label })),
    contractStatuses: CONTRACT_STATUSES.map((s) => ({ value: s.value, label: s.label })),
    pointScopes: POINT_SCOPES.map((s) => ({ value: s.value, label: s.label, fullLabel: s.fullLabel })),
    areaTypes: AREA_TYPES.map((a) => ({ value: a.value, label: a.label })),
    selectionTiers: SELECTION_TIERS.map((t) => ({ value: t.value, label: t.label })),
    aiModels: AI_MODELS.map((m) => ({ id: m.id, name: m.name, tag: m.tag, cost: m.cost })),
    aiTemplates: DEFAULT_AI_TEMPLATES.map((t) => ({ id: t.id, name: t.name, category: t.category, prompt: fillPromptTemplate(t, {}) })),
    plugins: PLUGINS.filter((p) => flags[p.id]).map((p) => ({ id: p.id, name: p.name })),
    ai: aiConfigured(),
    wechatLogin: wechatConfigured(),
    company: {
      name: company.name,
      slogan: company.slogan,
      phone: company.phone,
      email: company.email,
      address: company.address,
      logo: company.logo?.url ?? null,
      qrCode: company.qrCode?.url ?? null,
      qrCaption: company.qrCaption,
    },
  })
})
