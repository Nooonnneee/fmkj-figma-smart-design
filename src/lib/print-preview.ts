/**
 * 打印页在窄屏（手机 / 微信小程序）上的预览方式。
 *
 * 背景（2026-11-15 视觉审计实测）：390 宽下原来整页等比缩放（`--paper-zoom: 0.4710`），
 * A4 纸 374px 宽，正文 11.5px × 0.47 ≈ 5.4px 视觉字号 —— 业主在手机上看报价单根本读不清。
 *
 * 现在按纸张类型分成两种：
 * - `flow`（报价单 / 合同 / 交底清单这类纵向长文）：**重排**。纸张铺满屏宽、内边距收窄、
 *   表头允许换行，字号保持 11.5–12.5px。可重排所以不需要缩放。
 * - `sheet`（点位图 / 方案页这类定宽画布）：**等比缩小**。内容是图，重排会破坏构图，
 *   只能整体缩到屏幕宽。
 *
 * 导出 PDF / 图片不受影响：`src/lib/export-pdf.ts` 在渲染前会把祖先节点上的 zoom 还原成 1，
 * 并在 `flow` 节点宽度不足 A4 时临时固定为 210mm（见 prepareNodeForExport），
 * 所以屏幕上怎么重排都不会改变导出尺寸。
 */

/** 纸张类型：纵向可重排长文 / 定宽画布 */
export type PrintPaperKind = 'flow' | 'sheet'

/** A4 纵向（210mm @ 96dpi）宽度，与 DocArticle 的 w-[210mm] 一致 */
export const A4_PORTRAIT_PX = 794
/** A4 横向（297mm @ 96dpi）宽度，与 DocSheetPage 的 w-[297mm] 一致 */
export const A4_LANDSCAPE_PX = 1123
/** 纸张左右各留一点，避免贴边 */
export const PRINT_PAGE_GUTTER_PX = 8

export type PrintPreview = {
  /** `reflow`：铺满屏宽重排；`fit`：整体等比缩放到屏宽 */
  mode: 'reflow' | 'fit'
  /**
   * 需要写入 CSS 的缩放比例。`reflow` 时恒为 1；
   * `fit` 时按屏宽/纸宽計算，最低 0.22（与原来的下限一致）。
   */
  zoom: number
}

/**
 * 计算某张纸在当前视口下的预览方式。
 *
 * - 可重排的纵向长文永远重排（屏幕再宽也不放大，纸张保持 A4 阅读宽度 ——
 *   桌面端仍由 CSS 的 `max-width: 1460px` 条件控制纸张宽度，这里只决定手机端行为）。
 * - 定宽画布放不下就等比缩小；放得下就不缩。
 */
export function resolvePrintPreview({
  paperWidth,
  viewportWidth,
  kind,
  gutter = PRINT_PAGE_GUTTER_PX,
}: {
  paperWidth: number
  viewportWidth: number
  kind: PrintPaperKind
  gutter?: number
}): PrintPreview {
  if (kind === 'flow') return { mode: 'reflow', zoom: 1 }
  const available = viewportWidth - gutter * 2
  if (available <= 0 || available >= paperWidth) return { mode: 'fit', zoom: 1 }
  const zoom = Math.max(0.22, available / paperWidth)
  return { mode: 'fit', zoom: Math.round(zoom * 10000) / 10000 }
}
