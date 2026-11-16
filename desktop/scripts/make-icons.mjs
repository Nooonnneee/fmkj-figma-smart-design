// 由品牌应用图标生成桌面端图标：
//   resources/icon-win.png  1024×1024 满版圆角（electron-builder 自动转成 .ico）
//   resources/icon-mac.png  1024×1024，按 macOS 图标网格四周留边并加投影（自动转成 .icns）
//   src/renderer/icon.svg   离线页、服务器设置页使用
// 源图默认是网页品牌图标 public/brand/fmkj-app-icon.svg；
// 也可以用 ICON_SRC 指定 PNG（例如 resources/mascot/eevee-icon.png）。
// 依赖仓库根目录已安装的 sharp：在仓库根目录执行 `node desktop/scripts/make-icons.mjs`
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(desktopDir, '..')
const sharp = createRequire(path.join(repoRoot, 'package.json'))('sharp')

const sourceArg = process.env.ICON_SRC || 'public/brand/fmkj-app-icon.svg'
const resolveSource = () => {
  if (path.isAbsolute(sourceArg)) return sourceArg
  // 同时支持在仓库根目录和 desktop 目录下执行
  for (const base of [repoRoot, desktopDir]) {
    const candidate = path.resolve(base, sourceArg)
    if (existsSync(candidate)) return candidate
  }
  return path.resolve(repoRoot, sourceArg)
}
const source = resolveSource()
const isSvg = path.extname(source).toLowerCase() === '.svg'
const input = readFileSync(source)

// SVG 先按 2 倍分辨率渲染再缩小，边缘更平滑；位图直接按目标尺寸缩放
const render = (size) =>
  (isSvg ? sharp(input, { density: (72 * size * 2) / 1024 }) : sharp(input))
    .resize(size, size, { kernel: 'lanczos3' })
    .png()

const winPng = await render(1024).toBuffer()
await sharp(winPng).toFile(path.join(desktopDir, 'resources/icon-win.png'))

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

// 页面里引用的是 icon.svg。SVG 源图直接拷贝；位图源图则真正包成内嵌 base64 的 SVG，
// 不能留下一个扩展名是 .svg、内容其实是 PNG 的文件。
const iconSvgPath = path.join(desktopDir, 'src/renderer/icon.svg')
if (isSvg) {
  copyFileSync(source, iconSvgPath)
} else {
  const wrapper = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><image width="1024" height="1024" href="data:image/png;base64,${winPng.toString('base64')}"/></svg>\n`
  writeFileSync(iconSvgPath, wrapper)
}
console.log('已生成 resources/icon-win.png、resources/icon-mac.png、src/renderer/icon.svg')
