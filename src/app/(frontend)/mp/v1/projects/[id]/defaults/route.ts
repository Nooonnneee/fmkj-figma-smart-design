import { fail, mpRoute, ok, readJson } from '@/lib/mp/http'
import { setProjectDefault } from '@/lib/project-defaults'

/** 设置 / 清除项目某个设备类型的默认型号：{ deviceType, productId | null } */
export const POST = mpRoute<{ id: string }>(async ({ request, user, params }) => {
  const body = await readJson(request)
  const r = await setProjectDefault(user, params.id, body.deviceType, body.productId ?? null)
  return r.ok ? ok({ defaults: r.defaults }) : fail(r.status, r.error)
})
