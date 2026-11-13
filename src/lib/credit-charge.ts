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
 * 写一条积分流水。
 *
 * 记账失败**不能**把用户的请求判为失败——AI 已经产出、用户也已经等到结果了；但也**不能静默**：
 * 失败要留下能追溯的结构化记录（哪个用户、多少钱、哪次调用、什么错），并**重试一次**。
 * 两次都失败时返回 `null`，调用方照常把结果交给用户。
 *
 * 默认不落库：新增集合 / 改 schema 需要 owner 批准，所以这里只做结构化日志（`[ai-billing]` 前缀，
 * 单行 JSON，便于日志系统按 userId / delta 聚合），不在数据库里记账。
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
        console.error('[ai-billing] 积分记账失败，重试一次', JSON.stringify(detail))
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
