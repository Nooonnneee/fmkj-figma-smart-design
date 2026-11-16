// 用户数据目录迁移的行为测试：node desktop/scripts/test-migrate-user-data.mjs
// 不依赖 Electron，用临时目录模拟 appData，覆盖 rename、Electron 预建目标目录、
// sentinel 去重、复制失败不阻塞等分支。
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { migrateLegacyUserData } = require('../src/migrate-user-data.js')

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eevee-migrate-'))
const SENTINEL = '.profile-migrated'
let failures = 0
let caseId = 0

function test(name, fn) {
  caseId += 1
  const root = path.join(tempRoot, String(caseId))
  const appDataPath = path.join(root, 'appData')
  fs.mkdirSync(appDataPath, { recursive: true })
  try {
    fn(appDataPath)
    console.log(`✓ ${name}`)
  } catch (error) {
    failures += 1
    console.error(`✗ ${name}\n  ${String(error.message).split('\n').join('\n  ')}`)
  }
}

const legacyPath = (appDataPath) => path.join(appDataPath, '繁梦空间')
const targetPath = (appDataPath) => path.join(appDataPath, 'Eevee')
const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null)

function createLegacy(appDataPath, files) {
  const legacy = legacyPath(appDataPath)
  fs.mkdirSync(legacy, { recursive: true })
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(legacy, name)), { recursive: true })
    fs.writeFileSync(path.join(legacy, name), content)
  }
  return legacy
}

function createTarget(appDataPath, files) {
  const target = targetPath(appDataPath)
  fs.mkdirSync(target, { recursive: true })
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(target, name)), { recursive: true })
    fs.writeFileSync(path.join(target, name), content)
  }
  return target
}

test('目标目录已被 Electron 预建（含 GPUCache）时仍合并迁移', (appDataPath) => {
  const legacy = createLegacy(appDataPath, {
    'settings.json': '{"serverUrl":"https://private.example"}',
    'window-state.json': '{"width":1200}',
  })
  const target = createTarget(appDataPath, { 'GPUCache/data_0': 'cache' })

  const result = migrateLegacyUserData({ appDataPath, userDataPath: target })

  assert.equal(result, 'copied')
  assert.equal(read(path.join(target, 'settings.json')), '{"serverUrl":"https://private.example"}')
  assert.equal(read(path.join(target, 'window-state.json')), '{"width":1200}')
  assert.equal(read(path.join(target, 'GPUCache/data_0')), 'cache', '不能删掉 Electron 的缓存目录')
  assert.ok(fs.existsSync(path.join(target, SENTINEL)), '迁移成功后必须写 sentinel')
  assert.equal(fs.existsSync(legacy), false, '迁移成功后旧目录应被删除')
})

test('sentinel 已存在时不重复迁移', (appDataPath) => {
  const legacy = createLegacy(appDataPath, { 'settings.json': '{"serverUrl":"https://old.example"}' })
  const target = createTarget(appDataPath, {
    'settings.json': '{"serverUrl":"https://new.example"}',
    [SENTINEL]: 'done\n',
  })

  const result = migrateLegacyUserData({ appDataPath, userDataPath: target })

  assert.equal(result, 'unchanged')
  assert.equal(read(path.join(target, 'settings.json')), '{"serverUrl":"https://new.example"}')
  assert.equal(fs.existsSync(legacy), true, '不应再碰旧目录')
})

test('复制失败不阻塞，清理写了一半的目标内容并保留旧目录', (appDataPath) => {
  const legacy = createLegacy(appDataPath, { 'settings.json': '{"serverUrl":"https://keep.example"}' })
  const target = createTarget(appDataPath, { 'GPUCache/data_0': 'cache' })

  const originalCp = fs.cpSync
  fs.cpSync = (src, dest) => {
    fs.writeFileSync(path.join(dest, 'settings.json'), '{"partial":true}')
    throw new Error('EACCES: permission denied')
  }
  let result
  try {
    result = migrateLegacyUserData({ appDataPath, userDataPath: target, log: () => {} })
  } finally {
    fs.cpSync = originalCp
  }

  assert.equal(result, 'failed')
  assert.equal(read(path.join(legacy, 'settings.json')), '{"serverUrl":"https://keep.example"}', '旧数据必须保留')
  assert.equal(fs.existsSync(path.join(target, 'settings.json')), false, '半成品要清掉')
  assert.equal(read(path.join(target, 'GPUCache/data_0')), 'cache', '预建缓存不能被顺手删掉')
  assert.equal(fs.existsSync(path.join(target, SENTINEL)), false, '失败时不能写 sentinel')
})

test('目标不存在时直接 rename 并写 sentinel', (appDataPath) => {
  const legacy = createLegacy(appDataPath, { 'Cookies': 'cookie-data' })
  const target = targetPath(appDataPath)

  const result = migrateLegacyUserData({ appDataPath, userDataPath: target })

  assert.equal(result, 'renamed')
  assert.equal(read(path.join(target, 'Cookies')), 'cookie-data')
  assert.ok(fs.existsSync(path.join(target, SENTINEL)))
  assert.equal(fs.existsSync(legacy), false)
})

test('rename 失败（跨设备）时退化为复制', (appDataPath) => {
  const legacy = createLegacy(appDataPath, { 'Cookies': 'cookie-data' })
  const target = targetPath(appDataPath)

  const originalRename = fs.renameSync
  fs.renameSync = () => {
    const error = new Error('EXDEV: cross-device link not permitted')
    error.code = 'EXDEV'
    throw error
  }
  let result
  try {
    result = migrateLegacyUserData({ appDataPath, userDataPath: target, log: () => {} })
  } finally {
    fs.renameSync = originalRename
  }

  assert.equal(result, 'copied')
  assert.equal(read(path.join(target, 'Cookies')), 'cookie-data')
  assert.ok(fs.existsSync(path.join(target, SENTINEL)))
  assert.equal(fs.existsSync(legacy), false)
})

fs.rmSync(tempRoot, { recursive: true, force: true })
if (failures) {
  console.error(`\n${failures} 项迁移测试未通过`)
  process.exit(1)
}
console.log('\n用户数据迁移测试全部通过')
