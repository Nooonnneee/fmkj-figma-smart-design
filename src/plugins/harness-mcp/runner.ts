/**
 * harness-mcp 执行器：把受限账号映射成 ctx.user，落回 `runTool()`，
 * 并维护「只读支撑工具」的项目上下文、对写工具做审计。
 *
 * 身份已经在端点层用 bearer key 校验过了；这里只负责把 userId 变成 ToolContext，
 * 写权限守卫（canEditProject / 归档）仍在 runTool 内部，本层不绕过。
 *
 * 注：点位置类工具（add_floor_sheet / setup_rooms_and_points / import_points_json）
 * 用 `ctx.projectId` 定位目标项目，而它们没有 projectArg。为让外部 harness 能精确指定
 * 项目，协议层约定一个保留参数 `__projectId`（见 route.ts）——它仅用于填充 ctx.projectId，
 * **不是工具真实参数**，会在传给 runTool 前剥掉，不进 business 逻辑。
 */
import { REGISTERED_AI_TOOLS, runTool } from '@/plugins/ai-copilot/registry'
import type { AiTool } from '@/plugins/ai-copilot/tools/context'
import type { User } from '@/payload-types'

import { recordHarnessAudit } from './audit'
import { whitelistTools } from './server'

/** 保留参数名：仅用于把目标项目传给工具（对没有 projectArg 的布点位类工具特别有用）。 */
export const RESERVED_PROJECT_ARG = '__projectId'

function pickTools(): AiTool[] {
  const names = new Set(whitelistTools().map((t) => t.name))
  // REGISTERED_AI_TOOLS 是最终可用执行体；按白名单名字筛出。
  return REGISTERED_AI_TOOLS.filter((t) => names.has(t.spec.name))
}

function bearerUser(userId: string): User {
  // ctx.user 只被各 tool handler 当作 `{ id }` 使用（见 core/point-map/admin handlers 的
  // ctx.user.id / owner: ctx.user.id）。这里给最小合法形状。真实受限账号完整资料由部署方
  // 在 users 集合维护，并以 HARNESS_MCP_KEYS 绑定。
  return { id: userId, name: 'harness', status: 'active' } as unknown as User
}

export type ToolCallOutput = {
  ok: boolean
  content: unknown
  mutated: boolean
}

/**
 * 执行一次工具调用，用受限账号做 ctx.user。
 * - `rawArgs` 为工具真实参数（已由端点把 `__projectId` 剥掉）。
 */
export async function runHarnessTool(
  userId: string,
  name: string,
  rawArgs: string | Record<string, unknown>,
): Promise<ToolCallOutput> {
  const args: Record<string, unknown> =
    typeof rawArgs === 'string' ? safeParse(rawArgs) : { ...(rawArgs as Record<string, unknown>) }

  const tools = pickTools()
  const tool = tools.find((t) => t.spec.name === name)
  if (!tool) {
    return { ok: false, content: { error: `未知或未白名单化工具：${name}` }, mutated: false }
  }

  const ctxProjectId =
    typeof args[RESERVED_PROJECT_ARG] === 'string' ? args[RESERVED_PROJECT_ARG] : null
  // 剥掉保留参数，避免它作为脏参数传进工具业务逻辑。
  delete args[RESERVED_PROJECT_ARG]

  const ctx = {
    user: bearerUser(userId),
    projectId: ctxProjectId,
    project: null,
  }

  const call = {
    id: 'harness-' + name,
    type: 'function' as const,
    function: { name, arguments: JSON.stringify(args) },
  }

  const res = await runTool(tools, call, ctx)
  const mutated = tool.spec.mutates === true
  const ok = Boolean(res.tool) && !isErrorOutput(res.output)
  const summary = res.summary ?? ''

  if (mutated) {
    recordHarnessAudit({
      ts: new Date().toISOString(),
      kind: 'harness.audit',
      tool: name,
      userId,
      projectId: typeof ctxProjectId === 'string' ? ctxProjectId : undefined,
      ok,
      summary,
    })
  }

  return { ok, content: res.output, mutated }
}

function isErrorOutput(o: unknown): boolean {
  return Boolean(o && typeof o === 'object' && 'error' in (o as Record<string, unknown>))
}

function safeParse(s: string): Record<string, unknown> {
  if (!s.trim()) return {}
  try {
    const v = JSON.parse(s) as unknown
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}
