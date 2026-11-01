import { boxContains, distToSegment, inRotatedRect, nearBoxEdge, rotatePoint } from '../core/geometry'
import { MIN_AREA, rawBox } from '../core/ops'
import { labelBox, textWidth, type SymbolGeom } from '../core/symbols'
import type { AreaObj, BoardDoc, Box, RawEl, Vec, ViewSettings } from '../core/types'

export type Handle = 'rotate' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
export type Hit = { kind: 'symbol' | 'area' | 'raw' | 'sheet'; id: string } | { kind: 'handle'; id: string; handle: Handle }

export type HitCtx = {
  doc: BoardDoc
  geoms: Map<string, SymbolGeom>
  view: ViewSettings
  zoom: number
  hidden: ReadonlySet<string>
  selection: ReadonlySet<string>
  readOnly: boolean
}

export const AREA_LABEL = 11
export const areaLabelBox = (a: AreaObj): Box => ({ x: a.x + 2, y: a.y + 1, w: textWidth(a.name, AREA_LABEL) + 6, h: AREA_LABEL * 1.4 })

export function areaHandles(b: Box): [Handle, Vec][] {
  const { x, y, w, h } = b
  return [
    ['nw', { x, y }],
    ['n', { x: x + w / 2, y }],
    ['ne', { x: x + w, y }],
    ['e', { x: x + w, y: y + h / 2 }],
    ['se', { x: x + w, y: y + h }],
    ['s', { x: x + w / 2, y: y + h }],
    ['sw', { x, y: y + h }],
    ['w', { x, y: y + h / 2 }],
  ]
}

export const rotateHandle = (o: { x: number; y: number; angle: number }, g: SymbolGeom, zoom: number): Vec =>
  rotatePoint({ x: o.x, y: o.y - g.h / 2 - 18 / zoom }, { x: o.x, y: o.y }, o.angle)

export const HANDLE_CURSOR: Record<Handle, string> = { rotate: 'grab', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' }

export function resizeBox(orig: Box, handle: Handle, dx: number, dy: number): Box {
  let x0 = orig.x
  let y0 = orig.y
  let x1 = orig.x + orig.w
  let y1 = orig.y + orig.h
  if (handle.includes('w')) x0 = Math.min(x0 + dx, x1 - MIN_AREA)
  if (handle.includes('e')) x1 = Math.max(x1 + dx, x0 + MIN_AREA)
  if (handle.includes('n')) y0 = Math.min(y0 + dy, y1 - MIN_AREA)
  if (handle.includes('s')) y1 = Math.max(y1 + dy, y0 + MIN_AREA)
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

function rawHit(el: RawEl, p: Vec, tol: number) {
  const pts = Array.isArray(el.points) ? (el.points as [number, number][]) : null
  if (pts && (el.type === 'line' || el.type === 'arrow' || el.type === 'freedraw')) {
    const sw = typeof el.strokeWidth === 'number' ? el.strokeWidth : 2
    for (let i = 1; i < pts.length; i++) {
      if (distToSegment(p, { x: el.x + pts[i - 1][0], y: el.y + pts[i - 1][1] }, { x: el.x + pts[i][0], y: el.y + pts[i][1] }) <= tol + sw) return true
    }
    return false
  }
  const b = rawBox(el)
  const filled = typeof el.backgroundColor === 'string' && el.backgroundColor !== 'transparent'
  if ((el.type === 'rectangle' || el.type === 'ellipse' || el.type === 'diamond') && !filled) return nearBoxEdge(b, p, tol)
  return boxContains(b, p, tol * 0.5)
}

export function hitTest(p: Vec, c: HitCtx): Hit | null {
  const { doc, geoms, view, zoom, hidden, selection } = c
  const tol = 6 / zoom
  const objs = doc.objects
  if (!c.readOnly && selection.size === 1) {
    const id = [...selection][0]
    const o = objs.find((x) => x.id === id)
    if (o?.kind === 'area' && view.layers.area) {
      for (const [h, q] of areaHandles(o)) if (Math.hypot(p.x - q.x, p.y - q.y) <= tol + 1 / zoom) return { kind: 'handle', id, handle: h }
    }
    if (o?.kind === 'symbol' && view.layers.symbol) {
      const g = geoms.get(id)
      if (g && !g.marker) {
        const q = rotateHandle(o, g, zoom)
        if (Math.hypot(p.x - q.x, p.y - q.y) <= tol + 1 / zoom) return { kind: 'handle', id, handle: 'rotate' }
      }
    }
  }
  if (view.layers.symbol) {
    for (let i = objs.length - 1; i >= 0; i--) {
      const o = objs[i]
      if (o.kind !== 'symbol' || hidden.has(o.id)) continue
      const g = geoms.get(o.id)
      if (!g) continue
      if (inRotatedRect(p, o, g.w, g.h, g.marker ? 0 : o.angle, Math.max(1.5, tol * 0.5))) return { kind: 'symbol', id: o.id }
      if (view.labels && o.code && boxContains(labelBox(o, g), p)) return { kind: 'symbol', id: o.id }
    }
  }
  if (view.layers.shape) {
    for (let i = objs.length - 1; i >= 0; i--) {
      const o = objs[i]
      if (o.kind === 'raw' && !o.el.locked && rawHit(o.el, p, tol)) return { kind: 'raw', id: o.id }
    }
  }
  if (view.layers.area) {
    for (let i = objs.length - 1; i >= 0; i--) {
      const o = objs[i]
      if (o.kind !== 'area') continue
      if (boxContains(areaLabelBox(o), p) || nearBoxEdge(o, p, tol)) return { kind: 'area', id: o.id }
      // 已选中的区域：内部也能拖动
      if (selection.has(o.id) && boxContains(o, p)) return { kind: 'area', id: o.id }
    }
  }
  for (let i = objs.length - 1; i >= 0; i--) {
    const o = objs[i]
    if (o.kind === 'sheet' && boxContains(o, p)) return { kind: 'sheet', id: o.id }
  }
  return null
}
