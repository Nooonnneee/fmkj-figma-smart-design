'use strict'

const { BrowserWindow, Menu, clipboard } = require('electron')

/** 右键菜单：复制粘贴、链接、图片。网页自己拦截了右键（如点位图编辑器）时不会弹出。 */
function attachContextMenu(contents, { openExternal, isDev }) {
  contents.on('context-menu', (_event, params) => {
    const { editFlags } = params
    const items = []
    const separator = { type: 'separator' }

    if (params.linkURL && /^(https?|mailto|tel):/i.test(params.linkURL)) {
      items.push(
        { label: '在浏览器中打开链接', click: () => openExternal(params.linkURL) },
        { label: '复制链接地址', click: () => clipboard.writeText(params.linkURL) },
        separator,
      )
    }
    if (params.mediaType === 'image' && params.srcURL) {
      items.push(
        { label: '复制图片', click: () => contents.copyImageAt(params.x, params.y) },
        { label: '图片另存为…', click: () => contents.downloadURL(params.srcURL) },
        separator,
      )
    }
    if (params.isEditable) {
      items.push(
        { role: 'undo', label: '撤销', enabled: editFlags.canUndo },
        { role: 'redo', label: '重做', enabled: editFlags.canRedo },
        separator,
        { role: 'cut', label: '剪切', enabled: editFlags.canCut },
        { role: 'copy', label: '复制', enabled: editFlags.canCopy },
        { role: 'paste', label: '粘贴', enabled: editFlags.canPaste },
        { role: 'selectAll', label: '全选', enabled: editFlags.canSelectAll },
      )
    } else if (params.selectionText && params.selectionText.trim()) {
      items.push({ role: 'copy', label: '复制', enabled: editFlags.canCopy })
    }
    if (isDev) items.push(separator, { label: '检查元素', click: () => contents.inspectElement(params.x, params.y) })

    // 去掉开头、结尾和连续的分隔线
    const cleaned = []
    for (const item of items) {
      if (item.type === 'separator' && (!cleaned.length || cleaned[cleaned.length - 1].type === 'separator')) continue
      cleaned.push(item)
    }
    while (cleaned.length && cleaned[cleaned.length - 1].type === 'separator') cleaned.pop()
    if (!cleaned.length) return

    const win = BrowserWindow.fromWebContents(contents)
    Menu.buildFromTemplate(cleaned).popup(win ? { window: win } : {})
  })
}

module.exports = { attachContextMenu }
