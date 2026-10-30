import { appAuth } from '@/lib/app-auth'
import { getPayloadClient } from '@/lib/payload'

/** 当前成员最近的会话列表。 */
export async function GET() {
  const user = await appAuth.getCurrentUser()
  if (!user) return Response.json({ ok: false, error: '登录已过期' }, { status: 401 })
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'ai-conversations',
    where: { owner: { equals: user.id } },
    sort: '-updatedAt',
    limit: 30,
    depth: 0,
    user,
    overrideAccess: false,
    select: { title: true, updatedAt: true },
  })
  return Response.json({ ok: true, conversations: docs.map((d) => ({ id: String(d.id), title: d.title, updatedAt: d.updatedAt })) })
}
