import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// vision.ts 会连带引入 Payload / sharp，单测只关心纯排序与判定逻辑，按需挡掉运行时依赖。
vi.mock('@/lib/payload', () => ({ getPayloadClient: vi.fn(async () => ({})) }))
vi.mock('@/lib/cached-data', () => ({ getCompanyInfo: vi.fn(async () => null) }))
vi.mock('sharp', () => ({ default: vi.fn() }))

import type { AiModelConfig } from './templates'
import {
  isHeavyThinkingVisionModel,
  isReasoningOnlyModel,
  pickPreferredVisionModel,
  rankVisionModels,
  visionScore,
} from './vision'

const model = (over: Partial<AiModelConfig> & { id: string }): AiModelConfig => ({
  name: over.id,
  provider: 'test',
  channelId: 'dashscope',
  tag: '',
  cost: 1,
  description: '',
  apiModel: over.id,
  baseUrl: '',
  apiKeyEnv: 'DASHSCOPE_API_KEY',
  minTier: 'free',
  tierBadge: 'Go',
  enabled: true,
  isDefault: false,
  ...over,
})

// rankVisionModels 会过滤掉没有密钥的模型，测试里统一给一个假 key
beforeEach(() => {
  process.env.DASHSCOPE_API_KEY = 'test-key'
})

afterEach(() => {
  delete process.env.DASHSCOPE_API_KEY
})

describe('visionScore', () => {
  it('qwen4 被识别为视觉模型，且排在 qwen3.8-max 之前', () => {
    const qwen4 = visionScore(model({ id: 'qwen4-max-preview' }))
    const qwen38 = visionScore(model({ id: 'qwen3.8-max', apiModel: 'qwen3.8-max' }))

    // 回归：VISION_MODEL_RE 曾经只匹配 qwen-?3\.[5-9]，qwen4 恒为 -1（不属于视觉模型）
    expect(qwen4).toBeGreaterThan(0)
    expect(qwen4).toBeGreaterThan(qwen38)
  })

  it('非视觉模型返回 -1', () => {
    expect(visionScore(model({ id: 'deepseek-chat' }))).toBe(-1)
  })
})

describe('rankVisionModels', () => {
  it('只保留已启用、可识图、有密钥的模型，并按能力降序', () => {
    const ranked = rankVisionModels([
      model({ id: 'qwen3.8-flash' }),
      model({ id: 'qwen4-max-preview' }),
      model({ id: 'qwen3.8-max', apiModel: 'qwen3.8-max' }),
      model({ id: 'deepseek-chat' }), // 非视觉
      model({ id: 'qwen4-disabled', enabled: false }), // 已停用
    ])

    expect(ranked.map((m) => m.id)).toEqual(['qwen4-max-preview', 'qwen3.8-max', 'qwen3.8-flash'])
  })

  it('没有密钥的视觉模型被排除', () => {
    const saved = process.env.DASHSCOPE_API_KEY
    delete process.env.DASHSCOPE_API_KEY
    try {
      expect(rankVisionModels([model({ id: 'qwen4-max-preview' })])).toEqual([])
    } finally {
      if (saved !== undefined) process.env.DASHSCOPE_API_KEY = saved
    }
  })
})

describe('pickPreferredVisionModel', () => {
  it('即使 qwen4 评分更高，两轮识图仍优先 qwen3.8-flash（owner 2026-11-14 决定）', () => {
    const ranked = rankVisionModels([
      model({ id: 'qwen4-max-preview' }),
      model({ id: 'qwen3.8-flash' }),
    ])
    expect(ranked[0].id).toBe('qwen4-max-preview')
    expect(pickPreferredVisionModel(ranked)?.id).toBe('qwen3.8-flash')
  })

  it('没有 flash 时退回排序第一个', () => {
    const ranked = rankVisionModels([
      model({ id: 'qwen4-max-preview' }),
      model({ id: 'qwen3.8-max', apiModel: 'qwen3.8-max' }),
    ])
    expect(pickPreferredVisionModel(ranked)?.id).toBe('qwen4-max-preview')
  })

  it('空列表返回 null', () => {
    expect(pickPreferredVisionModel([])).toBeNull()
  })
})

describe('isHeavyThinkingVisionModel', () => {
  it('qwen4 / qvq / qwq 需要更大的输出预算', () => {
    expect(isHeavyThinkingVisionModel(model({ id: 'qwen4-max-preview' }))).toBe(true)
    expect(isHeavyThinkingVisionModel(model({ id: 'qvq-max' }))).toBe(true)
    expect(isHeavyThinkingVisionModel(model({ id: 'qwq-plus' }))).toBe(true)
  })

  it('普通视觉模型和 flash 不算', () => {
    expect(isHeavyThinkingVisionModel(model({ id: 'qwen3.8-flash' }))).toBe(false)
    expect(isHeavyThinkingVisionModel(model({ id: 'qwen-vl-max' }))).toBe(false)
  })
})

describe('isReasoningOnlyModel', () => {
  it('标了 reasoning 的模型一律视为推理型', () => {
    expect(isReasoningOnlyModel(model({ id: 'whatever', reasoning: true }))).toBe(true)
  })
})

describe('Auto 路由与视觉排序一致', () => {
  it('scene=vision 时 qwen4 同样排在 qwen3.8 之前', async () => {
    const { rankModelsForScene } = await import('./server')
    const ranked = rankModelsForScene(
      [
        model({ id: 'qwen3.8-max', apiModel: 'qwen3.8-max' }),
        model({ id: 'qwen3.8-flash' }),
        model({ id: 'qwen4-max-preview' }),
      ],
      'vision',
    )
    expect(ranked[0]?.id).toBe('qwen4-max-preview')
  })
})
