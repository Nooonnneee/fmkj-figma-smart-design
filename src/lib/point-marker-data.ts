import { MARKER_SVGS } from './point-marker-svgs'
import { markerFileId } from './point-markers'

/**
 * 画布上使用的标记图片：内嵌的 SVG 数据（不用发请求，Excalidraw 也能正常处理 SVG）。
 * 保存时 compactScene 会换回静态地址，数据库里不存图片内容。
 */
export function markerDataUrl(type: string) {
  const svg = MARKER_SVGS[type] ?? MARKER_SVGS.other
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

export const markerBinaryFile = (type: string) => ({ id: markerFileId(type), dataURL: markerDataUrl(type), mimeType: 'image/svg+xml', created: Date.now() })
