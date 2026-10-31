'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { app } = require('electron')

// 用户数据目录下的小型 JSON 文件（设置、窗口位置、上次打开的页面）。

function filePath(name) {
  return path.join(app.getPath('userData'), name)
}

function readJson(name, fallback) {
  try {
    const value = JSON.parse(fs.readFileSync(filePath(name), 'utf8'))
    return value && typeof value === 'object' ? value : fallback
  } catch {
    return fallback
  }
}

function writeJson(name, value) {
  const file = filePath(name)
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    // 先写临时文件再改名，避免写到一半断电导致文件损坏
    const temp = `${file}.${process.pid}.tmp`
    fs.writeFileSync(temp, JSON.stringify(value, null, 2))
    fs.renameSync(temp, file)
  } catch (error) {
    console.warn(`[store] 写入 ${name} 失败`, error)
  }
}

module.exports = { readJson, writeJson }
