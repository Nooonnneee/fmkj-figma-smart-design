/**
 * 方案 A：会员等级、权益配额与到期判断（网页端、服务端钩子、小程序端共用）。
 */
export const MEMBERSHIP_TIERS = [
  {
    value: 'free',
    label: '标准体验版',
    badge: '体验版',
    activeProjectLimit: 10,
    description: '个人点位绘制与基础报价',
    features: [
      '10 个进行中项目（归档不占额度）',
      '户型点位图与 34 类设备符号',
      '报价单、合同与交底清单 PDF 导出',
    ],
  },
  {
    value: 'pro',
    label: '专业设计师版',
    badge: '专业版',
    activeProjectLimit: 50,
    description: '独立设计师与工作室日常签单',
    features: [
      '50 个进行中项目',
      '全部 5 套文档风格与横版方案演示',
      '专属公司抬头、Logo 与默认条款',
    ],
  },
  {
    value: 'team',
    label: '旗舰集成商版',
    badge: '旗舰版',
    activeProjectLimit: null,
    description: '集成商与多角色施工协作团队',
    features: [
      '不限进行中项目数量',
      '多人项目协作（可编辑 / 仅查看授权）',
      '网页端、桌面端与小程序全端同步',
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
