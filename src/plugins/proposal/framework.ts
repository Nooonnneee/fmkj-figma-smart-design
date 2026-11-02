/**
 * 方案模板框架：一份方案 = 若干「章节」按顺序组合。章节是固定的页面组件（deck/pages），
 * 「结构」是一组推荐的章节顺序；模板（templates.ts / 后台「方案模板」）在结构的基础上选主题、调章节、换文案。
 */

export const DECK_SECTIONS = [
  { value: 'cover', label: '封面', description: '品牌、标题、项目与预算' },
  { value: 'plans', label: '住宅平面', description: '每张图纸一页，点位编号与索引' },
  { value: 'system', label: '系统与设备', description: '网络拓扑、设备类别与配置原则' },
  { value: 'zones', label: '空间章节', description: '进门、休息、看护、专注四个空间章节' },
  { value: 'scenes', label: '生活场景', description: '场景库匹配到的场景：图片、联动步骤与实际产品' },
  { value: 'rooms', label: '其余空间', description: '没有展开的房间：设备与小计' },
  { value: 'investment', label: '投资明细', description: '设备清单、费用与合计' },
  { value: 'service', label: '服务交付', description: '服务流程、付款节点与签字确认' },
] as const
export type DeckSection = (typeof DECK_SECTIONS)[number]['value']
export const isDeckSection = (v: unknown): v is DeckSection => DECK_SECTIONS.some((s) => s.value === v)

export const PROPOSAL_FRAMEWORKS = [
  {
    value: 'full',
    label: '完整提案',
    description: '8 章完整提案：平面 → 系统 → 空间 → 场景 → 投资 → 交付，适合正式汇报',
    sections: ['cover', 'plans', 'system', 'zones', 'scenes', 'rooms', 'investment', 'service'],
  },
  {
    value: 'story',
    label: '场景故事',
    description: '先讲生活场景，再落到空间、平面与预算，适合首次沟通打动业主',
    sections: ['cover', 'scenes', 'zones', 'plans', 'system', 'investment', 'service'],
  },
  {
    value: 'budget',
    label: '预算速览',
    description: '封面 + 系统 + 投资 + 交付，几页讲清预算，适合快速报价',
    sections: ['cover', 'system', 'investment', 'service'],
  },
  {
    value: 'construction',
    label: '施工交底',
    description: '点位代号与清单，不含价格，给安装团队',
    sections: [],
  },
] as const satisfies readonly { value: string; label: string; description: string; sections: readonly DeckSection[] }[]
export type ProposalFrameworkId = (typeof PROPOSAL_FRAMEWORKS)[number]['value']
export const isProposalFramework = (v: unknown): v is ProposalFrameworkId => PROPOSAL_FRAMEWORKS.some((f) => f.value === v)
export const frameworkSections = (id: ProposalFrameworkId): DeckSection[] => [...(PROPOSAL_FRAMEWORKS.find((f) => f.value === id)?.sections ?? [])]
export const frameworkLabel = (id: ProposalFrameworkId) => PROPOSAL_FRAMEWORKS.find((f) => f.value === id)?.label ?? id
