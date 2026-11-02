'use server'

import { APIError } from 'payload'

import { appAuth } from '@/lib/app-auth'
import { getPayloadClient } from '@/lib/payload'
import { loadProposalTemplates } from '@/plugins/proposal/registry'

/** 归档 / 恢复项目。归档后项目、报价、合同都只读，并从「进行中」列表移到「已归档」。 */
export async function setProjectArchived(projectId: string, archived: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await appAuth.getCurrentUser()
  if (!user) return { ok: false, error: '登录已过期，请重新登录' }
  try {
    const payload = await getPayloadClient()
    await payload.update({
      collection: 'projects',
      id: projectId,
      data: { status: archived ? 'archived' : 'active' },
      user,
      overrideAccess: false,
      depth: 0,
      select: { status: true },
    })
    return { ok: true }
  } catch (error) {
    if (error instanceof APIError && error.status < 500) return { ok: false, error: error.message }
    console.error('[projects] archive failed', error)
    return { ok: false, error: '操作失败，请稍后重试' }
  }
}

export type DeliverablesPatch = { finalQuote?: string | null; proposalTemplate?: string | null }

/**
 * 设置交付资料：定稿报价、交付方案模板（只接受这两个字段）。
 * 报价必须属于本项目（由项目集合的校验保证），模板必须是当前可用的方案模板。
 */
export async function setDeliverables(projectId: string, patch: DeliverablesPatch): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await appAuth.getCurrentUser()
  if (!user) return { ok: false, error: '登录已过期，请重新登录' }
  const data: { finalQuote?: string | null; proposalTemplate?: string | null } = {}
  if ('finalQuote' in patch) data.finalQuote = typeof patch.finalQuote === 'string' && patch.finalQuote.trim() ? patch.finalQuote.trim().slice(0, 64) : null
  if ('proposalTemplate' in patch) {
    const slug = typeof patch.proposalTemplate === 'string' ? patch.proposalTemplate.trim().slice(0, 60) : ''
    if (slug) {
      const templates = await loadProposalTemplates(user)
      if (!templates.some((t) => t.value === slug)) return { ok: false, error: '方案模板不存在或已停用' }
    }
    data.proposalTemplate = slug || null
  }
  if (!Object.keys(data).length) return { ok: false, error: '没有要保存的内容' }
  try {
    const payload = await getPayloadClient()
    await payload.update({ collection: 'projects', id: projectId, data, user, overrideAccess: false, depth: 0, select: { finalQuote: true, proposalTemplate: true } })
    return { ok: true }
  } catch (error) {
    if (error instanceof APIError && error.status < 500) return { ok: false, error: error.message }
    if (error instanceof Error && /ValidationError|只能选择|不存在/.test(`${error.name} ${error.message}`)) return { ok: false, error: '只能选择本项目的报价单' }
    console.error('[projects] set deliverables failed', error)
    return { ok: false, error: '保存失败，请稍后重试' }
  }
}
