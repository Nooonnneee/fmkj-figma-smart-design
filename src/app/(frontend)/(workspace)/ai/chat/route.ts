import { appAuth } from '@/lib/app-auth'
import { getPayloadClient } from '@/lib/payload'
import { loadProjectDocs } from '@/lib/project-docs'
import { aiConfigured, AiError, availableTools, complete, findModel, runTool, stream, systemPrompt, type LlmMessage } from '@/plugins/ai-copilot/server'
import { getPluginFlags } from '@/plugins/state'

const MAX_INPUT = 4000
const HISTORY = 20
const fail = (status: number, error: string) => Response.json({ ok: false, error }, { status })

/**
 * 发送一条消息：{ conversationId?, message, modelId, projectId?, pluginIds? }
 * 返回 NDJSON 流：meta → tool* → reasoning* / delta* → done | error。
 * 调用成功后才扣积分；出错不扣。
 */
export async function POST(request: Request) {
  const user = await appAuth.getCurrentUser()
  if (!user) return fail(401, '登录已过期，请重新登录')
  const flags = await getPluginFlags()
  if (!flags['ai-copilot']) return fail(404, '「AI 对话」插件已关闭')
  if (!aiConfigured()) return fail(503, '还没有配置 AI 密钥（DEEPSEEK_API_KEY），请在 Make 设置 → Secrets 里添加')

  const body = (await request.json().catch(() => null)) as { conversationId?: unknown; message?: unknown; modelId?: unknown; projectId?: unknown; pluginIds?: unknown } | null
  const text = typeof body?.message === 'string' ? body.message.trim() : ''
  if (!text) return fail(400, '请输入内容')
  if (text.length > MAX_INPUT) return fail(400, `单条消息最多 ${MAX_INPUT} 字`)
  const model = findModel(body?.modelId)
  if (!model) return fail(400, '不支持的模型')
  const pluginIds = Array.isArray(body?.pluginIds) ? body.pluginIds.filter((v): v is string => typeof v === 'string') : []

  const payload = await getPayloadClient()
  const me = await payload.findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: true, select: { aiCredits: true } })
  if ((me.aiCredits ?? 0) < model.cost) return fail(402, `积分不足（剩余 ${me.aiCredits ?? 0}，本次需要 ${model.cost}），请联系管理员发放`)

  // 会话：沿用自己的会话，或新建
  let conversationId = typeof body?.conversationId === 'string' ? body.conversationId : null
  let history: LlmMessage[] = []
  if (conversationId) {
    const conv = await payload.findByID({ collection: 'ai-conversations', id: conversationId, depth: 0, user, overrideAccess: false }).catch(() => null)
    if (!conv) return fail(404, '会话不存在')
    const { docs } = await payload.find({
      collection: 'ai-messages',
      where: { conversation: { equals: conversationId } },
      sort: '-createdAt',
      limit: HISTORY,
      depth: 0,
      user,
      overrideAccess: false,
      select: { role: true, content: true },
    })
    history = docs.reverse().map((m) => ({ role: m.role, content: m.content }) as LlmMessage)
  }

  const projectId = typeof body?.projectId === 'string' && body.projectId ? body.projectId : null
  const project = projectId ? await loadProjectDocs(projectId, user).catch(() => null) : null

  if (!conversationId) {
    const conv = await payload.create({
      collection: 'ai-conversations',
      data: { title: text.slice(0, 30), owner: user.id, ...(project ? { project: projectId } : {}), model: model.id },
      user,
      overrideAccess: false,
      depth: 0,
    })
    conversationId = String(conv.id)
  }
  await payload.create({ collection: 'ai-messages', data: { conversation: conversationId, owner: user.id, role: 'user', content: text }, overrideAccess: true, depth: 0 })

  const tools = availableTools(model.id, pluginIds, flags)
  const messages: LlmMessage[] = [{ role: 'system', content: systemPrompt(project) }, ...history, { role: 'user', content: text }]
  const encoder = new TextEncoder()

  const body$ = new ReadableStream({
    async start(controller) {
      const send = (o: Record<string, unknown>) => controller.enqueue(encoder.encode(`${JSON.stringify(o)}\n`))
      send({ type: 'meta', conversationId })
      const toolLog: { pluginId: string; pluginName: string; summary: string; href?: string }[] = []
      try {
        let content = ''
        if (tools.length) {
          // 支持多步连续调用工具（最多 4 轮，例如：先搜索/应用智能选型 → 再生成报价单）
          for (let step = 0; step < 4; step++) {
            const turn = await complete(model.id, messages, tools.map((t) => t.definition))
            if (!turn.tool_calls?.length) {
              if (turn.content) {
                content = turn.content
                send({ type: 'delta', text: content })
              }
              break
            }
            messages.push({ role: 'assistant', content: turn.content ?? null, tool_calls: turn.tool_calls })
            for (const call of turn.tool_calls) {
              const r = await runTool(tools, call, { user, projectId, project })
              if (r.tool) {
                const entry = { pluginId: r.tool.pluginId ?? 'core', pluginName: r.tool.pluginName, summary: r.summary ?? '', href: r.href }
                toolLog.push(entry)
                send({ type: 'tool', ...entry })
              }
              messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(r.output) })
            }
          }
        }
        if (!content) {
          content = await stream(model.id, messages, (t) => send({ type: 'delta', text: t }), (t) => send({ type: 'reasoning', text: t }), request.signal)
        }
        if (!content.trim()) throw new AiError('AI 没有返回内容，请重试')

        const reply = await payload.create({
          collection: 'ai-messages',
          data: { conversation: conversationId, owner: user.id, role: 'assistant', content, model: model.id, cost: model.cost, toolCalls: toolLog.length ? toolLog : undefined },
          overrideAccess: true,
          depth: 0,
        })
        let balance: number | null = null
        try {
          const entry = await payload.create({
            collection: 'ai-credit-ledger',
            data: { user: user.id, delta: -model.cost, reason: `AI 对话 · ${model.name}`, model: model.id, message: reply.id },
            overrideAccess: true,
            depth: 0,
          })
          balance = entry.balanceAfter ?? null
        } catch (error) {
          console.error('[ai] credit deduction failed', error)
        }
        await payload.update({ collection: 'ai-conversations', id: conversationId!, data: { model: model.id }, overrideAccess: true, depth: 0 }).catch(() => null)
        send({ type: 'done', messageId: String(reply.id), cost: model.cost, balance })
      } catch (error) {
        send({ type: 'error', error: error instanceof AiError ? error.message : 'AI 服务出错，请稍后重试' })
        if (!(error instanceof AiError)) console.error('[ai] chat failed', error)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(body$, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' } })
}
