/**
 * 用真实代码复算 Ledger.tla 的那条反例路径。
 *
 * 这个文件**不是**数据库集成测试：本机没有可用的 Postgres（Docker 未启动），
 * 平台库是生产库，所以这里用一个两阶段的内存库来复刻事务语义：
 *   - 读只看到「已提交」的数据（Postgres READ COMMITTED 的行为）；
 *   - 写入要等 commit() 才可见。
 * 跑的是 `src/collections/AiCreditLedger.ts` 里真实的 beforeChange / afterChange。
 *
 * 内存库比真实 Postgres 少一样东西：行锁。真实库里第二个 UPDATE 会先被第一个
 * 事务的行锁挡住，等它提交再写——写的仍是同一个字面量 balanceAfter，所以结果一样。
 *
 * 跑法：
 *   pnpm exec vitest run -c verification/credit-ledger/vitest.config.ts
 *
 * 它证明的是：两个并发的流水 create 在「读 → 写」之间交错时，
 * afterChange 会把基于旧余额算出的 balanceAfter 盖回去，后写入者覆盖先写入者。
 * 真实 Postgres 还需要两件事才对得上，两件都已核对：
 *   1. payload.create 会把 hooks 和插入放进同一个事务
 *      （node_modules/payload/dist/collections/operations/create.js:46 initTransaction）；
 *   2. 本仓库的 postgresAdapter 没有配置 transactionOptions，隔离级别是默认的 READ COMMITTED
 *      （src/payload.selfhost.config.ts:158）。
 */
import { describe, expect, it } from 'vitest'
import { APIError } from 'payload'
import { AiCreditLedger } from '@/collections/AiCreditLedger'

type Hook = (args: never) => Promise<never>

const beforeChange = AiCreditLedger.hooks!.beforeChange![0] as unknown as Hook
const afterChange = AiCreditLedger.hooks!.afterChange![0] as unknown as Hook

type Store = { balance: number; rows: number[] }

/** 一条事务：读看到已提交的数据，写入到 commit() 才生效。 */
function transaction(store: Store) {
  const staged: { rows: number[]; balance: number | null } = { rows: [], balance: null }
  const payload = {
    async findByID() {
      return { aiCredits: store.balance }
    },
    async update({ data }: { data: { aiCredits: number } }) {
      staged.balance = data.aiCredits
      return data
    },
  }
  const tx = {
    req: { payload },
    commit() {
      store.rows.push(...staged.rows)
      if (staged.balance !== null) store.balance = staged.balance
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
  // 这条断言的是规则本身，不是现状。今天它失败（余额 0，流水合计 -10），
  // 所以用 it.fails 让套件保持绿色；扣费改成原子之后它会变成「不该失败」，
  // 那时把它改成 it(...) 并断言修复后的行为。
  it.fails('余额 = 期初 + 流水合计（现状违反这条规则）', async () => {
    const store: Store = { balance: 5, rows: [] }
    const t1 = transaction(store)
    const t2 = transaction(store)

    // 两条事务都在对方提交之前读到了余额 5。
    await t1.create('u1', -5)
    await t2.create('u1', -5)

    t1.commit()
    t2.commit()

    expect(store.balance).toBe(5 + store.rows.reduce((s, r) => s + r, 0))
  })

  it('把两笔扣费串起来（锁 / 可串行化之后的顺序）：第二笔被 402 拒绝', async () => {
    const store: Store = { balance: 5, rows: [] }
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
