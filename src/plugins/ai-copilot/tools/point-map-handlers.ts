/**
 * 点位图逐点位编辑工具的执行函数（list_point_map / edit_point_map）。
 *
 * 注册接线由主控统一处理（registry HANDLER_MAP / ai-catalog），本文件只导出 handler。
 * 安全边界：
 * - 项目必须存在、当前用户可编辑（canEditProject）、未归档；
 * - Local API 全部带 user + overrideAccess:false；
 * - id 必须真实存在于场景（由纯函数校验），未知 id 逐条跳过并返回原因；
 * - 单次编辑条数由 MAX_POINT_EDITS 限制，超过整批不执行；
 * - 保存沿用 data/route.ts 的规则：compactScene + 不再使用的图片文件显式写 null。
 */
import { canEditProject } from '@/lib/project-access'
import { ARCHIVED_MESSAGE, READONLY_COLLAB_MESSAGE } from '@/lib/project-guards'
import { getPayloadClient } from '@/lib/payload'
import {
  applyPointEdits,
  summarizePointMap,
  type PointMapEditResult,
  type PointMapEdits,
} from '@/lib/point-map-edit'
import type { SceneFile } from '@/lib/point-scene'

import { refreshContextProject, type AiToolHandler, type ToolContext } from './context'

/** 与 point-map/data/route.ts 保持一致的单条项目记录上限（留出余量给项目其他字段）。 */
const MAX_BYTES = 190 * 1024
/** 与 data/route.ts 一致：内嵌图片（data:）必须先上传媒体库，小图上限 24KB。 */
const MAX_INLINE = 24 * 1024

const projectIdOf = (args: Record<string, unknown>, ctx: ToolContext) => {
  const fromArgs = typeof args.projectId === 'string' ? args.projectId.trim() : ''
  return fromArgs || ctx.projectId
}

type LoadedProject = {
  payload: Awaited<ReturnType<typeof getPayloadClient>>
  project: {
    id: string | number
    name?: string | null
    status?: string | null
    owner?: unknown
    collaborators?: unknown
    pointMap?: unknown
  }
  projectId: string
}

async function loadProject(
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ ok: true; data: LoadedProject } | { ok: false; error: string; summary: string }> {
  const projectId = projectIdOf(args, ctx)
  if (!projectId)
    return { ok: false, error: '当前尚未关联项目，请先调用 list_projects 选择项目', summary: '未关联项目' }

  const payload = await getPayloadClient()
  const project = await payload
    .findByID({
      collection: 'projects',
      id: projectId,
      depth: 0,
      user: ctx.user,
      overrideAccess: false,
      select: {
        name: true,
        status: true,
        owner: true,
        collaborators: true,
        pointMap: true,
      },
    })
    .catch(() => null)

  if (!project)
    return { ok: false, error: '项目不存在或你无权访问', summary: '项目不可用' }
  return { ok: true, data: { payload, project, projectId } }
}

const editCounts = (results: readonly PointMapEditResult[]) => {
  const counts = { added: 0, moved: 0, removed: 0, updated: 0, skipped: 0 }
  for (const r of results) {
    if (r.status !== 'ok') {
      counts.skipped++
      continue
    }
    if (r.action === 'add') counts.added++
    else if (r.action === 'move') counts.moved++
    else if (r.action === 'remove') counts.removed++
    else if (r.action === 'update') counts.updated++
  }
  return counts
}

const summaryOf = (results: readonly PointMapEditResult[]) => {
  const special = results.find((r) => r.action === 'limit' || r.action === 'noop')
  if (special?.reason) return special.reason
  const c = editCounts(results)
  const parts: string[] = []
  if (c.added) parts.push(`新增 ${c.added} 个点位`)
  if (c.moved) parts.push(`移动 ${c.moved} 个点位`)
  if (c.removed) parts.push(`删除 ${c.removed} 项`)
  if (c.updated) parts.push(`修改 ${c.updated} 项`)
  if (c.skipped) parts.push(`跳过 ${c.skipped} 条`)
  return parts.length ? `点位图已更新：${parts.join('，')}` : '没有可执行的编辑'
}

export const pointMapToolHandlers: Record<string, AiToolHandler> = {
  async list_point_map(args, ctx) {
    const loaded = await loadProject(args, ctx)
    if (!loaded.ok)
      return { result: { error: loaded.error }, summary: loaded.summary }
    const { project, projectId } = loaded.data

    const summary = summarizePointMap(project.pointMap as never)
    return {
      result: {
        projectId,
        projectName: project.name ?? null,
        counts: summary.counts,
        sheets: summary.sheets,
        areas: summary.areas,
        points: summary.points,
        truncated: summary.truncated,
        hint: '点位 id 用 points[].id，房间 id 用 areas[].id；修改时调用 edit_point_map，不要编造 id。坐标是场景坐标（点位中心）。',
      },
      summary: `图纸 ${summary.counts.sheets} 张、房间 ${summary.counts.areas} 个、点位 ${summary.counts.points} 个${summary.truncated ? '（点位列表已截断）' : ''}`,
      href: `/projects/${projectId}/point-map`,
      hrefLabel: '打开点位图',
    }
  },

  async edit_point_map(args, ctx) {
    const loaded = await loadProject(args, ctx)
    if (!loaded.ok)
      return { result: { error: loaded.error }, summary: loaded.summary }
    const { payload, project, projectId } = loaded.data

    if (!canEditProject(project as never, ctx.user.id))
      return { result: { error: READONLY_COLLAB_MESSAGE }, summary: '仅查看权限，无法修改' }
    if (project.status === 'archived')
      return { result: { error: ARCHIVED_MESSAGE }, summary: '项目已归档' }

    const applied = applyPointEdits(
      project.pointMap as never,
      args as unknown as PointMapEdits,
    )
    if (!applied.changed) {
      return {
        result: {
          projectId,
          changed: false,
          counts: editCounts(applied.results),
          results: applied.results,
        },
        summary: summaryOf(applied.results),
        href: `/projects/${projectId}/point-map`,
        hrefLabel: '打开点位图',
      }
    }

    for (const file of Object.values(applied.scene.files)) {
      if (
        file &&
        file.dataURL.startsWith('data:') &&
        file.dataURL.length > MAX_INLINE
      )
        return {
          result: {
            error: '场景里有图片还没有上传到媒体库，请先在点位图里重新保存后再试',
            results: applied.results,
          },
          summary: '有内嵌图片未上传，未保存',
        }
    }

    const bytes = Buffer.byteLength(JSON.stringify(applied.scene))
    if (bytes > MAX_BYTES)
      return {
        result: {
          error: `修改后点位图 ${Math.round(bytes / 1024)}KB，超过 ${Math.round(MAX_BYTES / 1024)}KB 上限，未保存。请分批修改或拆分图纸`,
          results: applied.results,
        },
        summary: '点位图过大，未保存',
      }

    // 托管数据库更新 JSON 时会合并对象：不再使用的图片键显式写 null（与 data/route.ts 一致）
    const oldFiles = (project.pointMap as { files?: Record<string, unknown> } | null)?.files
    const filesToSave: Record<string, SceneFile | null> = { ...applied.scene.files }
    if (oldFiles && typeof oldFiles === 'object')
      for (const key of Object.keys(oldFiles)) if (!(key in filesToSave)) filesToSave[key] = null

    await payload.update({
      collection: 'projects',
      id: projectId,
      data: { pointMap: { ...applied.scene, files: filesToSave } as never },
      user: ctx.user,
      overrideAccess: false,
      depth: 0,
      select: { updatedAt: true },
    })

    ctx.mutated = true
    await refreshContextProject(ctx, projectId)

    return {
      result: {
        projectId,
        changed: true,
        counts: editCounts(applied.results),
        results: applied.results,
        totalPoints: ctx.project?.points.length ?? null,
      },
      summary: summaryOf(applied.results),
      href: `/projects/${projectId}/point-map`,
      hrefLabel: '查看点位图',
    }
  },
}
