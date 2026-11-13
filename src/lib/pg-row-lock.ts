import { type PostgresAdapter } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

type LockQuery = Parameters<PostgresAdapter['drizzle']['execute']>[0]
type TransactionID =
  | number
  | string
  | null
  | undefined
  | Promise<number | string | null | undefined>

/**
 * 拿不到事务会话时抛出。钱路径上**绝不**降级到连接池执行 `SELECT ... FOR UPDATE`：
 * 池连接是自动提交的，语句一结束锁就释放，看起来成功、实际零保护，且完全没有告警。
 * 抛错会让这次写失败（不会记假账），比静默失去并发保护安全。
 */
export class RowLockTransactionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RowLockTransactionError'
  }
}

/**
 * 在 Payload 的当前事务里执行一条加锁读（`SELECT ... FOR UPDATE`），返回命中的行。
 *
 * 为什么要它：Postgres 默认 READ COMMITTED，两个并发的「读余额/次数 → 算新值 → 写回」
 * 都会读到旧值、各自算一次，后提交者用字面量把先提交者覆盖掉（丢失更新）。`FOR UPDATE`
 * 把第二笔挡在行锁上，等第一笔提交后再重读最新的已提交值，于是读-改-写被串行化。
 *
 * 锁只在同一个事务里才有意义，所以必须走 `transactionID` 对应的事务会话。取不到事务
 * （`disableTransaction: true`、手工调用没传事务、事务会话已提交/不存在）时直接抛
 * `RowLockTransactionError`，**不会**回退到普通连接——那种情况下 `FOR UPDATE` 会立刻释放，
 * 静默失效。
 */
export async function lockRow(
  payload: Payload,
  transactionID: TransactionID,
  query: LockQuery,
): Promise<Record<string, unknown>[]> {
  const adapter = payload.db as unknown as PostgresAdapter
  const id = await transactionID
  if (id === null || id === undefined) {
    throw new RowLockTransactionError(
      'lockRow 需要事务上下文（transactionID），拒绝在无锁连接上执行 SELECT ... FOR UPDATE',
    )
  }
  const session = adapter.sessions?.[String(id)]
  if (!session?.db) {
    throw new RowLockTransactionError(
      `lockRow 找不到事务会话 ${String(id)}（可能已提交/回滚），拒绝降级为无锁查询`,
    )
  }
  const { rows } = await session.db.execute(query)
  return rows as Record<string, unknown>[]
}
