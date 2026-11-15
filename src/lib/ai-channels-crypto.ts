import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'

/**
 * 成员自填 AI 渠道密钥的加密/解密（AES-256-GCM）。
 *
 * 设计要点：
 * - 密钥**不是** PAYLOAD_SECRET 本身，而是用 HKDF-SHA256 从它派生出的独立 32 字节密钥。
 *   PAYLOAD_SECRET 同时用于 JWT 签名等用途；直接拿它当 AES 密钥会让「换 JWT 密钥」
 *   和「换数据密钥」互相牵连，也违反「一个用途一把钥匙」。
 *   salt 与 info 都是固定常量：同一 PAYLOAD_SECRET 必须能稳定解出旧密文。
 * - 密文带版本前缀 `v1:`，将来换算法/换派生参数时可以按前缀识别并迁移。
 * - PAYLOAD_SECRET 缺失时**抛错**，绝不退化成明文存储。
 * - 解密失败（密文被篡改、换过 secret）**抛错**，绝不返回空串——空串会被上层当成
 *   「未配置」从而静默跳过校验，这个降级比报错危险得多。
 */

const VERSION_PREFIX = 'v1:'
const HKDF_SALT = 'fmkj-ai-channels'
const HKDF_INFO = 'aes-256-gcm-api-key/v1'
const AAD = Buffer.from('fmkj-ai-channels/api-key/v1')
const IV_BYTES = 12
const TAG_BYTES = 16

export class AiChannelCryptoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiChannelCryptoError'
  }
}

/** 从 PAYLOAD_SECRET 派生数据密钥；缺 secret 直接抛错（不降级、不缓存过期值）。 */
function deriveKey(): Buffer {
  const secret = process.env.PAYLOAD_SECRET
  if (typeof secret !== 'string' || secret.trim().length === 0) {
    throw new AiChannelCryptoError(
      '缺少 PAYLOAD_SECRET，无法加密/解密成员 AI 渠道密钥（拒绝以明文存储）',
    )
  }
  // hkdfSync 每次按当前 secret 现算：测试里切换 secret 必须立刻生效，缓存会掩盖这个 bug。
  return Buffer.from(hkdfSync('sha256', Buffer.from(secret, 'utf8'), HKDF_SALT, HKDF_INFO, 32))
}

/** 加密明文，返回带版本前缀的 `v1:<base64url>`。 */
export function seal(plaintext: string): string {
  if (typeof plaintext !== 'string') {
    throw new AiChannelCryptoError('渠道密钥必须是字符串')
  }
  const key = deriveKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(AAD)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return VERSION_PREFIX + Buffer.concat([iv, tag, ciphertext]).toString('base64url')
}

/** 解密 `v1:` 密文；任何异常（格式、认证失败、secret 变更）都抛错。 */
export function open(sealed: string): string {
  if (typeof sealed !== 'string' || sealed.length === 0) {
    throw new AiChannelCryptoError('渠道密钥密文为空')
  }
  if (!sealed.startsWith(VERSION_PREFIX)) {
    throw new AiChannelCryptoError('渠道密钥密文版本无法识别')
  }
  const body = sealed.slice(VERSION_PREFIX.length)
  // base64url 解码是宽容的：先做字符集检查，避免把畸形输入当成合法密文继续走。
  if (!/^[A-Za-z0-9_-]+$/.test(body)) {
    throw new AiChannelCryptoError('渠道密钥密文格式无效')
  }
  const raw = Buffer.from(body, 'base64url')
  if (raw.length < IV_BYTES + TAG_BYTES) {
    throw new AiChannelCryptoError('渠道密钥密文长度不足')
  }
  const iv = raw.subarray(0, IV_BYTES)
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const ciphertext = raw.subarray(IV_BYTES + TAG_BYTES)
  try {
    const decipher = createDecipheriv('aes-256-gcm', deriveKey(), iv)
    decipher.setAAD(AAD)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  } catch (error) {
    if (error instanceof AiChannelCryptoError) throw error
    throw new AiChannelCryptoError(
      '渠道密钥解密失败：密文已损坏，或 PAYLOAD_SECRET 已更换（旧的密钥无法恢复）',
    )
  }
}

/** 只读展示用提示：末 4 位；太短的密钥不展示太多字符。 */
export function apiKeyHint(plaintext: string): string {
  if (typeof plaintext !== 'string' || plaintext.length === 0) return ''
  if (plaintext.length < 8) return '••••'
  return `...${plaintext.slice(-4)}`
}
