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

// 智能家居桥（提案 §3）。渲染进程只能看到聚合结果，令牌始终留在主进程。
// 设置类 IPC 由主进程只放行本地页面，数据类只放行受信任工作台来源。
const ha = {
  available: () => Promise.resolve(true),
  status: () => ipcRenderer.invoke('ha:status'),
  discover: (options) => ipcRenderer.invoke('ha:discover', options && typeof options === 'object' ? { timeoutMs: options.timeoutMs } : undefined),
  configure: (input) => ipcRenderer.invoke('ha:configure', input && typeof input === 'object' ? { baseUrl: input.baseUrl, token: input.token } : undefined),
  clear: () => ipcRenderer.invoke('ha:clear'),
  getStates: () => ipcRenderer.invoke('ha:get-states'),
  callService: (input) =>
    ipcRenderer.invoke(
      'ha:call-service',
      input && typeof input === 'object'
        ? { domain: input.domain, service: input.service, entityId: input.entityId, data: input.data }
        : undefined,
    ),
}
api.ha = Object.freeze(ha)

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
