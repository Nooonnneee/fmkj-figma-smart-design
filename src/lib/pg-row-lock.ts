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
 * 在 Payload 的当前事务里执行一条加锁读（`SELECT ... FOR UPDATE`），返回命中的行。
 *
 * 为什么要它：Postgres 默认 READ COMMITTED，两个并发的「读余额/次数 → 算新值 → 写回」
 * 都会读到旧值、各自算一次，后提交者用字面量把先提交者覆盖掉（丢失更新）。`FOR UPDATE`
 * 把第二笔挡在行锁上，等第一笔提交后再重读最新的已提交值，于是读-改-写被串行化。
 *
 * 锁只在同一个事务里才有意义，所以必须走 `transactionID` 对应的事务会话；取不到事务
 * 会话时回退到普通连接，只作兜底，**不提供锁保护**（例如一次性脚本或非事务调用方）。
 */
export async function lockRow(
  payload: Payload,
  transactionID: TransactionID,
  query: LockQuery,
): Promise<Record<string, unknown>[]> {
  const adapter = payload.db as unknown as PostgresAdapter
  const id = await transactionID
  const db = ((id ? adapter.sessions?.[String(id)]?.db : undefined) ??
    adapter.drizzle) as PostgresAdapter['drizzle']
  const { rows } = await db.execute(query)
  return rows as Record<string, unknown>[]
}
