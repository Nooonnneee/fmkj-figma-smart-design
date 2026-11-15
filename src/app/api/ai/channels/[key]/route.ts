import { appAuth } from '@/lib/app-auth'
import {
  handleDeleteChannel,
  handleUpdateChannel,
  readJsonBody,
  rejectCrossOrigin,
} from '@/lib/ai-channels-http'
import { getPayloadClient } from '@/lib/payload'

/**
 * 修改 / 删除当前登录成员自己的一个 AI 渠道。
 *
 * 渠道只能从**当前登录账号**的 companyProfile.aiChannels 里找，所以
 * 「A 用户改 B 用户的渠道」在结构上不可能：`userId` 只来自 app-session，
 * URL 里的 `:key` 只在属于该用户的数组内匹配，找不到就是 404。
 *
 * 两个方法都先过 `rejectCrossOrigin`：否则别的站点可以带着会话 Cookie 跨站删渠道/改地址。
 */
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ key: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  const crossOrigin = rejectCrossOrigin(request)
  if (crossOrigin) return crossOrigin
  const user = await appAuth.getCurrentUser()
  if (!user) return Response.json({ ok: false, error: '请先登录' }, { status: 401 })
  const { key } = await params
  const payload = await getPayloadClient()
  return handleUpdateChannel(
    { userId: String(user.id), payload },
    decodeURIComponent(key),
    await readJsonBody(request),
  )
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const crossOrigin = rejectCrossOrigin(request)
  if (crossOrigin) return crossOrigin
  const user = await appAuth.getCurrentUser()
  if (!user) return Response.json({ ok: false, error: '请先登录' }, { status: 401 })
  const { key } = await params
  const payload = await getPayloadClient()
  return handleDeleteChannel({ userId: String(user.id), payload }, decodeURIComponent(key))
}
