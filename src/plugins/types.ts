import type { Plugin as PayloadPlugin } from 'payload'

import type { DocStyle } from '@/documents/types'

/**
 * 插件清单。核心只保留主链路（信息 → 点位 → 报价 → 合同 → 归档），外围功能都以插件提供，
 * 可以在侧边栏「插件」里单独开关。清单文件只放数据和服务端配置，不引用界面组件，
 * 这样 Payload 配置（含命令行）也能安全加载。
 */
export type AppPlugin = {
  id: PluginId
  name: string
  description: string
  /** 插件开发状态：ready 可开关使用；coming-soon 尚未开发，界面显示「待开发」 */
  status: 'ready' | 'coming-soon'
  /** 功能在系统里的入口位置说明 */
  where: string
  /** 在插件页列出的能力点 */
  provides: string[]
  /** Payload 层扩展（集合、接口）。配置在构建时注册；开关只控制页面上的功能入口。 */
  payload?: PayloadPlugin
  /** 提供的文档风格 */
  docStyles?: DocStyle[]
}

export type PluginId =
  | 'ai-copilot'
  | 'doc-styles'
  | 'proposal'
  | 'room-insights'
  | 'smart-select'
  | 'ai-import'
  | 'dwg-import'
  | 'site-survey'
  | 'wiring-schedule'
  | 'procurement'
  | 'scene-handover'
  | 'after-sales'
