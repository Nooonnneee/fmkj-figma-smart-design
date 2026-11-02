import { bearerToken, revokeToken } from '@/lib/mp/auth'
import { mpPublicRoute, ok } from '@/lib/mp/http'

/** 退出登录：作废当前令牌。 */
export const POST = mpPublicRoute(async (request: Request) => {
  await revokeToken(bearerToken(request))
  return ok()
})
