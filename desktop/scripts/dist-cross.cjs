// 在 Linux（没有 wine 的服务器或容器）上交叉打包 Windows 安装包和 macOS ZIP。
//
// electron-builder 生成 NSIS 卸载程序时：Windows 上直接运行安装器、macOS 10.15+ 上用纯 JS 的
// UninstallerReader 从安装器中提取、Linux 上则依赖 wine。这里让 Linux 也走 UninstallerReader
// 分支（app-builder-lib 里只有这一处用到该判断），其余流程与官方命令完全相同。
// exe 图标与版本信息由 electron-builder 内置的纯 JS 资源编辑器写入，不需要 wine。
//
// 用法：node scripts/dist-cross.cjs --win --publish never
//       node scripts/dist-cross.cjs --mac zip --arm64 --x64 --publish never   （需要 rcodesign 做 ad-hoc 签名）
const macosVersion = require('app-builder-lib/out/util/macosVersion')

if (process.platform === 'linux') macosVersion.isMacOsCatalina = () => true

require('electron-builder/cli.js')
