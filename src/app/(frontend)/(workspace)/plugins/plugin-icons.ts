import { Bot, Cable, ClipboardList, FileUp, KeyRound, PackageCheck, Palette, Presentation, ScanSearch, Sparkles, Wand2, Wrench, type LucideIcon } from 'lucide-react'

import type { PluginId } from '@/plugins/types'

/** 插件图标（插件市场、项目工具箱共用） */
export const PLUGIN_ICONS: Record<PluginId, LucideIcon> = {
  'ai-copilot': Bot,
  'doc-styles': Palette,
  proposal: Presentation,
  'room-insights': Sparkles,
  'smart-select': Wand2,
  'ai-import': ScanSearch,
  'dwg-import': FileUp,
  'site-survey': ClipboardList,
  'wiring-schedule': Cable,
  procurement: PackageCheck,
  'scene-handover': KeyRound,
  'after-sales': Wrench,
}
