'use strict'

// 繁梦空间桌面客户端主进程：用原生窗口加载繁梦空间服务器上的工作台。

const path = require('node:path')
const { fileURLToPath, pathToFileURL } = require('node:url')
const { app, BrowserWindow, Menu, clipboard, dialog, ipcMain, net, safeStorage, session } = require('electron')

// 客户端显示名从「繁梦空间」改成 Eevee 后，Electron 的默认 userData 目录也会跟着变。
// 必须在 app.whenReady() 之前、任何 config/store 读写之前迁移，否则新版会先在新目录
// 写入空设置，老用户会掉登录、重置窗口位置，私有部署地址也会丢。
// 注意：这里不能调 app.getPath('userData')，它会把新目录连同 GPUCache 直接建出来；
// 用 appData + app.getName() 算出目标路径，迁移完再让 store 走正常的 userData。
const { migrateLegacyUserData } = require('./migrate-user-data')
migrateLegacyUserData({
  appDataPath: app.getPath('appData'),
  userDataPath: path.join(app.getPath('appData'), app.getName()),
})

const config = require('./config')
const { readJson, writeJson } = require('./store')
const { MIN_SIZE, loadWindowState, trackWindowState } = require('./window-state')
const { buildAppMenu } = require('./menu')
const { attachContextMenu } = require('./context-menu')
const { setupDownloads } = require('./downloads')
const { createUpdater } = require('./updater')
const { hardenSession, openExternal } = require('./security')
const { deepLinkToUrl, isSameOrigin, normalizeServerUrl } = require('./lib/urls')
const { createHaBridge } = require('./ha/bridge')
const { createTokenStore } = require('./ha/token-store')

const PROTOCOL = config.appConfig.protocol
const RENDERER_DIR = path.join(__dirname, 'renderer')
const PRELOAD = path.join(__dirname, 'preload.js')
const BACKGROUND = '#0b0c1e'
const START_PATH = '/projects'
const SESSION_FILE = 'session.json'
const isMac = process.platform === 'darwin'
const isDev = !app.isPackaged

/** 工作台窗口（不含设置窗口和网页里 window.open 打开的子窗口） */
const appWindows = new Set()
let mainWindow = null
let settingsWindow = null
let pendingUrl = null
let ready = false
/** webContents → 加载失败的地址 / 连续失败次数，用于离线页重试 */
const failedUrls = new WeakMap()
const retryCounts = new WeakMap()

const updater = createUpdater({
  getFeedUrl: () => config.getUpdateFeedUrl(),
  getDownloadPageUrl: () => new URL('/download', config.getServerUrl()).href,
  getWindow: () => focusedAppWindow(),
})

// ---------------------------------------------------------------------------
// 地址与页面
// ---------------------------------------------------------------------------

function startUrl() {
  return new URL(START_PATH, config.getServerUrl()).href
}

function normalizeForCompare(filePath) {
  const normalized = path.normalize(filePath)
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}
const RENDERER_ROOT = normalizeForCompare(RENDERER_DIR + path.sep)

/** 是否为客户端自带的本地页面（离线页、服务器设置） */
function isLocalPage(url) {
  if (typeof url !== 'string' || !url.startsWith('file:')) return false
  try {
    return normalizeForCompare(fileURLToPath(url)).startsWith(RENDERER_ROOT)
  } catch {
    return false
  }
}

function isAllowedNavigation(url) {
  return isSameOrigin(url, config.getServerUrl()) || isLocalPage(url) || url === 'about:blank'
}

function lastVisitedUrl() {
  const saved = readJson(SESSION_FILE, {})
  const server = config.getServerUrl()
  if (saved.server !== server || typeof saved.lastPath !== 'string' || !saved.lastPath.startsWith('/') || saved.lastPath === '/') return null
  try {
    const url = new URL(saved.lastPath, server)
    return isSameOrigin(url.href, server) ? url.href : null
  } catch {
    return null
  }
}

let saveSessionTimer = null
function rememberVisit(win, url) {
  const contents = win.webContents
  if (!isSameOrigin(url, config.getServerUrl())) return
  retryCounts.delete(contents)
  failedUrls.delete(contents)
  if (win !== mainWindow) return
  const { pathname, search } = new URL(url)
  // 登录、注册、后台等页面不作为下次启动的起始页
  if (/^\/(login|join|auth|admin|print)(\/|$)/.test(pathname)) return
  clearTimeout(saveSessionTimer)
  saveSessionTimer = setTimeout(() => writeJson(SESSION_FILE, { server: config.getServerUrl(), lastPath: pathname + search }), 800)
}

// ---------------------------------------------------------------------------
// 窗口
// ---------------------------------------------------------------------------

function webPreferences() {
  return {
    preload: PRELOAD,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    spellcheck: false,
    navigateOnDragDrop: false,
    safeDialogs: true,
    additionalArguments: [`--fmkj-version=${app.getVersion()}`],
  }
}

function focusedAppWindow() {
  const focused = BrowserWindow.getFocusedWindow()
  if (focused && focused !== settingsWindow && !focused.isDestroyed()) return focused
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
}

function showMessage(win, options) {
  return win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options)
}

function createAppWindow(url = startUrl(), { restoreState = false } = {}) {
  const state = restoreState ? loadWindowState() : null
  const win = new BrowserWindow({
    ...(state ? state.bounds : { width: 1280, height: 820 }),
    minWidth: MIN_SIZE.width,
    minHeight: MIN_SIZE.height,
    title: app.name,
    show: false,
    backgroundColor: BACKGROUND,
    webPreferences: webPreferences(),
  })
  appWindows.add(win)
  if (state) trackWindowState(win)

  let shown = false
  const show = () => {
    if (shown || win.isDestroyed()) return
    shown = true
    if (state && state.isMaximized) win.maximize()
    win.show()
  }
  win.once('ready-to-show', show)
  // 网络较慢时先显示深色窗口，避免用户以为没有打开
  setTimeout(show, 2000)

  wireAppWindow(win)
  win.on('closed', () => {
    appWindows.delete(win)
    if (mainWindow === win) mainWindow = appWindows.values().next().value || null
  })
  win.loadURL(url).catch(() => {}) // 失败由 did-fail-load 统一处理
  return win
}

function wireAppWindow(win) {
  const contents = win.webContents

  contents.on('did-fail-load', (_event, errorCode, _description, validatedURL, isMainFrame) => {
    // -3 = ERR_ABORTED：页面自己跳转或用户取消，不算失败
    if (!isMainFrame || errorCode === -3) return
    showOfflinePage(win, validatedURL, errorCode)
  })
  contents.on('did-navigate', (_event, url, httpResponseCode) => {
    if ([502, 503, 504].includes(httpResponseCode) && isSameOrigin(url, config.getServerUrl())) {
      showOfflinePage(win, url, httpResponseCode)
      return
    }
    rememberVisit(win, url)
  })
  contents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
    if (isMainFrame) rememberVisit(win, url)
  })
  contents.on('render-process-gone', (_event, details) => {
    if (details.reason === 'clean-exit' || win.isDestroyed()) return
    showOfflinePage(win, failedUrls.get(contents) || contents.getURL(), 'crashed')
  })
  contents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F5') {
      event.preventDefault()
      reloadWindow(win, input.control || input.shift)
    }
  })

  let askingUnresponsive = false
  win.on('unresponsive', async () => {
    if (askingUnresponsive || win.isDestroyed()) return
    askingUnresponsive = true
    const { response } = await showMessage(win, {
      type: 'warning',
      title: '页面无响应',
      message: '页面长时间没有响应',
      detail: '可以继续等待，或重新加载页面（未保存的修改可能丢失）。',
      buttons: ['继续等待', '重新加载'],
      defaultId: 0,
      cancelId: 0,
    })
    askingUnresponsive = false
    if (response === 1 && !win.isDestroyed()) contents.reloadIgnoringCache()
  })
}

function showOfflinePage(win, failedUrl, code) {
  if (win.isDestroyed()) return
  const server = config.getServerUrl()
  const contents = win.webContents
  failedUrls.set(contents, failedUrl && isSameOrigin(failedUrl, server) ? failedUrl : startUrl())
  const attempt = (retryCounts.get(contents) || 0) + 1
  retryCounts.set(contents, attempt)

  const page = pathToFileURL(path.join(RENDERER_DIR, 'offline.html'))
  page.searchParams.set('code', String(code))
  page.searchParams.set('host', new URL(server).host)
  // 连续失败时逐步拉长自动重试间隔：15s → 30s → 60s → 120s
  page.searchParams.set('retryIn', String(Math.min(15 * 2 ** (attempt - 1), 120)))
  contents.loadURL(page.href).catch(() => {})
  if (!win.isVisible()) win.show()
}

function retryContents(contents) {
  contents.loadURL(failedUrls.get(contents) || startUrl()).catch(() => {})
}

function reloadWindow(win, force) {
  const contents = win.webContents
  if (isLocalPage(contents.getURL())) retryContents(contents)
  else if (force) contents.reloadIgnoringCache()
  else contents.reload()
}

function focusMainWindow() {
  const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
  if (!win) {
    if (ready) mainWindow = createAppWindow()
    return
  }
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function openDeepLink(link) {
  const target = deepLinkToUrl(link, PROTOCOL, config.getServerUrl())
  if (!target) return
  if (!ready) {
    pendingUrl = target
    return
  }
  focusMainWindow()
  if (mainWindow) mainWindow.loadURL(target).catch(() => {})
}

function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return
  }
  const parent = focusedAppWindow() || undefined
  settingsWindow = new BrowserWindow({
    parent,
    modal: Boolean(parent),
    width: 560,
    height: 720,
    minWidth: 480,
    minHeight: 560,
    resizable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: '服务器设置',
    show: false,
    backgroundColor: BACKGROUND,
    autoHideMenuBar: true,
    webPreferences: webPreferences(),
  })
  settingsWindow.setMenu(null)
  settingsWindow.once('ready-to-show', () => settingsWindow && settingsWindow.show())
  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
  settingsWindow.loadFile(path.join(RENDERER_DIR, 'settings.html')).catch(() => {})
}

// ---------------------------------------------------------------------------
// 所有网页内容的安全限制
// ---------------------------------------------------------------------------

function hardenWebContents(contents) {
  contents.on('will-attach-webview', (event) => event.preventDefault())

  // 只允许在当前服务器和客户端本地页面之间跳转，其余链接交给系统浏览器
  contents.on('will-navigate', (event, legacyUrl) => {
    const url = (event && event.url) || legacyUrl
    if (isAllowedNavigation(url)) return
    event.preventDefault()
    openExternal(url)
  })
  contents.on('will-redirect', (event, legacyUrl) => {
    const url = (event && event.url) || legacyUrl
    if (event && event.isMainFrame === false) return
    if (isAllowedNavigation(url)) return
    event.preventDefault()
    openExternal(url)
  })

  // 同一服务器的新窗口（如打印预览）用客户端窗口打开，其它一律用系统浏览器
  contents.setWindowOpenHandler(({ url }) => {
    if (isSameOrigin(url, config.getServerUrl())) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 1200,
          height: 860,
          minWidth: 800,
          minHeight: 600,
          backgroundColor: BACKGROUND,
          webPreferences: webPreferences(),
        },
      }
    }
    openExternal(url)
    return { action: 'deny' }
  })

  attachContextMenu(contents, { openExternal, isDev })
}

// ---------------------------------------------------------------------------
// 服务器设置
// ---------------------------------------------------------------------------

async function testServer(input) {
  const origin = normalizeServerUrl(input)
  if (!origin) return { ok: false, message: '请输入有效的服务器地址，例如 https://fmkj.top' }
  try {
    const manifest = await net.fetch(`${origin}/downloads/desktop/manifest`, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (manifest.ok) {
      const data = await manifest.json().catch(() => null)
      if (data && data.app === 'fanmeng-space') return { ok: true, origin, message: '连接成功，已确认是繁梦空间服务器' }
    }
    const login = await net.fetch(`${origin}/login`, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (login.ok) return { ok: true, origin, message: '连接成功' }
    return { ok: false, origin, message: `服务器返回 ${login.status}，请确认地址是否正确` }
  } catch (error) {
    const timeout = error && error.name === 'TimeoutError'
    return { ok: false, origin, message: timeout ? '连接超时，请检查地址和网络' : '无法连接到该地址，请检查地址和网络' }
  }
}

function applyServerUrl(input) {
  if (config.isServerOverridden()) return { ok: false, message: '当前服务器由启动参数指定，无法在这里修改' }
  let serverUrl
  try {
    serverUrl = config.setServerUrl(input)
  } catch {
    return { ok: false, message: '请输入有效的服务器地址，例如 https://fmkj.top' }
  }
  for (const win of appWindows) {
    failedUrls.delete(win.webContents)
    retryCounts.delete(win.webContents)
    win.loadURL(startUrl()).catch(() => {})
  }
  if (appWindows.size === 0) mainWindow = createAppWindow()
  refreshMenu()
  return { ok: true, serverUrl }
}

// ---------------------------------------------------------------------------
// IPC：只响应当前服务器页面和客户端本地页面的顶层框架
// ---------------------------------------------------------------------------

function topFrameUrl(event) {
  const frame = event.senderFrame
  if (!frame || frame.parent) return null
  return frame.url
}

function registerIpc() {
  const fromTrusted = (event) => {
    const url = topFrameUrl(event)
    return Boolean(url) && (isLocalPage(url) || isSameOrigin(url, config.getServerUrl()))
  }
  const fromLocal = (event) => isLocalPage(topFrameUrl(event))
  const guard = (check, handler) => (event, ...args) => {
    if (!check(event)) throw new Error('FORBIDDEN')
    return handler(event, ...args)
  }

  ipcMain.handle('desktop:check-updates', guard(fromTrusted, () => updater.check({ manual: true })))
  ipcMain.handle('desktop:open-settings', guard(fromTrusted, () => openSettingsWindow()))
  ipcMain.handle('desktop:open-external', guard(fromTrusted, (_event, url) => openExternal(String(url))))
  ipcMain.handle('desktop:retry', guard(fromTrusted, (event) => retryContents(event.sender)))

  ipcMain.handle(
    'settings:get',
    guard(fromLocal, () => ({
      serverUrl: config.getServerUrl(),
      defaultServerUrl: config.DEFAULT_SERVER_URL,
      overridden: config.isServerOverridden(),
      version: app.getVersion(),
    })),
  )
  ipcMain.handle('settings:test', guard(fromLocal, (_event, url) => testServer(String(url))))
  ipcMain.handle('settings:save', guard(fromLocal, (_event, url) => applyServerUrl(String(url))))
  ipcMain.handle('settings:reset', guard(fromLocal, () => applyServerUrl(null)))
  ipcMain.handle(
    'settings:close',
    guard(fromLocal, (event) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win) win.close()
    }),
  )

  // 智能家居直连桥：数据类只给受信任工作台页面，设置类只给本地设置页。
  createHaBridge({
    ipcMain,
    fromTrusted,
    fromLocal,
    tokenStore: createTokenStore({ userDataPath: app.getPath('userData'), safeStorage }),
  })
}

// ---------------------------------------------------------------------------
// 菜单
// ---------------------------------------------------------------------------

function currentPageUrl() {
  const win = focusedAppWindow()
  const url = win ? win.webContents.getURL() : ''
  return isSameOrigin(url, config.getServerUrl()) ? url : config.getServerUrl()
}

function forEachAppWindow(callback) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win !== settingsWindow && !win.isDestroyed()) callback(win)
  }
}

const menuContext = {
  isMac,
  isDev,
  newWindow: () => createAppWindow(),
  openSettings: () => openSettingsWindow(),
  checkForUpdates: () => updater.check({ manual: true }),
  navigate: (pathname) => {
    const url = new URL(pathname, config.getServerUrl()).href
    const win = focusedAppWindow()
    if (win) win.loadURL(url).catch(() => {})
    else mainWindow = createAppWindow(url)
  },
  goBack: () => {
    const history = focusedAppWindow()?.webContents.navigationHistory
    if (history && history.canGoBack()) history.goBack()
  },
  goForward: () => {
    const history = focusedAppWindow()?.webContents.navigationHistory
    if (history && history.canGoForward()) history.goForward()
  },
  reload: () => {
    const win = focusedAppWindow()
    if (win) reloadWindow(win, false)
  },
  forceReload: () => {
    const win = focusedAppWindow()
    if (win) reloadWindow(win, true)
  },
  print: () => focusedAppWindow()?.webContents.print({ printBackground: true }),
  openInBrowser: () => openExternal(currentPageUrl()),
  copyLink: () => clipboard.writeText(currentPageUrl()),
  openWebsite: () => openExternal(config.getServerUrl()),
  openDownloadPage: () => openExternal(new URL('/download', config.getServerUrl()).href),
  clearCache: async () => {
    await session.defaultSession.clearCache()
    forEachAppWindow((win) => win.webContents.reloadIgnoringCache())
  },
  signOut: async () => {
    const { response } = await showMessage(focusedAppWindow(), {
      type: 'warning',
      title: '退出登录',
      message: '退出登录并清除本地数据？',
      detail: '会清除这台电脑上的登录状态、缓存和页面数据，不会删除服务器上的任何内容。',
      buttons: ['退出登录', '取消'],
      defaultId: 1,
      cancelId: 1,
    })
    if (response !== 0) return
    await session.defaultSession.clearStorageData()
    await session.defaultSession.clearCache()
    forEachAppWindow((win) => win.loadURL(startUrl()).catch(() => {}))
  },
  showAbout: () =>
    showMessage(focusedAppWindow(), {
      type: 'info',
      title: `关于${app.name}`,
      message: `${app.name} ${app.getVersion()}`,
      detail: [`服务器：${config.getServerUrl()}`, `Electron ${process.versions.electron} · Chromium ${process.versions.chrome}`, config.appConfig.copyright].join('\n'),
      buttons: ['好的'],
    }),
}

function refreshMenu() {
  Menu.setApplicationMenu(buildAppMenu(menuContext))
}

// ---------------------------------------------------------------------------
// 启动
// ---------------------------------------------------------------------------

function registerProtocol() {
  if (process.defaultApp && process.argv.length >= 2) {
    // 开发模式（electron .）需要带上项目路径
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])])
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL)
  }
}

function onReady() {
  if (process.platform === 'win32') app.setAppUserModelId(config.appConfig.appId)
  // 让网站能识别桌面客户端（例如下载页显示当前版本）
  app.userAgentFallback = `${app.userAgentFallback} FanmengSpaceDesktop/${app.getVersion()}`
  if (isMac) {
    app.setAboutPanelOptions({
      applicationName: app.name,
      applicationVersion: app.getVersion(),
      version: '',
      copyright: config.appConfig.copyright,
    })
    if (app.dock) app.dock.setMenu(Menu.buildFromTemplate([{ label: '新建窗口', click: () => createAppWindow() }]))
  }

  hardenSession(session.defaultSession, () => config.getServerUrl())
  setupDownloads(session.defaultSession, () => focusedAppWindow())
  registerIpc()
  refreshMenu()

  const argvLink = process.argv.find((arg) => arg.startsWith(`${PROTOCOL}://`))
  const initialUrl = (argvLink && deepLinkToUrl(argvLink, PROTOCOL, config.getServerUrl())) || pendingUrl || lastVisitedUrl() || startUrl()
  pendingUrl = null
  ready = true
  mainWindow = createAppWindow(initialUrl, { restoreState: true })
  updater.start()
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.enableSandbox()
  registerProtocol()

  app.on('second-instance', (_event, argv) => {
    const link = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`))
    if (link) openDeepLink(link)
    else focusMainWindow()
  })
  // macOS 通过 fanmeng:// 链接唤起（可能早于 ready）
  app.on('open-url', (event, url) => {
    event.preventDefault()
    openDeepLink(url)
  })
  app.on('web-contents-created', (_event, contents) => hardenWebContents(contents))
  app.on('window-all-closed', () => {
    if (!isMac) app.quit()
  })
  app.on('activate', () => {
    if (ready && appWindows.size === 0) mainWindow = createAppWindow()
  })
  app.whenReady().then(onReady)
}
