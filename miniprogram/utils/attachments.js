/**
 * AI 消息附件：与网页版使用同一种文本格式（【已上传附件】块），两端历史记录互相可读。
 */
const MARKER = '\n\n【已上传附件】'

const KIND_TEXT = { 'floor-plan': '户型/点位图纸', 'quote-document': '报价单/清单截图', photo: '实景照片', rendering: '效果图', other: '图片' }

function buildMessage(prompt, attachments) {
  if (!attachments.length) return prompt
  const blocks = attachments.map((a) => {
    const title = a.name.replace(/\.[^.]+$/, '')
    const kind = a.imageKind || 'floor-plan'
    if (kind !== 'floor-plan') {
      return '- [图片] ' + a.name + ' (类型: ' + (KIND_TEXT[kind] || '图片') + ', mediaId: ' + a.mediaId + ', URL: ' + a.url + ') —— 这不是户型图纸：请依据视觉识图结论回答，不要调用 add_floor_sheet'
    }
    const count = a.detectedPointCount || (a.detectedPoints ? a.detectedPoints.length : 0)
    const sw = a.detectedSwitchCount || 0
    const lt = a.detectedLightCount || 0
    const ar = a.detectedAreaCount || 0
    if (count > 0) {
      return (
        '- [图片] ' +
        a.name +
        ' (已自动适配为标准图纸, mediaId: ' +
        a.mediaId +
        ', URL: ' +
        a.url +
        ', 建议图纸名: ' +
        title +
        ', 图像已自动识别并缓存 ' +
        (sw || lt ? '开关 ' + sw + ' 个、筒灯/射灯 ' + lt + ' 个、房间分区 ' + ar + ' 个' : count + ' 个真实点位') +
        ') —— 请调用 add_floor_sheet 工具并传入 url、mediaId 与 importMode（默认 switches 仅导入开关，若用户要求导入灯具则传 all，服务端会自动按 mediaId 加载已识别点位与房间区域，无需手动传 detectedPoints 数组）'
      )
    }
    return '- [图片] ' + a.name + ' (已自动适配为标准图纸, mediaId: ' + a.mediaId + ', URL: ' + a.url + ', 建议图纸名: ' + title + ', 识别点位数: 0) —— 请只调用 add_floor_sheet 工具添加干净图纸（不传 detectedPoints），严禁调用 setup_rooms_and_points 生成任何默认点位！'
  })
  return prompt + MARKER + '\n' + blocks.join('\n\n')
}

/** 历史消息：拆出可见正文和图片附件（服务端追加的视觉识图结论不显示） */
function parseStored(content) {
  const briefIdx = content.indexOf('\n\n【视觉识图结论】')
  if (briefIdx !== -1) content = content.slice(0, briefIdx)
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
