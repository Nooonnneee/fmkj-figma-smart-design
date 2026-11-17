// @vitest-environment happy-dom
import * as React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// 和另一个用例一样，给 next/link 打标记，用于确认安装包链接没走预取。
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a data-next-link="" href={href} {...rest}>
      {children}
    </a>
  ),
}))

import { CapabilityBand } from './capability-band'

// 只有 Windows 包：Mac 访客没有“自己的平台”可下，但仍不该退化成网页版。
const WINDOWS_ONLY_MANIFEST = {
  app: 'fanmeng-space',
  windows: {
    version: '1.2.3',
    releaseDate: null,
    assets: [
      {
        file: 'fanmeng-space-1.2.3-win-x64.exe',
        url: '/downloads/desktop/fanmeng-space-1.2.3-win-x64.exe',
        size: 120 * 1024 * 1024,
        arch: 'x64',
        format: 'exe',
      },
    ],
  },
  mac: null,
}

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
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(WINDOWS_ONLY_MANIFEST), { status: 200 })),
  )
  // 访客是 Apple 芯片 Mac：推荐的平台有目标，但清单里没有对应安装包。
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    get: () =>
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  })
  Object.defineProperty(window.navigator, 'platform', {
    configurable: true,
    get: () => 'MacIntel',
  })
  Object.defineProperty(window.navigator, 'userAgentData', {
    configurable: true,
    get: () => undefined,
  })
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('首页能力带 · 桌面端入口（只发布了 Windows）', () => {
  it('Mac 访客也拿到可下载的 Windows 包，而不是 /projects 回退', async () => {
    await mount()

    const section = container.querySelector('#desktop')
    expect(section).not.toBeNull()
    const links = [...section!.querySelectorAll('a')].map((anchor) => ({
      text: (anchor.textContent || '').trim(),
      href: anchor.getAttribute('href') || '',
      nextLink: anchor.hasAttribute('data-next-link'),
      tag: anchor.tagName,
    }))

    const installer = links.find((link) => link.href.includes('/downloads/desktop/'))
    expect(installer).toBeDefined()
    expect(installer!.href).toBe('/downloads/desktop/fanmeng-space-1.2.3-win-x64.exe')
    expect(installer!.nextLink).toBe(false)
    expect(installer!.tag).toBe('A')
    expect(links.some((link) => link.href === '/projects')).toBe(false)
    expect(section!.textContent).not.toContain('即将上线')
  })
})
