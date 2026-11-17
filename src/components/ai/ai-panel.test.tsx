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

// 外壳测试不加载真实 dock（它会发会话请求）；只保留 collapsed / 收起 / 关闭
// 回调的接线，并复刻一条 header 供抽屉结构与关闭按钮的断言使用。
vi.mock('./ai-sidebar-dock', () => ({
  AiSidebarDock: ({
    collapsed,
    onToggleCollapsed,
    onClose,
  }: {
    collapsed?: boolean
    onToggleCollapsed?: () => void
    onClose?: () => void
  }) => (
    <div data-slot="ai-panel-header">
      <button
        type="button"
        data-testid="dock-stub"
        data-collapsed={collapsed ? 'true' : 'false'}
        aria-label={collapsed ? '展开 AI 对话' : '收起 AI 对话'}
        onClick={onToggleCollapsed}
      />
      {onClose ? <button type="button" aria-label="关闭 AI 对话" onClick={onClose} /> : null}
    </div>
  ),
}))

vi.mock('next/dynamic', async () => {
  const { AiSidebarDock } = await import('./ai-sidebar-dock')
  return { default: () => AiSidebarDock }
})

// 视口宽度可切换：1600 = 常驻列，1280 = 抽屉。
const viewport = vi.hoisted(() => ({ width: 1600 }))
vi.mock('@/hooks/use-viewport-width', () => ({ useViewportWidth: () => viewport.width }))

import { AiPanel, AiPanelProvider, AiPanelToggle } from './ai-panel'
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
  viewport.width = 1600
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

describe('AiPanel 抽屉模式', () => {
  it('只有一条标题栏，关闭按钮在 dock header 内且能关闭抽屉', async () => {
    viewport.width = 1280

    await mount(
      <AiPanelProvider enabled>
        <AiPanel plugins={[]} projects={[]} credits={10} configured models={[]} userId="user-1" />
        <AiPanelToggle />
      </AiPanelProvider>,
    )

    const toggle = container.querySelector('[aria-label="AI 对话"]') as HTMLButtonElement
    expect(toggle).toBeTruthy()
    await act(async () => {
      toggle.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    const sheet = document.querySelector('[data-slot="sheet-content"]') as HTMLElement
    expect(sheet).toBeTruthy()

    // 旧版这里会多一条可见的「AI 对话 + ✕」标题行；现在只剩 sr-only 的
    // SheetTitle（Radix Dialog 需要可访问名称），可见标题由 dock header 承担。
    const exactTitleElements = Array.from(sheet.querySelectorAll('*')).filter(
      (element) => element.children.length === 0 && element.textContent?.trim() === 'AI 对话',
    )
    expect(exactTitleElements).toHaveLength(1)
    expect(exactTitleElements[0].getAttribute('data-slot')).toBe('sheet-title')

    const closeButton = sheet.querySelector(
      '[data-slot="ai-panel-header"] [aria-label="关闭 AI 对话"]',
    ) as HTMLButtonElement
    expect(closeButton).toBeTruthy()

    await act(async () => {
      closeButton.click()
      await Promise.resolve()
      await Promise.resolve()
    })
    const closedSheet = document.querySelector('[data-slot="sheet-content"]')
    expect(closedSheet === null || closedSheet.getAttribute('data-state') === 'closed').toBe(true)
  })
})
