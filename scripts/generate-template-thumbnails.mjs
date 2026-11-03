/**
 * 自动从 /templates/<slug>/slides 渲染并生成静态封面缩略图（public/proposal-templates/<slug>.jpg）。
 *
 * 页面内选择器与 /templates 模板库默认使用实时组件渲染（改模板立即生效，无需运行此脚本）；
 * 当需要更新分享卡片（OG Image）或小程序静态缩略图时，运行：
 *   pnpm run templates:thumbs
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const port = process.env.PORT || 3000
const baseUrl = process.env.TEMPLATE_BASE_URL || `http://localhost:${port}`
const chromium = process.env.CHROMIUM_PATH || '/usr/bin/chromium'
const outDir = path.resolve('public/proposal-templates')
fs.mkdirSync(outDir, { recursive: true })

const knowledgePath = path.resolve('knowledge/proposal-templates.json')
const slugs = fs.existsSync(knowledgePath)
  ? JSON.parse(fs.readFileSync(knowledgePath, 'utf8')).templates.map((t) => t.slug)
  : ['qixu', 'noir', 'grove', 'quick', 'azure', 'mono', 'dawn', 'jade', 'construction']

for (const slug of slugs) {
  const tmpPng = `/tmp/tpl-thumb-${slug}.png`
  const targetUrl = `${baseUrl}/templates/${encodeURIComponent(slug)}/slides`
  const isConstruction = slug === 'construction'
  const winSize = isConstruction ? '1123,794' : '1440,960'
  execFileSync(
    chromium,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--hide-scrollbars',
      `--window-size=${winSize}`,
      '--virtual-time-budget=12000',
      `--screenshot=${tmpPng}`,
      targetUrl,
    ],
    { stdio: 'ignore', timeout: 90_000 },
  )
  const outJpg = path.join(outDir, `${slug}.jpg`)
  await sharp(tmpPng)
    .resize({ width: 900, height: 600, fit: 'cover', position: 'north' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(outJpg)
  fs.rmSync(tmpPng, { force: true })
  console.log(`${slug}.jpg (${fs.statSync(outJpg).size} bytes)`)
}
