import { beforeEach, describe, expect, it } from 'vitest'

import {
  RATE_LIMIT_MAX_ENTRIES,
  consumeRateLimit,
  rateLimitSize,
  resetRateLimits,
} from './rate-limit'

beforeEach(() => resetRateLimits())

describe('consumeRateLimit', () => {
  it('窗口内放行 limit 次，第 limit+1 次拒绝', () => {
    for (let i = 0; i < 5; i += 1) expect(consumeRateLimit('k', 5, 60_000).ok).toBe(true)
    const blocked = consumeRateLimit('k', 5, 60_000)
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('不同 key 互不影响', () => {
    for (let i = 0; i < 5; i += 1) consumeRateLimit('a', 5, 60_000)
    expect(consumeRateLimit('a', 5, 60_000).ok).toBe(false)
    expect(consumeRateLimit('b', 5, 60_000).ok).toBe(true)
  })
})

describe('超过 MAX_ENTRIES 时的淘汰策略（不能 clear）', () => {
  it('边灌垃圾 key 边打真实 key：真实 key 的计数**始终**保留', () => {
    for (let i = 0; i < 30; i += 1) consumeRateLimit('user:real', 30, 60_000)
    expect(consumeRateLimit('user:real', 30, 60_000).ok).toBe(false)

    // 模拟复核里的攻击：5000+ 个不同 channelKey 反复打。
    // 每灌 100 个垃圾 key，就用真实 key 再试一次 —— 它的计数不能被抹掉。
    for (let i = 0; i < RATE_LIMIT_MAX_ENTRIES + 500; i += 1) {
      consumeRateLimit(`junk:${i}`, 10, 60_000)
      if (i % 100 === 0) {
        expect(consumeRateLimit('user:real', 30, 60_000).ok).toBe(false)
      }
    }
    expect(rateLimitSize()).toBeLessThanOrEqual(RATE_LIMIT_MAX_ENTRIES)
    expect(consumeRateLimit('user:real', 30, 60_000).ok).toBe(false)
  })

  it('表被压回上限、但不清空（旧实现 clear() 会让 size 变 0 或 1）', () => {
    for (let i = 0; i < RATE_LIMIT_MAX_ENTRIES + 500; i += 1) {
      consumeRateLimit(`k:${i}`, 100, 60_000)
    }
    expect(rateLimitSize()).toBeLessThanOrEqual(RATE_LIMIT_MAX_ENTRIES)
    // 大量条目仍在跟踪中 —— 不是被一次性清空
    expect(rateLimitSize()).toBeGreaterThan(RATE_LIMIT_MAX_ENTRIES - 100)
  })
})
