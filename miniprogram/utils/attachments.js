/**
 * AI 消息附件：与网页版使用同一种文本格式（【已上传附件】块），两端历史记录互相可读。
 */
const MARKER = '\n\n【已上传附件】'

function buildMessage(prompt, attachments) {
  if (!attachments.length) return prompt
  const blocks = attachments.map((a) => {
    const title = a.name.replace(/\.[^.]+$/, '')
    const pts = a.detectedPoints || []
    if (pts.length) {
      return '- [图片] ' + a.name + ' (已自动适配为标准图纸, mediaId: ' + a.mediaId + ', URL: ' + a.url + ', 建议图纸名: ' + title + ', 图像自动识别到 ' + pts.length + ' 个真实点位) —— 请调用 add_floor_sheet 工具并传入 detectedPoints: ' + JSON.stringify(pts)
    }
    return '- [图片] ' + a.name + ' (已自动适配为标准图纸, mediaId: ' + a.mediaId + ', URL: ' + a.url + ', 建议图纸名: ' + title + ', 识别点位数: 0) —— 请只调用 add_floor_sheet 工具添加干净图纸（不传 detectedPoints），严禁调用 setup_rooms_and_points 生成任何默认点位！'
  })
  return prompt + MARKER + '\n' + blocks.join('\n\n')
}

/** 历史消息：拆出可见正文和图片附件 */
function parseStored(content) {
  const idx = content.indexOf(MARKER)
  if (idx === -1) return { text: content, images: [] }
  const images = []
  content
    .slice(idx + MARKER.length)
    .split('\n')
    .forEach((line) => {
      const m = /^- \[图片\] ([^\s(]+).*?URL:\s*(\/api\/media\/file\/[^\s,)]+)/.exec(line)
      if (m) images.push({ name: m[1], url: m[2] })
    })
  return { text: content.slice(0, idx).trim(), images }
}

module.exports = { buildMessage, parseStored }
