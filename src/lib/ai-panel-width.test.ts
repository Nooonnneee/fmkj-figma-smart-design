import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  AI_PANEL_DEFAULT_WIDTH,
  AI_PANEL_MAX_WIDTH,
  AI_PANEL_MIN_WIDTH,
  AI_PANEL_WIDTH_STORAGE_KEY,
  AI_PANEL_COLLAPSED_STORAGE_KEY,
  clampAiPanelWidth,
  readStoredAiPanelCollapsed,
  readStoredAiPanelWidth,
  writeAiPanelCollapsed,
  writeAiPanelWidth,
} from './ai-panel-width'

/** 内存版 Storage，用于模拟 localStorage 往返（不碰真实浏览器环境）。 */
function memoryStorage(): Storage & { store: Map<string, string> } {
  const store = new Map<string, string>()
  return {
    store,
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (k) => store.get(k) ?? null,
    key: (i) => Array.from(store.keys())[i] ?? null,
    removeItem: (k) => void store.delete(k),
    setItem: (k, v) => void store.set(k, String(v)),
  } as Storage & { store: Map<string, string> }
}

describe('clampAiPanelWidth', () => {
  it('上下夹紧到 [MIN, MAX] 并取整', () => {
    expect(clampAiPanelWidth(100)).toBe(AI_PANEL_MIN_WIDTH)
    expect(clampAiPanelWidth(900)).toBe(AI_PANEL_MAX_WIDTH)
    expect(clampAiPanelWidth(320)).toBe(320)
    expect(clampAiPanelWidth(320.6)).toBe(321)
  })
})

describe('持久化写入 / 读出（拖宽刷新保持的真实行为）', () => {
  it('写入宽度后能原样读回，且越界写入被夹紧', () => {
    const s = memoryStorage()
    writeAiPanelWidth(420, s)
    expect(readStoredAiPanelWidth(s)).toBe(420)
    // 越界写入要收到 [MIN,MAX] 内
    writeAiPanelWidth(9999, s)
    expect(readStoredAiPanelWidth(s)).toBe(AI_PANEL_MAX_WIDTH)
    writeAiPanelWidth(0, s)
    expect(readStoredAiPanelWidth(s)).toBe(AI_PANEL_MIN_WIDTH)
  })

  it('无存储 / 非法值回落到默认宽度 320', () => {
    const empty = memoryStorage()
    expect(readStoredAiPanelWidth(empty)).toBe(AI_PANEL_DEFAULT_WIDTH)
    const junk = memoryStorage()
    junk.setItem(AI_PANEL_WIDTH_STORAGE_KEY, 'not-a-number')
    expect(readStoredAiPanelWidth(junk)).toBe(AI_PANEL_DEFAULT_WIDTH)
  })

  it('收起态写入/读出往返', () => {
    const s = memoryStorage()
    // 默认展开
    expect(readStoredAiPanelCollapsed(s)).toBe(false)
    writeAiPanelCollapsed(true, s)
    expect(readStoredAiPanelCollapsed(s)).toBe(true)
    expect(s.getItem(AI_PANEL_COLLAPSED_STORAGE_KEY)).toBe('1')
    writeAiPanelCollapsed(false, s)
    expect(readStoredAiPanelCollapsed(s)).toBe(false)
  })

  it('Storage 抛错时读写都安全降级（不崩）', () => {
    const throwing = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    } as Storage
    expect(readStoredAiPanelWidth(throwing)).toBe(AI_PANEL_DEFAULT_WIDTH)
    expect(() => writeAiPanelWidth(320, throwing)).not.toThrow()
    expect(readStoredAiPanelCollapsed(throwing)).toBe(false)
    expect(() => writeAiPanelCollapsed(true, throwing)).not.toThrow()
  })

  it('显式传 null 存储：读回落默认值，写静默忽略', () => {
    expect(readStoredAiPanelWidth(null)).toBe(AI_PANEL_DEFAULT_WIDTH)
    expect(readStoredAiPanelCollapsed(null)).toBe(false)
    expect(() => writeAiPanelWidth(420, null)).not.toThrow()
    expect(() => writeAiPanelCollapsed(true, null)).not.toThrow()
  })
})

describe('无 window 环境（服务端渲染）', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('无参调用四个函数都不求值 window、不抛错', () => {
    vi.stubGlobal('window', undefined)

    expect(() => readStoredAiPanelWidth()).not.toThrow()
    expect(readStoredAiPanelWidth()).toBe(AI_PANEL_DEFAULT_WIDTH)
    expect(() => readStoredAiPanelCollapsed()).not.toThrow()
    expect(readStoredAiPanelCollapsed()).toBe(false)
    expect(() => writeAiPanelWidth(400)).not.toThrow()
    expect(() => writeAiPanelCollapsed(true)).not.toThrow()
  })
})
