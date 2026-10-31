// 由品牌应用图标（public/brand/fmkj-app-icon.svg）生成桌面端图标：
//   resources/icon-win.png  1024×1024 满版圆角（electron-builder 自动转成 .ico）
//   resources/icon-mac.png  1024×1024，按 macOS 图标网格四周留边并加投影（自动转成 .icns）
//   src/renderer/icon.svg   离线页、服务器设置页使用
// 依赖仓库根目录已安装的 sharp：在仓库根目录执行 `node desktop/scripts/make-icons.mjs`
import { copyFileSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(desktopDir, '..')
const sharp = createRequire(path.join(repoRoot, 'package.json'))('sharp')

const source = path.join(repoRoot, 'public/brand/fmkj-app-icon.svg')
const svg = readFileSync(source)

// 先按 2 倍分辨率渲染再缩小，边缘更平滑
const render = (size) => sharp(svg, { density: (72 * size * 2) / 1024 }).resize(size, size, { kernel: 'lanczos3' }).png()

await render(1024).toFile(path.join(desktopDir, 'resources/icon-win.png'))

const BODY = 824 // macOS 图标主体 824×824，四周各留 100px
const OFFSET = (1024 - BODY) / 2
const radius = BODY * (229.0688 / 1024)
const shadow = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><defs><filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter></defs><rect x="${OFFSET}" y="${OFFSET + 12}" width="${BODY}" height="${BODY}" rx="${radius}" fill="#000" fill-opacity="0.32" filter="url(#s)"/></svg>`,
)
const body = await render(BODY).toBuffer()
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: shadow }, { input: body, left: OFFSET, top: OFFSET }])
  .png()
  .toFile(path.join(desktopDir, 'resources/icon-mac.png'))

copyFileSync(source, path.join(desktopDir, 'src/renderer/icon.svg'))
console.log('已生成 resources/icon-win.png、resources/icon-mac.png、src/renderer/icon.svg')
