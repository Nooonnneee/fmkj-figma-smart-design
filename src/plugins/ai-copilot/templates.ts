import type { AiModelOption } from '@/components/ai/ai-elements'
import type { PluginId } from '@/plugins/types'

/**
 * 默认模型清单：当前仅保留 DeepSeek V4.1-Flash-1017（API 模型 ID 为 deepseek-flash）。
 * 后续接入更多模型时在此数组追加即可。
 */
export const AI_MODELS: AiModelOption[] = [
  {
    id: 'deepseek-flash',
    name: 'DeepSeek V4.1-Flash-1017',
    provider: 'DeepSeek',
    tag: '默认 · 工具调用',
    cost: 1,
    description: '高速长上下文模型（1M 上下文），支持多步调用系统工具与已启用插件',
  },
]

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
