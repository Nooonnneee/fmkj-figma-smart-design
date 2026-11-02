import { appAuth } from '@/lib/app-auth'
import { redeemCodeForUser } from '@/lib/services/membership-service'

const fail = (status: number, error: string) => Response.json({ ok: false, error }, { status })

/** 网页端核销兑换码（充值 AI 积分或激活/顺延会员等级）。 */
export async function POST(request: Request) {
  const user = await appAuth.getCurrentUser()
  if (!user) return fail(401, '登录已过期，请重新登录')

  const body = (await request.json().catch(() => ({}))) as { code?: unknown }
  const result = await redeemCodeForUser(user, body.code)
  if (!result.ok) return fail(400, result.error)
  return Response.json(result)
}
