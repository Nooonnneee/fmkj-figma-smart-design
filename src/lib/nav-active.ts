/**
 * 侧边栏「当前在哪一页」的判定。
 *
 * 只有最长匹配的那一条算激活 —— 否则父级入口会跟子路由一起亮：
 * `/ai` 是 `/ai/image` 的前缀、`/capabilities` 是 `/capabilities/templates` 的前缀，
 * 于是站在 `/capabilities/templates` 时「能力中心」和「模板中心」同时高亮，
 * `/ai/image` 时「AI 对话」和「AI 生图」同时高亮。
 * 2026-11-14 用户报的「点了能力中心的选项一直是点击状态，切换也还是」就是这个。
 *
 * 边界用 `${url}/` 而不是裸前缀，避免 `/ai` 匹配到将来的 `/aii`。
 */
export function activeNavUrl(pathname: string, urls: readonly string[]): string | null {
  let best: string | null = null
  for (const url of urls) {
    if (pathname !== url && !pathname.startsWith(`${url}/`)) continue
    if (!best || url.length > best.length) best = url
  }
  return best
}
