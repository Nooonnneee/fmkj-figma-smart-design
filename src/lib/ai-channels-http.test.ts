import { describe, expect, it } from 'vitest'

import {
  channelNotFoundResponse,
  decodeChannelKeyParam,
  handleDeleteChannel,
  handleUpdateChannel,
} from './ai-channels-http'

/**
 * 复核问题 1 的回归：畸形百分号编码的 `:key` 曾经让 `decodeURIComponent` 抛
 * `URIError`，而调用在 `toResponse` 之外 → 500 + 非 JSON。现在一律按「渠道不存在」404。
 *
 * 真实 HTTP 证据（`next start` + 真实会话 Cookie）不在单测里；这一层只锁住纯函数行为。
 */
describe('decodeChannelKeyParam：畸形编码不抛错', () => {
  it('非法编码返回 null（PATCH/DELETE 的 %E0%A4%A、/test 的 %FF）', () => {
    expect(decodeChannelKeyParam('%E0%A4%A')).toBeNull()
    expect(decodeChannelKeyParam('%FF')).toBeNull()
    expect(decodeChannelKeyParam('%')).toBeNull()
  })

  it('正常与合法编码照常解出', () => {
    expect(decodeChannelKeyParam('c1')).toBe('c1')
    expect(decodeChannelKeyParam('%63%31')).toBe('c1')
  })
})

describe('channelNotFoundResponse：与正常「找不到」逐字节同形', () => {
  it('404 且 body 等于服务层抛出的找不到响应', async () => {
    const fakePayload = {
      async findByID() {
        return { id: 'u1', companyProfile: { aiChannels: [] } }
      },
      async update() {
        throw new Error('不该写库')
      },
    }

    const direct = await handleUpdateChannel({ userId: 'u1', payload: fakePayload }, 'missing', {
      label: 'x',
    })
    const forBadEncoding = channelNotFoundResponse()

    expect(forBadEncoding.status).toBe(404)
    expect(forBadEncoding.status).toBe(direct.status)
    expect(await forBadEncoding.json()).toEqual(await direct.json())
  })

  it('DELETE 的找不到响应也是同一形状', async () => {
    const fakePayload = {
      async findByID() {
        return { id: 'u1', companyProfile: { aiChannels: [] } }
      },
      async update() {
        throw new Error('不该写库')
      },
    }
    const direct = await handleDeleteChannel({ userId: 'u1', payload: fakePayload }, 'missing')
    expect(direct.status).toBe(404)
    expect(await direct.json()).toEqual(await channelNotFoundResponse().json())
  })
})
