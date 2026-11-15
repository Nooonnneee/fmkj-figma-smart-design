/**
 * 积分发放的幂等与兑换码守卫。
 *
 * 已有的形式化验证（.claude/skills/verify-credit-ledger）证明的是 ledger hook 的
 * 「余额 = 期初 + 流水合计」与「不透支」。它不覆盖：
 *   - 任务奖励的「每个账号每项任务终生一次」「同一微信号不能换号重复领」；
 *   - 兑换码的过期 / 停用 / 零权益 / 大小写归一 / 流水失败回滚。
 * 这些出错就是多发了积分（白嫖）或该发的没到账（客户投诉），所以补在这里。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getPayloadClient: vi.fn(), lockRow: vi.fn() }))

vi.mock('@/lib/payload', () => ({ getPayloadClient: mocks.getPayloadClient }))
vi.mock('@/lib/pg-row-lock', () => ({ lockRow: mocks.lockRow }))

import { CREDIT_TASKS, grantTaskCreditIfEligible, isRealUserEmail } from './credit-tasks'
import { redeemCodeForUser } from './services/membership-service'

type FindArgs = { where: { reason: { equals: string } } }
type WriteArgs = { data: Record<string, any> }

beforeEach(() => {
  mocks.getPayloadClient.mockReset()
  mocks.lockRow.mockReset()
  mocks.lockRow.mockResolvedValue([{ id: 'code-1' }])
})

describe('isRealUserEmail', () => {
  it('占位邮箱不算真实邮箱（不能让任务奖励被白领）', () => {
    expect(isRealUserEmail('13800000000@wx.fmkj.local')).toBe(false)
    expect(isRealUserEmail('someone@example.com')).toBe(false)
    expect(isRealUserEmail('  USER@WX.FMKJ.LOCAL ')).toBe(false)
    expect(isRealUserEmail('real@company.com')).toBe(true)
    expect(isRealUserEmail('')).toBe(false)
    expect(isRealUserEmail(null)).toBe(false)
  })
})

describe('grantTaskCreditIfEligible：每项任务终生只发一次', () => {
  it('已领取过：不再创建流水，返回 granted=false', async () => {
    const create = vi.fn()
    mocks.getPayloadClient.mockResolvedValue({
      count: vi.fn(async () => ({ totalDocs: 1 })),
      find: vi.fn(),
      create,
    })

    const r = await grantTaskCreditIfEligible('u-1', 'bind_email')
    expect(r).toEqual({ granted: false, credits: 0, reason: '已领取过该奖励' })
    expect(create).not.toHaveBeenCalled()
  })

  it('首次领取：按任务规格写正数流水，备注带任务说明', async () => {
    const create = vi.fn(async (_args: WriteArgs) => ({}))
    mocks.getPayloadClient.mockResolvedValue({
      count: vi.fn(async () => ({ totalDocs: 0 })),
      find: vi.fn(),
      create,
    })

    const r = await grantTaskCreditIfEligible('u-1', 'first_quote')
    const spec = CREDIT_TASKS.find((t) => t.id === 'first_quote')!
    expect(r).toEqual({ granted: true, credits: spec.credits, reason: spec.ledgerReason })
    expect(create.mock.calls[0]![0].data).toMatchObject({
      user: 'u-1',
      delta: spec.credits,
      reason: spec.ledgerReason,
    })
  })

  it('微信绑定奖励：同一 openid 已在活跃账号领取过则拒绝（防换号刷分）', async () => {
    const create = vi.fn()
    const findByWechat = vi.fn(async (_args: FindArgs) => ({ docs: [{ user: 'u-other' }] }))
    mocks.getPayloadClient.mockResolvedValue({
      count: vi.fn(async ({ collection }: { collection: string }) =>
        collection === 'users' ? { totalDocs: 1 } : { totalDocs: 0 },
      ),
      find: findByWechat,
      create,
    })

    const r = await grantTaskCreditIfEligible('u-1', 'bind_wechat', { openid: 'wx-openid-123456' })
    expect(r).toEqual({
      granted: false,
      credits: 0,
      reason: '该微信号已领取过绑定奖励',
    })
    // 备注里带 openid 后六位，用于区分不同微信账号
    expect(findByWechat.mock.calls[0]![0].where.reason.equals).toContain('123456')
    expect(create).not.toHaveBeenCalled()
  })

  it('原微信号账号已停用：仍允许新账号领取（真实换号不卡死）', async () => {
    const create = vi.fn(async (_args: WriteArgs) => ({}))
    mocks.getPayloadClient.mockResolvedValue({
      count: vi.fn(async ({ collection }: { collection: string }) =>
        collection === 'users' ? { totalDocs: 0 } : { totalDocs: 0 },
      ),
      find: vi.fn(async () => ({ docs: [{ user: 'u-disabled' }] })),
      create,
    })

    const r = await grantTaskCreditIfEligible('u-1', 'bind_wechat', { openid: 'wx-openid-abcdef' })
    expect(r.granted).toBe(true)
    expect(create.mock.calls[0]![0].data.reason).toContain('(abcdef)')
  })

  it('同一任务并发调用只产生一笔流水（查重与入账串行）', async () => {
    let ledgerRows = 0
    const create = vi.fn(async () => {
      ledgerRows += 1
      return {}
    })
    mocks.getPayloadClient.mockResolvedValue({
      // 只有第一笔看到 0；第二笔在锁释放后重新查，看到 1
      count: vi.fn(async () => ({ totalDocs: ledgerRows })),
      find: vi.fn(),
      create,
    })

    const [a, b] = await Promise.all([
      grantTaskCreditIfEligible('u-1', 'bind_email'),
      grantTaskCreditIfEligible('u-1', 'bind_email'),
    ])
    expect([a.granted, b.granted].filter(Boolean)).toHaveLength(1)
    expect(create).toHaveBeenCalledTimes(1)
  })
})

describe('redeemCodeForUser：兑换码的其余守卫', () => {
  const codeDoc = (over: Record<string, unknown> = {}) => ({
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
  })

  function fakePayload(doc: Record<string, unknown>, over: Record<string, unknown> = {}) {
    return {
      find: vi.fn(async () => ({ docs: [{ id: doc.id }] })),
      findByID: vi.fn(async () => doc),
      update: vi.fn(async (_args: WriteArgs) => ({ id: doc.id })),
      create: vi.fn(async (_args: WriteArgs) => ({ balanceAfter: 25 })),
      db: {
        beginTransaction: vi.fn(async () => 'tx-1'),
        commitTransaction: vi.fn(async () => undefined),
        rollbackTransaction: vi.fn(async () => undefined),
      },
      ...over,
    }
  }

  const user = { id: 'u-1' } as never

  it('兑换码大小写与首尾空格不影响核销（统一大写后查询）', async () => {
    const payload = fakePayload(codeDoc())
    mocks.getPayloadClient.mockResolvedValue(payload)

    const r = await redeemCodeForUser(user, '  fmkj-test ')
    expect(r.ok).toBe(true)
    const where = (
      payload.find.mock.calls[0] as unknown as [{ where: { code: { equals: string } } }]
    )[0].where
    expect(where.code.equals).toBe('FMKJ-TEST')
  })

  it('已过期：拒绝且不写任何数据，事务回滚', async () => {
    const payload = fakePayload(codeDoc({ expiresAt: '2020-01-01T00:00:00.000Z' }))
    mocks.getPayloadClient.mockResolvedValue(payload)

    const r = await redeemCodeForUser(user, 'FMKJ-TEST')
    expect(r).toEqual({ ok: false, error: '该兑换码已过有效期' })
    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.db.rollbackTransaction).toHaveBeenCalled()
  })

  it('已停用：拒绝，不核销', async () => {
    const payload = fakePayload(codeDoc({ status: 'disabled' }))
    mocks.getPayloadClient.mockResolvedValue(payload)

    const r = await redeemCodeForUser(user, 'FMKJ-TEST')
    expect(r).toEqual({ ok: false, error: '该兑换码已失效或已被使用' })
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('零权益兑换码：拒绝，不占用使用次数', async () => {
    const payload = fakePayload(codeDoc({ credits: 0 }))
    mocks.getPayloadClient.mockResolvedValue(payload)

    const r = await redeemCodeForUser(user, 'FMKJ-TEST')
    expect(r).toEqual({ ok: false, error: '该兑换码未配置有效权益' })
    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('写流水失败：回滚兑换码更新，不吞错（避免扣了次数没到账）', async () => {
    const payload = fakePayload(codeDoc(), {
      create: vi.fn(async () => {
        throw new Error('ledger down')
      }),
    })
    mocks.getPayloadClient.mockResolvedValue(payload)

    await expect(redeemCodeForUser(user, 'FMKJ-TEST')).rejects.toThrow('ledger down')
    expect(payload.db.rollbackTransaction).toHaveBeenCalled()
    expect(payload.db.commitTransaction).not.toHaveBeenCalled()
  })

  it('用完最后一次即停用，并把当前用户写入兑换人名单', async () => {
    const payload = fakePayload(codeDoc({ maxUses: 1, usedCount: 0 }))
    mocks.getPayloadClient.mockResolvedValue(payload)

    await redeemCodeForUser(user, 'FMKJ-TEST')
    const data = payload.update.mock.calls[0]![0].data
    expect(data.usedCount).toBe(1)
    expect(data.status).toBe('disabled')
    expect(data.redeemedBy).toEqual([
      expect.objectContaining({ user: 'u-1', redeemedAt: expect.any(String) }),
    ])
  })

  it('未用完时保持 active，已有兑换记录不丢', async () => {
    const payload = fakePayload(
      codeDoc({
        maxUses: 5,
        usedCount: 2,
        redeemedBy: [{ user: 'u-old', redeemedAt: '2026-01-01T00:00:00.000Z' }],
      }),
    )
    mocks.getPayloadClient.mockResolvedValue(payload)

    await redeemCodeForUser(user, 'FMKJ-TEST')
    const data = payload.update.mock.calls[0]![0].data
    expect(data.usedCount).toBe(3)
    expect(data.status).toBe('active')
    expect(data.redeemedBy.map((r: { user: unknown }) => String(r.user))).toEqual(['u-old', 'u-1'])
  })

  it('兑换码太短或太长：直接拒绝，不查库、不开事务', async () => {
    const payload = fakePayload(codeDoc())
    mocks.getPayloadClient.mockResolvedValue(payload)

    for (const bad of ['abc', 'x'.repeat(41), '', '   ']) {
      const r = await redeemCodeForUser(user, bad)
      expect(r).toEqual({ ok: false, error: '请输入有效的兑换码' })
    }
    expect(payload.find).not.toHaveBeenCalled()
    expect(payload.db.beginTransaction).not.toHaveBeenCalled()
  })
})
