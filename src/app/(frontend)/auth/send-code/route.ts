import { issueAndSendEmailOtp, type OtpPurpose } from '@/lib/email-otp'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; purpose?: unknown }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const purpose: OtpPurpose = body.purpose === 'reset' ? 'reset' : 'register'

  const result = await issueAndSendEmailOtp(email, purpose)
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 })
  }
  return Response.json({ ok: true })
}
