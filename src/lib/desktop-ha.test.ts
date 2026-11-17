import { describe, expect, it } from 'vitest'

import { callHaService, type DesktopHaBridge } from './desktop-ha'

/** 记录是否真的打到桥；用于断言页面侧白名单先行拦截。 */
function fakeBridge() {
  let calls = 0
  const bridge: DesktopHaBridge = {
    available: async () => true,
    status: async () => ({ configured: true, baseUrl: null, connected: true }),
    discover: async () => [],
    configure: async () => ({ ok: true }),
    clear: async () => ({ ok: true as const }),
    getStates: async () => [],
    callService: async () => {
      calls += 1
      return { ok: true as const }
    },
  }
  return { bridge, callCount: () => calls }
}

describe('callHaService 白名单', () => {
  it('domain 不在白名单时页面侧直接拒绝，不打到桥', async () => {
    const { bridge, callCount } = fakeBridge()

    const result = await callHaService(
      { domain: 'script', service: 'turn_on', entityId: 'light.living_room' },
      bridge,
    )

    expect(result.ok).toBe(false)
    expect(result.error).toContain('不支持的设备类型')
    expect(callCount()).toBe(0)
  })

  it('service 不在白名单时页面侧直接拒绝，不打到桥', async () => {
    const { bridge, callCount } = fakeBridge()

    const result = await callHaService(
      { domain: 'light', service: 'execute_script', entityId: 'light.living_room' },
      bridge,
    )

    expect(result.ok).toBe(false)
    expect(result.error).toContain('不支持的操作')
    expect(callCount()).toBe(0)
  })
})
