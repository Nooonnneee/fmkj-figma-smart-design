'use server'

import { appAuth } from '@/lib/app-auth'
import { saveProjectInput } from '@/lib/services/project-service'

export type ProjectFormState =
  | { ok: true; id: string; savedAt: number }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
  | null

/** 项目的保存规则在 src/lib/services/project-service.ts，网页和微信小程序共用。 */
export async function saveProject(_prev: ProjectFormState, form: FormData): Promise<ProjectFormState> {
  const user = await appAuth.getCurrentUser()
  if (!user) return { ok: false, error: '登录已过期，请重新登录' }
  const input: Record<string, unknown> = {}
  for (const [key, value] of form.entries()) if (typeof value === 'string') input[key] = value
  const id = typeof input.id === 'string' ? input.id.trim().slice(0, 64) : ''
  delete input.id
  const result = await saveProjectInput(user, id || null, input)
  return result.ok ? { ok: true, id: result.id, savedAt: Date.now() } : result
}
