import { describe, expect, it } from 'vitest'

import { FEATURED_TOOL_IDS, filterFeaturedTools, TOOL_CARD_META } from './page-data'

type FakeTool = { id: string; name: string }

const allFive: FakeTool[] = [
  { id: 'ai-chat', name: 'AI 对话' },
  { id: 'ai-image', name: 'AI 生图' },
  { id: 'business-card', name: '名片' },
  { id: 'floor-plan-style', name: '户型图风格化' },
  { id: 'proposal-templates', name: '方案模板库' },
]

describe('filterFeaturedTools 白名单过滤', () => {
  it('喂 5 类工具，只剩白名单里的 2 类，其它全被删掉', () => {
    const result = filterFeaturedTools(allFive)
    expect(result.map((t) => t.id)).toEqual(['business-card', 'floor-plan-style'])
    expect(result).toHaveLength(2)
  })

  it('被删工具（AI 对话 / AI 生图 / 方案模板）无一进入结果', () => {
    const result = filterFeaturedTools(allFive)
    const ids = new Set(result.map((t) => t.id))
    expect(ids.has('ai-chat')).toBe(false)
    expect(ids.has('ai-image')).toBe(false)
    expect(ids.has('proposal-templates')).toBe(false)
  })

  it('顺序始终是白名单顺序 business-card 在前，不随输入顺序变化', () => {
    const shuffled: FakeTool[] = [
      { id: 'floor-plan-style', name: '户型图风格化' },
      { id: 'business-card', name: '名片' },
    ]
    expect(filterFeaturedTools(shuffled).map((t) => t.id)).toEqual([
      'business-card',
      'floor-plan-style',
    ])
  })

  it('输入里缺白名单 id 时，缺了就跳过，不 favor 假绿', () => {
    // 只传 business-card，strategy 存在但 floor-plan-style 缺失 → 只返回 1 项
    expect(filterFeaturedTools([allFive[2]!]).map((t) => t.id)).toEqual(['business-card'])
  })

  it('空输入返回空数组，不炸', () => {
    expect(filterFeaturedTools([])).toEqual([])
  })
})

describe('展示范围静态约束', () => {
  it('本页固定只展示 business-card 和 floor-plan-style 两项', () => {
    expect(FEATURED_TOOL_IDS).toEqual(['business-card', 'floor-plan-style'])
  })

  it('两张 featured 工具都指向 public 下的真实封面图', () => {
    for (const id of FEATURED_TOOL_IDS) {
      expect(TOOL_CARD_META[id].cover.startsWith('/tool-covers/')).toBe(true)
    }
  })

  it('封面 alt 非空且用中文描述工具成品', () => {
    const expectedAltKeyword = {
      'business-card': '名片',
      'floor-plan-style': '户型',
    } as const

    for (const id of FEATURED_TOOL_IDS) {
      const { coverAlt } = TOOL_CARD_META[id]
      expect(coverAlt.trim().length).toBeGreaterThan(0)
      expect(coverAlt).toContain(expectedAltKeyword[id])
    }
  })

  it('每张卡的封面标签和底部规格都非空', () => {
    for (const id of FEATURED_TOOL_IDS) {
      expect(TOOL_CARD_META[id].chip.trim().length).toBeGreaterThan(0)
      expect(TOOL_CARD_META[id].footer.trim().length).toBeGreaterThan(0)
    }
  })
})
