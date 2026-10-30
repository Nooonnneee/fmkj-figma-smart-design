import { fail, mpRoute, ok, readJson } from '@/lib/mp/http'
import { syncQuoteWithPointMap } from '@/lib/services/quote-service'

/** 从点位图同步数量（保留临时改价、换过的型号和附加费用）：{ scope? } */
export const POST = mpRoute<{ id: string }>(async ({ request, user, params }) => {
  const body = await readJson(request)
  const r = await syncQuoteWithPointMap(user, params.id, body.scope)
  return r.ok ? ok({ total: r.total, pending: r.pending, scope: r.scope }) : fail(400, r.error)
})
