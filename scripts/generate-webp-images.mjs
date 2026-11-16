/**
 * 把工作台里体积较大的 JPG 静态图批量转成 WebP（保留原 JPG，不删源文件）。
 *
 * 处理范围：
 *   public/proposal/photos/*.jpg
 *   public/proposal/photos/scenes/*.jpg
 *   public/tool-covers/*.jpg
 *
 * 规则：
 *   - 同名 `.webp`：最长边不超过 1600px、quality 80、不写元数据（deck/导出用）。
 *   - 根目录照片另外生成 `thumbs/<同名>.webp`：最长边 720px（模板卡缩略图用，
 *     避免列表页把 1400px 大图整张拉下来）。
 *
 * 可重复执行：源文件未更新且目标已存在时跳过；`--force` 强制全部重转。
 *
 *   node scripts/generate-webp-images.mjs [--force]
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const DIRS = ['public/proposal/photos', 'public/proposal/photos/scenes', 'public/tool-covers']
const MAX_EDGE = 1600
/** 模板库卡片在 1440 宽的 3 列网格里约 300px 宽，720px 够 2x 屏。 */
const THUMB_EDGE = 720
const QUALITY = 80
const force = process.argv.includes('--force')

const isJpg = (name) => /\.jpe?g$/i.test(name)

function webpPath(file) {
  return file.replace(/\.jpe?g$/i, '.webp')
}

async function render(file, out, maxEdge) {
  const [srcStat, outStat] = await Promise.all([
    fs.stat(file),
    fs.stat(out).catch(() => null),
  ])
  if (!force && outStat && outStat.mtimeMs >= srcStat.mtimeMs) return 'skipped'

  await sharp(file)
    .rotate()
    .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY, effort: 6 })
    .toFile(out)
  return 'converted'
}

const results = []
for (const rel of DIRS) {
  const dir = path.join(ROOT, rel)
  let entries
  try {
    entries = await fs.readdir(dir)
  } catch {
    continue
  }

  // 根目录照片额外出一份小图给模板卡；scenes / tool-covers 只出全尺寸。
  const thumbDir = rel === 'public/proposal/photos' ? path.join(dir, 'thumbs') : null
  if (thumbDir) await fs.mkdir(thumbDir, { recursive: true })

  for (const name of entries.filter(isJpg).sort()) {
    const file = path.join(dir, name)
    const full = webpPath(file)
    results.push({ out: full, status: await render(file, full, MAX_EDGE), src: file })

    if (thumbDir) {
      const thumb = path.join(thumbDir, path.basename(webpPath(file)))
      results.push({ out: thumb, status: await render(file, thumb, THUMB_EDGE), src: file })
    }
  }
}

const bySize = async (r) => ({
  before: (await fs.stat(r.src)).size,
  after: (await fs.stat(r.out)).size,
})

let totalBefore = 0
let totalAfter = 0
for (const r of results) {
  const { before, after } = await bySize(r)
  totalBefore += before
  totalAfter += after
  const pct = before ? Math.round((1 - after / before) * 100) : 0
  console.log(
    `${r.status.padEnd(9)} ${path.relative(ROOT, r.out)}  ${Math.round(before / 1024)}KB → ${Math.round(after / 1024)}KB (-${pct}%)`,
  )
}
const converted = results.filter((r) => r.status === 'converted').length
console.log(
  `\n${results.length} outputs, ${converted} converted. JPEG ${Math.round(totalBefore / 1024)}KB → WebP ${Math.round(totalAfter / 1024)}KB (-${Math.round((1 - totalAfter / totalBefore) * 100)}%)`,
)
