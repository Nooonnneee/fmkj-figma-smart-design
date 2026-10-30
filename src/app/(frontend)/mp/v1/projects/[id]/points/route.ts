import { fail, mpRoute, ok, readJson } from '@/lib/mp/http'
import { addPoint } from '@/lib/services/point-map-service'

/** 放置点位：{ sheetId, rx, ry, deviceType, productId? }，坐标是相对图纸的 0–1 比例。 */
export const POST = mpRoute<{ id: string }>(async ({ request, user, params }) => {
  const r = await addPoint(user, params.id, await readJson(request))
  return r.ok ? ok({ pointId: r.pointId, code: r.code }) : fail(r.status, r.error)
})
