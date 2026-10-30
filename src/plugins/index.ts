import { dwgConverterPlugin } from './dwg-converter'
import { PLUGIN_DOC_STYLES } from './doc-styles/styles'
import type { AppPlugin, PluginId } from './types'

export type { AppPlugin, PluginId } from './types'

/**
 * 已安装的插件。新增插件：在 src/plugins/<id>/ 写好功能，再在这里登记清单。
 * 主链路（项目信息、点位布置、报价、合同、归档、产品库、设置）不依赖任何插件。
 */
export const PLUGINS: AppPlugin[] = [
  {
    id: 'ai-copilot',
    name: 'AI 对话侧栏（高级）',
    description: '面向高级用户的 Figma Make 式侧边栏对话工作台：在左侧边栏边看项目边对话，支持技能模板库、多模型切换、积分计费与跨插件调用。关闭后侧边栏恢复纯导航模式。',
    status: 'ready',
    where: '左侧边栏「对话」模式、独立页 /ai',
    provides: ['侧边栏常驻对话', '对话技能模板', '多模型与积分', '跨插件联动'],
  },
  {
    id: 'doc-styles',
    name: '文档风格包',
    description: '为报价单、点位图、合同、点位交底清单增加风格。关闭后只保留「简约」风格。',
    status: 'ready',
    where: '打印页顶部「风格」切换、设置 → 文档模板',
    provides: PLUGIN_DOC_STYLES.map((s) => s.name),
    docStyles: PLUGIN_DOC_STYLES,
  },
  {
    id: 'proposal',
    name: '方案演示',
    description: '把点位、房间和预算生成横版方案（现代简约、高端提案、施工交底、栖序提案），可打印或导出 PDF。',
    status: 'ready',
    where: '项目 → 点位「打印 / 方案」、项目 → 归档',
    provides: ['方案预览', '服务交付页'],
  },
  {
    id: 'room-insights',
    name: '房间智能分析',
    description: '按房间类型检查点位配置完整度，给出补充建议和场景推荐，显示在点位「区域」面板和方案里。',
    status: 'ready',
    where: '项目 → 点位「区域」面板、方案演示',
    provides: ['配置完整度', '补充建议', '场景推荐'],
  },
  {
    id: 'smart-select',
    name: '智能选型',
    description: '按主平台和经济 / 标准 / 高端档次，一键给各设备类型设置项目默认型号。',
    status: 'ready',
    where: '项目 → 点位「统计与默认型号」',
    provides: ['一键选型'],
  },
  {
    id: 'ai-import',
    name: 'AI 识别导入',
    description: '复制识别提示词，把标准图纸交给 AI 识别点位，再把结果一键导入点位图；也可以导出点位数据。',
    status: 'ready',
    where: '项目 → 点位「AI 识别」标签页',
    provides: ['识别提示词', '导入识别结果', '导出点位 JSON'],
  },
  {
    id: 'dwg-import',
    name: 'DWG 导入',
    description: '上传 DWG 自动转换成户型图（需要在服务器配置 DWG_CONVERTER_URL）。',
    status: 'ready',
    where: '项目 → 点位「导入 DWG」',
    provides: ['导入 DWG'],
    payload: dwgConverterPlugin({ endpoint: process.env.DWG_CONVERTER_URL, token: process.env.DWG_CONVERTER_TOKEN }),
  },
  {
    id: 'site-survey',
    name: '现场勘测表',
    description: '勘测阶段记录配电箱、弱电箱、零火线条件、网络覆盖与窗帘盒尺寸，导出勘测确认单。',
    status: 'coming-soon',
    where: '项目 → 信息 / 勘测记录',
    provides: ['勘测清单', '现场条件记录', '勘测单打印'],
  },
  {
    id: 'wiring-schedule',
    name: '强弱电布线表',
    description: '根据点位图自动汇总各房间开关回路、零火线预留、网线与插座点位，交给水电工交底。',
    status: 'coming-soon',
    where: '项目 → 点位 / 施工交底',
    provides: ['回路汇总', '预留线缆清单', '水电交底单'],
  },
  {
    id: 'procurement',
    name: '采购与备货单',
    description: '按已确认报价汇总设备采购清单，核对产品库库存并生成到场核验单。',
    status: 'coming-soon',
    where: '项目 → 合同 / 备货核验',
    provides: ['采购汇总', '库存比对', '到货核验单'],
  },
  {
    id: 'scene-handover',
    name: '场景与账号移交',
    description: '整理全屋联动场景说明、网关与子设备绑定表、业主账号移交与日常维护卡。',
    status: 'coming-soon',
    where: '项目 → 归档 / 交付资料',
    provides: ['场景说明卡', '账号交接单', '维护指南'],
  },
  {
    id: 'after-sales',
    name: '售后维保记录',
    description: '管理项目质保期、设备更换与上门检修记录，留存配置备份。',
    status: 'coming-soon',
    where: '项目 → 归档 / 售后维保',
    provides: ['质保台账', '检修记录', '配置备份'],
  },
]

export const PLUGIN_IDS = PLUGINS.map((p) => p.id)
export const isPluginId = (v: unknown): v is PluginId => PLUGIN_IDS.includes(v as PluginId)
