import { fail, mpRoute, ok, readJson, text } from '@/lib/mp/http'
import { redeemCodeForUser } from '@/lib/services/membership-service'

/** 小程序端核销兑换码（充值 AI 积分或激活/顺延会员等级）。 */
export const POST = mpRoute(async ({ request, user }) => {
  const body = await readJson(request)
  const result = await redeemCodeForUser(user, text(body.code, 40))
  if (!result.ok) return fail(400, result.error)
  return ok(result)
})
