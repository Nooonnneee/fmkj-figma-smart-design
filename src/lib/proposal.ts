import { analyzeProject, groupRooms, roomKey, type AreaAnalysis } from '@/lib/area-analysis'
import { getCatalog, getCompanyInfo, type CatalogProduct } from '@/lib/cached-data'
import { categoryOfType, DEVICE_CATEGORIES, DEVICE_TYPE_ORDER } from '@/lib/device-types'
import { getPayloadClient } from '@/lib/payload'
import { parseDefaults, resolvePoint } from '@/lib/point-map-items'
import { normalizeScene, sceneAreas, scenePoints, sceneSheets, type AreaInfo, type PointInfo, type SheetInfo } from '@/lib/point-scene'
import { inPointScope, isPointScope, POINT_SCOPES, type PointScope } from '@/lib/point-scopes'
import type { Project, User } from '@/payload-types'

export { inPointScope, isPointScope, POINT_SCOPES, type PointScope }

/** 方案模板：同一份点位数据，三种呈现方式。 */
export const PROPOSAL_TEMPLATES = [
  { value: 'modern', label: '现代简约', description: '白底细线，适合大多数客户', markers: 'symbol' },
  { value: 'premium', label: '高端提案', description: '深色封面、产品图点位，适合别墅大宅', markers: 'product' },
  { value: 'construction', label: '施工交底', description: '点位代号与清单，不含价格，给安装团队', markers: 'symbol' },
] as const
export type ProposalTemplate = (typeof PROPOSAL_TEMPLATES)[number]['value']
export const isProposalTemplate = (v: unknown): v is ProposalTemplate => PROPOSAL_TEMPLATES.some((t) => t.value === v)

export type ProposalPoint = PointInfo & { productId: string | null; source: 'point' | 'default' | 'pending' }
export type ProductRow = { product: CatalogProduct; deviceType: string; count: number; subtotal: number; rooms: string[] }
export type Room = AreaAnalysis & { sheets: string[]; points: ProposalPoint[]; subtotal: number }

export async function loadProposal(projectId: string, user: User, scope: PointScope = 'all') {
  const payload = await getPayloadClient()
  const project = (await payload
    .findByID({ collection: 'projects', id: projectId, depth: 1, user, overrideAccess: false, populate: { users: { name: true, phone: true } } })
    .catch(() => null)) as Project | null
  if (!project) return null
  const [catalog, company, quotes] = await Promise.all([
    getCatalog(),
    getCompanyInfo(),
    payload.find({ collection: 'quotes', where: { project: { equals: project.id } }, sort: '-updatedAt', limit: 1, depth: 0, user, overrideAccess: false, select: { title: true, total: true, status: true, updatedAt: true } }),
  ])
  const byId = new Map(catalog.map((p) => [p.id, p]))
  const defaults = parseDefaults(project.defaultProducts)
  const scene = normalizeScene(project.pointMap as never)
  const sheets: SheetInfo[] = sceneSheets(scene.elements, scene.files)
  const areas: AreaInfo[] = sceneAreas(scene.elements, sheets)
  const points: ProposalPoint[] = scenePoints(scene.elements, sheets, areas).map((p) => {
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
    scope,
  }
}

export type ProposalData = NonNullable<Awaited<ReturnType<typeof loadProposal>>>
