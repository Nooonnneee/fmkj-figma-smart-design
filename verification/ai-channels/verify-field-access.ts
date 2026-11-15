/**
 * 复核问题 3 的**真实 Payload**证据：集合层 REST / GraphQL 改不动
 * `apiKeyCipher` / `lastCheck*` / `apiKeyHint`，而服务层（overrideAccess）能写。
 *
 * 为什么不用单元测试：`src/collections/Users.ts` 通过 `@/lib/demo-project` 间接
 * import `@payload-config`，vitest 里解析不了；字段级 access 的行为也只有真 Payload
 * 才能证明（`overrideAccess` 会绕过字段级 access）。
 *
 * 用法（需要一个演练库，脚本不会碰生产库）：
 *
 *   DATABASE_URI=postgres://fmkj@127.0.0.1:55432/fmkj_rehearse \
 *   PAYLOAD_SECRET=rehearse-secret \
 *   pnpm exec payload run verification/ai-channels/verify-field-access.ts
 *
 * 断言失败时进程退出码非 0。
 */
import path from 'node:path'
import { getPayload, type Payload } from 'payload'

import { seal } from '@/lib/ai-channels-crypto'

let failures = 0
function check(label: string, ok: boolean, extra?: unknown) {
  if (ok) {
    console.log(`  ✓ ${label}`)
  } else {
    failures += 1
    console.error(`  ✗ ${label}`, extra === undefined ? '' : JSON.stringify(extra))
  }
}

const configPath = path.resolve(process.env.PAYLOAD_CONFIG_PATH || 'src/payload.selfhost.config.ts')
const payload: Payload = await getPayload({ config: (await import(configPath)).default })

if (payload.db.name !== 'postgres') {
  console.error(`当前连的是 ${payload.db.name}，不是 PostgreSQL，已停止。`)
  process.exit(1)
}

// ── 造一个成员账号（只在这个演练库里） ──────────────────────
const email = `field-access-${Date.now()}@example.com`
const created = await payload.create({
  collection: 'users',
  data: {
    email,
    password: 'rehearse-password-123',
    name: '字段权限演练',
    status: 'active',
    companyProfile: {
      name: '演练抬头',
      aiChannels: [],
    },
  } as never,
  overrideAccess: true,
})
const userId = String(created.id)
const memberReq = { user: created } as never

// 先用服务层写一条合法渠道（overrideAccess: true 是服务层的写法）
const seededCipher = seal('sk-field-access-rehearse')
await payload.update({
  collection: 'users',
  id: userId,
  data: {
    companyProfile: {
      name: '演练抬头',
      aiChannels: [
        {
          key: 'c1',
          label: '演练渠道',
          baseUrl: 'https://api.example.com/v1',
          apiKeyCipher: seededCipher,
          apiKeyHint: '...ease',
          models: ['m1'],
          enabled: true,
          lastCheckedAt: '2026-01-01T00:00:00.000Z',
          lastCheckOk: true,
          lastCheckError: null,
        },
      ],
    },
  } as never,
  overrideAccess: true,
  depth: 0,
})

console.log('\n[1] 成员通过 Local API（overrideAccess: false）改服务端字段')
const FORGED = 'v1:FORGED-CIPHERTEXT'
await payload.update({
  collection: 'users',
  id: userId,
  data: {
    companyProfile: {
      name: '演练抬头',
      aiChannels: [
        {
          key: 'c1',
          label: '演练渠道',
          baseUrl: 'https://api.example.com/v1',
          apiKeyCipher: FORGED,
          apiKeyHint: '...FAKE',
          models: ['m1'],
          enabled: true,
          lastCheckedAt: '2020-01-01T00:00:00.000Z',
          lastCheckOk: false, // 试图伪造「未通过」
          lastCheckError: 'I am the client',
        },
      ],
    },
  } as never,
  overrideAccess: false,
  req: memberReq,
  depth: 0,
})

const afterMember = (await payload.findByID({
  collection: 'users',
  id: userId,
  depth: 0,
  overrideAccess: true,
})) as unknown as { companyProfile?: { aiChannels?: Record<string, unknown>[] } }
const row = afterMember.companyProfile?.aiChannels?.[0] ?? {}
check(
  '密文没被成员改成伪造值',
  row.apiKeyCipher === seededCipher,
  String(row.apiKeyCipher).slice(0, 24),
)
check('apiKeyHint 没被改', row.apiKeyHint === '...ease', row.apiKeyHint)
check('lastCheckedAt 没被改', row.lastCheckedAt === '2026-01-01T00:00:00.000Z', row.lastCheckedAt)
check('lastCheckOk 仍是 true', row.lastCheckOk === true, row.lastCheckOk)
check('lastCheckError 没被注入', !row.lastCheckError, row.lastCheckError)

console.log('\n[2] 成员通过集合层改可见字段（label / enabled）—— 必须改不动')
await payload.update({
  collection: 'users',
  id: userId,
  data: {
    companyProfile: {
      name: '演练抬头',
      aiChannels: [{ ...row, label: '成员改的名字', enabled: false }],
    },
  } as never,
  overrideAccess: false,
  req: memberReq,
  depth: 0,
})
const afterVisible = (await payload.findByID({
  collection: 'users',
  id: userId,
  depth: 0,
  overrideAccess: true,
})) as unknown as { companyProfile?: { aiChannels?: Record<string, unknown>[] } }
const row2 = afterVisible.companyProfile?.aiChannels?.[0] ?? {}
check('label 没被成员经集合层改掉', row2.label === '演练渠道', row2.label)
check('enabled 没被成员经集合层改掉', row2.enabled === true, row2.enabled)
check(
  '数组层的行没被整段替换（密文仍在）',
  row2.apiKeyCipher === seededCipher,
  String(row2.apiKeyCipher).slice(0, 24),
)

console.log('\n[3] 服务端（overrideAccess: true）仍然能写检查结果')
await payload.update({
  collection: 'users',
  id: userId,
  data: {
    companyProfile: {
      name: '演练抬头',
      aiChannels: [{ ...row2, lastCheckOk: false, lastCheckError: '服务端写入' }],
    },
  } as never,
  overrideAccess: true,
  depth: 0,
})
const afterServer = (await payload.findByID({
  collection: 'users',
  id: userId,
  depth: 0,
  overrideAccess: true,
})) as unknown as { companyProfile?: { aiChannels?: Record<string, unknown>[] } }
const row3 = afterServer.companyProfile?.aiChannels?.[0] ?? {}
check('服务端写 lastCheckOk', row3.lastCheckOk === false, row3.lastCheckOk)
check('服务端写 lastCheckError', row3.lastCheckError === '服务端写入', row3.lastCheckError)

console.log('\n[4] 成员读自己的文档时看不到密文')
const memberRead = (await payload.findByID({
  collection: 'users',
  id: userId,
  depth: 0,
  overrideAccess: false,
  req: memberReq,
})) as unknown as { companyProfile?: { aiChannels?: Record<string, unknown>[] } }
const memberRow = memberRead.companyProfile?.aiChannels?.[0] ?? {}
check('成员读不到 apiKeyCipher', !('apiKeyCipher' in memberRow), Object.keys(memberRow))
check('JSON 里没有密文', !JSON.stringify(memberRead).includes(seededCipher))

// 清理这个演练账号
await payload.delete({ collection: 'users', id: userId, overrideAccess: true })

console.log(`\n结果：${failures === 0 ? '全部通过' : `${failures} 项失败`}`)
process.exit(failures === 0 ? 0 : 1)
