import { describe, expect, it } from 'vitest'

import {
  applyQuoteItemEdits,
  quoteTotals,
  yuan,
  quoteStatusLabel,
  quoteStatusVariant,
} from './quotes'

describe('quoteTotals', () => {
  it('按行合计：单价 × 数量 + 费用，再减去优惠', () => {
    expect(quoteTotals([{ price: 100, quantity: 2 }], [{ amount: 50 }], 30)).toEqual({
      productTotal: 200,
      feeTotal: 50,
      total: 220,
    })
  })

  it('金额四舍五入到分，避免浮点误差外泄', () => {
    // 0.1 * 3 在二进制浮点里是 0.30000000000000004，必须收敛成 0.3
    expect(quoteTotals([{ price: 0.1, quantity: 3 }])).toEqual({
      productTotal: 0.3,
      feeTotal: 0,
      total: 0.3,
    })
    expect(quoteTotals([{ price: 33.335, quantity: 1 }], [{ amount: 0.005 }])).toEqual({
      productTotal: 33.34,
      feeTotal: 0.01,
      total: 33.35,
    })
  })

  it('不传参数时全为 0', () => {
    expect(quoteTotals()).toEqual({ productTotal: 0, feeTotal: 0, total: 0 })
    expect(quoteTotals([], [])).toEqual({ productTotal: 0, feeTotal: 0, total: 0 })
  })

  it('price / quantity / amount 为 null 或 undefined 时按 0 计', () => {
    expect(quoteTotals([{ price: null, quantity: null }, {}], [{}, { amount: null }])).toEqual({
      productTotal: 0,
      feeTotal: 0,
      total: 0,
    })
    // undefined 数量 → 该项不计金额（不是按 1 计）
    expect(quoteTotals([{ price: 99 }]).productTotal).toBe(0)
  })

  it('总额被夹在 0 以上：优惠大于总额时结果是 0 而不是负数', () => {
    expect(quoteTotals([{ price: 100, quantity: 1 }], [], 500).total).toBe(0)
    expect(quoteTotals([{ price: 100, quantity: 1 }], [], 100).total).toBe(0)
  })

  it('discount 为 NaN / undefined 时按 0 处理，不影响总额', () => {
    // `discount || 0` 把 NaN、undefined、0 一并归零
    expect(quoteTotals([{ price: 100, quantity: 1 }], [], NaN).total).toBe(100)
    expect(quoteTotals([{ price: 100, quantity: 1 }], [], undefined).total).toBe(100)
  })

  it('负数优惠按无优惠处理，不会变相加价', () => {
    expect(quoteTotals([{ price: 100, quantity: 1 }], [], -50).total).toBe(100)
  })
})

describe('yuan', () => {
  it('格式化为带千分位、固定两位小数的金额', () => {
    expect(yuan(1234.5)).toBe('¥1,234.50')
    expect(yuan(0)).toBe('¥0.00')
    expect(yuan(1234567.891)).toBe('¥1,234,567.89')
  })

  it('null / undefined 显示为 ¥0.00', () => {
    expect(yuan(null)).toBe('¥0.00')
    expect(yuan(undefined)).toBe('¥0.00')
  })

  it('负数保留符号', () => {
    expect(yuan(-5)).toBe('¥-5.00')
  })

  it('NaN / Infinity 落 0，不输出脏金额', () => {
    expect(yuan(NaN)).toBe('¥0.00')
    expect(yuan(Infinity)).toBe('¥0.00')
    expect(yuan(-Infinity)).toBe('¥0.00')
  })
})

describe('报价状态取值', () => {
  it('徽章样式：accepted → success，sent → warning，其余 → outline', () => {
    expect(quoteStatusVariant('accepted')).toBe('success')
    expect(quoteStatusVariant('sent')).toBe('warning')
    expect(quoteStatusVariant('draft')).toBe('neutral')
    expect(quoteStatusVariant(undefined)).toBe('neutral')
    expect(quoteStatusVariant(null)).toBe('neutral')
  })

  it('标签未知时回落到「草稿」', () => {
    expect(quoteStatusLabel('accepted')).toBe('已确认')
    expect(quoteStatusLabel('sent')).toBe('已发送')
    expect(quoteStatusLabel('bogus')).toBe('草稿')
    expect(quoteStatusLabel(undefined)).toBe('草稿')
  })
})

// 报价明细的「局部修改」合并：AI 只提交动过的行，其余行必须原样保留。
describe('applyQuoteItemEdits', () => {
  const row = (
    id: string,
    name: string,
    price: number,
    quantity: number,
    product: string | null = null,
  ) => ({ id, name, price, quantity, product, deviceType: 'switch-3' })

  it('改一行的数量：其余行原样保留，合计按明细重算', () => {
    const stored = [row('r1', '客厅灯', 100, 2), row('r2', '卧室灯', 50, 1)]
    const r = applyQuoteItemEdits(stored, [{ id: 'r1', quantity: 3 }])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // 未提到的 r2 一字不改
    expect(r.items).toEqual([row('r1', '客厅灯', 100, 3), row('r2', '卧室灯', 50, 1)])
    // 合计由明细重算：100*3 + 50 = 350
    expect(quoteTotals(r.items).total).toBe(350)
  })

  it('换型号：只覆盖传入字段，其余行不动', () => {
    const stored = [row('r1', '旧灯', 100, 2, 'p1'), row('r2', '卧室灯', 50, 1, null)]
    const r = applyQuoteItemEdits(stored, [{ id: 'r1', productId: 'p2', name: '新灯' }])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items[0]).toMatchObject({
      id: 'r1',
      product: 'p2',
      name: '新灯',
      price: 100,
      quantity: 2,
    })
    expect(r.items[1]).toEqual(row('r2', '卧室灯', 50, 1, null))
  })

  it('删行只删指定 id，其余行保留', () => {
    const stored = [row('r1', '客厅灯', 100, 2), row('r2', '卧室灯', 50, 1)]
    const r = applyQuoteItemEdits(stored, [], ['r2'])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items.map((x) => x.id)).toEqual(['r1'])
    expect(quoteTotals(r.items).total).toBe(200)
  })

  it('不带 id 的条目作为新行追加，未提及的行不受影响', () => {
    const stored = [row('r1', '客厅灯', 100, 2)]
    const r = applyQuoteItemEdits(stored, [{ name: '新灯', price: 10, quantity: 3 }])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items).toHaveLength(2)
    expect(r.items[1]).toMatchObject({ name: '新灯', price: 10, quantity: 3 })
    expect(r.items[0]).toEqual(row('r1', '客厅灯', 100, 2))
    expect(quoteTotals(r.items).total).toBe(230)
  })

  it('空修改等于原样返回（不丢行）', () => {
    const stored = [row('r1', 'a', 1, 1), row('r2', 'b', 2, 2)]
    const r = applyQuoteItemEdits(stored, [])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.items).toEqual(stored)
  })

  it('改不存在的 id 报错，不静默丢行', () => {
    const r = applyQuoteItemEdits([row('r1', 'a', 1, 1)], [{ id: 'nope', quantity: 9 }])
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('nope')
  })
})
