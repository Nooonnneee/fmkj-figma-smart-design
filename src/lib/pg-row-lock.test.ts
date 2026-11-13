import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

import { RowLockTransactionError, lockRow } from './pg-row-lock'

function fakePayload() {
  // 连接池 mock 返回「成功」的行：旧实现会静默走这里，测试必须因「没抛错」而红。
  const poolExecute = vi.fn(async () => ({ rows: [{ id: 'pool-row' }] }))
  const txExecute = vi.fn(async () => ({ rows: [{ id: 'row-1' }] }))
  return {
    payload: {
      db: {
        drizzle: { execute: poolExecute },
        sessions: { 'tx-1': { db: { execute: txExecute } } },
      },
    } as unknown as Payload,
    poolExecute,
    txExecute,
  }
}

const query = {} as never

describe('lockRow', () => {
  it('有事务会话：在事务连接上执行，绝不用连接池', async () => {
    const { payload, poolExecute, txExecute } = fakePayload()

    const rows = await lockRow(payload, 'tx-1', query)

    expect(rows).toEqual([{ id: 'row-1' }])
    expect(txExecute).toHaveBeenCalledTimes(1)
    expect(poolExecute).not.toHaveBeenCalled()
  })

  it('接受 Promise 形式的事务 id', async () => {
    const { payload, txExecute } = fakePayload()

    await lockRow(payload, Promise.resolve('tx-1'), query)

    expect(txExecute).toHaveBeenCalledTimes(1)
  })

  it('没有 transactionID：抛错，绝不在连接池上执行 FOR UPDATE', async () => {
    const { payload, poolExecute } = fakePayload()

    await expect(lockRow(payload, undefined, query)).rejects.toBeInstanceOf(RowLockTransactionError)
    await expect(lockRow(payload, null, query)).rejects.toBeInstanceOf(RowLockTransactionError)
    expect(poolExecute).not.toHaveBeenCalled()
  })

  it('transactionID 存在但会话不存在：抛错，不静默降级', async () => {
    const { payload, poolExecute } = fakePayload()

    await expect(lockRow(payload, 'tx-missing', query)).rejects.toBeInstanceOf(
      RowLockTransactionError,
    )
    expect(poolExecute).not.toHaveBeenCalled()
  })
})
