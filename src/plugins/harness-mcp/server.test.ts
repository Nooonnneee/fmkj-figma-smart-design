import { beforeEach, describe, expect, it, vi } from 'vitest'

// REGISTERED_AI_TOOLS 的 import 链会经 @/lib/payload 碰 `@payload-config`（vitest 下不可用）。
// 这里 mock 掉 payload 客户端；跑 runTool 守卫需要 findByID 时按 case 返回。
const mocks = vi.hoisted(() => ({ getPayloadClient: vi.fn() }))
vi.mock('@/lib/payload', () => ({ getPayloadClient: mocks.getPayloadClient }))

// runner 用真实 REGISTERED_AI_TOOLS 做白名单筛选，但把 runTool 换成 spy 以便断言参数与审计。
const runnerMocks = vi.hoisted(() => ({ runTool: vi.fn() }))
vi.mock('@/plugins/ai-copilot/registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/plugins/ai-copilot/registry')>()
  return { ...actual, runTool: runnerMocks.runTool }
})

import { allAiToolSpecs } from '@/plugins/ai-catalog'
import { REGISTERED_AI_TOOLS } from '@/plugins/ai-copilot/registry'

import { setHarnessAuditSink } from './audit'
import { whitelistTools } from './server'
import { RESERVED_PROJECT_ARG, runHarnessTool } from './runner'

describe('whitelistTools 只泻白名单', () => {
  it('白名单内业务工具都在暴露清单里', () => {
    const names = whitelistTools().map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'list_projects',
        'create_project',
        'update_project',
        'add_floor_sheet',
        'setup_rooms_and_points',
        'import_points_json',
        'search_products',
        'get_project_details',
        'create_or_update_quote',
        'create_quote_from_competitor',
        'create_or_update_contract',
      ]),
    )
  })

  it('绝不暴露站点配置 / 生图 / 兑换码 / 积分等越权工具', () => {
    const names = new Set(whitelistTools().map((t) => t.name))
    // 这些是 settings/templates/images/admin 等越权工具；其中部分在 core 里注册但我们不许泻。
    expect(names.has('generate_image')).toBe(false)
    expect(names.has('set_project_defaults')).toBe(false)
    for (const spec of allAiToolSpecs()) {
      if (
        ![
          'settings:write',
          'images:generate',
          'templates:read',
          'smart-home:read',
          'smart-home:write',
          'defaults:write',
          'catalog:write',
        ].some((p) => spec.permissions.includes(p as never))
      ) {
        continue
      }
      expect(names.has(spec.name), `越权工具 ${spec.name} 不应暴露`).toBe(false)
    }
  })

  it('暴露清单里的 mutates 标记来自 spec', () => {
    const map = new Map(whitelistTools().map((t) => [t.name, t]))
    expect(map.get('update_project')!.mutates).toBe(true)
    expect(map.get('add_floor_sheet')!.mutates).toBe(true)
    expect(map.get('list_projects')!.mutates).toBe(false)
    expect(map.get('get_project_details')!.mutates).toBe(false)
  })

  it('冻结当前白名单评估结果：不会突然多泻越权工具', () => {
    const names = whitelistTools()
      .map((t) => t.name)
      .sort()
    // 明确允许的集合（改项目/布点位/改报价/改合同 + 只读支撑）。
    const allowed = new Set([
      'list_projects',
      'create_project',
      'update_project',
      'add_floor_sheet',
      'import_points_json',
      'setup_rooms_and_points',
      'search_products',
      'get_project_details',
      'create_or_update_quote',
      'create_quote_from_competitor',
      'create_or_update_contract',
      'plan_points_with_vision',
    ])
    for (const n of names) expect(allowed.has(n), `未预期暴露：${n}`).toBe(true)
    // 清单里没有白名单外的工具（这是本层不泻全量的直接证据）。
    expect(names).toEqual(Array.from(allowed).sort())
  })

  it('暴露清单与 REGISTERED_AI_TOOLS 中白名单子集一一对应，不凭空造工具', () => {
    const exposed = whitelistTools().map((t) => t.name)
    const registeredNames = new Set(REGISTERED_AI_TOOLS.map((t) => t.spec.name))
    for (const name of exposed) {
      expect(registeredNames.has(name), `工具 ${name} 不在注册表里`).toBe(true)
    }
  })
})

describe('runHarnessTool', () => {
  beforeEach(() => {
    runnerMocks.runTool.mockReset()
    mocks.getPayloadClient.mockReset()
    setHarnessAuditSink(() => {})
  })

  const whiteTool = () => REGISTERED_AI_TOOLS.find((t) => t.spec.name === 'add_floor_sheet')!

  it('把受限账号 userId 映射成 ctx.user.id 传给 runTool，并剥掉 __projectId', async () => {
    runnerMocks.runTool.mockResolvedValue({
      tool: whiteTool(),
      output: { ok: true },
      summary: 'done',
    })
    const args = { [RESERVED_PROJECT_ARG]: 'proj-9', floorName: '二楼' }
    await runHarnessTool('user_restricted', 'add_floor_sheet', args)

    const [tools, call, ctx] = runnerMocks.runTool.mock.calls[0] as [
      { spec: { name: string } }[],
      unknown,
      { user: { id: string }; projectId: string | null },
    ]
    expect(ctx.user.id).toBe('user_restricted')
    expect(ctx.projectId).toBe('proj-9')
    const parsed = JSON.parse(
      (call as { function: { arguments: string } }).function.arguments,
    ) as Record<string, unknown>
    expect(parsed.floorName).toBe('二楼')
    expect(parsed[RESERVED_PROJECT_ARG]).toBeUndefined()
    expect(tools.some((t) => t.spec.name === 'add_floor_sheet')).toBe(true)
  })

  it('非白名单工具直接拒绝，不调用 runTool', async () => {
    const out = await runHarnessTool('user_restricted', 'generate_image', {})
    expect(out.ok).toBe(false)
    expect(runnerMocks.runTool).not.toHaveBeenCalled()
  })

  it('未知工具直接拒绝', async () => {
    const out = await runHarnessTool('user_restricted', 'no_such_tool', {})
    expect(out.ok).toBe(false)
    expect(out.content).toEqual({ error: expect.stringContaining('未知或未白名单化工具') })
    expect(runnerMocks.runTool).not.toHaveBeenCalled()
  })

  it('mutates 工具调用会写审计；只读工具不写', async () => {
    const audits: unknown[] = []
    setHarnessAuditSink((e) => audits.push(e))
    const run = vi.fn(async () => ({ tool: whiteTool(), output: { ok: true }, summary: 'done' }))
    runnerMocks.runTool.mockImplementation(run)

    // mutates 工具 → 审计
    await runHarnessTool('user_A', 'create_or_update_contract', {
      [RESERVED_PROJECT_ARG]: 'proj-1',
    })
    // 只读工具 → 不审计
    await runHarnessTool('user_A', 'get_project_details', { [RESERVED_PROJECT_ARG]: 'proj-1' })

    expect(audits).toHaveLength(1)
    const entry = audits[0] as { tool: string; userId: string; projectId?: string; kind: string }
    expect(entry.tool).toBe('create_or_update_contract')
    expect(entry.userId).toBe('user_A')
    expect(entry.projectId).toBe('proj-1')
    expect(entry.kind).toBe('harness.audit')
  })

  it('审计失败不回导致业务失败', async () => {
    setHarnessAuditSink(() => {
      throw new Error('sink boom')
    })
    runnerMocks.runTool.mockResolvedValue({
      tool: whiteTool(),
      output: { ok: true },
      summary: 'done',
    })
    const out = await runHarnessTool('user_A', 'create_project', {})
    expect(out.ok).toBe(true)
  })
})
