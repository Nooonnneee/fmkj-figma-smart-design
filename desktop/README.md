# 繁梦空间桌面客户端（Windows / macOS）

基于 Electron 的桌面客户端：用原生窗口加载繁梦空间服务器上的工作台（默认 `https://fmkj.top`）。
客户端不包含业务数据和服务端代码，网站发布的新功能在客户端里立即可用；只有窗口、菜单等原生能力变化时才需要发新版本。

## 功能

- 独立窗口：记住大小和位置，重新打开回到上次的页面；支持多窗口（Ctrl/⌘ + N）
- 中文菜单与快捷键：项目 Ctrl/⌘ + 1、产品库 + 2、插件市场 + 3、会员与积分 + 4、设置 + 5；打印 Ctrl/⌘ + P；在浏览器中打开当前页 Ctrl/⌘ + Shift + O
- 右键菜单：复制粘贴、复制链接、在浏览器中打开、图片另存为（网页自己接管右键时不弹出，如点位图编辑器）
- 下载：弹出保存位置，任务栏 / 程序坞显示进度，完成后通知并可打开所在文件夹
- 离线与维护提示：断网、域名解析失败、502/503/504、页面崩溃时显示提示页，自动重试（15 秒起，逐步拉长到 2 分钟）
- 自动更新：Windows 安装版后台下载、提示重启安装；macOS 版（未签名）发现新版本时引导到下载页
- 服务器设置：私有部署可在「帮助 → 服务器设置」修改地址并测试连接
- 深度链接：`fanmeng://open/projects/123` 直接打开对应页面
- 网站可通过 `window.fanmengDesktop` 或 UA 中的 `FanmengSpaceDesktop/<版本>` 识别客户端（下载页据此显示「检查更新」）

## 安全措施

- 所有窗口开启 `contextIsolation`、`sandbox`，关闭 `nodeIntegration`，并调用 `app.enableSandbox()`
- 只允许在当前服务器和客户端本地页面之间跳转，其它链接（包括服务端重定向）交给系统浏览器，且只放行 http / https / mailto / tel
- 禁止 `<webview>`；`window.open` 只有同一服务器的地址会在客户端窗口里打开
- 权限白名单：只有当前服务器能使用剪贴板、通知、全屏；摄像头、麦克风、定位等一律拒绝
- IPC 校验发送方：只响应当前服务器或本地页面的顶层框架；修改服务器地址只对本地设置页开放
- 证书错误不放行，显示「连接不安全」
- 本地页面使用严格 CSP：`default-src 'none'; script-src 'self'`

## 目录

```
desktop/
├── app-config.json        默认服务器、应用 ID、协议名、更新路径
├── electron-builder.yml   打包配置（Windows NSIS，macOS DMG + ZIP）
├── src/main.js            主进程：窗口、导航限制、离线页、IPC、启动流程
├── src/menu.js            中文菜单        src/context-menu.js  右键菜单
├── src/downloads.js       下载            src/updater.js       自动更新
├── src/security.js        权限白名单      src/preload.js       window.fanmengDesktop
├── src/renderer/          离线页、服务器设置页
├── resources/             图标（scripts/make-icons.mjs 生成）、macOS entitlements
├── scripts/               check 自检、make-icons、after-sign、dist-cross、upload
└── ci/desktop-release.yml GitHub Actions 打包模板
```

## 开发调试

需要 Node.js 20 或更高版本。

```bash
cd desktop
npm install
npm run check   # 语法检查、单元测试、配置一致性（不需要启动 Electron）
npm run dev     # 连接本机 http://localhost:3000
npm start       # 连接 app-config.json 里的默认服务器
```

也可以临时指定服务器：`npx electron . --server-url=https://测试服务器`。

## 打包

发版前先修改 `package.json` 的 `version`（x.y.z）。客户端版本号与网站无关。

| 平台 | 在哪台电脑上 | 命令 | 产物（`release/`） |
| --- | --- | --- | --- |
| Windows | Windows | `npm run dist:win` | `FanmengSpace-Setup-<版本>.exe`、`.blockmap`、`latest.yml` |
| macOS | Mac | `npm run dist:mac` | `FanmengSpace-<版本>-mac-arm64.dmg` / `-x64.dmg`、对应 `.zip`、`latest-mac.yml` |
| Windows | Linux（不需要 wine） | `npm run dist:cross:win` | 同上 |
| macOS | Linux（需要 [rcodesign](https://github.com/indygreg/apple-platform-rs)） | `RCODESIGN=/路径/rcodesign npm run dist:cross:mac` | 只有 `.zip`（DMG 只能在 Mac 上制作） |

品牌图标更新后重新生成：在仓库根目录 `pnpm install` 后执行 `node desktop/scripts/make-icons.mjs`。

## 代码签名（可选，正式推广前建议完成）

- Windows：购买代码签名证书（OV / EV），设置 `CSC_LINK`（.pfx 路径或 base64）和 `CSC_KEY_PASSWORD` 后打包，可消除或减少 SmartScreen 提示。
- macOS：使用 Apple 开发者账号的「Developer ID Application」证书签名并公证，设置 `CSC_LINK`、`CSC_KEY_PASSWORD`、`APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID`。签名后可以在 `src/updater.js` 中为 macOS 打开自动安装更新。
- 未签名时：Windows 首次运行点「更多信息 → 仍要运行」；macOS 在「系统设置 → 隐私与安全性」点「仍要打开」（下载页已写明步骤）。没有开发者证书时会自动做 ad-hoc 签名（`scripts/after-sign.cjs`），避免 Apple 芯片提示「已损坏」。

## 发布

1. 打包，得到 `release/` 下的文件。
2. 上传到服务器的 `desktop-releases/`：`sh scripts/upload.sh 用户@服务器:/项目目录/desktop-releases`（先传安装包，最后传 `latest*.yml`）。
3. 网站 `/download` 自动显示新版本；固定下载地址：`/downloads/desktop/latest/windows`、`/latest/mac-arm64`、`/latest/mac-x64`。
4. 已安装的 Windows 客户端会在启动 20 秒后、以及每 6 小时检查一次更新。

服务器端配置见 `deploy/DEPLOY.md` 第 9 节。

## GitHub Actions（可选）

`ci/desktop-release.yml` 会在 GitHub 的 Windows、macOS 机器上自动打包（包括 DMG）。把它复制到仓库的 `.github/workflows/` 后，推送 `desktop-v1.0.1` 这样的标签，即可在 Releases 中得到安装包。推送工作流文件需要账号或 Token 具有 Workflows 权限。
