import { appAuth } from '@/lib/app-auth'
import { verifyAndConsumeEmailOtp } from '@/lib/email-otp'
import { getPayloadClient } from '@/lib/payload'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: unknown
    code?: unknown
    password?: unknown
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email) return Response.json({ error: '请输入注册邮箱' }, { status: 400 })
  if (!password || password.length < 8) {
    return Response.json({ error: '新密码长度至少为 8 位' }, { status: 400 })
  }

  const verified = await verifyAndConsumeEmailOtp(email, 'reset', code)
  if (!verified.ok) {
    return Response.json({ error: verified.error }, { status: 400 })
  }

  const payload = await getPayloadClient()
  const found = await payload
    .find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)
  const user = found?.docs[0]
  if (!user) {
    return Response.json({ error: '找不到该邮箱对应的账号' }, { status: 404 })
  }

  await payload.update({
    collection: 'users',
    id: user.id,
    data: { password, lockUntil: null, loginAttempts: 0 } as never,
    overrideAccess: true,
    depth: 0,
  })

  await appAuth.login(email, password)
  return Response.json({ ok: true })
}
