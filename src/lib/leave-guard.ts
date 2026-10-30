/**
 * 站内跳转前的保存守卫：编辑器（点位图、报价单、合同）有未保存修改时注册一个守卫，
 * 项目板块切换和侧边栏导航会先执行它（通常是自动保存），成功后再跳转。
 * 只在浏览器端使用；关闭或刷新页面仍由各编辑器的 beforeunload 提醒。
 */
type Guard = () => Promise<boolean> | boolean

let current: Guard | null = null

export function registerLeaveGuard(guard: Guard) {
  current = guard
  return () => {
    if (current === guard) current = null
  }
}

export const hasLeaveGuard = () => current !== null

export async function runLeaveGuard() {
  if (!current) return true
  try {
    return await current()
  } catch {
    return false
  }
}
