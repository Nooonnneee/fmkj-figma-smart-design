import { getCatalog } from '@/lib/cached-data'
import { fail, mpRoute, ok } from '@/lib/mp/http'
import { presentProduct } from '@/lib/mp/present'

export const GET = mpRoute<{ id: string }>(async ({ params }) => {
  const product = (await getCatalog()).find((p) => p.id === params.id)
  return product ? ok(presentProduct(product, true)) : fail(404, '产品不存在或已下架')
})
