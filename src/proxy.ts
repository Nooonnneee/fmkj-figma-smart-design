import { NextResponse, type NextRequest } from 'next/server'

import { decodePathSegment } from '@/lib/safe-path-decode'

const AI_CHANNELS_PREFIX = '/api/ai/channels/'

/**
 * 畸形百分号编码的渠道 key 必须在 Next 的路由匹配层之前拦掉。
 *
 * Next 16.4.2 在调用 route handler **之前**就对动态段做 `decodeURIComponent`
 * （`next/dist/shared/lib/router/utils/route-matcher.js`），`%E0%A4%A` / `%FF` / `%` / `%zz`
 * 会直接抛 `DecodeError` → 500 `text/plain`，请求根本走不到 route handler 里的
 * CSRF 校验、`appAuth` 和 `decodeChannelKeyParam`。把兜底放在 route handler 里是错的层。
 *
 * 这里按「渠道不存在」返回 404 + 同一份 JSON，与正常找不到逐字节一致：
 * 不区分「编码非法」和「编码合法但不属于你」，避免泄露 key 的存在性。
 *
 * 注意：`request.nextUrl.pathname` 保留**原始**百分号编码（已实测 `%63%31`
 * 仍是 `%63%31`），所以这里拿到的是可以直接解码的原始片段。
 */
function hasMalformedChannelSegment(pathname: string): boolean {
  const rest = pathname.slice(AI_CHANNELS_PREFIX.length)
  return rest.split('/').some((segment) => decodePathSegment(segment) === null)
}

/**
 * Payload 的 `/api/media/file/:filename` 只注册了 GET（见 payload/dist/uploads/endpoints），
 * **不处理 HEAD** —— 任何 HEAD 请求都会落到 404。
 *
 * 为什么必须补上：GET 返 200 而 HEAD 返 404，属于协议层面的不一致，
 * 会误伤链接检查器、CDN 预取、浏览器预加载、SEO 工具这类只发 HEAD 的调用方；
 * 而 `next.config.ts` 又给这条路径配了长缓存，404 一旦被缓存就极难冲掉
 * （2026-11-09 事故：产品库图片在部分浏览器上一直显示裂图，硬刷新都无效）。
 *
 * 处理方式：转成一次内部 GET，只回传状态码与响应头，丢掉 body —— 这正是 HEAD 的语义。
 */
async function handleMediaHead(request: NextRequest): Promise<Response> {
  const res = await fetch(new URL(request.url), {
    method: 'GET',
    headers: { 'x-media-head-probe': '1' },
    cache: 'no-store',
  })
  const headers = new Headers(res.headers)
  // 这两项与「没有 body」矛盾，按规范不该出现在 HEAD 响应里
  headers.delete('content-length')
  headers.delete('content-encoding')
  return new Response(null, { status: res.status, headers })
}

/**
 * 只给需要登录的工作台页面带上当前地址（请求头 x-pathname）。
 * 未登录时页面据此跳到 /login?from=原地址，登录后回到原页面（见 src/lib/login-redirect.ts）。
 * 不做鉴权判断：每个页面、接口和 Server Action 仍各自校验登录与权限。
 */
export async function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname.startsWith(AI_CHANNELS_PREFIX) &&
    hasMalformedChannelSegment(request.nextUrl.pathname)
  ) {
    return NextResponse.json({ ok: false, error: '找不到这个渠道' }, { status: 404 })
  }

  if (request.method === 'HEAD' && request.nextUrl.pathname.startsWith('/api/media/file/')) {
    try {
      return await handleMediaHead(request)
    } catch {
      // 探测失败就放行，让下游按原样处理 —— 不能因为一个 HEAD 探测而影响正常请求
    }
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname + request.nextUrl.search)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: [
    '/projects/:path*',
    '/products/:path*',
    '/capabilities/:path*',
    '/membership/:path*',
    '/settings/:path*',
    '/ai/:path*',
    '/quotes/:path*',
    // 渠道 key 的畸形编码要在 Next 路由匹配抛 DecodeError 之前拦掉
    '/api/ai/channels/:path*',
    // HEAD 探测：只影响 HEAD 请求（GET 仍由 Payload 直接处理，不走这里）
    '/api/media/file/:path*',
  ],
}
