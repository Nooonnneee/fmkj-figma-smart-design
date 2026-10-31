import type { AiModelOption } from '@/components/ai/ai-elements'
import type { PluginId } from '@/plugins/types'

/**
 * 受信任的 AI 渠道白名单：
 * 每个渠道的请求域名（baseUrl）与密钥环境变量名（apiKeyEnv）在服务端严格一对一绑定，
 * 严禁客户端自定义任意 URL 或读取任意环境变量，从根源杜绝 SSRF 与密钥外带。
 */
export const AI_PROVIDER_CHANNELS = {
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek 官方',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
  },
  newapi: {
    id: 'newapi',
    label: 'NewAPI / OneAPI 聚合网关',
    // 聚合网关地址仅从服务端环境变量 NEWAPI_BASE_URL / APP_OPENAI_BASE_URL 读取
    baseUrl: 'env:NEWAPI_BASE_URL',
    apiKeyEnv: 'NEWAPI_API_KEY',
  },
  siliconflow: {
    id: 'siliconflow',
    label: '硅基流动 SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    apiKeyEnv: 'SILICONFLOW_API_KEY',
  },
  dashscope: {
    id: 'dashscope',
    label: '阿里百炼（通义千问）',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeyEnv: 'DASHSCOPE_API_KEY',
  },
  ark: {
    id: 'ark',
    label: '火山方舟（豆包）',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    apiKeyEnv: 'ARK_API_KEY',
  },
  moonshot: {
    id: 'moonshot',
    label: '月之暗面 Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    apiKeyEnv: 'MOONSHOT_API_KEY',
  },
  zhipu: {
    id: 'zhipu',
    label: '智谱清言 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    apiKeyEnv: 'ZHIPU_API_KEY',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyEnv: 'OPENROUTER_API_KEY',
  },
} as const

export type AiProviderChannelId = keyof typeof AI_PROVIDER_CHANNELS
export const AI_PROVIDER_CHANNEL_LIST = Object.values(AI_PROVIDER_CHANNELS)

export function isAiProviderChannelId(v: unknown): v is AiProviderChannelId {
  return typeof v === 'string' && v in AI_PROVIDER_CHANNELS
}

export type AiModelConfig = AiModelOption & {
  /** 绑定的受信任渠道 ID（决定服务端使用的固定 Base URL 与环境变量） */
  channelId: AiProviderChannelId
  /** 实际传给接口的 model 参数名（如 deepseek-chat、gpt-4o、qwen-max） */
  apiModel: string
  /** 只读展示：由 channelId 决定的接口地址说明 */
  baseUrl: string
  /** 只读展示：由 channelId 决定的环境变量名 */
  apiKeyEnv: string
  /** 是否启用（开启后出现在网页与小程序的模型选择列表中） */
  enabled: boolean
  /** 是否为默认选中模型 */
  isDefault?: boolean
}

/**
 * 系统内置默认模型（未在后台自定义时使用）。
 */
export const DEFAULT_AI_MODELS: AiModelConfig[] = [
  {
    id: 'deepseek-flash',
    name: 'DeepSeek V4.1-Flash-1017',
    provider: AI_PROVIDER_CHANNELS.deepseek.label,
    channelId: 'deepseek',
    tag: '默认 · 工具调用',
    cost: 1,
    description: '高速长上下文模型（1M 上下文），支持多步调用系统工具与已启用插件',
    apiModel: 'deepseek-flash',
    baseUrl: AI_PROVIDER_CHANNELS.deepseek.baseUrl,
    apiKeyEnv: AI_PROVIDER_CHANNELS.deepseek.apiKeyEnv,
    enabled: true,
    isDefault: true,
  },
]

export const AI_MODELS: AiModelOption[] = DEFAULT_AI_MODELS

/** 后台「设置 → AI 模型与接口」里可一键添加的常用官方 API 与 NewAPI 聚合网关预设 */
export const AI_PROVIDER_PRESETS: Omit<AiModelConfig, 'id' | 'enabled' | 'isDefault'>[] = [
  {
    name: 'NewAPI / OneAPI 聚合模型',
    provider: AI_PROVIDER_CHANNELS.newapi.label,
    channelId: 'newapi',
    tag: '聚合网关 · 多模型',
    cost: 1,
    description: '通过自建 NewAPI / OneAPI 统一网关调用各类大模型（兼容 OpenAI /v1/chat/completions）',
    apiModel: 'gpt-4o-mini',
    baseUrl: AI_PROVIDER_CHANNELS.newapi.baseUrl,
    apiKeyEnv: AI_PROVIDER_CHANNELS.newapi.apiKeyEnv,
    reasoning: false,
  },
  {
    name: 'DeepSeek V3（官方）',
    provider: AI_PROVIDER_CHANNELS.deepseek.label,
    channelId: 'deepseek',
    tag: '主力 · 工具调用',
    cost: 1,
    description: 'DeepSeek 官方主力对话模型，擅长全屋智能点位规划、选型与报价工具调用',
    apiModel: 'deepseek-chat',
    baseUrl: AI_PROVIDER_CHANNELS.deepseek.baseUrl,
    apiKeyEnv: AI_PROVIDER_CHANNELS.deepseek.apiKeyEnv,
    reasoning: false,
  },
  {
    name: 'DeepSeek R1（深度思考）',
    provider: AI_PROVIDER_CHANNELS.deepseek.label,
    channelId: 'deepseek',
    tag: '深度推理',
    cost: 2,
    description: 'DeepSeek 深度推理模型，适合复杂别墅多层方案审查与预算优化分析',
    apiModel: 'deepseek-reasoner',
    baseUrl: AI_PROVIDER_CHANNELS.deepseek.baseUrl,
    apiKeyEnv: AI_PROVIDER_CHANNELS.deepseek.apiKeyEnv,
    reasoning: true,
  },
  {
    name: '硅基流动 SiliconFlow（DeepSeek V3）',
    provider: AI_PROVIDER_CHANNELS.siliconflow.label,
    channelId: 'siliconflow',
    tag: '国内聚合 · 高速',
    cost: 1,
    description: '通过硅基流动聚合 API 调用开源与商业模型，一个 Key 切换多模型',
    apiModel: 'deepseek-ai/DeepSeek-V3',
    baseUrl: AI_PROVIDER_CHANNELS.siliconflow.baseUrl,
    apiKeyEnv: AI_PROVIDER_CHANNELS.siliconflow.apiKeyEnv,
    reasoning: false,
  },
  {
    name: '通义千问 Qwen-Plus（阿里百炼）',
    provider: AI_PROVIDER_CHANNELS.dashscope.label,
    channelId: 'dashscope',
    tag: '阿里百炼 · 稳定',
    cost: 1,
    description: '阿里云百炼 OpenAI 兼容接口，支持工具调用与长文本方案生成',
    apiModel: 'qwen-plus',
    baseUrl: AI_PROVIDER_CHANNELS.dashscope.baseUrl,
    apiKeyEnv: AI_PROVIDER_CHANNELS.dashscope.apiKeyEnv,
    reasoning: false,
  },
  {
    name: '豆包 Doubao-Pro（火山方舟）',
    provider: AI_PROVIDER_CHANNELS.ark.label,
    channelId: 'ark',
    tag: '火山引擎',
    cost: 1,
    description: '字节跳动火山方舟 OpenAI 兼容接口（可将模型名替换为你的推理接入点 ep-xxxx）',
    apiModel: 'doubao-1-5-pro-32k-250115',
    baseUrl: AI_PROVIDER_CHANNELS.ark.baseUrl,
    apiKeyEnv: AI_PROVIDER_CHANNELS.ark.apiKeyEnv,
    reasoning: false,
  },
  {
    name: 'Kimi（月之暗面 Moonshot）',
    provider: AI_PROVIDER_CHANNELS.moonshot.label,
    channelId: 'moonshot',
    tag: '长上下文',
    cost: 1,
    description: 'Moonshot OpenAI 兼容接口，适合超长清单与方案文档分析',
    apiModel: 'kimi-k2-0711-preview',
    baseUrl: AI_PROVIDER_CHANNELS.moonshot.baseUrl,
    apiKeyEnv: AI_PROVIDER_CHANNELS.moonshot.apiKeyEnv,
    reasoning: false,
  },
]

const cleanStr = (v: unknown, max: number, fallback = '') =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback

/** 解析并校验后台保存的 AI 模型列表；为空时回退到默认模型。 */
export function parseAiModels(value: unknown): AiModelConfig[] {
  if (!Array.isArray(value) || value.length === 0) return DEFAULT_AI_MODELS.map((m) => ({ ...m }))
  const out: AiModelConfig[] = []
  const seen = new Set<string>()
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const name = cleanStr(r.name, 80)
    const apiModel = cleanStr(r.apiModel, 120)
    const rawId = cleanStr(r.id, 60) || apiModel
    const id = rawId.replace(/[^a-zA-Z0-9._:-]/g, '-')
    const channelId: AiProviderChannelId = isAiProviderChannelId(r.channelId) ? r.channelId : 'deepseek'
    const channel = AI_PROVIDER_CHANNELS[channelId]
    if (!id || !name || !apiModel || seen.has(id)) continue
    seen.add(id)
    const costNum = Number(r.cost)
    out.push({
      id,
      name,
      provider: channel.label,
      channelId,
      tag: cleanStr(r.tag, 40, '工具调用'),
      cost: Number.isInteger(costNum) && costNum >= 0 && costNum <= 100 ? costNum : 1,
      description: cleanStr(r.description, 200, `${name}（${apiModel}）`),
      reasoning: Boolean(r.reasoning),
      apiModel,
      // 强制使用受信任渠道的固定 baseUrl 与 apiKeyEnv，忽略客户端传入的任何自定义 URL 或变量名
      baseUrl: channel.baseUrl,
      apiKeyEnv: channel.apiKeyEnv,
      enabled: r.enabled !== false,
      isDefault: Boolean(r.isDefault),
    })
  }
  if (out.length === 0) return DEFAULT_AI_MODELS.map((m) => ({ ...m }))
  if (!out.some((m) => m.enabled)) out[0].enabled = true
  if (!out.some((m) => m.enabled && m.isDefault)) {
    const firstEnabled = out.find((m) => m.enabled) ?? out[0]
    firstEnabled.isDefault = true
  }
  return out
}

/** 获取当前已启用且排好序的模型（默认模型排第一）。 */
export function enabledAiModels(models: AiModelConfig[]): AiModelConfig[] {
  const active = models.filter((m) => m.enabled)
  const list = active.length ? active : [models[0] ?? DEFAULT_AI_MODELS[0]]
  return [...list].sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0))
}

export type AiTemplateVariable = {
  key: string
  label: string
  defaultValue: string
  options?: string[]
}

/**
 * 面向高级用户的可复用 AI 对话技能模板：
 * 每个模板绑定推荐模型、自动挂载的插件、结构化变量槽位与提示词正文。
 */
export type AiPromptTemplate = {
  id: string
  name: string
  category: '点位审查' | '选型报价' | '图纸识图' | '交付话术' | '自定义'
  description: string
  recommendedModelId: string
  requiredPlugins: PluginId[]
  variables: AiTemplateVariable[]
  promptTemplate: string
}

export const DEFAULT_AI_TEMPLATES: AiPromptTemplate[] = [
  {
    id: 'tpl-room-audit',
    name: '房间点位完整度审查',
    category: '点位审查',
    description: '调用「房间智能分析」插件，按户型逐间检查必配点位、安防传感器与双控遗漏',
    recommendedModelId: 'deepseek-flash',
    requiredPlugins: ['room-insights'],
    variables: [
      { key: 'layout', label: '户型结构', defaultValue: '三室两厅两卫', options: ['两室两厅一卫', '三室两厅两卫', '四室两厅三卫', '复式 / 别墅'] },
      { key: 'focus', label: '审查重点', defaultValue: '照明回路与安防传感器', options: ['照明回路与安防传感器', '全屋无主灯调光', '老人与儿童看护', '精装房后装改造'] },
    ],
    promptTemplate:
      '请按【{layout}】户型标准，调用「房间智能分析」插件审查当前项目的点位配置（重点关注：{focus}），列出缺失点位、原因及推荐联动场景。',
  },
  {
    id: 'tpl-smart-select',
    name: '按平台与档次一键配单',
    category: '选型报价',
    description: '调用「智能选型」插件，按指定生态平台和预算档次匹配全屋默认设备型号',
    recommendedModelId: 'deepseek-flash',
    requiredPlugins: ['smart-select', 'room-insights'],
    variables: [
      { key: 'platform', label: '主平台', defaultValue: '米家', options: ['米家', 'Apple Home', '华为', '涂鸦', 'Matter', 'KNX'] },
      { key: 'tier', label: '配置档次', defaultValue: '标准档', options: ['经济档', '标准档', '高端档'] },
    ],
    promptTemplate:
      '请调用「智能选型」插件，以【{platform}】为主平台、按【{tier}】预算标准，为当前项目的开关、窗帘、门锁、传感器与网关推荐默认型号组合，并说明选型理由。',
  },
  {
    id: 'tpl-blueprint-vision',
    name: '户型图 AI 识图协议生成',
    category: '图纸识图',
    description: '调用「AI 识别导入」插件，生成标准 3:2 户型图的房间与点位比例坐标识别指令',
    recommendedModelId: 'deepseek-flash',
    requiredPlugins: ['ai-import'],
    variables: [
      { key: 'sheetName', label: '图纸楼层', defaultValue: '一层平面图', options: ['一层平面图', '二层平面图', '地下室平面图', '全套标准图'] },
      { key: 'scope', label: '布点范围', defaultValue: '全屋点位（含灯光开关与传感）', options: ['全屋点位（含灯光开关与传感）', '仅智能开关与插座', '不含灯具（后装改造）'] },
    ],
    promptTemplate:
      '请调用「AI 识别导入」插件，针对【{sheetName}】按【{scope}】生成 fmkj-points JSON 识图提示词与导入校验清单。',
  },
  {
    id: 'tpl-qixu-handover',
    name: '栖序提案与付款验收说明',
    category: '交付话术',
    description: '结合「方案演示」与「文档风格包」，生成客户汇报话术、三阶段付款说明与共同验收清单',
    recommendedModelId: 'deepseek-flash',
    requiredPlugins: ['proposal', 'doc-styles'],
    variables: [
      { key: 'paymentSplit', label: '付款比例', defaultValue: '40% / 50% / 10%', options: ['40% / 50% / 10%', '30% / 60% / 10%', '50% / 40% / 10%'] },
      { key: 'warranty', label: '质保与维护', defaultValue: '设备质保 12 个月，含 1 年上门联调', options: ['设备质保 12 个月，含 1 年上门联调', '设备质保 24 个月，含季度巡检'] },
    ],
    promptTemplate:
      '请调用「方案演示」与「文档风格包」插件，按栖序提案「08 服务交付 · 付款与确认」结构，采用【{paymentSplit}】付款节点与【{warranty}】条款，生成给客户的方案汇报话术与现场验收确认要点。',
  },
  {
    id: 'tpl-wiring-deep',
    name: '水电交底与零火线预留清单',
    category: '点位审查',
    description: '针对现场水电施工交底，按点位汇总零火线、窗帘盒电源、网口与网关位置要求',
    recommendedModelId: 'deepseek-flash',
    requiredPlugins: ['room-insights', 'proposal'],
    variables: [
      { key: 'stage', label: '施工阶段', defaultValue: '水电开槽布管前', options: ['水电开槽布管前', '吊顶木工封板前', '油漆完工安装前'] },
    ],
    promptTemplate:
      '当前项目处于【{stage}】阶段，请结合项目点位生成一份给水电工与项目经理的强弱电预留交底注意事项（含零火线、底盒深度、窗帘电源与网关网口要求）。',
  },
]

export function fillPromptTemplate(tpl: AiPromptTemplate, values: Record<string, string>): string {
  let out = tpl.promptTemplate
  for (const v of tpl.variables) {
    const val = values[v.key] ?? v.defaultValue
    out = out.replaceAll(`{${v.key}}`, val)
  }
  return out
}
