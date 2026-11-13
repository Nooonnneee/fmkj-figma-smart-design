import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

const mocks = vi.hoisted(() => ({ chargeAiCredits: vi.fn() }))

vi.mock('@/lib/credit-charge', () => ({
  chargeAiCredits: mocks.chargeAiCredits,
  isBusinessRejection: (error: unknown) => {
    const status = (error as { status?: unknown } | null)?.status
    return typeof status === 'number' && status >= 400 && status < 500
  },
}))

import { saveAssistantReplyAndCharge } from './reply-billing'

const base = {
  conversationId: 'conv-1',
  ownerId: 'u-1',
  content: '回答内容',
  model: 'm1',
  cost: 80,
  currentBalance: 100,
  reason: 'AI 对话 · 模型 · 用量',
  ledgerModel: 'm1',
}

function fakePayload() {
  return {
    create: vi.fn(async (..._args: unknown[]) => ({ id: 'msg-1' })),
    update: vi.fn(async (..._args: unknown[]) => ({ id: 'msg-1' })),
  }
}

beforeEach(() => {
  mocks.chargeAiCredits.mockReset()
})

describe('saveAssistantReplyAndCharge', () => {
  it('扣费成功：消息先按 0 落库，成功后回写真实成本', async () => {
    mocks.chargeAiCredits.mockResolvedValue(20)
    const payload = fakePayload()

    const result = await saveAssistantReplyAndCharge(payload as unknown as Payload, base)

    expect(result).toEqual({ messageId: 'msg-1', charged: 80, balance: 20 })
    expect(payload.create.mock.calls[0]![0]).toMatchObject({
      collection: 'ai-messages',
      data: { role: 'assistant', cost: 0, content: '回答内容' },
    })
    expect(mocks.chargeAiCredits.mock.calls[0]![1]).toMatchObject({
      user: 'u-1',
      delta: -80,
      message: 'msg-1',
    })
    expect(payload.update).toHaveBeenCalledTimes(1)
    expect(payload.update.mock.calls[0]![0]).toMatchObject({
      collection: 'ai-messages',
      id: 'msg-1',
      data: { cost: 80 },
    })
  })

  it('402 业务拒绝：消息保持 cost=0，不扣费，错误向上抛', async () => {
    const rejection = Object.assign(new Error('积分不足'), { status: 402 })
    mocks.chargeAiCredits.mockRejectedValue(rejection)
    const payload = fakePayload()

    await expect(saveAssistantReplyAndCharge(payload as unknown as Payload, base)).rejects.toBe(
      rejection,
    )

    expect(payload.create).toHaveBeenCalledTimes(1)
    expect(payload.create.mock.calls[0]![0]).toMatchObject({ data: { cost: 0 } })
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('基础设施连续失败：不扣费、不回写成本，请求照常成功且回报原余额', async () => {
    mocks.chargeAiCredits.mockResolvedValue(null)
    const payload = fakePayload()

    const result = await saveAssistantReplyAndCharge(payload as unknown as Payload, base)

    expect(result).toEqual({ messageId: 'msg-1', charged: 0, balance: 100 })
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('无需扣费（cost=0）：不写流水也不回写', async () => {
    const payload = fakePayload()

    const result = await saveAssistantReplyAndCharge(payload as unknown as Payload, {
      ...base,
      cost: 0,
    })

    expect(result).toEqual({ messageId: 'msg-1', charged: 0, balance: 100 })
    expect(mocks.chargeAiCredits).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('扣费成功但成本回写失败：请求不失败，仍报告已扣金额', async () => {
    mocks.chargeAiCredits.mockResolvedValue(20)
    const payload = fakePayload()
    payload.update.mockRejectedValue(new Error('写超时'))
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await saveAssistantReplyAndCharge(payload as unknown as Payload, base)

    expect(result).toEqual({ messageId: 'msg-1', charged: 80, balance: 20 })
    expect(err).toHaveBeenCalledTimes(1)
    expect(String(err.mock.calls[0]![0])).toContain('扣费成功但消息成本回写失败')
    err.mockRestore()
  })
})
