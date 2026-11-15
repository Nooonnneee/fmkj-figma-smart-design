import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

import { seal } from './ai-channels-crypto'
import { parseRotateArgs, run } from '../../scripts/rotate-ai-channels-key'

/**
 * `scripts/rotate-ai-channels-key.ts` 的可测部分：
 * - 参数解析（`--dry-run`）；
 * - 有失败条目时必须抛错（否则运维会以为升级成功，随后删掉旧钥匙 = 客户密钥永久死掉）；
 * - 缺 PAYLOAD_SECRET 时必须抛错。
 *
 * 脚本是顶层自执行的，但守卫是 `process.argv[1]` 匹配 —— vitest 里 import 不会
 * 触发 main()，所以这里可以安全地只测导出的函数。
 */

const ORIGINAL = {
  PAYLOAD_SECRET: process.env.PAYLOAD_SECRET,
  AI_CHANNELS_KEY_ID: process.env.AI_CHANNELS_KEY_ID,
  AI_CHANNELS_OLD_KEYS: process.env.AI_CHANNELS_OLD_KEYS,
}

function restore(name: keyof typeof ORIGINAL) {
  if (ORIGINAL[name] === undefined) delete process.env[name]
  else process.env[name] = ORIGINAL[name]
}

beforeEach(() => {
  delete process.env.AI_CHANNELS_KEY_ID
  delete process.env.AI_CHANNELS_OLD_KEYS
})
afterEach(() => {
  restore('PAYLOAD_SECRET')
  restore('AI_CHANNELS_KEY_ID')
  restore('AI_CHANNELS_OLD_KEYS')
})

/** 只记录日志的假 payload（run 只用到 logger + find/update）。 */
function fakePayload(docs: Record<string, unknown>[] = []) {
  const lines: string[] = []
  const errors: string[] = []
  const payload = {
    logger: {
      info: (msg: string) => lines.push(msg),
      error: (msg: string) => errors.push(msg),
    },
    async find() {
      return { docs: structuredClone(docs), hasNextPage: false, totalPages: 1 }
    },
    async findByID({ id }: { id: string }) {
      return structuredClone(docs.find((d) => (d as { id: string }).id === id))
    },
    async update() {
      return {}
    },
  }
  return { payload: payload as unknown as Payload, logs: lines, errors }
}

describe('parseRotateArgs', () => {
  it('识别 --dry-run', () => {
    expect(parseRotateArgs(['--dry-run'])).toEqual({ dryRun: true })
    expect(parseRotateArgs([])).toEqual({ dryRun: false })
    expect(parseRotateArgs(['--other'])).toEqual({ dryRun: false })
  })
})

describe('run', () => {
  it('缺 PAYLOAD_SECRET → 抛错（绝不默默跑一趟什么都没做）', async () => {
    delete process.env.PAYLOAD_SECRET
    const { payload } = fakePayload()
    await expect(run(payload, { dryRun: true })).rejects.toThrow(/PAYLOAD_SECRET/)
  })

  it('全部升级成功 → 返回统计，不抛错', async () => {
    const oldSecret = 'old-secret-for-script-test-0001'
    process.env.PAYLOAD_SECRET = oldSecret
    const oldCipher = seal('sk-script-success')

    process.env.PAYLOAD_SECRET = 'new-secret-for-script-test-0002'
    process.env.AI_CHANNELS_KEY_ID = 'k2'
    process.env.AI_CHANNELS_OLD_KEYS = JSON.stringify({ k1: oldSecret })

    const { payload, logs } = fakePayload([
      {
        id: 'u1',
        companyProfile: {
          aiChannels: [
            {
              key: 'c1',
              label: 'C1',
              baseUrl: 'https://api.example.com/v1',
              apiKeyCipher: oldCipher,
              models: [],
              enabled: true,
            },
          ],
        },
      },
    ])
    const summary = await run(payload, { dryRun: false })
    expect(summary.upgraded).toBe(1)
    expect(summary.failed).toBe(0)
    expect(logs.join('\n')).toContain('升级=1')
  })

  it('有失败条目 → **必须抛错**（旧钥匙缺代次时不能静默成功）', async () => {
    const oldSecret = 'old-secret-for-script-test-0001'
    process.env.PAYLOAD_SECRET = oldSecret
    const oldCipher = seal('sk-script-failure')

    process.env.PAYLOAD_SECRET = 'new-secret-for-script-test-0002'
    process.env.AI_CHANNELS_KEY_ID = 'k2'
    // 故意不给 k1 的旧钥匙
    delete process.env.AI_CHANNELS_OLD_KEYS

    const { payload, errors } = fakePayload([
      {
        id: 'u1',
        companyProfile: {
          aiChannels: [
            {
              key: 'c1',
              label: 'C1',
              baseUrl: 'https://api.example.com/v1',
              apiKeyCipher: oldCipher,
              models: [],
              enabled: true,
            },
          ],
        },
      },
    ])
    await expect(run(payload, { dryRun: false })).rejects.toThrow(/1 条密文无法重加密/)
    expect(errors.join('\n')).toContain('AI_CHANNELS_OLD_KEYS')
  })

  it('dry run：统计照返回，但不写库', async () => {
    const oldSecret = 'old-secret-for-script-test-0001'
    process.env.PAYLOAD_SECRET = oldSecret
    const oldCipher = seal('sk-script-dry')

    process.env.PAYLOAD_SECRET = 'new-secret-for-script-test-0002'
    process.env.AI_CHANNELS_KEY_ID = 'k2'
    process.env.AI_CHANNELS_OLD_KEYS = JSON.stringify({ k1: oldSecret })

    const update = vi.fn(async () => ({}))
    const { payload } = fakePayload([
      {
        id: 'u1',
        companyProfile: {
          aiChannels: [
            {
              key: 'c1',
              label: 'C1',
              baseUrl: 'https://api.example.com/v1',
              apiKeyCipher: oldCipher,
              models: [],
              enabled: true,
            },
          ],
        },
      },
    ])
    ;(payload as unknown as { update: typeof update }).update = update
    const summary = await run(payload, { dryRun: true })
    expect(summary.upgraded).toBe(1)
    expect(summary.usersUpdated).toBe(1) // 待更新
    expect(update).not.toHaveBeenCalled()
  })
})
