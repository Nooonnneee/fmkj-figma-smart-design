import { mpRoute, ok } from '@/lib/mp/http'
import { listConversations } from '@/plugins/ai-copilot/conversations'

export const GET = mpRoute(async ({ user }) => ok({ items: await listConversations(user) }))
