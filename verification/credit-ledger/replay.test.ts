/**
 * 用真实代码复算 Ledger.tla 的那条并发路径（修复后的版本）。
 *
 * 这个文件**不是**数据库集成测试：本机没有可用的 Postgres（Docker 未启动），
 * 平台库是生产库，所以这里用一个两阶段的内存库来复刻事务语义：
 *   - 读只看到「已提交」的数据（Postgres READ COMMITTED 的行为）；
 *   - 写入要等 commit() 才可见；
 *   - 行锁：第二笔的 `SELECT ... FOR UPDATE` 会挂起，直到第一笔提交（`store.lock`）。
 * 跑的是 `src/collections/AiCreditLedger.ts` 里真实的 beforeChange / afterChange。
 *
 * 注意它证明的边界：内存库里的「锁」是我们自己实现的行为，不是 Postgres 的。
 * 它验证的是修复后的代码**确实在同一个事务里发出了加锁读**，并在被挡下后按 402 拒绝；
 * 真实 Postgres 的锁语义（阻塞、EvalPlanQual 重读已提交值）没有在这里被证明。
 * 真实库还需要两件事才对得上，两件都已核对：
 *   1. payload.create 会把 hooks 和插入放进同一个事务
 *      （node_modules/payload/dist/collections/operations/create.js:46 initTransaction）；
 *   2. 本仓库的 postgresAdapter 没有配置 transactionOptions，隔离级别是默认的 READ COMMITTED
 *      （src/payload.selfhost.config.ts:158）。
 *
 * 跑法：
 *   pnpm exec vitest run -c verification/credit-ledger/vitest.config.ts
 */
import { describe, expect, it } from 'vitest'
import { APIError } from 'payload'
import { AiCreditLedger } from '@/collections/AiCreditLedger'

type Hook = (args: never) => Promise<never>

const beforeChange = AiCreditLedger.hooks!.beforeChange![0] as unknown as Hook
const afterChange = AiCreditLedger.hooks!.afterChange![0] as unknown as Hook

type Store = {
  balance: number
  rows: number[]
  lock: Promise<void> | null
  release: (() => void) | null
}

/** 一条事务：读看到已提交的数据，写入到 commit() 才生效；加锁读会等前一笔提交。 */
function transaction(store: Store) {
  const staged: { rows: number[]; balance: number | null } = { rows: [], balance: null }
  const txId = `tx-${Math.random().toString(36).slice(2)}`

  // 复刻 `SELECT ai_credits FROM users WHERE id = $1 FOR UPDATE`：先拿锁，再读已提交余额。
  const execute = async () => {
    if (store.lock) await store.lock
    let release!: () => void
    store.lock = new Promise<void>((resolve) => (release = resolve))
    store.release = release
    return { rows: [{ ai_credits: store.balance }] }
  }

  const payload = {
    db: { sessions: { [txId]: { db: { execute } } }, drizzle: { execute } },
    async update({ data }: { data: { aiCredits: number } }) {
      staged.balance = data.aiCredits
      return data
    },
  }
  const tx = {
    req: { payload, transactionID: txId },
    commit() {
      store.rows.push(...staged.rows)
      if (staged.balance !== null) store.balance = staged.balance
      store.release?.()
      store.lock = null
      store.release = null
    },
    /** 复刻 create：beforeChange -> 插入流水 -> afterChange。 */
    async create(user: string, delta: number) {
      const data = { user, delta } as never
      const out = (await beforeChange({
        data,
        req: tx.req,
        operation: 'create',
        context: {},
      } as never)) as { delta: number; balanceAfter: number }
      staged.rows.push(out.delta)
      await afterChange({
        doc: out,
        req: tx.req,
        operation: 'create',
        context: {},
      } as never)
      return out
    },
  }
  return tx
}

describe('积分流水：两个并发 create 的读写在事务之间交错', () => {
  // 修复后：beforeChange 先加行锁，第二笔会被第一笔的事务挡在锁上，
  // 等第一笔提交后读到最新余额（0），于是被 402 拒绝。余额 = 期初 + 流水合计。
  it('两笔并发扣费：加锁串行化，第二笔被 402 拒绝', async () => {
    const store: Store = { balance: 5, rows: [], lock: null, release: null }
    const t1 = transaction(store)
    const t2 = transaction(store)

    const p1 = t1.create('u1', -5)
    const p2 = t2.create('u1', -5) // 挂在行锁上，等 t1 提交
    await p1
    t1.commit()

    await expect(p2).rejects.toBeInstanceOf(APIError)
    t2.commit()

    expect(store.rows).toEqual([-5])
    expect(store.balance).toBe(0)
    expect(store.balance).toBe(5 + store.rows.reduce((s, r) => s + r, 0))
  })

  it('把两笔扣费串起来（锁 / 可串行化之后的顺序）：第二笔被 402 拒绝', async () => {
    const store: Store = { balance: 5, rows: [], lock: null, release: null }
    const t1 = transaction(store)
    const t2 = transaction(store)

    await t1.create('u1', -5)
    t1.commit()

    // 第二笔在第一条提交之后才读，读到 0，被 beforeChange 的守卫挡下。
    await expect(t2.create('u1', -5)).rejects.toBeInstanceOf(APIError)

    expect(store.rows).toEqual([-5])
    expect(store.balance).toBe(0)
    expect(store.balance).toBe(5 + store.rows.reduce((s, r) => s + r, 0))
  })
})
