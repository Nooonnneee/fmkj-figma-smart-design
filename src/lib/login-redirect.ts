import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { safeRedirectPath } from './safe-redirect'

/**
 * 未登录时跳到登录页，并带上当前地址（src/proxy.ts 写入的 x-pathname），登录后回到原页面。
 * 只用在页面和布局里；Server Action 里直接 redirect('/login')。
 */
export async function redirectToLogin(): Promise<never> {
  const from = safeRedirectPath((await headers()).get('x-pathname'), '')
  redirect(from && from !== '/projects' ? `/login?from=${encodeURIComponent(from)}` : '/login')
}
