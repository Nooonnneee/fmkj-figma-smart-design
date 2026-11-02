import { appAuth } from '@/lib/app-auth'
import { handleAiChat } from '@/plugins/ai-copilot/chat-handler'

/** 网页侧栏的 AI 对话（逻辑见 chat-handler，微信小程序共用）。 */
export async function POST(request: Request) {
  const user = await appAuth.getCurrentUser()
  if (!user) return Response.json({ ok: false, error: '登录已过期，请重新登录' }, { status: 401 })
  return handleAiChat(request, user)
}
