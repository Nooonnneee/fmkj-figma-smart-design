'use strict'

const { app, dialog, net, shell } = require('electron')
const { compareVersions, parseUpdateFeed } = require('./lib/urls')

const FIRST_CHECK_DELAY = 20 * 1000
const CHECK_INTERVAL = 6 * 60 * 60 * 1000

/**
 * 更新策略：
 * - Windows 安装版：electron-updater 后台下载，下载完提示重启安装。
 * - macOS：未使用 Apple 开发者证书签名时系统不允许自动替换应用，
 *   所以只检查版本并引导到下载页（签名后可改为自动安装）。
 * 更新文件来自「服务器地址 + /downloads/desktop」。
 */
function createUpdater({ getFeedUrl, getDownloadPageUrl, getWindow }) {
  const autoInstall = process.platform === 'win32' && app.isPackaged
  let autoUpdater = null
  let checking = false
  let manual = false
  let downloadedVersion = null

  function message(options) {
    const win = getWindow()
    return win && !win.isDestroyed() ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options)
  }

  function setProgress(value) {
    const win = getWindow()
    if (win && !win.isDestroyed()) win.setProgressBar(value)
  }

  function friendlyError(error) {
    const text = String((error && error.message) || error || '')
    if (/404/.test(text)) return '服务器上还没有发布新的安装包。'
    if (/ENOTFOUND|ECONN|ETIMEDOUT|ERR_INTERNET|ERR_NAME|net::/i.test(text)) return '网络连接失败，请稍后再试。'
    return text.slice(0, 200) || '未知错误'
  }

  async function promptRestart(version) {
    const { response } = await message({
      type: 'info',
      title: '更新已就绪',
      message: `新版本 ${version} 已下载完成`,
      detail: '重启客户端即可完成安装。请先保存正在编辑的内容。',
      buttons: ['立即重启', '稍后'],
      defaultId: 0,
      cancelId: 1,
    })
    if (response === 0) setImmediate(() => autoUpdater.quitAndInstall())
  }

  function getAutoUpdater() {
    if (autoUpdater) return autoUpdater
    autoUpdater = require('electron-updater').autoUpdater
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.logger = { info() {}, debug() {}, warn: console.warn, error: console.error }
    autoUpdater.on('update-available', (info) => {
      if (!manual) return
      message({
        type: 'info',
        title: '发现新版本',
        message: `发现新版本 ${info.version}`,
        detail: '正在后台下载，完成后会提示你重启安装。',
        buttons: ['好的'],
      })
    })
    autoUpdater.on('update-not-available', () => {
      if (!manual) return
      message({ type: 'info', title: '检查更新', message: '已是最新版本', detail: `当前版本 ${app.getVersion()}`, buttons: ['好的'] })
    })
    autoUpdater.on('download-progress', (progress) => setProgress(Math.max(0, Math.min(1, progress.percent / 100))))
    autoUpdater.on('update-downloaded', (info) => {
      setProgress(-1)
      downloadedVersion = info.version
      promptRestart(info.version)
    })
    autoUpdater.on('error', (error) => {
      setProgress(-1)
      console.warn('[updater]', friendlyError(error))
    })
    return autoUpdater
  }

  async function readFeed() {
    const feedFile = process.platform === 'darwin' ? 'latest-mac.yml' : 'latest.yml'
    const response = await net.fetch(`${getFeedUrl()}/${feedFile}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) })
    if (response.status === 404) return { version: null }
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return parseUpdateFeed(await response.text())
  }

  async function check({ manual: isManual = false } = {}) {
    if (downloadedVersion && autoUpdater) {
      if (isManual) await promptRestart(downloadedVersion)
      return
    }
    if (checking) {
      if (isManual) message({ type: 'info', title: '检查更新', message: '正在检查更新，请稍候', buttons: ['好的'] })
      return
    }
    checking = true
    manual = isManual
    try {
      if (autoInstall) {
        const updater = getAutoUpdater()
        updater.setFeedURL({ provider: 'generic', url: getFeedUrl() })
        await updater.checkForUpdates()
        return
      }
      const feed = await readFeed()
      if (feed.version && compareVersions(feed.version, app.getVersion()) > 0) {
        const { response } = await message({
          type: 'info',
          title: '发现新版本',
          message: `${app.name} ${feed.version} 已发布`,
          detail: `当前版本 ${app.getVersion()}。前往下载页获取新安装包，覆盖安装后登录状态和设置都会保留。`,
          buttons: ['前往下载', '稍后'],
          defaultId: 0,
          cancelId: 1,
        })
        if (response === 0) shell.openExternal(getDownloadPageUrl())
      } else if (isManual) {
        message({
          type: 'info',
          title: '检查更新',
          message: feed.version ? '已是最新版本' : '暂未发布新版本',
          detail: `当前版本 ${app.getVersion()}`,
          buttons: ['好的'],
        })
      }
    } catch (error) {
      if (isManual) message({ type: 'warning', title: '检查更新失败', message: '暂时无法检查更新', detail: friendlyError(error), buttons: ['好的'] })
      else console.warn('[updater]', friendlyError(error))
    } finally {
      checking = false
      manual = false
    }
  }

  function start() {
    if (!app.isPackaged) return // 开发模式不自动检查，菜单里仍可手动检查
    setTimeout(() => check(), FIRST_CHECK_DELAY)
    setInterval(() => check(), CHECK_INTERVAL)
  }

  return { check, start }
}

module.exports = { createUpdater }
