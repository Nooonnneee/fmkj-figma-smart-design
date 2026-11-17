// @vitest-environment happy-dom
import * as React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// React 19 的 act() 需要显式声明测试环境。
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('next/navigation', () => ({
  usePathname: () => '/projects',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}))

// 外壳测试不加载真实 dock（它会发会话请求）；只保留 collapsed / 收起回调的接线。
vi.mock('./ai-sidebar-dock', () => ({
  AiSidebarDock: ({
    collapsed,
    onToggleCollapsed,
  }: {
    collapsed?: boolean
    onToggleCollapsed?: () => void
  }) => (
    <button
      type="button"
      data-testid="dock-stub"
      data-collapsed={collapsed ? 'true' : 'false'}
      aria-label={collapsed ? '展开 AI 对话' : '收起 AI 对话'}
      onClick={onToggleCollapsed}
    />
  ),
}))

vi.mock('next/dynamic', async () => {
  const { AiSidebarDock } = await import('./ai-sidebar-dock')
  return { default: () => AiSidebarDock }
})

vi.mock('@/hooks/use-viewport-width', () => ({ useViewportWidth: () => 1600 }))

import { AiPanel, AiPanelProvider } from './ai-panel'
import { AI_PANEL_COLLAPSED_WIDTH, AI_PANEL_DEFAULT_WIDTH } from '@/lib/ai-panel-width'

let container: HTMLDivElement
let root: Root

async function mount(ui: React.ReactElement) {
  await act(async () => {
    root.render(ui)
    // 让 dynamic、localStorage 回读的 effect 都跑完。
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  window.localStorage.clear()
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  window.localStorage.clear()
})

describe('AiPanel 外壳收起态', () => {
  it('收起时 resizer 隐藏，内容层仍保持展开宽度', async () => {
    window.localStorage.setItem('fmkj:ai-panel-collapsed', '1')
    window.localStorage.setItem('fmkj:ai-panel-width', String(AI_PANEL_DEFAULT_WIDTH))

    await mount(
      <AiPanelProvider enabled>
        <AiPanel plugins={[]} projects={[]} credits={10} configured models={[]} userId="user-1" />
      </AiPanelProvider>,
    )

    const resizer = container.querySelector('[data-slot="ai-panel-resizer"]') as HTMLButtonElement
    const aside = container.querySelector('[data-slot="ai-panel"]') as HTMLElement
    const surface = container.querySelector('[data-slot="ai-panel-surface"]') as HTMLElement
    expect(resizer).toBeTruthy()
    expect(aside).toBeTruthy()
    expect(surface).toBeTruthy()

    expect(resizer.hidden).toBe(true)
    expect(aside.style.width).toBe(`${AI_PANEL_COLLAPSED_WIDTH}px`)
    const expandedSurfaceWidth = surface.style.width
    expect(expandedSurfaceWidth).toBe(`${AI_PANEL_DEFAULT_WIDTH}px`)

    const stub = container.querySelector('[data-testid="dock-stub"]') as HTMLButtonElement
    expect(stub.getAttribute('data-collapsed')).toBe('true')
    await act(async () => {
      stub.click()
      await Promise.resolve()
    })

    expect(resizer.hidden).toBe(false)
    expect(aside.style.width).toBe(`${AI_PANEL_DEFAULT_WIDTH}px`)
    expect(
      (container.querySelector('[data-slot="ai-panel-surface"]') as HTMLElement).style.width,
    ).toBe(expandedSurfaceWidth)
  })
})
