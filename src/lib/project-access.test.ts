import { describe, expect, it } from 'vitest'

import {
  getProjectRole,
  hashSharePassword,
  isShareExpired,
  parseShareConfig,
  shareLinkMatches,
  shareLinkState,
  sharePasswordMatches,
  type ShareConfig,
} from './project-access'

const TOKEN = 'abcdefghijklmnop' // 16 字符，满足 ≥12 的要求

const cfg = (over: Partial<ShareConfig> = {}): ShareConfig => ({
  enabled: true,
  token: TOKEN,
  role: 'read',
  expiresAt: null,
  passwordHash: null,
  ...over,
})

describe('parseShareConfig', () => {
  it('缺省时给出「永不过期 + 无密码」，与旧数据行为一致', () => {
    const r = parseShareConfig({ enabled: true, token: TOKEN, role: 'read' })
    expect(r.expiresAt).toBeNull()
    expect(r.passwordHash).toBeNull()
  })

  it('读出已有的过期时间与密码摘要', () => {
    const r = parseShareConfig({
      enabled: true,
      token: TOKEN,
      role: 'edit',
      expiresAt: '2030-01-01T00:00:00.000Z',
      passwordHash: 'deadbeef',
    })
    expect(r.expiresAt).toBe('2030-01-01T00:00:00.000Z')
    expect(r.passwordHash).toBe('deadbeef')
  })

  it('非对象输入回落到默认配置，并生成一个足够长的 token', () => {
    const r = parseShareConfig(null)
    expect(r.enabled).toBe(true)
    expect(r.token.length).toBeGreaterThanOrEqual(12)
  })
})

describe('isShareExpired', () => {
  it('没有 expiresAt 视为永不过期', () => {
    expect(isShareExpired({ expiresAt: null })).toBe(false)
    expect(isShareExpired({})).toBe(false)
  })

  it('过去的时刻算过期，将来的时刻不算', () => {
    expect(isShareExpired({ expiresAt: '2000-01-01T00:00:00.000Z' })).toBe(true)
    expect(isShareExpired({ expiresAt: '2999-01-01T00:00:00.000Z' })).toBe(false)
  })

  it('无法解析的时间串不判为过期（宁可放行，不误锁客户）', () => {
    expect(isShareExpired({ expiresAt: '不是时间' })).toBe(false)
  })
})

describe('sharePasswordMatches', () => {
  it('没设密码时一律通过（老链接不受影响）', () => {
    expect(sharePasswordMatches({ passwordHash: null }, undefined)).toBe(true)
    expect(sharePasswordMatches({}, '随便')).toBe(true)
  })

  it('设了密码就必须匹配', () => {
    const hash = hashSharePassword('s3cret')
    expect(sharePasswordMatches({ passwordHash: hash }, 's3cret')).toBe(true)
    expect(sharePasswordMatches({ passwordHash: hash }, 'wrong')).toBe(false)
    expect(sharePasswordMatches({ passwordHash: hash }, undefined)).toBe(false)
    expect(sharePasswordMatches({ passwordHash: hash }, '')).toBe(false)
  })
})

describe('shareLinkMatches', () => {
  it('凭证一致且未关闭时通过', () => {
    expect(shareLinkMatches(cfg(), TOKEN)).toBe(true)
  })

  it('金额/凭证不匹配、链接已关闭、token 太短都拒绝', () => {
    expect(shareLinkMatches(cfg(), 'wrongwrongwrong1')).toBe(false)
    expect(shareLinkMatches(cfg({ enabled: false }), TOKEN)).toBe(false)
    expect(shareLinkMatches(cfg(), 'short')).toBe(false)
    expect(shareLinkMatches(null, TOKEN)).toBe(false)
  })

  it('过期的链接即使凭证正确也拒绝（这是本次新增的关键行为）', () => {
    expect(shareLinkMatches(cfg({ expiresAt: '2000-01-01T00:00:00.000Z' }), TOKEN)).toBe(false)
    expect(shareLinkMatches(cfg({ expiresAt: '2999-01-01T00:00:00.000Z' }), TOKEN)).toBe(true)
  })
})

describe('shareLinkState', () => {
  it('一切正常时返回 ok', () => {
    expect(shareLinkState(cfg(), TOKEN)).toEqual({ status: 'ok' })
  })

  it('过期与凭证错误要能区分开，页面才能给准确提示', () => {
    expect(shareLinkState(cfg({ expiresAt: '2000-01-01T00:00:00.000Z' }), TOKEN)).toEqual({
      status: 'expired',
    })
    expect(shareLinkState(cfg(), 'wrongwrongwrong1')).toEqual({ status: 'invalid' })
    expect(shareLinkState(cfg({ enabled: false }), TOKEN)).toEqual({ status: 'invalid' })
  })

  it('设了密码时：不传 / 传错 → 需要密码；传对 → ok', () => {
    const c = cfg({ passwordHash: hashSharePassword('abc123') })
    expect(shareLinkState(c, TOKEN)).toEqual({ status: 'password-required' })
    expect(shareLinkState(c, TOKEN, 'wrong')).toEqual({ status: 'password-required' })
    expect(shareLinkState(c, TOKEN, 'abc123')).toEqual({ status: 'ok' })
  })

  it('过期优先于密码：过期链接不该先问密码', () => {
    const c = cfg({
      expiresAt: '2000-01-01T00:00:00.000Z',
      passwordHash: hashSharePassword('abc123'),
    })
    expect(shareLinkState(c, TOKEN, 'abc123')).toEqual({ status: 'expired' })
  })
})

describe('getProjectRole', () => {
  it('创建者是 owner，协作者按角色，未参与者无权限', () => {
    const project = {
      owner: 'u1',
      collaborators: [
        { user: 'u2', role: 'edit' as const },
        { user: 'u3', role: 'read' as const },
      ],
    }
    expect(getProjectRole(project, 'u1')).toBe('owner')
    expect(getProjectRole(project, 'u2')).toBe('edit')
    expect(getProjectRole(project, 'u3')).toBe('read')
    expect(getProjectRole(project, 'u9')).toBeNull()
    expect(getProjectRole(project, null)).toBeNull()
  })
})
