import { mpRoute, ok } from '@/lib/mp/http'
import { handleAiUpload, recognitionStatusPayload } from '@/plugins/ai-copilot/upload-handler'

/** AI 对话里上传图片（wx.uploadFile，字段 file）。 */
export const POST = mpRoute(async ({ request }) => handleAiUpload(request))

/** 查询上传图纸的视觉复核进度：GET /mp/v1/ai/upload?mediaId=xxx */
export const GET = mpRoute(async ({ request }) => ok(recognitionStatusPayload(request)))
