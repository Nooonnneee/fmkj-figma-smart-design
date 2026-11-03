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
    label: 'Go 基础版',
    badge: 'Go',
    price: '免费',
    activeProjectLimit: 10,
    collaboratorLimit: 2,
    monthlyCredits: 0,
    description: '个人设计师入门：标准 AI 模型 + 点位、报价、合同核心流程',
    features: [
      '10 个进行中项目 · 每项目 2 人协作',
      'Go 标准高速国产模型（DeepSeek-V3 / 通义 Qwen-Plus / 豆包 Pro）',
      '3 套基础方案模板（栖序雅致 / 原木自然 / 预算速览）',
      '5 个基础插件（方案演示 / 房间分析 / 智能选型 / AI 识图 / 勘测单）',
    ],
  },
  {
    value: 'pro',
    label: 'Plus 专业版',
    badge: 'Plus',
    price: '兑换码开通',
    activeProjectLimit: 50,
    collaboratorLimit: 5,
    monthlyCredits: 300,
    description: '独立设计师与工作室主力：高阶视觉大模型 + 高定模板与施工插件 + 一键交付包',
    features: [
      '50 个进行中项目 · 每项目 5 人协作 · 每月赠 300 AI 积分',
      '解锁 Plus 高阶多模态与旗舰模型（Qwen-VL-Max / 豆包 Vision-Pro / 智谱 GLM-4V-Plus / Kimi K2）',
      '解锁 Plus 高定方案模板（墨金臻选 / 智域科技 / 晨曦暖调 / 素白极简）+ 6 套报价风格包',
      '解锁 Plus 专业插件（AI 对话侧栏 / DWG 导入 / 强弱电布线表 / 场景与账号移交单）',
      '解锁业主交付资料包（一键合并 PDF / ZIP 打包下载）',
    ],
  },
  {
    value: 'team',
    label: 'Pro 旗舰版',
    badge: 'Pro',
    price: '兑换码开通',
    activeProjectLimit: null,
    collaboratorLimit: null,
    monthlyCredits: 1000,
    description: '集成商与工程团队尊享：满血深度推理旗舰大模型 + 不限项目与成员 + 全套顶奢工程能力',
    features: [
      '不限进行中项目 · 不限项目协作成员 · 每月赠 1,000 AI 积分',
      '独占解锁 Pro 满血深度推理国产旗舰（DeepSeek-R1 满血版 / 通义 QwQ-Plus / QVQ-Max / 豆包深度思考）',
      '包含 Plus 全部高定模板与插件 + 独占「东方雅韵」顶奢别墅提案模板',
      '独占解锁工程级「采购与备货核验单」与「售后维保记录」插件',
    ],
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
  {
    label: 'AI 大模型支持',
    hint: '模型选择器内均标有 Go / Plus / Pro 专属标识',
    values: {
      free: 'Go 标准高速（DeepSeek-V3 / Qwen-Plus / 豆包 Pro）',
      pro: 'Plus 高阶多模态（Qwen-VL-Max / GLM-4V-Plus / Kimi K2）',
      team: 'Pro 满血深度推理（DeepSeek-R1 / QwQ-Plus / QVQ-Max）',
    },
  },
  { label: '点位图、报价单、合同、交底清单', values: { free: true, pro: true, team: true } },
  { label: '业主交付资料包（ZIP / 合并 PDF）', hint: '归档页一键合并全部交付文档', values: { free: false, pro: true, team: true } },
  { label: '每月免费赠送 AI 积分', values: { free: false, pro: '300 积分/月', team: '1,000 积分/月' } },
  { label: '强弱电布线表 / DWG 导入 / 场景移交单', values: { free: false, pro: true, team: true } },
  { label: '采购与备货核验单 / 顶奢「东方雅韵」模板', values: { free: false, pro: false, team: true } },
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
