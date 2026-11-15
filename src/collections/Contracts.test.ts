/**
 * 合同状态机回归：待签订 → 可改全部内容；签订 → 只能登记收款，其他字段一律锁定；
 * 撤销签订 → 解锁并清空签订日期。驱动的是集合真实的 beforeChange hook。
 */
import { APIError } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/project-guards', () => ({
  assertProjectEditable: vi.fn(async () => undefined),
  ARCHIVED_MESSAGE: '项目已归档，恢复项目后才能修改',
  READONLY_COLLAB_MESSAGE: '你对该项目仅有查看权限，无法修改',
  readableError: () => 'x',
}))

import { Contracts } from './Contracts'

type Hook = (args: Record<string, unknown>) => Promise<Record<string, unknown>>
const hooks = Contracts.hooks as unknown as {
  beforeChange: Hook[]
  beforeDelete: Hook[]
  beforeValidate: Hook[]
}
const beforeChange = hooks.beforeChange[0]!
const beforeValidate = hooks.beforeValidate[0]!
const beforeDelete = hooks.beforeDelete[0]!

const member = () => ({ id: 'u-1', collection: 'users', status: 'active' })

function req(
  overrides: {
    count?: ReturnType<typeof vi.fn>
    findByID?: ReturnType<typeof vi.fn>
    find?: ReturnType<typeof vi.fn>
  } = {},
) {
  return {
    user: member(),
    payload: {
      count: overrides.count ?? vi.fn(async () => ({ totalDocs: 0 })),
      findByID: overrides.findByID ?? vi.fn(async () => ({ project: 'p-1' })),
      find: overrides.find ?? vi.fn(async () => ({ docs: [] })),
    },
  } as never
}

const draftDoc = (over: Record<string, unknown> = {}) => ({
  id: 'c-1',
  project: 'p-1',
  quote: 'q-1',
  status: 'draft',
  number: 'HT20261030-01',
  amount: 10000,
  customerName: '张三',
  customerPhone: '13800000000',
  address: '某小区 1-101',
  durationDays: 15,
  warrantyMonths: 12,
  terms: '条款',
  payments: [
    { id: 'pay-1', name: '首付款', percent: 50, received: false },
    { id: 'pay-2', name: '尾款', percent: 50, received: false },
  ],
  signedAt: null,
  ...over,
})

beforeEach(() => vi.clearAllMocks())

describe('合同状态机：分段锁定', () => {
  it('已签订合同改金额：拒绝，并说明只能登记收款', async () => {
    const error = await rejectionOf(beforeChange, {
      data: { ...draftDoc(), status: 'signed', amount: 1 },
      operation: 'update',
      originalDoc: draftDoc({ status: 'signed', signedAt: '2026-10-30T00:00:00.000Z' }),
      req: req(),
    })
    expect(error.status).toBe(403)
    expect(error.message).toContain('只能登记收款')
  })

  it('已签订合同只改收款标记：通过，并保留原有付款条款', async () => {
    const out = await beforeChange({
      data: {
        ...draftDoc(),
        status: 'signed',
        payments: [
          { name: '首付款', percent: 50, received: true },
          { name: '尾款', percent: 50, received: false },
        ],
      },
      operation: 'update',
      originalDoc: draftDoc({ status: 'signed', signedAt: '2026-10-30T00:00:00.000Z' }),
      req: req(),
    })
    expect(out.status).toBe('signed')
  })

  it('已签订合同改付款比例（即使合计仍是 100）：拒绝', async () => {
    const error = await rejectionOf(beforeChange, {
      data: {
        ...draftDoc(),
        status: 'signed',
        payments: [
          { name: '首付款', percent: 60, received: false },
          { name: '尾款', percent: 40, received: false },
        ],
      },
      operation: 'update',
      originalDoc: draftDoc({ status: 'signed' }),
      req: req(),
    })
    expect(error.status).toBe(403)
  })

  it('待签订合同可以改金额与条款', async () => {
    const out = await beforeChange({
      data: { ...draftDoc(), amount: 20000, terms: '新条款' },
      operation: 'update',
      originalDoc: draftDoc(),
      req: req(),
    })
    expect(out.amount).toBe(20000)
    expect(out.terms).toBe('新条款')
  })

  it('签订时写入签订日期，撤销签订时清空', async () => {
    const signed = await beforeChange({
      data: { ...draftDoc(), status: 'signed' },
      operation: 'update',
      originalDoc: draftDoc(),
      req: req(),
    })
    expect(typeof signed.signedAt).toBe('string')
    expect(Number.isNaN(Date.parse(String(signed.signedAt)))).toBe(false)

    // 客户端即使把旧的 signedAt 一起提交，撤销签订后也必须清空
    const unsigned = await beforeChange({
      data: { ...draftDoc(), status: 'draft', signedAt: '2026-10-30T00:00:00.000Z' },
      operation: 'update',
      originalDoc: draftDoc({ status: 'signed', signedAt: '2026-10-30T00:00:00.000Z' }),
      req: req(),
    })
    expect(unsigned.signedAt).toBeNull()
  })
})

describe('合同金额与归属校验', () => {
  it('付款比例合计不等于 100：拒绝并报出当前合计', async () => {
    const error = await rejectionOf(beforeChange, {
      data: {
        ...draftDoc(),
        payments: [
          { name: '首付款', percent: 50, received: false },
          { name: '尾款', percent: 40, received: false },
        ],
      },
      operation: 'update',
      originalDoc: draftDoc(),
      req: req(),
    })
    expect(error.status).toBe(400)
    expect(error.message).toContain('100')
    expect(error.message).toContain('90')
  })

  it('依据的报价必须属于同一项目', async () => {
    const findByID = vi.fn(async () => ({ project: 'p-other' }))
    const error = await rejectionOf(beforeChange, {
      data: { ...draftDoc(), quote: 'q-2' },
      operation: 'update',
      originalDoc: draftDoc({ quote: 'q-1' }),
      req: req({ findByID }),
    })
    expect(error.status).toBe(400)
    expect(error.message).toContain('不属于这个项目')
  })

  it('合同不能改到其他项目', async () => {
    const error = await rejectionOf(beforeChange, {
      data: { ...draftDoc(), project: 'p-2' },
      operation: 'update',
      originalDoc: draftDoc(),
      req: req(),
    })
    expect(error.status).toBe(400)
    expect(error.message).toContain('其他项目')
  })

  it('一个项目只能有一份合同：创建时已存在则拒绝', async () => {
    const error = await rejectionOf(beforeChange, {
      data: draftDoc(),
      operation: 'create',
      req: req({ count: vi.fn(async () => ({ totalDocs: 1 })) }),
    })
    expect(error.status).toBe(400)
    expect(error.message).toContain('已经有合同')
  })

  it('缺少项目或报价：拒绝，不落库', async () => {
    await expect(
      beforeChange({
        data: { ...draftDoc(), project: null },
        operation: 'create',
        req: req(),
      }),
    ).rejects.toMatchObject({ message: '合同需要关联项目和报价' })
  })
})

describe('合同编号与删除', () => {
  it('留空编号时自动生成当天流水号（取已有最大号 + 1）', async () => {
    const find = vi.fn(async () => ({
      docs: [{ number: 'HT20261030-01' }, { number: 'HT20261030-07' }, { number: 'x' }],
    }))
    const out = await beforeValidate({
      data: { number: '' },
      operation: 'create',
      req: req({ find }),
    })
    expect(out.number).toMatch(/^HT\d{8}-08$/)
  })

  it('已签订的合同不能删除', async () => {
    const error = await rejectionOf(beforeDelete, {
      id: 'c-1',
      req: req({ findByID: vi.fn(async () => ({ status: 'signed', project: 'p-1' })) }),
    })
    expect(error.status).toBe(403)
    expect(error.message).toContain('撤销签订')
  })
})

async function rejectionOf(hook: Hook, args: Record<string, unknown>): Promise<APIError> {
  try {
    await hook(args)
  } catch (error) {
    if (error instanceof APIError) return error
    throw error
  }
  throw new Error('期望 hook 抛错，但它通过了')
}
