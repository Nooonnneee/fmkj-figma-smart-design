import { loadProjectDocs } from '@/lib/project-docs'
import type { User } from '@/payload-types'
import type { RegisteredToolSpec } from '@/plugins/ai-catalog'
import type { PluginFlags } from '@/plugins/state'

export type ActiveProjectUpdate = {
  id: string
  name: string
  customerName: string | null
  platform: string | null
  pointCount: number
}

export type ToolContext = {
  user: User
  projectId: string | null
  project: Awaited<ReturnType<typeof loadProjectDocs>> | null
  onProjectChange?: (proj: ActiveProjectUpdate) => void
  mutated?: boolean
}

export type ToolRunResult = {
  result: unknown
  summary: string
  href?: string
  hrefLabel?: string
  /** AI 生图返回的媒体 URL，聊天里直接展示 */
  imageUrl?: string
}

export type AiToolHandler = (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolRunResult>

export type AiTool = {
  /** null 表示核心内置工具（始终可用）；非 null 表示需开启并勾选对应插件 */
  pluginId: keyof PluginFlags | null
  pluginName: string
  spec: RegisteredToolSpec
  definition: Record<string, unknown>
  run: AiToolHandler
}

export async function refreshContextProject(ctx: ToolContext, targetProjectId: string) {
  ctx.projectId = targetProjectId
  ctx.project = await loadProjectDocs(targetProjectId, ctx.user).catch(() => null)
  if (ctx.project) {
    ctx.onProjectChange?.({
      id: String(ctx.project.project.id),
      name: ctx.project.project.name,
      customerName: ctx.project.project.customerName ?? null,
      platform: ctx.project.project.platform ?? null,
      pointCount: ctx.project.points.length,
    })
  }
}
