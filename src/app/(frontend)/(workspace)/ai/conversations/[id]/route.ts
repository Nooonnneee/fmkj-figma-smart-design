import { appAuth } from '@/lib/app-auth'
import { getPayloadClient } from '@/lib/payload'

const fail = (status: number, error: string) => Response.json({ ok: false, error }, { status })

/** 一个会话的全部消息（只能读自己的）。 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await appAuth.getCurrentUser()
  if (!user) return fail(401, '登录已过期')
  const { id } = await params
  const payload = await getPayloadClient()
  const conv = await payload.findByID({ collection: 'ai-conversations', id, depth: 0, user, overrideAccess: false }).catch(() => null)
  if (!conv) return fail(404, '会话不存在')
  const { docs } = await payload.find({
    collection: 'ai-messages',
    where: { conversation: { equals: id } },
    sort: 'createdAt',
    limit: 200,
    depth: 0,
    user,
    overrideAccess: false,
    select: { role: true, content: true, model: true, cost: true, toolCalls: true, createdAt: true },
  })
  return Response.json({
    ok: true,
    messages: docs.map((m) => ({ id: String(m.id), role: m.role, content: m.content, model: m.model ?? null, cost: m.cost ?? null, toolCalls: m.toolCalls ?? null, createdAt: m.createdAt })),
  })
}

/** 删除自己的会话及其消息（积分流水保留）。 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await appAuth.getCurrentUser()
  if (!user) return fail(401, '登录已过期')
  const { id } = await params
  const payload = await getPayloadClient()
  const conv = await payload.findByID({ collection: 'ai-conversations', id, depth: 0, user, overrideAccess: false }).catch(() => null)
  if (!conv) return fail(404, '会话不存在')
  await payload.delete({ collection: 'ai-messages', where: { conversation: { equals: id } }, user, overrideAccess: false })
  await payload.delete({ collection: 'ai-conversations', id, user, overrideAccess: false })
  return Response.json({ ok: true })
}
