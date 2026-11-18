import { describe, expect, it } from 'vitest'

import { homeNav, knxNav } from './app-sidebar'

/**
 * 侧边栏入口配置的纯数据回归：HA「智能家居」条目改用「客户端可用」标记后
 * 不应再被标成 beta；同时 KNX 的 Beta 显示保持不变（同一组件两种标记并存）。
 * 这些断言只在 nav 常量层面，避免为测试硬改组件结构与渲染。
 */
describe('侧边栏导航配置', () => {
  it('HA 智能家居入口标记为客户端可用（desktopOnly），且不再标 beta', () => {
    const ha = homeNav.find((i) => i.url === '/smart-home')
    expect(ha).toBeDefined()
    // 用「beta 取值 === false」显式断言：既不是 undefined 也不是 true。
    expect(ha!.desktopOnly).toBe(true)
    expect('beta' in ha!).toBe(false)
  })

  it('KNX 工程入口仍保留 Beta 标记', () => {
    const knx = knxNav.find((i) => i.url === '/knx')
    expect(knx).toBeDefined()
    expect(knx!.beta).toBe(true)
  })
})
