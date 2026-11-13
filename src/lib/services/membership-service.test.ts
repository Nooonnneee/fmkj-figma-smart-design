import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getPayloadClient: vi.fn(), lockRow: vi.fn() }))

vi.mock('@/lib/payload', () => ({ getPayloadClient: mocks.getPayloadClient }))
vi.mock('@/lib/pg-row-lock', () => ({ lockRow: mocks.lockRow }))

import { redeemCodeForUser } from './membership-service'

const TX = 'tx-1'

type CodeDoc = {
  id: string
  code: string
  label?: string | null
  credits?: number | null
  maxUses?: number | null
  usedCount?: number | null
  status?: string | null
  expiresAt?: string | null
  redeemedBy?: Array<{ user?: unknown; redeemedAt?: string | null }> | null
}

function codeDoc(over: Partial<CodeDoc> = {}): CodeDoc {
  return {
    id: 'code-1',
    code: 'FMKJ-TEST',
    label: '新用户体验包',
    credits: 20,
    maxUses: 1,
    usedCount: 0,
    status: 'active',
    expiresAt: null,
    redeemedBy: [],
    ...over,
  }
}

function fakePayload(doc: CodeDoc) {
  return {
    find: vi.fn(async (..._args: unknown[]) => ({ docs: [{ id: doc.id }] })),
    findByID: vi.fn(async (..._args: unknown[]) => doc),
    update: vi.fn(async (..._args: unknown[]) => ({ id: doc.id })),
    create: vi.fn(async (..._args: unknown[]) => ({ balanceAfter: 25 })),
    db: {
      beginTransaction: vi.fn(async () => TX),
      commitTransaction: vi.fn(async (..._args: unknown[]) => undefined),
      rollbackTransaction: vi.fn(async (..._args: unknown[]) => undefined),
    },
  }
}

const user = { id: 'u-1' } as never

describe('redeemCodeForUser 的并发安全形状', () => {
  beforeEach(() => {
    mocks.getPayloadClient.mockReset()
    mocks.lockRow.mockReset()
    mocks.lockRow.mockResolvedValue([{ id: 'code-1' }])
  })

  it('兑换成功的路径：先加行锁，再在同一事务里写兑换码与积分流水', async () => {
    const payload = fakePayload(codeDoc())
    mocks.getPayloadClient.mockResolvedValue(payload)

    const r = await redeemCodeForUser(user, 'fmkj-test')

    expect(r).toMatchObject({ ok: true, creditsAdded: 20, aiCredits: 25 })

    // 锁在读之前拿到
    expect(mocks.lockRow).toHaveBeenCalledTimes(1)
    expect(mocks.lockRow.mock.invocationCallOrder[0]).toBeLessThan(
      payload.findByID.mock.invocationCallOrder[0]!,
    )
    // 两次写入共用同一个事务（否则锁形同虚设、且两者无法一起提交/回滚）
    expect(payload.update.mock.calls[0]![0]).toMatchObject({ req: { transactionID: TX } })
    expect(payload.create.mock.calls[0]![0]).toMatchObject({ req: { transactionID: TX } })
    expect(payload.db.commitTransaction).toHaveBeenCalledWith(TX)
    expect(payload.db.rollbackTransaction).not.toHaveBeenCalled()
  })

  it('同一账号重复兑换：不写流水，回滚事务', async () => {
    const payload = fakePayload(codeDoc({ redeemedBy: [{ user: 'u-1', redeemedAt: null }] }))
    mocks.getPayloadClient.mockResolvedValue(payload)

    const r = await redeemCodeForUser(user, 'FMKJ-TEST')

    expect(r).toEqual({ ok: false, error: '你已经使用过这个兑换码了' })
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.db.rollbackTransaction).toHaveBeenCalledWith(TX)
    expect(payload.db.commitTransaction).not.toHaveBeenCalled()
  })

  it('次数已领完：不写流水，回滚事务', async () => {
    const payload = fakePayload(codeDoc({ usedCount: 1, maxUses: 1 }))
    mocks.getPayloadClient.mockResolvedValue(payload)

    const r = await redeemCodeForUser(user, 'FMKJ-TEST')

    expect(r).toEqual({ ok: false, error: '该兑换码已被领完' })
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.db.rollbackTransaction).toHaveBeenCalledWith(TX)
  })

  it('兑换码不存在：不开事务', async () => {
    const payload = fakePayload(codeDoc())
    payload.find.mockResolvedValueOnce({ docs: [] })
    mocks.getPayloadClient.mockResolvedValue(payload)

    const r = await redeemCodeForUser(user, 'NOPE-XXXX')

    expect(r).toEqual({ ok: false, error: '兑换码不存在，请核对后重试' })
    expect(payload.db.beginTransaction).not.toHaveBeenCalled()
    expect(mocks.lockRow).not.toHaveBeenCalled()
  })
})
