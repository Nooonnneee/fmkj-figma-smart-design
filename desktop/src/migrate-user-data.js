'use strict'

const fs = require('node:fs')
const path = require('node:path')

const SENTINEL = '.profile-migrated'

function writeSentinel(dir, log) {
  try {
    fs.writeFileSync(path.join(dir, SENTINEL), `${new Date().toISOString()}\n`)
    return true
  } catch (error) {
    log('[desktop] 写入用户数据迁移标记失败：', error.message)
    return false
  }
}

/** 复制失败时清掉这次写入目标目录的内容，避免下次启动误判；旧目录保持不动。 */
function cleanupPartialCopy(legacyPath, currentPath, targetExisted, log) {
  try {
    if (!targetExisted) {
      fs.rmSync(currentPath, { recursive: true, force: true })
      return
    }
    // 目标目录是 Electron 预建的空壳（GPUCache 等），只清掉从旧目录复制过来的条目。
    for (const entry of fs.readdirSync(legacyPath)) {
      fs.rmSync(path.join(currentPath, entry), { recursive: true, force: true })
    }
  } catch (error) {
    log('[desktop] 清理未完成的用户数据迁移失败：', error.message)
  }
}

/**
 * 客户端显示名从「繁梦空间」改成 Eevee 后，Electron 默认的 userData 目录也会变。
 * 这里把旧目录一次性迁移到新目录：
 *   - 已写过 sentinel：迁移已完成，什么都不做
 *   - 旧目录存在、目标不存在：rename；失败时退化为递归复制
 *   - 旧目录存在、目标已存在但没有 sentinel（多半是 Electron 启动时预建的 GPUCache 空壳）：
 *     合并复制旧目录内容进目标，不能因为目标已存在就跳过，否则老用户设置会丢
 *   - 任何失败：清理这次写入目标的内容，保留旧目录，只记日志，不能阻止客户端启动
 *
 * 必须在 app.whenReady() 之前、任何 config/store 读写之前调用。注意调用方不能先调
 * app.getPath('userData')，因为那一步就会把新目录建出来；目标路径用
 * path.join(app.getPath('appData'), app.getName()) 计算。
 *
 * @returns {'unchanged' | 'renamed' | 'copied' | 'failed'}
 */
function migrateLegacyUserData({ appDataPath, userDataPath, log = console.warn }) {
  const legacyPath = path.resolve(path.join(appDataPath, '繁梦空间'))
  const currentPath = path.resolve(userDataPath)
  if (legacyPath === currentPath) return 'unchanged'
  if (fs.existsSync(path.join(currentPath, SENTINEL))) return 'unchanged'
  if (!fs.existsSync(legacyPath)) return 'unchanged'

  const targetExisted = fs.existsSync(currentPath)

  if (!targetExisted) {
    try {
      fs.renameSync(legacyPath, currentPath)
      writeSentinel(currentPath, log)
      return 'renamed'
    } catch (error) {
      log('[desktop] 用户数据目录改名失败，改为复制：', error.message)
    }
  }

  try {
    fs.cpSync(legacyPath, currentPath, { recursive: true, force: true })
  } catch (error) {
    log('[desktop] 复制旧用户数据目录失败，继续使用新目录：', error.message)
    cleanupPartialCopy(legacyPath, currentPath, targetExisted, log)
    return 'failed'
  }

  // 标记写入成功后才删旧目录；否则下次启动还能重试。
  if (writeSentinel(currentPath, log)) {
    try {
      fs.rmSync(legacyPath, { recursive: true, force: true })
    } catch (error) {
      // 复制已经成功，旧目录删不掉不影响使用
      log('[desktop] 旧用户数据目录删除失败，已保留：', error.message)
    }
  }
  return 'copied'
}

module.exports = { migrateLegacyUserData }
