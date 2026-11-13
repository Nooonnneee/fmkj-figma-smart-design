import type { AiToolSpec } from '@/plugins/ai-types'

/**
 * 点位图逐点位编辑工具（核心 ai-copilot 插件）。
 *
 * 现有工具的缺口：只能整图导入 / 重新识别，不能改单个点位或房间。
 * 这里补上「先读场景拿 id，再按 id 增删改」的两步式工具：
 * - list_point_map：只读，返回图纸 / 房间 / 点位的紧凑摘要与真实 id；
 * - edit_point_map：一次调用组合执行 add / move / remove / update，逐条返回结果。
 *
 * 注册接线（HANDLER_MAP / PLUGIN_AI_SPECS）由主控统一处理，本文件只导出规格。
 */
export const pointMapToolSpecs: AiToolSpec[] = [
  {
    name: 'list_point_map',
    title: '查看点位图',
    description:
      '读取当前项目点位图的紧凑摘要：图纸（sheetId）、房间/区域（id、名称、范围或多边形）和点位（id、代号、设备类型、场景坐标、所属图纸/房间、型号）。当用户要求移动、删除、新增或修改某个点位/房间，或询问「客厅有哪些点位」「这个点位在哪」时，先调用本工具拿到真实 id，再用 edit_point_map 执行；不要凭空编造 id。坐标是点位图场景坐标（点位中心，与编辑器一致），不是毫米或比例。',
    cost: 0.2,
    permissions: ['point-map:read'],
    scope: 'project',
    mutates: false,
    projectArg: 'projectId',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: '项目 ID（可选，不传则读取当前关联项目）',
        },
      },
    },
  },
  {
    name: 'edit_point_map',
    title: '编辑点位图',
    description:
      '按 id 逐条修改当前项目的点位图，一次调用可组合多个 add / move / remove / update。适用场景：用户说「把客厅那个插座往右移 20 厘米」「删掉主卧的人体传感器」「在书房加一个双开」「把主卧改名为次卧并调一下区域范围」等。执行前先用 list_point_map 拿到点位/房间的真实 id（或用 add 新增后返回的 id）；不要编造 id。坐标使用点位图场景坐标（点位中心）：move 可用 x/y 绝对坐标或 dx/dy 相对偏移；add 可只给 sheetId/roomId 让点位落在图纸/房间中心。单次最多 50 条，超出时整批不执行。每条编辑都会返回成功或跳过原因，不会静默失败。',
    cost: 1,
    permissions: ['point-map:write'],
    scope: 'project',
    mutates: true,
    projectArg: 'projectId',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: '项目 ID（可选，不传则修改当前关联项目）',
        },
        add: {
          type: 'array',
          description: '新增点位',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                description:
                  '设备类型（字典值或中文名）：switch-1/2/3/4（单/双/三/四开）、socket、socket-double、socket-usb、downlight、spotlight、track-light、ceiling-light、light-strip、curtain-track、motion-sensor、contact-sensor、water-sensor、smoke-sensor、temp-sensor、camera、doorbell、smart-lock、gateway、touch-panel、speaker、ac-router、ap-node、network-panel、vrf-controller 等',
              },
              label: {
                type: 'string',
                description:
                  '点位代号（画布上显示的名称/编号，如 K1、Z3）；不传则按设备类型自动生成',
              },
              x: {
                type: 'number',
                description: '点位中心 x（场景坐标）；与 y 一起省略时落在 roomId/sheetId 中心',
              },
              y: { type: 'number', description: '点位中心 y（场景坐标）' },
              sheetId: {
                type: 'string',
                description: '目标图纸 id（list_point_map 的 sheets[].id；可选）',
              },
              roomId: {
                type: 'string',
                description:
                  '目标房间 id（list_point_map 的 areas[].id；可选，优先于 sheetId 定位）',
              },
              productId: {
                type: 'string',
                description: '指定产品库型号 id（可选；不传则按项目默认型号/自动选型）',
              },
            },
            required: ['type'],
          },
        },
        move: {
          type: 'array',
          description: '移动点位（可一次移动多个）',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: '点位 id（list_point_map 的 points[].id）' },
              x: { type: 'number', description: '移动后的点位中心 x（场景坐标）' },
              y: { type: 'number', description: '移动后的点位中心 y（场景坐标）' },
              dx: {
                type: 'number',
                description: '相对当前中心的水平偏移（正数向右）；与 x 二选一',
              },
              dy: {
                type: 'number',
                description: '相对当前中心的垂直偏移（正数向下）；与 y 二选一',
              },
            },
            required: ['id'],
          },
        },
        remove: {
          type: 'array',
          description: '删除点位或房间（删除房间不会删除房间里的点位）',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: '点位 id（points[].id）或房间 id（areas[].id）',
              },
            },
            required: ['id'],
          },
        },
        update: {
          type: 'array',
          description: '修改点位名称/类型/型号，或修改房间名称/类型/多边形',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: '点位 id 或房间 id（决定 update 的对象）',
              },
              name: {
                type: 'string',
                description: '点位：新代号（画布显示名称）；房间：新房间名',
              },
              label: { type: 'string', description: '点位代号（name 的别名）' },
              type: { type: 'string', description: '点位：新设备类型（字典值或中文名）' },
              productId: {
                type: ['string', 'null'],
                description: '点位：指定产品型号 id；传 null 清除指定型号',
              },
              areaType: {
                type: 'string',
                description:
                  '房间：房间类型（entrance/living/dining/kitchen/bedroom/kids/study/bathroom/balcony/corridor/cloakroom/utility）',
              },
              polygon: {
                type: ['array', 'null'],
                description:
                  '房间：场景坐标多边形 [[x,y],…]（至少 3 个顶点）；传 null 或 [] 恢复矩形范围。不传 polygon 时只改名称/类型',
                items: {
                  type: 'array',
                  items: { type: 'number' },
                  minItems: 2,
                  maxItems: 2,
                },
              },
            },
            required: ['id'],
          },
        },
      },
    },
  },
]
