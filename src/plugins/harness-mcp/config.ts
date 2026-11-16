/**
 * harness-mcp 配置与受限身份映射。
 *
 * 对外把「站点能力」暴露给外部 DeepSeek harness 的 MCP 接口层：
 * - 只暴露白名单内的业务工具（改项目 / 布点位 / 改报价 / 改合同），绝不泻全量；
 * - 外部请求用专用 bearer key 换取一个绑定好的受限账号，调用时作为 ctx.user 传给 runTool()；
 * - 写权限仍走现有 canEditProject 守卫，本层不绕过；
 * - 默认关闭，需显式设 `HARNESS_MCP_ENABLED=1` 才启。
 *
 * 环境变量（都不落代码 / 不落 conversation，由部署方配置）：
 * - `HARNESS_MCP_ENABLED`：`"1"` 才启用本端点；缺省 / 其它值 = 关闭。
 * - `HARNESS_MCP_KEYS`：逗号分隔的 `key=userId` 映射。每个 key 对应用户（受限账号）。
 *   示例：`sEcretKeyA=user_1ab2,sEcretKeyB=user_3cd4`。
 */
import type { AiPermission } from '@/plugins/ai-types'

/** 端点开关：默认关闭。 */
export const isHarnessMcpEnabled = (env: Record<string, string | undefined> = process.env) =>
  env.HARNESS_MCP_ENABLED === '1'

/** 逗号分隔的受限身份映射键在环境变量里的名字。 */
export const HARNESS_MCP_KEYS_ENV = 'HARNESS_MCP_KEYS'

export type HarnessIdentity = { key: string; userId: string }

/**
 * 解析受限身份映射。返回值只用于在内存里找 userId，key 本身不落日志。
 * 未配置或格式非法时返回空数组。
 */
export function parseHarnessIdentities(raw: string | undefined): HarnessIdentity[] {
  if (!raw) return []
  const out: HarnessIdentity[] = []
  for (const pair of raw.split(',')) {
    const trimmed = pair.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    const key = (eq >= 0 ? trimmed.slice(0, eq) : trimmed).trim()
    const userId = (eq >= 0 ? trimmed.slice(eq + 1) : '').trim()
    if (key && userId) out.push({ key, userId })
  }
  return out
}

/**
 * 根据 bearer key 找绑定的受限账号 userId。找不到返回 null。
 */
export function lookupIdentityByKey(
  key: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): HarnessIdentity | null {
  if (!key) return null
  for (const id of parseHarnessIdentities(env[HARNESS_MCP_KEYS_ENV])) {
    // 用长度恒定的字符串比较，避免时序侧信道泄露 key 前缀。
    if (id.key.length === key.length && constantTimeEqual(id.key, key)) return id
  }
  return null
}

function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) ^ b.charCodeAt(i)) & 0xff
  return diff === 0
}

/**
 * 白名单权限集（受限角色只授予这些；绝不给站点配置 / 兑换码 / 积分系统权限）：
 * 改项目 / 布点位 / 改报价 / 改合同，外加支撑这些业务所需的只读权限。
 */
export const WHITELIST_PERMISSIONS: ReadonlySet<AiPermission> = new Set([
  'projects:read',
  'projects:write',
  'point-map:read',
  'point-map:write',
  'quotes:read',
  'quotes:write',
  'contracts:read',
  'contracts:write',
  'catalog:read',
])

/**
 * 明确允许暴露的工具名集合。
 *
 * 仅靠权限白名单不够：`projects:write` 同时被「改项目」和「永久删除售后记录」这类
 * 破坏性工具共用。业务口径是第一期的四个能力——改项目 / 布点位 / 改报价 / 改合同，
 * 外加支撑这些所需的只读。因此这里再落一份**显式工具名**清单，与权限检查同时成立才放行。
 * 缺省的「改前确认回滚门」不在本期；删除 / 永久性操作一律不放行。
 */
export const WHITELIST_TOOLS: ReadonlySet<string> = new Set([
  // 改项目
  'list_projects',
  'create_project',
  'update_project',
  'get_project_details',
  // 布点位
  'add_floor_sheet',
  'import_points_json',
  'setup_rooms_and_points',
  'plan_points_with_vision',
  // 改报价
  'create_or_update_quote',
  'create_quote_from_competitor',
  // 改合同
  'create_or_update_contract',
  // 支撑只读
  'search_products',
])

/**
 * 判断工具是否允许暴露：**同时**满足
 * 1) 工具名在显式 allowlist 内；
 * 2) 工具要求的全部权限都落在 WHITELIST_PERMISSIONS 内。
 * 任一不满足即不放行。
 */
export function isWhitelistedTool(name: string, toolPerms: readonly AiPermission[]): boolean {
  return WHITELIST_TOOLS.has(name) && toolPerms.every((p) => WHITELIST_PERMISSIONS.has(p))
}

/** 见 isWhitelistedTool。 */
export function isWhitelisted(toolPerms: readonly AiPermission[]): boolean {
  return toolPerms.every((p) => WHITELIST_PERMISSIONS.has(p))
}
