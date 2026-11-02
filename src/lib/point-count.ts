import { isPointData, type PointCustomData } from '@/lib/point-map-items'

/** 点位图里的点位数量（未删除且带设备类型 / 产品的元素）。 */
export function countScenePoints(pointMap: unknown) {
  const elements = (pointMap as { elements?: unknown[] } | null)?.elements
  if (!Array.isArray(elements)) return 0
  return elements.filter((el) => {
    const e = el as { isDeleted?: boolean; customData?: PointCustomData } | null
    return Boolean(e && !e.isDeleted && isPointData(e.customData))
  }).length
}
