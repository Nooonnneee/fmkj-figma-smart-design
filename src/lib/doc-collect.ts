import type { PageJpeg } from './export-pdf'

/**
 * 交付资料包：资料包页面用隐藏框架打开各打印页（网址带 auto=collect&collect=<编号>），
 * 打印页渲染好 PDF 页后把结果发回给资料包页面。只在同源页面之间传递。
 */
export const COLLECT_MESSAGE = 'fmkj:doc-pages' as const

export type CollectResult =
  | { type: typeof COLLECT_MESSAGE; key: string; ok: true; pages: PageJpeg[] }
  | { type: typeof COLLECT_MESSAGE; key: string; ok: false; error: string }
