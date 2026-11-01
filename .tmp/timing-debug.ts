import { appendFileSync } from 'fs'
import { getPayload } from 'payload'
import config from '@payload-config'
const log = (...a: unknown[]) => appendFileSync('/tmp/t.txt', a.join(' ') + '\n')
const payload = await getPayload({ config: await config })
const r = await payload.login({ collection: 'users', data: { email: 'demo@fmkj.dev', password: 'demo1234' } })
const t = async (label: string, fn: () => Promise<unknown>) => { const s = performance.now(); await fn(); log(label, (performance.now() - s).toFixed(0) + 'ms') }
for (let i = 0; i < 2; i++) {
  let user: any
  await t('auth', async () => { user = (await payload.auth({ headers: new Headers({ Authorization: `JWT ${r.token}` }) })).user })
  user = { ...user, collection: 'users' }
  await t('projects find depth1', () => payload.find({ collection: 'projects', depth: 1, limit: 500, user, overrideAccess: false }))
  await t('products find depth1', () => payload.find({ collection: 'products', depth: 1, limit: 200, user, overrideAccess: false }))
  await t('categories find', () => payload.find({ collection: 'categories', limit: 100, user, overrideAccess: false }))
  await t('count', () => payload.count({ collection: 'projects', overrideAccess: true }))
}
process.exit(0)
