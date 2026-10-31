import { MARKER_SVGS } from './point-marker-svgs'
import { BLANK_SHEET_FILE_ID, isMarkerFileId, markerFileId } from './point-markers'

/**
 * 画布上使用的标记图片：内嵌的 SVG 数据（不用发请求，Excalidraw 也能正常处理 SVG）。
 * 保存时 compactScene 会换回静态地址，数据库里不存图片内容。
 */
export function markerDataUrl(type: string) {
  const svg = MARKER_SVGS[type] ?? MARKER_SVGS.other
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

export const markerBinaryFile = (type: string) => ({ id: markerFileId(type), dataURL: markerDataUrl(type), mimeType: 'image/svg+xml', created: Date.now() })

// 与 public/blank-sheet.svg 内容一致
const BLANK_SHEET_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800"><rect width="1200" height="800" fill="#ffffff" stroke="#e5e5e5" stroke-width="2"/></svg>'

/**
 * 交给 Excalidraw 的文件：标记图标和空白图纸换成内嵌 base64 SVG。
 * Excalidraw 会按 base64 解析 SVG 文件，直接给静态地址会在控制台报 atob 错误；保存时 compactScene 换回静态地址。
 */
export function canvasFile<T extends { id: string }>(file: T) {
  if (isMarkerFileId(file.id)) return markerBinaryFile(file.id.replace(/^mk\d+-/, ''))
  if (file.id === BLANK_SHEET_FILE_ID) return { id: BLANK_SHEET_FILE_ID, dataURL: `data:image/svg+xml;base64,${btoa(BLANK_SHEET_SVG)}`, mimeType: 'image/svg+xml', created: Date.now() }
  return file
}
