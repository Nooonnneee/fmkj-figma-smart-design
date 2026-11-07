import type { PlanArea, PlanPoint } from '@/components/plan-figure'

export type SocialPosterSheet = {
  name: string
  url: string
  points: PlanPoint[]
  areas: PlanArea[]
}
export type SocialPosterScene = {
  key: string
  title: string
  description: string
  url: string
  alt: string
}
/** 只传可公开资料，不传业主姓名、电话、门牌或完整项目对象。 */
export type SocialPosterData = {
  title: string
  platform: string
  pointCount: number
  roomCount: number
  floorCount: number
  totalAmount: number | null
  budgetLabel?: string
  companyName: string
  qrCodeUrl: string | null
  miniAppCodeUrl?: string | null
  sheet?: SocialPosterSheet | null
  sheets?: SocialPosterSheet[]
  topTypes: { type: string; name: string; count: number }[]
  scenePhotos?: SocialPosterScene[]
}
export type SocialPosterPage =
  | { key: string; kind: 'cover'; label: string }
  | { key: string; kind: 'plan'; label: string; sheet: SocialPosterSheet }
  | {
      key: string
      kind: 'equipment'
      label: string
      types: SocialPosterData['topTypes']
      part: number
      parts: number
    }
  | { key: string; kind: 'budget'; label: string }
  | { key: string; kind: 'scene'; label: string; scene: SocialPosterScene }
  | { key: string; kind: 'closing'; label: string }

export const SOCIAL_POSTER_WIDTH = 360
export const SOCIAL_POSTER_HEIGHT = 480

export function socialBudgetBand(amount: number | null, hideExact: boolean): string {
  if (amount === null || !Number.isFinite(amount) || amount < 0) return '预算待确认'
  if (!hideExact) return `¥${amount.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
  return amount < 10000 ? '1W 以内' : `${Math.floor(amount / 5000) * 0.5}W+`
}

/** 社区名也可能带手填门牌；不用完整项目名作为公开标题兜底。 */
export function socialCaseTitle(
  community: string | null | undefined,
  privateValues: (string | null | undefined)[] = [],
): string {
  const publicName = privateValues
    .filter((value): value is string => Boolean(value?.trim()))
    .reduce((text, value) => text.split(value).join(''), community ?? '')
  const title = publicName
    .replace(/1[3-9]\d{9}/g, '')
    .replace(/\d+\s*[-—－]\s*\d+(?:\s*[-—－]\s*\d+)?[\s\S]*$/, '')
    .replace(/(?:\d+|[一二三四五六七八九十]+)\s*(?:栋|幢|单元|室|号楼|号院|号房)[\s\S]*$/, '')
    .replace(/\s+\d{3,}[\s\S]*$/, '')
    .replace(/[·,，\-—\s]+$/, '')
    .trim()
  return title ? title.slice(0, 20) : '全屋智能案例'
}

/** 仅保留楼层标识，不复制可能含个人资料的内部图名。 */
export function socialSheetTitle(name: string, index: number): string {
  const floor = name.match(
    /地下[一二三四五六七八九十\d]+层|负[一二三四五六七八九十\d]+层|[一二三四五六七八九十\d]+层|\bB?\d+F\b/i,
  )?.[0]
  return floor ? `${floor.toUpperCase()}点位图` : `图纸 ${index + 1} · 点位图`
}

export function socialPosterSheets(data: SocialPosterData): SocialPosterSheet[] {
  return (data.sheets ?? (data.sheet ? [data.sheet] : [])).filter(
    (sheet) => sheet.url && sheet.points.length > 0,
  )
}

/** 每张独立排版；不把一张长海报切片，也不生成空白楼层来凑数。 */
export function buildSocialPosterPages(data: SocialPosterData): SocialPosterPage[] {
  const pages: SocialPosterPage[] = [{ key: 'cover', kind: 'cover', label: '案例封面' }]
  socialPosterSheets(data).forEach((sheet, i) =>
    pages.push({ key: `plan-${i}`, kind: 'plan', label: sheet.name, sheet }),
  )
  const types = data.topTypes.filter((type) => type.count > 0)
  const parts = Math.ceil(types.length / 6)
  for (let i = 0; i < parts; i++)
    pages.push({
      key: `equipment-${i}`,
      kind: 'equipment',
      label: parts > 1 ? `配置清单 ${i + 1}` : '配置清单',
      types: types.slice(i * 6, i * 6 + 6),
      part: i + 1,
      parts,
    })
  if (data.totalAmount !== null && Number.isFinite(data.totalAmount) && data.totalAmount >= 0)
    pages.push({ key: 'budget', kind: 'budget', label: '预算参考' })
  const seen = new Set<string>()
  for (const scene of data.scenePhotos ?? []) {
    if (!scene.url || seen.has(scene.key)) continue
    seen.add(scene.key)
    pages.push({ key: `scene-${scene.key}`, kind: 'scene', label: scene.title, scene })
  }
  if (pages.length > 1) pages.push({ key: 'closing', kind: 'closing', label: '方案确认' })
  return pages
}

export function socialPosterCaption(data: SocialPosterData, hideExactPrice: boolean): string {
  return [
    `【全屋智能方案案例】${data.title}`,
    `${data.platform || '全屋智能'} · ${data.pointCount} 个设备点位${data.roomCount ? ` · ${data.roomCount} 个空间` : ''}`,
    data.topTypes.length
      ? `本次配置：${data.topTypes
          .slice(0, 6)
          .map((t) => `${t.name}×${t.count}`)
          .join('、')}`
      : '',
    data.totalAmount !== null
      ? `${data.budgetLabel || '预算参考'}：${socialBudgetBand(data.totalAmount, hideExactPrice)}`
      : '',
    '按图组查看户型点位、设备配置和预算，再一起确认控制方式、安装条件与交付内容。',
    '#全屋智能 #智能家居设计 #全屋智能点位图 #智能家居方案 #繁梦空间',
  ]
    .filter(Boolean)
    .join('\n')
}

export const socialPosterFilename = (title: string) =>
  title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').slice(0, 48) || '全屋智能案例'
