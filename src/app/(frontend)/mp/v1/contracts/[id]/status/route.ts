import { fail, mpRoute, ok, readJson } from '@/lib/mp/http'
import { setContractStatusFor } from '@/lib/services/contract-service'

/** 标记签订 / 撤销签订：{ status: signed|draft, signedAt?: YYYY-MM-DD } */
export const POST = mpRoute<{ id: string }>(async ({ request, user, params }) => {
  const body = await readJson(request)
  const r = await setContractStatusFor(user, params.id, body.status, body.signedAt)
  return r.ok ? ok() : fail(400, r.error)
})
