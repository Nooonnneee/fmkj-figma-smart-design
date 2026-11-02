'use strict'

const path = require('node:path')
const { BrowserWindow, Notification, app, dialog, shell } = require('electron')

/** 下载：弹出保存对话框（默认「下载」文件夹），任务栏/程序坞显示进度，完成后通知。 */
function setupDownloads(ses, getWindow) {
  ses.on('will-download', (_event, item, webContents) => {
    const win = (webContents && BrowserWindow.fromWebContents(webContents)) || getWindow()
    item.setSaveDialogOptions({
      title: '保存文件',
      defaultPath: path.join(app.getPath('downloads'), item.getFilename()),
    })

    item.on('updated', (_e, state) => {
      if (!win || win.isDestroyed()) return
      const total = item.getTotalBytes()
      if (state === 'progressing' && total > 0) win.setProgressBar(item.getReceivedBytes() / total)
    })

    item.once('done', (_e, state) => {
      if (win && !win.isDestroyed()) win.setProgressBar(-1)
      const file = item.getSavePath()
      if (state === 'completed') {
        if (process.platform === 'darwin' && app.dock) app.dock.downloadFinished(file)
        if (Notification.isSupported()) {
          const notice = new Notification({ title: '下载完成', body: `${path.basename(file)}（点击打开所在文件夹）` })
          notice.on('click', () => shell.showItemInFolder(file))
          notice.show()
        }
      } else if (state === 'interrupted') {
        const options = { type: 'warning', title: '下载失败', message: '文件下载失败', detail: item.getFilename(), buttons: ['好的'] }
        if (win && !win.isDestroyed()) dialog.showMessageBox(win, options)
        else dialog.showMessageBox(options)
      }
    })
  })
}

module.exports = { setupDownloads }
