import { analyzeProject, groupRooms, roomKey, type AreaAnalysis } from '@/lib/area-analysis'
import { getCatalog, getCompanyInfo, type CatalogProduct } from '@/lib/cached-data'
import { categoryOfType, DEVICE_CATEGORIES, DEVICE_TYPE_ORDER } from '@/lib/device-types'
import { getPayloadClient } from '@/lib/payload'
import { parseDefaults, resolvePoint } from '@/lib/point-map-items'
import { normalizeScene, sceneAreas, scenePoints, sceneSheets, type AreaInfo, type PointInfo, type SheetInfo } from '@/lib/point-scene'
import { inPointScope, isPointScope, POINT_SCOPES, type PointScope } from '@/lib/point-scopes'
import type { Project, User } from '@/payload-types'

export { inPointScope, isPointScope, POINT_SCOPES, type PointScope }

export type DocPoint = PointInfo & { productId: string | null; source: 'point' | 'default' | 'pending' }
export type ProductRow = { product: CatalogProduct; deviceType: string; count: number; subtotal: number; rooms: string[] }
export type Room = AreaAnalysis & { sheets: string[]; points: DocPoint[]; subtotal: number }

/**
 * 项目文档（点位图、点位交底清单、方案）共用的数据：项目、图纸、区域、点位及其选型、房间分析、产品汇总、最新报价和合同。
 */
export async function loadProjectDocs(projectId: string, user: User, scope: PointScope = 'all') {
  const payload = await getPayloadClient()
  const project = (await payload
    .findByID({ collection: 'projects', id: projectId, depth: 1, user, overrideAccess: false, populate: { users: { name: true, phone: true } } })
    .catch(() => null)) as Project | null
  if (!project) return null
  const [catalog, company, quotes, contracts] = await Promise.all([
    getCatalog(),
    getCompanyInfo(),
    payload.find({ collection: 'quotes', where: { project: { equals: project.id } }, sort: '-updatedAt', limit: 1, depth: 0, user, overrideAccess: false, select: { title: true, total: true, status: true, updatedAt: true } }),
    payload.find({ collection: 'contracts', where: { project: { equals: project.id } }, limit: 1, depth: 0, user, overrideAccess: false }),
  ])
  const byId = new Map(catalog.map((p) => [p.id, p]))
  const defaults = parseDefaults(project.defaultProducts)
  const scene = normalizeScene(project.pointMap as never)
  const sheets: SheetInfo[] = sceneSheets(scene.elements, scene.files)
  const areas: AreaInfo[] = sceneAreas(scene.elements, sheets)
  const points: DocPoint[] = scenePoints(scene.elements, sheets, areas).map((p) => {
    const r = resolvePoint({ deviceType: p.deviceType, productId: p.productId }, byId, defaults)
    return { ...p, productId: r.productId, source: r.source }
  }).filter((p) => inPointScope(p.deviceType, scope))
  const areaName = new Map(areas.map((a) => [a.id, a.name]))
  const analysis = analyzeProject(areas, points, sheets)

  // 产品清单：按设备类型顺序汇总
  const rows = new Map<string, ProductRow>()
  for (const p of points) {
    if (!p.productId) continue
    const product = byId.get(p.productId)
    if (!product) continue
    const row = rows.get(product.id) ?? { product, deviceType: p.deviceType, count: 0, subtotal: 0, rooms: [] }
    row.count++
    row.subtotal += product.price
    const room = p.areaId ? areaName.get(p.areaId) : null
    if (room && !row.rooms.includes(room)) row.rooms.push(room)
    rows.set(product.id, row)
  }
  const products = [...rows.values()].sort((a, b) => DEVICE_TYPE_ORDER.indexOf(a.deviceType) - DEVICE_TYPE_ORDER.indexOf(b.deviceType) || b.count - a.count)
  const total = products.reduce((s, r) => s + r.subtotal, 0)
  const pending = points.filter((p) => !p.productId).length

  const categories = DEVICE_CATEGORIES.map((c) => {
    const pts = points.filter((p) => categoryOfType(p.deviceType)?.slug === c.slug)
    const amount = products.filter((r) => categoryOfType(r.deviceType)?.slug === c.slug).reduce((s, r) => s + r.subtotal, 0)
    return { ...c, count: pts.length, amount }
  }).filter((c) => c.count)

  const sheetName = new Map(sheets.map((s) => [s.id, s.name]))
  const rooms: Room[] = groupRooms(areas).map((group) => {
    const a = analysis.areas.find((r) => r.areaIds.includes(group[0].id))!
    const ids = new Set(group.map((g) => g.id))
    const pts = points.filter((p) => p.areaId && ids.has(p.areaId))
    return {
      ...a,
      sheets: [...new Set(group.map((g) => (g.sheetId ? sheetName.get(g.sheetId) : null)).filter((v): v is string => !!v))],
      points: pts,
      subtotal: pts.reduce((s, p) => s + (p.productId ? (byId.get(p.productId)?.price ?? 0) : 0), 0),
    }
  })

  const owner = project.owner && typeof project.owner === 'object' ? (project.owner as User) : null
  return {
    project,
    owner,
    company,
    sheets,
    areas,
    points,
    rooms,
    roomKey,
    analysis,
    products,
    productById: byId,
    categories,
    total,
    pending,
    quote: quotes.docs[0] ?? null,
    contract: contracts.docs[0] ?? null,
    scope,
  }
}

export type ProjectDocsData = NonNullable<Awaited<ReturnType<typeof loadProjectDocs>>>

/** 点位范围的显示名（用于标题） */
export const scopeTitle = (scope: PointScope) => (scope === 'all' ? '' : POINT_SCOPES.find((s) => s.value === scope)?.label ?? '')

const SWITCH_TYPES = ['switch-1', 'switch-2', 'switch-3', 'switch-4']

/** 方案里的场景名称（「回家模式：…」取冒号前），去重。 */
export const sceneNames = (d: ProjectDocsData) => [...new Set(d.rooms.flatMap((r) => r.scenes).map((s) => s.split('：')[0]))]

/**
 * 共同验收清单：按项目实际设备生成（点位数、开关、窗帘、门磁、门锁、场景、传感器）。
 * 点位交底清单和方案的「服务交付」页共用。
 */
export function acceptanceChecks(d: ProjectDocsData) {
  const count = (types: string[]) => d.points.filter((p) => types.includes(p.deviceType)).length
  const switches = count(SWITCH_TYPES)
  const curtainPts = d.points.filter((p) => p.deviceType === 'curtain-track')
  const curtains = curtainPts.length
  const curtainRoom = curtainPts[0]?.areaId ? d.areas.find((a) => a.id === curtainPts[0].areaId)?.name : null
  const contacts = count(['contact-sensor'])
  const locks = count(['smart-lock'])
  const scenes = sceneNames(d)
  const shown = scenes.slice(0, 3)
  const tests = [
    switches ? `${switches}只开关` : null,
    curtains ? `${curtains > 1 ? `${curtains}处` : (curtainRoom ?? '')}窗帘行程` : null,
    contacts ? '门磁开合状态' : null,
    locks ? '门锁开锁与告警' : null,
  ].filter(Boolean)
  return [
    `核对${d.points.length}台/只设备的编号、型号、位置与数量。`,
    tests.length ? `测试${tests.join('、')}。` : '测试全部设备的手动与手机控制。',
    shown.length ? `演示${shown.join(' / ')}${scenes.length > 3 ? `等${scenes.length}个` : `${shown.length}个`}场景及手动操作。` : '演示回家 / 离家 / 睡眠3个场景及手动操作。',
    count(['water-sensor'])
      ? '模拟水浸、复位及手机通知，记录网络依赖。'
      : count(['smoke-sensor'])
        ? '模拟烟雾报警、复位及手机通知，记录网络依赖。'
        : '模拟传感器触发、复位及手机通知，记录网络依赖。',
    '测试网络覆盖与断网表现，明确本地可用范围。',
    '账号绑定业主，移交清单、配置备份与维护说明。',
  ]
}

/** 文档编号：有合同用合同编号，否则按日期生成。 */
export const docNumber = (d: ProjectDocsData, prefix: string) =>
  d.contract?.number ?? `${prefix}-${new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }).replaceAll('-', '').slice(2)}`
