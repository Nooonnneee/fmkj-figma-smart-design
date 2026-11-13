import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { siteUrl } from './site-url'

const KEYS = ['PUBLIC_URL', 'NEXT_PUBLIC_SITE_URL', 'FIGMA_PUBLIC_URL'] as const

describe('siteUrl', () => {
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k]
      delete process.env[k]
    }
  })

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  // 这条是回归测试：自托管生产只有 PUBLIC_URL，漏读它会让 metadataBase
  // 退回 localhost:3000，分享卡片的 OG 图全部指错。
  it('自托管生产只设 PUBLIC_URL 时也认得', () => {
    process.env.PUBLIC_URL = 'https://fmkj.top'
    expect(siteUrl()).toBe('https://fmkj.top')
  })

  it('PUBLIC_URL 优先于其它两个', () => {
    process.env.PUBLIC_URL = 'https://fmkj.top'
    process.env.NEXT_PUBLIC_SITE_URL = 'https://override.example'
    process.env.FIGMA_PUBLIC_URL = 'https://figma.example'
    expect(siteUrl()).toBe('https://fmkj.top')
  })

  it('没有 PUBLIC_URL 时认 NEXT_PUBLIC_SITE_URL', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://override.example'
    expect(siteUrl()).toBe('https://override.example')
  })

  it('再退到 FIGMA_PUBLIC_URL', () => {
    process.env.FIGMA_PUBLIC_URL = 'https://figma.example'
    expect(siteUrl()).toBe('https://figma.example')
  })

  it('都没有时用传入的 fallback', () => {
    expect(siteUrl()).toBe('https://fmkj.top')
    expect(siteUrl('http://localhost:3000')).toBe('http://localhost:3000')
  })

  it('去掉尾部斜杠（拼路径时不会出现 //）', () => {
    process.env.PUBLIC_URL = 'https://fmkj.top///'
    expect(siteUrl()).toBe('https://fmkj.top')
  })
})
