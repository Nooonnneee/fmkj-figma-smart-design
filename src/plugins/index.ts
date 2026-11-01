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
    description: '侧边栏常驻 AI 助手，支持户型图识别、技能模板与跨插件自动执行。',
    status: 'ready',
    where: '左侧边栏「对话」模式、独立页 /ai',
    provides: ['侧边栏常驻对话', '对话技能模板', '多模型与积分', '跨插件联动'],
  },
  {
    id: 'doc-styles',
    name: '文档风格包',
    description: '为报价单、点位图、合同和交底清单解锁 4 套扩展视觉风格。',
    status: 'ready',
    where: '打印页顶部「风格」切换、设置 → 文档模板',
    provides: PLUGIN_DOC_STYLES.map((s) => s.name),
    docStyles: PLUGIN_DOC_STYLES,
  },
  {
    id: 'proposal',
    name: '方案演示',
    description: '将点位图、房间分析与预算一键生成 A4 横版提案并导出 PDF。',
    status: 'ready',
    where: '项目 → 点位「打印 / 方案」、项目 → 归档',
    provides: ['方案预览', '服务交付页'],
  },
  {
    id: 'room-insights',
    name: '房间智能分析',
    description: '按房间类型评估点位完整度，提供缺失提醒与联动场景建议。',
    status: 'ready',
    where: '项目 → 点位「区域」面板、方案演示',
    provides: ['配置完整度', '补充建议', '场景推荐'],
  },
  {
    id: 'smart-select',
    name: '智能选型',
    description: '按生态平台与预算档位，一键匹配全屋各设备类型的默认型号。',
    status: 'ready',
    where: '项目 → 点位「统计与默认型号」',
    provides: ['一键选型'],
  },
  {
    id: 'ai-import',
    name: 'AI 识别导入',
    description: '识别标准图纸中的开关插座与点位符号，支持导入导出点位 JSON。',
    status: 'ready',
    where: '项目 → 点位「AI 识别」标签页',
    provides: ['识别提示词', '导入识别结果', '导出点位 JSON'],
  },
  {
    id: 'dwg-import',
    name: 'DWG 导入',
    description: '上传 CAD DWG 图纸并自动转换为标准户型底图。',
    status: 'ready',
    where: '项目 → 点位「导入 DWG」',
    provides: ['导入 DWG'],
    payload: dwgConverterPlugin({ endpoint: process.env.DWG_CONVERTER_URL, token: process.env.DWG_CONVERTER_TOKEN }),
  },
  {
    id: 'site-survey',
    name: '现场勘测表',
    description: '记录配电箱、弱电箱、零火线与窗帘盒尺寸，导出勘测确认单。',
    status: 'coming-soon',
    where: '项目 → 信息 / 勘测记录',
    provides: ['勘测清单', '现场条件记录', '勘测单打印'],
  },
  {
    id: 'wiring-schedule',
    name: '强弱电布线表',
    description: '按点位图自动汇总开关回路、零火线与网线预留，生成水电交底单。',
    status: 'coming-soon',
    where: '项目 → 点位 / 施工交底',
    provides: ['回路汇总', '预留线缆清单', '水电交底单'],
  },
  {
    id: 'procurement',
    name: '采购与备货单',
    description: '按确认报价汇总采购清单，核对库存并生成到场核验单。',
    status: 'coming-soon',
    where: '项目 → 合同 / 备货核验',
    provides: ['采购汇总', '库存比对', '到货核验单'],
  },
  {
    id: 'scene-handover',
    name: '场景与账号移交',
    description: '生成全屋联动场景卡、网关设备绑定表与业主账号交接单。',
    status: 'coming-soon',
    where: '项目 → 归档 / 交付资料',
    provides: ['场景说明卡', '账号交接单', '维护指南'],
  },
  {
    id: 'after-sales',
    name: '售后维保记录',
    description: '管理质保期、设备更换与上门检修记录，留存项目配置备份。',
    status: 'coming-soon',
    where: '项目 → 归档 / 售后维保',
    provides: ['质保台账', '检修记录', '配置备份'],
  },
]

export const PLUGIN_IDS = PLUGINS.map((p) => p.id)
export const isPluginId = (v: unknown): v is PluginId => PLUGIN_IDS.includes(v as PluginId)
