'use strict'

const { screen } = require('electron')
const { readJson, writeJson } = require('./store')

const STATE_FILE = 'window-state.json'
const DEFAULT_SIZE = { width: 1440, height: 900 }
const MIN_SIZE = { width: 1024, height: 680 }

/** 窗口至少有一部分落在某个显示器内（拔掉外接屏后不会跑到屏幕外） */
function isVisibleOnSomeDisplay(bounds) {
  return screen.getAllDisplays().some(({ workArea: area }) => {
    return (
      bounds.x < area.x + area.width - 64 &&
      bounds.x + bounds.width > area.x + 64 &&
      bounds.y >= area.y - 8 &&
      bounds.y < area.y + area.height - 64
    )
  })
}

function loadWindowState() {
  const saved = readJson(STATE_FILE, {})
  const { workAreaSize } = screen.getPrimaryDisplay()
  const width = Math.min(Math.max(Number(saved.width) || DEFAULT_SIZE.width, MIN_SIZE.width), workAreaSize.width)
  const height = Math.min(Math.max(Number(saved.height) || DEFAULT_SIZE.height, MIN_SIZE.height), workAreaSize.height)
  const bounds = { width, height }
  if (Number.isFinite(saved.x) && Number.isFinite(saved.y) && isVisibleOnSomeDisplay({ x: saved.x, y: saved.y, width, height })) {
    bounds.x = saved.x
    bounds.y = saved.y
  }
  return { bounds, isMaximized: Boolean(saved.isMaximized) }
}

function trackWindowState(win) {
  let timer = null
  const save = () => {
    if (win.isDestroyed()) return
    writeJson(STATE_FILE, { ...win.getNormalBounds(), isMaximized: win.isMaximized() || win.isFullScreen() })
  }
  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(save, 500)
  }
  win.on('resize', schedule)
  win.on('move', schedule)
  win.on('close', () => {
    clearTimeout(timer)
    save()
  })
}

module.exports = { MIN_SIZE, loadWindowState, trackWindowState }
