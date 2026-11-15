/**
 * 最小内存限流（按 key 计窗口内次数）。
 *
 * 用途：成员自填 AI 渠道的「测试连通性」端点会让**我们的服务器**去请求客户填的地址，
 * 不限流等于免费出网代理（还能被用来打外部接口）。
 *
 * ⚠️ 多实例部署时内存限流**不准确**：每个进程各有一份计数，N 个实例的实际放行量是
 * N 倍；进程重启也会清零。要拦住真正有意的滥用，必须换成共享存储（Redis / Postgres
 * 计数表）。这里的实现只防「手滑连点」和轻量刷接口，不是安全边界。
 *
 * 与 `src/app/(frontend)/auth/register/route.ts` 里的限流思路一致（Map + 窗口 + 惰性清理），
 * 抽出成通用工具，避免每加一个端点就抄一遍。
 */

type Bucket = { count: number; resetAt: number }

const MAX_ENTRIES = 5000

const buckets = new Map<string, Bucket>()

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number }

/** 惰性清理：条目过多时顺手清掉已过期的，避免被随机 key 撑爆内存。 */
function prune(now: number) {
  if (buckets.size <= MAX_ENTRIES) return
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
  // 清完还是太多（说明是真实的大量不同 key），直接清空最老的：宁可多放行，也不 OOM。
  if (buckets.size > MAX_ENTRIES) buckets.clear()
}

/**
 * 检查并消耗一次配额。
 * @param key 限流维度（例如 `test:<userId>:<channelKey>`）
 * @param limit 窗口内最大次数
 * @param windowMs 窗口长度（毫秒）
 */
export function consumeRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  prune(now)
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true }
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) }
  }
  bucket.count += 1
  return { ok: true }
}

/** 测试用：清空所有计数。 */
export function resetRateLimits() {
  buckets.clear()
}
