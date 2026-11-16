import { describe, expect, it } from 'vitest'

import {
  HARNESS_MCP_KEYS_ENV,
  isHarnessMcpEnabled,
  isWhitelisted,
  isWhitelistedTool,
  lookupIdentityByKey,
  parseHarnessIdentities,
  WHITELIST_PERMISSIONS,
  WHITELIST_TOOLS,
} from './config'

describe('isHarnessMcpEnabled（默认关闭）', () => {
  it('缺省 / 非 "1" 一律关闭', () => {
    expect(isHarnessMcpEnabled({})).toBe(false)
    expect(isHarnessMcpEnabled({ HARNESS_MCP_ENABLED: '0' })).toBe(false)
    expect(isHarnessMcpEnabled({ HARNESS_MCP_ENABLED: 'true' })).toBe(false)
  })
  it('只有显式 "1" 才启用', () => {
    expect(isHarnessMcpEnabled({ HARNESS_MCP_ENABLED: '1' })).toBe(true)
  })
})

describe('parseHarnessIdentities / lookupIdentityByKey', () => {
  const env = { [HARNESS_MCP_KEYS_ENV]: 'secretA=user_111, secretB=user_222 ,,=bad,' }

  it('解析 key=userId 映射', () => {
    const ids = parseHarnessIdentities(env[HARNESS_MCP_KEYS_ENV])
    expect(ids).toEqual([
      { key: 'secretA', userId: 'user_111' },
      { key: 'secretB', userId: 'user_222' },
    ])
  })

  it('用合法 key 查到绑定账号', () => {
    expect(lookupIdentityByKey('secretA', env)).toEqual({ key: 'secretA', userId: 'user_111' })
    expect(lookupIdentityByKey('secretB', env)!.userId).toBe('user_222')
  })

  it('错误 / 缺失 key 查不到', () => {
    expect(lookupIdentityByKey('wrong', env)).toBeNull()
    expect(lookupIdentityByKey(null, env)).toBeNull()
    expect(lookupIdentityByKey('', env)).toBeNull()
  })

  it('未配置环境变量时一律 null', () => {
    expect(lookupIdentityByKey('secretA', {})).toBeNull()
  })

  it('前缀相同的错误 key 也查不到（不是只比前缀）', () => {
    expect(lookupIdentityByKey('secret', env)).toBeNull()
    expect(lookupIdentityByKey('secretAAAA', env)).toBeNull()
  })
})

describe('白名单权限约束', () => {
  it('改项目/布点位/改报价/改合同及其只读支撑都在白名单', () => {
    // 只读支撑（项目/点位/报价/合同 + catalog）在读与业务里都需要。
    for (const p of [
      'projects:read',
      'projects:write',
      'point-map:read',
      'point-map:write',
      'quotes:read',
      'quotes:write',
      'contracts:read',
      'contracts:write',
      'catalog:read',
    ] as const) {
      expect(WHITELIST_PERMISSIONS.has(p), p).toBe(true)
    }
  })

  it('绝不包含站点配置/兑换码/积分系统相关权限', () => {
    // settings:write / templates / images:generate / smart-home ...
    expect(WHITELIST_PERMISSIONS.has('settings:write')).toBe(false)
    expect(WHITELIST_PERMISSIONS.has('images:generate')).toBe(false)
    expect(WHITELIST_PERMISSIONS.has('templates:read')).toBe(false)
    expect(WHITELIST_PERMISSIONS.has('smart-home:write')).toBe(false)
    expect(WHITELIST_PERMISSIONS.has('smart-home:read')).toBe(false)
  })

  it('isWhitelisted：全子集才通过，越权即拒', () => {
    expect(isWhitelisted(['projects:write'])).toBe(true)
    expect(isWhitelisted(['contracts:read', 'contracts:write'])).toBe(true)
    expect(isWhitelisted(['settings:write'])).toBe(false)
    expect(isWhitelisted(['quotes:write', 'settings:write'])).toBe(false)
    expect(isWhitelisted(['projects:write', 'images:generate'])).toBe(false)
  })

  it('显式工具名 allowlist：破坏性/越权工具不放行，即便权限在范围内', () => {
    // projects:write 在权限白名单内，但 delete_after_sales_record 是永久删除，不放行。
    expect(WHITELIST_TOOLS.has('delete_after_sales_record')).toBe(false)
    expect(isWhitelistedTool('delete_after_sales_record', ['projects:write'])).toBe(false)
    // 站点配置类工具名不在 allowlist，也不放行。
    expect(isWhitelistedTool('update_company_settings', ['settings:write'])).toBe(false)
  })

  it('允许的业务工具既要名字在 allowlist，又要权限在 whitelist', () => {
    expect(isWhitelistedTool('update_project', ['projects:write'])).toBe(true)
    expect(isWhitelistedTool('create_or_update_quote', ['quotes:write'])).toBe(true)
    expect(isWhitelistedTool('search_products', ['catalog:read'])).toBe(true)
    // 名字在名单但权限越权 → 拒
    expect(isWhitelistedTool('update_project', ['settings:write'])).toBe(false)
    expect(isWhitelistedTool('update_project', ['projects:write', 'images:generate'])).toBe(false)
  })

  it('allowlist 里的工具都有 handler 执行体，不会被注册表静默丢弃', () => {
    // 这一步由 server.test.ts 的「一一对应」断言覆盖，这里只保证 allowlist 非空且有预期成员。
    expect(WHITELIST_TOOLS.size).toBeGreaterThanOrEqual(10)
    expect(WHITELIST_TOOLS.has('create_project')).toBe(true)
    expect(WHITELIST_TOOLS.has('add_floor_sheet')).toBe(true)
  })
})
