import { beforeEach, describe, expect, it, vi } from 'vitest'

// registry → @/lib/payload imports `@payload-config` (a Payload build alias not
// present under vitest). Nothing here calls the real local API; tests set the
// return value per case.
const mocks = vi.hoisted(() => ({ getPayloadClient: vi.fn() }))
vi.mock('@/lib/payload', () => ({ getPayloadClient: mocks.getPayloadClient }))

import { allAiToolSpecs } from '@/plugins/ai-catalog'
import type { AiTool, ToolContext } from './tools/context'

import { REGISTERED_AI_TOOLS, runTool } from './registry'

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

/** 用真实 spec，但把执行体换成 spy，只测守卫。 */
function toolFor(name: string) {
  const spec = allAiToolSpecs().find((s) => s.name === name)
  if (!spec) throw new Error(`no spec ${name}`)
  const run = vi.fn(async () => ({ result: { ok: true }, summary: 'done' }))
  return {
    tool: {
      pluginId: spec.pluginId,
      pluginName: spec.title,
      spec,
      definition: {},
      run,
    } as unknown as AiTool,
    run,
  }
}

const ctx = (userId: string, projectId: string | null) =>
  ({ user: { id: userId }, projectId, project: null }) as unknown as ToolContext

const call = (name: string) => ({
  id: 'c1',
  type: 'function' as const,
  function: { name, arguments: '{}' },
})

const READONLY_PROJECT = {
  status: 'active',
  owner: { id: 'someone-else' },
  collaborators: [{ user: { id: 'u1' }, role: 'read' }],
}
const ARCHIVED_PROJECT = { status: 'archived', owner: { id: 'u1' }, collaborators: [] }

function mockProject(project: unknown) {
  mocks.getPayloadClient.mockResolvedValue({
    findByID: vi.fn(async () => project),
  })
}

/**
 * 守卫 bug：workspace 级的 create_project 没有 projectArg，过去会拿 ctx.projectId
 * （用户当前停留的项目）去跑 canEditProject，于是用户停在只读协作 / 已归档项目里时
 * 「新建一个项目」被误拦。workspace 级工具不修改已有项目，不应受该项目守卫约束。
 */
describe('runTool 的项目守卫', () => {
  beforeEach(() => {
    mocks.getPayloadClient.mockReset()
  })

  it('create_project 在当前项目为只读协作时仍能通过守卫', async () => {
    mockProject(READONLY_PROJECT)
    const { tool, run } = toolFor('create_project')

    const r = await runTool([tool], call('create_project'), ctx('u1', 'proj-readonly'))

    expect(run).toHaveBeenCalledTimes(1)
    expect(r.summary).toBe('done')
  })

  it('create_project 在当前项目已归档时仍能通过守卫', async () => {
    mockProject(ARCHIVED_PROJECT)
    const { tool, run } = toolFor('create_project')

    const r = await runTool([tool], call('create_project'), ctx('u1', 'proj-archived'))

    expect(run).toHaveBeenCalledTimes(1)
    expect(r.summary).toBe('done')
  })

  it('对照：project 级写工具在只读协作项目下仍被 canEditProject 挡住', async () => {
    mockProject(READONLY_PROJECT)
    const { tool, run } = toolFor('add_floor_sheet')

    const r = await runTool([tool], call('add_floor_sheet'), ctx('u1', 'proj-readonly'))

    expect(run).not.toHaveBeenCalled()
    expect(r.summary).toBe('仅查看权限，无法修改')
  })

  it('对照：project 级写工具在归档项目下仍被挡住', async () => {
    mockProject(ARCHIVED_PROJECT)
    const { tool, run } = toolFor('add_floor_sheet')

    const r = await runTool([tool], call('add_floor_sheet'), ctx('u1', 'proj-archived'))

    expect(run).not.toHaveBeenCalled()
    expect(r.summary).toBe('项目已归档')
  })
})
