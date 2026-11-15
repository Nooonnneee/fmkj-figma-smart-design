import {
  AiChannelInputError,
  createChannel,
  deleteChannel,
  listChannels,
  testChannel,
  updateChannel,
  type ChannelInputBody,
  type PayloadLike,
} from '@/lib/ai-channels'
import { ChannelUrlError } from '@/lib/ai-channels-url-guard'

/**
 * 成员 AI 渠道端点的 HTTP 层。
 *
 * 为什么单独一个文件、而不是这几个端点直接写在 Next 的 route.ts 里：
 * - 这样测试可以拿真实的请求处理逻辑跑（注入假的 payload），而不是只测服务层；
 * - 但 route.ts 只能导出 HTTP 方法（Next 会校验导出名），所以逻辑不能放 route 里。
 *
 * 为什么不做成 `users` 集合的自定义 endpoint（像 `ai-settings-endpoints.ts` 那样）：
 * `ai-settings` 是全局、只给 CMS 超管；如果混进去，权限判断一眼看过去都是
 * `isCmsAdmin`，很容易顺手写错成后台权限。更要紧的一条：Payload 集合端点的身份
 * 依赖 `payload-token` Cookie / `Authorization: JWT`，而本站成员登录用的是
 * `appAuth`（`app-session` Cookie）。放在 `/api/ai/channels` 这个 Next 路由里，
 * 可以和站内其它成员接口一样用 `appAuth.getCurrentUser()`，只认登录会话。
 *
 * 安全铁律：这里的 `userId` **只由 route.ts 从 `req.user` 传入**，请求体里任何
 * `userId` / `id` 字段都会被 `pickInput` 丢弃。
 */

export type ChannelsContext = { userId: string; payload: PayloadLike }
const json = (data: unknown, status = 200) => Response.json(data, { status })

/**
 * CSRF 校验：只对 `/api/ai/channels*` 这几个端点生效（不动全局，避免牵动别的路由）。
 *
 * 会话 Cookie 是 `SameSite=lax`，它挡不住顶层表单导航，也挡不住
 * `Content-Type: text/plain` 的「简单请求」——复核实测跨站带 Origin 的 POST 直接 201。
 * 这里的原则是**有 Origin 就必须是同站**：
 * - 带 `Origin` 且主机与请求 `Host` 不一致 → 403；
 * - 没有 `Origin` 时退回看 `Sec-Fetch-Site`：`cross-site` → 403；
 * - 两者都没有（curl / 服务间调用）→ 放行。这类请求本来就不带浏览器会话 Cookie 的
 *   「自动附带」特性，CSRF 的前提不成立；真正的身份仍由 app-session 决定。
 *
 * **为什么只认 `Host`、故意不认 `X-Forwarded-Host`**：XFH 是客户端可以自己带的请求头，
 * 只有当「前置代理一定会把它覆盖/剥掉」时才可信。复核实测 `Origin: https://evil.example.com`
 * + `X-Forwarded-Host: evil.example.com` 能 201 放行；今天 nginx 示例不转发 XFH、浏览器也
 * 加不了，但将来代理原样转发就会变成绕过。本仓库的部署拓扑（`deploy/DEPLOY.md` 的 nginx
 * `proxy_set_header Host $host`、主站 Caddy 默认透传 Host）都能让应用看到真实 Host，
 * 所以直接不认 XFH 是更小、更确定的攻击面。
 *
 * 部署前提（已写进 `deploy/DEPLOY.md` 第 6 节）：**代理必须原样传 Host**。若代理把 Host
 * 改写成内网地址（如 127.0.0.1:3000）又只把域名放进 XFH，写渠道会被误判为跨站并 403。
 */
export function checkSameOrigin(request: Request): { ok: true } | { ok: false; error: string } {
  const selfHosts = new Set<string>()
  const rawHost = request.headers.get('host')
  if (rawHost) {
    // 多值形态（`a, b`）在 Host 上不常见，仍按逗号拆开，行为和旧实现一致。
    for (const part of rawHost.split(',')) {
      const host = part.trim().toLowerCase()
      if (host) selfHosts.add(host)
    }
  }

  const origin = request.headers.get('origin')
  if (origin) {
    let originHost: string
    try {
      originHost = new URL(origin).host.toLowerCase()
    } catch {
      return { ok: false, error: '请求来源无效' }
    }
    // 没有 Host 头（罕见的非浏览器客户端）时不因此拒绝，交给会话校验。
    if (selfHosts.size > 0 && !selfHosts.has(originHost)) {
      return { ok: false, error: '跨站请求已被拒绝' }
    }
    return { ok: true }
  }

  const site = request.headers.get('sec-fetch-site')
  if (site && site.toLowerCase() === 'cross-site') {
    return { ok: false, error: '跨站请求已被拒绝' }
  }
  return { ok: true }
}

/** route.ts 的统一入口：先过 CSRF，不通过直接 403。 */
export function rejectCrossOrigin(request: Request): Response | null {
  const result = checkSameOrigin(request)
  return result.ok ? null : json({ ok: false, error: result.error }, 403)
}

/**
 * 解出 URL 里的 `:key`。Next 给的是路径里的原始片段，可能含畸形百分号编码
 * （`%E0%A4%A`、`%FF`）——`decodeURIComponent` 对它们抛 `URIError`。
 * 这个函数必须**返回 null 而不是抛错**：以前解码在 `handle*` 的 try 之外，
 * 异常一路冒到 Next，变成 500 HTML，客户端拿不到「渠道不存在」。
 *
 * 非法编码按「不存在」处理（404，而不是 400）：400 会泄露「这个 key 编码合法但不属于你」
 * 与「编码本身非法」的差异，404 与正常找不到的响应完全一致。
 */
export function decodeChannelKeyParam(raw: string): string | null {
  try {
    return decodeURIComponent(raw)
  } catch {
    return null
  }
}

/**
 * 与 `updateChannel` / `deleteChannel` / `testChannel` 抛出的 404 **逐字节一致**：
 * `{ ok: false, error: '找不到这个渠道' }`。测试会拿真实调用做形状对比，避免两处漂移。
 */
export function channelNotFoundResponse(): Response {
  return json({ ok: false, error: '找不到这个渠道' }, 404)
}

export async function readJsonBody(request: Request): Promise<ChannelInputBody> {
  try {
    const raw = (await request.json()) as unknown
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    // 只挑白名单字段：`userId`、`lastCheckOk` 之类即使传了也进不来。
    const src = raw as Record<string, unknown>
    return {
      key: src.key,
      label: src.label,
      baseUrl: src.baseUrl,
      apiKey: src.apiKey,
      models: src.models,
      enabled: src.enabled,
    }
  } catch {
    return {}
  }
}

/** 统一错误映射：业务错误带自己的状态码，其余一律 500 且不把内部细节回给前端。 */
function toResponse(error: unknown): Response {
  if (error instanceof AiChannelInputError)
    return json({ ok: false, error: error.message }, error.status)
  if (error instanceof ChannelUrlError) return json({ ok: false, error: error.message }, 400)
  console.error('[ai-channels] unexpected error', (error as Error)?.name ?? 'unknown')
  return json({ ok: false, error: '操作失败，请稍后重试' }, 500)
}

/** GET /api/ai/channels */
export async function handleListChannels(ctx: ChannelsContext): Promise<Response> {
  try {
    return json({ ok: true, channels: await listChannels(ctx.payload, ctx.userId) })
  } catch (error) {
    return toResponse(error)
  }
}

/** POST /api/ai/channels */
export async function handleCreateChannel(
  ctx: ChannelsContext,
  body: ChannelInputBody,
): Promise<Response> {
  try {
    return json({ ok: true, channel: await createChannel(ctx.payload, ctx.userId, body) }, 201)
  } catch (error) {
    return toResponse(error)
  }
}

/** PATCH /api/ai/channels/:key */
export async function handleUpdateChannel(
  ctx: ChannelsContext,
  channelKey: string,
  body: ChannelInputBody,
): Promise<Response> {
  try {
    return json({
      ok: true,
      channel: await updateChannel(ctx.payload, ctx.userId, channelKey, body),
    })
  } catch (error) {
    return toResponse(error)
  }
}

/** DELETE /api/ai/channels/:key */
export async function handleDeleteChannel(
  ctx: ChannelsContext,
  channelKey: string,
): Promise<Response> {
  try {
    await deleteChannel(ctx.payload, ctx.userId, channelKey)
    return json({ ok: true })
  } catch (error) {
    return toResponse(error)
  }
}

/** POST /api/ai/channels/:key/test */
export async function handleTestChannel(
  ctx: ChannelsContext,
  channelKey: string,
  fetchImpl?: Parameters<typeof testChannel>[3],
): Promise<Response> {
  try {
    return json({
      ok: true,
      result: await testChannel(ctx.payload, ctx.userId, channelKey, fetchImpl),
    })
  } catch (error) {
    return toResponse(error)
  }
}
