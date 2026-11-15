import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'

/**
 * 成员自填 AI 渠道密钥的加密/解密（AES-256-GCM）+ 密钥代次（key id）。
 *
 * 设计要点：
 * - 密钥**不是** PAYLOAD_SECRET 本身，而是用 HKDF-SHA256 从它派生出的独立 32 字节密钥。
 *   PAYLOAD_SECRET 同时用于 JWT 签名；直接拿它当 AES 密钥会让「换 JWT 密钥」和
 *   「换数据密钥」互相牵连，也违反「一个用途一把钥匙」。
 * - 密文带 **算法版本 + 密钥代次** 前缀：`v1:<keyId>:<base64url>`。
 *   必须带 keyId：PAYLOAD_SECRET 总有一天要轮换（它签 JWT，泄露就必须换），
 *   只有算法版本的话「换 secret = 所有客户 key 永久作废」，等于禁止轮换。
 *   有了 keyId，旧密文能用旧钥匙解、新密文用新钥匙写，中途用
 *   `scripts/rotate-ai-channels-key.ts` 重加密即可平滑过渡。
 * - **向后兼容**：功能上线前写下的旧格式 `v1:<base64url>`（无 keyId）仍可解 ——
 *   走 legacy 派生路径（HKDF info 不带 keyId、AAD 固定）。这类密文
 *   `needsReencrypt()` 返回 true，由轮换脚本升级成新格式。
 * - PAYLOAD_SECRET 缺失时**抛错**，绝不退化成明文存储。
 * - 解密失败（密文被篡改、钥匙不对）**抛错**，绝不返回空串——空串会被上层当成
 *   「未配置」从而静默跳过校验，这个降级比报错危险得多。
 *
 * 环境变量：
 * - `PAYLOAD_SECRET`        当前钥匙的密钥材料（必填）
 * - `AI_CHANNELS_KEY_ID`    当前钥匙的代次标识，默认 `k1`；轮换时改成新值（如 `k2`）
 * - `AI_CHANNELS_OLD_KEYS`  旧钥匙，JSON 对象 `{"k1":"<旧 PAYLOAD_SECRET>"}`；
 *                           只在轮换窗口内需要，轮换脚本跑完即可删除
 */

const ALGO_PREFIX = 'v1'
const HKDF_SALT = 'fmkj-ai-channels'
/** legacy 密文（无 keyId）用的 info：**不能改**，否则现有密文全部解不开。 */
const HKDF_INFO_LEGACY = 'aes-256-gcm-api-key/v1'
const AAD_LEGACY = Buffer.from('fmkj-ai-channels/api-key/v1')
const IV_BYTES = 12
const TAG_BYTES = 16
const KEY_ID_RE = /^[A-Za-z0-9_-]{1,32}$/
export const DEFAULT_KEY_ID = 'k1'

export class AiChannelCryptoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiChannelCryptoError'
  }
}

/** 当前钥匙代次。 */
export function currentKeyId(): string {
  const raw = process.env.AI_CHANNELS_KEY_ID
  const id = typeof raw === 'string' && raw.trim() ? raw.trim() : DEFAULT_KEY_ID
  if (!KEY_ID_RE.test(id)) {
    throw new AiChannelCryptoError(
      `AI_CHANNELS_KEY_ID 格式无效（只允许字母、数字、- 和 _，最多 32 字）：${id}`,
    )
  }
  return id
}

function requireSecret(name: string): string {
  const secret = process.env[name]
  if (typeof secret !== 'string' || secret.trim().length === 0) {
    throw new AiChannelCryptoError(`缺少 ${name}，无法加密/解密成员 AI 渠道密钥（拒绝以明文存储）`)
  }
  return secret
}

/** 解析旧钥匙环；格式错误直接抛错（宁可轮换失败，也不要静默用错钥匙）。 */
function oldKeys(): Record<string, string> {
  const raw = process.env.AI_CHANNELS_OLD_KEYS
  if (typeof raw !== 'string' || raw.trim() === '') return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new AiChannelCryptoError('AI_CHANNELS_OLD_KEYS 必须是 JSON 对象，如 {"k1":"<旧密钥>"}')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AiChannelCryptoError('AI_CHANNELS_OLD_KEYS 必须是 JSON 对象，如 {"k1":"<旧密钥>"}')
  }
  const out: Record<string, string> = {}
  for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!KEY_ID_RE.test(id)) throw new AiChannelCryptoError(`旧钥匙代次格式无效：${id}`)
    if (typeof value !== 'string' || !value.trim()) {
      throw new AiChannelCryptoError(`旧钥匙 ${id} 的密钥材料为空`)
    }
    out[id] = value
  }
  return out
}

/** 新格式的派生：keyId 参与 HKDF info 与 AAD，不同代次得到不同钥匙与不同认证域。 */
function deriveKey(secret: string, keyId: string): Buffer {
  return Buffer.from(
    hkdfSync('sha256', Buffer.from(secret, 'utf8'), HKDF_SALT, `${HKDF_INFO_LEGACY}:${keyId}`, 32),
  )
}

/** legacy 派生：与首版实现逐字节一致，保证已写下的旧密文还能解。 */
function deriveLegacyKey(secret: string): Buffer {
  return Buffer.from(
    hkdfSync('sha256', Buffer.from(secret, 'utf8'), HKDF_SALT, HKDF_INFO_LEGACY, 32),
  )
}

function aad(keyId: string): Buffer {
  return Buffer.from(`fmkj-ai-channels/api-key/v1:${keyId}`)
}

type Parsed = { kind: 'keyed'; keyId: string; raw: Buffer } | { kind: 'legacy'; raw: Buffer }

function parse(sealed: string): Parsed {
  if (typeof sealed !== 'string' || sealed.length === 0) {
    throw new AiChannelCryptoError('渠道密钥密文为空')
  }
  const parts = sealed.split(':')
  if (parts[0] !== ALGO_PREFIX) {
    throw new AiChannelCryptoError('渠道密钥密文版本无法识别')
  }
  // base64url 字符集不含 ':'，所以段数无歧义：2 段 = legacy，3 段 = 带 keyId
  if (parts.length !== 2 && parts.length !== 3) {
    throw new AiChannelCryptoError('渠道密钥密文格式无效')
  }
  const body = parts[parts.length - 1]
  // base64url 解码是宽容的：先做字符集检查，避免把畸形输入当成合法密文继续走。
  if (!/^[A-Za-z0-9_-]+$/.test(body)) {
    throw new AiChannelCryptoError('渠道密钥密文格式无效')
  }
  const raw = Buffer.from(body, 'base64url')
  if (raw.length < IV_BYTES + TAG_BYTES) {
    throw new AiChannelCryptoError('渠道密钥密文长度不足')
  }
  if (parts.length === 2) return { kind: 'legacy', raw }
  if (!KEY_ID_RE.test(parts[1])) throw new AiChannelCryptoError('渠道密钥密文的钥匙代次格式无效')
  return { kind: 'keyed', keyId: parts[1], raw }
}

/** 加密明文：总是用**当前**钥匙，返回 `v1:<keyId>:<base64url>`。 */
export function seal(plaintext: string): string {
  if (typeof plaintext !== 'string') {
    throw new AiChannelCryptoError('渠道密钥必须是字符串')
  }
  const keyId = currentKeyId()
  const key = deriveKey(requireSecret('PAYLOAD_SECRET'), keyId)
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(aad(keyId))
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${ALGO_PREFIX}:${keyId}:${Buffer.concat([iv, tag, ciphertext]).toString('base64url')}`
}

/** 解密；任何异常（格式、认证失败、钥匙缺失）都抛错。 */
export function open(sealed: string): string {
  const parsed = parse(sealed)
  const raw = parsed.raw
  const iv = raw.subarray(0, IV_BYTES)
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const ciphertext = raw.subarray(IV_BYTES + TAG_BYTES)

  let key: Buffer
  let ad: Buffer
  if (parsed.kind === 'legacy') {
    key = deriveLegacyKey(requireSecret('PAYLOAD_SECRET'))
    ad = AAD_LEGACY
  } else {
    const current = currentKeyId()
    const secret =
      parsed.keyId === current ? requireSecret('PAYLOAD_SECRET') : oldKeys()[parsed.keyId]
    if (!secret) {
      throw new AiChannelCryptoError(
        `找不到钥匙代次 ${parsed.keyId} 的密钥材料：轮换期间请在 AI_CHANNELS_OLD_KEYS 里提供 {"${parsed.keyId}":"<旧密钥>"}`,
      )
    }
    key = deriveKey(secret, parsed.keyId)
    ad = aad(parsed.keyId)
  }

  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAAD(ad)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  } catch (error) {
    if (error instanceof AiChannelCryptoError) throw error
    throw new AiChannelCryptoError(
      '渠道密钥解密失败：密文已损坏，或对应代次的密钥材料不对（旧的密钥无法恢复）',
    )
  }
}

/**
 * 这条密文是否需要（重新）加密到当前钥匙：
 * - legacy 格式 → 需要；
 * - keyId 不是当前代次 → 需要；
 * - 已经是当前代次 → 不需要。
 * 格式坏掉的也返回 true（让轮换脚本把它计入失败，而不是假装没事）。
 */
export function needsReencrypt(sealed: string): boolean {
  try {
    const parsed = parse(sealed)
    return parsed.kind === 'legacy' || parsed.keyId !== currentKeyId()
  } catch {
    return true
  }
}

/** 密文里声明的钥匙代次（legacy 返回 null）；格式无效时返回 undefined。 */
export function keyIdOf(sealed: string): string | null | undefined {
  try {
    const parsed = parse(sealed)
    return parsed.kind === 'legacy' ? null : parsed.keyId
  } catch {
    return undefined
  }
}

/** 只读展示用提示：末 4 位；太短的密钥不展示太多字符。 */
export function apiKeyHint(plaintext: string): string {
  if (typeof plaintext !== 'string' || plaintext.length === 0) return ''
  if (plaintext.length < 8) return '••••'
  return `...${plaintext.slice(-4)}`
}
