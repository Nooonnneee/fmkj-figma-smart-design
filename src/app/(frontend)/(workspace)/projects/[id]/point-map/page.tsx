import { notFound, redirect } from 'next/navigation'

import { appAuth } from '@/lib/app-auth'
import { getPayloadClient } from '@/lib/payload'
import { getCatalog } from '@/lib/cached-data'
import { parseDefaults } from '@/lib/point-map-items'
import { isPointScope, type PointScope } from '@/lib/point-scopes'
import { normalizeScene, type StoredScene } from '@/lib/point-scene'
import { getDwgSettings } from '@/plugins/dwg-converter'
import type { Quote } from '@/payload-types'

import { canEditProjects } from '../../data'
import { PointMapEditor, type PointProduct } from './point-map-editor'

export const metadata = { title: '点位图 · FMKJ 项目管理' }

export default async function PointMapPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ quoteId?: string; sheet?: string; area?: string; point?: string; scope?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const user = await appAuth.getCurrentUser()
  if (!user) redirect('/login')
  const payload = await getPayloadClient()
  const project = await payload
    .findByID({ collection: 'projects', id, depth: 0, user, overrideAccess: false, select: { name: true, platform: true, pointMap: true, defaultProducts: true } })
    .catch(() => null)
  if (!project) notFound()

  const quotesResult = await payload.find({
    collection: 'quotes',
    where: { project: { equals: project.id } },
    sort: '-updatedAt',
    limit: 20,
    depth: 0,
    user,
    overrideAccess: false,
    select: { title: true, status: true, total: true, updatedAt: true },
  })
  const quotes = (quotesResult.docs as Quote[]).map((q) => ({
    id: String(q.id),
    title: q.title,
    status: q.status,
    total: q.total ?? 0,
  }))

  // 下架产品也下发，保证旧点位仍能显示名称；选择列表只列在售产品。
  const products: PointProduct[] = (await getCatalog()).map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    price: p.price,
    unit: p.unit,
    status: p.status,
    deviceType: p.deviceType,
    brand: p.brand?.name ?? '',
    brandLogo: p.brand?.logo ?? null,
    image: p.image?.url ?? null,
  }))

  // 打开时整理场景：旧点位换成新版图标、旧户型图补上图纸信息
  const { warnings, repaired, ...scene } = normalizeScene(project.pointMap as Partial<StoredScene> | null)
  const readOnly = !canEditProjects(user?.role)

  return (
    <PointMapEditor
      projectId={String(project.id)}
      projectName={project.name}
      platform={project.platform ?? null}
      initialScene={scene}
      warnings={warnings}
      needsSave={repaired > 0 && !readOnly}
      products={products}
      initialDefaults={parseDefaults(project.defaultProducts)}
      quotes={quotes}
      initialFocus={{
        quoteId: typeof sp.quoteId === 'string' ? sp.quoteId : null,
        sheet: typeof sp.sheet === 'string' ? sp.sheet : null,
        area: typeof sp.area === 'string' ? sp.area : null,
        point: typeof sp.point === 'string' ? sp.point : null,
        scope: isPointScope(sp.scope) ? (sp.scope as PointScope) : null,
      }}
      readOnly={readOnly}
      dwgEnabled={Boolean(getDwgSettings(payload.config))}
    />
  )
}
