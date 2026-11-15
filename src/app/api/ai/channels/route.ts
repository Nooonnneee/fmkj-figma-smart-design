import { appAuth } from '@/lib/app-auth'
import { handleCreateChannel, handleListChannels, readJsonBody } from '@/lib/ai-channels-http'
import { getPayloadClient } from '@/lib/payload'

/**
 * 当前登录成员自己的 AI 渠道（自带 key）。
 *
 * 身份只来自 `appAuth.getCurrentUser()`（app-session Cookie）。请求体里即使带了
 * `userId` 也会被 `readJsonBody` 丢掉 —— 服务层只接受这里传入的 userId。
 *
 * 「只在桌面客户端开放」是产品口径：网页端不显示入口。**不在这里用 UA 拦截**，
 * 因为 UA 可伪造、不是安全边界；真正的权限是「这个账号里有没有合法的加密渠道」。
 */
export const dynamic = 'force-dynamic'

async function requireUser() {
  const user = await appAuth.getCurrentUser()
  return user ?? null
}

export async function GET() {
  const user = await requireUser()
  if (!user) return Response.json({ ok: false, error: '请先登录' }, { status: 401 })
  const payload = await getPayloadClient()
  return handleListChannels({ userId: String(user.id), payload })
}

export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) return Response.json({ ok: false, error: '请先登录' }, { status: 401 })
  const payload = await getPayloadClient()
  return handleCreateChannel({ userId: String(user.id), payload }, await readJsonBody(request))
}
