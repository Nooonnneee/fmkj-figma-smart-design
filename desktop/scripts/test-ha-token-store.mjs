// 令牌加密存储测试：用 mock safeStorage，不启动 Electron。
// 覆盖 0600 权限、密文不含明文令牌、安全存储不可用时拒绝保存。
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const { createTokenStore } = require('../src/ha/token-store.js')

const TOKEN = 'secret-token-do-not-leak'

function mockSafeStorage() {
  const state = { available: true }
  return {
    state,
    isEncryptionAvailable: () => state.available,
    encryptString: (value) => Buffer.from(`enc:${Buffer.from(value, 'utf8').toString('base64')}`),
    decryptString: (buffer) => {
      const text = Buffer.from(buffer).toString('utf8')
      if (!text.startsWith('enc:')) throw new Error('BAD_CIPHERTEXT')
      return Buffer.from(text.slice(4), 'base64').toString('utf8')
    },
  }
}

function withStore(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eevee-ha-token-'))
  try {
    const safeStorage = mockSafeStorage()
    const store = createTokenStore({ userDataPath: dir, safeStorage })
    return run({ dir, store, safeStorage })
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

test('保存后能解密读回，文件权限 0600 且不含明文令牌', () => {
  withStore(({ store }) => {
    assert.equal(store.load(), null)

    store.save({ baseUrl: 'http://ha.local:8123', token: TOKEN })
    assert.deepEqual(store.load(), { baseUrl: 'http://ha.local:8123', token: TOKEN })

    const file = store.filePath()
    assert.ok(fs.existsSync(file))
    assert.equal(fs.statSync(file).mode & 0o777, 0o600, '令牌文件必须是 0600')
    assert.ok(!fs.readFileSync(file).includes(TOKEN), '文件里不得出现明文令牌')
  })
})

test('安全存储不可用时拒绝保存，且不落任何文件', () => {
  withStore(({ store, safeStorage }) => {
    safeStorage.state.available = false

    assert.throws(() => store.save({ baseUrl: 'http://ha.local:8123', token: TOKEN }), /ENCRYPTION_UNAVAILABLE/)
    assert.equal(fs.existsSync(store.filePath()), false, '不可用时不能写明文或空文件')
    assert.equal(store.load(), null)
    assert.equal(store.isEncryptionAvailable(), false)
  })
})

test('空令牌或空地址拒绝保存', () => {
  withStore(({ store }) => {
    assert.throws(() => store.save({ baseUrl: 'http://ha.local:8123', token: '' }), /INVALID_TOKEN/)
    assert.throws(() => store.save({ baseUrl: '', token: TOKEN }), /INVALID_BASE_URL/)
    assert.equal(store.load(), null)
  })
})

test('损坏的密文按未配置处理', () => {
  withStore(({ store }) => {
    fs.mkdirSync(path.dirname(store.filePath()), { recursive: true })
    fs.writeFileSync(store.filePath(), 'not-encrypted', { mode: 0o600 })
    // 新建实例避开内存缓存
    const fresh = createTokenStore({ userDataPath: path.dirname(store.filePath()), safeStorage: mockSafeStorage() })
    assert.equal(fresh.load(), null)
  })
})

test('clear 删除文件并清空内存缓存', () => {
  withStore(({ store }) => {
    store.save({ baseUrl: 'http://ha.local:8123', token: TOKEN })
    store.clear()
    assert.equal(fs.existsSync(store.filePath()), false)
    assert.equal(store.load(), null)
    store.clear() // 重复清除不抛错
  })
})
