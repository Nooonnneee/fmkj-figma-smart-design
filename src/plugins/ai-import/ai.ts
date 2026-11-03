import { DESIGN_RULE_TEXT } from '@/lib/design-rules'
import type { PluginAiSpec } from '@/plugins/ai-types'

export const aiImportSpec: PluginAiSpec = {
  permissions: ['point-map:read', 'point-map:write'],
  guidance: [
    '当用户需要将外部识图 JSON 导入项目时，调用 import_points_json；当用户询问如何用视觉大模型识别户型图点位时，按 fmkj-points 协议输出标准 JSON 结构说明。',
  ],
  knowledge: [
    {
      id: 'fmkj-points-protocol',
      title: 'fmkj-points 户型图点位识别 JSON 协议',
      summary: '基于 3:2 标准图纸的 0~1 比例坐标记录房间区域与设备点位',
      rules: [
        '顶层结构：{ "format": "fmkj-points", "version": 1, "sheets": [{ "name": "一层平面图", "areas": [...], "points": [...] }] }。',
        '区域坐标：x, y, width, height 均为 0~1 相对图纸宽高的比例值，可选 polygon 多边形顶点数组。',
        '点位坐标：type 为标准设备类型代号，x, y 为 0~1 比例中心坐标，source 区分 "drawing"（照图识别）与 "design"（智能设计）。',
        DESIGN_RULE_TEXT,
      ],
    },
  ],
  tools: [],
  skills: [
    {
      id: 'tpl-blueprint-vision',
      name: '户型图 AI 识图协议生成',
      category: '图纸识图',
      description: '调用「AI 识别导入」插件，生成标准 3:2 户型图的房间与点位比例坐标识别指令',
      modelHint: 'vision',
      recommendedModelId: 'qwen-vl-plus',
      requiredPlugins: ['ai-import'],
      variables: [
        { key: 'sheetName', label: '图纸楼层', defaultValue: '一层平面图', options: ['一层平面图', '二层平面图', '地下室平面图', '全套标准图'] },
        { key: 'scope', label: '布点范围', defaultValue: '全屋点位（含灯光开关与传感）', options: ['全屋点位（含灯光开关与传感）', '仅智能开关与插座', '不含灯具（后装改造）'] },
      ],
      promptTemplate:
        '请按「AI 识别导入」插件规范，针对【{sheetName}】按【{scope}】生成 fmkj-points JSON 识图提示词与导入校验清单。',
    },
  ],
}
