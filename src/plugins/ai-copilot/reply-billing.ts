import type { Payload } from 'payload'

import { chargeAiCredits } from '@/lib/credit-charge'

export type AssistantReplyBilling = {
  conversationId: string
  ownerId: string
  content: string
  /** 消息里记录的模型（可能是 `auto:<id>`） */
  model: string
  toolCalls?: unknown[]
  /** 本次应扣积分（调用方已按当前余额封顶）；0 表示不扣 */
  cost: number
  /** 扣费前的余额，仅用于「未记账」时回报 */
  currentBalance: number
  /** 流水说明 */
  reason: string
  /** 流水里记录的模型 id */
  ledgerModel: string
}

export type AssistantReplyBillingResult = {
  messageId: string | number
  /** 实际扣掉的积分：记账成功 = cost；基础设施连续失败 = 0 */
  charged: number
  balance: number | null
}

/**
 * 保存 AI 回复并扣费。
 *
 * `cost` 分两步定稿：先以 0 落库（流水需要用消息 id 关联），扣费成功后再回写实际成本。
 * 这样业务拒绝（402 积分不足）时这条消息的成本是 0（= 未计费），不会出现「消息写着扣了 80、
 * 流水却只有一笔」的对不上；代价是每轮多一次 `ai-messages` UPDATE。
 *
 * 业务拒绝由 `chargeAiCredits` 原样抛出（请求失败，用户看到「积分不足」）；
 * 基础设施连续失败时 `chargeAiCredits` 返回 null，消息保持 0、请求不失败。
 */
export async function saveAssistantReplyAndCharge(
  payload: Payload,
  data: AssistantReplyBilling,
): Promise<AssistantReplyBillingResult> {
  const reply = await payload.create({
    collection: 'ai-messages',
    data: {
      conversation: data.conversationId,
      owner: data.ownerId,
      role: 'assistant',
      content: data.content,
      model: data.model,
      // 先按「未计费」落库，扣费成功后再定稿。
      cost: 0,
      ...(data.toolCalls ? { toolCalls: data.toolCalls } : {}),
    },
    overrideAccess: true,
    depth: 0,
  })

  if (data.cost <= 0) {
    return { messageId: reply.id, charged: 0, balance: data.currentBalance }
  }

  const balanceAfter = await chargeAiCredits(payload, {
    user: data.ownerId,
    delta: -data.cost,
    reason: data.reason,
    model: data.ledgerModel,
    message: reply.id,
  })

  if (balanceAfter === null) {
    // 基础设施连续失败：流水没落库，消息保持 cost=0（未计费），用户请求照常成功。
    return { messageId: reply.id, charged: 0, balance: data.currentBalance }
  }

  try {
    await payload.update({
      collection: 'ai-messages',
      id: reply.id,
      data: { cost: data.cost },
      overrideAccess: true,
      depth: 0,
    })
  } catch (error) {
    // 钱已经扣了（流水已提交），回写失败不能让请求失败；流水是权威记录，留下结构化日志便于对账。
    console.error(
      '[ai-billing] 扣费成功但消息成本回写失败',
      JSON.stringify({
        userId: String(data.ownerId),
        messageId: String(reply.id),
        cost: data.cost,
        error: error instanceof Error ? error.message : String(error),
      }),
    )
  }

  return { messageId: reply.id, charged: data.cost, balance: balanceAfter }
}
