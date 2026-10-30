import { appAuth } from '@/lib/app-auth'
import { getCompanyInfo } from '@/lib/cached-data'
import { getPayloadClient } from '@/lib/payload'
import { isPluginId, PLUGINS } from '@/plugins'

const fail = (status: number, error: string) => Response.json({ ok: false, error }, { status })

/** 切换单个已开发插件的启用状态（待开发插件不可启用）。 */
export async function POST(request: Request) {
  const user = await appAuth.getCurrentUser()
  if (!user) return fail(401, '登录已过期，请重新登录')

  let body: { id?: unknown; enabled?: unknown }
  try {
    body = (await request.json()) as { id?: unknown; enabled?: unknown }
  } catch {
    return fail(400, '提交的数据格式无效')
  }

  if (!isPluginId(body.id) || typeof body.enabled !== 'boolean') {
    return fail(400, '插件参数无效')
  }

  const plugin = PLUGINS.find((p) => p.id === body.id)
  if (!plugin || plugin.status !== 'ready') {
    return fail(400, '该插件尚在待开发阶段，暂不可开启')
  }

  const company = await getCompanyInfo()
  const disabled = new Set(company.disabledPlugins.filter((id) => isPluginId(id)))
  if (body.enabled) {
    disabled.delete(plugin.id)
  } else {
    disabled.add(plugin.id)
  }

  try {
    const payload = await getPayloadClient()
    await payload.updateGlobal({
      slug: 'company-settings',
      data: { disabledPlugins: [...disabled] } as never,
      user,
      overrideAccess: false,
    })
    return Response.json({ ok: true, enabled: body.enabled })
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status === 403) return fail(403, '没有权限修改插件设置')
    console.error('[plugins] toggle failed', error)
    return fail(500, '保存失败，请稍后重试')
  }
}
