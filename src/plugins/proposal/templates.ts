/**
 * 方案模板：同一份点位与报价数据，三种视觉风格的 8 章横版提案（来自 Figma 设计稿 FGGahF8jZGnRLwcgZfJloK），
 * 外加不含价格、给安装团队的施工交底版。
 */
export const PROPOSAL_TEMPLATES = [
  { value: 'qixu', label: '栖序雅致', description: '暖白纸色、灰紫强调、细体大编号，忠于设计稿的 8 章提案', markers: 'number' },
  { value: 'noir', label: '墨金臻选', description: '深色画面、香槟金与衬线标题，适合别墅大宅的电子版演示', markers: 'number' },
  { value: 'grove', label: '原木自然', description: '燕麦纸色、橄榄绿、圆角照片，适合原木与自然风住宅', markers: 'number' },
  { value: 'construction', label: '施工交底', description: '点位代号与清单，不含价格，给安装团队', markers: 'symbol' },
] as const
export type ProposalTemplate = (typeof PROPOSAL_TEMPLATES)[number]['value']
export const isProposalTemplate = (v: unknown): v is ProposalTemplate => PROPOSAL_TEMPLATES.some((t) => t.value === v)
export const DEFAULT_PROPOSAL_TEMPLATE: ProposalTemplate = 'qixu'

/** 方案点位的显示方式：number = 设计稿的编号圆点；symbol / product = 设备图标 / 产品图 */
export type ProposalMarkers = 'number' | 'symbol' | 'product'
export const isProposalMarkers = (v: unknown): v is ProposalMarkers => v === 'number' || v === 'symbol' || v === 'product'

/** 旧版模板编号兼容：旧链接和已保存的默认值继续可用 */
const LEGACY_PROPOSAL_TEMPLATES: Record<string, ProposalTemplate> = { modern: 'qixu', premium: 'noir' }
export function resolveProposalTemplate(v: unknown): ProposalTemplate | null {
  if (isProposalTemplate(v)) return v
  return typeof v === 'string' ? (LEGACY_PROPOSAL_TEMPLATES[v] ?? null) : null
}
