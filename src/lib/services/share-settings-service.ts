import type { User } from '@/payload-types'
import { getPayloadClient } from '@/lib/payload'
import {
  hashSharePassword,
  isShareExpired,
  parseShareConfig,
  type ShareConfig,
} from '@/lib/project-access'

export type ShareSettingsPatch = {
  /** 是否开启链接 */
  enabled?: boolean
  /** 角色：业主链接默认只读 */
  role?: 'edit' | 'read'
  /** 过期时间；null = 永不过期。接受 ISO 字符串或 Date */
  expiresAt?: string | null
  /**
   * 访问密码。三态语义：
   * - `undefined`：不改动（保持现有密码）
   * - `''` 或 `null`：清除密码
   * - 非空字符串：设为新密码
   */
  password?: string | null
}

export type ShareSettingsResult = { ok: true; config: ShareConfig } | { ok: false; error: string }

const MAX_PASSWORD_LEN = 64

/**
 * 保存项目的业主分享链接设置（有效期 / 访问密码 / 开关）。
 *
 * 为什么单独建 service：网页归档页与小程序都要改这套设置，规则（校验、密码怎么存）
 * 必须一处定义，避免两边漂移。
 *
 * 安全约定：
 * - **明文密码不落库**，只存 sha256 摘要（见 hashSharePassword）。
 * - 没有 expiresAt 就是永不过期；无法解析的时间串会被拒绝，而不是静默当成「不过期」。
 */
export async function saveShareSettings(
  user: User,
  projectId: string,
  patch: ShareSettingsPatch,
): Promise<ShareSettingsResult> {
  const payload = await getPayloadClient()

  // 读现有配置：shareConfig 只有 CMS 管理员有字段读权限，成员身份读不到，
  // 所以这里必须以系统身份读一次（与归档页的做法一致）。
  const doc = await payload
    .findByID({
      collection: 'projects',
      id: projectId,
      depth: 0,
      overrideAccess: true,
      select: { shareConfig: true } as never,
    })
    .catch(() => null)
  if (!doc) return { ok: false, error: '项目不存在或无权访问' }

  const current = parseShareConfig((doc as unknown as { shareConfig?: unknown }).shareConfig)
  const next: ShareConfig = { ...current }

  if (typeof patch.enabled === 'boolean') next.enabled = patch.enabled
  if (patch.role === 'edit' || patch.role === 'read') next.role = patch.role

  if ('expiresAt' in patch) {
    if (patch.expiresAt == null || patch.expiresAt === '') {
      next.expiresAt = null
    } else {
      const t = Date.parse(String(patch.expiresAt))
      if (!Number.isFinite(t)) return { ok: false, error: '过期时间格式不正确' }
      next.expiresAt = new Date(t).toISOString()
    }
  }

  if ('password' in patch) {
    if (patch.password == null || patch.password === '') {
      next.passwordHash = null
    } else {
      const pw = String(patch.password)
      if (pw.length < 4) return { ok: false, error: '访问密码至少 4 位' }
      if (pw.length > MAX_PASSWORD_LEN)
        return { ok: false, error: `访问密码不超过 ${MAX_PASSWORD_LEN} 位` }
      next.passwordHash = hashSharePassword(pw)
    }
  }

  // 交互层面的防呆：开着一个已经过期的链接没有意义，直接拒绝更容易发现问题。
  if (next.enabled && isShareExpired(next)) {
    return { ok: false, error: '过期时间早于当前时间，链接开启后立刻就会失效' }
  }

  try {
    await payload.update({
      collection: 'projects',
      id: projectId,
      data: { shareConfig: next } as never,
      user,
      overrideAccess: false,
      depth: 0,
      select: { shareConfig: true } as never,
    })
    return { ok: true, config: next }
  } catch (error) {
    console.error('[projects] save share settings failed', error)
    return { ok: false, error: '保存失败，请稍后重试' }
  }
}
