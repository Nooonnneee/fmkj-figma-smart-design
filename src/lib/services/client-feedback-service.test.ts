import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getPayloadClient: vi.fn() }))

vi.mock('@/lib/payload', () => ({ getPayloadClient: mocks.getPayloadClient }))
vi.mock('@/lib/app-auth', () => ({ appAuth: {} }))
vi.mock('@/lib/share-link', () => ({ findProjectIdByShareToken: vi.fn() }))

import { createQuoteFromFeedback } from './client-feedback-service'

const user = { id: 'u-1' } as never

beforeEach(() => {
  mocks.getPayloadClient.mockReset()
})

describe('createQuoteFromFeedback：业主意向版报价复制明细', () => {
  it('复制明细时保留产品短名快照', async () => {
    const create = vi.fn(async ({ data }: { data: { items: unknown[] } }) => ({
      ...data,
      id: 'q-new',
    }))
    const payload = {
      findByID: vi.fn(async ({ collection }: { collection: string }) =>
        collection === 'client-feedback'
          ? {
              id: 'f-1',
              quote: 'q-1',
              project: 'p-1',
              createdAt: '2026-11-01T02:00:00.000Z',
              customerName: '林先生',
              deferredItems: [],
              message: null,
            }
          : {
              id: 'q-1',
              title: '全屋智能报价',
              notes: null,
              discount: 0,
              fees: [],
              items: [
                {
                  id: 'row-1',
                  product: 'prod-1',
                  deviceType: 'downlight',
                  image: null,
                  name: '易来智能LED嵌入式防眩筒灯射灯窄边框 T3 智能筒灯 2.0',
                  shortName: '易来 T3 筒灯',
                  sku: 'YL-T3',
                  unit: '个',
                  price: 129,
                  quantity: 2,
                },
              ],
            },
      ),
      create,
      update: vi.fn(async () => ({})),
    }
    mocks.getPayloadClient.mockResolvedValue(payload)

    const r = await createQuoteFromFeedback(user, 'f-1')

    expect(r.ok).toBe(true)
    const data = create.mock.calls[0]![0].data as { items: Record<string, unknown>[] }
    expect(data.items[0]).toMatchObject({
      name: '易来智能LED嵌入式防眩筒灯射灯窄边框 T3 智能筒灯 2.0',
      shortName: '易来 T3 筒灯',
    })
  })
})
