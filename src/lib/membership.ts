/**
 * 会员方案：等级、权益与到期判断（网页端、服务端钩子、小程序端共用，唯一来源）。
 *
 * 权益分三类：
 * 1. 额度：进行中项目数、每个项目的协作成员数、每月可领取的 AI 积分；
 * 2. 功能等级：方案模板（templates.ts / 后台「方案模板」）、插件（plugins/index.ts）、交付资料包各自标注所需等级；
 * 3. 通用：点位图、报价单、合同、交底清单、公司抬头等所有等级都能用。
 *
 * 是否真的限制由后台「会员设置」决定：提示模式（默认）只显示所需等级和升级入口；严格模式才拦截导出 / 启用 / 打包。
 */
export const MEMBERSHIP_TIERS = [
  {
    value: 'free',
    label: '标准体验版',
    badge: '体验版',
    price: '免费',
    activeProjectLimit: 10,
    collaboratorLimit: 2,
    monthlyCredits: 0,
    description: '个人设计师上手：点位、报价、合同、归档全流程',
    features: ['10 个进行中项目（归档不占额度）', '每个项目 2 位协作成员', '基础方案模板与基础插件', '报价单、合同与交底清单 PDF 导出'],
  },
  {
    value: 'pro',
    label: '专业设计师版',
    badge: '专业版',
    price: '兑换码开通',
    activeProjectLimit: 50,
    collaboratorLimit: 5,
    monthlyCredits: 300,
    description: '独立设计师与工作室：全部方案模板、交付资料包与扩展插件',
    features: ['50 个进行中项目', '每个项目 5 位协作成员', '全部方案模板与扩展插件', '交付资料包一键打包', '每月领取 300 AI 积分'],
  },
  {
    value: 'team',
    label: '旗舰集成商版',
    badge: '旗舰版',
    price: '兑换码开通',
    activeProjectLimit: null,
    collaboratorLimit: null,
    monthlyCredits: 1000,
    description: '集成商与施工团队：不限项目与协作成员，更多 AI 积分',
    features: ['不限进行中项目', '不限协作成员（可编辑 / 仅查看）', '专业版全部权益', '每月领取 1000 AI 积分'],
  },
] as const

export type MembershipTier = (typeof MEMBERSHIP_TIERS)[number]['value']

const TIER_RANK: Record<MembershipTier, number> = {
  free: 0,
  pro: 1,
  team: 2,
}

export function isMembershipTier(v: unknown): v is MembershipTier {
  return v === 'free' || v === 'pro' || v === 'team'
}

export function tierMeta(tier: MembershipTier) {
  return MEMBERSHIP_TIERS.find((t) => t.value === tier) ?? MEMBERSHIP_TIERS[0]
}

export function higherTier(a: MembershipTier, b: MembershipTier): MembershipTier {
  return TIER_RANK[a] >= TIER_RANK[b] ? a : b
}

/** 当前等级是否满足所需等级 */
export const meetsTier = (have: MembershipTier, need: MembershipTier) => TIER_RANK[have] >= TIER_RANK[need]

/** 所需等级的简称（标签上显示） */
export const tierBadge = (tier: MembershipTier) => tierMeta(tier).badge

/** 不属于模板 / 插件的会员功能 */
export const FEATURE_TIERS = {
  /** 交付资料包（ZIP 打包、合并 PDF） */
  package: 'pro',
} as const satisfies Record<string, MembershipTier>

/** 会员页权益对比表的固定行（方案模板、插件的行按清单动态生成） */
export const BENEFIT_ROWS: { label: string; hint?: string; values: Record<MembershipTier, string | boolean> }[] = [
  { label: '进行中项目', hint: '归档项目不占额度', values: { free: '10 个', pro: '50 个', team: '不限' } },
  { label: '每个项目的协作成员', values: { free: '2 人', pro: '5 人', team: '不限' } },
  { label: '点位图、报价单、合同、交底清单', values: { free: true, pro: true, team: true } },
  { label: '交付资料包', hint: 'ZIP 打包或合并为一份 PDF', values: { free: false, pro: true, team: true } },
  { label: '每月可领取 AI 积分', values: { free: false, pro: '300', team: '1000' } },
  { label: '公司抬头、Logo 与默认条款', values: { free: true, pro: true, team: true } },
  { label: '网页、小程序与桌面端', values: { free: true, pro: true, team: true } },
]

/**
 * 计算用户当前实际生效的会员状态（若设置了到期时间且已过期，则自动降级为 free）。
 */
export function resolveMembership(user: {
  membershipTier?: string | null
  membershipExpiresAt?: string | null
} | null | undefined) {
  const rawTier: MembershipTier = isMembershipTier(user?.membershipTier) ? user!.membershipTier : 'free'
  const expiresAt = user?.membershipExpiresAt ?? null
  const expired = Boolean(rawTier !== 'free' && expiresAt && new Date(expiresAt).getTime() < Date.now())
  const effectiveTier: MembershipTier = expired ? 'free' : rawTier
  const meta = tierMeta(effectiveTier)
  return {
    rawTier,
    effectiveTier,
    expired,
    expiresAt,
    label: meta.label,
    badge: meta.badge,
    activeProjectLimit: meta.activeProjectLimit,
    collaboratorLimit: meta.collaboratorLimit,
    monthlyCredits: meta.monthlyCredits,
  }
}

export type MembershipState = ReturnType<typeof resolveMembership>

/** 功能是否可用：满足等级，或会员设置为提示模式（只提示不拦截） */
export function featureAccess(state: Pick<MembershipState, 'effectiveTier'>, need: MembershipTier, strict: boolean) {
  const meets = meetsTier(state.effectiveTier, need)
  return { meets, allowed: meets || !strict, need }
}
