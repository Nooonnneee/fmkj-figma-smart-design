import { fail, mpRoute, ok, readJson } from '@/lib/mp/http'
import { deletePoint, updatePoint } from '@/lib/services/point-map-service'

/** 修改点位：{ deviceType?, productId?, rx?, ry? } */
export const PUT = mpRoute<{ id: string; pointId: string }>(async ({ request, user, params }) => {
  const r = await updatePoint(user, params.id, params.pointId, await readJson(request))
  return r.ok ? ok({ pointId: r.pointId, code: r.code }) : fail(r.status, r.error)
})

export const DELETE = mpRoute<{ id: string; pointId: string }>(async ({ user, params }) => {
  const r = await deletePoint(user, params.id, params.pointId)
  return r.ok ? ok() : fail(r.status, r.error)
})
