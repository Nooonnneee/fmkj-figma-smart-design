import type { SymbolArt, SymbolLook } from '@/board/core/symbols'
import type { SizeCm, SymbolObj } from '@/board/core/types'
import { categoryOfType, deviceTypeOf, isDeviceType } from '@/lib/device-types'
import { markerUrl } from '@/lib/point-markers'

import { LIGHTING_FAMILIES, SYMBOL_ASSET_PAD, SYMBOL_ASSET_VERSION, SYMBOL_ASSETS, type LightingFamilyDef } from './symbols.generated'

const BASE = '/board/symbols/smart-home'

export function artOf(key: string): SymbolArt | null {
  const a = SYMBOL_ASSETS[key]
  if (!a) return null
  return { src: `${BASE}/${key}.png?v=${SYMBOL_ASSET_VERSION}`, srcSm: `${BASE}/${key}.sm.png?v=${SYMBOL_ASSET_VERSION}`, gw: a.gw, gh: a.gh, pad: SYMBOL_ASSET_PAD }
}

export type LightingVariant = { id: string; art: string; sizeCm: SizeCm | null; label: string; family: LightingFamily }
export type LightingFamily = Omit<LightingFamilyDef, 'variants'> & { variants: LightingVariant[]; cover: string }

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
export const sizeText = (s: SizeCm | null) => (!s ? '标准' : s[1] == null ? `${num(s[0])}cm` : `${num(s[0])}×${num(s[1])}cm`)

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
export const lightingVariant = (id: string | null | undefined) => (id ? VARIANTS.get(id) : undefined)
export const defaultVariant = (f: LightingFamily) => f.variants[Math.floor((f.variants.length - 1) / 2)]

export function deviceLook(deviceType: string): SymbolLook {
  const t = deviceTypeOf(deviceType) ?? deviceTypeOf('other')!
  return {
    key: t.value,
    name: t.name,
    color: categoryOfType(t.value)?.color ?? '#525252',
    art: artOf(t.symbol),
    marker: markerUrl(t.value),
    badge: t.keys && t.keys > 1 ? String(t.keys) : undefined,
  }
}

const cache = new Map<string, SymbolLook>()

/** 智能家居包对符号的解释：设备类型决定颜色和标记，灯光款式决定平面图形 */
export function lookOf(o: Pick<SymbolObj, 'symbolId' | 'data'>): SymbolLook {
  const dt = isDeviceType(o.data.deviceType) ? (o.data.deviceType as string) : 'other'
  const k = `${o.symbolId}|${dt}`
  const hit = cache.get(k)
  if (hit) return hit
  const base = deviceLook(dt)
  const v = lightingVariant(o.symbolId)
  const look: SymbolLook =
    v && v.family.deviceType === dt ? { ...base, key: `${dt}:${v.family.id}`, name: `${v.family.name} ${v.label}`, art: artOf(v.art) ?? base.art, badge: undefined, linear: v.family.linear } : base
  cache.set(k, look)
  return look
}
