/**
 * 冒烟测试用的最小种子数据（只在 CI / 本地验证用，不碰生产）。
 *
 * 造两样东西：
 *   1. 一个可登录的员工账号（默认 demo@fmkj.local / demo12345）
 *   2. 一个带点位与报价的示例项目（走 ensureDemoTemplateProject，
 *      与首页「产品演示」用的是同一套数据源）
 *
 * 用法：
 *   pnpm exec payload run --input '{"scriptPath":"scripts/seed-smoke.ts"}'
 *
 * 幂等：账号已存在则改密码、项目已存在则复用，重复跑不会炸。
 */
import path from 'node:path'
import { getPayload } from 'payload'

const EMAIL = process.env.SMOKE_SEED_EMAIL || 'demo@fmkj.local'
const PASSWORD = process.env.SMOKE_SEED_PASSWORD || 'demo12345'

const configPath = path.resolve(process.env.PAYLOAD_CONFIG_PATH || 'src/payload.selfhost.config.ts')
const payload = await getPayload({ config: (await import(configPath)).default })

if (payload.db.name !== 'postgres') {
  console.error(`当前连接的是 ${payload.db.name}，不是 PostgreSQL，已停止。`)
  process.exit(1)
}

// ── 1. 账号 ──────────────────────────────────────────────
const existing = await payload.find({
  collection: 'users',
  where: { email: { equals: EMAIL } },
  limit: 1,
  overrideAccess: true,
})

let userId: string
if (existing.docs.length) {
  const doc = existing.docs[0]!
  userId = String(doc.id)
  await payload.update({
    collection: 'users',
    id: doc.id,
    data: { password: PASSWORD },
    overrideAccess: true,
  })
  console.log(`✓ 账号已存在，密码已重置：${EMAIL}`)
} else {
  const created = await payload.create({
    collection: 'users',
    data: { email: EMAIL, password: PASSWORD, name: '冒烟测试账号', status: 'active' },
    overrideAccess: true,
  })
  userId = String(created.id)
  console.log(`✓ 已创建账号：${EMAIL}`)
}

// ── 2. 示例项目 ──────────────────────────────────────────
// 与首页产品演示同源，保证有真实点位、报价与合同数据可供页面渲染。
const { ensureDemoTemplateProject, cloneDemoProjectForUser } = await import('@/lib/demo-project')

const template = await ensureDemoTemplateProject()
if (!template) {
  console.error('✗ 示例项目模板创建失败')
  process.exit(1)
}

const owned = await payload.find({
  collection: 'projects',
  where: { and: [{ owner: { equals: userId } }, { isDemoTemplate: { not_equals: true } }] },
  limit: 1,
  overrideAccess: true,
})

let projectId: string
if (owned.docs.length) {
  projectId = String(owned.docs[0]!.id)
  console.log(`✓ 示例项目已存在：${projectId}`)
} else {
  const user = await payload.findByID({ collection: 'users', id: userId, overrideAccess: true })
  const cloned = await cloneDemoProjectForUser(user as never)
  projectId = String((cloned as { id?: string })?.id ?? '')
  console.log(projectId ? `✓ 已为用户创建示例项目：${projectId}` : '✗ 示例项目创建返回空')
}

// 输出给 CI 用的项目 ID
console.log(`SMOKE_PROJECT_ID=${projectId}`)
await payload.db.destroy?.()
process.exit(projectId ? 0 : 1)
