import { appAuth } from '@/lib/app-auth'
import { handleTestChannel, rejectCrossOrigin } from '@/lib/ai-channels-http'
import { getPayloadClient } from '@/lib/payload'

/**
 * 用当前成员自己的一个渠道真实请求一次 `/models`，把结果写回 lastCheck*。
 *
 * 这个端点会让服务器请求客户填写的地址，因此三层防护缺一不可：
 * - 地址校验 + DNS 解析校验 + 禁止跟随重定向（`src/lib/ai-channels-url-guard.ts`）；
 * - 限流：每用户每渠道 10 次/分钟（`src/lib/rate-limit.ts`，多实例下不准确）；
 *   注意顺序：`testChannel` 先校验 key 格式与归属，**最后**才消耗配额，
 *   否则垃圾 key 会撑大限流 Map；
 * - 10 秒硬超时；日志只记 userId / 渠道标识 / 结果，不记 key。
 * - 先过 `rejectCrossOrigin`：跨站请求不能借会话 Cookie 让我们去打客户的地址。
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 30

type RouteContext = { params: Promise<{ key: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  const crossOrigin = rejectCrossOrigin(request)
  if (crossOrigin) return crossOrigin
  const user = await appAuth.getCurrentUser()
  if (!user) return Response.json({ ok: false, error: '请先登录' }, { status: 401 })
  const { key } = await params
  const payload = await getPayloadClient()
  return handleTestChannel({ userId: String(user.id), payload }, decodeURIComponent(key))
}
