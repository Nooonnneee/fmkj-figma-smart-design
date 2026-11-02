import { mpRoute } from '@/lib/mp/http'
import { handleAiUpload } from '@/plugins/ai-copilot/upload-handler'

/** AI 对话里上传户型图（wx.uploadFile，字段 file）。 */
export const POST = mpRoute(async ({ request }) => handleAiUpload(request))
