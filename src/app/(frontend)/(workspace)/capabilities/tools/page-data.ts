/**
 * 「全部工具」页的展示范围与卡片数据。
 *
 * 页面只展示固定两张「点开即用的工具」：名片、户型图风格化。
 * 此类工具不分 AI 积分计费（直接在能力中心打开即可用），因此从
 * 能力中心/插件池里按 id 白名单筛出这两项；其它工具（AI 对话、AI 生图、
 * 方案模板、打印风格、客户报告等）不再在本页出现。
 *
 * `filterFeaturedTools` 是页面渲染前唯一会变的逻辑，保持纯函数以便单测
 * 直接断言「喂 5 类工具 → 只剩 2 类」，避免被渲染层源码字符串敷衍过去。
 */

/** 本页固定展示的工具 id（白名单，顺序即展示顺序）。 */
export const FEATURED_TOOL_IDS = ['business-card', 'floor-plan-style'] as const

/**
 * 每张卡片的视觉元数据：图标与彩色渐变背景。
 * 渐变 stop 全部走 Astryx 品牌 token（styles.css 的 `--color-brand-*`，
 * Tailwind v4 自动生成 from/to 工具类），不写 raw hex。
 */
export type ToolCardMeta = {
  gradient: string
  /** 图标落在渐变块上的前景色（对应当张卡的渐变明暗） */
  iconOnGradient: string
  /** 标题主色 */
  tintText: string
}

export const TOOL_CARD_META: Record<(typeof FEATURED_TOOL_IDS)[number], ToolCardMeta> = {
  'business-card': {
    gradient: 'from-brand-gold-deep to-brand-gold-light',
    iconOnGradient: 'text-brand-ink',
    tintText: 'text-brand-gold-deep',
  },
  'floor-plan-style': {
    gradient: 'from-brand-moon via-brand-indigo to-brand-violet',
    iconOnGradient: 'text-card',
    tintText: 'text-brand-indigo',
  },
}

type WithId = { id: string }

/**
 * 只保留白名单内的工具；白名单顺序优先，输入里没有的 id 直接跳过。
 * 输入里白名单外的工具一律被过滤掉（删除项不 favor 假绿）。
 */
export function filterFeaturedTools<T extends WithId>(tools: readonly T[]): T[] {
  const byId = new Map(tools.map((tool) => [tool.id, tool]))
  return FEATURED_TOOL_IDS.flatMap((id) => {
    const tool = byId.get(id)
    return tool ? [tool] : []
  })
}
