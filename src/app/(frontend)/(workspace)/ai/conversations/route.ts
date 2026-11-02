import { appAuth } from '@/lib/app-auth'
import { listConversations } from '@/plugins/ai-copilot/conversations'

/** 当前成员最近的会话列表。 */
export async function GET() {
  const user = await appAuth.getCurrentUser()
  if (!user) return Response.json({ ok: false, error: '登录已过期' }, { status: 401 })
  return Response.json({ ok: true, conversations: await listConversations(user) })
}
