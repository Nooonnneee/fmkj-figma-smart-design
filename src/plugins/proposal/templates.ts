/**
 * 方案模板：同一份点位与报价数据，六套版式框架的 8 章横版提案（前三套来自 Figma 设计稿 FGGahF8jZGnRLwcgZfJloK），
 * 外加不含价格、给安装团队的施工交底版。后台「方案模板」有数据时以后台为准（版式框架 × 视觉风格），这里是兜底的内置模板。
 */
import type { MembershipTier } from '@/lib/membership'

import type { DeckThemeId } from './deck/themes'
import { frameworkSections, type DeckSection, type ProposalFrameworkId } from './framework'

/** 方案点位的显示方式：number = 设计稿的编号圆点；symbol / product = 设备图标 / 产品图 */
export type ProposalMarkers = 'number' | 'symbol' | 'product'
export const isProposalMarkers = (v: unknown): v is ProposalMarkers => v === 'number' || v === 'symbol' || v === 'product'

export type ProposalTemplateDef = {
  /** 模板标识（网址参数、项目里保存的模板） */
  value: string
  label: string
  description: string
  framework: ProposalFrameworkId
  theme: DeckThemeId
  /** 实际使用的章节（按顺序） */
  sections: DeckSection[]
  markers: 'number' | 'symbol'
  /** 导出需要的会员等级 */
  tier: MembershipTier
  headline?: string | null
  tagline?: string | null
  coverPhoto?: string | null
  /** 强调色（#RRGGBB），留空沿用主题 */
  accent?: string | null
}

function builtin(value: string, label: string, framework: ProposalFrameworkId, theme: DeckThemeId, tier: MembershipTier, description: string): ProposalTemplateDef {
  return { value, label, description, framework, theme, sections: frameworkSections(framework), markers: framework === 'construction' ? 'symbol' : 'number', tier }
}

export const BUILTIN_PROPOSAL_TEMPLATES: ProposalTemplateDef[] = [
  builtin('qixu', '栖序雅致', 'full', 'qixu', 'free', '暖白纸色、灰紫强调、细体大编号，忠于设计稿的 8 章完整提案'),
  builtin('noir', '墨金臻选', 'full', 'noir', 'free', '深色画面、香槟金与衬线标题，适合别墅大宅的电子版演示'),
  builtin('grove', '原木自然', 'full', 'grove', 'free', '燕麦纸色、橄榄绿、圆角照片，适合原木与自然风住宅'),
  builtin('quick', '预算速览', 'budget', 'qixu', 'free', '封面、系统、投资与交付，几页讲清预算，适合初次报价'),
  builtin('azure', '智域科技', 'story', 'azure', 'pro', '深海蓝与电光青，先讲生活场景再讲预算，适合年轻业主'),
  builtin('mono', '素白极简', 'full', 'mono', 'pro', '纯白纸面与纯文字大字封面，克制高级，适合设计师工作室'),
  builtin('dawn', '晨曦暖调', 'story', 'dawn', 'pro', '奶油纸色与陶土橙、竖幅照片，以场景故事打动家庭用户'),
  builtin('jade', '东方雅韵', 'full', 'jade', 'pro', '宣纸色与青瓷绿、衬线标题，适合新中式与东方风住宅'),
  builtin('construction', '施工交底', 'construction', 'qixu', 'free', '点位代号与清单，不含价格，给安装团队'),
]

/** 兼容旧代码与落地页：内置模板的名称清单 */
export const PROPOSAL_TEMPLATES = BUILTIN_PROPOSAL_TEMPLATES
export const DEFAULT_PROPOSAL_TEMPLATE = 'qixu'

/** 旧版模板编号兼容：旧链接和已保存的默认值继续可用 */
const LEGACY_PROPOSAL_TEMPLATES: Record<string, string> = { modern: 'qixu', premium: 'noir' }

/** 在模板清单里找模板（支持旧编号），找不到返回 null */
export function resolveProposalTemplate(v: unknown, list: ProposalTemplateDef[] = BUILTIN_PROPOSAL_TEMPLATES): ProposalTemplateDef | null {
  if (typeof v !== 'string' || !v) return null
  const key = LEGACY_PROPOSAL_TEMPLATES[v] ?? v
  return list.find((t) => t.value === key) ?? null
}
