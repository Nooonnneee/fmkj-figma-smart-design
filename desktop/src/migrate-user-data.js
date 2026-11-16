'use strict'

const fs = require('node:fs')
const path = require('node:path')

/**
 * 客户端显示名从「繁梦空间」改成 Eevee 后，Electron 默认的 userData 目录也会变。
 * 这里把旧目录一次性迁移到新目录：
 *   - 旧有新无：先 rename；跨设备等原因失败时退化为递归复制，复制成功后再删旧目录
 *   - 新目录已存在：什么都不做，绝不覆盖新数据
 *   - 任何失败：只记日志，返回后继续用新目录，不能阻止客户端启动
 *
 * 必须在 app.whenReady() 之前、任何 config/store 读写之前调用，否则新版会先在
 * 新目录里写入空设置，导致老用户掉登录、丢窗口位置、丢私有部署服务器地址。
 *
 * @returns {'unchanged' | 'renamed' | 'copied' | 'failed'}
 */
function migrateLegacyUserData({ appDataPath, userDataPath, log = console.warn }) {
  const legacyPath = path.resolve(path.join(appDataPath, '繁梦空间'))
  const currentPath = path.resolve(userDataPath)
  if (legacyPath === currentPath) return 'unchanged'
  if (!fs.existsSync(legacyPath) || fs.existsSync(currentPath)) return 'unchanged'

  try {
    fs.renameSync(legacyPath, currentPath)
    return 'renamed'
  } catch (error) {
    log('[desktop] 用户数据目录改名失败，改为复制：', error.message)
  }

  try {
    fs.cpSync(legacyPath, currentPath, { recursive: true })
  } catch (error) {
    log('[desktop] 复制旧用户数据目录失败，继续使用新目录：', error.message)
    return 'failed'
  }

  try {
    fs.rmSync(legacyPath, { recursive: true, force: true })
  } catch (error) {
    // 复制已经成功，旧目录删不掉不影响使用
    log('[desktop] 旧用户数据目录删除失败，已保留：', error.message)
  }
  return 'copied'
}

module.exports = { migrateLegacyUserData }
