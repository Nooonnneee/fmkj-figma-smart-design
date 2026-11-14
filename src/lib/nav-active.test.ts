import { describe, expect, it } from 'vitest'

import { activeNavUrl } from './nav-active'

// 侧边栏实际用到的全部入口（顺序无关）
const NAV = [
  '/projects',
  '/products',
  '/capabilities',
  '/capabilities/templates',
  '/capabilities/tools',
  '/ai',
  '/ai/image',
  '/ai/image/style',
  '/settings',
  '/settings/reports',
  '/docs',
] as const

describe('activeNavUrl', () => {
  // 2026-11-14 用户报：「侧边栏点击能力中心的选项时一直属于点击状态，切换也还是」
  it('站在子路由时父级入口不再一起亮', () => {
    expect(activeNavUrl('/capabilities/templates', NAV)).toBe('/capabilities/templates')
    expect(activeNavUrl('/capabilities/tools', NAV)).toBe('/capabilities/tools')
    expect(activeNavUrl('/ai/image', NAV)).toBe('/ai/image')
    expect(activeNavUrl('/ai/image/style', NAV)).toBe('/ai/image/style')
    expect(activeNavUrl('/settings/reports', NAV)).toBe('/settings/reports')
  })

  it('站在父级路由时父级入口亮', () => {
    expect(activeNavUrl('/capabilities', NAV)).toBe('/capabilities')
    expect(activeNavUrl('/ai', NAV)).toBe('/ai')
    expect(activeNavUrl('/projects', NAV)).toBe('/projects')
  })

  it('进到详情页时归属到它所在的那一节', () => {
    expect(activeNavUrl('/projects/58eaa298/archive', NAV)).toBe('/projects')
    expect(activeNavUrl('/capabilities/ai-image', NAV)).toBe('/capabilities')
  })

  it('不在任何入口下时不亮', () => {
    expect(activeNavUrl('/login', NAV)).toBeNull()
    expect(activeNavUrl('/', NAV)).toBeNull()
  })

  it('边界按 / 切，不做裸前缀匹配', () => {
    // `/ai` 不能匹配 `/aii`；`/capabilities` 不能匹配 `/capabilitiesx`
    expect(activeNavUrl('/aii', ['/ai'])).toBeNull()
    expect(activeNavUrl('/capabilitiesx', ['/capabilities'])).toBeNull()
  })

  it('尾部斜杠不会误判', () => {
    // 真实 pathname 不带尾部斜杠；带进来也要认回同一条
    expect(activeNavUrl('/ai/image/', NAV)).toBe('/ai/image')
  })
})
