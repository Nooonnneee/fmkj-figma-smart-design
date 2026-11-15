import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { AiChannelCryptoError, apiKeyHint, open, seal } from './ai-channels-crypto'

const ORIGINAL_SECRET = process.env.PAYLOAD_SECRET

beforeEach(() => {
  process.env.PAYLOAD_SECRET = 'unit-test-payload-secret-0123456789abcdef'
})

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.PAYLOAD_SECRET
  else process.env.PAYLOAD_SECRET = ORIGINAL_SECRET
})

describe('seal / open 往返', () => {
  it('普通 key 往返一致，且密文带版本前缀', () => {
    const plain = 'sk-proj-abcdef1234567890'
    const sealed = seal(plain)
    expect(sealed.startsWith('v1:')).toBe(true)
    expect(sealed).not.toContain(plain)
    expect(open(sealed)).toBe(plain)
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
    // 按**字节**翻转，而不是改 base64 的最后一个字符：
    // base64url 末位有 4 个填充位，改字符可能解码出同样的字节，那样的测试会假红/假绿。
    const body = sealed.slice('v1:'.length)
    const raw = Buffer.from(body, 'base64url')
    raw[raw.length - 1] ^= 0xff // 落在 GCM 认证标签覆盖范围内
    const tampered = `v1:${raw.toString('base64url')}`
    expect(() => open(tampered)).toThrow(AiChannelCryptoError)
  })

  it('篡改认证标签的任意一个字节都解不开', () => {
    const sealed = seal('sk-tamper-tag')
    const raw = Buffer.from(sealed.slice('v1:'.length), 'base64url')
    // iv(12) + tag(16)；逐个翻转标签里的字节
    for (let i = 12; i < 28; i += 1) {
      const copy = Buffer.from(raw)
      copy[i] ^= 0x01
      expect(() => open(`v1:${copy.toString('base64url')}`)).toThrow(AiChannelCryptoError)
    }
  })

  it('密文截断后抛错', () => {
    const sealed = seal('sk-truncate-me')
    expect(() => open(sealed.slice(0, 30))).toThrow(AiChannelCryptoError)
  })

  it('换 PAYLOAD_SECRET 后旧密文解不开', () => {
    const sealed = seal('sk-wrong-secret')
    process.env.PAYLOAD_SECRET = 'a-completely-different-secret'
    expect(() => open(sealed)).toThrow(AiChannelCryptoError)
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
