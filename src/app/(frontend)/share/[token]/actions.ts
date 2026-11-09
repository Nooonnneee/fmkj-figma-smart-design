'use server'

import {
  submitClientFeedback,
  type ClientFeedbackInput,
  type ClientFeedbackResult,
} from '@/lib/services/client-feedback-service'

/** 业主在分享页提交意向：校验、金额计算与凭证核对都在服务端完成（见 client-feedback-service） */
export async function submitIntent(
  shareToken: string,
  input: ClientFeedbackInput,
): Promise<ClientFeedbackResult> {
  return submitClientFeedback(shareToken, input)
}

import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

import { parseShareConfig, shareLinkState } from '@/lib/project-access'
import { getPayloadClient } from '@/lib/payload'

/** 记住「这份分享链接已通过密码校验」的 cookie 名（每份链接一个，互不影响）。 */
const unlockCookieName = (token: string) => `fmkj-share-ok-${token.slice(0, 24)}`

function ownerSecret(): string {
  return process.env.PAYLOAD_SECRET || 'dev-local-secret-key-please-change'
}

/**
 * 给 cookie 值签名，防止有人手工伪造一个 `fmkj-share-ok-xxx=1` 就绕过密码。
 * 用项目自身的 PAYLOAD_SECRET 做密钥；只签 token，不签密码本身——改密码后
 * 需要重新输入，是因为校验里会带上当前 passwordHash。
 */
function signUnlock(token: string, passwordHash: string | null | undefined): string {
  return createHmac('sha256', ownerSecret())
    .update(`${token}:${passwordHash ?? ''}`)
    .digest('hex')
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/** 该 token 是否已经通过密码校验（供服务端页面调用）。 */
export async function isShareUnlocked(
  token: string,
  passwordHash: string | null | undefined,
): Promise<boolean> {
  const jar = await cookies()
  const got = jar.get(unlockCookieName(token))?.value
  if (!got) return false
  return safeEqual(got, signUnlock(token, passwordHash))
}

/**
 * 校验业主输入的访问密码，通过则写一个 httpOnly 的签名 cookie。
 *
 * 安全要点：
 * - 明文密码不落库、不回显；只与已存的 sha256 摘要比对（见 shareLinkState）。
 * - cookie 值经过 HMAC 签名，且与**当前的 passwordHash** 绑定——
 *   对接人改了密码，旧 cookie 自动失效，必须重新输入。
 * - httpOnly + sameSite=lax，前端脚本读不到。
 */
export async function unlockShareLink(
  token: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!token || !password) return { ok: false, error: '请输入访问密码' }

  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'projects',
    limit: 1000,
    depth: 0,
    overrideAccess: true,
    select: { shareConfig: true } as never,
  })
  const trimmed = token.trim()
  const matched = (res.docs as unknown as { shareConfig?: unknown }[]).find((p) => {
    const st = shareLinkState(p.shareConfig, trimmed, password)
    return st.status === 'ok'
  })

  if (!matched) {
    // 不区分「链接不存在」与「密码错误」，避免被用来探测 token 是否有效
    return { ok: false, error: '密码不正确，请向对接人确认后重试' }
  }

  const cfg = parseShareConfig(matched.shareConfig)
  const jar = await cookies()
  jar.set(unlockCookieName(trimmed), signUnlock(trimmed, cfg.passwordHash), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    // 与过期时间对齐：没设过期就给 30 天，避免业主天天输密码
    maxAge: 60 * 60 * 24 * 30,
  })
  return { ok: true }
}
