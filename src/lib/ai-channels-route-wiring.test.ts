import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 复核问题 4 的**接线**证明：CSRF 校验不只是函数存在，而是每个渠道路由
 * 都在第一行调用了 `rejectCrossOrigin`，并且在读 Cookie / 读库之前。
 *
 * 为什么用静态读取而不是跑 dev server：这个 worktree 的 `next` 包解析不到
 * （共享 checkout 的已知限制），起不了 dev server。函数行为本身由
 * `ai-channels-csrf.test.ts` 覆盖（跨站 Origin → 403、同站放行），
 * 这里补的是「有没有接上」这一环 —— 之前正是最容易漏的地方。
 */

const ROUTES = [
  'src/app/api/ai/channels/route.ts',
  'src/app/api/ai/channels/[key]/route.ts',
  'src/app/api/ai/channels/[key]/test/route.ts',
]

const read = (rel: string) => readFileSync(path.resolve(process.cwd(), rel), 'utf8')

describe('CSRF 接线：每个渠道路由都先拒绝跨站', () => {
  for (const rel of ROUTES) {
    it(`${rel}：导出的每个 HTTP 方法都以 rejectCrossOrigin 开头`, () => {
      const src = read(rel)
      // 抓取每个 export async function X(...) { ... } 的头部
      const handlers = [
        ...src.matchAll(/export async function (\w+)\([^)]*\) \{\n([\s\S]{0,400})/g),
      ]
      expect(handlers.length, `${rel} 里没有找到 HTTP 方法`).toBeGreaterThan(0)

      for (const [, name, head] of handlers) {
        const firstLines = head.split('\n').filter((l) => l.trim() !== '')
        expect(
          firstLines[0]?.includes('rejectCrossOrigin(request)'),
          `${rel} 的 ${name} 没在第一步调用 rejectCrossOrigin`,
        ).toBe(true)
      }
    })

    it(`${rel}：CSRF 排在鉴权和读库之前`, () => {
      const src = read(rel)
      // 逐个方法内部比较顺序：先 CSRF，再 getCurrentUser()，再 getPayloadClient()
      const handlers = [...src.matchAll(/export async function (\w+)\([^)]*\) \{\n([\s\S]*?)\n}/g)]
      expect(handlers.length).toBeGreaterThan(0)
      for (const [, name, body] of handlers) {
        const csrfAt = body.indexOf('rejectCrossOrigin(request)')
        // route.ts 里鉴权包在 requireUser() 里；[key]** 直接用 appAuth.getCurrentUser()
        const authAt = Math.min(
          ...[body.indexOf('requireUser('), body.indexOf('getCurrentUser()')].filter(
            (i) => i !== -1,
          ),
        )
        const hasAuth = Number.isFinite(authAt)
        const dbAt = body.indexOf('getPayloadClient()')
        expect(csrfAt, `${name} 没有 CSRF`).toBeGreaterThan(-1)
        if (hasAuth) expect(csrfAt, `${name} 先鉴权后 CSRF`).toBeLessThan(authAt)
        if (dbAt !== -1) expect(csrfAt, `${name} 先读库后 CSRF`).toBeLessThan(dbAt)
      }
    })
  }

  it('CSRF 校验只挂在渠道路由里，没有被塞进全局 proxy', () => {
    const proxy = read('src/proxy.ts')
    expect(proxy).not.toContain('rejectCrossOrigin')
  })
})
