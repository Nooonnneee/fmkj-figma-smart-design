import { beforeEach, describe, expect, it, vi } from 'vitest'

import { quoteTotals } from '@/lib/quotes'

import { coreToolHandlers } from './core-handlers'

/**
 * create_or_update_quote 的「改明细」分支：AI 只提交动过的行，handler 先读全量再合并，
 * 未提到的行必须原样进入写库 payload（不能因为 saveQuoteInput 是全量替换就丢行）。
 * 用 mock 的 payload 断言最终写库的 items；金额由本测试的假 update 按 quoteTotals 重算，
 * 证明写进去的明细确实驱动了合计。
 */
const mocks = vi.hoisted(() => ({
  findByID: vi.fn(),
  update: vi.fn(),
  find: vi.fn(),
  count: vi.fn(),
  getCatalog: vi.fn(),
}))

vi.mock('@/lib/payload', () => ({
  getPayloadClient: vi.fn(async () => mocks),
}))

vi.mock('@/lib/cached-data', () => ({
  getCatalog: mocks.getCatalog,
  getCompanyInfo: vi.fn(async () => ({ quoteNotes: null })),
  resolveMediaUrl: vi.fn((v: unknown) => (typeof v === 'string' ? v : null)),
}))

const storedQuote = () => ({
  id: 'q1',
  title: '报价A',
  status: 'draft',
  discount: 0,
  notes: null,
  fees: [],
  items: [
    {
      id: 'r1',
      product: 'p1',
      deviceType: 'switch-3',
      image: null,
      name: '客厅灯',
      shortName: '旧短名',
      sku: 'S1',
      unit: '个',
      price: 100,
      quantity: 2,
    },
    {
      id: 'r2',
      product: null,
      deviceType: 'switch-3',
      image: null,
      name: '卧室灯',
      sku: 'S2',
      unit: '个',
      price: 50,
      quantity: 1,
    },
  ],
})

const product = (id: string, deviceType: string, price = 88) => ({
  id,
  status: 'active',
  deviceType,
  name: `产品${id}`,
  shortName: `短名${id}`,
  sku: `SKU-${id}`,
  unit: '个',
  price,
  image: null,
})

const ctx = () => ({
  user: { id: 'u1' } as never,
  projectId: 'proj1',
  project: null,
  mutated: false,
})

/** 最近一次 payload.update 的 data */
const lastUpdateData = () =>
  mocks.update.mock.calls.at(-1)?.[0]?.data as { items: unknown[]; total?: number }

beforeEach(() => {
  mocks.findByID.mockReset()
  mocks.update.mockReset()
  mocks.find.mockReset().mockResolvedValue({ docs: [], totalDocs: 0 })
  mocks.count.mockReset().mockResolvedValue({ totalDocs: 0 })
  mocks.getCatalog.mockReset().mockResolvedValue([product('p1', 'switch-3', 100)])
  mocks.findByID.mockResolvedValue(storedQuote())
  // 假集合 hook：按写库的明细重算合计，模拟 Quotes.beforeChange 的行为
  mocks.update.mockImplementation(async ({ data }: { data: never }) => {
    const d = data as { items?: unknown[]; fees?: unknown[]; discount?: number }
    const { total } = quoteTotals(
      (d.items ?? []) as never,
      (d.fees ?? []) as never,
      d.discount ?? 0,
    )
    return { ...(d as object), id: 'q1', total }
  })
})

describe('create_or_update_quote 改明细', () => {
  it('改一行数量 → 其余行原样保留，合计按明细重算', async () => {
    const r = await coreToolHandlers.create_or_update_quote(
      { quoteId: 'q1', items: [{ id: 'r1', quantity: 3 }] },
      ctx(),
    )
    const data = lastUpdateData()
    expect(data.items).toHaveLength(2)
    expect(data.items[0]).toMatchObject({ id: 'r1', name: '客厅灯', price: 100, quantity: 3 })
    // 未提到的 r2 一字未改
    expect(data.items[1]).toMatchObject({
      id: 'r2',
      name: '卧室灯',
      price: 50,
      quantity: 1,
      sku: 'S2',
    })
    expect((r.result as { total: number }).total).toBe(350) // 100*3 + 50
    expect(r.summary).toContain('合计')
  })

  it('AI 换型号 → 短名跟着新产品走，不会保留旧产品短名', async () => {
    mocks.getCatalog.mockResolvedValue([
      product('p1', 'switch-3', 100),
      product('p2', 'switch-3', 88),
    ])
    await coreToolHandlers.create_or_update_quote(
      { quoteId: 'q1', items: [{ id: 'r1', productId: 'p2', name: '新灯' }] },
      ctx(),
    )
    const data = lastUpdateData()
    expect(data.items[0]).toMatchObject({
      id: 'r1',
      product: 'p2',
      name: '新灯',
      // 旧行快照是「旧短名」；换产品后必须取 p2 的短名（AI 不会自己传 shortName）
      shortName: '短名p2',
      deviceType: 'switch-3',
    })
    expect(data.items[1]).toMatchObject({ id: 'r2', name: '卧室灯' })
  })

  it('删除指定行 → 只少那一行', async () => {
    await coreToolHandlers.create_or_update_quote({ quoteId: 'q1', removeItemIds: ['r2'] }, ctx())
    const data = lastUpdateData()
    expect(data.items).toHaveLength(1)
    expect((data.items[0] as { id: string }).id).toBe('r1')
  })

  it('新增行 → 追加且不影响已有行', async () => {
    await coreToolHandlers.create_or_update_quote(
      { quoteId: 'q1', items: [{ name: '新灯', price: 10, quantity: 3 }] },
      ctx(),
    )
    const data = lastUpdateData()
    expect(data.items).toHaveLength(3)
    expect(data.items[2]).toMatchObject({ name: '新灯', price: 10, quantity: 3 })
    expect(data.items[0]).toMatchObject({ id: 'r1', name: '客厅灯' })
  })

  it('id 不存在时报错，不写库（避免静默丢行）', async () => {
    const r = await coreToolHandlers.create_or_update_quote(
      { quoteId: 'q1', items: [{ id: 'missing', quantity: 9 }] },
      ctx(),
    )
    expect((r.result as { error?: string }).error).toContain('missing')
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('改明细不传 quoteId → 明确报错，不误建新报价', async () => {
    const r = await coreToolHandlers.create_or_update_quote(
      { items: [{ id: 'r1', quantity: 3 }] },
      ctx(),
    )
    expect((r.result as { error?: string }).error).toContain('quoteId')
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
