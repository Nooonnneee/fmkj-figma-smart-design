import { hashToken } from '@/lib/mp/auth'
import { fail, mpRoute, ok, readJson, text } from '@/lib/mp/http'
import { getPayloadClient } from '@/lib/payload'

function extractTicket(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith('fmkj-login:')) return trimmed.slice('fmkj-login:'.length).trim()
  try {
    const u = new URL(trimmed)
    return u.searchParams.get('ticket') || u.searchParams.get('scene') || trimmed
  } catch {
    return trimmed
  }
}

/** 小程序端扫码确认登录电脑网页端：将当前小程序登录的成员绑定到电脑端的待确认二维码票据上。 */
export const POST = mpRoute(async ({ request, user }) => {
  const body = await readJson(request)
  const ticket = extractTicket(text(body.ticket, 200))
  if (!ticket || ticket.length < 20 || ticket.length > 60) {
    return fail(400, '无效的电脑端登录二维码')
  }

  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'mp-sessions',
    where: {
      and: [{ tokenHash: { equals: hashToken(ticket) } }, { kind: { equals: 'web-ticket' } }],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = docs[0]
  if (!doc || new Date(doc.expiresAt).getTime() < Date.now()) {
    return fail(400, '二维码已过期，请在电脑上点击刷新后重新扫码')
  }

  await payload.update({
    collection: 'mp-sessions',
    id: doc.id,
    data: {
      user: user.id,
      client: 'qr-confirmed',
      lastUsedAt: new Date().toISOString(),
    },
    overrideAccess: true,
    depth: 0,
  })

  return ok({ confirmed: true, name: user.name })
})
