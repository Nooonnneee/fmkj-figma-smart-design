import { relId } from '@/lib/access'
import { appAuth } from '@/lib/app-auth'
import { issueToken, loadActiveUser, readToken } from '@/lib/mp/auth'

/** web-view 入口：一次性票据 → 网页会话 Cookie → 跳转到打印页。票据无效时提示回到小程序重试。 */
export async function GET(request: Request) {
  const ticket = await readToken(new URL(request.url).searchParams.get('ticket'), 'web-ticket', { consume: true })
  const user = ticket ? await loadActiveUser(relId(ticket.user)) : null
  const target = ticket?.redirect && ticket.redirect.startsWith('/print/') ? ticket.redirect : null
  if (!user || !target) {
    return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><p style="font:16px/1.6 sans-serif;padding:24px">链接已失效，请返回小程序重新打开。</p>', {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
  const { token, expiresAt } = await issueToken('web', { userId: String(user.id), client: 'web-view' })
  await appAuth.startMpWebSession(token, expiresAt)
  return new Response(null, { status: 303, headers: { location: target } })
}
