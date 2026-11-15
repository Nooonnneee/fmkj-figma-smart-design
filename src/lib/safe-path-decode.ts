/**
 * 安全解码一个 URL 路径片段。
 *
 * 为什么单独一个纯函数：Next 16 的路由匹配层在调用 route handler **之前**
 * 就会对动态段做 `decodeURIComponent`（`next/dist/shared/lib/router/utils/route-matcher.js`），
 * 畸形编码（`%E0%A4%A`、`%FF`、`%`、`%zz`）会在那里抛 `DecodeError`，
 * 请求根本到不了 handler。唯一的拦截点是 `src/proxy.ts`，而 proxy 不能为了一个
 * 解码函数去 import 整条业务链（crypto / payload / url-guard），所以放在这里。
 *
 * 返回 null 表示「这段编码本身非法」，调用方按「资源不存在」处理，
 * 不要回 400 —— 400 会泄露「编码非法」与「编码合法但不存在」的差异。
 */
export function decodePathSegment(raw: string): string | null {
  try {
    return decodeURIComponent(raw)
  } catch {
    return null
  }
}
