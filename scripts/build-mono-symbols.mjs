/**
 * 生成白 / 金两套单色设备图标：
 *
 *   node scripts/build-mono-symbols.mjs
 *
 * 字形来源：public/point-markers/*.svg —— 点位图 / App 正在用的同一套 24×24 字形。
 * 每个源文件是「白色字形 <g> + 彩色圆盘/底板」，本脚本只取中间的字形组，
 * 丢掉圆盘、外圈描边和底色，再重新上色、归一尺寸：
 *
 *   public/board/symbols/mono/white/<name>.svg   纯白（#FFFFFF）
 *   public/board/symbols/mono/gold/<name>.svg    品牌金（--color-brand-gold）
 *   public/board/symbols/mono/index.json         名称 → 两套文件 + 中文名 + 是否必交
 *
 * 处理规则：
 *
 * 1. 只保留中间的 <g> 子图元，保留源文件自己的 stroke-linecap / stroke-linejoin；
 *    原圆盘、外描边、彩色底板全部丢弃。
 * 2. viewBox 统一为 0 0 32 32：按「图形外接框 + 描边」等比缩放，墨迹长边 24，
 *    在 32 框里居中，四周留白一致；描边最终统一为 2 个用户单位。
 * 3. 原本是实心细节的图元（开关按键、灯带圆点、屏幕色块等）填成同一颜色，
 *    不再保留源文件里的白色 / 彩色。
 * 4. 金色不写死：从 src/app/(frontend)/styles.css 的 --color-brand-gold 读取，
 *    令牌改名 / 改值后重跑本脚本即可；找不到时直接报错。
 * 5. 少数脱离圆盘后语义会丢的字形在 CUSTOM_GLYPHS 里补画（灯带 / 射灯 /
 *    双开-四开墙板外框），index.json 用 custom: true + note 标明来源。
 *
 * 文件名与 point-markers 完全同名，index.json 的 key 也用它，视频侧可以直接查表。
 * 点名要的 16 类在 index 里标 required: true；其余字形一并输出，方便后续扩展。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { deviceTypeOf } from '../src/lib/device-types.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = path.join(root, 'public/point-markers')
const OUT_DIR = path.join(root, 'public/board/symbols/mono')
const STYLES = path.join(root, 'src/app/(frontend)/styles.css')

const VIEW = 32
/** 墨迹（含描边）的长边目标尺寸：32 框里四周各留 4 个单位 */
const INK_SIZE = 24
/** 最终描边视觉宽度（用户单位） */
const STROKE = 2
const WHITE = '#FFFFFF'
const GOLD_TOKEN = '--color-brand-gold'

/** 点名要的 16 类：point-markers 文件名 → 宣传画面上的短名 */
const REQUIRED = {
  'switch-2': '双开',
  'switch-3': '三开',
  'switch-4': '四开',
  spotlight: '射灯',
  downlight: '筒灯',
  'ceiling-light': '吸顶灯',
  'light-strip': '灯带',
  'curtain-track': '窗帘',
  'motion-sensor': '人体',
  gateway: '网关',
  'touch-panel': '中控屏',
  speaker: '音箱',
  'ap-node': 'AP',
  'ac-router': '路由',
  'smart-lock': '门锁',
  camera: '摄像头',
}

/**
 * 同灯类字形替换：`ceiling-light` 原图是「圆 + 大叉」，脱离彩色圆盘后
 * 读起来像「禁止 / 关闭」，放在宣传画面里认不出是灯。改用同属灯具的
 * `pendant-light`（吊灯：吊杆 + 灯罩），文件名和 index key 仍是 ceiling-light。
 */
const GLYPH_OVERRIDES = {
  'ceiling-light': 'pendant-light',
}

/** 联系方式里要求的排版顺序 */
const REQUIRED_ORDER = [
  'gateway',
  'touch-panel',
  'speaker',
  'switch-2',
  'switch-3',
  'switch-4',
  'spotlight',
  'downlight',
  'ceiling-light',
  'light-strip',
  'curtain-track',
  'motion-sensor',
  'ap-node',
  'ac-router',
  'smart-lock',
  'camera',
]

/** 设备类别 → 对照表分组；锁与监控合并成「安防」，插座 / VRF / 其他放到「其他」 */
const GROUP_BY_CATEGORY = {
  gateway: '网关',
  switch: '开关',
  lighting: '灯光',
  curtain: '窗帘',
  sensor: '传感',
  network: '网络',
  lock: '安防',
  security: '安防',
  socket: '其他',
  vrf: '其他',
  other: '其他',
}

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
 * 支持本仓库字形实际用到的绝对 / 相对命令：M L H V C S Q T A Z；
 * 曲线按 24 段折线采样（24 单位画布上的误差 < 0.01），圆弧按中心参数化采样。
 *
 * 注意 SVG 允许圆弧的两个 flag 与后面的坐标连写（如 `a1 1 0 0010 3`），
 * 不能按普通数字切词；这里用游标逐字符解析，flag 固定只读 1 个字符。
 */
function pathBBox(d) {
  const pts = []
  let i = 0
  let cmd = null
  let x = 0
  let y = 0
  let sx = 0
  let sy = 0
  let prevCtrl = null
  let prevQ = null
  const isCmd = (c) => /[a-zA-Z]/.test(c)
  const skip = () => {
    while (i < d.length && /[\s,]/.test(d[i])) i++
  }
  const readNumber = () => {
    skip()
    const m = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(d.slice(i))
    if (!m) throw new Error(`路径参数不合法（位置 ${i}）：${d}`)
    i += m[0].length
    return Number(m[0])
  }
  const readFlag = () => {
    skip()
    const c = d[i]
    if (c !== '0' && c !== '1') throw new Error(`圆弧 flag 不合法（位置 ${i}）：${d}`)
    i++
    return Number(c)
  }
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

  while (true) {
    skip()
    if (i >= d.length) break
    if (isCmd(d[i])) {
      cmd = d[i]
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
      cmd = null
      continue
    }
    if (C === 'M') {
      x = ox + readNumber()
      y = oy + readNumber()
      sx = x
      sy = y
      add(x, y)
      cmd = rel ? 'l' : 'L'
      prevCtrl = prevQ = null
    } else if (C === 'L') {
      x = ox + readNumber()
      y = oy + readNumber()
      add(x, y)
      prevCtrl = prevQ = null
    } else if (C === 'H') {
      x = ox + readNumber()
      add(x, y)
      prevCtrl = prevQ = null
    } else if (C === 'V') {
      y = oy + readNumber()
      add(x, y)
      prevCtrl = prevQ = null
    } else if (C === 'C') {
      const x1 = ox + readNumber()
      const y1 = oy + readNumber()
      const x2 = ox + readNumber()
      const y2 = oy + readNumber()
      const x3 = ox + readNumber()
      const y3 = oy + readNumber()
      cubic(x1, y1, x2, y2, x3, y3)
      prevCtrl = [x2, y2]
      prevQ = null
      x = x3
      y = y3
    } else if (C === 'S') {
      const [x1, y1] = prevCtrl ? [2 * x - prevCtrl[0], 2 * y - prevCtrl[1]] : [x, y]
      const x2 = ox + readNumber()
      const y2 = oy + readNumber()
      const x3 = ox + readNumber()
      const y3 = oy + readNumber()
      cubic(x1, y1, x2, y2, x3, y3)
      prevCtrl = [x2, y2]
      prevQ = null
      x = x3
      y = y3
    } else if (C === 'Q') {
      const x1 = ox + readNumber()
      const y1 = oy + readNumber()
      const x2 = ox + readNumber()
      const y2 = oy + readNumber()
      quad(x1, y1, x2, y2)
      prevQ = [x1, y1]
      prevCtrl = null
      x = x2
      y = y2
    } else if (C === 'T') {
      const [x1, y1] = prevQ ? [2 * x - prevQ[0], 2 * y - prevQ[1]] : [x, y]
      const x2 = ox + readNumber()
      const y2 = oy + readNumber()
      quad(x1, y1, x2, y2)
      prevQ = [x1, y1]
      prevCtrl = null
      x = x2
      y = y2
    } else if (C === 'A') {
      const rx = readNumber()
      const ry = readNumber()
      const rot = readNumber()
      const large = readFlag()
      const sweep = readFlag()
      const x2 = ox + readNumber()
      const y2 = oy + readNumber()
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

/* ------------------------------ 源文件解析 ------------------------------ */

const parseAttrs = (s) => {
  const out = {}
  for (const m of s.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) out[m[1]] = m[2]
  return out
}

/** 从 point-marker 源文件里取出中间的字形组与它的图元 */
function readGlyph(file) {
  const svg = fs.readFileSync(path.join(SRC_DIR, file), 'utf8')
  const groups = [...svg.matchAll(/<g\b([^>]*)>([\s\S]*?)<\/g>/g)]
  if (groups.length !== 1) throw new Error(`${file}: 期望 1 个字形 <g>，实际 ${groups.length}`)
  const group = parseAttrs(groups[0][1])
  if (group.fill !== 'none') throw new Error(`${file}: 字形组 fill 不是 none`)
  if (!group.stroke) throw new Error(`${file}: 字形组没有 stroke`)
  const body = groups[0][2]
  if (/<g\b/.test(body)) throw new Error(`${file}: 字形组里还有嵌套 <g>`)

  const shapes = []
  for (const m of body.matchAll(
    /<(path|circle|rect|line|ellipse|polyline|polygon)\b([^>]*?)\/>/g,
  )) {
    const tag = m[1]
    const attrs = parseAttrs(m[2])
    if (attrs.fill && attrs.fill !== 'none' && attrs.fill !== '#fff')
      throw new Error(`${file}: 图标里出现意外填充色 ${attrs.fill}`)
    if (attrs.stroke && attrs.stroke !== 'none')
      throw new Error(`${file}: 图标里出现意外描边色 ${attrs.stroke}`)
    shapes.push({ tag, attrs })
  }
  if (!shapes.length) throw new Error(`${file}: 没找到字形图元`)

  return {
    shapes,
    linecap: group['stroke-linecap'] ?? 'round',
    linejoin: group['stroke-linejoin'] ?? 'round',
  }
}

/* ------------------------------ 自定义补画 ------------------------------ */

/**
 * 少数字形脱离彩色圆盘后语义会丢，这里在同一个 24×24 坐标系里补画：
 * - light-strip：5:1 圆角灯条 + 内部发光缝（原「胶囊三点」像更多菜单）
 * - spotlight：上方灯体圆 + 下方三根扇形短射线（原「圆 + 四向射线」像准星）
 * - switch-2/3/4：在 point-markers 按键块外加单色墙板外框（只描边不填充）
 * 自定义图元同样走 renderSvg 的归一化，最终墨迹 24、描边 2。
 */
const PLATE = {
  tag: 'rect',
  attrs: { x: '-1', y: '-1', width: '26', height: '26', rx: '4.5' },
}

const withPlate = (glyph) => ({ ...glyph, shapes: [PLATE, ...glyph.shapes] })

const CUSTOM_GLYPHS = {
  'light-strip': () => ({
    shapes: [
      { tag: 'rect', attrs: { x: '2', y: '10', width: '20', height: '4', rx: '2' } },
      {
        tag: 'rect',
        attrs: {
          x: '6',
          y: '11.4',
          width: '12',
          height: '1.2',
          rx: '0.6',
          fill: '#fff',
          stroke: 'none',
        },
      },
    ],
    linecap: 'round',
    linejoin: 'round',
  }),
  spotlight: () => ({
    shapes: [
      // 灯体：上方实心小圆；光束：圆下方三根等长短射线，朝左下 / 正下 / 右下（约 ±35°）。
      // 射线长度 ≈ 1.2 × 圆的半径，不闭合、不做支架腿。
      { tag: 'circle', attrs: { cx: '12', cy: '5.5', r: '3', fill: '#fff', stroke: 'none' } },
      { tag: 'line', attrs: { x1: '9.59', y1: '8.94', x2: '7.53', y2: '11.89' } },
      { tag: 'line', attrs: { x1: '12', y1: '9.7', x2: '12', y2: '13.3' } },
      { tag: 'line', attrs: { x1: '14.41', y1: '8.94', x2: '16.47', y2: '11.89' } },
    ],
    linecap: 'round',
    linejoin: 'round',
  }),
  'switch-2': () => withPlate(readGlyph('switch-2.svg')),
  'switch-3': () => withPlate(readGlyph('switch-3.svg')),
  'switch-4': () => withPlate(readGlyph('switch-4.svg')),
}

const CUSTOM_NOTES = {
  'light-strip': '自定义补画：5:1 圆角灯条 + 内部发光缝（原「胶囊三点」易读成更多）',
  spotlight:
    '自定义补画：上方灯体圆 + 下方朝左下/正下/右下的三根短射线（原「圆 + 四向射线」像准星）',
  'switch-2': '自定义补画：在 point-markers 按键块外加单色墙板外框（只描边不填充）',
  'switch-3': '自定义补画：在 point-markers 按键块外加单色墙板外框（只描边不填充）',
  'switch-4': '自定义补画：在 point-markers 按键块外加单色墙板外框（只描边不填充）',
}

function shapePoints({ tag, attrs }) {
  const n = (k, fallback = 0) => (attrs[k] === undefined ? fallback : Number(attrs[k]))
  if (tag === 'path') return pathBBox(attrs.d)
  if (tag === 'circle') {
    const cx = n('cx')
    const cy = n('cy')
    const r = n('r')
    return [
      [cx - r, cy - r],
      [cx + r, cy + r],
    ]
  }
  if (tag === 'rect') {
    const x = n('x')
    const y = n('y')
    return [
      [x, y],
      [x + n('width'), y + n('height')],
    ]
  }
  if (tag === 'line')
    return [
      [n('x1'), n('y1')],
      [n('x2'), n('y2')],
    ]
  if (tag === 'ellipse') {
    const cx = n('cx')
    const cy = n('cy')
    return [
      [cx - n('rx'), cy - n('ry')],
      [cx + n('rx'), cy + n('ry')],
    ]
  }
  const coords = (attrs.points ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  return Array.from({ length: coords.length / 2 }, (_, i) => [coords[i * 2], coords[i * 2 + 1]])
}

function glyphBBox(shapes) {
  const pts = shapes.flatMap(shapePoints)
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  if (!xs.length) throw new Error('字形没有外接框')
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  }
}

/* ------------------------------ 输出 ------------------------------ */

const num = (n) => (Math.round(n * 1000) / 1000).toString()

/** 图元只保留几何属性；颜色统一由外层组或 fill 覆盖，源文件的白色不落盘 */
function shapeMarkup({ tag, attrs }, color) {
  const keep = [
    'd',
    'cx',
    'cy',
    'r',
    'x',
    'y',
    'width',
    'height',
    'rx',
    'ry',
    'x1',
    'y1',
    'x2',
    'y2',
    'points',
  ]
  const parts = [tag]
  for (const k of keep) if (attrs[k] !== undefined) parts.push(`${k}="${attrs[k]}"`)
  if (attrs.fill && attrs.fill !== 'none') parts.push(`fill="${color}"`)
  if (attrs.stroke === 'none') parts.push('stroke="none"')
  return `<${parts.join(' ')}/>`
}

/** 等比缩放到统一墨迹范围并居中；组内描边设成 2/s，缩放回来后正好 2 个单位 */
function renderSvg(glyph, color, title) {
  const { shapes, linecap, linejoin } = glyph
  const { minX, maxX, minY, maxY } = glyphBBox(shapes)
  const gw = maxX - minX
  const gh = maxY - minY
  if (!(gw > 0) || !(gh > 0)) throw new Error(`字形没有面积：${title}`)
  // 只有描边图元才会向外扩 1 个单位；纯实心字形（如四开面板）按实际外接框铺满
  const stroked = shapes.some((s) => s.attrs.stroke !== 'none')
  const pad = stroked ? STROKE / 2 : 0
  const scale = (INK_SIZE - pad * 2) / Math.max(gw, gh)
  const tx = VIEW / 2 - ((minX + maxX) / 2) * scale
  const ty = VIEW / 2 - ((minY + maxY) / 2) * scale
  const body = shapes.map((s) => shapeMarkup(s, color)).join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}" width="${VIEW}" height="${VIEW}" fill="none">\n` +
    `<title>${title}</title>\n` +
    `<g fill="none" stroke="${color}" stroke-width="${num(STROKE / scale)}" stroke-linecap="${linecap}" stroke-linejoin="${linejoin}" transform="translate(${num(tx)} ${num(ty)}) scale(${num(scale)})">${body}</g>\n` +
    `</svg>\n`
  )
}

function main() {
  const gold = readGold()
  const colors = { white: WHITE, gold }
  const names = fs
    .readdirSync(SRC_DIR)
    .filter((f) => f.endsWith('.svg'))
    .map((f) => f.slice(0, -4))
    .sort()

  for (const name of names) {
    if (!deviceTypeOf(name)) throw new Error(`device-types.ts 里没有设备类型 ${name}`)
  }
  for (const name of REQUIRED_ORDER) {
    if (!names.includes(name)) throw new Error(`point-markers 里缺少必交字形 ${name}`)
  }

  // 被借用为替身字形的源文件不再作为「附加字形」重复输出
  const borrowed = new Set(Object.values(GLYPH_OVERRIDES))
  // 必交 16 类按交接单顺序在前，其余按名称排在后面
  const ordered = [
    ...REQUIRED_ORDER,
    ...names.filter((n) => !REQUIRED_ORDER.includes(n) && !borrowed.has(n)),
  ]
  const extras = ordered.filter((n) => !(n in REQUIRED))

  fs.rmSync(path.join(OUT_DIR, 'white'), { recursive: true, force: true })
  fs.rmSync(path.join(OUT_DIR, 'gold'), { recursive: true, force: true })
  fs.mkdirSync(path.join(OUT_DIR, 'white'), { recursive: true })
  fs.mkdirSync(path.join(OUT_DIR, 'gold'), { recursive: true })

  const devices = {}
  for (const name of ordered) {
    const glyphName = GLYPH_OVERRIDES[name] ?? name
    const isCustom = name in CUSTOM_GLYPHS
    const glyph = isCustom ? CUSTOM_GLYPHS[name]() : readGlyph(`${glyphName}.svg`)
    const type = deviceTypeOf(name)
    const label = REQUIRED[name] ?? type.name
    for (const [colorName, color] of Object.entries(colors)) {
      fs.writeFileSync(
        path.join(OUT_DIR, colorName, `${name}.svg`),
        renderSvg(glyph, color, `${label} · ${colorName === 'white' ? '白色' : '金色'}`),
      )
    }
    devices[name] = {
      white: `white/${name}.svg`,
      gold: `gold/${name}.svg`,
      label,
      group: GROUP_BY_CATEGORY[type.category] ?? '其他',
      required: name in REQUIRED,
      ...(glyphName !== name
        ? { glyph: glyphName, note: '圆叉字形易读成禁止符号，改用同灯类的吊灯字形' }
        : {}),
      ...(isCustom
        ? {
            custom: true,
            glyph: name.startsWith('switch-') ? `${name}.svg + 墙板外框` : 'custom',
            note: CUSTOM_NOTES[name],
          }
        : {}),
      ...(!(name in REQUIRED) ? { category: type.category } : {}),
    }
  }

  const index = {
    generatedBy: 'scripts/build-mono-symbols.mjs',
    source: 'public/point-markers/*.svg',
    viewBox: `0 0 ${VIEW} ${VIEW}`,
    strokeWidth: STROKE,
    background: 'transparent',
    colors: { white: WHITE, gold },
    goldToken: GOLD_TOKEN,
    basePath: '/board/symbols/mono',
    required: REQUIRED_ORDER,
    devices,
  }
  fs.writeFileSync(path.join(OUT_DIR, 'index.json'), `${JSON.stringify(index, null, 2)}\n`)

  console.log(`品牌金 ${GOLD_TOKEN} = ${gold}`)
  console.log(
    `必交 ${REQUIRED_ORDER.length} 类；共输出 ${ordered.length} 类 × 2 套 = ${ordered.length * 2} 个 SVG`,
  )
  console.log(`附加字形 ${extras.length} 个：${extras.join(', ')}`)
  console.log(`输出目录 ${path.relative(root, OUT_DIR)}/`)
}

main()
