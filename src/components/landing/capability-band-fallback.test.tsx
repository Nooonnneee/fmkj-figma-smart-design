// @vitest-environment happy-dom
import * as React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a data-next-link="" href={href} {...rest}>
      {children}
    </a>
  ),
}))

import { CapabilityBand } from './capability-band'

let container: HTMLDivElement
let root: Root

async function mount() {
  await act(async () => {
    root.render(<CapabilityBand products={12} brands={6} />)
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  // 没有发布清单：和本地开发一样返回 404。
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('not found', { status: 404 })),
  )
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    get: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  })
  Object.defineProperty(window.navigator, 'platform', {
    configurable: true,
    get: () => 'Win32',
  })
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('首页能力带 · 桌面端入口（没有安装包）', () => {
  it('退化为「使用网页版」，不留安装包死链', async () => {
    await mount()

    const section = container.querySelector('#desktop')
    expect(section).not.toBeNull()
    const links = [...section!.querySelectorAll('a')].map((anchor) => ({
      text: (anchor.textContent || '').trim(),
      href: anchor.getAttribute('href') || '',
      nextLink: anchor.hasAttribute('data-next-link'),
    }))

    expect(links.some((link) => link.href.includes('/downloads/desktop/'))).toBe(false)
    const fallback = links.find((link) => link.href === '/projects')
    expect(fallback).toBeDefined()
    expect(fallback!.text).toContain('使用网页版')
    expect(fallback!.nextLink).toBe(true)
    expect(section!.textContent).not.toContain('即将上线')
  })
})
