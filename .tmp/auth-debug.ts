import { appendFileSync } from 'fs'
const log = (...a: unknown[]) => appendFileSync('/tmp/dbg.txt', a.map(String).join(' ') + '\n')
import { getPayload } from 'payload'
import config from '@payload-config'
const payload = await getPayload({ config: await config })
const r = await payload.login({ collection: 'users', data: { email: 'demo@fmkj.dev', password: 'demo1234' } })
log('login token?', Boolean(r.token), 'exp', r.exp)
const strategies = (payload.authStrategies || []).map((s: any) => s.name)
log('strategies', JSON.stringify(strategies))
for (const h of [`JWT ${r.token}`, `Bearer ${r.token}`]) {
  const res = await payload.auth({ headers: new Headers({ Authorization: h }) })
  log(h.split(' ')[0], 'user?', Boolean(res.user), (res.user as any)?.collection, (res.user as any)?.email)
}
const res2 = await payload.auth({ headers: new Headers({ Cookie: `payload-token=${r.token}` }) })
log('cookie user?', Boolean(res2.user), (res2.user as any)?.collection)
process.exit(0)
