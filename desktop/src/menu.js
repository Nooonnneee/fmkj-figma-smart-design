'use strict'

const { Menu, app } = require('electron')

/** 应用菜单（中文）。ctx 由 main.js 提供具体动作。 */
function buildAppMenu(ctx) {
  const { isMac } = ctx
  const separator = { type: 'separator' }

  const appMenu = {
    label: app.name,
    submenu: [
      { role: 'about', label: `关于${app.name}` },
      { label: '检查更新…', click: ctx.checkForUpdates },
      separator,
      { label: '服务器设置…', accelerator: 'Cmd+,', click: ctx.openSettings },
      separator,
      { role: 'services', label: '服务' },
      separator,
      { role: 'hide', label: `隐藏${app.name}` },
      { role: 'hideOthers', label: '隐藏其他' },
      { role: 'unhide', label: '全部显示' },
      separator,
      { role: 'quit', label: `退出${app.name}` },
    ],
  }

  const fileMenu = {
    label: '文件',
    submenu: [
      { label: '新建窗口', accelerator: 'CmdOrCtrl+N', click: ctx.newWindow },
      separator,
      { label: '在浏览器中打开当前页', accelerator: 'CmdOrCtrl+Shift+O', click: ctx.openInBrowser },
      { label: '复制当前页链接', accelerator: 'CmdOrCtrl+Shift+C', click: ctx.copyLink },
      separator,
      { label: '打印…', accelerator: 'CmdOrCtrl+P', click: ctx.print },
      separator,
      ...(isMac
        ? [{ role: 'close', label: '关闭窗口' }]
        : [{ label: '服务器设置…', accelerator: 'Ctrl+,', click: ctx.openSettings }, separator, { role: 'quit', label: '退出' }]),
    ],
  }

  const editMenu = {
    label: '编辑',
    submenu: [
      { role: 'undo', label: '撤销' },
      { role: 'redo', label: '重做' },
      separator,
      { role: 'cut', label: '剪切' },
      { role: 'copy', label: '复制' },
      { role: 'paste', label: '粘贴' },
      ...(isMac ? [{ role: 'pasteAndMatchStyle', label: '粘贴并匹配样式' }] : []),
      { role: 'delete', label: '删除' },
      { role: 'selectAll', label: '全选' },
    ],
  }

  const viewMenu = {
    label: '视图',
    submenu: [
      { label: '后退', accelerator: isMac ? 'Cmd+[' : 'Alt+Left', click: ctx.goBack },
      { label: '前进', accelerator: isMac ? 'Cmd+]' : 'Alt+Right', click: ctx.goForward },
      { label: '重新加载', accelerator: 'CmdOrCtrl+R', click: ctx.reload },
      { label: '强制重新加载', accelerator: 'CmdOrCtrl+Shift+R', click: ctx.forceReload },
      separator,
      { role: 'resetZoom', label: '实际大小' },
      { role: 'zoomIn', label: '放大' },
      { role: 'zoomOut', label: '缩小' },
      separator,
      { role: 'togglefullscreen', label: '全屏' },
      separator,
      { role: 'toggleDevTools', label: '开发者工具' },
    ],
  }

  // 与网页侧边栏一致的常用入口
  const goMenu = {
    label: '前往',
    submenu: [
      { label: '项目', accelerator: 'CmdOrCtrl+1', click: () => ctx.navigate('/projects') },
      { label: '产品库', accelerator: 'CmdOrCtrl+2', click: () => ctx.navigate('/products') },
      separator,
      { label: '插件市场', accelerator: 'CmdOrCtrl+3', click: () => ctx.navigate('/plugins') },
      { label: '会员与积分', accelerator: 'CmdOrCtrl+4', click: () => ctx.navigate('/membership') },
      { label: '设置', accelerator: 'CmdOrCtrl+5', click: () => ctx.navigate('/settings') },
    ],
  }

  const windowMenu = {
    label: '窗口',
    submenu: [
      { role: 'minimize', label: '最小化' },
      ...(isMac ? [{ role: 'zoom', label: '缩放' }, separator, { role: 'front', label: '前置全部窗口' }] : [{ role: 'close', label: '关闭窗口' }]),
    ],
  }

  const helpMenu = {
    label: '帮助',
    role: 'help',
    submenu: [
      { label: `打开${app.name}网页版`, click: ctx.openWebsite },
      { label: '下载页与更新说明', click: ctx.openDownloadPage },
      separator,
      ...(isMac ? [] : [{ label: '检查更新…', click: ctx.checkForUpdates }]),
      { label: '服务器设置…', click: ctx.openSettings },
      separator,
      { label: '清除缓存并重新加载', click: ctx.clearCache },
      { label: '退出登录并清除本地数据…', click: ctx.signOut },
      ...(isMac ? [] : [separator, { label: `关于${app.name}`, click: ctx.showAbout }]),
    ],
  }

  return Menu.buildFromTemplate([...(isMac ? [appMenu] : []), fileMenu, editMenu, viewMenu, goMenu, windowMenu, helpMenu])
}

module.exports = { buildAppMenu }
