import { CACHE_TAGS } from '@/lib/cache-tags'
import { memoize } from '@/lib/memo-cache'
import { getPayloadClient } from '@/lib/payload'
import type { Brand, Category, Media, Product } from '@/payload-types'
import { parseAiModels, type AiModelConfig } from '@/plugins/ai-copilot/templates'

/**
 * 很少变动的共享数据，缓存在服务端进程内，写入时由集合 hook 立即清除。
 * 这里使用 overrideAccess 读取完整数据：调用方页面已在工作区布局中校验员工登录，
 * 只在登录后的页面和接口里使用。
 */

/** 兜底过期时间：即使有绕过 hook 的修改，最多 60 秒后也会生效。 */
const TTL = 60_000

/** 兼容云端存储与自托管本地存储：当 m.url 未直接填充时，按 filename 拼接标准文件访问路径 */
export function resolveMediaUrl(m: Partial<Media> | null | undefined): string | null {
  if (!m || typeof m !== 'object') return null
  if (typeof m.url === 'string' && m.url) return m.url
  if (typeof m.filename === 'string' && m.filename) return `/api/media/file/${encodeURIComponent(m.filename)}`
  return null
}

export type CatalogProduct = {
  id: string
  name: string
  sku: string
  price: number
  cost: number | null
  unit: string
  stock: number | null
  description: string | null
  platforms: string[]
  status: string
  deviceType: string | null
  tags: string[]
  updatedAt: string
  brand: { id: string; name: string; slug: string; logo: string | null } | null
  category: { id: string; name: string; slug: string } | null
  image: { id: string; url: string; alt: string } | null
}

export const getCatalog = memoize(
  'catalog-products-v3',
  [CACHE_TAGS.catalog],
  TTL,
  async (): Promise<CatalogProduct[]> => {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'products',
      depth: 2,
      limit: 1000,
      sort: 'name',
      overrideAccess: true,
      populate: { brands: { name: true, slug: true, logo: true }, categories: { name: true, slug: true } },
    })
    return (result.docs as Product[]).map((p) => {
      const b = typeof p.brand === 'object' ? (p.brand as Brand | null) : null
      const c = typeof p.category === 'object' ? (p.category as Category | null) : null
      const m = typeof p.image === 'object' ? (p.image as Media | null) : null
      const logo = b && typeof b.logo === 'object' ? (b.logo as Media | null) : null
      const imgUrl = resolveMediaUrl(m)
      const logoUrl = resolveMediaUrl(logo)
      return {
        id: String(p.id),
        name: p.name,
        sku: p.sku,
        price: p.price,
        cost: typeof p.cost === 'number' ? p.cost : null,
        unit: p.unit,
        stock: typeof p.stock === 'number' ? p.stock : null,
        description: p.description ?? null,
        platforms: (p.platforms ?? []) as string[],
        status: p.status ?? 'active',
        deviceType: p.deviceType ?? null,
        tags: (p.tags ?? []) as string[],
        updatedAt: p.updatedAt,
        brand: b ? { id: String(b.id), name: b.name, slug: b.slug, logo: logoUrl } : null,
        category: c ? { id: String(c.id), name: c.name, slug: c.slug } : null,
        image: m && imgUrl ? { id: String(m.id), url: imgUrl, alt: m.alt ?? p.name } : null,
      }
    })
  },
)

export const getCategories = memoize(
  'catalog-categories-v1',
  [CACHE_TAGS.catalog],
  TTL,
  async () => {
    const payload = await getPayloadClient()
    const r = await payload.find({ collection: 'categories', limit: 200, depth: 0, overrideAccess: true, select: { name: true, slug: true, sortOrder: true } })
    return (r.docs as Category[]).map((c) => ({ id: String(c.id), name: c.name, slug: c.slug }))
  },
)

export const getBrands = memoize(
  'catalog-brands-v3',
  [CACHE_TAGS.catalog],
  TTL,
  async () => {
    const payload = await getPayloadClient()
    const r = await payload.find({ collection: 'brands', limit: 200, sort: 'name', depth: 1, overrideAccess: true, select: { name: true, slug: true, logo: true } })
    return (r.docs as Brand[]).map((b) => {
      const logo = typeof b.logo === 'object' ? (b.logo as Media | null) : null
      return { id: String(b.id), name: b.name, slug: b.slug, logo: resolveMediaUrl(logo) }
    })
  },
)

/** 负责人下拉：启用成员的 id 和姓名。 */
export const getOwnerOptions = memoize(
  'staff-owner-options-v1',
  [CACHE_TAGS.staff],
  TTL,
  async () => {
    const payload = await getPayloadClient()
    const users = await payload.find({
      collection: 'users',
      where: { status: { equals: 'active' } },
      select: { name: true },
      sort: 'name',
      limit: 500,
      depth: 0,
      overrideAccess: true,
    })
    return users.docs.map((u) => ({ value: String(u.id), label: u.name }))
  },
)

export type CompanyInfo = {
  name: string
  slogan: string | null
  phone: string | null
  email: string | null
  address: string | null
  qrCaption: string | null
  quoteNotes: string | null
  contractTerms: string | null
  printProductImages: boolean
  /** 各类文档的默认风格和版式 */
  documentDefaults: Record<string, { style?: string; layout?: string }>
  /** 已关闭的插件 */
  disabledPlugins: string[]
  /** 后台配置的 AI 模型与渠道列表 */
  aiModels: AiModelConfig[]
  logo: { url: string; alt: string; width: number | null; height: number | null } | null
  qrCode: { url: string; alt: string } | null
}

function parseDocumentDefaults(value: unknown): CompanyInfo['documentDefaults'] {
  const out: CompanyInfo['documentDefaults'] = {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out
  for (const [kind, v] of Object.entries(value as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue
    const { style, layout } = v as { style?: unknown; layout?: unknown }
    out[kind] = { style: typeof style === 'string' ? style : undefined, layout: typeof layout === 'string' ? layout : undefined }
  }
  return out
}

export const getCompanyInfo = memoize(
  'company-settings-v6',
  [CACHE_TAGS.company],
  TTL,
  async (): Promise<CompanyInfo> => {
    const payload = await getPayloadClient()
    const s = await payload.findGlobal({ slug: 'company-settings', depth: 1, overrideAccess: true })
    const rawAiModels = (s as unknown as { aiModels?: unknown }).aiModels
    const logo = s.logo && typeof s.logo === 'object' ? (s.logo as Media) : null
    const qr = s.qrCode && typeof s.qrCode === 'object' ? (s.qrCode as Media) : null
    const logoUrl = resolveMediaUrl(logo)
    const qrUrl = resolveMediaUrl(qr)
    return {
      name: s.name || 'FMKJ 智能家居',
      slogan: s.slogan ?? null,
      phone: s.phone ?? null,
      email: s.email ?? null,
      address: s.address ?? null,
      qrCaption: s.qrCaption ?? null,
      quoteNotes: s.quoteNotes ?? null,
      contractTerms: s.contractTerms ?? null,
      printProductImages: s.printProductImages !== false,
      documentDefaults: parseDocumentDefaults(s.documentDefaults),
      disabledPlugins: Array.isArray(s.disabledPlugins) ? s.disabledPlugins.filter((v): v is string => typeof v === 'string') : [],
      aiModels: parseAiModels(rawAiModels),
      logo: logo && logoUrl ? { url: logoUrl, alt: logo.alt || s.name, width: logo.width ?? null, height: logo.height ?? null } : null,
      qrCode: qr && qrUrl ? { url: qrUrl, alt: qr.alt || '二维码' } : null,
    }
  },
)
