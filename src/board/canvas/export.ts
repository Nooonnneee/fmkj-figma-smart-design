'use client'

import { toDeg } from '../core/geometry'
import { areaPoly, sheetAt } from '../core/ops'
import { areaLabelAnchor } from './hit'
import type { SystemPack } from '../core/pack'
import { fittingScale, formatMm, PAPERS } from '../core/paper'
import {
  artAspectRatio,
  LABEL_SIZE,
  lookOptionsFor,
  symbolGeom,
  type DeviceDefaults,
  type ProductImageLookup,
} from '../core/symbols'
import type { BoardDoc, BoardFile, SheetObj, SymbolObj, ViewSettings } from '../core/types'
import type { SymbolArt } from '../core/symbols'
import { downloadBlob } from '@/lib/export-pdf'
import { renderPointDisplayEffectsSvg } from '@/lib/point-display-effects'

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** 字节 → base64（分块，避免大图时 String.fromCharCode 爆栈；不依赖 FileReader，导出逻辑可在 Node 里测） */
function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK)
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  return btoa(bin)
}

/**
 * 导出时的取图缓存：成功存 data URL，失败存 null（负面缓存）。
 * 一张坏图（产品照片 404 / 跨域）只取一次，不会让 N 个点位各请求一次。
 */
export type ExportImageCache = Map<string, string | null>

/** 取一张图并内联成 data URL；取不到（404 / 跨域 / 网络错误）直接抛错，由调用方决定回退。 */
async function toDataUrl(url: string, cache: ExportImageCache): Promise<string> {
  if (url.startsWith('data:')) return url
  const hit = cache.get(url)
  if (hit) return hit
  const res = await fetch(url)
  if (!res.ok) throw new Error(`图片加载失败（${res.status}）：${url}`)
  const blob = await res.blob()
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const data = `data:${blob.type || 'image/png'};base64,${bytesToBase64(bytes)}`
  cache.set(url, data)
  return data
}

/**
 * 取图失败返回 null，让调用方回退到默认图标而不是把整张图纸导出弄挂。
 * 失败也写进缓存（null），同一个坏地址只请求一次。
 */
export async function toDataUrlSafe(url: string, cache: ExportImageCache): Promise<string | null> {
  if (cache.has(url)) return cache.get(url) ?? null
  try {
    return await toDataUrl(url, cache)
  } catch {
    cache.set(url, null)
    return null
  }
}

/**
 * 导出一个点位要画的图：优先当前风格的图形，取不到就回退默认图标，
 * 再取不到就回退实心标记；全都取不到才返回 null（跳过这个点位，不中断导出）。
 * 纯函数、只依赖 fetch，测试里可以 mock。
 */
export async function resolveExportIcon(
  o: SymbolObj,
  view: ViewSettings,
  pack: SystemPack,
  opts: {
    productImage?: ProductImageLookup | null
    defaults?: DeviceDefaults | null
    mmPerUnit?: number | null
  },
  cache: ExportImageCache,
): Promise<
  | { kind: 'art'; href: string; art: SymbolArt; geom: ReturnType<typeof symbolGeom> }
  | { kind: 'marker'; href: string; geom: ReturnType<typeof symbolGeom> }
  | null
> {
  const mmPerUnit = opts.mmPerUnit ?? null
  const styled = pack.look(o, lookOptionsFor(o, view.iconStyle, opts.productImage, opts.defaults))
  const g = symbolGeom(o, styled, view, mmPerUnit)
  if (!g.marker && styled.art) {
    const href = await toDataUrlSafe(styled.art.src, cache)
    if (href) return { kind: 'art', href, art: styled.art, geom: g }
  }
  // 当前风格取不到图（产品照片 404 / 跨域 / CAD data URL 坏了）：退回默认图标
  if (view.iconStyle && view.iconStyle !== 'default') {
    const plain = pack.look(o, { iconStyle: 'default' })
    const pg = symbolGeom(o, plain, view, mmPerUnit)
    if (!pg.marker && plain.art) {
      const href = await toDataUrlSafe(plain.art.src, cache)
      if (href) return { kind: 'art', href, art: plain.art, geom: pg }
    }
  }
  // 图标也没有：退回实心标记（与画布上「没有图形就画标记」一致）
  if (styled.marker) {
    const href = await toDataUrlSafe(styled.marker, cache)
    if (href) return { kind: 'marker', href, geom: g }
  }
  return null
}

/**
 * 导出一张图纸为 PNG（A3 / A4 横版，150dpi）：图纸 + 区域 + 展示效果 + 点位 + 图例 + 标题栏。
 * 图纸已标定时按标准比例（1:20 / 1:50 / 1:100）出图，打印时选「实际大小 100%」即为准确比例；
 * 未标定时按纸张铺满，标题栏注明「比例未标定」。网格、标尺不出图。图片全部内嵌，不会漏图。
 */
export async function exportSheetPng(opts: {
  doc: BoardDoc
  files: Record<string, BoardFile>
  sheet: SheetObj
  pack: SystemPack
  view: ViewSettings
  hidden: ReadonlySet<string>
  project: string
  /** 产品照片查表（可选）；不传时 photo 风格回退默认图标 */
  productImage?: ProductImageLookup | null
  /** 项目默认型号（可选）：点位没有自己的 productId 时按设备类型取照片 */
  defaults?: DeviceDefaults | null
}) {
  const { doc, files, sheet, pack, view, hidden, productImage = null, defaults = null } = opts
  const paper = PAPERS[pack.paper]
  const DPI = 150
  const k = DPI / 25.4
  const W = Math.round(paper.w * k)
  const H = Math.round(paper.h * k)
  const margin = 10
  const legendW = 62
  const titleH = 16
  const availW = paper.w - 2 * margin - legendW - 4
  const availH = paper.h - 2 * margin - titleH - 4
  const scale = sheet.mmPerUnit
    ? fittingScale(sheet.w, sheet.h, sheet.mmPerUnit, pack.paper, margin, {
        w: legendW + 4,
        h: titleH + 4,
      })
    : null
  // 纸面毫米 / 场景单位
  const mmPerUnitPaper =
    scale && sheet.mmPerUnit
      ? sheet.mmPerUnit / scale
      : Math.min(availW / sheet.w, availH / sheet.h)
  const u = mmPerUnitPaper * k // 像素 / 场景单位
  const ox = margin * k + (availW * k - sheet.w * u) / 2
  const oy = margin * k + (availH * k - sheet.h * u) / 2
  const cache: ExportImageCache = new Map()
  const parts: string[] = []
  const inside = (x: number, y: number) =>
    x >= sheet.x && x <= sheet.x + sheet.w && y >= sheet.y && y <= sheet.y + sheet.h

  const sheetSrc = sheet.fileId ? files[sheet.fileId]?.dataURL : null
  parts.push(
    `<g transform="translate(${ox} ${oy}) scale(${u}) translate(${-sheet.x} ${-sheet.y})">`,
  )
  if (sheetSrc) {
    // 底图取不到时只少一张底图，点位和图例照常导出
    const href = await toDataUrlSafe(sheetSrc, cache)
    if (href)
      parts.push(
        `<image href="${href}" x="${sheet.x}" y="${sheet.y}" width="${sheet.w}" height="${sheet.h}" opacity="${view.sheetOpacity}" preserveAspectRatio="none"/>`,
      )
  }
  parts.push(
    `<rect x="${sheet.x}" y="${sheet.y}" width="${sheet.w}" height="${sheet.h}" fill="none" stroke="#d4d4d4" stroke-width="${0.6 / u}"/>`,
  )
  if (view.layers.area)
    for (const o of doc.objects) {
      if (o.kind !== 'area' || !inside(o.x + o.w / 2, o.y + o.h / 2)) continue
      const pts = areaPoly(o)
        .map((q) => `${q.x},${q.y}`)
        .join(' ')
      const a = areaLabelAnchor(o)
      parts.push(
        `<polygon points="${pts}" fill="none" stroke="#64748b" stroke-opacity="0.85" stroke-width="${1.2 / u}" stroke-linejoin="round"/>`,
      )
      parts.push(
        `<text x="${a.x + 4}" y="${a.y + 13}" font-size="11" font-weight="600" fill="#475569" stroke="#fff" stroke-width="3" paint-order="stroke" font-family="system-ui,sans-serif">${esc(o.name)}</text>`,
      )
    }
  if (view.layers.symbol) {
    const visibleDoc = {
      objects: doc.objects.filter(
        (o) => o.kind !== 'symbol' || (!hidden.has(o.id) && inside(o.x, o.y)),
      ),
    }
    const effects = (pack.overlays ?? [])
      .filter((o) => view.overlays?.[o.id])
      .flatMap((o) => o.build(visibleDoc).effects ?? [])
    if (effects.length) {
      parts.push(
        `<defs><clipPath id="board-export-effects-clip"><rect x="${sheet.x}" y="${sheet.y}" width="${sheet.w}" height="${sheet.h}"/></clipPath></defs>`,
      )
      parts.push(
        `<g clip-path="url(#board-export-effects-clip)">${renderPointDisplayEffectsSvg(effects, 'board-export-effects')}</g>`,
      )
    }
  }
  const used = new Set<string>()
  for (const o of doc.objects) {
    if (o.kind !== 'symbol' || hidden.has(o.id) || !inside(o.x, o.y)) continue
    // 导出跟着工具栏选的图标风格走；CAD 矢量在这里已经是内联 data URL，toDataUrl 直接透传。
    // 任何一张图取不到（照片 404 / 跨域）都回退默认图标，整张图纸照常导出。
    const icon = await resolveExportIcon(
      o,
      view,
      pack,
      { productImage, defaults, mmPerUnit: sheetAt(doc, o.x, o.y)?.mmPerUnit ?? null },
      cache,
    )
    if (!icon) continue
    used.add(o.id)
    const { geom: g } = icon
    const rot = o.angle ? ` transform="rotate(${toDeg(o.angle)} ${o.x} ${o.y})"` : ''
    if (icon.kind === 'marker')
      parts.push(
        `<image href="${icon.href}" x="${o.x - g.w / 2}" y="${o.y - g.h / 2}" width="${g.w}" height="${g.h}"/>`,
      )
    else
      parts.push(
        `<image href="${icon.href}" x="${o.x - g.imgW / 2}" y="${o.y - g.imgH / 2}" width="${g.imgW}" height="${g.imgH}" preserveAspectRatio="${artAspectRatio(icon.art)}"${rot}/>`,
      )
  }
  parts.push('</g>')

  // 图例
  const lx = (paper.w - margin - legendW) * k
  let ly = margin * k
  parts.push(
    `<text x="${lx}" y="${ly + 5 * k}" font-size="${4 * k}" font-weight="700" fill="#111" font-family="system-ui,sans-serif">图例</text>`,
  )
  ly += 9 * k
  // 图例与画布同一套图标风格（photo 风格在图例里同样按「有照片用照片、没有用默认图标」）
  const rows = pack.legend(
    { objects: doc.objects.filter((o) => used.has(o.id)) },
    { iconStyle: view.iconStyle },
    productImage,
    defaults,
  )
  const rowH = Math.min(7.2, (paper.h - 2 * margin - titleH - 14) / Math.max(1, rows.length)) * k
  for (const r of rows) {
    // 图例图标取不到就只画文字，不中断整张图纸的导出
    const candidates =
      view.symbolStyle === 'plan' && r.look.art ? [r.look.art.src, r.look.marker] : [r.look.marker]
    let href: string | null = null
    for (const src of candidates) {
      if (!src) continue
      href = await toDataUrlSafe(src, cache)
      if (href) break
    }
    if (href)
      parts.push(
        `<image href="${href}" x="${lx}" y="${ly}" width="${rowH * 0.85}" height="${rowH * 0.85}"/>`,
      )
    parts.push(
      `<text x="${lx + rowH}" y="${ly + rowH * 0.6}" font-size="${Math.min(3.2 * k, rowH * 0.5)}" fill="#222" font-family="system-ui,sans-serif">${esc(r.label)}</text>`,
    )
    parts.push(
      `<text x="${lx + legendW * k}" y="${ly + rowH * 0.6}" text-anchor="end" font-size="${Math.min(3.2 * k, rowH * 0.5)}" fill="#555" font-family="system-ui,sans-serif">×${r.count}</text>`,
    )
    ly += rowH
  }

  // 标题栏
  const ty = (paper.h - margin - titleH) * k
  const scaleText = scale
    ? `比例 1:${scale}（${pack.paper} 实际大小打印）`
    : '比例未标定（按纸张铺满）'
  parts.push(
    `<rect x="${margin * k}" y="${ty}" width="${(paper.w - 2 * margin) * k}" height="${titleH * k}" fill="none" stroke="#111" stroke-width="${0.35 * k}"/>`,
  )
  const cell = (x: number, label: string, value: string) =>
    `<text x="${(margin + x) * k}" y="${ty + 5.5 * k}" font-size="${2.6 * k}" fill="#666" font-family="system-ui,sans-serif">${esc(label)}</text><text x="${(margin + x) * k}" y="${ty + 12 * k}" font-size="${4 * k}" font-weight="600" fill="#111" font-family="system-ui,sans-serif">${esc(value)}</text>`
  parts.push(
    cell(4, '项目', opts.project.slice(0, 24)),
    cell(110, '图纸', `${pack.export.title} · ${sheet.name}`.slice(0, 30)),
    cell(230, '比例', scaleText),
    cell(paper.w - 2 * margin - 52, '日期', new Date().toLocaleDateString('zh-CN')),
  )
  if (scale && sheet.mmPerUnit) {
    const bar = 1000 / scale // 1m 在纸面的毫米数
    const bx = (paper.w - margin - legendW) * k
    const by = ty - 6 * k
    parts.push(
      `<rect x="${bx}" y="${by}" width="${bar * k}" height="${1.4 * k}" fill="#111"/><text x="${bx + bar * k + 2 * k}" y="${by + 1.4 * k}" font-size="${2.8 * k}" fill="#111" font-family="system-ui,sans-serif">${formatMm(1000)}</text>`,
    )
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${parts.join('')}</svg>`
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('图纸渲染失败'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    canvas.getContext('2d')!.drawImage(img, 0, 0)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
    if (!blob) throw new Error('导出失败')
    return { blob, scale }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function download(blob: Blob, name: string) {
  downloadBlob(blob, name)
}
