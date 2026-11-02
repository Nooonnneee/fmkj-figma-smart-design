import { cache } from 'react'

import { isMembershipTier } from '@/lib/membership'
import { getPayloadClient } from '@/lib/payload'
import type { User } from '@/payload-types'

import { isDeckTheme } from './deck/themes'
import { frameworkSections, isDeckSection, isProposalFramework } from './framework'
import { BUILTIN_PROPOSAL_TEMPLATES, type ProposalTemplateDef } from './templates'

/**
 * 方案模板清单（服务端）：后台「方案模板」里启用的模板；后台一个模板都没有时用内置模板。
 * 同一次请求里多处读取只查一次。
 */
export const loadProposalTemplates = cache(async (user: User | null): Promise<ProposalTemplateDef[]> => {
  const payload = await getPayloadClient()
  const res = await payload
    .find({ collection: 'proposal-templates', sort: 'sortOrder', limit: 100, depth: 1, overrideAccess: false, user: user ?? undefined })
    .catch(() => null)
  if (!res?.docs.length) return BUILTIN_PROPOSAL_TEMPLATES
  const builtinOf = new Map(BUILTIN_PROPOSAL_TEMPLATES.map((t) => [t.value, t]))
  const list = res.docs
    .filter((d) => d.enabled !== false)
    .map((d): ProposalTemplateDef => {
      const base = builtinOf.get(d.slug)
      const framework = isProposalFramework(d.framework) ? d.framework : (base?.framework ?? 'full')
      const rawSections = (d.sections ?? []).filter(isDeckSection)
      const sections =
        framework === 'story' && rawSections.length === 6 && !rawSections.includes('system')
          ? (['cover', 'scenes', 'zones', 'plans', 'system', 'investment', 'service'] as const)
          : rawSections
      const cover = d.coverImage && typeof d.coverImage === 'object' ? d.coverImage.url : null
      return {
        value: d.slug,
        label: d.name,
        description: d.description || base?.description || '',
        framework,
        theme: isDeckTheme(d.theme) ? d.theme : (base?.theme ?? 'qixu'),
        sections: sections.length ? [...sections] : frameworkSections(framework),
        markers: d.markers === 'symbol' || framework === 'construction' ? 'symbol' : 'number',
        tier: isMembershipTier(d.tier) ? d.tier : (base?.tier ?? 'free'),
        headline: d.headline ?? null,
        tagline: d.tagline ?? null,
        coverPhoto: cover ?? null,
        accent: d.accent ?? null,
      }
    })
  return list.length ? list : BUILTIN_PROPOSAL_TEMPLATES
})
