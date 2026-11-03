import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { MapPin, Phone } from 'lucide-react'

import { PlanDemo } from '@/components/landing/plan-demo'
import { ProposalShowcase } from '@/components/landing/proposal-showcase'
import { QuoteShowcase } from '@/components/landing/quote-showcase'
import { money, Section } from '@/components/landing/section'
import { Badge } from '@/components/ui/badge'
import { MINIMAL_STYLE } from '@/documents/minimal'
import { DOC_KINDS } from '@/documents/registry'
import { relId } from '@/lib/access'
import { floorTagFromSheetName } from '@/lib/area-analysis'
import { APP_NAME } from '@/lib/brand'
import { getCatalog, getCompanyInfo, resolveMediaUrl } from '@/lib/cached-data'
import type { LandingShowcase, ShowcaseQuote } from '@/lib/landing-showcase'
import { getPayloadClient } from '@/lib/payload'
import { normalizeScene, planAreaOf, sceneAreas, scenePoints, sceneSheets } from '@/lib/point-scene'
import { projectDisplayName } from '@/lib/project-name'
import type { Media, Project } from '@/payload-types'
import { PLUGIN_DOC_STYLES } from '@/plugins/doc-styles/styles'

import { ShareExportButton } from './share-export-button'

export const metadata: Metadata = {
  title: `方案与报价预览 · ${APP_NAME}`,
  robots: { index: false, follow: false },
}

const DOC_STYLES = [MINIMAL_STYLE, ...PLUGIN_DOC_STYLES]
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const text = (v: unknown) => (typeof v === 'string' ? v : '')

async function loadSharedShowcase(token: string) {
  const trimmed = token.trim()
  if (!trimmed || trimmed.length < 4 || trimmed.length > 80) return null
  const payload = await getPayloadClient()

  let project: Project | null = null
  if (trimmed === 'demo') {
    const demoRes = await payload.find({
      collection: 'projects',
      where: { isDemoTemplate: { equals: true } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    project = (demoRes.docs[0] as Project | undefined) ?? null
  } else {
    // 只拉取 id 与 shareConfig，避免扫描项目表时把数以百计的 pointMap 大 JSON 全部读进内存
    const res = await payload.find({
      collection: 'projects',
      limit: 1000,
      depth: 0,
      overrideAccess: true,
      select: { shareConfig: true } as never,
    })
    const matched = (res.docs as Project[]).find((p) => {
      const sc = (p as unknown as { shareConfig?: { enabled?: boolean; token?: string } | null }).shareConfig
      return sc && sc.enabled !== false && sc.token === trimmed
    })
    if (matched) {
      project = (await payload
        .findByID({
          collection: 'projects',
          id: matched.id,
          depth: 0,
          overrideAccess: true,
        })
        .catch(() => null)) as Project | null
    }
  }
  if (!project) return null

  const ownerId = relId(project.owner)
  const [company, quotesRes, catalog] = await Promise.all([
    getCompanyInfo(ownerId),
    payload.find({
      collection: 'quotes',
      where: { project: { equals: project.id } },
      sort: '-updatedAt',
      limit: 10,
      depth: 0,
      overrideAccess: true,
    }),
    getCatalog().catch(() => []),
  ])
  const catalogById = new Map(catalog.map((p) => [p.id, p]))

  const scene = normalizeScene(project.pointMap as never)
  const allSheets = sceneSheets(scene.elements, scene.files)
  const areas = sceneAreas(scene.elements, allSheets)
  const points = scenePoints(scene.elements, allSheets, areas)
  const areaName = new Map(areas.map((a) => [a.id, a.name]))

  const sheets = allSheets
    .filter((s) => s.url)
    .map((s, i) => ({
      id: s.id,
      name: s.name,
      floor: floorTagFromSheetName(s.name) || `第${i + 1}层`,
      url: s.url!,
      points: points
        .filter((p) => p.sheetId === s.id && p.rx != null && p.ry != null)
        .map((p) => ({
          id: p.id,
          type: p.deviceType,
          code: p.code,
          rx: p.rx!,
          ry: p.ry!,
          room: p.areaId ? (areaName.get(p.areaId) ?? null) : null,
        })),
      areas: areas.filter((a) => a.sheetId === s.id).map((a) => planAreaOf(a, s)),
    }))

  const docs = quotesRes.docs as unknown as Record<string, unknown>[]
  const finalQuoteId = relId((project as { finalQuote?: unknown }).finalQuote)
  const main =
    (finalQuoteId ? docs.find((q) => String(q.id) === finalQuoteId) : undefined) ??
    docs.find((q) => q.status === 'accepted') ??
    docs[0]

  let quote: ShowcaseQuote | null = null
  if (main) {
    const items = (Array.isArray(main.items) ? main.items : []) as Record<string, unknown>[]
    const imageIds = [...new Set(items.map((i) => i.image).filter((id): id is string => typeof id === 'string'))]
    const media = imageIds.length
      ? await payload.find({ collection: 'media', where: { id: { in: imageIds } }, limit: imageIds.length, depth: 0, overrideAccess: true })
      : { docs: [] as Media[] }
    const imageUrl = new Map(media.docs.map((m) => [String(m.id), resolveMediaUrl(m)]))
    quote = {
      title: text(main.title),
      lines: items.map((i) => {
        const pid = typeof i.product === 'string' ? i.product : i.product && typeof i.product === 'object' ? String((i.product as { id?: unknown }).id ?? '') : ''
        const catProd = pid ? catalogById.get(pid) : undefined
        const customImg = typeof i.image === 'string' ? (imageUrl.get(i.image) ?? null) : null
        return {
          type: text(i.deviceType) || catProd?.deviceType || 'other',
          name: text(i.name) || catProd?.name || '',
          sku: text(i.sku) || catProd?.sku || '',
          unit: text(i.unit) || catProd?.unit || '个',
          price: num(i.price),
          qty: num(i.quantity),
          image: customImg ?? catProd?.image?.url ?? null,
          brandName: catProd?.brand?.name ?? null,
          brandLogo: catProd?.brand?.logo ?? null,
        }
      }),
      fees: ((Array.isArray(main.fees) ? main.fees : []) as Record<string, unknown>[]).map((f) => ({ name: text(f.name), amount: num(f.amount) })),
      discount: num(main.discount),
      productTotal: num(main.productTotal),
      total: num(main.total),
      quoteCount: docs.length,
    }
  }

  const data: LandingShowcase = {
    project: {
      name: projectDisplayName(project.name),
      customer: text(project.customerName),
      community: text(project.community),
      address: text(project.address),
      platform: text(project.platform),
    },
    sheets,
    pointCount: sheets.reduce((s, sh) => s + sh.points.length, 0),
    roomCount: new Set(points.map((p) => p.areaId).filter(Boolean)).size,
    quote,
    library: { products: catalog.length, brands: 27 },
  }

  return { data, company }
}

/** 业主免登录只读预览页：展示交互式点位图、横版方案与定稿报价单，不含内部成本与管理后台入口。 */
export default async function ClientSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const shared = await loadSharedShowcase(token)
  if (!shared) notFound()
  const { data, company } = shared
  const address = [data.project.community, data.project.address].filter(Boolean).join(' ')

  return (
    <div data-landing className="min-h-svh overflow-x-clip bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {company.logo ? (
              <Image src={company.logo.url} alt={company.name} width={company.logo.width ?? 96} height={company.logo.height ?? 96} className="h-8 w-auto object-contain" unoptimized />
            ) : null}
            <div>
              <p className="text-sm font-medium">{company.name}</p>
              {company.slogan ? <p className="text-xs text-muted-foreground">{company.slogan}</p> : null}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {company.phone ? (
              <span className="hidden items-center gap-1 sm:inline-flex">
                <Phone className="size-3.5" />
                {company.phone}
              </span>
            ) : null}
            <Badge variant="outline" className="hidden sm:inline-flex">业主方案预览</Badge>
            <ShareExportButton projectName={data.project.name} />
          </div>
        </div>
      </header>

      <main>
        <section className="px-4 pt-12 sm:px-6 sm:pt-16 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {data.project.customer ? <span>客户：{data.project.customer}</span> : null}
                  {address ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {address}
                    </span>
                  ) : null}
                  {data.project.platform ? <span>主平台：{data.project.platform}</span> : null}
                </div>
                <h1 className="mt-2 text-3xl font-medium tracking-tight sm:text-4xl">{data.project.name}</h1>
              </div>
              {data.quote ? (
                <div className="text-left sm:text-right">
                  <p className="text-xs text-muted-foreground">方案报价合计</p>
                  <p className="text-3xl font-semibold tracking-tight tabular-nums">{money(data.quote.total)}</p>
                </div>
              ) : null}
            </div>

            {data.sheets.length > 0 ? (
              <div className="mt-8">
                <PlanDemo data={data} />
              </div>
            ) : null}
          </div>
        </section>

        <Section id="proposal" labelledBy="proposal-title" className="pt-20 sm:pt-28">
          <ProposalShowcase data={data} company={company} />
        </Section>

        {data.quote ? (
          <Section id="quote" labelledBy="quote-title" className="pt-20 sm:pt-28">
            <QuoteShowcase data={data} quote={data.quote} styles={DOC_STYLES} layouts={DOC_KINDS.quote.layouts} company={company} />
          </Section>
        ) : null}
      </main>

      <footer className="border-t border-border/70 py-8 text-center text-xs text-muted-foreground">
        <p>
          {company.name}
          {company.phone ? ` · 电话：${company.phone}` : ''}
          {company.address ? ` · 地址：${company.address}` : ''}
        </p>
      </footer>
    </div>
  )
}
