import { appendFileSync } from 'fs'
import { getPayload } from 'payload'
import config from '@payload-config'
const log = (...a: unknown[]) => appendFileSync('/tmp/dbg3.txt', a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ') + '\n')
const payload = await getPayload({ config: await config })
const r = await payload.login({ collection: 'users', data: { email: 'sales@fmkj.dev', password: 'demo1234' } })
const { user } = await payload.auth({ headers: new Headers({ Authorization: `JWT ${r.token}` }) })
const sales = { ...(user as any), collection: 'users' }
const viewer = { ...sales, role: 'viewer' }
const t = async (label: string, fn: () => Promise<any>) => {
  try { log(label, 'OK', JSON.stringify(await fn()).slice(0, 80)) } catch (e: any) { log(label, 'DENIED', e.status ?? '', e.message) }
}
let id = ''
await t('sales create', async () => { const d = await payload.create({ collection: 'projects', data: { name: '__access test', customerName: 't' } as any, user: sales, overrideAccess: false, depth: 0 }); id = String(d.id); return { ownerIsSales: d.owner === sales.id, stage: d.stage, risk: d.riskLevel } })
await t('viewer create', () => payload.create({ collection: 'projects', data: { name: 'x', customerName: 'y' } as any, user: viewer, overrideAccess: false }))
await t('viewer update', () => payload.update({ collection: 'projects', id, data: { name: 'z' }, user: viewer, overrideAccess: false }))
await t('viewer read', async () => (await payload.find({ collection: 'projects', user: viewer, overrideAccess: false })).totalDocs)
await t('bad enum', () => payload.update({ collection: 'projects', id, data: { stage: 'hacked' } as any, user: sales, overrideAccess: false }))
await t('sales delete', () => payload.delete({ collection: 'projects', id, user: sales, overrideAccess: false }))
await t('cleanup', () => payload.delete({ collection: 'projects', id, overrideAccess: true }))
await t('count', async () => (await payload.count({ collection: 'projects', overrideAccess: true })).totalDocs)
process.exit(0)
