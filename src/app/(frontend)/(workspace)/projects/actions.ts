'use server'

import { APIError, ValidationError } from 'payload'

import { appAuth } from '@/lib/app-auth'
import { getPayloadClient } from '@/lib/payload'
import { DEFAULT_PLATFORM, isProjectPlatform } from '@/lib/projects'
import type { Project } from '@/payload-types'

export type ProjectFormState =
  | { ok: true; id: string; savedAt: number }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
  | null

const str = (form: FormData, key: string, max: number) => {
  const v = String(form.get(key) ?? '').trim()
  return v === '__none' ? '' : v.slice(0, max)
}

/** 只接受白名单字段；项目名称留空时由集合按小区、房号或客户姓名自动生成。 */
function parse(form: FormData) {
  const fieldErrors: Record<string, string> = {}
  const budgetRaw = str(form, 'budget', 20)
  const budget = budgetRaw ? Number(budgetRaw) : null
  if (budget !== null && (!Number.isFinite(budget) || budget < 0)) fieldErrors.budget = '预算需为非负数字'
  const platformRaw = str(form, 'platform', 40)
  if (platformRaw && !isProjectPlatform(platformRaw)) fieldErrors.platform = '取值无效'
  const data = {
    name: str(form, 'name', 120),
    customerName: str(form, 'customerName', 60) || null,
    customerPhone: str(form, 'customerPhone', 30) || null,
    community: str(form, 'community', 80) || null,
    address: str(form, 'address', 200) || null,
    platform: (platformRaw || DEFAULT_PLATFORM) as Project['platform'],
    budget,
    notes: str(form, 'notes', 2000) || null,
  }
  return { data, owner: str(form, 'owner', 64), fieldErrors }
}

function toFailure(error: unknown): ProjectFormState {
  if (error instanceof ValidationError) {
    const fieldErrors: Record<string, string> = {}
    for (const e of error.data?.errors ?? []) fieldErrors[e.path] = e.message
    return { ok: false, error: '有字段未通过校验，请检查后重试', fieldErrors }
  }
  if (error instanceof APIError && error.status < 500) return { ok: false, error: error.message }
  const status = (error as { status?: number })?.status
  if (status === 403) return { ok: false, error: '没有权限修改这个项目' }
  if (status === 404) return { ok: false, error: '项目不存在或已被删除' }
  console.error('[projects] save failed', error)
  return { ok: false, error: '保存失败，请稍后重试' }
}

export async function saveProject(_prev: ProjectFormState, form: FormData): Promise<ProjectFormState> {
  const user = await appAuth.getCurrentUser()
  if (!user) return { ok: false, error: '登录已过期，请重新登录' }

  const id = str(form, 'id', 64)
  const { data, owner, fieldErrors } = parse(form)
  if (Object.keys(fieldErrors).length) return { ok: false, error: '请检查标记的字段', fieldErrors }

  const payload = await getPayloadClient()
  if (owner) {
    const found = await payload.find({
      collection: 'users',
      where: { and: [{ id: { equals: owner } }, { status: { equals: 'active' } }] },
      limit: 1,
      depth: 0,
      user,
      overrideAccess: false,
      select: { name: true },
    })
    if (!found.docs.length) return { ok: false, error: '请检查标记的字段', fieldErrors: { owner: '负责人不存在或已停用' } }
  }

  try {
    const doc = id
      ? await payload.update({ collection: 'projects', id, data: { ...data, owner: owner || null }, user, overrideAccess: false, depth: 0, select: { name: true } })
      : await payload.create({ collection: 'projects', data: { ...data, owner: owner || user.id, status: 'active' }, user, overrideAccess: false, depth: 0, select: { name: true } })
    return { ok: true, id: String(doc.id), savedAt: Date.now() }
  } catch (error) {
    return toFailure(error)
  }
}
