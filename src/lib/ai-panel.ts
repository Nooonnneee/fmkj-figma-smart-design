/**
 * AI 对话右栏的布局常量与判定（纯函数，单测见 ai-panel.test.ts）。
 *
 * 断点为什么定在 1440：
 * - 点位图从 lg 起把「设备与属性」栏固定成 288px（point-map-editor.tsx 的 lg:w-72），
 *   左侧导航默认 256px，AI 栏 320px。三列同时展开时画布宽度 = 视口 - 864px。
 * - 1024（桌面客户端最小窗口，desktop/src/window-state.js 的 MIN_SIZE）只剩 160px，
 *   1280 只剩 416px，画布都不可用；1440 剩 576px，是 owner 明确接受的下限。
 * - 因此 1440 及以上三列并排；以下一律收成抽屉，不常驻挤压画布。
 * - 1440 这个值与 Tailwind 的默认断点无关，判定在 JS 里做（aiPanelMode），
 *   组件不要另写一套断点类。
 */
export const AI_PANEL_BREAKPOINT = 1440

export type AiPanelMode = 'inline' | 'drawer'

/** 视口够宽时 AI 栏作为常驻列（inline），否则收成可开关的抽屉（drawer）。 */
export function aiPanelMode(viewportWidth: number): AiPanelMode {
  return viewportWidth >= AI_PANEL_BREAKPOINT ? 'inline' : 'drawer'
}

/**
 * `/ai` 整页已经有自己的 AiSidebarDock 实例（ai/page.tsx:98）。
 * 右侧栏在 `(workspace)` 内常驻；若 `/ai` 上也渲染，同一页面会出现两个会话 view、
 * 两套流式订阅。所以只在**完全一致**的 `/ai` 路径隐藏右栏；
 * `/ai/image`、`/ai/image/style` 没有 dock 实例，照常显示右栏。
 */
export function shouldShowAiPanel(pathname: string): boolean {
  return !/^\/ai\/?$/.test(pathname)
}
