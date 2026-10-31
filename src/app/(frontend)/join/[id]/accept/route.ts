import { relId } from '@/lib/access'
import { appAuth } from '@/lib/app-auth'
import { getPayloadClient } from '@/lib/payload'
import { parseShareConfig, type CollaboratorItem } from '@/lib/project-access'

const fail = (status: number, error: string) => Response.json({ ok: false, error }, { status })

/**
 * 接受项目协作邀请：
 * - 已登录用户直接加入项目协作者列表；
 * - 未登录用户支持在同一次请求中传入登录（mode=login）或新用户注册（mode=register）并自动加入该项目。
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const body = (await request.json().catch(() => ({}))) as {
    token?: string
    mode?: 'current' | 'login' | 'register'
    name?: string
    email?: string
    password?: string
  }
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  if (!token) return fail(400, '协作邀请链接缺少凭证')

  const payload = await getPayloadClient()
  const project = await payload
    .findByID({
      collection: 'projects',
      id,
      depth: 0,
      overrideAccess: true,
      select: { name: true, owner: true, collaborators: true, shareConfig: true },
    })
    .catch(() => null)
  if (!project) return fail(404, '项目不存在或已被删除')

  const rawProj = project as unknown as {
    owner?: unknown
    collaborators?: CollaboratorItem[] | null
    shareConfig?: unknown
  }
  const shareConfig = parseShareConfig(rawProj.shareConfig)
  if (!shareConfig.enabled || shareConfig.token !== token) {
    return fail(403, '该协作链接已失效或已被项目管理员关闭')
  }

  let user = await appAuth.getCurrentUser()
  if (body.mode === 'login') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!email || !password) return fail(400, '请输入邮箱和密码')
    const res = await appAuth.login(email, password)
    if (!res.ok) return fail(401, res.error)
    user = await appAuth.getCurrentUser()
  } else if (body.mode === 'register') {
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 40) : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 120) : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!name) return fail(400, '请填写你的姓名')
    if (!email || !email.includes('@')) return fail(400, '请填写有效的邮箱')
    if (password.length < 6) return fail(400, '密码至少需要 6 位')

    const existing = await payload.count({ collection: 'users', where: { email: { equals: email } }, overrideAccess: true })
    if (existing.totalDocs > 0) {
      return fail(409, '该邮箱已有账号，请切换到「已有账号登录」')
    }
    await payload.create({
      collection: 'users',
      data: { name, email, password, status: 'active' },
      overrideAccess: true,
      depth: 0,
    })
    const res = await appAuth.login(email, password)
    if (!res.ok) return fail(500, '账号已创建，请使用刚才的邮箱密码登录')
    user = await appAuth.getCurrentUser()
  }

  if (!user) return fail(401, '请先登录或注册账号以加入项目协作')

  const uid = String(user.id)
  const ownerId = relId(project.owner)
  if (ownerId && ownerId !== uid) {
    const currentCollabs = (rawProj.collaborators ?? []).map((c) => ({
      user: relId(c.user)!,
      role: c.role,
      joinedAt: c.joinedAt ?? new Date().toISOString(),
    }))
    const existingIdx = currentCollabs.findIndex((c) => c.user === uid)
    if (existingIdx >= 0) {
      // 如果新链接是 edit 权限，升级已有 read 协作者的权限
      if (shareConfig.role === 'edit' && currentCollabs[existingIdx].role !== 'edit') {
        currentCollabs[existingIdx].role = 'edit'
      }
    } else {
      currentCollabs.push({
        user: uid,
        role: shareConfig.role,
        joinedAt: new Date().toISOString(),
      })
    }
    await payload.update({
      collection: 'projects',
      id: project.id,
      data: { collaborators: currentCollabs } as never,
      overrideAccess: true,
      depth: 0,
    })
  }

  return Response.json({
    ok: true,
    projectId: String(project.id),
    role: !ownerId || ownerId === uid ? 'owner' : shareConfig.role,
  })
}
