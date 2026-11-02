import { appAuth } from '@/lib/app-auth'
import { handleAiUpload } from '@/plugins/ai-copilot/upload-handler'

/** AI 对话框上传户型图（逻辑见 upload-handler，微信小程序共用）。 */
export async function POST(request: Request) {
  const user = await appAuth.getCurrentUser()
  if (!user) return Response.json({ ok: false, error: '登录已过期，请重新登录' }, { status: 401 })
  return handleAiUpload(request)
}
