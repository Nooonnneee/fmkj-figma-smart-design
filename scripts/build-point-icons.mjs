/**
 * 点位图标（最终映射）：scripts/point-icons/mapping.json → 画板、点位面板、导出文档、图例共用的一套图标。
 *
 * 用法：node scripts/build-point-icons.mjs
 * 输出：
 *  - public/point-icons/<设备类型>.png（256px）与 .sm.png（64px）：画板与面板使用
 *  - src/board/packs/smart-home/point-icons.generated.ts：主体比例 + 96px 内嵌图（导出 PDF / 图例用，不发请求）
 * 处理：裁掉透明边 → 主体居中，四周留白 = 主体长边 × PAD（与画板符号一致）。
 * mapping 里的 hidden 类型跳过（沿用原图标）；custom 条目按 CUSTOM_TYPES 换成正式设备类型。
 * 改了素材或参数后把 VERSION 加一，让浏览器重新加载。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const VERSION = 1
const PAD = 0.1
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'scripts/point-icons')
const OUT = path.join(ROOT, 'public/point-icons')
const GEN = path.join(ROOT, 'src/board/packs/smart-home/point-icons.generated.ts')
/** 自定义条目 → 正式设备类型 */
const CUSTOM_TYPES = { 'custom-1793550513224': 'ceiling-ap' }

const mapping = JSON.parse(fs.readFileSync(path.join(SRC, 'mapping.json'), 'utf8'))
const hidden = new Set(mapping.hidden ?? [])
fs.mkdirSync(OUT, { recursive: true })

async function render(file, size) {
  const trimmed = await sharp(file).ensureAlpha().trim({ threshold: 1 }).toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = trimmed.info
  const long = Math.max(w, h)
  const inner = Math.round(size / (1 + 2 * PAD))
  const tw = Math.max(1, Math.round((w / long) * inner))
  const th = Math.max(1, Math.round((h / long) * inner))
  const body = await sharp(trimmed.data).resize(tw, th, { fit: 'fill', kernel: 'lanczos3' }).toBuffer()
  const png = await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: body, left: Math.round((size - tw) / 2), top: Math.round((size - th) / 2) }])
    .png({ compressionLevel: 9, palette: size <= 96 })
    .toBuffer()
  return { png, gw: +(w / long).toFixed(4), gh: +(h / long).toFixed(4) }
}

const geom = {}
const data = {}
for (const [key, a] of Object.entries(mapping.assignments)) {
  const type = CUSTOM_TYPES[key] ?? key
  if (hidden.has(type)) continue
  const file = path.join(SRC, a.path)
  if (!fs.existsSync(file)) {
    console.warn(`skip ${type}: missing ${a.path}`)
    continue
  }
  const big = await render(file, 256)
  fs.writeFileSync(path.join(OUT, `${type}.png`), big.png)
  fs.writeFileSync(path.join(OUT, `${type}.sm.png`), (await render(file, 64)).png)
  geom[type] = { gw: big.gw, gh: big.gh }
  data[type] = `data:image/png;base64,${(await render(file, 96)).png.toString('base64')}`
}

fs.writeFileSync(
  GEN,
  `/** 由 scripts/build-point-icons.mjs 根据 scripts/point-icons/mapping.json 生成，请勿手动修改。 */

export const POINT_ICON_VERSION = ${VERSION}

/** 主体比例（长边 = 1），四周留白与画板符号相同 */
export const POINT_ICON_GEOM: Record<string, { gw: number; gh: number }> = ${JSON.stringify(geom, null, 2)}

/** 96px 内嵌图：导出 PDF / 图例 / 点位图用，避免外链图片在导出时丢失 */
export const POINT_ICON_DATA: Record<string, string> = ${JSON.stringify(data, null, 2)}
`,
)
console.log(`generated ${Object.keys(geom).length} point icons`)
