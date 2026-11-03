import { allAiToolSpecs } from '@/plugins/ai-catalog'

/**
 * AI 对话按用量计费：
 *   积分 = 倍率 ×（输入 tokens/1000 × 输入单价 + 输出 tokens/1000 × 输出单价）+ Σ 工具费用
 * 结果向上取整，最少 1 积分（失败不扣费）。模型的 `cost` 字段作为「计费倍率」（深度推理等贵模型可设 2、3）。
 */

/** 每 1K 输入 tokens 的积分（倍率为 1 时）。系统提示词、历史与工具结果都计入输入。 */
export const INPUT_PER_1K = 0.1
/** 每 1K 输出 tokens 的积分（倍率为 1 时），包含深度思考内容。 */
export const OUTPUT_PER_1K = 0.5

/** 工具调用费用：直接从各插件注册的 AiToolSpec.cost 自动汇总，未列出的按 DEFAULT_TOOL_COST。 */
export const TOOL_COSTS: Record<string, number> = Object.fromEntries(
  allAiToolSpecs().map((t) => [t.name, t.cost]),
)
export const DEFAULT_TOOL_COST = 0.5

export type TokenUsage = { prompt_tokens?: number; completion_tokens?: number }

/** 在一次对话中累计 tokens 与工具调用。 */
export class UsageMeter {
  inputTokens = 0
  outputTokens = 0
  tools: string[] = []
  /** 接口没有返回 usage 的轮次数（此时按字符估算） */
  estimated = 0

  add(usage: TokenUsage | null | undefined, fallback?: { input: string; output: string }) {
    if (usage && (usage.prompt_tokens || usage.completion_tokens)) {
      this.inputTokens += Math.max(0, Math.trunc(usage.prompt_tokens ?? 0))
      this.outputTokens += Math.max(0, Math.trunc(usage.completion_tokens ?? 0))
    } else if (fallback) {
      this.estimated++
      this.inputTokens += estimateTokens(fallback.input)
      this.outputTokens += estimateTokens(fallback.output)
    }
  }

  tool(name: string) {
    this.tools.push(name)
  }

  toolCost() {
    return this.tools.reduce((s, n) => s + (TOOL_COSTS[n] ?? DEFAULT_TOOL_COST), 0)
  }

  /** 本次应扣积分（整数，最少 1） */
  credits(multiplier: number) {
    const m = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1
    const tokenCost = m * ((this.inputTokens / 1000) * INPUT_PER_1K + (this.outputTokens / 1000) * OUTPUT_PER_1K)
    return Math.max(1, Math.ceil(tokenCost + this.toolCost() - 1e-9))
  }

  summary() {
    const t = this.tools.length ? ` · 工具 ${this.tools.length} 次` : ''
    return `输入 ${this.inputTokens.toLocaleString('en-US')} / 输出 ${this.outputTokens.toLocaleString('en-US')} tokens${t}${this.estimated ? '（部分估算）' : ''}`
  }
}

/** 接口未返回 usage 时的粗略估算：中文约 1 字 ≈ 0.7 token，其他约 4 字符 ≈ 1 token。 */
export function estimateTokens(text: string) {
  if (!text) return 0
  const cjk = (text.match(/[\u3400-\u9fff\uf900-\ufaff]/g) ?? []).length
  return Math.ceil(cjk * 0.7 + (text.length - cjk) / 4)
}
