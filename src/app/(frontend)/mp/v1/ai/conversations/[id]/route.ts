import { fail, mpRoute, ok } from '@/lib/mp/http'
import { deleteConversation, getConversationMessages } from '@/plugins/ai-copilot/conversations'

export const GET = mpRoute<{ id: string }>(async ({ user, params }) => {
  const messages = await getConversationMessages(user, params.id)
  return messages ? ok({ messages }) : fail(404, '会话不存在')
})

export const DELETE = mpRoute<{ id: string }>(async ({ user, params }) =>
  (await deleteConversation(user, params.id)) ? ok() : fail(404, '会话不存在'),
)
