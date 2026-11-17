// @vitest-environment happy-dom
import * as React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// React 19 的 act() 需要显式声明测试环境。
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// 用带标记的替身渲染 next/link：安装包链接如果是走 next/link，就会带上 data-next-link。
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a data-next-link="" href={href} {...rest}>
      {children}
    </a>
  ),
}))

import { CapabilityBand } from './capability-band'

const MANIFEST = {
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
  mac: {
    version: '1.2.3',
    releaseDate: null,
    assets: [
      {
        file: 'fanmeng-space-1.2.3-mac-arm64.dmg',
        url: '/downloads/desktop/fanmeng-space-1.2.3-mac-arm64.dmg',
        size: 130 * 1024 * 1024,
        arch: 'arm64',
        format: 'dmg',
      },
      {
        file: 'fanmeng-space-1.2.3-mac-x64.dmg',
        url: '/downloads/desktop/fanmeng-space-1.2.3-mac-x64.dmg',
        size: 131 * 1024 * 1024,
        arch: 'x64',
        format: 'dmg',
      },
    ],
  },
}

function setNavigator({
  userAgent,
  platform,
  architecture,
}: {
  userAgent: string
  platform: string
  architecture?: string
}) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    get: () => userAgent,
  })
  Object.defineProperty(window.navigator, 'platform', {
    configurable: true,
    get: () => platform,
  })
  Object.defineProperty(window.navigator, 'userAgentData', {
    configurable: true,
    get: () =>
      architecture ? { platform, getHighEntropyValues: async () => ({ architecture }) } : undefined,
  })
}

let container: HTMLDivElement
let root: Root

async function mount() {
  await act(async () => {
    root.render(<CapabilityBand products={12} brands={6} />)
    // 等 fetch(manifest) 与系统识别两个 effect 都落定。
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

function desktopLinks() {
  const section = container.querySelector('#desktop')
  if (!section) return null
  return [...section.querySelectorAll('a')].map((anchor) => ({
    text: (anchor.textContent || '').trim(),
    href: anchor.getAttribute('href') || '',
    nextLink: anchor.hasAttribute('data-next-link'),
    tag: anchor.tagName,
  }))
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(MANIFEST), { status: 200 })),
  )
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('首页能力带 · 桌面端入口（已发布安装包）', () => {
  it('Mac Apple 芯片访客拿到直连安装包的原生 <a>，另有其他平台入口', async () => {
    setNavigator({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      platform: 'MacIntel',
    })
    await mount()

    expect(container.querySelector('#library')).not.toBeNull()
    expect(container.querySelector('#apps')).not.toBeNull()
    const links = desktopLinks()
    expect(links).not.toBeNull()

    const installer = links!.find((link) => link.href.includes('/downloads/desktop/'))
    expect(installer).toBeDefined()
    expect(installer!.href).toBe('/downloads/desktop/fanmeng-space-1.2.3-mac-arm64.dmg')
    expect(installer!.text).toContain('下载 Mac 版（Apple 芯片）')
    // 安装包 URL 不能走 next/link，否则会被 App Router 预取整个安装包。
    expect(installer!.nextLink).toBe(false)
    expect(installer!.tag).toBe('A')

    const other = links!.find((link) => link.text.includes('其他平台'))
    expect(other?.href).toBe('/download')
    expect(other?.nextLink).toBe(true)

    expect(links!.some((link) => link.href === '/projects')).toBe(false)
    expect(container.querySelector('#desktop')!.textContent).not.toContain('即将上线')
  })

  it('Mac Intel 访客按高熵架构拿到 x64 安装包', async () => {
    setNavigator({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      platform: 'MacIntel',
      architecture: 'x86',
    })
    await mount()

    const installer = desktopLinks()!.find((link) => link.href.includes('/downloads/desktop/'))
    expect(installer?.href).toBe('/downloads/desktop/fanmeng-space-1.2.3-mac-x64.dmg')
    expect(installer?.text).toContain('下载 Mac 版（Intel）')
  })

  it('Windows 访客拿到 Windows 安装包', async () => {
    setNavigator({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      platform: 'Win32',
    })
    await mount()

    const installer = desktopLinks()!.find((link) => link.href.includes('/downloads/desktop/'))
    expect(installer?.href).toBe('/downloads/desktop/fanmeng-space-1.2.3-win-x64.exe')
    expect(installer?.text).toContain('下载 Windows 版')
  })

  it('识别不出系统时仍给出一个可下载的安装包，而不是死链', async () => {
    setNavigator({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko)',
      platform: 'Linux x86_64',
    })
    await mount()

    const installer = desktopLinks()!.find((link) => link.href.includes('/downloads/desktop/'))
    expect(installer).toBeDefined()
    expect(installer!.nextLink).toBe(false)
  })
})
