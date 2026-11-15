import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  AiChannelCryptoError,
  apiKeyHint,
  currentKeyId,
  keyIdOf,
  needsReencrypt,
  open,
  seal,
} from './ai-channels-crypto'

const ORIGINAL = {
  PAYLOAD_SECRET: process.env.PAYLOAD_SECRET,
  AI_CHANNELS_KEY_ID: process.env.AI_CHANNELS_KEY_ID,
  AI_CHANNELS_OLD_KEYS: process.env.AI_CHANNELS_OLD_KEYS,
}

function restore(name: keyof typeof ORIGINAL) {
  if (ORIGINAL[name] === undefined) delete process.env[name]
  else process.env[name] = ORIGINAL[name]
}

beforeEach(() => {
  process.env.PAYLOAD_SECRET = 'unit-test-payload-secret-0123456789abcdef'
  delete process.env.AI_CHANNELS_KEY_ID
  delete process.env.AI_CHANNELS_OLD_KEYS
})

afterEach(() => {
  restore('PAYLOAD_SECRET')
  restore('AI_CHANNELS_KEY_ID')
  restore('AI_CHANNELS_OLD_KEYS')
})

describe('seal / open 往返', () => {
  it('普通 key 往返一致，且密文带 `v1:<keyId>:` 前缀', () => {
    const plain = 'sk-proj-abcdef1234567890'
    const sealed = seal(plain)
    expect(sealed.startsWith('v1:k1:')).toBe(true)
    expect(sealed).not.toContain(plain)
    expect(open(sealed)).toBe(plain)
    expect(keyIdOf(sealed)).toBe('k1')
  })

  it('空串可以加密并原样解出', () => {
    expect(open(seal(''))).toBe('')
  })

  it('中文与特殊字符往返一致', () => {
    const plain = '密钥-中文🔑\n\t"quotes" \\backslash\\ {}[]:;,@#$%^&*()'
    expect(open(seal(plain))).toBe(plain)
  })

  it('超长 key（10000 字符）往返一致', () => {
    const plain = 'k'.repeat(10_000)
    const sealed = seal(plain)
    expect(sealed.length).toBeGreaterThan(10_000)
    expect(open(sealed)).toBe(plain)
  })

  it('同一明文两次加密的密文不同（随机 IV），但都能解开', () => {
    const a = seal('same-key')
    const b = seal('same-key')
    expect(a).not.toBe(b)
    expect(open(a)).toBe('same-key')
    expect(open(b)).toBe('same-key')
  })
})

describe('失败路径必须抛错，不能静默降级', () => {
  it('密文被篡改一个字节后解密抛错', () => {
    const sealed = seal('sk-tamper-me')
    const body = sealed.split(':')[2]
    const raw = Buffer.from(body, 'base64url')
    raw[raw.length - 1] ^= 0xff
    expect(() => open(`v1:k1:${raw.toString('base64url')}`)).toThrow(AiChannelCryptoError)
  })

  it('篡改认证标签的任意一个字节都解不开', () => {
    const sealed = seal('sk-tamper-tag')
    const raw = Buffer.from(sealed.split(':')[2], 'base64url')
    for (let i = 12; i < 28; i += 1) {
      const copy = Buffer.from(raw)
      copy[i] ^= 0x01
      expect(() => open(`v1:k1:${copy.toString('base64url')}`)).toThrow(AiChannelCryptoError)
    }
  })

  it('密文截断后抛错', () => {
    const sealed = seal('sk-truncate-me')
    expect(() => open(sealed.slice(0, 30))).toThrow(AiChannelCryptoError)
  })

  it('PAYLOAD_SECRET 缺失时 seal / open 都抛错（绝不存明文）', () => {
    const sealed = seal('sk-no-secret')
    delete process.env.PAYLOAD_SECRET
    expect(() => seal('sk-no-secret')).toThrow(AiChannelCryptoError)
    expect(() => open(sealed)).toThrow(AiChannelCryptoError)
  })

  it('空 PAYLOAD_SECRET 也抛错', () => {
    process.env.PAYLOAD_SECRET = '   '
    expect(() => seal('x')).toThrow(AiChannelCryptoError)
  })

  it('空密文 / 未知版本 / 畸形字符都抛错，且不返回空串', () => {
    expect(() => open('')).toThrow(AiChannelCryptoError)
    expect(() => open('v2:abcdef')).toThrow(AiChannelCryptoError)
    expect(() => open('v1:@@@not-base64@@@')).toThrow(AiChannelCryptoError)
    expect(() => open('v1:AAAA')).toThrow(AiChannelCryptoError)
    expect(() => open('v1:k1:AAAA')).toThrow(AiChannelCryptoError)
    expect(() => open('v1:bad key id:AAAA')).toThrow(AiChannelCryptoError)
    expect(() => open('v1:k1:k2:AAAA')).toThrow(AiChannelCryptoError)
  })
})

describe('密钥代次（key id）与轮换', () => {
  it('key id 参与派生：同 secret、不同 keyId 解不开彼此的密文', () => {
    process.env.AI_CHANNELS_KEY_ID = 'k1'
    const a = seal('sk-across-ids')
    process.env.AI_CHANNELS_KEY_ID = 'k2'
    expect(() => open(a)).toThrow(AiChannelCryptoError)
  })

  it('把旧代次放进 AI_CHANNELS_OLD_KEYS，旧密文仍能解', () => {
    process.env.AI_CHANNELS_KEY_ID = 'k1'
    const sealed = seal('sk-old-key')

    process.env.PAYLOAD_SECRET = 'brand-new-secret-for-k2'
    process.env.AI_CHANNELS_KEY_ID = 'k2'
    process.env.AI_CHANNELS_OLD_KEYS = JSON.stringify({
      k1: 'unit-test-payload-secret-0123456789abcdef',
    })
    expect(open(sealed)).toBe('sk-old-key')
    // 新写入的用 k2
    const fresh = seal('sk-new-key')
    expect(keyIdOf(fresh)).toBe('k2')
    expect(open(fresh)).toBe('sk-new-key')
  })

  it('旧代次没配在环境里 → 明确报错，而不是返回空串', () => {
    process.env.AI_CHANNELS_KEY_ID = 'k1'
    const sealed = seal('sk-needs-old')
    process.env.PAYLOAD_SECRET = 'new-secret'
    process.env.AI_CHANNELS_KEY_ID = 'k2'
    delete process.env.AI_CHANNELS_OLD_KEYS
    expect(() => open(sealed)).toThrow(/找不到钥匙代次 k1/)
  })

  it('AI_CHANNELS_OLD_KEYS 格式错误直接抛错', () => {
    process.env.AI_CHANNELS_KEY_ID = 'k1'
    const sealed = seal('x')
    process.env.AI_CHANNELS_KEY_ID = 'k2'
    process.env.AI_CHANNELS_OLD_KEYS = 'not json'
    expect(() => open(sealed)).toThrow(/必须是 JSON 对象/)
  })

  it('needsReencrypt：当前代次 false，旧代次 true', () => {
    const current = seal('x')
    expect(needsReencrypt(current)).toBe(false)
    expect(needsReencrypt('v1:k0:AAAA')).toBe(true) // 未知代次
    expect(needsReencrypt('v1:@@@')).toBe(true) // 坏掉的格式也要求升级
  })

  it('currentKeyId 默认 k1，非法值抛错', () => {
    expect(currentKeyId()).toBe('k1')
    process.env.AI_CHANNELS_KEY_ID = 'k2'
    expect(currentKeyId()).toBe('k2')
    process.env.AI_CHANNELS_KEY_ID = 'has space'
    expect(() => currentKeyId()).toThrow(AiChannelCryptoError)
  })
})

describe('向后兼容：首版 `v1:<base64url>`（无 keyId）密文', () => {
  /**
   * 这条密文是用**首版实现**（HKDF info `aes-256-gcm-api-key/v1`、AAD
   * `fmkj-ai-channels/api-key/v1`、固定 IV `000102…0b`、下面的 secret）
   * 离线真实加密出来的固定样本，不是现场生成的 —— 这样才能证明
   * 「改了格式之后旧数据仍然解得开」。
   */
  const LEGACY_SECRET = 'unit-test-payload-secret-0123456789abcdef'
  const LEGACY_CIPHER =
    'v1:AAECAwQFBgcICQoLm5dc9QeIosXU4uQWjWmvtbNJ1gs9qrknD_qm5tWw3ztsAhXttju8I49J4Y8'
  const LEGACY_PLAIN = 'sk-legacy-roundtrip-key-9876'

  it('legacy 密文：needsReencrypt=true、keyIdOf=null', () => {
    expect(keyIdOf(LEGACY_CIPHER)).toBe(null)
    expect(needsReencrypt(LEGACY_CIPHER)).toBe(true)
  })

  it('用首版 secret 能解出原文（迁移不破坏已有数据）', () => {
    process.env.PAYLOAD_SECRET = LEGACY_SECRET
    expect(open(LEGACY_CIPHER)).toBe(LEGACY_PLAIN)
  })

  it('legacy 密文仍由 PAYLOAD_SECRET 解（首版就是这样），且能被重加密升级', () => {
    // 旧格式没有 keyId，所以它永远走 legacy 派生 —— 用现在的 PAYLOAD_SECRET。
    // 这就是「轮换前必须先重加密 legacy 密文」的原因：legacy 密文绑死在 PAYLOAD_SECRET 上。
    process.env.PAYLOAD_SECRET = LEGACY_SECRET
    process.env.AI_CHANNELS_KEY_ID = 'k2'
    expect(open(LEGACY_CIPHER)).toBe(LEGACY_PLAIN)
    const upgraded = seal(open(LEGACY_CIPHER))
    expect(keyIdOf(upgraded)).toBe('k2')
    expect(needsReencrypt(upgraded)).toBe(false)
    expect(open(upgraded)).toBe(LEGACY_PLAIN)
  })

  it('legacy 密文 + 错误 secret → 抛错，不返回空串', () => {
    process.env.PAYLOAD_SECRET = 'a-completely-different-secret'
    expect(() => open(LEGACY_CIPHER)).toThrow(AiChannelCryptoError)
  })
})

describe('apiKeyHint', () => {
  it('正常长度展示末 4 位', () => {
    expect(apiKeyHint('sk-1234567890abcd')).toBe('...abcd')
  })

  it('短 key 不泄露大部分字符', () => {
    expect(apiKeyHint('abc')).toBe('••••')
    expect(apiKeyHint('')).toBe('')
  })
})
