/**
 * 生成白 / 金两套单色设备图标：
 *
 *   node scripts/build-mono-symbols.mjs
 *
 * 输出：
 *   public/board/symbols/mono/white/<device>.svg   纯白线稿（#FFFFFF）
 *   public/board/symbols/mono/gold/<device>.svg    品牌金线稿（--color-brand-gold）
 *   public/board/symbols/mono/index.json           设备键 → 两套文件 + 中文名
 *
 * 图形不在这里重画：几何全部来自 src/board/packs/smart-home/cad-symbols.ts 的
 * cadShapes()（与画布 / 图纸导出共用同一份 32×32 图元），本脚本只做三件事：
 *
 * 1. 上色：描边换成纯白或品牌金，填充一律 none，透明背景；
 * 2. 光学归一：按「图形外接框 + 描边」等比缩放到 24×24 的墨迹范围并居中，
 *    所有图标最终留白一致（32 框四周各 4），描边统一为 2 个用户单位；
 * 3. 落盘：先清空 white/ gold/ 两个目录，保证重复运行结果一致。
 *
 * 金色不写死新色号：从 src/app/(frontend)/styles.css 的 --color-brand-gold
 * 读取站点品牌金；令牌改名 / 改值后重跑即可，脚本会在找不到时直接报错。
 *
 * 新增设备类型时：在 cad-symbols.ts 补图元，再在下面 DEVICE_SPECS 加一行。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { cadShapes } from '../src/board/packs/smart-home/cad-symbols.ts'
import { DEVICE_TYPES } from '../src/lib/device-types.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(root, 'public/board/symbols/mono')
const STYLES = path.join(root, 'src/app/(frontend)/styles.css')

const VIEW = 32
/** 墨迹（含描边）的长边目标尺寸：32 框里四周各留 4 个单位 */
const INK_SIZE = 24
/** 与 cad-symbols.ts 的 CAD_STROKE_WIDTH 一致 */
const STROKE = 2
const WHITE = '#FFFFFF'
const GOLD_TOKEN = '--color-brand-gold'

/* ------------------------------ 图标清单 ------------------------------ */

/**
 * 16 类需求图标 → 应用里的设备类型。
 *
 * `switch-2/3/4` 没有独立 SymbolKey，走 switch 图元的「键数」变体（方框 + n 根斜杠）；
 * 其余设备类型各自对应一个 SymbolKey。AP 在应用里有 `ceiling-ap` / `ap-node`
 * 两个设备类型、共用 mesh 符号，这里取通用的 `ap-node`，index.json 里注明别名。
 */
const DEVICE_SPECS = [
  // 网关
  { key: 'gateway', label: '网关', group: '网关', symbol: 'hub' },
  { key: 'touch-panel', label: '中控屏', group: '网关', symbol: 'touch-panel' },
  { key: 'speaker', label: '音箱', group: '网关', symbol: 'speaker' },
  // 开关
  { key: 'switch-2', label: '双开', group: '开关', symbol: 'switch', keys: 2 },
  { key: 'switch-3', label: '三开', group: '开关', symbol: 'switch', keys: 3 },
  { key: 'switch-4', label: '四开', group: '开关', symbol: 'switch', keys: 4 },
  // 灯光
  { key: 'spotlight', label: '射灯', group: '灯光', symbol: 'spotlight' },
  { key: 'downlight', label: '筒灯', group: '灯光', symbol: 'downlight' },
  { key: 'ceiling-light', label: '吸顶灯', group: '灯光', symbol: 'ceiling-light' },
  { key: 'light-strip', label: '灯带', group: '灯光', symbol: 'light-strip' },
  // 窗帘
  { key: 'curtain-track', label: '窗帘', group: '窗帘', symbol: 'curtain' },
  // 传感
  { key: 'motion-sensor', label: '人体', group: '传感', symbol: 'motion-sensor' },
  // 网络
  { key: 'ap-node', label: 'AP', group: '网络', symbol: 'mesh', alsoCovers: ['ceiling-ap'] },
  { key: 'ac-router', label: '路由', group: '网络', symbol: 'router' },
  // 安防
  { key: 'smart-lock', label: '门锁', group: '安防', symbol: 'lock' },
  { key: 'camera', label: '摄像头', group: '安防', symbol: 'camera' },
]

/* ------------------------------ 品牌金 ------------------------------ */

function readGold() {
  const css = fs.readFileSync(STYLES, 'utf8')
  const m = css.match(/--color-brand-gold:\s*(#[0-9a-fA-F]{3,8})\s*;/)
  if (!m) throw new Error(`在 ${path.relative(root, STYLES)} 里找不到 ${GOLD_TOKEN}`)
  return m[1].toUpperCase()
}

/* ------------------------------ 路径外接框 ------------------------------ */

/**
 * 只依赖 SVG 路径本身算外接框（不引额外依赖，也不需要浏览器）。
 * 支持本仓库图元实际用到的绝对 / 相对命令：M L H V C S Q T A Z；
 * 曲线按 24 段折线采样（32 单位画布上的误差 < 0.01），圆弧按中心参数化采样。
 */
function pathBBox(d) {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? []
  const pts = []
  let i = 0
  let cmd = ''
  let x = 0
  let y = 0
  let sx = 0
  let sy = 0
  let prevCtrl = null
  let prevQ = null
  const num = () => Number(tokens[i++])
  const add = (px, py) => pts.push([px, py])

  const cubic = (x1, y1, x2, y2, x3, y3) => {
    for (let t = 1; t <= 24; t++) {
      const u = t / 24
      const v = 1 - u
      add(
        v * v * v * x + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * x3,
        v * v * v * y + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * y3,
      )
    }
  }
  const quad = (x1, y1, x2, y2) => {
    for (let t = 1; t <= 24; t++) {
      const u = t / 24
      const v = 1 - u
      add(v * v * x + 2 * v * u * x1 + u * u * x2, v * v * y + 2 * v * u * y1 + u * u * y2)
    }
  }
  const arc = (rx, ry, rot, large, sweep, x2, y2) => {
    if (!rx || !ry) return add(x2, y2)
    const phi = ((rot % 360) * Math.PI) / 180
    const cos = Math.cos(phi)
    const sin = Math.sin(phi)
    const dx = (x - x2) / 2
    const dy = (y - y2) / 2
    const x1p = cos * dx + sin * dy
    const y1p = -sin * dx + cos * dy
    rx = Math.abs(rx)
    ry = Math.abs(ry)
    const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
    if (lambda > 1) {
      const s = Math.sqrt(lambda)
      rx *= s
      ry *= s
    }
    const sign = large === sweep ? -1 : 1
    const n = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
    const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
    const co = sign * Math.sqrt(Math.max(0, n / den))
    const cxp = (co * rx * y1p) / ry
    const cyp = (-co * ry * x1p) / rx
    const cx = cos * cxp - sin * cyp + (x + x2) / 2
    const cy = sin * cxp + cos * cyp + (y + y2) / 2
    const ux = (x1p - cxp) / rx
    const uy = (y1p - cyp) / ry
    const vx = (-x1p - cxp) / rx
    const vy = (-y1p - cyp) / ry
    const t1 = Math.atan2(uy, ux)
    let delta = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
    if (!sweep && delta > 0) delta -= Math.PI * 2
    if (sweep && delta < 0) delta += Math.PI * 2
    for (let k = 1; k <= 24; k++) {
      const a = t1 + (delta * k) / 24
      add(
        cx + rx * Math.cos(a) * cos - ry * Math.sin(a) * sin,
        cy + rx * Math.cos(a) * sin + ry * Math.sin(a) * cos,
      )
    }
  }

  while (i < tokens.length) {
    const next = tokens[i]
    if (/[a-zA-Z]/.test(next)) {
      cmd = next
      i++
    } else if (!cmd) {
      throw new Error(`路径缺命令：${d}`)
    }
    const rel = cmd === cmd.toLowerCase()
    const C = cmd.toUpperCase()
    const ox = rel ? x : 0
    const oy = rel ? y : 0

    if (C === 'Z') {
      x = sx
      y = sy
      prevCtrl = prevQ = null
      continue
    }
    if (C === 'M') {
      x = ox + num()
      y = oy + num()
      sx = x
      sy = y
      add(x, y)
      cmd = rel ? 'l' : 'L'
      prevCtrl = prevQ = null
    } else if (C === 'L') {
      x = ox + num()
      y = oy + num()
      add(x, y)
      prevCtrl = prevQ = null
    } else if (C === 'H') {
      x = ox + num()
      add(x, y)
      prevCtrl = prevQ = null
    } else if (C === 'V') {
      y = oy + num()
      add(x, y)
      prevCtrl = prevQ = null
    } else if (C === 'C') {
      const x1 = ox + num()
      const y1 = oy + num()
      const x2 = ox + num()
      const y2 = oy + num()
      const x3 = ox + num()
      const y3 = oy + num()
      cubic(x1, y1, x2, y2, x3, y3)
      prevCtrl = [x2, y2]
      prevQ = null
      x = x3
      y = y3
    } else if (C === 'S') {
      const [x1, y1] = prevCtrl ? [2 * x - prevCtrl[0], 2 * y - prevCtrl[1]] : [x, y]
      const x2 = ox + num()
      const y2 = oy + num()
      const x3 = ox + num()
      const y3 = oy + num()
      cubic(x1, y1, x2, y2, x3, y3)
      prevCtrl = [x2, y2]
      prevQ = null
      x = x3
      y = y3
    } else if (C === 'Q') {
      const x1 = ox + num()
      const y1 = oy + num()
      const x2 = ox + num()
      const y2 = oy + num()
      quad(x1, y1, x2, y2)
      prevQ = [x1, y1]
      prevCtrl = null
      x = x2
      y = y2
    } else if (C === 'T') {
      const [x1, y1] = prevQ ? [2 * x - prevQ[0], 2 * y - prevQ[1]] : [x, y]
      const x2 = ox + num()
      const y2 = oy + num()
      quad(x1, y1, x2, y2)
      prevQ = [x1, y1]
      prevCtrl = null
      x = x2
      y = y2
    } else if (C === 'A') {
      const rx = num()
      const ry = num()
      const rot = num()
      const large = num()
      const sweep = num()
      const x2 = ox + num()
      const y2 = oy + num()
      arc(rx, ry, rot, large, sweep, x2, y2)
      prevCtrl = prevQ = null
      x = x2
      y = y2
    } else {
      throw new Error(`不支持的路径命令 ${cmd}：${d}`)
    }
  }
  return pts
}

function shapesBBox(shapes) {
  const pts = []
  for (const s of shapes) {
    if (s.t === 'path') pts.push(...pathBBox(s.d))
    else if (s.t === 'circle')
      pts.push(
        [s.cx - s.r, s.cy - s.r],
        [s.cx + s.r, s.cy - s.r],
        [s.cx - s.r, s.cy + s.r],
        [s.cx + s.r, s.cy + s.r],
      )
    else pts.push([s.x1, s.y1], [s.x2, s.y2])
  }
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  }
}

/* ------------------------------ 输出 ------------------------------ */

const num = (n) => (Math.round(n * 1000) / 1000).toString()

function shapeMarkup(s) {
  if (s.t === 'path') return `<path d="${s.d}"/>`
  if (s.t === 'circle') return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}"/>`
  return `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}"/>`
}

/**
 * 等比缩放到统一墨迹范围并居中。描边在缩放后的组内设为 2/s，
 * 缩放回来后正好是 2 个用户单位 —— 与 CAD 画布同一视觉线宽。
 */
function renderSvg(shapes, color, title) {
  const { minX, maxX, minY, maxY } = shapesBBox(shapes)
  const gw = maxX - minX
  const gh = maxY - minY
  if (!(gw > 0) || !(gh > 0)) throw new Error(`图形没有面积：${title}`)
  const scale = (INK_SIZE - STROKE) / Math.max(gw, gh)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const tx = VIEW / 2 - cx * scale
  const ty = VIEW / 2 - cy * scale
  const body = shapes.map(shapeMarkup).join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}" width="${VIEW}" height="${VIEW}" fill="none">\n` +
    `<title>${title}</title>\n` +
    `<g fill="none" stroke="${color}" stroke-width="${num(STROKE / scale)}" stroke-linecap="round" stroke-linejoin="round" transform="translate(${num(tx)} ${num(ty)}) scale(${num(scale)})">${body}</g>\n` +
    `</svg>\n`
  )
}

function main() {
  const gold = readGold()
  const colors = { white: WHITE, gold }

  // 每个规格都必须能在 DEVICE_TYPES 里找到，且符号键一致 —— 防止改名后悄悄缺图
  const typeByValue = new Map(DEVICE_TYPES.map((t) => [t.value, t]))
  for (const spec of DEVICE_SPECS) {
    const type = typeByValue.get(spec.key)
    if (!type) throw new Error(`device-types.ts 里没有设备类型 ${spec.key}`)
    if (type.symbol !== spec.symbol)
      throw new Error(`${spec.key} 的符号应为 ${type.symbol}，清单写的是 ${spec.symbol}`)
    if (spec.keys !== undefined && type.keys !== spec.keys)
      throw new Error(`${spec.key} 的键数应为 ${type.keys}，清单写的是 ${spec.keys}`)
    if (!cadShapes(spec.symbol, spec.keys)) throw new Error(`cad-symbols.ts 里没有 ${spec.symbol}`)
  }

  fs.rmSync(path.join(OUT_DIR, 'white'), { recursive: true, force: true })
  fs.rmSync(path.join(OUT_DIR, 'gold'), { recursive: true, force: true })
  fs.mkdirSync(path.join(OUT_DIR, 'white'), { recursive: true })
  fs.mkdirSync(path.join(OUT_DIR, 'gold'), { recursive: true })

  const devices = {}
  for (const spec of DEVICE_SPECS) {
    const shapes = cadShapes(spec.symbol, spec.keys)
    for (const [name, color] of Object.entries(colors)) {
      fs.writeFileSync(
        path.join(OUT_DIR, name, `${spec.key}.svg`),
        renderSvg(shapes, color, `${spec.label} · ${name === 'white' ? '白色' : '金色'}`),
      )
    }
    devices[spec.key] = {
      white: `white/${spec.key}.svg`,
      gold: `gold/${spec.key}.svg`,
      label: spec.label,
      group: spec.group,
      deviceType: spec.key,
      symbol: spec.symbol,
      ...(spec.keys !== undefined ? { keys: spec.keys } : {}),
      ...(spec.alsoCovers ? { alsoCovers: spec.alsoCovers } : {}),
    }
  }

  const index = {
    generatedBy: 'scripts/build-mono-symbols.mjs',
    source: 'src/board/packs/smart-home/cad-symbols.ts',
    viewBox: `0 0 ${VIEW} ${VIEW}`,
    strokeWidth: STROKE,
    background: 'transparent',
    colors: { white: WHITE, gold },
    goldToken: GOLD_TOKEN,
    basePath: '/board/symbols/mono',
    devices,
  }
  fs.writeFileSync(path.join(OUT_DIR, 'index.json'), `${JSON.stringify(index, null, 2)}\n`)

  console.log(`品牌金 ${GOLD_TOKEN} = ${gold}`)
  console.log(
    `已生成 ${DEVICE_SPECS.length} 类 × ${Object.keys(colors).length} 套 = ${DEVICE_SPECS.length * 2} 个 SVG`,
  )
  console.log(`输出目录 ${path.relative(root, OUT_DIR)}/`)
}

main()
