import { createHash, randomBytes } from 'node:crypto'

import { relId } from '@/lib/access'
import type { Project, User } from '@/payload-types'

export type ProjectRole = 'owner' | 'edit' | 'read'
export type CollaboratorRole = 'edit' | 'read'

export type ShareConfig = {
  enabled: boolean
  token: string
  role: CollaboratorRole
  /** 截止时间（ISO 字符串）。null / 缺省 = 永不过期。 */
  expiresAt?: string | null
  /** 访问密码的 sha256 十六进制摘要。null / 缺省 = 不需要密码。明文不落库。 */
  passwordHash?: string | null
}

export type CollaboratorItem = {
  id?: string | null
  user: string | number | User
  role: CollaboratorRole
  joinedAt?: string | null
}

export function parseShareConfig(raw: unknown): ShareConfig {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>
    const token =
      typeof r.token === 'string' && r.token.trim().length >= 12
        ? r.token.trim()
        : randomBytes(16).toString('base64url')
    const role: CollaboratorRole = r.role === 'edit' ? 'edit' : 'read'
    const enabled = r.enabled !== false
    // 老数据没有这两个字段，缺省即为「永不过期 + 无密码」，行为与改动前一致。
    const expiresAt =
      typeof r.expiresAt === 'string' && r.expiresAt.trim() ? r.expiresAt.trim() : null
    const passwordHash =
      typeof r.passwordHash === 'string' && r.passwordHash.trim() ? r.passwordHash.trim() : null
    return { enabled, token, role, expiresAt, passwordHash }
  }
  return {
    enabled: true,
    token: randomBytes(16).toString('base64url'),
    role: 'read',
    expiresAt: null,
    passwordHash: null,
  }
}

/** 分享链接是否已过期。没有 expiresAt 即永不过期。 */
export function isShareExpired(cfg: Pick<ShareConfig, 'expiresAt'>): boolean {
  if (!cfg.expiresAt) return false
  const t = Date.parse(cfg.expiresAt)
  return Number.isFinite(t) && t < Date.now()
}

/** 生成访问密码的存储摘要（与校验共用，避免两处算法漂移）。 */
export function hashSharePassword(password: string): string {
  return createHash('sha256').update(password, 'utf8').digest('hex')
}

/** 比对访问密码。配置里没设密码时视为通过（老链接保持可直接访问）。 */
export function sharePasswordMatches(
  cfg: Pick<ShareConfig, 'passwordHash'>,
  password: unknown,
): boolean {
  if (!cfg.passwordHash) return true
  if (typeof password !== 'string' || !password) return false
  return hashSharePassword(password) === cfg.passwordHash
}

/**
 * 业主分享链接凭证的严格比对：项目必须已保存分享配置、未关闭链接，且凭证完全一致。
 * 与 parseShareConfig 不同，这里不会为缺失的配置临时生成新凭证。
 */
export function shareLinkMatches(raw: unknown, token: unknown): boolean {
  if (typeof token !== 'string' || token.trim().length < 12) return false
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const r = raw as Record<string, unknown>
  if (r.enabled === false) return false
  if (typeof r.token !== 'string' || r.token.trim() !== token.trim()) return false
  // 过期即视为无效：调用方只关心「能不能访问」，具体原因由 shareLinkState 给出。
  return !isShareExpired({ expiresAt: typeof r.expiresAt === 'string' ? r.expiresAt : null })
}

/** 分享链接校验的分级结果：区分「有效 / 已过期 / 需要密码 / 无效」，便于页面给出准确提示。 */
export type ShareLinkState =
  | { status: 'ok' }
  | { status: 'expired' }
  | { status: 'password-required' }
  | { status: 'invalid' }

/**
 * 校验分享链接，并在需要密码时校验密码。
 *
 * - 链接不存在 / 已关闭 / 凭证不符 → invalid
 * - 已过 expiresAt → expired（页面显示「链接已过期」而不是「不存在」，体验更清楚）
 * - 设了 passwordHash 且密码不符或未提供 → password-required
 */
export function shareLinkState(raw: unknown, token: unknown, password?: unknown): ShareLinkState {
  if (typeof token !== 'string' || token.trim().length < 12) return { status: 'invalid' }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { status: 'invalid' }
  const r = raw as Record<string, unknown>
  if (r.enabled === false) return { status: 'invalid' }
  if (typeof r.token !== 'string' || r.token.trim() !== token.trim()) return { status: 'invalid' }

  const cfg = parseShareConfig(raw)
  if (isShareExpired(cfg)) return { status: 'expired' }
  if (!sharePasswordMatches(cfg, password)) return { status: 'password-required' }
  return { status: 'ok' }
}

/**
 * 计算当前成员在指定项目上的角色：
 * - owner：项目创建者（或旧数据未记录 owner 的项目）
 * - edit：可编辑协作者
 * - read：仅查看协作者
 * - null：无权访问该项目
 */
export function getProjectRole(
  project: Pick<Project, 'owner'> & { collaborators?: CollaboratorItem[] | null },
  userId: string | number | null | undefined,
): ProjectRole | null {
  if (!userId) return null
  const uid = String(userId)
  const ownerId = relId(project.owner)
  if (ownerId && ownerId === uid) return 'owner'
  const collab = (project.collaborators ?? []).find((c) => relId(c.user) === uid)
  if (!collab) return null
  return collab.role === 'edit' ? 'edit' : 'read'
}

export function canReadProject(
  project: Pick<Project, 'owner'> & { collaborators?: CollaboratorItem[] | null },
  userId: string | number | null | undefined,
): boolean {
  return getProjectRole(project, userId) !== null
}

export function canEditProject(
  project: Pick<Project, 'owner'> & { collaborators?: CollaboratorItem[] | null },
  userId: string | number | null | undefined,
): boolean {
  const role = getProjectRole(project, userId)
  return role === 'owner' || role === 'edit'
}

export function canManageProject(
  project: Pick<Project, 'owner'> & { collaborators?: CollaboratorItem[] | null },
  userId: string | number | null | undefined,
): boolean {
  return getProjectRole(project, userId) === 'owner'
}

export function roleLabel(role: ProjectRole): string {
  if (role === 'owner') return '项目管理员'
  if (role === 'edit') return '可编辑'
  return '仅查看'
}
