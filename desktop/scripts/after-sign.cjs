// electron-builder afterSign 钩子（在打包成 dmg/zip 之前执行）。
// 没有 Apple 开发者证书时，为 macOS 应用做 ad-hoc 签名：否则修改过的 Electron 包签名失效，
// Apple 芯片电脑会提示「已损坏，无法打开」。已用开发者证书正式签名时不做任何事。
const { execFileSync } = require('node:child_process')
const path = require('node:path')

exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)

  if (process.platform === 'darwin') {
    try {
      execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'ignore' })
      return // 已有有效签名
    } catch {
      console.log(`  • 未检测到有效签名，执行 ad-hoc 签名：${appPath}`)
      execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' })
      return
    }
  }

  // 在 Linux 上交叉打包 macOS 版本：使用 rcodesign（https://github.com/indygreg/apple-platform-rs）
  const rcodesign = process.env.RCODESIGN || 'rcodesign'
  try {
    execFileSync(rcodesign, ['--version'], { stdio: 'ignore' })
  } catch {
    console.warn('  • 未找到 rcodesign，跳过 ad-hoc 签名（建议在 macOS 上打包 macOS 版本）')
    return
  }
  console.log(`  • 使用 rcodesign 执行 ad-hoc 签名：${appPath}`)
  execFileSync(rcodesign, ['sign', appPath], { stdio: 'inherit' })
}
