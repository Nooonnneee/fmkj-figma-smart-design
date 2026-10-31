'use strict'

// 预加载脚本（沙箱模式）：只向网页暴露少量、无害的桌面能力。
const { contextBridge, ipcRenderer } = require('electron')

function argValue(name) {
  const prefix = `--${name}=`
  const hit = process.argv.find((item) => item.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : ''
}

const api = {
  isDesktop: true,
  version: argValue('fmkj-version'),
  platform: process.platform,
  checkForUpdates: () => ipcRenderer.invoke('desktop:check-updates'),
  openSettings: () => ipcRenderer.invoke('desktop:open-settings'),
  openExternal: (url) => ipcRenderer.invoke('desktop:open-external', String(url)),
  retry: () => ipcRenderer.invoke('desktop:retry'),
}

// 修改服务器地址只开放给客户端自带的本地页面；主进程也会再次校验来源。
if (location.protocol === 'file:') {
  api.settings = Object.freeze({
    get: () => ipcRenderer.invoke('settings:get'),
    test: (url) => ipcRenderer.invoke('settings:test', String(url)),
    save: (url) => ipcRenderer.invoke('settings:save', String(url)),
    reset: () => ipcRenderer.invoke('settings:reset'),
    close: () => ipcRenderer.invoke('settings:close'),
  })
}

contextBridge.exposeInMainWorld('fanmengDesktop', Object.freeze(api))
