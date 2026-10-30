/** 方案模板：同一份点位数据，四种呈现方式。 */
export const PROPOSAL_TEMPLATES = [
  { value: 'qixu', label: '栖序提案', description: '暖白纸色、灰紫强调，含服务交付与付款确认页', markers: 'product' },
  { value: 'modern', label: '现代简约', description: '白底细线，适合大多数客户', markers: 'symbol' },
  { value: 'premium', label: '高端提案', description: '深色封面、产品图点位，适合别墅大宅', markers: 'product' },
  { value: 'construction', label: '施工交底', description: '点位代号与清单，不含价格，给安装团队', markers: 'symbol' },
] as const
export type ProposalTemplate = (typeof PROPOSAL_TEMPLATES)[number]['value']
export const isProposalTemplate = (v: unknown): v is ProposalTemplate => PROPOSAL_TEMPLATES.some((t) => t.value === v)
