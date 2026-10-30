'use server'

import { APIError } from 'payload'

import { appAuth } from '@/lib/app-auth'
import { getPayloadClient } from '@/lib/payload'

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
