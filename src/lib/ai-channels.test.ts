import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  AiChannelInputError,
  createChannel,
  deleteChannel,
  listChannels,
  publicChannel,
  readChannels,
  testChannel,
  updateChannel,
  type AiChannelRow,
} from './ai-channels'
import {
  handleCreateChannel,
  handleDeleteChannel,
  handleListChannels,
  handleTestChannel,
  handleUpdateChannel,
} from './ai-channels-http'
import { open } from './ai-channels-crypto'
import { rateLimitSize, resetRateLimits } from './rate-limit'

const ORIGINAL_SECRET = process.env.PAYLOAD_SECRET

/**
 * 内存里的假 users 表：只实现 findByID / update，行为与 Payload 足够接近：
 * - findByID 返回深拷贝（避免测试里不小心共享引用）；
 * - update 把 companyProfile 合并回文档。
 *
 * 注意：真实 Payload 的 `apiKeyCipher` 有字段级 read 权限，而我们的代码**故意**用
 * `overrideAccess: true` 读库，所以假表直接返回完整文档是正确的模拟。
 */
function fakePayload(seed: Record<string, Record<string, unknown>>) {
  const db = new Map<string, Record<string, unknown>>()
  for (const [id, doc] of Object.entries(seed)) {
    db.set(id, structuredClone(doc))
  }
  const payload = {
    async findByID({ id }: { id: string }) {
      const doc = db.get(String(id))
      if (!doc) throw new Error('not found')
      return structuredClone(doc)
    },
    async update({ id, data }: { id: string; data: Record<string, unknown> }) {
      const doc = db.get(String(id))!
      const next = structuredClone(doc)
      Object.assign(next, structuredClone(data))
      db.set(String(id), next)
      return structuredClone(next)
    },
  }
  return { payload, db }
}

const userDoc = (channels: AiChannelRow[] = []) => ({
  id: 'u1',
  name: '用户一',
  companyProfile: {
    name: '抬头一',
    aiChannels: channels,
  },
})

beforeEach(() => {
  process.env.PAYLOAD_SECRET = 'unit-test-payload-secret-0123456789abcdef'
  resetRateLimits()
})

describe('渠道 CRUD', () => {
  it('新增：密文入库，明文不入库，响应只回 hint', async () => {
    const { payload, db } = fakePayload({ u1: userDoc() })
    const created = await createChannel(payload, 'u1', {
      key: 'my-gw',
      label: '我的网关',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-1234567890abcd',
      models: ['gpt-4o', 'gpt-4o-mini'],
    })
    expect(created).toEqual({
      key: 'my-gw',
      label: '我的网关',
      baseUrl: 'https://api.example.com/v1',
      apiKeyHint: '...abcd',
      models: ['gpt-4o', 'gpt-4o-mini'],
      enabled: true,
      lastCheckedAt: null,
      lastCheckOk: null,
      lastCheckError: null,
    })
    const stored = readChannels(db.get('u1'))
    expect(stored).toHaveLength(1)
    expect(stored[0].apiKeyCipher!.startsWith('v1:')).toBe(true)
    expect(stored[0].apiKeyCipher).not.toContain('sk-1234567890abcd')
    expect(open(stored[0].apiKeyCipher!)).toBe('sk-1234567890abcd')
    // companyProfile 里的其它字段没有被抹掉
    expect((db.get('u1')!.companyProfile as Record<string, unknown>).name).toBe('抬头一')
  })

  it('新增：重复 key 拒绝；同一用户内唯一', async () => {
    const { payload } = fakePayload({ u1: userDoc() })
    const body = {
      key: 'dup',
      label: 'x',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-aaaaaaaa',
    }
    await createChannel(payload, 'u1', body)
    await expect(createChannel(payload, 'u1', body)).rejects.toBeInstanceOf(AiChannelInputError)
    // 不同用户可以用同一个 key（唯一性只在用户内）
    const other = fakePayload({ u2: userDoc() })
    await expect(createChannel(other.payload, 'u2', body)).resolves.toBeTruthy()
  })

  it('修改：key 留空表示不换，原有密文保留', async () => {
    const { payload, db } = fakePayload({ u1: userDoc() })
    await createChannel(payload, 'u1', {
      key: 'c1',
      label: '原名',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-original-key',
    })
    const before = readChannels(db.get('u1'))[0].apiKeyCipher
    const updated = await updateChannel(payload, 'u1', 'c1', {
      label: '新名字',
      baseUrl: 'https://api.example.com/v1',
      apiKey: '',
      models: ['m1'],
      enabled: false,
    })
    expect(updated.label).toBe('新名字')
    expect(updated.enabled).toBe(false)
    expect(readChannels(db.get('u1'))[0].apiKeyCipher).toBe(before)
  })

  it('修改：填了新 key 则重新加密；换地址会清掉旧的检查结果', async () => {
    const { payload, db } = fakePayload({
      u1: userDoc([
        {
          key: 'c1',
          label: 'x',
          baseUrl: 'https://api.example.com/v1',
          apiKeyCipher: 'PLACEHOLDER',
          apiKeyHint: '...wxyz',
          lastCheckedAt: '2026-01-01T00:00:00.000Z',
          lastCheckOk: true,
        },
      ]),
    })
    // 上面塞的是占位密文，update 不会解密它，所以这里只验证「被替换」与检查结果被清空
    const updated = await updateChannel(payload, 'u1', 'c1', {
      label: 'x',
      baseUrl: 'https://api2.example.com/v1',
      apiKey: '',
    })
    expect(updated.lastCheckOk).toBeNull()
    const stored = readChannels(db.get('u1'))[0]
    expect(stored.lastCheckedAt).toBeNull()
    expect(stored.apiKeyCipher).toBe('PLACEHOLDER') // 没换 key 就不动密文
  })

  it('删除：只删自己的那一条', async () => {
    const { payload, db } = fakePayload({ u1: userDoc() })
    await createChannel(payload, 'u1', {
      key: 'a',
      label: 'A',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-aaaaaaaa',
    })
    await createChannel(payload, 'u1', {
      key: 'b',
      label: 'B',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-bbbbbbbb',
    })
    await deleteChannel(payload, 'u1', 'a')
    expect(readChannels(db.get('u1')).map((c) => c.key)).toEqual(['b'])
    await expect(deleteChannel(payload, 'u1', 'a')).rejects.toMatchObject({ status: 404 })
  })

  it('列表：只返回可见字段，且不含密文', async () => {
    const { payload } = fakePayload({ u1: userDoc() })
    await createChannel(payload, 'u1', {
      key: 'c1',
      label: 'C1',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-very-secret-key',
    })
    const list = await listChannels(payload, 'u1')
    expect(list).toHaveLength(1)
    expect(Object.keys(list[0]).sort()).toEqual(
      [
        'apiKeyHint',
        'baseUrl',
        'enabled',
        'key',
        'label',
        'lastCheckError',
        'lastCheckOk',
        'lastCheckedAt',
        'models',
      ].sort(),
    )
    expect(JSON.stringify(list)).not.toContain('sk-very-secret-key')
  })

  it('入参白名单：请求体里的 userId / lastCheckOk 被丢弃', async () => {
    const { payload, db } = fakePayload({ u1: userDoc(), u2: userDoc() })
    await createChannel(payload, 'u1', {
      key: 'c1',
      label: 'C1',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-aaaaaaaa',
      // 攻击者试图伪造检查结果 / 写到别的用户
      userId: 'u2',
      lastCheckOk: true,
      lastCheckedAt: '2020-01-01T00:00:00.000Z',
    } as never)
    expect(readChannels(db.get('u1'))[0].lastCheckOk).toBeUndefined()
    expect(readChannels(db.get('u2'))).toHaveLength(0)
  })
})

describe('复核补的回归：局部更新、类型闸、长度闸', () => {
  const seeded = async () => {
    const fake = fakePayload({ u1: userDoc() })
    await createChannel(fake.payload, 'u1', {
      key: 'c1',
      label: '原名',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-original-key-1234',
      models: ['m1', 'm2', 'm3'],
    })
    return fake
  }

  it('PATCH 只改 label：已存的模型列表**不能被清空**', async () => {
    const { payload, db } = await seeded()
    const updated = await updateChannel(payload, 'u1', 'c1', { label: '新名字' })
    expect(updated.models).toEqual(['m1', 'm2', 'm3'])
    expect(readChannels(db.get('u1'))[0].models).toEqual(['m1', 'm2', 'm3'])
  })

  it('PATCH 显式传 models: [] 才是清空', async () => {
    const { payload } = await seeded()
    const updated = await updateChannel(payload, 'u1', 'c1', { models: [] })
    expect(updated.models).toEqual([])
  })

  it('PATCH 不带 baseUrl 也可（沿用原值），不会 400', async () => {
    const { payload } = await seeded()
    const updated = await updateChannel(payload, 'u1', 'c1', { label: '只改名字' })
    expect(updated.baseUrl).toBe('https://api.example.com/v1')
  })

  it('PATCH baseUrl: "" 保留原值（旧前端用空串表示不修改）', async () => {
    const { payload, db } = await seeded()
    const updated = await updateChannel(payload, 'u1', 'c1', { baseUrl: '' })
    expect(updated.baseUrl).toBe('https://api.example.com/v1')
    expect(readChannels(db.get('u1'))[0].baseUrl).toBe('https://api.example.com/v1')
  })

  it('PATCH label: "" → 400「请填写渠道显示名」，原值不变', async () => {
    const { payload, db } = await seeded()
    await expect(updateChannel(payload, 'u1', 'c1', { label: '' })).rejects.toMatchObject({
      status: 400,
      message: '请填写渠道显示名',
    })
    expect(readChannels(db.get('u1'))[0].label).toBe('原名')
  })

  it('PATCH enabled: "false"（字符串）→ 400，绝不静默当成 true 或回退', async () => {
    const { payload, db } = await seeded()
    await expect(
      updateChannel(payload, 'u1', 'c1', { enabled: 'false' } as never),
    ).rejects.toMatchObject({ status: 400 })
    // 原值没被动过
    expect(readChannels(db.get('u1'))[0].enabled).toBe(true)
  })

  it('PATCH enabled: false（真布尔）生效', async () => {
    const { payload } = await seeded()
    expect((await updateChannel(payload, 'u1', 'c1', { enabled: false })).enabled).toBe(false)
  })

  it('CREATE enabled: "false"（字符串）→ 400', async () => {
    const { payload } = fakePayload({ u1: userDoc() })
    await expect(
      createChannel(payload, 'u1', {
        key: 'c1',
        label: 'C1',
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'sk-abcdefgh',
        enabled: 'false',
      } as never),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('models 传字符串 → 400（否则会被当成空数组清空）', async () => {
    const { payload } = await seeded()
    await expect(
      updateChannel(payload, 'u1', 'c1', { models: 'm1' } as never),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('label 超 60 字 → 400，不静默截断（与集合层 maxLength 一致）', async () => {
    const { payload, db } = await seeded()
    await expect(
      updateChannel(payload, 'u1', 'c1', { label: 'x'.repeat(61) }),
    ).rejects.toMatchObject({ status: 400 })
    expect(readChannels(db.get('u1'))[0].label).toBe('原名')
    await expect(
      createChannel(payload, 'u1', {
        key: 'c2',
        label: 'y'.repeat(61),
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'sk-abcdefgh',
      }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('baseUrl 超 300 字 → 400，不落库（overrideAccess 写库不受 schema maxLength 约束）', async () => {
    const { payload, db } = await seeded()
    // 构造一个「合法但很长」的地址：主机名够长、路径也够长
    const longUrl = `https://${'a'.repeat(60)}.example.com/${'p'.repeat(250)}`
    expect(longUrl.length).toBeGreaterThan(300)
    await expect(updateChannel(payload, 'u1', 'c1', { baseUrl: longUrl })).rejects.toMatchObject({
      status: 400,
    })
    expect(readChannels(db.get('u1'))[0].baseUrl).toBe('https://api.example.com/v1')
  })

  it('渠道数量上限：第 21 个 400', async () => {
    const { payload } = fakePayload({ u1: userDoc() })
    for (let i = 0; i < 20; i += 1) {
      await createChannel(payload, 'u1', {
        key: `c${i}`,
        label: `C${i}`,
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'sk-abcdefgh',
      })
    }
    await expect(
      createChannel(payload, 'u1', {
        key: 'c20',
        label: 'C20',
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'sk-abcdefgh',
      }),
    ).rejects.toMatchObject({ status: 400 })
  })
})

describe('/test：格式不合法的 :key 不消耗限流配额', () => {
  it('8KB 的垃圾 key：404 且限流表里一条都不留', async () => {
    const { payload } = fakePayload({ u1: userDoc() })
    const junk = 'x'.repeat(8192)
    for (let i = 0; i < 40; i += 1) {
      await expect(testChannel(payload, 'u1', junk)).rejects.toMatchObject({ status: 404 })
    }
    // 关键性质：**限流 Map 没被垃圾 key 污染**。
    // 只看 404 不够 —— 把 consumeRateLimit 挪到格式闸之前，40 次垃圾请求照样 404，
    // 但会留下 2 个桶（每渠道 + 每用户），攻击者拿 8KB 的 key 就能做内存放大。
    expect(rateLimitSize()).toBe(0)
  })

  it('垃圾 key 打满 40 次之后，真实渠道的配额一点没被吃掉', async () => {
    const { payload } = fakePayload({ u1: userDoc() })
    await createChannel(payload, 'u1', {
      key: 'real',
      label: '真实渠道',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-real-quota',
    })
    const junk = 'z'.repeat(8192)
    for (let i = 0; i < 40; i += 1) {
      await expect(testChannel(payload, 'u1', junk)).rejects.toMatchObject({ status: 404 })
    }
    const okFetch = async () => ({ ok: true, status: 200, body: '{}' })
    // 每渠道 10 次/分：垃圾请求不该占掉其中任何一次
    for (let i = 0; i < 10; i += 1) {
      await expect(testChannel(payload, 'u1', 'real', okFetch)).resolves.toBeTruthy()
    }
    await expect(testChannel(payload, 'u1', 'real', okFetch)).rejects.toMatchObject({ status: 429 })
  })
})

describe('越权：A 用户操作不到 B 用户的渠道', () => {
  const seed = () => {
    const fake = fakePayload({ A: userDoc(), B: userDoc() })
    return fake
  }

  it('A 改 / 删 / 测 B 的渠道一律 404，且 B 的数据不变', async () => {
    const { payload, db } = seed()
    await createChannel(payload, 'B', {
      key: 'b-only',
      label: 'B 的渠道',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-b-secret',
    })
    const before = structuredClone(db.get('B'))

    await expect(
      updateChannel(payload, 'A', 'b-only', {
        label: '被 A 改了',
        baseUrl: 'https://evil.example.com/v1',
        apiKey: 'sk-a-injected',
      }),
    ).rejects.toMatchObject({ status: 404 })
    await expect(deleteChannel(payload, 'A', 'b-only')).rejects.toMatchObject({ status: 404 })
    await expect(testChannel(payload, 'A', 'b-only')).rejects.toMatchObject({ status: 404 })

    expect(db.get('B')).toEqual(before)
  })

  ;(it('HTTP 层：请求体里塞 userId=B 也改不到 B（userId 只来自会话）', async () => {
    const { payload, db } = seed()
    await handleCreateChannel(
      { userId: 'B', payload },
      { key: 'b-only', label: 'B 的渠道', baseUrl: 'https://api.example.com/v1', apiKey: 'sk-b' },
    )
    const before = structuredClone(db.get('B'))

    // A 登录，但请求体伪造 userId=B
    const res = await handleCreateChannel({ userId: 'A', payload }, {
      key: 'b-only',
      label: 'A 想覆盖 B',
      baseUrl: 'https://evil.example.com/v1',
      apiKey: 'sk-a',
      userId: 'B',
    } as never)
    // A 自己没这条渠道，会在 A 的数组里新建一条，B 完全不受影响
    expect(res.status).toBe(201)
    expect(db.get('B')).toEqual(before)
    expect(readChannels(db.get('A')).map((c) => c.key)).toEqual(['b-only'])
  }),
    it('HTTP 层：PATCH / DELETE B 的 key → 404，B 不变', async () => {
      const { payload, db } = seed()
      await handleCreateChannel(
        { userId: 'B', payload },
        { key: 'b-only', label: 'B', baseUrl: 'https://api.example.com/v1', apiKey: 'sk-b' },
      )
      const before = structuredClone(db.get('B'))
      const patch = await handleUpdateChannel({ userId: 'A', payload }, 'b-only', {
        label: 'hijack',
        baseUrl: 'https://evil.example.com/v1',
      })
      expect(patch.status).toBe(404)
      const del = await handleDeleteChannel({ userId: 'A', payload }, 'b-only')
      expect(del.status).toBe(404)
      expect(db.get('B')).toEqual(before)
    }))
})

describe('密文绝不出现在任何响应里', () => {
  it('CRUD + 检查的全部响应 JSON 都不含密文与明文', async () => {
    const { payload, db } = fakePayload({ u1: userDoc() })
    const plain = 'sk-super-secret-value-9876'
    const responses: Response[] = []

    responses.push(
      await handleCreateChannel(
        { userId: 'u1', payload },
        { key: 'c1', label: 'C1', baseUrl: 'https://api.example.com/v1', apiKey: plain },
      ),
    )
    const cipher = readChannels(db.get('u1'))[0].apiKeyCipher!
    expect(cipher.length).toBeGreaterThan(0)

    responses.push(await handleListChannels({ userId: 'u1', payload }))
    responses.push(
      await handleUpdateChannel({ userId: 'u1', payload }, 'c1', {
        label: 'C1b',
        baseUrl: 'https://api.example.com/v1',
      }),
    )
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    responses.push(
      await handleTestChannel({ userId: 'u1', payload }, 'c1', async () => ({
        ok: true,
        status: 200,
        body: JSON.stringify({ data: [{ id: 'gpt-4o' }] }),
      })),
    )
    infoSpy.mockRestore()
    responses.push(await handleListChannels({ userId: 'u1', payload }))
    responses.push(await handleDeleteChannel({ userId: 'u1', payload }, 'c1'))

    for (const res of responses) {
      const text = await res.text()
      expect(text).not.toContain(cipher)
      expect(text).not.toContain(plain)
      expect(text).not.toContain('apiKeyCipher')
      // 连密文前缀都不该出现
      expect(text.toLowerCase()).not.toContain('v1:')
    }
  })
})

describe('testChannel：写回 lastCheck* 且日志不含密钥', () => {
  beforeEach(() => {
    process.env.PAYLOAD_SECRET = 'unit-test-payload-secret-0123456789abcdef'
  })

  it('成功：写回 ok=true、模型名，日志不含 key', async () => {
    const { payload, db } = fakePayload({ u1: userDoc() })
    const logSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await createChannel(payload, 'u1', {
      key: 'c1',
      label: 'C1',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-please-dont-log-me',
    })

    const result = await testChannel(payload, 'u1', 'c1', async () => ({
      ok: true,
      status: 200,
      body: JSON.stringify({ data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }] }),
    }))
    expect(result.ok).toBe(true)
    expect(result.models).toEqual(['gpt-4o', 'gpt-4o-mini'])
    const stored = readChannels(db.get('u1'))[0]
    expect(stored.lastCheckOk).toBe(true)
    expect(stored.lastCheckedAt).toBeTruthy()

    const logged = JSON.stringify([...logSpy.mock.calls, ...warnSpy.mock.calls])
    expect(logged).not.toContain('sk-please-dont-log-me')
    expect(logged).not.toContain(readChannels(db.get('u1'))[0].apiKeyCipher)
    logSpy.mockRestore()
    warnSpy.mockRestore()
  })

  it('失败：401 写回可读错误，仍不泄露 key', async () => {
    const { payload, db } = fakePayload({ u1: userDoc() })
    vi.spyOn(console, 'info').mockImplementation(() => {})
    await createChannel(payload, 'u1', {
      key: 'c1',
      label: 'C1',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-bad-key',
    })
    const result = await testChannel(payload, 'u1', 'c1', async () => ({
      ok: false,
      status: 401,
      body: 'unauthorized',
    }))
    expect(result.ok).toBe(false)
    expect(result.error).toBe('密钥无效或没有权限')
    expect(JSON.stringify(result)).not.toContain('sk-bad-key')
    expect(readChannels(db.get('u1'))[0].lastCheckError).toBe('密钥无效或没有权限')
    vi.restoreAllMocks()
  })

  it('限流：同一渠道每分钟最多 10 次', async () => {
    const { payload } = fakePayload({ u1: userDoc() })
    vi.spyOn(console, 'info').mockImplementation(() => {})
    await createChannel(payload, 'u1', {
      key: 'c1',
      label: 'C1',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-rate-limit',
    })
    const okFetch = async () => ({ ok: true, status: 200, body: '{}' })
    for (let i = 0; i < 10; i += 1) {
      await expect(testChannel(payload, 'u1', 'c1', okFetch)).resolves.toBeTruthy()
    }
    await expect(testChannel(payload, 'u1', 'c1', okFetch)).rejects.toMatchObject({ status: 429 })
    vi.restoreAllMocks()
  })

  it('解密失败（换过 secret）显式报错，不静默放过', async () => {
    const { payload, db } = fakePayload({ u1: userDoc() })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await createChannel(payload, 'u1', {
      key: 'c1',
      label: 'C1',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-will-be-unopenable',
    })
    process.env.PAYLOAD_SECRET = 'a-brand-new-secret'
    const result = await testChannel(payload, 'u1', 'c1', async () => ({
      ok: true,
      status: 200,
      body: '{}',
    }))
    expect(result.ok).toBe(false)
    expect(result.error).toContain('无法解密')
    expect(readChannels(db.get('u1'))[0].lastCheckOk).toBe(false)
    vi.restoreAllMocks()
  })
})

describe('publicChannel', () => {
  it('未知字段不会漏出去（只挑白名单字段）', () => {
    const leaky = {
      key: 'k',
      label: 'L',
      baseUrl: 'https://a.example.com',
      apiKeyCipher: 'v1:SECRET',
      userId: 'someone-else',
      id: 'row-1',
    } as never
    const out = publicChannel(leaky)
    expect(JSON.stringify(out)).not.toContain('SECRET')
    expect(JSON.stringify(out)).not.toContain('someone-else')
  })
})
