/**
 * harness-mcp 的审计日志。
 *
 * 每次 write 类工具调用都记一条：时间 / 工具 / 受限账号 / 目标 / 结果。
 * 本版用 `console.info` 落到 stdout（运维侧由日志采集摄取），并显式用结构化 JSON，
 * 便于事后检索。后续如需进「现有 ledger」（AiCreditLedger 等），在这里插一行即可。
 */
export type HarnessAuditEntry = {
  ts: string
  kind: 'harness.audit'
  tool: string
  userId: string
  projectId?: string
  ok: boolean
  summary: string
}

export type AuditSink = (entry: HarnessAuditEntry) => void

let sink: AuditSink = (entry) => {
  // 结构化、单行、可 grep。绝不写入 key/token。
  console.info(
    JSON.stringify({
      ts: entry.ts,
      kind: entry.kind,
      tool: entry.tool,
      userId: entry.userId,
      projectId: entry.projectId,
      ok: entry.ok,
      summary: entry.summary,
    }),
  )
}

/** 测试时可替换 sink。 */
export function setHarnessAuditSink(s: AuditSink) {
  sink = s
}

/** 记录一次审计。仅对 mutates 类工具调用（后续若要全量记录，放开即可）。 */
export function recordHarnessAudit(entry: HarnessAuditEntry) {
  try {
    sink(entry)
  } catch {
    /* 审计失败绝不能让业务调用失败。 */
  }
}
