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
