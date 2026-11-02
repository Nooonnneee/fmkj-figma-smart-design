import { appAuth } from '@/lib/app-auth'
import { emailOtpConfigured, verifyAndConsumeEmailOtp } from '@/lib/email-otp'
import { redeemCodeForUser } from '@/lib/services/membership-service'

const REGISTER_WINDOW_MS = 10 * 60 * 1000
const REGISTER_MAX_PER_IP = 10
const registerRateMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  if (registerRateMap.size > 500) {
    for (const [k, v] of registerRateMap) {
      if (v.resetAt < now) registerRateMap.delete(k)
    }
  }
  const cur = registerRateMap.get(ip)
  if (!cur || cur.resetAt < now) {
    registerRateMap.set(ip, { count: 1, resetAt: now + REGISTER_WINDOW_MS })
    return true
  }
  if (cur.count >= REGISTER_MAX_PER_IP) return false
  cur.count += 1
  return true
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  if (!checkRateLimit(ip)) {
    return Response.json({ error: '注册请求过于频繁，请稍后再试' }, { status: 429 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown
    email?: unknown
    code?: unknown
    password?: unknown
    phone?: unknown
    redeemCode?: unknown
  }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const redeemCode = typeof body.redeemCode === 'string' ? body.redeemCode.trim().toUpperCase() : ''

  if (emailOtpConfigured()) {
    const verified = await verifyAndConsumeEmailOtp(email, 'register', code)
    if (!verified.ok) {
      return Response.json({ error: verified.error }, { status: 400 })
    }
  }

  const result = await appAuth.register({ name, email, password, phone })
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 })
  }

  if (redeemCode) {
    await redeemCodeForUser(result.user, redeemCode).catch(() => null)
  }

  return Response.json({ ok: true })
}
