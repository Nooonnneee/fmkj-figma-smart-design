// @vitest-environment happy-dom
import * as React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// React 19 的 act() 需要显式声明测试环境。
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// 把 next/link 替身成带 data-next-link 的 <a>，便于断言真实链接行为。
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a data-next-link="" href={href} {...rest}>
      {children}
    </a>
  ),
}))

import { ClientAvailableBadge } from './client-available-badge'

let container: HTMLDivElement
let root: Root

async function mount() {
  await act(async () => {
    root.render(<ClientAvailableBadge />)
  })
}

function link() {
  return container.querySelector('a')
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('客户端可用标签（ClientAvailableBadge）', () => {
  it('渲染出文案「客户端可用」', async () => {
    await mount()
    expect(container.textContent).toContain('客户端可用')
  })

  it('是真正的 <a> 链接且 href=/download（走 next/link 渲染层）', async () => {
    await mount()
    const anchor = link()
    expect(anchor).not.toBeNull()
    expect(anchor!.tagName).toBe('A')
    expect(anchor!.getAttribute('href')).toBe('/download')
    expect(anchor!.hasAttribute('data-next-link')).toBe(true)
  })

  it('可访问名称明确说明「前往下载」', async () => {
    await mount()
    const anchor = link()
    // aria-label 以「前往下载」收尾，用户能听清这是一个去下载页的入口。
    const ariaLabel = anchor!.getAttribute('aria-label') || ''
    expect(ariaLabel).toContain('前往下载')
  })
})
