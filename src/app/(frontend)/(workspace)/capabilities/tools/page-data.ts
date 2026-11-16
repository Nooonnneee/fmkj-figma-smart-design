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
 * 每张卡片的视觉元数据：真实成品封面 + 封面标签 + 底部规格。
 * 封面图是工具真实导出的成品（名片成品 / 平台示例户型图），
 * 而不是图标或色块，用户能直接看出打开后能得到什么。
 */
export type ToolCardMeta = {
  /** 封面图路径：静态 public 资源，形如 `/tool-covers/xxx.jpg` */
  cover: string
  /** 封面替代文本：中文描述画面内容，不作为文件名重复 */
  coverAlt: string
  /** 封面左上角标签：说明工具能做什么、有多少套可选 */
  chip: string
  /** 卡片底部一行小标签：导出规格或使用路径 */
  footer: string
}

export const TOOL_CARD_META: Record<(typeof FEATURED_TOOL_IDS)[number], ToolCardMeta> = {
  'business-card': {
    cover: '/tool-covers/business-card.jpg',
    coverAlt: '繁梦空间名片正面成品示例，米白纸版上的工具名与版式排版',
    chip: '4 套版式 · 正反面',
    footer: 'PNG · 300dpi 导出',
  },
  'floor-plan-style': {
    cover: '/tool-covers/floor-plan.jpg',
    coverAlt: '户型图风格化后的家具彩平示例，保留墙体结构并铺上家具与配色',
    chip: '10 套风格 · 保留户型结构',
    footer: '上传户型图 → 家具彩平',
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
