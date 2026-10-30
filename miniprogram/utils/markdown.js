/**
 * 极简 Markdown → rich-text HTML（AI 回复用）：标题、粗体、行内代码、列表、表格、段落。
 * rich-text 的内联样式只支持 px。
 */
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const inline = (s) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<span style="font-family:Menlo,monospace;background:#f5f5f5;padding:0 3px;border-radius:3px">$1</span>')
const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())

function toHtml(md) {
  const lines = String(md || '').replace(/\r/g, '').split('\n')
  let html = ''
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || '')) {
      const head = cells(line)
      i += 2
      const rows = []
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]))
      i--
      const td = 'padding:5px 8px;border-bottom:1px solid #e5e5e5;text-align:left'
      html +=
        '<table style="width:100%;border-collapse:collapse;font-size:13px;margin:4px 0"><tr>' +
        head.map((h) => '<th style="' + td + ';color:#737373;font-weight:500">' + inline(h) + '</th>').join('') +
        '</tr>' +
        rows.map((r) => '<tr>' + r.map((c) => '<td style="' + td + '">' + inline(c) + '</td>').join('') + '</tr>').join('') +
        '</table>'
    } else if (/^#{1,4}\s+/.test(line)) {
      html += '<div style="font-weight:600;font-size:15px;margin:8px 0 2px">' + inline(line.replace(/^#{1,4}\s+/, '')) + '</div>'
    } else if (/^\s*[-*]\s+/.test(line)) {
      html += '<div style="padding-left:14px;text-indent:-10px">· ' + inline(line.replace(/^\s*[-*]\s+/, '')) + '</div>'
    } else if (/^\s*\d+\.\s+/.test(line)) {
      const n = line.match(/^\s*(\d+)\./)[1]
      html += '<div style="padding-left:16px;text-indent:-14px">' + n + '. ' + inline(line.replace(/^\s*\d+\.\s+/, '')) + '</div>'
    } else if (!line.trim()) {
      html += '<div style="height:6px"></div>'
    } else {
      html += '<div>' + inline(line) + '</div>'
    }
  }
  return '<div style="font-size:15px;line-height:1.65;color:#0a0a0a;word-break:break-all">' + html + '</div>'
}

module.exports = { toHtml }
