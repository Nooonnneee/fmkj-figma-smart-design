import type { Payload } from 'payload'

/** 写一条积分流水要用的字段（与 `ai-credit-ledger` 集合一致）。 */
export type CreditChargeData = {
  /** 成员 id（本仓库主键是 uuid，所以是字符串） */
  user: string
  /** 负数 = 扣费，正数 = 发放 */
  delta: number
  reason: string
  model?: string | null
  /** 对应消息 id */
  message?: string | null
}

/**
 * 4xx 是**确定性业务拒绝**（402 积分不足、400 参数非法……）：重试不会变好，
 * 必须原样抛给调用方，让用户看到拒绝、让请求失败。
 * 只有 5xx / 连接中断 / 超时 / 序列化冲突（40001）这类基础设施故障才值得重试。
 */
export function isBusinessRejection(error: unknown): error is Error & { status: number } {
  const status = (error as { status?: unknown } | null | undefined)?.status
  return typeof status === 'number' && status >= 400 && status < 500
}

/**
 * 写一条积分流水。
 *
 * 两类失败必须分开处理：
 * - **业务拒绝（4xx）**：积分不足 / 参数非法等确定性结果，直接抛出，不重试、不吞掉。
 *   调用方应把拒绝告诉用户，本次请求不成功。
 * - **基础设施故障（连接中断、超时、序列化冲突等）**：AI 已经产出、用户也已经等到结果，
 *   记账失败不判请求失败；但要留下能追溯的结构化记录（哪个用户、多少钱、哪次调用、什么错），
 *   并**重试一次**。两次都失败时返回 `null`（= 本次未记账）。
 *
 * 结构化日志用 `[ai-billing]` 前缀、单行 JSON，便于日志系统按 userId / delta 聚合。
 *
 * 重试的前提是 `payload.create` 抛错即事务回滚、流水不会半写；只有当「提交成功但响应丢失」时
 * 才可能重复记一笔，这种歧义窗口无法靠重试本身消除。
 */
export async function chargeAiCredits(
  payload: Payload,
  data: CreditChargeData,
): Promise<number | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const entry = await payload.create({
        collection: 'ai-credit-ledger',
        data: {
          user: data.user,
          delta: data.delta,
          reason: data.reason.slice(0, 120),
          ...(data.model ? { model: data.model } : {}),
          ...(data.message !== null && data.message !== undefined ? { message: data.message } : {}),
        },
        overrideAccess: true,
        depth: 0,
      })
      return entry.balanceAfter ?? null
    } catch (error) {
      // 确定性业务拒绝：只尝试一次，交给调用方。
      if (isBusinessRejection(error)) throw error

      const detail = {
        userId: String(data.user),
        delta: data.delta,
        reason: data.reason,
        model: data.model ?? null,
        messageId:
          data.message !== null && data.message !== undefined ? String(data.message) : null,
        attempt,
        error: error instanceof Error ? error.message : String(error),
      }
      if (attempt < 2) {
        console.error('[ai-billing] 积分记账基础设施故障，重试一次', JSON.stringify(detail))
      } else {
        console.error(
          '[ai-billing] 积分记账两次均失败，本次未记账（用户请求照常返回）',
          JSON.stringify(detail),
        )
      }
    }
  }
  return null
}
