import { hashToken } from '@/lib/mp/auth'
import { fail, mpRoute, ok, readJson, text } from '@/lib/mp/http'
import { getPayloadClient } from '@/lib/payload'

function extractTicket(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('fmkj-login:')) return trimmed.slice('fmkj-login:'.length).trim()
  // 兼容小程序码返回相对路径（如 pages/mine/index?scene=xxx）或完整 URL
  const qIndex = trimmed.indexOf('?')
  if (qIndex >= 0) {
    const qs = new URLSearchParams(trimmed.slice(qIndex + 1))
    const fromQuery = qs.get('ticket') || qs.get('scene')
    if (fromQuery) {
      try {
        return decodeURIComponent(fromQuery).trim()
      } catch {
        return fromQuery.trim()
      }
    }
  }
  try {
    const u = new URL(trimmed)
    return u.searchParams.get('ticket') || u.searchParams.get('scene') || trimmed
  } catch {
    return trimmed
  }
}

/** 小程序端扫码后预检票据状态，用于在确认弹窗展示发起时间，防范诱导扫码钓鱼。 */
export const GET = mpRoute(async ({ request }) => {
  const raw = new URL(request.url).searchParams.get('ticket') ?? ''
  const ticket = extractTicket(raw.slice(0, 240))
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
  return ok({
    valid: true,
    issuedAt: doc.lastUsedAt || doc.createdAt,
    expiresAt: doc.expiresAt,
  })
})

/** 小程序端扫码确认登录电脑网页端：将当前小程序登录的成员绑定到电脑端的待确认二维码票据上。 */
export const POST = mpRoute(async ({ request, user }) => {
  const body = await readJson(request)
  const ticket = extractTicket(text(body.ticket, 240))
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
