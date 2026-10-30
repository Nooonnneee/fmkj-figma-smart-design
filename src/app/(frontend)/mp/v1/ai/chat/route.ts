import { mpRoute } from '@/lib/mp/http'
import { handleAiChat } from '@/plugins/ai-copilot/chat-handler'

/** AI 对话（NDJSON 流）。小程序用 wx.request 的 enableChunked 逐段读取。 */
export const POST = mpRoute(async ({ request, user }) => handleAiChat(request, user))
