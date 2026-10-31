/**
 * 方案 A：会员等级、权益配额与到期判断（网页端、服务端钩子、小程序端共用）。
 */
export const MEMBERSHIP_TIERS = [
  {
    value: 'free',
    label: '标准体验版',
    badge: '体验版',
    activeProjectLimit: 10,
    description: '适合个人初步体验全屋智能点位图、选型与报价流程',
    features: [
      '最多同时进行 10 个活跃项目（归档项目不占额度）',
      '完整户型点位图绘制与 34 类设备图标',
      '标准报价单、合同与交底清单导出 PDF',
      '新账号赠送初始体验 AI 积分',
    ],
  },
  {
    value: 'pro',
    label: '专业设计师版',
    badge: '专业版',
    activeProjectLimit: 50,
    description: '适合独立智能家居设计师与工作室日常签单交付',
    features: [
      '最多同时进行 50 个活跃项目',
      '解锁全部 5 套高阶文档风格与「栖序提案」横版方案',
      '专属个人/工作室抬头、Logo、二维码与默认合同条款',
      'AI 户型图点位识别与 AI 方案助手优先通道',
    ],
  },
  {
    value: 'team',
    label: '旗舰集成商版',
    badge: '旗舰版',
    activeProjectLimit: null,
    description: '适合智能家居集成商与多设计师施工协作团队',
    features: [
      '不限进行中项目数量',
      '不限人数项目协作链接（可编辑 / 仅查看分级授权）',
      '全套高阶方案演示、分区图文报价与三方交底清单',
      '电脑网页端 + 微信小程序全功能同步',
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
  }
}
