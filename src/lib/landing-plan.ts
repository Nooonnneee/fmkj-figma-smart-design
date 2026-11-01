import type { PlanArea, PlanPoint } from '@/components/plan-figure'
import { memoize } from '@/lib/memo-cache'
import { getPayloadClient } from '@/lib/payload'
import { normalizeScene, sceneAreas, scenePoints, sceneSheets } from '@/lib/point-scene'

export type LandingPlan = { name: string; sheetUrl: string; points: PlanPoint[]; areas: PlanArea[] }

/** 首页对照演示：读取示例母版项目的第一张图纸（1F）及其分区、点位。没有母版或图纸时返回 null。 */
export const getLandingPlan = memoize<LandingPlan | null>('landing-plan-v1', [], 10 * 60_000, async () => {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'projects',
    where: { isDemoTemplate: { equals: true } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: { pointMap: true } as never,
  })
  const project = res.docs[0]
  if (!project) return null
  const scene = normalizeScene((project as { pointMap?: unknown }).pointMap as never)
  const sheets = sceneSheets(scene.elements, scene.files)
  const sheet = sheets[0]
  if (!sheet?.url) return null
  const areas = sceneAreas(scene.elements, sheets)
  const points = scenePoints(scene.elements, sheets, areas).filter((p) => p.sheetId === sheet.id)
  return {
    name: sheet.name,
    sheetUrl: sheet.url,
    points: points.map((p) => ({ id: p.id, deviceType: p.deviceType, code: p.code, rx: p.rx, ry: p.ry })),
    areas: areas
      .filter((a) => a.sheetId === sheet.id)
      .map((a) => ({ id: a.id, name: a.name, x0: (a.x - sheet.x) / sheet.width, y0: (a.y - sheet.y) / sheet.height, x1: (a.x + a.width - sheet.x) / sheet.width, y1: (a.y + a.height - sheet.y) / sheet.height })),
  }
})
