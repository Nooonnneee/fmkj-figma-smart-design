import { describe, expect, it } from 'vitest'

import { activeNavUrl } from './nav-active'

// 侧边栏实际用到的全部入口（顺序无关）
const NAV = [
  '/projects',
  '/products',
  '/smart-home',
  '/knx',
  '/capabilities/business-card',
  '/settings',
  '/settings/reports',
  '/docs',
  '/capabilities/templates',
  '/capabilities/tools',
] as const

describe('activeNavUrl', () => {
  // 2026-11-14 用户报：「侧边栏点击能力中心的选项时一直属于点击状态，切换也还是」
  it('站在子路由时父级入口不再一起亮', () => {
    expect(activeNavUrl('/capabilities/templates', NAV)).toBe('/capabilities/templates')
    expect(activeNavUrl('/capabilities/tools', NAV)).toBe('/capabilities/tools')
    expect(activeNavUrl('/settings/reports', NAV)).toBe('/settings/reports')
  })

  it('站在父级路由时父级入口亮', () => {
    expect(activeNavUrl('/settings', NAV)).toBe('/settings')
    expect(activeNavUrl('/projects', NAV)).toBe('/projects')
  })

  it('KNX 与名片按自身条目精确高亮', () => {
    expect(activeNavUrl('/knx', NAV)).toBe('/knx')
    expect(activeNavUrl('/capabilities/business-card', NAV)).toBe('/capabilities/business-card')
  })

  it('进到详情页时归属到它所在的那一节', () => {
    expect(activeNavUrl('/projects/58eaa298/archive', NAV)).toBe('/projects')
    expect(activeNavUrl('/capabilities/business-card/x', NAV)).toBe('/capabilities/business-card')
  })

  it('能力页不在侧栏全集里时不高亮任何项', () => {
    // /capabilities 总览与插件详情可直接 URL 访问，但不是侧栏入口
    expect(activeNavUrl('/capabilities', NAV)).toBeNull()
    expect(activeNavUrl('/capabilities/ai-copilot', NAV)).toBeNull()
  })

  it('不在任何入口下时不亮', () => {
    expect(activeNavUrl('/login', NAV)).toBeNull()
    expect(activeNavUrl('/', NAV)).toBeNull()
  })

  it('父级与子级同时在夹具里时，最长匹配优先', () => {
    const urls = ['/capabilities', '/capabilities/tools']
    expect(activeNavUrl('/capabilities/tools', urls)).toBe('/capabilities/tools')
    expect(activeNavUrl('/capabilities', urls)).toBe('/capabilities')
    expect(activeNavUrl('/capabilities/unknown', urls)).toBe('/capabilities')
  })

  it('边界按 / 切，不做裸前缀匹配', () => {
    // `/knx` 不能匹配 `/knxx`；`/capabilities/business-card` 不能匹配其后的裸字符
    expect(activeNavUrl('/knxx', ['/knx'])).toBeNull()
    expect(activeNavUrl('/capabilities/business-cardx', ['/capabilities/business-card'])).toBeNull()
  })

  it('尾部斜杠不会误判', () => {
    // 真实 pathname 不带尾部斜杠；带进来也要认回同一条
    expect(activeNavUrl('/knx/', NAV)).toBe('/knx')
    expect(activeNavUrl('/capabilities/business-card/', NAV)).toBe('/capabilities/business-card')
  })
})
