import { describe, expect, it } from 'vitest'

import { AI_PANEL_BREAKPOINT, aiPanelMode, shouldShowAiPanel } from './ai-panel'

describe('aiPanelMode', () => {
  // 桌面客户端最小窗口 1024 和 1280 都不能并排（画布会被挤到 160 / 416px）
  it('窄于 1440 一律收成抽屉', () => {
    expect(aiPanelMode(1024)).toBe('drawer')
    expect(aiPanelMode(1280)).toBe('drawer')
    expect(aiPanelMode(AI_PANEL_BREAKPOINT - 1)).toBe('drawer')
  })

  it('1440 及以上三列并排', () => {
    expect(aiPanelMode(AI_PANEL_BREAKPOINT)).toBe('inline')
    expect(aiPanelMode(1600)).toBe('inline')
  })
})

describe('shouldShowAiPanel', () => {
  // /ai 整页自己有一个 AiSidebarDock；右栏再渲染会变成两个会话实例
  it('/ai 页隐藏右栏', () => {
    expect(shouldShowAiPanel('/ai')).toBe(false)
    expect(shouldShowAiPanel('/ai/')).toBe(false)
  })

  it('其他页面显示右栏（含没有 dock 的 /ai/image 子页）', () => {
    expect(shouldShowAiPanel('/projects')).toBe(true)
    expect(shouldShowAiPanel('/projects/abc/point-map')).toBe(true)
    expect(shouldShowAiPanel('/ai/image')).toBe(true)
    expect(shouldShowAiPanel('/ai/image/style')).toBe(true)
  })
})
