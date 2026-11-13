import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

import { chargeAiCredits } from './credit-charge'

const entry = { user: 'u-1', delta: -3, reason: 'AI 对话', model: 'm1', message: 'msg-1' }

function fakePayload(create: ReturnType<typeof vi.fn>) {
  return { create } as unknown as Payload
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('chargeAiCredits', () => {
  it('一次成功：只写一次，不报错', async () => {
    const create = vi.fn(async () => ({ balanceAfter: 7 }))
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})

    const balance = await chargeAiCredits(fakePayload(create), entry)

    expect(balance).toBe(7)
    expect(create).toHaveBeenCalledTimes(1)
    expect(err).not.toHaveBeenCalled()
  })

  it('第一次失败、重试成功：记账成功且留下一次记录', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error('连接超时'))
      .mockResolvedValueOnce({ balanceAfter: 7 })
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})

    const balance = await chargeAiCredits(fakePayload(create), entry)

    expect(balance).toBe(7)
    expect(create).toHaveBeenCalledTimes(2)
    expect(err).toHaveBeenCalledTimes(1)
    expect(String(err.mock.calls[0]![0])).toContain('[ai-billing]')
  })

  it('两次都失败：返回 null（不抛错），并留下可追溯的结构化记录', async () => {
    const create = vi.fn().mockRejectedValue(new Error('余额不足'))
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})

    const balance = await chargeAiCredits(fakePayload(create), entry)

    expect(balance).toBeNull()
    expect(create).toHaveBeenCalledTimes(2)
    expect(err).toHaveBeenCalledTimes(2)
    const last = err.mock.calls[1] as unknown[]
    const logged = JSON.parse(String(last[1]))
    expect(logged).toMatchObject({
      userId: 'u-1',
      delta: -3,
      model: 'm1',
      messageId: 'msg-1',
      attempt: 2,
    })
  })
})
