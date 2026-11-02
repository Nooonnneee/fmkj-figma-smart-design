import { getPayloadClient } from '@/lib/payload'
import { fail, mpRoute, ok, readJson } from '@/lib/mp/http'
import { presentQuoteSummary } from '@/lib/mp/present'
import { createQuoteForProject } from '@/lib/services/quote-service'

export const GET = mpRoute<{ id: string }>(async ({ user, params }) => {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'quotes',
    where: { project: { equals: params.id } },
    sort: '-updatedAt',
    limit: 100,
    depth: 0,
    user,
    overrideAccess: false,
    select: { title: true, status: true, total: true, updatedAt: true },
  })
  return ok({ items: res.docs.map(presentQuoteSummary) })
})

/** 从点位图生成报价：{ scope: all|no-light|switch|switch-light } */
export const POST = mpRoute<{ id: string }>(async ({ request, user, params }) => {
  const body = await readJson(request)
  const r = await createQuoteForProject(user, params.id, body.scope)
  return r.ok ? ok({ quoteId: r.quoteId, pending: r.pending }) : fail(r.status, r.error)
})
