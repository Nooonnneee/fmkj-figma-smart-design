/**
 * 判断请求是否来自「繁梦空间」桌面客户端。
 *
 * 客户端在 `desktop/src/main.js` 里给自己追加了 UA 标记：
 *   app.userAgentFallback = `${app.userAgentFallback} FanmengSpaceDesktop/${app.getVersion()}`
 *
 * ⚠️ 这不是安全边界。
 * UA 是客户端**自己声明的**，任何人都能伪造（浏览器插件、curl、改一行代码都行）。
 * 它的唯一用途是产品口径：桌面客户端里显示「我的 AI 配置」入口，网页/小程序里不显示。
 *
 * 真正的权限来自「这个账号里有没有配好合法的加密渠道」——服务端只认
 * `req.user` 与库里的记录，**绝不**用 UA 决定谁能用自填 key。
 */
const DESKTOP_UA_RE = /\bFanmengSpaceDesktop\/(\d+(?:\.\d+)*)/i

/** 从 User-Agent 提取客户端版本号；不是桌面客户端返回 null。 */
export function desktopClientVersion(userAgent: string | null | undefined): string | null {
  if (typeof userAgent !== 'string' || userAgent.length === 0) return null
  const m = DESKTOP_UA_RE.exec(userAgent)
  return m ? m[1] : null
}

/** 是否桌面客户端（只用于隐藏/显示入口，不用于权限判断）。 */
export function isDesktopClient(userAgent: string | null | undefined): boolean {
  return desktopClientVersion(userAgent) !== null
}
