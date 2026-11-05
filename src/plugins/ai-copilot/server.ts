import type { TokenUsage } from './billing'
import type { loadProjectDocs } from '@/lib/project-docs'
import type { PluginFlags } from '@/plugins/state'

import { activePluginPromptLines, availableTools, runTool, type ActiveProjectUpdate, type AiTool, type LlmToolCall, type ToolContext } from './registry'
import {
  AI_PROVIDER_CHANNELS,
  AUTO_AI_MODEL,
  CUSTOM_KEY_ENV_RE,
  DEFAULT_AI_MODELS,
  enabledAiModels,
  isAiProviderChannelId,
  isVisionCapableModel,
  normalizeCustomBaseUrl,
  type AiModelConfig,
} from './templates'

export { availableTools, runTool, type ActiveProjectUpdate, type AiTool, type LlmToolCall, type ToolContext }

function isPrivateOrLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (
    h === 'localhost' ||
    h === '0.0.0.0' ||
    h === '[::1]' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h.endsWith('.localhost')
  ) {
    return true
  }
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return true
  const m172 = /^172\.(\d+)\./.exec(h)
  if (m172 && Number(m172[1]) >= 16 && Number(m172[1]) <= 31) return true
  return false
}

/**
 * 严格按受信任渠道（channelId）解析 API Key 与请求地址，两个值一对一绑定：
 * - 官方渠道只读对应官方环境变量，且只发往对应官方 HTTPS 域名；
 * - NewAPI 聚合网关只从服务端环境变量 NEWAPI_BASE_URL（需为公网 HTTPS）与 NEWAPI_API_KEY 读取，绝不接受客户端传入的 URL 或环境变量名。
 */
export function resolveModelEndpoint(model?: (Pick<AiModelConfig, 'channelId'> & Partial<Pick<AiModelConfig, 'baseUrl' | 'apiKeyEnv'>>) | null): {
  url: string
  apiKey: string | null
  envKey: string
} {
  // 自定义渠道：地址与变量名已在 parseAiModels 中校验（公网 HTTPS、AI_ 前缀），这里再校验一次
  if (model?.channelId === 'custom') {
    const base = normalizeCustomBaseUrl(model.baseUrl)
    const envKey = model.apiKeyEnv && CUSTOM_KEY_ENV_RE.test(model.apiKeyEnv) ? model.apiKeyEnv : ''
    return { url: base ? `${base}/chat/completions` : '', apiKey: base && envKey ? process.env[envKey]?.trim() || null : null, envKey }
  }
  const channelId = isAiProviderChannelId(model?.channelId) ? model.channelId : 'deepseek'
  const channel = AI_PROVIDER_CHANNELS[channelId]

  if (channelId === 'newapi') {
    const rawBase = (process.env.NEWAPI_BASE_URL || process.env.APP_OPENAI_BASE_URL || '').trim().replace(/\/+$/, '')
    let validUrl = ''
    if (rawBase) {
      try {
        const parsed = new URL(rawBase.endsWith('/chat/completions') ? rawBase : `${rawBase}/chat/completions`)
        if (parsed.protocol === 'https:' && !isPrivateOrLocalHost(parsed.hostname)) {
          validUrl = parsed.toString()
        }
      } catch {
        validUrl = ''
      }
    }
    const apiKey = (process.env.NEWAPI_API_KEY || process.env.ONEAPI_KEY || '').trim() || null
    return {
      url: validUrl,
      apiKey: validUrl ? apiKey : null,
      envKey: 'NEWAPI_BASE_URL + NEWAPI_API_KEY',
    }
  }

  const apiKey = process.env[channel.apiKeyEnv]?.trim() || null
  const base = channel.baseUrl.replace(/\/+$/, '')
  return {
    url: base.endsWith('/chat/completions') ? base : `${base}/chat/completions`,
    apiKey,
    envKey: channel.apiKeyEnv,
  }
}

export function resolveModelApiKey(model?: Parameters<typeof resolveModelEndpoint>[0]): string | null {
  return resolveModelEndpoint(model).apiKey
}

/** 检查受信任渠道列表中哪些已在服务端配置好环境变量（仅返回固定渠道的布尔状态，不探测任意环境变量） */
export function getConfiguredEnvStatus(): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const ch of Object.values(AI_PROVIDER_CHANNELS)) {
    out[ch.id] = Boolean(resolveModelEndpoint({ channelId: ch.id }).apiKey)
  }
  return out
}

/** 过滤 DeepSeek 偶发在纯文本模式输出的内部 DSML 协议标签 */
export function stripDsml(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/<[｜|]+DSML[｜|]+[\s\S]*$/g, '')
    .replace(/<\/?[｜|]*DSML[^>]*>/g, '')
    .trim()
}

export const aiConfigured = (models?: AiModelConfig[]) => {
  if (models?.length) return models.some((m) => m.enabled && m.id !== 'auto' && Boolean(resolveModelApiKey(m)))
  return Boolean(resolveModelApiKey({ channelId: 'deepseek' }))
}

export const findModel = (id: unknown, models: AiModelConfig[] = DEFAULT_AI_MODELS): AiModelConfig => {
  if (id === 'auto') return AUTO_AI_MODEL
  const list = enabledAiModels(models)
  return list.find((m) => m.id === id) ?? list.find((m) => m.id !== 'auto') ?? DEFAULT_AI_MODELS[0]
}

export type LlmContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export type LlmMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | LlmContentPart[] }
  | { role: 'assistant'; content: string | null; tool_calls?: LlmToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string }

/** 专业重型工具集合：调用这些工具或对这些工具结果做工程分析时，Auto 模式自动升级到 Qwen-3.x / GLM-5.3 等专业强模型 */
export const PRO_EXPERT_TOOLS = new Set([
  'add_floor_sheet',
  'import_points_json',
  'smart_select',
  'set_project_defaults',
  'room_insights',
  'recommend_proposal_template',
  'create_or_update_quote',
  'create_or_update_contract',
  'analyze_competitor_quote',
])

const EXPERT_INTENT_RE =
  /已上传附件|\[图片\]|点位图|户型图|开关布置|识图|智能选型|一键选型|全屋选型|回路审查|完整度审查|生成报价|报价单|竞品|合同|方案模板/i

/**
 * Auto 模式智能路由：
 * - scene = 'vision'（含上传户型图/CAD图）：优先选择 qwen-3.8 / 3.7 / 3.6 / glm-5.3 / qwen-vl 等多模态视觉模型
 * - scene = 'expert'（专业重型工具调用或工程方案规划）：优先选择 qwen-3.8 / glm-5.3 / qwen-3.7 / qwen-3.6 / deepseek-r1 等强专业模型
 * - scene = 'fast'（日常对话与轻量项目查询）：优先选择 deepseek-flash (1017) / deepseek-chat / glm-5.3-flash 等高速低耗模型
 */
export function resolveAutoRouteModel(
  models: AiModelConfig[] = DEFAULT_AI_MODELS,
  opts: {
    hasImage?: boolean
    userText?: string
    calledToolNames?: string[]
    canAccessModel?: (m: AiModelConfig) => boolean
  } = {},
): { model: AiModelConfig; reason: 'vision' | 'expert' | 'fast' } {
  const realModels = enabledAiModels(models, { includeAuto: false }).filter(
    (m) => Boolean(resolveModelApiKey(m)) && (opts.canAccessModel ? opts.canAccessModel(m) : true),
  )
  const pool = realModels.length > 0 ? realModels : enabledAiModels(models, { includeAuto: false })

  const scoreVision = (m: AiModelConfig): number => {
    const s = `${m.id} ${m.apiModel} ${m.name}`.toLowerCase()
    if (!isVisionCapableModel(s)) return -1
    if (/qwen-?3\.8/.test(s)) return 100
    if (/glm-?5\.3(?!.*flash)/.test(s)) return 96
    if (/qwen-?3\.7/.test(s)) return 94
    if (/qwen-?3\.6/.test(s)) return 92
    if (/qvq|qwen-vl-max/.test(s)) return 90
    if (/glm-?5\.3.*flash/.test(s)) return 86
    if (/glm-4v|doubao.*vision|vl|vision/.test(s)) return 80
    return 70
  }

  const scoreExpert = (m: AiModelConfig): number => {
    const s = `${m.id} ${m.apiModel} ${m.name}`.toLowerCase()
    if (/qwen-?3\.8/.test(s)) return 100
    if (/glm-?5\.3(?!.*flash)/.test(s)) return 96
    if (/qwen-?3\.7/.test(s)) return 94
    if (/qwen-?3\.6/.test(s)) return 92
    if (/glm-?5\.3.*flash/.test(s)) return 88
    if (/qwen-max|qvq|qwq/.test(s)) return 85
    if (/deepseek-reasoner|deepseek-r1|\br1\b/.test(s)) return 82
    if ((m.cost ?? 1) >= 2) return 75
    return 50
  }

  const scoreFast = (m: AiModelConfig): number => {
    const s = `${m.id} ${m.apiModel} ${m.name}`.toLowerCase()
    if (/deepseek.*flash|1017/.test(s)) return 100
    if (/deepseek-chat|deepseek-v3/.test(s)) return 95
    if (/glm-?5\.3.*flash|glm-4-flash/.test(s)) return 90
    if (/qwen-plus|doubao/.test(s)) return 85
    if (!m.reasoning && (m.cost ?? 1) <= 1) return 80
    return 40
  }

  const hasProTool = (opts.calledToolNames ?? []).some((n) => PRO_EXPERT_TOOLS.has(n))
  const wantsVision = Boolean(opts.hasImage) || /\[图片\]|mediaId:/i.test(opts.userText ?? '')
  const wantsExpert = hasProTool || EXPERT_INTENT_RE.test(opts.userText ?? '')

  if (wantsVision) {
    const visionCandidates = [...pool].filter((m) => scoreVision(m) > 0).sort((a, b) => scoreVision(b) - scoreVision(a))
    if (visionCandidates[0]) return { model: visionCandidates[0], reason: 'vision' }
  }

  if (wantsExpert) {
    const expertCandidates = [...pool].sort((a, b) => scoreExpert(b) - scoreExpert(a))
    if (expertCandidates[0] && scoreExpert(expertCandidates[0]) >= 75) {
      return { model: expertCandidates[0], reason: 'expert' }
    }
  }

  const fastCandidates = [...pool].sort((a, b) => scoreFast(b) - scoreFast(a))
  return { model: fastCandidates[0] ?? pool[0] ?? DEFAULT_AI_MODELS[0], reason: 'fast' }
}

export class AiError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message)
  }
}

async function postOnce(url: string, apiKey: string, body: Record<string, unknown>, timeoutMs: number) {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    throw new AiError((error as Error)?.name === 'TimeoutError' ? 'AI 响应超时，请稍后重试' : 'AI 服务暂时无法连接，请稍后重试')
  }
  return res
}

function toModelConfig(modelOrId: AiModelConfig | string): AiModelConfig {
  if (typeof modelOrId === 'string') return findModel(modelOrId)
  return modelOrId
}

async function post(modelOrId: AiModelConfig | string, body: Record<string, unknown>, timeoutMs: number) {
  const model = toModelConfig(modelOrId)
  const { url, apiKey, envKey } = resolveModelEndpoint(model)
  if (!url || !apiKey) {
    throw new AiError(`模型「${model.name}」尚未配置服务端环境变量（${envKey}），请在环境变量 / Secrets 中添加`, 503)
  }
  const apiModel = model.apiModel || model.id
  const payloadBody: Record<string, unknown> = { ...body, model: apiModel }
  let res = await postOnce(url, apiKey, payloadBody, timeoutMs)
  // 兼容不同网关对 DeepSeek V4.1-Flash-1017 的模型 ID 命名（官方 /models 返回 deepseek-flash）
  if ((res.status === 400 || res.status === 404) && /deepseek.*flash/i.test(apiModel)) {
    for (const alias of ['deepseek-flash-1017', 'deepseek-v4.1-flash-1017', 'DeepSeek-V4.1-Flash', 'deepseek-flash', 'deepseek-chat']) {
      if (alias === apiModel) continue
      res = await postOnce(url, apiKey, { ...payloadBody, model: alias }, timeoutMs)
      if (res.ok) return res
    }
  }
  // 如果网关中的该模型不支持多模态 image_url 数组结构而返回 400/422，自动退回纯文本消息重试一次，确保对话绝不中断
  if ((res.status === 400 || res.status === 422) && Array.isArray(payloadBody.messages)) {
    const hasArrayContent = (payloadBody.messages as LlmMessage[]).some((m) => Array.isArray(m.content))
    if (hasArrayContent) {
      const textOnlyMessages = (payloadBody.messages as LlmMessage[]).map((m) => {
        if (!Array.isArray(m.content)) return m
        const joined = m.content
          .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
          .map((p) => p.text)
          .join('\n')
        return { ...m, content: joined }
      })
      res = await postOnce(url, apiKey, { ...payloadBody, messages: textOnlyMessages }, timeoutMs)
      if (res.ok) return res
    }
  }
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    if (res.status === 401) throw new AiError(`模型「${model.name}」密钥无效，请检查环境变量 ${envKey}`, 503)
    if (res.status === 402) throw new AiError(`模型「${model.name}」对应账户余额不足，请先在对应平台充值`, 503)
    // 403：密钥没有该模型权限、账户受限，或所在网络被服务商拦截（返回体通常不是 JSON）
    if (res.status === 403) {
      console.error('[ai] provider forbidden', model.id, url, detail?.error?.message)
      throw new AiError(`模型「${model.name}」的服务拒绝了请求（403）：请检查 ${envKey} 对应账户的权限与状态；在预览环境中可能被网络限制，发布后在正式站点再试`, 503)
    }
    if (res.status === 429) throw new AiError('请求太频繁，请稍后再试', 429)
    if (res.status === 520) throw new AiError('当前预览环境不允许连接外部 AI 服务。请点击 Publish 发布后，在正式站点或自建服务器使用。', 503)
    console.error('[ai] provider error', model.id, url, res.status, detail?.error?.message)
    throw new AiError(detail?.error?.message ? `AI 服务出错：${detail.error.message.slice(0, 120)}` : 'AI 服务出错，请稍后重试')
  }
  return res
}

/** 不流式的一次调用（用于判断是否需要调用工具）。 */
export async function complete(model: AiModelConfig | string, messages: LlmMessage[], tools?: unknown[]) {
  const res = await post(model, { messages, ...(tools?.length ? { tools } : {}), stream: false }, 60_000)
  const json = (await res.json()) as { choices?: { message?: { content?: string | null; tool_calls?: LlmToolCall[] } }[]; usage?: TokenUsage }
  const msg: { content?: string | null; tool_calls?: LlmToolCall[]; usage?: TokenUsage } = json.choices?.[0]?.message ?? { content: '' }
  if (typeof msg.content === 'string') {
    msg.content = stripDsml(msg.content)
  }
  msg.usage = json.usage
  return msg
}

/** 流式调用：逐段回调正文和思考过程，返回完整正文。 */
export async function stream(
  model: AiModelConfig | string,
  messages: LlmMessage[],
  onDelta: (text: string) => void,
  onReasoning: (text: string) => void,
  signal?: AbortSignal,
  onUsage?: (usage: TokenUsage) => void,
) {
  // include_usage：让 OpenAI 兼容接口在最后一个分片返回 tokens 用量，用于按量计费
  const res = await post(model, { messages, stream: true, stream_options: { include_usage: true } }, 120_000)
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
        const chunk = JSON.parse(data) as { choices?: { delta?: { content?: string; reasoning_content?: string } }[]; usage?: TokenUsage | null }
        if (chunk.usage) onUsage?.(chunk.usage)
        const delta = chunk.choices?.[0]?.delta
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

/** 系统提示词：身份、业务背景、已激活插件指导原则与当前项目概况。 */
export function systemPrompt(
  project: Awaited<ReturnType<typeof loadProjectDocs>> | null,
  pluginIds: string[] = [],
  flags?: PluginFlags,
  sessionUploads: { name: string; mediaId: string; url: string }[] = [],
) {
  const lines = [
    '你是「繁梦空间」（FMKJ）全屋智能家居方案设计平台的 AI 助手，服务对象是方案设计师和安装团队。',
    '平台主流程：项目信息 → 点位图 → 报价 → 合同 → 归档。',
    '你拥有完整的系统操作工具，可以直接替用户完成：',
    '1. 查询/创建/修改项目与归档状态（list_projects, create_project, update_project）；',
    '2. 将用户拖入上传的户型图添加为项目点位图图纸并写入真实识别到的点位（add_floor_sheet），或将拖入的 fmkj-points JSON 导入点位图（import_points_json）；',
    '【重要规则】：当用户上传了户型图图片时，严禁调用 setup_rooms_and_points 生成网格默认点位！点位图打开时绝不能有未识别的默认点位——只有图像真实识别出点位（通过 add_floor_sheet 的 detectedPoints）或用户提供了点位 JSON（import_points_json）时才生成点位图标；若未识别出点位，保持点位图为空（0 点位），绝不虚构默认点位。',
    '【防失忆规则】：当用户在后续对话中说「重新生成 / 重新识别刚才的图 / 把全部点位导进去 / 只导开关」时，绝不要让用户重新上传图片！直接调用 add_floor_sheet 工具（可直接使用下方「当前项目已有图纸」或「本会话已上传图纸」中的 url 和 mediaId，甚至省略 url 让服务端自动复用当前图纸），并设置 replaceExisting=true（若需重新调用识别器则同时设置 redetect=true）。',
    '3. 检索 728 款产品库、按平台与档次一键选型或指定某类设备的默认产品（search_products, smart_select, set_project_defaults）；',
    '4. 进行房间点位完整度审查（room_insights）与按业主画像推荐方案模板（recommend_proposal_template）；',
    '5. 从点位图直接生成报价单草稿、修改报价单优惠/附加费/状态（get_project_details, create_or_update_quote）；',
    '6. 生成或修改项目合同、设置付款分期、标记签约与登记收款（create_or_update_contract）；',
    '7. 生成各类打印与导出文档的直达链接（get_document_links）。',
    '当用户提出创建或修改请求时，请主动调用对应工具直接完成操作（可分多步连续调用，例如：新建项目 → 布置房间和点位 → 智能选型 → 生成报价单），不要只给口头步骤。回答使用简体中文，简洁、准确。',
  ]
  const pluginLines = activePluginPromptLines(pluginIds, flags)
  if (pluginLines.length) {
    lines.push('', '已连接插件调用准则：', ...pluginLines)
  }
  if (project) {
    const p = project.project
    const realSheets = project.sheets.filter((s) => s.fileId !== 'blank-sheet' && s.url)
    const sheetSummary = realSheets.length
      ? realSheets
          .map((s) => {
            const mid = s.fileId?.startsWith('sheet-') ? s.fileId.slice(6) : ''
            return `「${s.name}」(url: ${s.url}${mid ? `, mediaId: ${mid}` : ''})`
          })
          .join('；')
      : '暂无已上传图纸（当前为空白示意图）'
    lines.push(
      '',
      `当前关联项目：${p.name}（ID: ${p.id}，客户：${p.customerName || '未填写'}，主平台：${p.platform || '待定'}）`,
      `点位 ${project.points.length} 个，房间 ${project.rooms.length} 个，图纸 ${project.sheets.length} 张，${project.pending} 个点位待选型。`,
      `当前项目已有图纸：${sheetSummary}`,
      `设备构成：${project.categories.map((c) => `${c.name} ${c.count}`).join('、') || '暂无'}`,
      `按当前选型的设备预算：${project.total.toFixed(0)} 元${project.quote ? `；最新报价「${project.quote.title}」合计 ${project.quote.total} 元` : ''}。`,
    )
  } else {
    lines.push('', '当前尚未关联具体项目。你可以调用 list_projects 查找已有项目，或调用 create_project 直接新建项目（新建后会自动关联）。')
  }
  if (sessionUploads.length > 0) {
    lines.push(
      '',
      `本会话历史已上传图纸记忆（用户说「重新生成/重新识别」时可直接复用）：${sessionUploads.map((u) => `${u.name} (mediaId: ${u.mediaId}, url: ${u.url})`).join('；')}`,
    )
  }
  return lines.join('\n')
}
