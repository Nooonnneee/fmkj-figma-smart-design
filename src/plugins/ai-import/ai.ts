import { DESIGN_RULE_TEXT } from '@/lib/design-rules'
import type { PluginAiSpec } from '@/plugins/ai-types'

export const aiImportSpec: PluginAiSpec = {
  permissions: ['point-map:read', 'point-map:write'],
  guidance: [
    '当用户需要将外部识图 JSON 导入项目时，调用 import_points_json；当用户询问如何用视觉大模型识别户型图点位时，按 fmkj-points 协议输出标准 JSON 结构说明。',
  ],
  knowledge: [
    {
      id: 'switch-plan-vision-first',
      title: '开关布置图视觉直读策略',
      summary: '彩色铭牌开关图以视觉模型直读点位为主，本地几何识别只做吸附校验；插座只统计不落点',
      rules: [
        '彩色底白字开关铭牌图优先让视觉模型直读点位，本地几何识别仅负责坐标吸附、去重与按图纸标注数量补缺。',
        '插座（四孔/五孔/16A/网插）只统计 socketCount，不生成点位。',
        '图纸文字统计与实际点位数不一致时，在确认文案中提示差异，由人工核对。',
      ],
    },
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
      id: 'tpl-switch-plan-recognition',
      name: '开关布置图识别（插座不落点）',
      category: '图纸识图',
      description: '按视觉直读模式识别开关面板与智能屏，读取图例和插座数量，但不生成插座点位',
      modelHint: 'vision',
      recommendedModelId: 'qwen3.7-plus',
      requiredPlugins: ['ai-import'],
      variables: [
        {
          key: 'scope',
          label: '识别范围',
          defaultValue: '仅开关面板与智能屏',
          options: ['仅开关面板与智能屏', '开关面板 + 灯具'],
        },
      ],
      promptTemplate:
        '请按【{scope}】重新识别当前图纸：先读图例和房间文字统计，再让视觉模型直读开关面板/智能屏点位；本地几何识别只做坐标吸附与补缺。插座只统计数量，不生成点位。',
    },
    {
      id: 'tpl-blueprint-vision',
      name: '户型图 AI 识图协议生成',
      category: '图纸识图',
      description: '调用「AI 识别导入」插件，生成标准 3:2 户型图的房间与点位比例坐标识别指令',
      modelHint: 'vision',
      recommendedModelId: 'qwen-vl-plus',
      requiredPlugins: ['ai-import'],
      variables: [
        {
          key: 'sheetName',
          label: '图纸楼层',
          defaultValue: '一层平面图',
          options: ['一层平面图', '二层平面图', '地下室平面图', '全套标准图'],
        },
        {
          key: 'scope',
          label: '布点范围',
          defaultValue: '全屋点位（含灯光开关与传感）',
          options: ['全屋点位（含灯光开关与传感）', '仅智能开关与插座', '不含灯具（后装改造）'],
        },
      ],
      promptTemplate:
        '请按「AI 识别导入」插件规范，针对【{sheetName}】按【{scope}】生成 fmkj-points JSON 识图提示词与导入校验清单。',
    },
  ],
}
