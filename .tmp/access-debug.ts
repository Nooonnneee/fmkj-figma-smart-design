import { appendFileSync } from 'fs'
import { getPayload } from 'payload'
import config from '@payload-config'
const log = (...a: unknown[]) => appendFileSync('/tmp/dbg2.txt', a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' ') + '\n')
const payload = await getPayload({ config: await config })
const r = await payload.login({ collection: 'users', data: { email: 'demo@fmkj.dev', password: 'demo1234' } })
const { user } = await payload.auth({ headers: new Headers({ Authorization: `JWT ${r.token}` }) })
log('auth user keys', Object.keys(user || {}), 'collection', (user as any)?.collection, 'status', (user as any)?.status, 'role', (user as any)?.role)
try { const f = await payload.find({ collection: 'categories', user, overrideAccess: false, limit: 1 }); log('find ok', f.totalDocs) } catch (e: any) { log('find err', e.status, e.message) }
const u2 = { ...(user as any), collection: 'users' }
try { const f = await payload.find({ collection: 'categories', user: u2, overrideAccess: false, limit: 1 }); log('find with explicit collection ok', f.totalDocs) } catch (e: any) { log('find2 err', e.status, e.message) }
process.exit(0)
