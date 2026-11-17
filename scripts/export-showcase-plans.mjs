#!/usr/bin/env node
/**
 * 生成展示版点位图（宣传视频 / 手机尺寸用）。
 *
 * 数据来源（不手抄坐标）：
 *   - 墙体：public/demo-plans/gy-{1,2,3}f-light.png。灰度阈值取墨线，横 / 竖长核
 *     开运算只留长直墙线，去掉文字、引线、图例、型号串；再取最大连通域（整套墙体）。
 *     房间外框凸包外扩后裁剪，去掉伸出建筑外的标注线。
 *   - 房间矩形、点位坐标：src/lib/builtin-demo-sheets.ts 的 BUILTIN_DEMO_SHEETS
 *     （points.rx/ry 与 areas.x0/y0/x1/y1 都是 0–1 归一化坐标）
 *   - 点位颜色：src/lib/device-types.ts 的 DEVICE_CATEGORIES（与画板符号同一套分类色）
 *
 * 输出：public/demo-plans/gy-{1,2,3}f-showcase.png，2400×1600，透明背景。
 * 重新生成：node scripts/export-showcase-plans.mjs
 */
/* global console, document, process, Buffer */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'
import sharp from 'sharp'

import { BUILTIN_DEMO_SHEETS } from '../src/lib/builtin-demo-sheets.ts'
import { categoryOfType } from '../src/lib/device-types.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const W = 2400
const H = 1600

const SOURCE_DIR = path.join(ROOT, 'public/demo-plans')
const OUT_DIR = path.join(ROOT, 'public/demo-plans')

const INK = 128
const LINE_LENGTH = 60
const ALIGN_TOL = 45
const HULL_PAD = 24
const SAFE_PAD = 120

const WALL_COLOR = { r: 42, g: 42, b: 40 }
const OUTER_RADIUS = 4
const INNER_RADIUS = 1
const OUTER_BAND = 18

const LABEL = { pad: 24, size: 40, small: 32, smallWidth: 220, color: '#2A2A28' }
const DOT = { r: 12, ring: 2 }

/** 人工校正：施工图里少量引线贴在墙上，形态学去不掉；闭合线用于补被曲线窗带打断的外墙。 */
const FIXUPS = {
  一层: {
    lines: [],
    erase: [
      { x0: 380, y0: 200, x1: 415, y1: 236 },
      { x0: 1060, y0: 1325, x1: 1105, y1: 1405 },
      { x0: 1170, y0: 1325, x1: 1210, y1: 1405 },
      { x0: 1315, y0: 1325, x1: 1355, y1: 1405 },
      { x0: 1770, y0: 1380, x1: 1820, y1: 1425 },
    ],
  },
  二层: {
    lines: [{ x1: 2153, y1: 552, x2: 2153, y2: 945 }],
    erase: [
      { x0: 250, y0: 442, x1: 365, y1: 472 },
      { x0: 250, y0: 852, x1: 365, y1: 882 },
      { x0: 250, y0: 1042, x1: 365, y1: 1072 },
      { x0: 1160, y0: 195, x1: 1260, y1: 236 },
      { x0: 1835, y0: 195, x1: 1900, y1: 236 },
      { x0: 1850, y0: 370, x1: 1950, y1: 400 },
    ],
  },
  三层: {
    lines: [{ x1: 2055, y1: 917, x2: 2055, y2: 1455 }],
    erase: [
      { x0: 460, y0: 382, x1: 590, y1: 412 },
      { x0: 460, y0: 598, x1: 590, y1: 628 },
      { x0: 460, y0: 778, x1: 590, y1: 808 },
      { x0: 460, y0: 848, x1: 590, y1: 878 },
      { x0: 460, y0: 992, x1: 590, y1: 1022 },
      { x0: 1268, y0: 100, x1: 1322, y1: 146 },
      { x0: 1695, y0: 118, x1: 1770, y1: 146 },
      { x0: 1788, y0: 118, x1: 1850, y1: 146 },
      { x0: 1868, y0: 748, x1: 1955, y1: 914 },
      { x0: 1112, y0: 1300, x1: 1185, y1: 1420 },
      { x0: 1515, y0: 1388, x1: 1585, y1: 1450 },
      { x0: 1628, y0: 1388, x1: 1695, y1: 1450 },
    ],
  },
}

/** 水平方向滑动窗口形态学；erode=true 为腐蚀，否则膨胀 */
function morphH(src, w, h, r, erode) {
  const out = new Uint8Array(w * h)
  const pre = new Int32Array(w + 1)
  for (let y = 0; y < h; y++) {
    const off = y * w
    for (let x = 0; x < w; x++) pre[x + 1] = pre[x] + src[off + x]
    for (let x = 0; x < w; x++) {
      const lo = Math.max(0, x - r)
      const hi = Math.min(w - 1, x + r)
      const count = pre[hi + 1] - pre[lo]
      out[off + x] = erode ? (count === hi - lo + 1 ? 1 : 0) : count > 0 ? 1 : 0
    }
  }
  return out
}

function morphV(src, w, h, r, erode) {
  const out = new Uint8Array(w * h)
  const pre = new Int32Array(h + 1)
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) pre[y + 1] = pre[y] + src[y * w + x]
    for (let y = 0; y < h; y++) {
      const lo = Math.max(0, y - r)
      const hi = Math.min(h - 1, y + r)
      const count = pre[hi + 1] - pre[lo]
      out[y * w + x] = erode ? (count === hi - lo + 1 ? 1 : 0) : count > 0 ? 1 : 0
    }
  }
  return out
}

const openH = (m, w, h, r) => morphH(morphH(m, w, h, r, true), w, h, r, false)
const openV = (m, w, h, r) => morphV(morphV(m, w, h, r, true), w, h, r, false)
const dilate = (m, w, h, r) => morphV(morphH(m, w, h, r, false), w, h, r, false)
function largestComponent(mask, w, h) {
  const seen = new Uint8Array(w * h)
  const stack = new Int32Array(w * h)
  let best = null
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i]) continue
    let sp = 0
    stack[sp++] = i
    seen[i] = 1
    const px = []
    while (sp) {
      const p = stack[--sp]
      px.push(p)
      const x = p % w
      const y = (p - x) / w
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= h) continue
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= w) continue
          const q = yy * w + xx
          if (mask[q] && !seen[q]) {
            seen[q] = 1
            stack[sp++] = q
          }
        }
      }
    }
    if (!best || px.length > best.length) best = px
  }
  const out = new Uint8Array(w * h)
  for (const p of best ?? []) out[p] = 1
  return out
}

function convexHull(points) {
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower = []
  for (const p of points) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop()
    lower.push(p)
  }
  const upper = []
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop()
    upper.push(p)
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1))
}

function fillPolygon(poly, w, h) {
  const mask = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const xs = []
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]
      const b = poly[(i + 1) % poly.length]
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]))
      }
    }
    xs.sort((a, b) => a - b)
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let x = Math.ceil(xs[i]); x <= Math.floor(xs[i + 1]); x++) {
        if (x >= 0 && x < w) mask[y * w + x] = 1
      }
    }
  }
  return mask
}

function drawPolygon(poly, w, h) {
  const mask = new Uint8Array(w * h)
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i]
    const [x2, y2] = poly[(i + 1) % poly.length]
    const n = Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))) * 2
    for (let k = 0; k <= n; k++) {
      const x = Math.round(x1 + ((x2 - x1) * k) / n)
      const y = Math.round(y1 + ((y2 - y1) * k) / n)
      if (x >= 0 && x < w && y >= 0 && y < h) mask[y * w + x] = 1
    }
  }
  return mask
}

function drawLine(mask, w, h, x1, y1, x2, y2) {
  const n = Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))) * 2
  for (let k = 0; k <= n; k++) {
    const x = Math.round(x1 + ((x2 - x1) * k) / n)
    const y = Math.round(y1 + ((y2 - y1) * k) / n)
    if (x >= 0 && x < w && y >= 0 && y < h) mask[y * w + x] = 1
  }
}

const inRect = (r, x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1

async function extractWalls(sheet) {
  const file = path.join(SOURCE_DIR, path.basename(sheet.url))
  const { data, info } = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true })
  const w = info.width
  const h = info.height
  const ink = new Uint8Array(w * h)
  for (let i = 0; i < ink.length; i++) ink[i] = data[i] < INK ? 1 : 0

  const hh = openH(ink, w, h, LINE_LENGTH / 2)
  const vv = openV(ink, w, h, LINE_LENGTH / 2)
  const combined = new Uint8Array(w * h)
  for (let i = 0; i < combined.length; i++) combined[i] = hh[i] | vv[i]
  const main = largestComponent(combined, w, h)

  // 只保留与房间边对齐的长直墙线：横向线靠近某条房间横边、纵向线靠近某条房间竖边。
  // 垂直伸出的引线、家具内框、房间中间的虚线会在这里被滤掉。
  const hEdges = []
  const vEdges = []
  for (const a of sheet.areas) {
    hEdges.push({ a: a.x0 * w, b: a.x1 * w, c: a.y0 * h })
    hEdges.push({ a: a.x0 * w, b: a.x1 * w, c: a.y1 * h })
    vEdges.push({ a: a.y0 * h, b: a.y1 * h, c: a.x0 * w })
    vEdges.push({ a: a.y0 * h, b: a.y1 * h, c: a.x1 * w })
  }
  const keepH = (y, a, b) =>
    hEdges.some(
      (r) => Math.abs(y - r.c) <= ALIGN_TOL && b >= r.a - ALIGN_TOL && a <= r.b + ALIGN_TOL,
    )
  const keepV = (x, a, b) =>
    vEdges.some(
      (r) => Math.abs(x - r.c) <= ALIGN_TOL && b >= r.a - ALIGN_TOL && a <= r.b + ALIGN_TOL,
    )

  const walls = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    let x = 0
    while (x < w) {
      if (!hh[y * w + x]) {
        x++
        continue
      }
      const s = x
      while (x < w && hh[y * w + x]) x++
      if (keepH(y, s, x - 1)) {
        for (let i = s; i < x; i++) if (main[y * w + i]) walls[y * w + i] = 1
      }
    }
  }
  for (let x = 0; x < w; x++) {
    let y = 0
    while (y < h) {
      if (!vv[y * w + x]) {
        y++
        continue
      }
      const s = y
      while (y < h && vv[y * w + x]) y++
      if (keepV(x, s, y - 1)) {
        for (let i = s; i < y; i++) if (main[i * w + x]) walls[i * w + x] = 1
      }
    }
  }

  // 房间外框凸包外扩，剪掉伸出建筑外的引线；三层右侧外窗带单独保留
  const corners = []
  for (const a of sheet.areas) {
    corners.push(
      [a.x0 * w, a.y0 * h],
      [a.x1 * w, a.y0 * h],
      [a.x1 * w, a.y1 * h],
      [a.x0 * w, a.y1 * h],
    )
  }
  const hull = convexHull(corners)
  const hullMask = dilate(fillPolygon(hull, w, h), w, h, HULL_PAD)
  const keepBay = (x, y) =>
    sheet.floor === '三层' && x > 0.78 * w && x < 0.88 * w && y > 0.05 * h && y < 0.93 * h
  for (let i = 0; i < walls.length; i++) {
    const x = i % w
    const y = (i - x) / w
    if (walls[i] && !hullMask[i] && !keepBay(x, y)) walls[i] = 0
  }

  const fix = FIXUPS[sheet.floor]
  for (const line of fix.lines) drawLine(walls, w, h, line.x1, line.y1, line.x2, line.y2)
  for (let i = 0; i < walls.length; i++) {
    const x = i % w
    const y = (i - x) / w
    if (fix.erase.some((r) => inRect(r, x, y))) walls[i] = 0
  }

  return { walls, w, h }
}

/** 墙体分两级：外轮廓（凸包边带内）粗，内隔墙细 */
function renderWallImage(walls, w, h) {
  const pts = []
  for (let i = 0; i < walls.length; i++) {
    if (walls[i]) pts.push([i % w, Math.floor(i / w)])
  }
  const hull = convexHull(pts)
  const hullLine = drawPolygon(hull, w, h)
  const outerBand = dilate(hullLine, w, h, OUTER_BAND)
  const outer = new Uint8Array(w * h)
  const inner = new Uint8Array(w * h)
  for (let i = 0; i < walls.length; i++) {
    if (!walls[i]) continue
    if (outerBand[i]) outer[i] = 1
    else inner[i] = 1
  }
  const outerD = dilate(outer, w, h, OUTER_RADIUS)
  const innerD = dilate(inner, w, h, INNER_RADIUS)
  const rgba = Buffer.alloc(w * h * 4)
  for (let i = 0; i < walls.length; i++) {
    if (!outerD[i] && !innerD[i]) continue
    rgba[i * 4] = WALL_COLOR.r
    rgba[i * 4 + 1] = WALL_COLOR.g
    rgba[i * 4 + 2] = WALL_COLOR.b
    rgba[i * 4 + 3] = 255
  }
  return { rgba, alpha: new Uint8Array(w * h).map((_, i) => (rgba[i * 4 + 3] ? 1 : 0)) }
}

function bboxOf(mask, w, h) {
  let x0 = w
  let y0 = h
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  return { x0, y0, x1, y1 }
}

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )

const textWidth = (text, size, spacing) =>
  [...text].reduce((acc, ch) => acc + (/[\u3000-\u9fff]/.test(ch) ? size : size * 0.58), 0) +
  Math.max(0, [...text].length - 1) * spacing

function pointHitsWall(alpha, w, h, x, y, radius) {
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    for (const rr of [radius, radius * 0.55]) {
      const px = Math.round(x + Math.cos(a) * rr)
      const py = Math.round(y + Math.sin(a) * rr)
      if (px < 0 || px >= w || py < 0 || py >= h) continue
      if (alpha[py * w + px]) return true
    }
  }
  return false
}

const rectDistance = (r, x, y) => {
  const dx = Math.max(r.x0 - x, 0, x - r.x1)
  const dy = Math.max(r.y0 - y, 0, y - r.y1)
  return Math.hypot(dx, dy)
}

function buildSvg(sheet, wallPng, transform, wallInfo) {
  const { scale, offsetX, offsetY } = transform
  const { w, h, alpha } = wallInfo
  const tx = (x) => offsetX + x * scale
  const ty = (y) => offsetY + y * scale
  const toSource = (x, y) => [(x - offsetX) / scale, (y - offsetY) / scale]

  const areas = sheet.areas.map((a) => ({
    name: a.name,
    x0: tx(a.x0 * w),
    y0: ty(a.y0 * h),
    x1: tx(a.x1 * w),
    y1: ty(a.y1 * h),
  }))
  const points = sheet.points.map((p) => ({
    ...p,
    x: tx(p.rx * w),
    y: ty(p.ry * h),
    color: categoryOfType(p.type)?.color ?? '#525252',
  }))

  const labels = areas.map((a) => {
    const size = a.x1 - a.x0 < LABEL.smallWidth ? LABEL.small : LABEL.size
    const width = textWidth(a.name, size, 2)
    return {
      ...a,
      size,
      left: a.x0 + LABEL.pad,
      top: a.y0 + LABEL.pad,
      right: a.x0 + LABEL.pad + width,
      bottom: a.y0 + LABEL.pad + size * 1.18,
      anchorX: a.x0 + LABEL.pad,
      anchorY: a.y0 + LABEL.pad + size * 0.59,
    }
  })

  // 同名房间（二层有两块「主卫」）按点位实际落在哪块矩形来配对，不能只按名字取第一块
  const areaFor = (p) => {
    const hit = sheet.areas.findIndex(
      (a) => a.name === p.room && p.rx >= a.x0 && p.rx <= a.x1 && p.ry >= a.y0 && p.ry <= a.y1,
    )
    const idx = hit >= 0 ? hit : sheet.areas.findIndex((a) => a.name === p.room)
    return idx >= 0 ? labels[idx] : { x0: p.x, y0: p.y, x1: p.x, y1: p.y }
  }
  const dots = points.map((p) => {
    const area = areaFor(p)
    const cx = (area.x0 + area.x1) / 2
    const cy = (area.y0 + area.y1) / 2
    let dx = cx - p.x
    let dy = cy - p.y
    const len = Math.hypot(dx, dy) || 1
    dx /= len
    dy /= len
    const inset = DOT.r + DOT.ring + 2
    const inside = (x, y) =>
      x >= area.x0 + inset && x <= area.x1 - inset && y >= area.y0 + inset && y <= area.y1 - inset
    const hits = (x, y) => {
      const [sx, sy] = toSource(x, y)
      if (pointHitsWall(alpha, w, h, sx, sy, (DOT.r + DOT.ring + 1) / scale)) return true
      return labels.some(
        (l) => rectDistance({ x0: l.left, y0: l.top, x1: l.right, y1: l.bottom }, x, y) < DOT.r + 4,
      )
    }
    const candidates = [{ x: p.x, y: p.y }]
    for (const step of [10, 12, 14, 16, 18, 20, 24])
      candidates.push({ x: p.x + dx * step, y: p.y + dy * step })
    for (const step of [12, 16]) {
      candidates.push(
        { x: p.x - dy * step, y: p.y + dx * step },
        { x: p.x + dy * step, y: p.y - dx * step },
      )
    }
    let placed = candidates.find((c) => inside(c.x, c.y) && !hits(c.x, c.y))
    if (!placed) placed = candidates.find((c) => !hits(c.x, c.y))
    if (!placed) placed = candidates[0]
    return { ...p, x: placed.x, y: placed.y }
  })

  const labelsSvg = labels
    .map(
      (l) =>
        `<text x="${l.anchorX.toFixed(1)}" y="${l.anchorY.toFixed(1)}" font-size="${l.size}" font-weight="500" letter-spacing="2" dominant-baseline="central" fill="${LABEL.color}" stroke="#FFFFFF" stroke-width="3" stroke-linejoin="round" paint-order="stroke fill">${esc(l.name)}</text>`,
    )
    .join('')
  const dotsSvg = dots
    .map(
      (d) =>
        `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="${DOT.r}" fill="${d.color}" stroke="#FFFFFF" stroke-width="${DOT.ring}"/>`,
    )
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <style>text { font-family: "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif; }</style>
  <image x="${offsetX.toFixed(2)}" y="${offsetY.toFixed(2)}" width="${(w * scale).toFixed(2)}" height="${(h * scale).toFixed(2)}" href="data:image/png;base64,${wallPng}"/>
  <g>${labelsSvg}</g>
  <g>${dotsSvg}</g>
</svg>`
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const browser = await chromium.launch()
  try {
    const extracted = []
    for (const sheet of BUILTIN_DEMO_SHEETS) {
      extracted.push({ sheet, wall: await extractWalls(sheet) })
    }

    // 三层共用一套画布坐标：取墙体并集，等比缩放（通常为 1）并居中，四周至少留 120px
    const boxes = extracted.map(({ wall }) => bboxOf(wall.walls, wall.w, wall.h))
    const bx0 = Math.min(...boxes.map((b) => b.x0))
    const by0 = Math.min(...boxes.map((b) => b.y0))
    const bx1 = Math.max(...boxes.map((b) => b.x1))
    const by1 = Math.max(...boxes.map((b) => b.y1))
    const scale = Math.min(1, (W - SAFE_PAD * 2) / (bx1 - bx0), (H - SAFE_PAD * 2) / (by1 - by0))
    const offsetX = Math.round((W - (bx1 - bx0) * scale) / 2 - bx0 * scale)
    const offsetY = Math.round((H - (by1 - by0) * scale) / 2 - by0 * scale)

    for (const { sheet, wall } of extracted) {
      const rendered = renderWallImage(wall.walls, wall.w, wall.h)
      const wallPng = await sharp(rendered.rgba, {
        raw: { width: wall.w, height: wall.h, channels: 4 },
      })
        .png()
        .toBuffer()
      const svg = buildSvg(
        sheet,
        wallPng.toString('base64'),
        { scale, offsetX, offsetY },
        {
          w: wall.w,
          h: wall.h,
          alpha: rendered.alpha,
        },
      )
      const outFile = path.join(
        OUT_DIR,
        path.basename(sheet.url).replace('-light.png', '-showcase.png'),
      )
      const page = await browser.newPage({
        viewport: { width: W, height: H },
        deviceScaleFactor: 1,
      })
      await page.setContent(
        `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:${W}px;height:${H}px;background:transparent;overflow:hidden}</style></head><body>${svg}</body></html>`,
        { waitUntil: 'load' },
      )
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: outFile, omitBackground: true, type: 'png' })
      await page.close()
      console.log(
        `${sheet.floor}: ${path.relative(ROOT, outFile)} (${sheet.areas.length} rooms, ${sheet.points.length} points, ${rendered.alpha.reduce((a, b) => a + b, 0)} wall px)`,
      )
    }
    console.log(
      `shared canvas: scale ${scale.toFixed(3)}, offset ${offsetX},${offsetY}, margins ≥ ${SAFE_PAD}px`,
    )
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
