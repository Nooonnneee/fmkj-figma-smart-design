import { cookies, headers } from 'next/headers'
import { cache } from 'react'

import { getPayloadClient } from '@/lib/payload'
import { userFromToken } from '@/lib/mp/auth'
import type { User } from '@/payload-types'

const APP_SESSION_COOKIE = 'app-session'
const SIGNED_OUT_SENTINEL = 'signed-out'
/** 微信小程序 web-view 里打开网页（打印页）时的会话，由一次性票据换取，2 小时有效。 */
const MP_WEB_COOKIE = 'mp-web-session'

/**
 * Cookie 策略：
 * - Figma Make 预览运行在跨站 HTTPS iframe 中，使用 SameSite=None + Secure + Partitioned（本地 localhost 调试回退为 Lax）；
 * - 自托管服务器与本地开发根据当前请求的真实协议（x-forwarded-proto / origin）决定 Secure，避免 .env 写了 https:// 但用 HTTP 访问时 Cookie 被浏览器拒收。
 */
async function sessionCookieOptions() {
  const h = await headers().catch(() => null)
  const host = h?.get('x-forwarded-host') || h?.get('host') || ''
  const proto = h?.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase()
  const origin = h?.get('origin') || h?.get('referer') || ''
  const isLocalHttp = (host.startsWith('localhost') || host.startsWith('127.0.0.1')) && proto !== 'https' && !origin.startsWith('https://')

  if (process.env.FIGMA === '1') {
    if (isLocalHttp) {
      return { httpOnly: true, sameSite: 'lax' as const, secure: false, path: '/' }
    }
    return { httpOnly: true, sameSite: 'none' as const, secure: true, partitioned: true, path: '/' }
  }
  const isHttps = proto ? proto === 'https' : origin ? origin.startsWith('https://') : !isLocalHttp && Boolean(process.env.PUBLIC_URL?.startsWith('https://'))
  return { httpOnly: true, sameSite: 'lax' as const, secure: isHttps, path: '/' }
}

/**
 * Figma Make 预览环境兜底：沙箱重启后预览子域名会更换，且部分浏览器在跨站 iframe 中拦截第三方 Cookie。
 * 当预览环境未携带 Cookie（且未主动点击退出登录）时，自动回退到内置演示管理员账号（demo@fmkj.dev），避免卡在登录页死循环。
 */
async function resolvePreviewFallbackUser(): Promise<User | null> {
  if (process.env.FIGMA !== '1') return null
  const payload = await getPayloadClient()
  const preferred = await payload
    .find({
      collection: 'users',
      where: { and: [{ email: { equals: 'demo@fmkj.dev' } }, { status: { equals: 'active' } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)
  if (preferred?.docs[0]) {
    return { ...(preferred.docs[0] as User), collection: 'users' } as User
  }
  const anyActive = await payload
    .find({
      collection: 'users',
      where: { status: { equals: 'active' } },
      sort: 'createdAt',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)
  return anyActive?.docs[0] ? ({ ...(anyActive.docs[0] as User), collection: 'users' } as User) : null
}

/**
 * 员工登录（app-session Cookie），与 Payload 后台的 CMS 登录完全独立。
 * 只读取 app-session，只认 `users` 集合的身份。
 */
export function createAppAuth(appUserCollection: 'users') {
  const getCurrentUser = cache(async (): Promise<User | null> => {
    const jar = await cookies()
    const token = jar.get(APP_SESSION_COOKIE)?.value
    if (token === SIGNED_OUT_SENTINEL) return null
    if (token) {
      const payload = await getPayloadClient()
      const authHeaders = new Headers({ Authorization: `JWT ${token}` })
      const { user } = await payload.auth({ headers: authHeaders })
      if (user && user.collection === appUserCollection) {
        const appUser = user as User & { collection: string }
        return appUser.status === 'active' ? appUser : null
      }
    }
    const mpToken = jar.get(MP_WEB_COOKIE)?.value
    if (mpToken) {
      const mpUser = await userFromToken(mpToken, 'web')
      if (mpUser) return mpUser
    }
    return resolvePreviewFallbackUser()
  })

  async function login(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const payload = await getPayloadClient()
    try {
      // 若账号此前因输错密码被锁定，登录前自动解除锁定计数
      const existing = await payload
        .find({ collection: appUserCollection, where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true, showHiddenFields: true })
        .catch(() => null)
      const doc = existing?.docs[0] as (User & { lockUntil?: string | null; loginAttempts?: number | null }) | undefined
      if (doc && (doc.lockUntil || (doc.loginAttempts && doc.loginAttempts > 0))) {
        await payload
          .update({ collection: appUserCollection, id: doc.id, data: { lockUntil: null, loginAttempts: 0 } as never, overrideAccess: true, depth: 0 })
          .catch(() => null)
      }

      const result = await payload.login({
        collection: appUserCollection,
        data: { email, password },
      })
      if (!result.token || !result.user) return { ok: false, error: '邮箱或密码不正确' }
      if ((result.user as User).status !== 'active') return { ok: false, error: '该账号已停用，请联系管理员' }

      const opts = await sessionCookieOptions()
      ;(await cookies()).set(APP_SESSION_COOKIE, result.token, {
        ...opts,
        expires: result.exp ? new Date(result.exp * 1000) : undefined,
      })
      return { ok: true }
    } catch {
      return { ok: false, error: '邮箱或密码不正确' }
    }
  }

  async function logout() {
    const jar = await cookies()
    const opts = await sessionCookieOptions()
    if (process.env.FIGMA === '1') {
      jar.set(APP_SESSION_COOKIE, SIGNED_OUT_SENTINEL, { ...opts, maxAge: 60 * 60 * 12 })
    } else {
      jar.set(APP_SESSION_COOKIE, '', { ...opts, maxAge: 0 })
    }
    jar.set(MP_WEB_COOKIE, '', { ...opts, maxAge: 0 })
  }

  /** 小程序 web-view：用一次性票据换来的网页会话令牌写入 Cookie。 */
  async function startMpWebSession(token: string, expiresAt: string) {
    const opts = await sessionCookieOptions()
    ;(await cookies()).set(MP_WEB_COOKIE, token, { ...opts, expires: new Date(expiresAt) })
  }

  return { getCurrentUser, login, logout, startMpWebSession }
}

export const appAuth = createAppAuth('users')
