'use strict'

const { shell } = require('electron')
const { isSafeExternalUrl, isSameOrigin } = require('./lib/urls')

// 网页只能申请这些权限，且只对当前服务器生效；摄像头、麦克风、定位等一律拒绝。
const ALLOWED_PERMISSIONS = new Set(['clipboard-read', 'clipboard-sanitized-write', 'notifications', 'fullscreen'])

function openExternal(url) {
  if (!isSafeExternalUrl(url)) return false
  shell.openExternal(url).catch((error) => console.warn('[security] 打开外部链接失败', error))
  return true
}

function hardenSession(ses, getServerUrl) {
  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origin = (details && details.requestingUrl) || webContents.getURL()
    callback(ALLOWED_PERMISSIONS.has(permission) && isSameOrigin(origin, getServerUrl()))
  })
  ses.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    return ALLOWED_PERMISSIONS.has(permission) && isSameOrigin(requestingOrigin, getServerUrl())
  })
}

module.exports = { hardenSession, openExternal }
