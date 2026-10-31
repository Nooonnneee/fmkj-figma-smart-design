'use strict'

const appConfig = require('../app-config.json')
const { readJson, writeJson } = require('./store')
const { normalizeServerUrl } = require('./lib/urls')

const SETTINGS_FILE = 'settings.json'
const DEFAULT_SERVER_URL = normalizeServerUrl(appConfig.defaultServerUrl)

let cachedSettings = null

function getSettings() {
  if (!cachedSettings) cachedSettings = readJson(SETTINGS_FILE, {})
  return cachedSettings
}

/** 命令行 --server-url=… 或环境变量 FMKJ_SERVER_URL 临时指定服务器（开发、内网调试用） */
function overrideServerUrl() {
  const prefix = '--server-url='
  const arg = process.argv.find((item) => item.startsWith(prefix))
  return normalizeServerUrl(arg ? arg.slice(prefix.length) : process.env.FMKJ_SERVER_URL)
}

/** 当前连接的服务器：启动参数 > 用户设置 > 打包时的默认地址 */
function getServerUrl() {
  return overrideServerUrl() || normalizeServerUrl(getSettings().serverUrl) || DEFAULT_SERVER_URL
}

/** 保存服务器地址；传 null 恢复默认。地址无效时抛错。 */
function setServerUrl(value) {
  const next = { ...getSettings() }
  if (value == null) {
    delete next.serverUrl
  } else {
    const normalized = normalizeServerUrl(value)
    if (!normalized) throw new Error('INVALID_SERVER_URL')
    next.serverUrl = normalized
  }
  writeJson(SETTINGS_FILE, next)
  cachedSettings = next
  return getServerUrl()
}

/** 自动更新清单所在目录，例如 https://fmkj.top/downloads/desktop */
function getUpdateFeedUrl() {
  return new URL(appConfig.updatePath, getServerUrl()).href.replace(/\/+$/, '')
}

module.exports = {
  appConfig,
  DEFAULT_SERVER_URL,
  getServerUrl,
  setServerUrl,
  getUpdateFeedUrl,
  isServerOverridden: () => Boolean(overrideServerUrl()),
}
