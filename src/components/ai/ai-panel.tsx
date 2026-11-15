'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { MessageSquareText, X } from 'lucide-react'
import { IconButton } from '@astryxdesign/core/IconButton'

import type { AiModelOption, AiProjectContext } from '@/components/ai/ai-elements'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useViewportWidth } from '@/hooks/use-viewport-width'
import { aiPanelMode, shouldShowAiPanel } from '@/lib/ai-panel'
import type { PluginId } from '@/plugins/types'

// 与左侧栏一致：AI 对话面板按需加载，不拖慢其他页面首屏
const AiSidebarDock = dynamic(
  () => import('@/components/ai/ai-sidebar-dock').then((m) => m.AiSidebarDock),
  { ssr: false },
)

type AiPanelPlugin = {
  id: PluginId
  name: string
  description: string
  status: 'ready' | 'coming-soon'
  enabled: boolean
  where: string
  provides: string[]
}

type AiPanelContextValue = {
  /** AI 对话侧栏插件是否启用；关闭时整列和开关都不出现 */
  enabled: boolean
  /**
   * 'inline' = 视口 ≥ AI_PANEL_BREAKPOINT，右栏常驻；
   * 'drawer' = 收成抽屉；
   * 'pending' = 首帧还不知道视口宽度，先不渲染，避免顶栏开关/右栏闪一下。
   */
  mode: 'inline' | 'drawer' | 'pending'
  open: boolean
  setOpen: (open: boolean) => void
}

const AiPanelContext = React.createContext<AiPanelContextValue | null>(null)

function useAiPanel() {
  const context = React.useContext(AiPanelContext)
  if (!context) throw new Error('useAiPanel 必须在 AiPanelProvider 内使用。')
  return context
}

/**
 * AI 对话右栏的开关状态。
 *
 * 断点判定与理由见 `src/lib/ai-panel.ts` 的 AI_PANEL_BREAKPOINT 注释：
 * ≥1440 三列并排，以下收成抽屉，避免 1024 客户端窗口里画布被挤到 160px。
 *
 * SSR / 首帧时视口宽度按 0 处理（最保守的抽屉布局），挂载后再按真实宽度算。
 * AI 面板本来就不参与 SSR（dock 是 ssr:false），所以没有水合不一致的问题。
 */
export function AiPanelProvider({
  enabled,
  children,
}: {
  enabled: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const width = useViewportWidth()
  const mode = width === 0 ? 'pending' : aiPanelMode(width)
  const [open, setOpen] = React.useState(false)
  const show = enabled && shouldShowAiPanel(pathname)

  const value = React.useMemo<AiPanelContextValue>(
    () => ({ enabled: show, mode, open, setOpen }),
    [show, mode, open],
  )

  return <AiPanelContext.Provider value={value}>{children}</AiPanelContext.Provider>
}

/**
 * 窄屏时放在顶栏里的 AI 对话开关（宽屏右栏常驻，不需要开关）。
 * 顶栏有两套（SiteHeader / ProjectHeader），两边都挂同一个组件，按路径只会显示一个。
 */
export function AiPanelToggle() {
  const { enabled, mode, open, setOpen } = useAiPanel()
  if (!enabled || mode !== 'drawer') return null
  return (
    <IconButton
      type="button"
      variant="ghost"
      size="sm"
      label="AI 对话"
      icon={<MessageSquareText />}
      aria-expanded={open}
      onClick={() => setOpen(!open)}
    />
  )
}

export type AiPanelProps = {
  plugins: AiPanelPlugin[]
  projects: AiProjectContext[]
  credits: number
  configured: boolean
  models?: AiModelOption[]
}

/**
 * AI 对话右栏。
 *
 * - 宽屏（≥1440）：作为 flex 列参与布局，和左侧栏一样是「挤压」而不是遮挡；
 *   点位图「设备与属性」栏保持原有的 lg:w-72 行为不动。
 * - 窄屏：不占位，做成 Sheet 抽屉，开关在顶栏。
 * - 点位图全屏是 `fixed inset-0 z-50`，高于本栏；全屏时视觉上盖住本栏，
 *   退出后恢复正常。不要抬高本栏 z-index —— 会压住画布的右键菜单。
 *
 * 用普通文档流而不是 fixed：fixed 列 + 占位 div 会让画布页的悬浮按钮
 * （如报价单右下的毛利胶囊，z-30）浮到本栏上面；流式列没有这个问题。
 */
export function AiPanel({ plugins, projects, credits, configured, models }: AiPanelProps) {
  const { enabled, mode, setOpen, open } = useAiPanel()
  if (!enabled || mode === 'pending') return null

  const dock = (
    <AiSidebarDock
      plugins={plugins.filter((p) => p.id !== 'ai-copilot')}
      projects={projects}
      credits={credits}
      configured={configured}
      models={models}
    />
  )

  if (mode === 'inline') {
    return (
      <aside
        data-slot="ai-panel"
        aria-label="AI 对话"
        className="sticky top-0 flex h-svh w-80 shrink-0 flex-col border-l border-border bg-sidebar"
      >
        {dock}
      </aside>
    )
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* 宽度沿用 Sheet 的默认值：桌面 3/4 宽、sm 起封顶 24rem，移动端也一样。
          不写 w-* 是因为 `data-[side=right]:w-3/4` 的变体前缀优先级高于裸 w-*。 */}
      <SheetContent side="right" showCloseButton={false} className="gap-0 p-0">
        <SheetTitle className="sr-only">AI 对话</SheetTitle>
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
          <span className="text-sm font-semibold">AI 对话</span>
          <IconButton
            type="button"
            variant="ghost"
            size="sm"
            label="关闭 AI 对话"
            icon={<X />}
            onClick={() => setOpen(false)}
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{dock}</div>
      </SheetContent>
    </Sheet>
  )
}
