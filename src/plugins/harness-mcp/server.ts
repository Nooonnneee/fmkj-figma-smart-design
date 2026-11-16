/**
 * harness-mcp 的薄暴露层：把注册表里「白名单内」的工具转成外呼可用的 MCP tools，
 * `tools/call` 落回 `runTool()`，不重写任何业务逻辑。
 *
 * 只泻白名单内的工具（改项目 / 布点位 / 改报价 / 改合同及其只读支撑），其余一律不暴露。
 */
import { allAiToolSpecs } from '@/plugins/ai-catalog'
import { REGISTERED_AI_TOOLS } from '@/plugins/ai-copilot/registry'

import { isWhitelistedTool } from './config'
import { runHarnessTool } from './runner'

/** 供协议层传输的 MCP 风格 tool 定义（name + JSON Schema，外加 mutates 元信息）。 */
export type HarnessMcpTool = {
  name: string
  description: string
  parameters: Record<string, unknown>
  mutates: boolean
}

/**
 * 白名单内的工具清单。顺序取自注册表。返回结构化规格，供 external harness 枚举。
 */
export function whitelistTools(): HarnessMcpTool[] {
  const registered = new Set(REGISTERED_AI_TOOLS.map((t) => t.spec.name))
  return allAiToolSpecs()
    .filter((spec) => registered.has(spec.name) && isWhitelistedTool(spec.name, spec.permissions))
    .map((spec) => ({
      name: spec.name,
      description: spec.description,
      parameters: (spec.parameters as Record<string, unknown>) ?? {},
      mutates: spec.mutates === true,
    }))
}

/** 某工具名是否在白名单内（供协议层在 call 前做一次粗校验；真权力仍由 runTool 守卫）。 */
export function isExposedTool(name: string): boolean {
  return whitelistTools().some((t) => t.name === name)
}

/**
 * 执行一次工具调用。返回结构化文本结果。写操作由 runHarnessTool 负责审计。
 */
export async function handleToolCall(
  identity: { userId: string },
  name: string,
  rawArgs: string | Record<string, unknown>,
): Promise<{ ok: boolean; content: unknown; mutated: boolean }> {
  return runHarnessTool(identity.userId, name, rawArgs)
}
