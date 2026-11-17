'use strict'

// Home Assistant 配对信息（地址 + 长期访问令牌）的本地加密存储。
//
// 令牌只能经 Electron safeStorage.encryptString 加密后落盘；系统安全存储不可用时
// 直接拒绝保存，绝不退化成明文。读取接口只在主进程内部使用，桥不会把令牌返回给渲染进程。
//
// Linux 注意：safeStorage 在 Linux 上依赖桌面密钥环（gnome-libsecret / kwallet）。
// 没有可用密钥环时 isEncryptionAvailable() 为 false，本模块会拒绝保存；某些环境下
// Electron 会退回到 basic_text（可逆的固定密钥），加密强度有限，但也不会是明文。

const fs = require('node:fs')
const path = require('node:path')

const FILE_NAME = 'ha-config.enc'
const FILE_MODE = 0o600

function createTokenStore({ userDataPath, safeStorage, fileName = FILE_NAME } = {}) {
  if (typeof userDataPath !== 'string' || !userDataPath) throw new Error('USER_DATA_PATH_REQUIRED')
  if (!safeStorage) throw new Error('SAFE_STORAGE_REQUIRED')

  const filePath = path.join(userDataPath, fileName)
  // undefined = 尚未读过；null = 已确认没有可用配置
  let cached

  function isEncryptionAvailable() {
    try {
      return Boolean(safeStorage.isEncryptionAvailable())
    } catch {
      return false
    }
  }

  /** 只在主进程内部读取；文件缺失、损坏或无法解密时返回 null。 */
  function load() {
    if (cached !== undefined) return cached
    try {
      if (!fs.existsSync(filePath) || !isEncryptionAvailable()) {
        cached = null
        return null
      }
      const encrypted = fs.readFileSync(filePath)
      const decrypted = safeStorage.decryptString(encrypted)
      const parsed = JSON.parse(decrypted)
      if (!parsed || typeof parsed.baseUrl !== 'string' || typeof parsed.token !== 'string' || !parsed.token) {
        cached = null
        return null
      }
      cached = { baseUrl: parsed.baseUrl, token: parsed.token }
      return cached
    } catch {
      cached = null
      return null
    }
  }

  /**
   * 保存配对信息。系统安全存储不可用时抛出 ENCRYPTION_UNAVAILABLE，
   * 调用方必须把错误展示给用户，不允许改存明文。
   */
  function save({ baseUrl, token } = {}) {
    if (!isEncryptionAvailable()) throw new Error('ENCRYPTION_UNAVAILABLE')
    if (typeof token !== 'string' || !token.trim()) throw new Error('INVALID_TOKEN')
    if (typeof baseUrl !== 'string' || !baseUrl) throw new Error('INVALID_BASE_URL')

    const encrypted = safeStorage.encryptString(JSON.stringify({ baseUrl, token }))
    if (!Buffer.isBuffer(encrypted) || encrypted.length === 0) throw new Error('ENCRYPTION_FAILED')

    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    // 先写临时文件再改名：即使写入途中断电也不会留下半个密文。
    const temp = `${filePath}.${process.pid}.tmp`
    try {
      fs.writeFileSync(temp, encrypted, { mode: FILE_MODE })
      fs.chmodSync(temp, FILE_MODE)
      fs.renameSync(temp, filePath)
      fs.chmodSync(filePath, FILE_MODE)
    } catch (error) {
      try {
        fs.unlinkSync(temp)
      } catch {
        // 临时文件可能没写出来
      }
      throw error
    }

    cached = { baseUrl, token }
  }

  function clear() {
    cached = null
    try {
      fs.unlinkSync(filePath)
    } catch (error) {
      if (error && error.code !== 'ENOENT') throw error
    }
  }

  return {
    clear,
    filePath: () => filePath,
    isEncryptionAvailable,
    load,
    save,
  }
}

module.exports = { FILE_NAME, createTokenStore }
