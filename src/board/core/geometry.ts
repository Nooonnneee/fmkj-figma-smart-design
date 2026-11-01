import type { Box, Vec } from './types'

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** 绕 c 顺时针旋转 a 弧度（屏幕坐标系 y 向下） */
export function rotatePoint(p: Vec, c: Vec, a: number): Vec {
  if (!a) return p
  const s = Math.sin(a)
  const k = Math.cos(a)
  const dx = p.x - c.x
  const dy = p.y - c.y
  return { x: c.x + dx * k - dy * s, y: c.y + dx * s + dy * k }
}

export const boxContains = (b: Box, p: Vec, pad = 0) => p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad
export const boxInside = (inner: Box, outer: Box) => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h
export const boxIntersects = (a: Box, b: Box) => a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h
export const boxCenter = (b: Box): Vec => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })
export const normBox = (a: Vec, b: Vec): Box => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) })
export const padBox = (b: Box, p: number): Box => ({ x: b.x - p, y: b.y - p, w: b.w + 2 * p, h: b.h + 2 * p })

export function unionBox(boxes: Box[]): Box | null {
  if (!boxes.length) return null
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const b of boxes) {
    x0 = Math.min(x0, b.x)
    y0 = Math.min(y0, b.y)
    x1 = Math.max(x1, b.x + b.w)
    y1 = Math.max(y1, b.y + b.h)
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/** 旋转矩形（中心 c、宽高 w × h、角度 a）的外接框 */
export function rotatedAabb(c: Vec, w: number, h: number, a: number): Box {
  const s = Math.abs(Math.sin(a))
  const k = Math.abs(Math.cos(a))
  const W = w * k + h * s
  const H = w * s + h * k
  return { x: c.x - W / 2, y: c.y - H / 2, w: W, h: H }
}

/** 点是否落在旋转矩形内 */
export function inRotatedRect(p: Vec, c: Vec, w: number, h: number, a: number, pad = 0) {
  const q = rotatePoint(p, c, -a)
  return Math.abs(q.x - c.x) <= w / 2 + pad && Math.abs(q.y - c.y) <= h / 2 + pad
}

export function distToSegment(p: Vec, a: Vec, b: Vec) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = dx * dx + dy * dy
  const t = len ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len, 0, 1) : 0
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** 矩形边框附近（内外各 band）算命中；用于只点边框才选中的区域 */
export function nearBoxEdge(b: Box, p: Vec, band: number) {
  if (!boxContains(b, p, band)) return false
  return p.x <= b.x + band || p.x >= b.x + b.w - band || p.y <= b.y + band || p.y >= b.y + b.h - band
}

const TAU = Math.PI * 2
export const normAngle = (a: number) => ((a % TAU) + TAU) % TAU
export const snapAngle = (a: number, step = Math.PI / 12) => normAngle(Math.round(a / step) * step)
export const toDeg = (a: number) => Math.round((normAngle(a) * 180) / Math.PI) % 360
export const fromDeg = (d: number) => normAngle((d * Math.PI) / 180)
