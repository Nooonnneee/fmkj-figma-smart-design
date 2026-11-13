import { describe, expect, it, vi } from 'vitest'

// registry → @/lib/payload imports `@payload-config` (a Payload build alias not
// present under vitest). Nothing in this test calls the local API, so stub it.
vi.mock('@/lib/payload', () => ({ getPayloadClient: vi.fn() }))

import { allAiToolSpecs } from '@/plugins/ai-catalog'

import { REGISTERED_AI_TOOLS } from './registry'

/**
 * `REGISTERED_AI_TOOLS` 用 `Boolean(HANDLER_MAP[spec.name])` 过滤工具：
 * 任何声明了 spec 但忘了在 `HANDLER_MAP` 里登记 handler 的插件工具都会被**静默丢弃**。
 * ha-mcp 的 6 个工具就这么丢过一次（导入了 haMcpHandlers 但没 spread 进 HANDLER_MAP）。
 * 这两条断言就是防止再被过滤掉。
 */
describe('REGISTERED_AI_TOOLS', () => {
  it('每个声明的工具 spec 都有执行 handler，不会被 HANDLER_MAP 静默丢弃', () => {
    const registered = new Set(REGISTERED_AI_TOOLS.map((t) => t.spec.name))
    const missing = allAiToolSpecs()
      .map((s) => s.name)
      .filter((name) => !registered.has(name))
    expect(missing).toEqual([])
  })

  it('现场设备（ha-mcp）的 6 个工具都在最终注册表里', () => {
    const names = REGISTERED_AI_TOOLS.map((t) => t.spec.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'ha_get_overview',
        'ha_search_entities',
        'ha_list_areas',
        'ha_get_history',
        'ha_get_system_health',
        'ha_call_service',
      ]),
    )
  })
})
