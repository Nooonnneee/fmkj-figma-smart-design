/**
 * 把工作台里体积较大的静态图批量转成 WebP（保留原图，不删源文件）。
 *
 * 处理范围：
 *   public/proposal/photos/*.jpg        → 同名 .webp（最长边 1600、q80，deck/导出用）
 *                                        + thumbs/<同名>.webp（最长边 720，模板卡用）
 *   public/proposal/photos/scenes/*.jpg → 同名 .webp（最长边 1600、q80）
 *   public/tool-covers/*.jpg            → 同名 .webp（最长边 1600、q80）
 *   public/doc-styles/*.png             → 同名 .webp（宽 600、q80，模板中心卡片用）
 *
 * 可重复执行：源文件未更新且目标已存在时跳过；`--force` 强制全部重转。
 *
 *   node scripts/generate-webp-images.mjs [--force]
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const QUALITY = 80
const force = process.argv.includes('--force')

const JOBS = [
  { dir: 'public/proposal/photos', ext: /\.jpe?g$/i, edge: 1600, thumbs: true },
  { dir: 'public/proposal/photos/scenes', ext: /\.jpe?g$/i, edge: 1600 },
  { dir: 'public/tool-covers', ext: /\.jpe?g$/i, edge: 1600 },
  // 文档样张在模板中心只显示约 360px 宽；600px 够 1.5x 屏，整页能压到 500KB 内。
  { dir: 'public/doc-styles', ext: /\.png$/i, edge: 600 },
]

const webpPath = (file) => file.replace(/\.(jpe?g|png)$/i, '.webp')

async function render(file, out, maxEdge, resizeBy = 'edge') {
  const [srcStat, outStat] = await Promise.all([
    fs.stat(file),
    fs.stat(out).catch(() => null),
  ])
  if (!force && outStat && outStat.mtimeMs >= srcStat.mtimeMs) return 'skipped'

  const resize =
    resizeBy === 'width'
      ? { width: maxEdge }
      : { width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true }

  await sharp(file).rotate().resize(resize).webp({ quality: QUALITY, effort: 6 }).toFile(out)
  return 'converted'
}

const results = []
for (const job of JOBS) {
  const dir = path.join(ROOT, job.dir)
  let entries
  try {
    entries = await fs.readdir(dir)
  } catch {
    continue
  }

  const thumbDir = job.thumbs ? path.join(dir, 'thumbs') : null
  if (thumbDir) await fs.mkdir(thumbDir, { recursive: true })

  for (const name of entries.filter((n) => job.ext.test(n)).sort()) {
    const file = path.join(dir, name)
    const full = webpPath(file)
    results.push({ out: full, src: file, status: await render(file, full, job.edge) })

    if (thumbDir) {
      const thumb = path.join(thumbDir, path.basename(webpPath(file)))
      results.push({
        out: thumb,
        src: file,
        status: await render(file, thumb, 720),
      })
    }
  }
}

let totalBefore = 0
let totalAfter = 0
for (const r of results) {
  const [before, after] = await Promise.all([
    fs.stat(r.src).then((s) => s.size),
    fs.stat(r.out).then((s) => s.size),
  ])
  totalBefore += before
  totalAfter += after
  const pct = before ? Math.round((1 - after / before) * 100) : 0
  console.log(
    `${r.status.padEnd(9)} ${path.relative(ROOT, r.out)}  ${Math.round(before / 1024)}KB → ${Math.round(after / 1024)}KB (-${pct}%)`,
  )
}
const converted = results.filter((r) => r.status === 'converted').length
console.log(
  `\n${results.length} outputs, ${converted} converted. Source ${Math.round(totalBefore / 1024)}KB → WebP ${Math.round(totalAfter / 1024)}KB (-${Math.round((1 - totalAfter / totalBefore) * 100)}%)`,
)
