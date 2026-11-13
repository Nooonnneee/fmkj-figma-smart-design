/**
 * 站点对外地址（不带尾部斜杠）。
 *
 * 三个环境变量各有来历，别只认一个：
 * - `PUBLIC_URL`：自托管部署的真相，Dockerfile 构建期就烧进产物（compose 强制要求）
 * - `FIGMA_PUBLIC_URL`：Figma Make 预览环境注入
 * - `NEXT_PUBLIC_SITE_URL`：手动覆盖，优先级放在 PUBLIC_URL 之后以免误伤生产
 *
 * 2026-11-14 之前 layout / page / robots / sitemap 各自写了一份，**都没读 PUBLIC_URL**：
 * 生产上 metadataBase 退回 http://localhost:3000，分享到微信/微博的 OG 图全指向本机。
 */
export function siteUrl(fallback = 'https://fmkj.top'): string {
  const raw =
    process.env.PUBLIC_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.FIGMA_PUBLIC_URL ||
    fallback
  return raw.replace(/\/+$/, '')
}
