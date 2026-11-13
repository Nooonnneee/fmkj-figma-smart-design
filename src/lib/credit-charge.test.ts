import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

import { chargeAiCredits, isBusinessRejection } from './credit-charge'

const entry = { user: 'u-1', delta: -3, reason: 'AI 对话', model: 'm1', message: 'msg-1' }

function fakePayload(create: ReturnType<typeof vi.fn>) {
  return { create } as unknown as Payload
}

const businessError = (message: string, status: number) =>
  Object.assign(new Error(message), { status })

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

  it('基础设施故障、重试成功：记账成功且留下一次记录', async () => {
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

  it('基础设施两次都失败：返回 null（不抛错），并留下可追溯的结构化记录', async () => {
    const create = vi.fn().mockRejectedValue(new Error('连接中断'))
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

  it('402 积分不足：不重试、不吞掉，原样抛出', async () => {
    const rejection = businessError('积分不足', 402)
    const create = vi.fn().mockRejectedValue(rejection)
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(chargeAiCredits(fakePayload(create), entry)).rejects.toBe(rejection)

    // 旧实现会重试一次并返回 null（用户请求照常成功）——这里必须是 1 次 + 抛出。
    expect(create).toHaveBeenCalledTimes(1)
    expect(err).not.toHaveBeenCalled()
  })

  it('400 参数非法：同样视为确定性拒绝，只尝试一次并抛出', async () => {
    const rejection = businessError('积分变动必须是非零整数', 400)
    const create = vi.fn().mockRejectedValue(rejection)

    await expect(chargeAiCredits(fakePayload(create), entry)).rejects.toBe(rejection)
    expect(create).toHaveBeenCalledTimes(1)
  })
})

describe('isBusinessRejection', () => {
  it('只认 4xx', () => {
    expect(isBusinessRejection(businessError('x', 400))).toBe(true)
    expect(isBusinessRejection(businessError('x', 402))).toBe(true)
    expect(isBusinessRejection(businessError('x', 499))).toBe(true)
    expect(isBusinessRejection(businessError('x', 500))).toBe(false)
    expect(isBusinessRejection(new Error('socket hang up'))).toBe(false)
    expect(isBusinessRejection(Object.assign(new Error('serialize'), { code: '40001' }))).toBe(
      false,
    )
    expect(isBusinessRejection(null)).toBe(false)
  })
})
