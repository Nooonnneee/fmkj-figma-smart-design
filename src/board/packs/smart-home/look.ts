import type { SymbolArt, SymbolLook } from '@/board/core/symbols'
import type { LookOptions, SizeCm, SymbolObj } from '@/board/core/types'
import { categoryOfType, deviceTypeOf, isDeviceType } from '@/lib/device-types'
import { markerUrl } from '@/lib/point-markers'

import { applyIconArt, resolveIconArt, sketchArt, type IconArtInput } from './icon-styles'
import { POINT_ICON_GEOM, POINT_ICON_VERSION } from './point-icons.generated'
import {
  LIGHTING_FAMILIES,
  SYMBOL_ASSET_PAD,
  SYMBOL_ASSET_VERSION,
  SYMBOL_ASSETS,
  type LightingFamilyDef,
} from './symbols.generated'

const BASE = '/board/symbols/smart-home'

export function artOf(key: string): SymbolArt | null {
  const a = SYMBOL_ASSETS[key]
  if (!a) return null
  return {
    src: `${BASE}/${key}.png?v=${SYMBOL_ASSET_VERSION}`,
    srcSm: `${BASE}/${key}.sm.png?v=${SYMBOL_ASSET_VERSION}`,
    gw: a.gw,
    gh: a.gh,
    pad: SYMBOL_ASSET_PAD,
  }
}

/** 点位图标（平面符号样式，scripts/point-icons/mapping.json 选定的原图，build-point-icons.mjs 优化）：画板、面板、导出共用 */
export function pointIconArt(type: string): SymbolArt | null {
  const g = POINT_ICON_GEOM[type]
  if (!g) return null
  return {
    src: `/point-icons/${type}.png?v=${POINT_ICON_VERSION}`,
    srcSm: `/point-icons/${type}.png?v=${POINT_ICON_VERSION}`,
    gw: g.gw,
    gh: g.gh,
    pad: SYMBOL_ASSET_PAD,
  }
}

export type LightingVariant = {
  id: string
  art: string
  sizeCm: SizeCm | null
  label: string
  family: LightingFamily
}
export type LightingFamily = Omit<LightingFamilyDef, 'variants'> & {
  variants: LightingVariant[]
  cover: string
}

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
export const sizeText = (s: SizeCm | null) =>
  !s ? '标准' : s[1] == null ? `${num(s[0])}cm` : `${num(s[0])}×${num(s[1])}cm`

export const LIGHTING: LightingFamily[] = LIGHTING_FAMILIES.map((def) => {
  const fam: LightingFamily = { ...def, variants: [], cover: '' }
  const seen = new Map<string, number>()
  fam.variants = def.variants.map((v) => {
    let label = sizeText(v.sizeCm)
    const n = (seen.get(label) ?? 0) + 1
    seen.set(label, n)
    if (n > 1) label += ` · 款${n}`
    return { ...v, label, family: fam }
  })
  // 封面：用得最多的那张图（同款共用的母版）
  const counts = new Map<string, number>()
  for (const v of def.variants) counts.set(v.art, (counts.get(v.art) ?? 0) + 1)
  fam.cover = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  return fam
})

export const LIGHTING_GROUPS: { name: string; families: LightingFamily[] }[] = []
for (const f of LIGHTING) {
  const g = LIGHTING_GROUPS.find((x) => x.name === f.group)
  if (g) g.families.push(f)
  else LIGHTING_GROUPS.push({ name: f.group, families: [f] })
}

const VARIANTS = new Map(LIGHTING.flatMap((f) => f.variants.map((v) => [v.id, v] as const)))
export const lightingVariant = (id: string | null | undefined) =>
  id ? VARIANTS.get(id) : undefined
export const defaultVariant = (f: LightingFamily) =>
  f.variants[Math.floor((f.variants.length - 1) / 2)]

export function deviceLook(deviceType: string): SymbolLook {
  const t = deviceTypeOf(deviceType) ?? deviceTypeOf('other')!
  // 平面符号用按设备类型生成的点位图标，没有时才回退到共用的符号；实心标记与它同一套图形
  const own = pointIconArt(t.value) ?? artOf(t.value)
  return {
    key: t.value,
    name: t.name,
    color: categoryOfType(t.value)?.color ?? '#525252',
    art: own ?? artOf(t.symbol),
    marker: pointIconArt(t.value)?.src ?? markerUrl(t.value),
    badge: !own && t.keys && t.keys > 1 ? String(t.keys) : undefined,
  }
}

const cache = new Map<string, SymbolLook>()

/** 默认风格（没有选图标风格）的 look：旧视图、画布外的地方都走这条，结果与今天逐字节一致 */
function baseLook(o: Pick<SymbolObj, 'symbolId' | 'data'>): SymbolLook {
  const dt = isDeviceType(o.data.deviceType) ? (o.data.deviceType as string) : 'other'
  const k = `${o.symbolId}|${dt}`
  const hit = cache.get(k)
  if (hit) return hit
  const base = deviceLook(dt)
  const v = lightingVariant(o.symbolId)
  const look: SymbolLook =
    v && v.family.deviceType === dt
      ? {
          ...base,
          key: `${dt}:${v.family.id}`,
          name: `${v.family.name} ${v.label}`,
          art: artOf(v.art) ?? base.art,
          badge: undefined,
          linear: v.family.linear,
        }
      : base
  cache.set(k, look)
  return look
}

/** 非默认风格的缓存：画布每帧都会取 look，CAD 的 data URL 编码不能重复做 */
const styledCache = new Map<string, SymbolLook>()
const STYLED_CACHE_MAX = 2000

/**
 * 智能家居包对符号的解释：设备类型决定颜色和标记，灯光款式决定平面图形。
 * opts.iconStyle 决定平面图标用哪一套（缺省 = 今天的彩色图标）；opts.productImage
 * 只在 photo 风格下用得上，没有就回退默认图标——所以画布 / 方案页不传也不影响。
 */
export function lookOf(o: Pick<SymbolObj, 'symbolId' | 'data'>, opts?: LookOptions): SymbolLook {
  const base = baseLook(o)
  const style = opts?.iconStyle
  if (!style || style === 'default') return base
  const photo = style === 'photo' ? (opts?.productImage ?? '') : ''
  const k = `${style}|${o.symbolId}|${o.data.deviceType ?? ''}|${photo}`
  const hit = styledCache.get(k)
  if (hit) return hit
  const dt = isDeviceType(o.data.deviceType) ? (o.data.deviceType as string) : 'other'
  const t = deviceTypeOf(dt) ?? deviceTypeOf('other')!
  const v = lightingVariant(o.symbolId)
  const isVariant = !!v && v.family.deviceType === dt
  // 默认风格的图形：灯光款式用款式图，其余用 look 里的那张（同为回退链的终点）
  const fallback = isVariant ? (artOf(v!.art) ?? base.art) : base.art
  // 默认风格的主体比例：CAD 找不到真实尺寸时回退它，照片 / 手绘的线形落图也用它
  const plainGeom = defaultGeomOf(base.art, fallback)
  // CAD 的几何比例（唯一真值来源）。必须按「点位」算，而且在 resolveIconArt 之前算：
  // track-light / light-strip / other-light 三个符号键被真线形灯具和落地灯、弧形落地灯、
  // 轨道射灯头、LED 灯带共用，只看键会给后者选错画面和比例。
  const cadGeom = cadGeomOf(isVariant ? v : undefined, plainGeom)
  // CAD 线稿的 160×6 细长画面只给「落图后确实是条线」的符号（否则方框图标会被拉碎）。
  // 它只决定用哪张画；比例已经在 cadGeomOf 里定死，不参与几何计算。
  const lineArt = isLineGeom(cadGeom ?? plainGeom)
  // 手绘 / 照片沿用旧规则：只有细长灯具按默认比例落图，其余保持图形自己的方框
  const slenderForPhoto = !!plainGeom && isLineGeom(plainGeom, isVariant && v!.family.linear)
  const input: IconArtInput = {
    symbol: t.symbol,
    switchKeys: 'keys' in t ? t.keys : undefined,
    fallback,
    // 手绘：优先按设备类型取（单开 / 四开各有自己的图），没有再按符号键；
    // 灯光款式的图本来就在同一个 Procreate 素材目录里，直接用款式图，别退化成通用筒灯。
    sketch: isVariant
      ? (artOf(v!.art) ?? sketchArt(t.value) ?? sketchArt(t.symbol))
      : (sketchArt(t.value) ?? sketchArt(t.symbol)),
    productImage: opts?.productImage ?? null,
    linear: lineArt,
  }
  const styled = applyIconArt(base, resolveIconArt(style, input))
  // 灯光款式在 CAD / 手绘 / 照片下也保留线形灯具的长度示意
  const look = isVariant ? { ...styled, linear: v!.family.linear } : styled
  // CAD 钉 cadGeom；手绘 / 照片仍按旧的细长规则钉默认比例（照片不能为普通灯具变形）
  const targetGeom = style === 'cad' ? cadGeom : slenderForPhoto ? plainGeom : null
  if (look.art && targetGeom) look.art = { ...look.art, geom: targetGeom }
  if (styledCache.size < STYLED_CACHE_MAX) styledCache.set(k, look)
  return look
}

/** 默认风格里的主体比例（手绘 / CAD 都用它当几何回退源） */
function defaultGeomOf(
  base: SymbolLook['art'],
  fallback: SymbolLook['art'],
): { gw: number; gh: number } | null {
  const art = fallback ?? base
  return art ? { gw: art.gw, gh: art.gh } : null
}

/**
 * CAD 风格该用的主体比例（全代码库唯一真值来源）：
 * - 灯光款式且 sizeCm 的 [宽, 深] 两维都已知 → 真实比例（gw = 1，gh = 深 / 宽）；
 * - 其余情况（只有宽、sizeCm 为 null、非灯光款式）→ 默认平面图标的比例。
 * 非灯光款式（socket / camera ……）没有真实尺寸，默认图标本身是方框的仍然返回 null，
 * 几何保持方形（与今天一致）。
 */
function cadGeomOf(
  variant: LightingVariant | undefined,
  defaultGeom: { gw: number; gh: number } | null,
): { gw: number; gh: number } | null {
  const size = variant?.sizeCm
  if (size && size[1] != null && size[0] > 0) return { gw: 1, gh: size[1] / size[0] }
  if (!variant) return defaultGeom && isLineGeom(defaultGeom) ? defaultGeom : null
  return defaultGeom
}

/** 长宽比偏离 1 超过 5 倍就算一条线（只用于「用哪张画」，不参与 CAD 比例计算） */
const LINE_RATIO = 5

/**
 * 这个比例画出来是不是一条线：长宽比偏离 1 超过 5 倍，或调用方明确标了线形灯具。
 * 默认图标是条线的符号在 CAD 下用 160×6 的画面，照片 / 手绘按它决定是否钉默认比例。
 */
function isLineGeom(geom: { gw: number; gh: number } | null, linear = false) {
  if (!geom) return false
  const a = geom.gh / geom.gw
  return linear || a < 1 / LINE_RATIO || a > LINE_RATIO
}
