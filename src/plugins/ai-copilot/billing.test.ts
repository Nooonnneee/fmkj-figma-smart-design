import { describe, expect, it } from 'vitest'

import {
  CREDIT_VALUE_CNY,
  DEFAULT_TOOL_COST,
  UsageLedger,
  UsageMeter,
  estimateTokens,
  isPeakTime,
  type ModelPricing,
} from './billing'

// 北京时间通过 `at + 8h` 再读 UTC 得到；下面这些 UTC 时刻对应：
const MON_0900 = new Date('2026-11-09T01:00:00Z') // 周一 09:00 高峰起点
const MON_1000 = new Date('2026-11-09T02:00:00Z') // 周一 10:00 高峰
const MON_1159 = new Date('2026-11-09T03:59:00Z') // 周一 11:59 高峰末尾
const MON_1200 = new Date('2026-11-09T04:00:00Z') // 周一 12:00 平峰起点
const MON_1400 = new Date('2026-11-09T06:00:00Z') // 周一 14:00 高峰
const MON_1800 = new Date('2026-11-09T10:00:00Z') // 周一 18:00 平峰
const SAT_1000 = new Date('2026-11-14T02:00:00Z') // 周六 10:00 全天平峰
const SUN_1100 = new Date('2026-11-15T03:00:00Z') // 周日 11:00 全天平峰

const pricing: ModelPricing = {
  peak: { input: 1, output: 2, cachedInput: 0.5 },
  offPeak: { input: 0.5, output: 1, cachedInput: 0.25 },
}

const zeroPricing: ModelPricing = {
  peak: { input: 0, output: 0, cachedInput: 0 },
  offPeak: { input: 0, output: 0, cachedInput: 0 },
}

describe('isPeakTime（北京时间工作日 9:00–12:00、14:00–18:00）', () => {
  it('高峰时段边界', () => {
    expect(isPeakTime(MON_0900)).toBe(true)
    expect(isPeakTime(MON_1000)).toBe(true)
    expect(isPeakTime(MON_1159)).toBe(true)
    expect(isPeakTime(MON_1400)).toBe(true)
  })

  it('12:00 与 18:00 起是平峰', () => {
    expect(isPeakTime(MON_1200)).toBe(false)
    expect(isPeakTime(MON_1800)).toBe(false)
  })

  it('周末全天平峰', () => {
    expect(isPeakTime(SAT_1000)).toBe(false)
    expect(isPeakTime(SUN_1100)).toBe(false)
  })
})

describe('基本公式：积分 = ceil(倍率 × 人民币成本 / 0.1 + Σ工具费)，最少 1 分', () => {
  it('按模型三段价格计算，高峰与平峰用不同价格', () => {
    const meter = new UsageMeter()
    meter.add({ prompt_tokens: 1_000_000, completion_tokens: 1_000_000 })

    // 高峰：1M×1 + 1M×2 = 3 元 → 3 / 0.1 = 30
    expect(meter.credits({ cost: 1, pricing }, MON_1000)).toBe(30)
    // 平峰：1M×0.5 + 1M×1 = 1.5 元 → 15
    expect(meter.credits({ cost: 1, pricing }, MON_1200)).toBe(15)
    // 周末：按平峰价 → 15
    expect(meter.credits({ cost: 1, pricing }, SAT_1000)).toBe(15)
  })

  it('倍率乘在成本上', () => {
    const meter = new UsageMeter()
    meter.add({ prompt_tokens: 1_000_000, completion_tokens: 1_000_000 })
    expect(meter.credits({ cost: 2, pricing }, MON_1000)).toBe(60)
  })

  it('零用量也至少 1 分', () => {
    const meter = new UsageMeter()
    expect(meter.credits(1, MON_1000)).toBe(1)
    expect(meter.credits({ cost: 1, pricing }, MON_1000)).toBe(1)
  })

  it('一点点用量不会因为取整变成 0 分', () => {
    const meter = new UsageMeter()
    meter.add({ prompt_tokens: 1 })
    expect(meter.credits(1, MON_1000)).toBe(1)
  })
})

describe('缓存命中价', () => {
  it('命中部分按 cachedInput 计价，未命中部分按 input 计价', () => {
    const meter = new UsageMeter()
    meter.add({ prompt_tokens: 1_000_000, prompt_tokens_details: { cached_tokens: 400_000 } })

    // 未命中 0.6M×1 + 命中 0.4M×0.5 = 0.8 元 → 8
    expect(meter.cachedInputTokens).toBe(400_000)
    expect(meter.credits({ cost: 1, pricing }, MON_1000)).toBe(8)
  })

  it('兼容 DeepSeek 原生 prompt_cache_hit_tokens', () => {
    const meter = new UsageMeter()
    meter.add({ prompt_tokens: 1_000_000, prompt_cache_hit_tokens: 400_000 })
    expect(meter.cachedInputTokens).toBe(400_000)
    expect(meter.credits({ cost: 1, pricing }, MON_1000)).toBe(8)
  })

  it('命中数不会超过输入数', () => {
    const meter = new UsageMeter()
    meter.add({ prompt_tokens: 100, prompt_tokens_details: { cached_tokens: 999 } })
    expect(meter.cachedInputTokens).toBe(100)
  })
})

describe('模型未配价格时回退旧公式', () => {
  it('未传 pricing（直接传倍率）走 每千 token 费率', () => {
    const meter = new UsageMeter()
    meter.add({ prompt_tokens: 100_000, completion_tokens: 100_000 })
    // 100×0.1 + 100×0.5 = 60 分
    expect(meter.credits(1, MON_1000)).toBe(60)
    expect(meter.credits(2, MON_1000)).toBe(120)
  })

  it('pricing 全为 0 时也回退旧公式', () => {
    const meter = new UsageMeter()
    meter.add({ prompt_tokens: 100_000, completion_tokens: 100_000 })
    expect(meter.credits({ cost: 1, pricing: zeroPricing }, MON_1000)).toBe(60)
  })

  it('旧公式忽略缓存命中（按全量输入计价）', () => {
    const meter = new UsageMeter()
    meter.add({ prompt_tokens: 100_000, prompt_tokens_details: { cached_tokens: 90_000 } })
    // 仍按 100k 输入：100×0.1 = 10 分
    expect(meter.credits(1, MON_1000)).toBe(10)
  })
})

describe('工具费', () => {
  it('未登记的工具有默认费用，按次累加', () => {
    const meter = new UsageMeter()
    meter.tool('__missing_tool__')
    meter.tool('__missing_tool__')
    expect(meter.toolCost()).toBe(DEFAULT_TOOL_COST * 2)
    expect(meter.credits(1, MON_1000)).toBe(1) // 1.0 → 1

    meter.tool('__missing_tool__')
    expect(meter.credits(1, MON_1000)).toBe(2) // 1.5 → 2
  })

  it('1 积分 = 0.1 元', () => {
    expect(CREDIT_VALUE_CNY).toBe(0.1)
  })
})

describe('UsageLedger（多模型合计，只向上取整一次）', () => {
  it('两个模型各自折算后合计', () => {
    const ledger = new UsageLedger()
    const cheap: ModelPricing = {
      peak: { input: 0.1, output: 0, cachedInput: 0 },
      offPeak: { input: 0.1, output: 0, cachedInput: 0 },
    }
    ledger.add({ id: 'a', pricing: cheap }, { prompt_tokens: 1_000_000 })
    ledger.add({ id: 'b', pricing: cheap }, { prompt_tokens: 1_000_000 })
    // 每个 0.1 元 → 1 分，合计 2
    expect(ledger.credits(MON_1000)).toBe(2)
  })

  it('同一模型多次调用会累加进同一个 meter', () => {
    const ledger = new UsageLedger()
    ledger.add({ id: 'a', pricing }, { prompt_tokens: 500_000 })
    ledger.add({ id: 'a', pricing }, { prompt_tokens: 500_000 })
    expect(ledger.inputTokens).toBe(1_000_000)
  })

  it('工具费与 token 费一起取整，且至少 1', () => {
    const ledger = new UsageLedger()
    ledger.tool('__missing_tool__')
    expect(ledger.credits(MON_1000)).toBe(1)
  })
})

describe('上下文估算与 add 的边界', () => {
  it('estimateTokens：中文约 0.7 token/字，其他约 4 字符/token', () => {
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens('abcd')).toBe(1)
    expect(estimateTokens('中')).toBe(1)
    expect(estimateTokens('中文')).toBe(2)
  })

  it('没有 usage 时按字符估算，并标记 estimated', () => {
    const meter = new UsageMeter()
    meter.add(null, { input: 'abcd', output: 'abcd' })
    expect(meter.estimated).toBe(1)
    expect(meter.inputTokens).toBe(1)
    expect(meter.outputTokens).toBe(1)
  })

  it('usage 全为 0 时也走估算', () => {
    const meter = new UsageMeter()
    meter.add({ prompt_tokens: 0, completion_tokens: 0 }, { input: 'abcd', output: 'abcd' })
    expect(meter.estimated).toBe(1)
    expect(meter.inputTokens).toBe(1)
  })

  it('负数 token 归零', () => {
    const meter = new UsageMeter()
    meter.add({ prompt_tokens: -5, completion_tokens: -3 })
    expect(meter.inputTokens).toBe(0)
    expect(meter.outputTokens).toBe(0)
  })
})
