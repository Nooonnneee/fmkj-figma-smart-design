import type { PluginAiSpec } from './ai-types'
import { PLUGIN_DOC_STYLES } from './doc-styles/styles'
import type { PluginId } from './types'

/** 其余工程与文档插件的 AI 元数据声明（知识、指导与权限） */
export const EXTRA_PLUGIN_AI_SPECS: Partial<Record<PluginId, PluginAiSpec>> = {
  'doc-styles': {
    permissions: ['documents:read'],
    guidance: ['生成打印或导出链接时，可根据客户偏好传入 style 参数切换文档视觉风格。'],
    knowledge: [
      {
        id: 'doc-styles-catalog',
        title: '文档视觉风格包清单',
        summary: `内置极简默认风格 + ${PLUGIN_DOC_STYLES.length} 套扩展视觉风格`,
        rules: PLUGIN_DOC_STYLES.map((s) => `${s.name}(${s.id})：${s.description}`),
      },
    ],
    tools: [],
    skills: [],
  },
  'dwg-import': {
    permissions: ['point-map:write'],
    guidance: ['用户询问 CAD .dwg 文件如何导入时，引导其在点位图工作台顶部点击「导入 DWG」自动转换为 3:2 标准户型底图。'],
    knowledge: [
      {
        id: 'dwg-conversion-spec',
        title: 'CAD DWG 自动转换规范',
        summary: '将 .dwg 矢量工程图转换为去图框的 3:2 标准 PNG 底图',
        rules: ['支持直接上传 .dwg 文件，服务端转换后进入标准图框裁切器，与手传 PNG 户型图拥有完全一致的标定与布点体验。'],
      },
    ],
    tools: [],
    skills: [],
  },
  'site-survey': {
    permissions: ['projects:read', 'documents:read'],
    guidance: ['用户准备去工地现场勘测时，可生成现场勘测单打印链接（/print/projects/[id]/survey）并提醒核对配电箱、弱电箱、零火线与窗帘盒尺寸。'],
    knowledge: [
      {
        id: 'site-survey-checklist',
        title: '现场勘测核心核对项',
        summary: '进场前必查的强弱电、网络、窗帘盒与安装环境条件',
        rules: [
          '强电条件：每个开关底盒是否预留零线（零火供电）、底盒深度是否 ≥ 50mm。',
          '窗帘条件：窗帘盒宽度（单轨 ≥ 10cm，双轨 ≥ 18cm）、侧墙左/右上角是否预留五孔电源插座。',
          '弱电与网络：弱电箱尺寸及散热、各房间超六类网线是否汇聚至弱电箱、主路由与 PoE 交换机安装空间。',
        ],
      },
    ],
    tools: [],
    skills: [],
  },
  'wiring-schedule': {
    permissions: ['point-map:read', 'documents:read'],
    guidance: ['用户需要给水电工交底时，可提供强弱电布线表打印链接（/print/projects/[id]/wiring）并按房间汇总零火线与网线需求。'],
    knowledge: [
      {
        id: 'wiring-schedule-rules',
        title: '强弱电布线与回路交底规范',
        summary: '按设备类型自动映射供电方式、预留线缆与底盒要求',
        rules: [
          '智能开关/中控屏：86 型深底盒（≥50mm），必须预留零火线（L+N），中控屏位置建议额外预留六类网线。',
          '吸顶 AP / 面板 AP：超六类网线直通弱电箱 PoE 交换机（PoE 供电，无需强电插座）。',
          '电动窗帘：窗帘盒内距顶 20–30cm 预留 10A 五孔插座（常电，不受墙壁开关控制）。',
        ],
      },
    ],
    tools: [],
    skills: [],
  },
  procurement: {
    permissions: ['quotes:read', 'catalog:read', 'documents:read'],
    guidance: ['项目签约备货阶段，可提供采购与备货核验单链接（/print/projects/[id]/procurement），支持切换是否显示内部成本价。'],
    knowledge: [
      {
        id: 'procurement-workflow',
        title: '采购与到货核验流程',
        summary: '基于定稿报价汇总 SKU 数量、比对库存并生成到场签收表',
        rules: ['采购单自动合并同一 SKU 在不同房间的数量，支持导出含成本内部采购单或不含成本的仓库备货核验单。'],
      },
    ],
    tools: [],
    skills: [],
  },
  'scene-handover': {
    permissions: ['point-map:read', 'documents:read'],
    guidance: ['项目完工交付业主时，可生成场景与账号移交单（/print/projects/[id]/handover），包含全屋联动场景说明卡与主平台账号交接表。'],
    knowledge: [
      {
        id: 'scene-handover-spec',
        title: '场景与账号移交规范',
        summary: '将项目匹配的智能联动场景、网关绑定关系与 App 账号密码整理成业主留存手册',
        rules: ['移交单包含：1. 业主家庭成员账号权限表；2. 各房间已配置的智能场景触发词与按键说明；3. 断网/断电重启恢复指引。'],
      },
    ],
    tools: [],
    skills: [],
  },
  'after-sales': {
    permissions: ['projects:read', 'contracts:read'],
    guidance: ['解答售后质保问题时，优先读取项目合同中的质保月数（warrantyMonths）与签约日期计算质保到期日。'],
    knowledge: [
      {
        id: 'after-sales-policy',
        title: '售后维保与配置备份规范',
        summary: '按合同质保期追踪设备更换与上门检修记录',
        rules: ['标准合同默认提供 12 个月设备质保与上门联调服务，归档时留存点位图与报价快照作为维保基准。'],
      },
    ],
    tools: [],
    skills: [],
  },
}
