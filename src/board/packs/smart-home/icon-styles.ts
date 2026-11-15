/**
 * 点位图标的四种风格（工具栏手动选择，与 symbolStyle / 显示方案 / 底图风格都无关）。
 *
 *   default — 现在的彩色点位图标（public/point-icons/*.png，28 个设备类型）
 *   cad     — 按电气图例画的线稿（cad-symbols.ts 里的矢量，30 个符号键）
 *   sketch  — Procreate 手绘图标（public/board/symbols/smart-home/*.png，30 个符号键）
 *   photo   — 点位所选产品的照片（products.image）；没有照片就回退 default
 *
 * 回退矩阵（任何一步拿不到图形都不会画出空白）：
 *
 *   cad    → cadSymbol(符号键)          → 默认图标 → 实心标记
 *   sketch → symbols.generated 里的图    → 默认图标 → 实心标记
 *   photo  → 有 productImage 时用照片     → 默认图标 → 实心标记
 *   default→ 默认图标                    → 实心标记
 *
 * 注意：这里只决定「平面符号」长什么样。symbolStyle === 'marker' 时画布仍然画实心标记，
 * 四种图标风格对它不生效（回归测试见 icon-styles.test.ts）。
 */
import type { SymbolArt, SymbolLook } from '@/board/core/symbols'
import type { IconStyle } from '@/board/core/types'
import type { SymbolKey } from '@/lib/device-types'

import { cadArtFor } from './cad-symbols'
import { SYMBOL_ASSET_PAD, SYMBOL_ASSET_VERSION, SYMBOL_ASSETS } from './symbols.generated'

export type { IconStyle }

/** 手绘图标的目录（就是画板符号的素材目录，Procreate 原图优化后的一版） */
const SKETCH_BASE = '/board/symbols/smart-home'

/** 图标的默认主体比例（没有更准确的比例时用正方形） */
const UNIT_GEOM = { gw: 1, gh: 1 }

/**
 * 产品照片的主体比例：照片是任意长宽比，按 contain 放进正方形主体框，
 * 不会像 PNG 图标那样被拉伸变形。
 */
const PHOTO_ART: Omit<SymbolArt, 'src' | 'srcSm'> = {
  ...UNIT_GEOM,
  pad: 0.04,
  fit: 'contain',
}

/**
 * 手绘风格的图形：直接复用 Procreate 素材（public/board/symbols/smart-home 下 30 个符号键都有图）。
 * 只在生成表里没有这个键时返回 null，交给默认图标兜底。
 */
export function sketchArt(key: SymbolKey | string): SymbolArt | null {
  const a = SYMBOL_ASSETS[key]
  if (!a) return null
  return {
    src: `${SKETCH_BASE}/${key}.png?v=${SYMBOL_ASSET_VERSION}`,
    srcSm: `${SKETCH_BASE}/${key}.sm.png?v=${SYMBOL_ASSET_VERSION}`,
    gw: a.gw,
    gh: a.gh,
    pad: SYMBOL_ASSET_PAD,
  }
}

/** photo 风格的图片地址（产品照片）→ SymbolArt；null / 空串返回 null 让调用方回退 */
export function photoArt(image: string | null | undefined): SymbolArt | null {
  const src = image?.trim()
  if (!src) return null
  return { src, srcSm: src, ...PHOTO_ART }
}

/**
 * 解析「平面符号」要画的图形：
 * - { kind: 'image' } 位图（默认 / 手绘 / 照片）；
 * - { kind: 'vector' } 矢量（CAD，带 viewBox 的完整 SVG）；
 * - null 表示这个风格下没有可用图形，由调用方回退。
 */
export type IconArt =
  | { kind: 'image'; art: SymbolArt }
  | {
      kind: 'vector'
      svg: string
      /** 矢量画面的比例（线性灯具是 160×6，普通符号 32×32） */
      geom: { gw: number; gh: number }
    }
  | null

export type IconArtInput = {
  /** 设备类型的符号键（switch / downlight / camera ……） */
  symbol: SymbolKey
  /** 开关的键数（CAD 用不同的斜杠根数区分单开 / 四开） */
  switchKeys?: number
  /** 默认风格的图标（已经是回退链的终点之一，由调用方给） */
  fallback: SymbolArt | null
  /** 手绘风格的图形（symbols.generated 里的那张） */
  sketch?: SymbolArt | null
  /** 当前点位所选产品的照片地址 */
  productImage?: string | null
  /**
   * 这个点位是不是真线形灯具（由 lookOf 按默认风格的比例算好）。
   * 不能只看符号键：track-light / light-strip / other-light 也被落地灯、轨道射灯头、
   * LED 灯带共用，按键选细长矢量会把它们画成一条线。
   */
  linear?: boolean
}

/**
 * 按风格取图形。photo / cad / sketch 内部按上面的矩阵逐级回退，
 * 最终一定会落到调用方提供的默认图标或 null（null 时画布画实心标记，不是空白）。
 */
export function resolveIconArt(style: IconStyle | undefined, input: IconArtInput): IconArt {
  switch (style) {
    case 'photo': {
      const art = photoArt(input.productImage)
      return art ? { kind: 'image', art } : imageOrNull(input.fallback)
    }
    case 'cad': {
      const art = cadArtFor(input.symbol, input.switchKeys, input.linear)
      if (!art) return imageOrNull(input.fallback)
      return {
        kind: 'vector',
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${art.viewBox}">${art.body}</svg>`,
        geom: viewBoxAspect(art.viewBox),
      }
    }
    case 'sketch':
      return imageOrNull(input.sketch ?? input.fallback)
    case 'default':
    default:
      return imageOrNull(input.fallback)
  }
}

const imageOrNull = (art: SymbolArt | null | undefined): IconArt =>
  art ? { kind: 'image', art } : null

/** viewBox "0 0 W H" → 主体比例（长边归一，与其它 SymbolArt 的含义一致） */
function viewBoxAspect(viewBox: string): { gw: number; gh: number } {
  const [, , w, h] = viewBox.split(/\s+/).map(Number)
  const L = Math.max(w, h) || 1
  return { gw: w / L, gh: h / L }
}

/**
 * 把解析结果套到 SymbolLook 上。
 * 矢量也走 art.src（内联 data URL）：画布 <image> 和导出 toDataUrl 是同一套取图逻辑，
 * 导出不需要为矢量单独开分支；data URL 是 SVG，缩放同样不糊。
 */
export function applyIconArt(look: SymbolLook, choice: IconArt): SymbolLook {
  if (!choice) return look
  if (choice.kind === 'image') return { ...look, art: choice.art }
  const src = vectorDataUrl(choice.svg)
  // 矢量图形按自己的 viewBox 画满整个主体框（stretch）：普通符号是方的、没有拉伸，
  // 线性灯具会把「一条装满的画」拉伸到默认图标的细长比例上。
  return { ...look, art: { src, srcSm: src, ...choice.geom, pad: 0, fit: 'stretch' } }
}

/** CAD 图标的 data URL（导出用；内联图元，不依赖网络） */
export function vectorDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
