import { bindOpenid, code2Session, findBinding, issueToken, loadActiveUser, presentMe } from '@/lib/mp/auth'
import { fail, mpPublicRoute, ok, readJson, text } from '@/lib/mp/http'
import { relId } from '@/lib/access'

/**
 * 微信一键登录：wx.login 的 code → openid。
 * 已绑定成员 → 直接签发登录令牌；未绑定 → 返回一次性绑定票据，小程序再用账号密码绑定（账号由后台开通，不开放注册）。
 */
export const POST = mpPublicRoute(async (request: Request) => {
  const body = await readJson(request)
  const code = text(body.code, 200)
  if (!code) return fail(400, '缺少微信登录凭证')
  const session = await code2Session(code)
  if (!session.ok) return fail(400, session.error, 'WECHAT_LOGIN_FAILED')

  const binding = await findBinding(session.openid, session.unionid)
  const user = binding ? await loadActiveUser(relId(binding.user)) : null
  if (binding && user) {
    await bindOpenid(String(user.id), session.openid, session.unionid, text(body.nickname, 40) || null)
    const { token, expiresAt } = await issueToken('session', { userId: String(user.id), openid: session.openid, client: 'wechat' })
    return ok({ token, expiresAt, user: await presentMe(user) })
  }
  if (binding && !user) return fail(403, '绑定的账号已停用，请联系管理员', 'ACCOUNT_DISABLED')
  const { token: bindTicket, expiresAt } = await issueToken('bind', { openid: session.openid, unionid: session.unionid, client: 'wechat' })
  return ok({ needBind: true, bindTicket, expiresAt })
})
