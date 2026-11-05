import { getCompanyInfo } from '@/lib/cached-data'
import { featureAccess } from '@/lib/membership'
import { getMembershipContext } from '@/lib/membership-policy'
import { getPayloadClient } from '@/lib/payload'
import { loadProjectDocs } from '@/lib/project-docs'
import type { User } from '@/payload-types'
import { getPluginFlags } from '@/plugins/state'

import { UsageMeter } from './billing'
import { AiError, availableTools, complete, findModel, resolveModelApiKey, runTool, stream, stripDsml, systemPrompt, type LlmMessage, type ToolContext } from './server'

const MAX_INPUT = 32000
const HISTORY = 20
const fail = (status: number, error: string) => Response.json({ ok: false, error }, { status })

/**
 * AI 对话（网页侧栏和微信小程序共用）：{ conversationId?, message, modelId, projectId?, pluginIds? }
 * 返回 NDJSON 流：meta → tool* → reasoning* / delta* → done | error。
 * 按实际用量计费（tokens × 模型倍率 + 工具调用费用，见 billing.ts），调用成功后才扣，出错不扣。
 */
export async function handleAiChat(request: Request, user: User): Promise<Response> {
  const [flags, company, access] = await Promise.all([getPluginFlags(user.id), getCompanyInfo(user.id), getMembershipContext(user)])
  if (!flags['ai-copilot']) return fail(404, '「AI 对话」插件已关闭')

  const body = (await request.json().catch(() => null)) as { conversationId?: unknown; message?: unknown; modelId?: unknown; projectId?: unknown; pluginIds?: unknown } | null
  const text = typeof body?.message === 'string' ? body.message.trim() : ''
  if (!text) return fail(400, '请输入内容')
  if (text.length > MAX_INPUT) return fail(400, `单条消息最多 ${MAX_INPUT} 字`)
  const model = findModel(body?.modelId, company.aiModels)
  if (!model) return fail(400, '不支持的模型')
  const modelTierCheck = featureAccess(access.membership, model.minTier ?? 'free', access.strict)
  if (!modelTierCheck.allowed) {
    return fail(403, `模型「${model.name}」为 ${model.tierBadge ?? 'Plus'} 会员专属高阶模型，请升级至 ${model.tierBadge ?? 'Plus'} 会员后使用`)
  }
  if (!resolveModelApiKey(model)) {
    return fail(503, `模型「${model.name}」还没有配置密钥环境变量（${model.apiKeyEnv}），请在设置或环境变量中添加`)
  }
  const pluginIds = Array.isArray(body?.pluginIds) ? body.pluginIds.filter((v): v is string => typeof v === 'string') : []

  const payload = await getPayloadClient()
  const me = await payload.findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: true, select: { aiCredits: true } })
  if ((me.aiCredits ?? 0) < 1) return fail(402, '积分已用完，请在「会员与积分」页兑换或联系管理员发放')

  // 会话：沿用自己的会话，或新建
  let conversationId = typeof body?.conversationId === 'string' && body.conversationId ? body.conversationId : null
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
    const cleanTitle = text.replace(/【已上传附件[\s\S]*$/m, '').trim() || '上传文件处理'
    const conv = await payload.create({
      collection: 'ai-conversations',
      data: { title: cleanTitle.slice(0, 30), owner: user.id, ...(project ? { project: projectId } : {}), model: model.id },
      user,
      overrideAccess: false,
      depth: 0,
    })
    conversationId = String(conv.id)
  }
  await payload.create({ collection: 'ai-messages', data: { conversation: conversationId, owner: user.id, role: 'user', content: text }, overrideAccess: true, depth: 0 })

  const tools = availableTools(model.id, pluginIds, flags)
  const messages: LlmMessage[] = [{ role: 'system', content: systemPrompt(project, pluginIds, flags) }, ...history, { role: 'user', content: text }]
  const encoder = new TextEncoder()

  const body$ = new ReadableStream({
    async start(controller) {
      let closed = false
      const send = (o: Record<string, unknown>) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(o)}\n`))
        } catch {
          closed = true
        }
      }
      // 在工具调用（非流式 complete）与深度推理等待期间，每 8 秒发送一次心跳，防止微信小程序、移动网络或反向代理空闲超时断开连接
      const heartbeat = setInterval(() => send({ type: 'ping' }), 8000)
      send({ type: 'meta', conversationId })
      const toolLog: { pluginId: string; pluginName: string; summary: string; href?: string; hrefLabel?: string }[] = []
      const ctx: ToolContext = {
        user,
        projectId,
        project,
        mutated: false,
        onProjectChange(proj) {
          send({ type: 'project', project: proj })
        },
      }
      const meter = new UsageMeter()
      const promptText = () => messages.map((m) => (typeof m.content === 'string' ? m.content : '')).join('\n')
      try {
        let content = ''
        if (tools.length) {
          // 支持多步连续调用工具（最多 10 轮，例如：新建项目 → 添加户型图 → 智能选型 → 生成报价单 → 生成合同）
          for (let step = 0; step < 10; step++) {
            const input = promptText()
            const turn = await complete(model, messages, tools.map((t) => t.definition))
            meter.add(turn.usage, { input, output: (turn.content ?? '') + JSON.stringify(turn.tool_calls ?? '') })
            if (!turn.tool_calls?.length) {
              content = stripDsml(turn.content)
              if (content) send({ type: 'delta', text: content })
              break
            }
            messages.push({ role: 'assistant', content: turn.content ?? null, tool_calls: turn.tool_calls })
            for (const call of turn.tool_calls) {
              const r = await runTool(tools, call, ctx)
              if (r.tool) meter.tool(call.function.name)
              if (r.tool) {
                const entry = { pluginId: r.tool.pluginId ?? 'core', pluginName: r.tool.pluginName, summary: r.summary ?? '', href: r.href, hrefLabel: r.hrefLabel, imageUrl: r.imageUrl }
                toolLog.push(entry)
                send({ type: 'tool', ...entry })
              }
              messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(r.output) })
            }
          }
        }
        if (!content) {
          const input = promptText()
          let usage: { prompt_tokens?: number; completion_tokens?: number } | null = null
          let reasoning = ''
          const raw = await stream(
            model,
            messages,
            (t) => {
              if (!t.includes('DSML')) send({ type: 'delta', text: t })
            },
            (t) => {
              reasoning += t
              send({ type: 'reasoning', text: t })
            },
            request.signal,
            (u) => {
              usage = u
            },
          )
          meter.add(usage, { input, output: raw + reasoning })
          content = stripDsml(raw)
        }
        if (!content.trim() && toolLog.length) {
          content = `已完成以下操作：\n${toolLog.map((t, i) => `${i + 1}. **${t.pluginName}**：${t.summary}`).join('\n')}`
          send({ type: 'delta', text: content })
        }
        if (!content.trim()) throw new AiError('AI 没有返回内容，请重试')

        // 按量计费；余额不够本次实际用量时扣到 0 为止（调用前已确认余额 ≥ 1）
        const fresh = await payload.findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: true, select: { aiCredits: true } })
        const cost = Math.min(meter.credits(model), Math.max(0, fresh.aiCredits ?? 0))
        const usage = { inputTokens: meter.inputTokens, outputTokens: meter.outputTokens, toolCalls: meter.tools.length, estimated: meter.estimated > 0 }
        const reply = await payload.create({
          collection: 'ai-messages',
          data: { conversation: conversationId, owner: user.id, role: 'assistant', content, model: model.id, cost, toolCalls: toolLog.length ? toolLog : undefined },
          overrideAccess: true,
          depth: 0,
        })
        let balance: number | null = null
        if (cost > 0) {
          try {
            const entry = await payload.create({
              collection: 'ai-credit-ledger',
              data: { user: user.id, delta: -cost, reason: `AI 对话 · ${model.name} · ${meter.summary()}`.slice(0, 120), model: model.id, message: reply.id },
              overrideAccess: true,
              depth: 0,
            })
            balance = entry.balanceAfter ?? null
          } catch (error) {
            console.error('[ai] credit deduction failed', error)
          }
        } else balance = fresh.aiCredits ?? 0
        await payload
          .update({
            collection: 'ai-conversations',
            id: conversationId!,
            data: { model: model.id, ...(ctx.projectId ? { project: ctx.projectId } : {}) },
            overrideAccess: true,
            depth: 0,
          })
          .catch(() => null)
        send({ type: 'done', messageId: String(reply.id), cost, usage, balance, mutated: ctx.mutated, projectId: ctx.projectId })
      } catch (error) {
        send({ type: 'error', error: error instanceof AiError ? error.message : 'AI 服务出错，请稍后重试' })
        if (!(error instanceof AiError)) console.error('[ai] chat failed', error)
      } finally {
        clearInterval(heartbeat)
        closed = true
        try {
          controller.close()
        } catch {
          // ignore if already closed
        }
      }
    },
  })

  return new Response(body$, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
  })
}
