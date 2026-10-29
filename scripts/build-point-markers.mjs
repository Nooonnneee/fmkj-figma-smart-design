/**
 * 生成点位标记 SVG：node scripts/build-point-markers.mjs
 *
 * 规范（64×64）：
 * - 白色外圈 + 极浅描边，压在黑色图纸线条上也能分开；
 * - 类别色底（来自 src/lib/device-types.ts，唯一来源）；
 * - 白色线性图形（lucide 图标或自绘），占 56%，线宽统一；
 * - 墙面设备用圆角方形，吊顶 / 其他设备用圆形；开关画出 1–4 个按键。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DEVICE_CATEGORIES, DEVICE_TYPES } from '../src/lib/device-types.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public/point-markers')
const lucideDir = path.join(root, 'node_modules/lucide-react/dist/esm/icons')

const WALL = new Set(['switch-1', 'switch-2', 'switch-3', 'switch-4', 'socket', 'socket-double', 'socket-usb', 'touch-panel', 'network-panel', 'vrf-controller', 'smart-lock', 'doorbell'])

/** 从 lucide 源文件读出图形节点，转成 SVG 片段 */
function lucide(name) {
  const src = fs.readFileSync(path.join(lucideDir, `${name}.mjs`), 'utf8')
  const block = src.slice(src.indexOf('node: ['), src.indexOf('};'))
  const nodes = [...block.matchAll(/\[\s*"(\w+)",\s*\{([^}]*)\}\s*\]/g)].map(([, tag, attrs]) => {
    const parts = [...attrs.matchAll(/(\w+):\s*"([^"]*)"/g)].filter(([, k]) => k !== 'key').map(([, k, v]) => `${k}="${v}"`)
    return `<${tag} ${parts.join(' ')}/>`
  })
  if (!nodes.length) throw new Error(`lucide icon ${name} has no nodes`)
  return nodes.join('')
}

const keys = (n) => {
  const f = 'fill="#fff" stroke="none"'
  if (n === 4) return [[4.5, 4.5], [12.5, 4.5], [4.5, 12.5], [12.5, 12.5]].map(([x, y]) => `<rect x="${x}" y="${y}" width="7" height="7" rx="1.6" ${f}/>`).join('')
  const w = { 1: 6, 2: 5, 3: 4 }[n]
  const gap = { 1: 0, 2: 3, 3: 2.5 }[n]
  const total = n * w + (n - 1) * gap
  return Array.from({ length: n }, (_, i) => `<rect x="${12 - total / 2 + i * (w + gap)}" y="4" width="${w}" height="16" rx="1.6" ${f}/>`).join('')
}

const dot = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="none"/>`

const GLYPHS = {
  'switch-1': keys(1),
  'switch-2': keys(2),
  'switch-3': keys(3),
  'switch-4': keys(4),
  // 五孔：上两孔 + 下「八」字两孔和接地孔
  socket: '<path d="M8.5 4.5v4M15.5 4.5v4M6.5 13l2.5 3M17.5 13 15 16M12 17.5v3.5"/>',
  'socket-double': `<circle cx="7" cy="12" r="5"/><circle cx="17" cy="12" r="5"/>${dot(5.5, 12, 1)}${dot(8.5, 12, 1)}${dot(15.5, 12, 1)}${dot(18.5, 12, 1)}`,
  'socket-usb': lucide('usb'),
  downlight: `<circle cx="12" cy="12" r="8.5"/>${dot(12, 12, 3.2)}`,
  spotlight: '<circle cx="12" cy="12" r="5.5"/><path d="M12 1.5v3.5M12 19v3.5M1.5 12H5M19 12h3.5"/>',
  'track-light': '<path d="M3 6h18M8 6v4M16 6v4"/><circle cx="8" cy="14" r="3"/><circle cx="16" cy="14" r="3"/>',
  'ceiling-light': lucide('lamp-ceiling'),
  'pendant-light': '<path d="M12 2v6M4.5 16a7.5 7.5 0 0 1 15 0z"/><path d="M10 19.5a2 2 0 0 0 4 0"/>',
  'wall-light': lucide('lamp-wall-up'),
  'panel-light': '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M12 3.5v17M3.5 12h17"/>',
  'light-strip': `<rect x="1.5" y="8.5" width="21" height="7" rx="3.5"/>${dot(6.5, 12, 1.4)}${dot(12, 12, 1.4)}${dot(17.5, 12, 1.4)}`,
  'other-light': lucide('lightbulb'),
  'motion-sensor': lucide('person-standing'),
  'smoke-sensor': lucide('alarm-smoke'),
  'water-sensor': lucide('droplets'),
  'temp-sensor': lucide('thermometer'),
  'contact-sensor': lucide('door-open'),
  'smart-lock': lucide('lock-keyhole'),
  doorbell: lucide('bell-ring'),
  camera: lucide('cctv'),
  'curtain-track': lucide('blinds'),
  speaker: lucide('speaker'),
  // 中控屏：屏幕 + 场景卡片
  'touch-panel': '<rect x="2.5" y="4" width="19" height="16" rx="2.5"/><rect x="5.5" y="7" width="5.5" height="4" rx="1" fill="#fff" stroke="none"/><rect x="13" y="7" width="5.5" height="4" rx="1" fill="#fff" stroke="none"/><rect x="5.5" y="13" width="13" height="4" rx="1" fill="#fff" stroke="none"/>',
  gateway: lucide('house-wifi'),
  'ac-router': lucide('router'),
  'ap-node': lucide('wifi'),
  'network-panel': lucide('ethernet-port'),
  'vrf-controller': lucide('air-vent'),
  other: lucide('box'),
}

function marker(type, color) {
  const glyph = GLYPHS[type]
  if (!glyph) throw new Error(`missing glyph for ${type}`)
  const halo = WALL.has(type)
    ? `<rect x="1" y="1" width="62" height="62" rx="16" fill="#fff" stroke="#000" stroke-opacity=".14"/><rect x="5" y="5" width="54" height="54" rx="12.5" fill="${color}"/>`
    : `<circle cx="32" cy="32" r="31" fill="#fff" stroke="#000" stroke-opacity=".14"/><circle cx="32" cy="32" r="27" fill="${color}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${halo}<g transform="translate(14 14) scale(1.5)" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${glyph}</g></svg>\n`
}

fs.mkdirSync(outDir, { recursive: true })
const colorOf = new Map(DEVICE_CATEGORIES.map((c) => [c.slug, c.color]))
const sources = {}
for (const t of DEVICE_TYPES) {
  const svg = marker(t.value, colorOf.get(t.category))
  sources[t.value] = svg.trim()
  fs.writeFileSync(path.join(outDir, `${t.value}.svg`), svg)
}
// 同一份 SVG 源码也打包进前端：画布上直接用内嵌数据，保存时再换回静态地址
const module = `/** 由 scripts/build-point-markers.mjs 生成，请勿手动修改。 */\nexport const MARKER_SVGS: Record<string, string> = ${JSON.stringify(sources, null, 2)}\n`
fs.writeFileSync(path.join(root, 'src/lib/point-marker-svgs.ts'), module)
console.log(`generated ${DEVICE_TYPES.length} markers → public/point-markers, src/lib/point-marker-svgs.ts`)
