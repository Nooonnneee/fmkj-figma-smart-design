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
 * 淘汰策略必须是**按最老条目逐个淘汰（LRU）**，不能「超限就 clear()」：
 * 清空会把正在生效的计数一起抹掉，攻击者拿 5000+ 个垃圾 key（8KB 的 key 也照样能塞）
 * 就能把「每用户 30 次/分」实测刷到 88 次以上 —— 等于限流失效。
 *
 * 与 `src/app/(frontend)/auth/register/route.ts` 里的限流思路一致（Map + 窗口 + 惰性清理），
 * 抽出成通用工具，避免每加一个端点就抄一遍。
 */

type Bucket = { count: number; resetAt: number }

/** 同时跟踪的 key 上限。超出后按最老条目淘汰，**不清空**。 */
const MAX_ENTRIES = 5000

const buckets = new Map<string, Bucket>()

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number }

/**
 * 淘汰：先清掉已过期的；仍然超限则按插入顺序从最老的开始逐个删，直到回到上限以内。
 * Map 的迭代顺序就是插入顺序，所以「从头部删」等价于 LRU（这里不刷新访问顺序，
 * 对「防刷」这个目的足够；过期条目本身会被优先清掉）。
 *
 * **绝不 clear()**：清空会把正在生效的计数一起抹掉，攻击者拿大量垃圾 key
 * 就能把「每用户 30 次/分」实测刷到 88 次以上 —— 等于限流失效。
 */
function prune(now: number) {
  if (buckets.size <= MAX_ENTRIES) return
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
  // 逐个淘汰最老的，直到回到上限以内。即使全是活跃条目，也只丢掉最老的一部分，
  // 正在被反复打的那个 key（通常是最近写入/更新的）计数不会被抹掉。
  let removed = 0
  const overflow = buckets.size - MAX_ENTRIES
  for (const key of buckets.keys()) {
    if (removed >= overflow) break
    buckets.delete(key)
    removed += 1
  }
}

/**
 * 检查并消耗一次配额。
 * @param key 限流维度（例如 `test:<userId>:<channelKey>`）
 * @param limit 窗口内最大次数
 * @param windowMs 窗口长度（毫秒）
 */
export function consumeRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    // 先删再塞：让被重新计数的 key 排到 Map 尾部（视为「最新使用」）。
    buckets.delete(key)
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    prune(now)
    return { ok: true }
  }

  // 每次访问都把条目移到 Map 尾部 = 真正的 LRU。
  // 没有这一步的话，「从头部淘汰」会把**正在被反复打的那个 key** 先淘汰掉，
  // 等于攻击者用垃圾 key 就能把自己的限流计数刷新归零。
  buckets.delete(key)
  buckets.set(key, bucket)
  prune(now)

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

/** 测试用：当前跟踪的 key 数量（验证淘汰策略不会清空）。 */
export function rateLimitSize() {
  return buckets.size
}

export { MAX_ENTRIES as RATE_LIMIT_MAX_ENTRIES }
