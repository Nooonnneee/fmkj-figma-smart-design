/**
 * AI 对话的服务端部分：调用 DeepSeek（OpenAI 兼容接口）、把插件包装成模型可调用的工具。
 * 只在服务端（路由处理函数）里使用，密钥只从 process.env.DEEPSEEK_API_KEY 读取。
 */
import { getCatalog, getCompanyInfo } from '@/lib/cached-data'
import { DEVICE_TYPE_ORDER, deviceTypeOf, isDeviceType } from '@/lib/device-types'
import { getPayloadClient } from '@/lib/payload'
import { isPointData, parseDefaults, pointDeviceType, summarizePoints, type PointCustomData } from '@/lib/point-map-items'
import { loadProjectDocs } from '@/lib/project-docs'
import { analyzeScene, type StoredScene } from '@/lib/point-scene'
import { inPointScope } from '@/lib/point-scopes'
import type { User } from '@/payload-types'
import { autoSelectProducts, isSelectionTier, SELECTION_TIERS } from '@/plugins/smart-select/auto-select'
import type { PluginFlags } from '@/plugins/state'

import { AI_MODELS } from './templates'

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

export const aiConfigured = () => Boolean(process.env.DEEPSEEK_API_KEY)
export const findModel = (id: unknown) => AI_MODELS.find((m) => m.id === id) ?? AI_MODELS[0]

export type LlmMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: LlmToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string }
export type LlmToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } }

export class AiError extends Error {
  constructor(message: string, public status = 502) {
    super(message)
  }
}

async function postOnce(body: Record<string, unknown>, timeoutMs: number) {
  let res: Response
  try {
    res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    throw new AiError((error as Error)?.name === 'TimeoutError' ? 'AI 响应超时，请稍后重试' : 'AI 服务暂时无法连接，请稍后重试')
  }
  return res
}

async function post(body: Record<string, unknown>, timeoutMs: number) {
  let res = await postOnce(body, timeoutMs)
  // 兼容不同网关对 DeepSeek V4.1-Flash-1017 的模型 ID 命名（官方 /models 返回 deepseek-flash）
  if (res.status === 400 && body.model === 'deepseek-flash') {
    for (const alias of ['deepseek-v4.1-flash-1017', 'DeepSeek-V4.1-Flash', 'deepseek-chat']) {
      res = await postOnce({ ...body, model: alias }, timeoutMs)
      if (res.ok) return res
    }
  }
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    if (res.status === 401) throw new AiError('DeepSeek 密钥无效，请在 Make 设置 → Secrets 里检查 DEEPSEEK_API_KEY', 503)
    if (res.status === 402) throw new AiError('DeepSeek 账户余额不足，请先在 DeepSeek 平台充值', 503)
    if (res.status === 429) throw new AiError('请求太频繁，请稍后再试', 429)
    // 预览沙箱会拦截向外的 POST 请求（Cloudflare 520 + Origin is disallowed），发布后的正式站点不受影响
    if (res.status === 520) throw new AiError('当前预览环境不允许连接外部 AI 服务。请点击 Publish 发布后，在正式站点使用 AI 对话。', 503)
    console.error('[ai] deepseek error', res.status, detail?.error?.message)
    throw new AiError('AI 服务出错，请稍后重试')
  }
  return res
}

/** 不流式的一次调用（用于判断是否需要调用插件）。 */
export async function complete(model: string, messages: LlmMessage[], tools?: unknown[]) {
  const res = await post({ model, messages, ...(tools?.length ? { tools } : {}), stream: false }, 60_000)
  const json = (await res.json()) as { choices?: { message?: { content?: string | null; tool_calls?: LlmToolCall[] } }[] }
  return json.choices?.[0]?.message ?? { content: '' }
}

/** 流式调用：逐段回调正文和思考过程（R1 的 reasoning_content），返回完整正文。 */
export async function stream(model: string, messages: LlmMessage[], onDelta: (text: string) => void, onReasoning: (text: string) => void, signal?: AbortSignal) {
  const res = await post({ model, messages, stream: true }, 120_000)
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  while (true) {
    if (signal?.aborted) {
      await reader.cancel()
      break
    }
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const data = line.trim().replace(/^data:\s*/, '')
      if (!data || data === '[DONE]' || !line.trim().startsWith('data:')) continue
      try {
        const delta = (JSON.parse(data) as { choices?: { delta?: { content?: string; reasoning_content?: string } }[] }).choices?.[0]?.delta
        if (delta?.reasoning_content) onReasoning(delta.reasoning_content)
        if (delta?.content) {
          full += delta.content
          onDelta(delta.content)
        }
      } catch {
        // 忽略不完整的行
      }
    }
  }
  return full
}

/** 系统提示词：身份、业务背景、当前项目概况。 */
export function systemPrompt(project: Awaited<ReturnType<typeof loadProjectDocs>> | null) {
  const lines = [
    '你是 FMKJ 全屋智能家居方案设计平台的助手，服务对象是方案设计师和安装团队。',
    '平台主流程：项目信息 → 点位图 → 报价 → 合同 → 归档。回答使用简体中文，简洁、具体、可执行；不要编造产品型号、价格或客户信息，数据不足时直接说明。',
    '你可以调用工具搜索 728 款产品库、查看当前项目点位与报价明细、执行房间智能分析、应用智能选型，或直接为当前项目生成报价单草稿。',
  ]
  if (project) {
    const p = project.project
    lines.push(
      '',
      `当前关联项目：${p.name}（客户：${p.customerName || '未填写'}，主平台：${p.platform || '待定'}）`,
      `点位 ${project.points.length} 个，房间 ${project.rooms.length} 个，图纸 ${project.sheets.length} 张，${project.pending} 个点位待选型。`,
      `设备构成：${project.categories.map((c) => `${c.name} ${c.count}`).join('、') || '暂无'}`,
      `按当前选型的设备预算：${project.total.toFixed(0)} 元${project.quote ? `；最新报价「${project.quote.title}」合计 ${project.quote.total} 元` : ''}。`,
    )
  }
  return lines.join('\n')
}

type ToolContext = { user: User; projectId: string | null; project: Awaited<ReturnType<typeof loadProjectDocs>> | null }
type AiTool = {
  /** null 表示核心内置工具（始终可用）；非 null 表示需开启并勾选对应插件 */
  pluginId: keyof PluginFlags | null
  pluginName: string
  definition: Record<string, unknown>
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<{ result: unknown; summary: string; href?: string }>
}

/** 系统内置工具 + 插件工具。 */
const TOOLS: AiTool[] = [
  {
    pluginId: null,
    pluginName: '产品库检索',
    definition: {
      type: 'function',
      function: {
        name: 'search_products',
        description: '搜索平台产品库（728 款在售产品）：可按关键词、设备类型、品牌名称、生态平台、最高价格筛选，返回具体型号、SKU、品牌、售价与成本。',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '搜索关键词（如 零火开关、人体存在、静音窗帘、网关）' },
            deviceType: { type: 'string', description: '设备类型代号（如 switch-1, switch-2, switch-3, curtain-track, smart-lock, motion-sensor, water-sensor, gateway, downlight）' },
            brand: { type: 'string', description: '品牌名称（如 Aqara、小米、领普、易来）' },
            platform: { type: 'string', description: '生态平台（如 米家、Apple Home、华为、涂鸦、Matter、KNX）' },
            maxPrice: { type: 'number', description: '最高单价（元）' },
          },
        },
      },
    },
    async run(args) {
      const catalog = await getCatalog()
      const q = typeof args.query === 'string' ? args.query.trim().toLowerCase() : ''
      const dt = typeof args.deviceType === 'string' ? args.deviceType.trim() : ''
      const brand = typeof args.brand === 'string' ? args.brand.trim().toLowerCase() : ''
      const platform = typeof args.platform === 'string' ? args.platform.trim().toLowerCase() : ''
      const maxPrice = typeof args.maxPrice === 'number' && args.maxPrice > 0 ? args.maxPrice : null

      const matched = catalog
        .filter((p) => (p.status ?? 'active') === 'active')
        .filter((p) => (!dt ? true : p.deviceType === dt))
        .filter((p) => (!brand ? true : (p.brand?.name ?? '').toLowerCase().includes(brand)))
        .filter((p) => (!platform ? true : p.platforms.some((pl) => pl.toLowerCase().includes(platform))))
        .filter((p) => (maxPrice === null ? true : p.price <= maxPrice))
        .filter((p) => (!q ? true : `${p.name} ${p.sku} ${p.brand?.name ?? ''} ${deviceTypeOf(p.deviceType ?? '')?.name ?? ''}`.toLowerCase().includes(q)))
        .slice(0, 15)
        .map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          brand: p.brand?.name ?? null,
          deviceType: deviceTypeOf(p.deviceType ?? '')?.name ?? p.deviceType,
          platforms: p.platforms,
          price: p.price,
          cost: p.cost,
          unit: p.unit,
        }))

      return {
        result: { count: matched.length, products: matched },
        summary: `检索到 ${matched.length} 款产品`,
        href: '/products',
      }
    },
  },
  {
    pluginId: null,
    pluginName: '项目点位与报价明细',
    definition: {
      type: 'function',
      function: {
        name: 'get_project_details',
        description: '读取当前关联项目的详细点位清单、已汇总的产品金额、以及项目下所有报价单和合同信息。',
        parameters: { type: 'object', properties: {} },
      },
    },
    async run(_args, ctx) {
      if (!ctx.project || !ctx.projectId) {
        return { result: { error: '没有关联项目，请先在输入框「+」里选择关联项目' }, summary: '未关联项目' }
      }
      const payload = await getPayloadClient()
      const quotes = await payload.find({
        collection: 'quotes',
        where: { project: { equals: ctx.projectId } },
        sort: '-updatedAt',
        limit: 5,
        depth: 0,
        user: ctx.user,
        overrideAccess: false,
        select: { title: true, status: true, discount: true, total: true, items: true, fees: true },
      })
      return {
        result: {
          project: {
            id: ctx.projectId,
            name: ctx.project.project.name,
            customerName: ctx.project.project.customerName,
            platform: ctx.project.project.platform,
            totalPoints: ctx.project.points.length,
            pendingPoints: ctx.project.pending,
            equipmentTotal: ctx.project.total,
          },
          products: ctx.project.products.map((r) => ({
            deviceType: deviceTypeOf(r.deviceType)?.name ?? r.deviceType,
            name: r.product.name,
            brand: r.product.brand?.name ?? null,
            price: r.product.price,
            count: r.count,
            subtotal: r.subtotal,
            rooms: r.rooms,
          })),
          quotes: quotes.docs.map((q) => ({
            id: String(q.id),
            title: q.title,
            status: q.status,
            discount: q.discount,
            total: q.total,
            itemCount: (q.items ?? []).length,
          })),
          contract: ctx.project.contract
            ? { number: ctx.project.contract.number, amount: ctx.project.contract.amount, status: ctx.project.contract.status }
            : null,
        },
        summary: `读取了 ${ctx.project.products.length} 项设备与 ${quotes.docs.length} 份报价`,
        href: `/projects/${ctx.projectId}`,
      }
    },
  },
  {
    pluginId: null,
    pluginName: '生成报价草稿',
    definition: {
      type: 'function',
      function: {
        name: 'create_quote_draft',
        description: '根据当前关联项目的点位图和已设置的默认产品型号，直接创建一份新的草稿报价单（可指定折扣金额和备注）。',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '报价单标题（可选，不填则自动编号）' },
            discount: { type: 'number', description: '优惠减免金额（元，可选，默认 0）' },
            notes: { type: 'string', description: '报价单备注（可选）' },
          },
        },
      },
    },
    async run(args, ctx) {
      if (!ctx.projectId) return { result: { error: '没有关联项目，请先关联项目' }, summary: '未关联项目' }
      const payload = await getPayloadClient()
      const project = await payload
        .findByID({ collection: 'projects', id: ctx.projectId, depth: 0, user: ctx.user, overrideAccess: false, select: { name: true, status: true, pointMap: true, defaultProducts: true } })
        .catch(() => null)
      if (!project) return { result: { error: '项目不存在或无权限' }, summary: '项目不可用' }
      if (project.status === 'archived') return { result: { error: '项目已归档，不能新建报价' }, summary: '项目已归档' }

      const elements = ((project.pointMap as { elements?: unknown[] } | null)?.elements ?? []) as { isDeleted?: boolean; customData?: PointCustomData }[]
      const allPoints = elements.filter((el) => !el?.isDeleted && isPointData(el?.customData)).map((el) => el.customData!)
      const catalog = await getCatalog()
      const byId = new Map(catalog.map((p) => [p.id, p]))
      const points = allPoints.filter((cd) => inPointScope(pointDeviceType(cd, byId), 'all'))
      const summary = summarizePoints(points, byId, parseDefaults(project.defaultProducts))
      const items = [...summary.products.entries()]
        .map(([id, row]) => ({ p: byId.get(id)!, row }))
        .sort((a, b) => DEVICE_TYPE_ORDER.indexOf(a.p.deviceType ?? a.row.deviceType) - DEVICE_TYPE_ORDER.indexOf(b.p.deviceType ?? b.row.deviceType))
        .map(({ p, row }) => ({
          product: p.id,
          deviceType: (p.deviceType ?? row.deviceType) as never,
          image: p.image?.id ?? null,
          name: p.name,
          sku: p.sku,
          unit: p.unit,
          price: p.price,
          quantity: row.count,
        }))

      if (items.length === 0) {
        return {
          result: { error: '当前项目点位尚未设置型号，请先调用 smart_select（设置 apply=true）完成选型后再生成报价' },
          summary: '点位尚未选型',
          href: `/projects/${ctx.projectId}/point-map`,
        }
      }

      const company = await getCompanyInfo()
      const existing = await payload.count({ collection: 'quotes', where: { project: { equals: ctx.projectId } }, user: ctx.user, overrideAccess: false })
      const title = typeof args.title === 'string' && args.title.trim() ? args.title.trim().slice(0, 60) : `报价 ${existing.totalDocs + 1}`
      const discount = typeof args.discount === 'number' && args.discount >= 0 ? Math.round(args.discount) : 0
      const notes = typeof args.notes === 'string' && args.notes.trim() ? args.notes.trim().slice(0, 2000) : (company.quoteNotes ?? null)

      const quote = await payload.create({
        collection: 'quotes',
        data: { title, project: ctx.projectId, status: 'draft', items, fees: [], discount, notes },
        user: ctx.user,
        overrideAccess: false,
        depth: 0,
      })
      return {
        result: {
          quoteId: String(quote.id),
          title: quote.title,
          itemCount: items.length,
          pendingPoints: summary.pendingTotal,
          total: quote.total,
        },
        summary: `已生成「${quote.title}」（合计 ¥${quote.total}）`,
        href: `/projects/${ctx.projectId}/quotes/${quote.id}`,
      }
    },
  },
  {
    pluginId: 'room-insights',
    pluginName: '房间智能分析',
    definition: {
      type: 'function',
      function: {
        name: 'room_insights',
        description: '读取当前关联项目的房间点位配置：每个房间的设备、配置完整度、缺少的必备/推荐设备和推荐场景。',
        parameters: { type: 'object', properties: {} },
      },
    },
    async run(_args, ctx) {
      if (!ctx.project) return { result: { error: '没有关联项目，请先在输入框「+」里关联项目' }, summary: '未关联项目' }
      const rooms = ctx.project.rooms.map((r) => ({
        room: r.name,
        type: r.typeLabel,
        points: r.total,
        score: r.score,
        devices: r.devices.map((d) => `${deviceTypeOf(d.deviceType)?.name ?? d.deviceType}×${d.count}`),
        missing: r.missing.map((m) => `${m.label}（${m.reason}）`),
        scenes: r.scenes,
      }))
      return { result: { rooms }, summary: `分析了 ${rooms.length} 个房间`, href: `/projects/${ctx.projectId}/point-map` }
    },
  },
  {
    pluginId: 'smart-select',
    pluginName: '智能选型',
    definition: {
      type: 'function',
      function: {
        name: 'smart_select',
        description: '按项目主平台和档次（economy 经济 / standard 标准 / premium 高端），为当前关联项目点位图里用到的设备类型匹配默认型号。当 apply=true 时，会直接把选型结果写入该项目的默认型号。',
        parameters: {
          type: 'object',
          properties: {
            tier: { type: 'string', enum: SELECTION_TIERS.map((t) => t.value), description: 'economy 经济 / standard 标准 / premium 高端' },
            apply: { type: 'boolean', description: '是否直接写入当前项目的默认型号（用户明确要求应用/设置/配好型号时传 true，仅询问推荐时传 false）' },
          },
          required: ['tier'],
        },
      },
    },
    async run(args, ctx) {
      if (!ctx.projectId) return { result: { error: '没有关联项目' }, summary: '未关联项目' }
      const tier = isSelectionTier(args.tier) ? args.tier : 'standard'
      const shouldApply = args.apply === true
      const payload = await getPayloadClient()
      const project = await payload
        .findByID({ collection: 'projects', id: ctx.projectId, depth: 0, user: ctx.user, overrideAccess: false, select: { status: true, platform: true, pointMap: true, defaultProducts: true } })
        .catch(() => null)
      if (!project) return { result: { error: '项目不存在或没有权限' }, summary: '项目不可用' }
      const { points } = analyzeScene(project.pointMap as Partial<StoredScene> | null)
      const types = [...new Set(points.map((p) => p.deviceType))].filter((t) => isDeviceType(t) && t !== 'other')
      const { chosen, missing } = autoSelectProducts(await getCatalog(), types, { platform: project.platform, tier })
      let applied = false
      if (shouldApply && project.status !== 'archived' && chosen.length > 0) {
        const defaults = parseDefaults(project.defaultProducts)
        for (const r of chosen) defaults[r.deviceType] = r.product.id
        await payload.update({
          collection: 'projects',
          id: ctx.projectId,
          data: { defaultProducts: defaults },
          user: ctx.user,
          overrideAccess: false,
          depth: 0,
        })
        applied = true
      }
      return {
        result: {
          platform: project.platform,
          tier,
          applied,
          picks: chosen.map((r) => ({ deviceType: deviceTypeOf(r.deviceType)?.name ?? r.deviceType, product: r.product.name, brand: r.product.brand?.name, price: r.product.price, platformMatched: r.platformMatched })),
          noCandidate: missing.map((t) => deviceTypeOf(t)?.name ?? t),
        },
        summary: applied ? `已应用 ${chosen.length} 类设备的默认型号` : `推荐了 ${chosen.length} 类设备的型号`,
        href: `/projects/${ctx.projectId}/point-map`,
      }
    },
  },
]

/** 本次对话可用的工具：内置工具始终可用，插件工具需对应插件已开启且已勾选。 */
export function availableTools(_modelId: string, pluginIds: string[], flags: PluginFlags) {
  return TOOLS.filter((t) => t.pluginId === null || (flags[t.pluginId] && pluginIds.includes(t.pluginId)))
}

export async function runTool(tools: AiTool[], call: LlmToolCall, ctx: ToolContext) {
  const tool = tools.find((t) => (t.definition.function as { name: string }).name === call.function.name)
  if (!tool) return { tool: null, output: { error: '未知工具' } }
  let args: Record<string, unknown> = {}
  try {
    args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>
  } catch {
    // 参数解析失败按空参数处理
  }
  try {
    const { result, summary, href } = await tool.run(args, ctx)
    return { tool, output: result, summary, href }
  } catch (error) {
    console.error('[ai] tool failed', call.function.name, error)
    return { tool, output: { error: '插件执行失败' } }
  }
}
