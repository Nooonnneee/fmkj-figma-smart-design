import type { Endpoint, PayloadRequest } from 'payload'

import { isCmsAdmin } from '@/lib/access'
import { AI_PROVIDER_CHANNELS, isAiProviderChannelId, parseCustomChannels } from '@/plugins/ai-copilot/templates'
import { resolveModelEndpoint } from '@/plugins/ai-copilot/server'

type Body = { channelId?: string; customChannel?: string; models?: string[] }

async function readBody(req: PayloadRequest): Promise<Body> {
  try {
    return ((await req.json?.()) ?? {}) as Body
  } catch {
    return {}
  }
}

/** 按渠道解析接口地址与密钥（自定义渠道只认已保存、已校验的配置，不接受请求里传来的地址或变量名） */
async function resolveChannel(req: PayloadRequest, body: Body) {
  if (body.channelId === 'custom') {
    const g = await req.payload.findGlobal({ slug: 'ai-settings', depth: 0, overrideAccess: true })
    const ch = parseCustomChannels((g as { customChannels?: unknown }).customChannels).find((c) => c.key === body.customChannel)
    if (!ch) return { error: '找不到这个自定义渠道：请先在上方填写并保存渠道' }
    const ep = resolveModelEndpoint({ channelId: 'custom', baseUrl: ch.baseUrl, apiKeyEnv: ch.apiKeyEnv })
    return { ...ep, label: ch.label, customChannel: ch.key }
  }
  if (!isAiProviderChannelId(body.channelId)) return { error: '请选择渠道' }
  const ep = resolveModelEndpoint({ channelId: body.channelId })
  return { ...ep, label: AI_PROVIDER_CHANNELS[body.channelId].label, customChannel: undefined }
}

const json = (data: unknown, status = 200) => Response.json(data, { status })

export const aiSettingsEndpoints: Endpoint[] = [
  {
    // 拉取渠道的模型列表（OpenAI 兼容 GET /models）
    path: '/models',
    method: 'post',
    handler: async (req) => {
      if (!isCmsAdmin(req)) return json({ error: '无权限' }, 403)
      const body = await readBody(req)
      const ch = await resolveChannel(req, body)
      if ('error' in ch) return json({ error: ch.error }, 400)
      if (!ch.url) return json({ error: '接口地址未配置或不是公网 HTTPS' }, 400)
      if (!ch.apiKey) return json({ error: `没有读到密钥：请在 Figma Make「设置 → Secrets」中添加 ${ch.envKey}` }, 400)
      const url = ch.url.replace(/\/chat\/completions$/, '/models')
      try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${ch.apiKey}` }, signal: AbortSignal.timeout(15000) })
        if (!res.ok) return json({ error: `接口返回 ${res.status}：该服务可能不支持 /models，可直接手动添加模型名` }, 502)
        const data = (await res.json()) as { data?: { id?: unknown }[]; models?: { id?: unknown; name?: unknown }[] }
        const list = (data.data ?? data.models ?? []).map((m) => String(m.id ?? (m as { name?: unknown }).name ?? '')).filter(Boolean)
        return json({ models: [...new Set(list)].sort() })
      } catch {
        return json({ error: '请求超时或无法连接该地址' }, 502)
      }
    },
  },
  {
    // 把勾选的模型加入「AI 模型」（已存在的同渠道同模型名跳过）
    path: '/models/add',
    method: 'post',
    handler: async (req) => {
      if (!isCmsAdmin(req)) return json({ error: '无权限' }, 403)
      const body = await readBody(req)
      const ch = await resolveChannel(req, body)
      if ('error' in ch) return json({ error: ch.error }, 400)
      const picks = (Array.isArray(body.models) ? body.models : []).map((m) => String(m).trim().slice(0, 120)).filter(Boolean).slice(0, 50)
      if (!picks.length) return json({ error: '请至少勾选一个模型' }, 400)
      const g = await req.payload.findGlobal({ slug: 'ai-settings', depth: 0, overrideAccess: true })
      const rows = (((g as { aiModels?: unknown }).aiModels as Record<string, unknown>[] | null) ?? []).map(({ id: _id, ...r }) => r)
      const exists = (m: string) => rows.some((r) => r.apiModel === m && r.channelId === body.channelId && (body.channelId !== 'custom' || r.customChannel === ch.customChannel))
      const added = picks.filter((m) => !exists(m))
      for (const m of added) {
        rows.push({ name: m, channelId: body.channelId, ...(ch.customChannel ? { customChannel: ch.customChannel } : {}), apiModel: m, cost: 1, tag: ch.label, enabled: true, isDefault: false, reasoning: /reason|r1|think/i.test(m) })
      }
      await req.payload.updateGlobal({ slug: 'ai-settings', data: { aiModels: rows } as never, overrideAccess: false, user: req.user, req })
      return json({ added: added.length, skipped: picks.length - added.length })
    },
  },
]
