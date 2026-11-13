/**
 * 站点对外地址（不带尾部斜杠）。
 *
 * 三个环境变量各有来历，别只认一个：
 * - `PUBLIC_URL`：自托管部署的真相，Dockerfile 构建期烧进产物，compose 强制要求
 * - `FIGMA_PUBLIC_URL`：Figma Make 预览环境注入
 * - `NEXT_PUBLIC_SITE_URL`：`next.config.ts` 在构建期由上面两个算出来的派生值
 *
 * 收敛原因：layout / page / robots / sitemap 原本各写一份，四处容易走偏。
 * 这里统一成一份，并显式把 `PUBLIC_URL` 放在最前面。
 *
 * ⚠️ 别把它当 bug 修复用：2026-11-14 曾以为生产分享图指向 localhost，**实测是误判** ——
 * 线上 canonical / og:image 一直是 `https://fmkj.top/...`（`next.config.ts` 在构建期
 * 早就把 `PUBLIC_URL` 算进了 `NEXT_PUBLIC_SITE_URL`）。
 *
 * 启动日志里那条 `metadataBase ... using "http://localhost:3000"` 在改动前后**一字不差**，
 * 它来自启动期某个没声明 metadataBase 的 metadata 导出（最可能是 Payload 后台这个
 * 平台托管目录，不归我们改），与官网页面无关。复现：重启容器看头几行日志。
 */
export function siteUrl(fallback = 'https://fmkj.top'): string {
  const raw =
    process.env.PUBLIC_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.FIGMA_PUBLIC_URL ||
    fallback
  return raw.replace(/\/+$/, '')
}
