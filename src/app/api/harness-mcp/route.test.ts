import { beforeEach, describe, expect, it, vi } from 'vitest'

// 隔离路由层：mock 掉 config 门 + server/runner，只测「开关 + bearer + JSON-RPC 协议」这一层。
const mocks = vi.hoisted(() => ({
  isEnabled: vi.fn(),
  lookup: vi.fn(),
  whitelistTools: vi.fn(),
  handleToolCall: vi.fn(),
}))

vi.mock('@/plugins/harness-mcp/config', () => ({
  isHarnessMcpEnabled: mocks.isEnabled,
  lookupIdentityByKey: mocks.lookup,
}))

vi.mock('@/plugins/harness-mcp/server', () => ({
  whitelistTools: mocks.whitelistTools,
  handleToolCall: mocks.handleToolCall,
}))

vi.mock('@/plugins/harness-mcp/runner', () => ({ RESERVED_PROJECT_ARG: '__projectId' }))

import { POST } from './route'

const BASE = 'http://127.0.0.1:13082'
function rawRequest(body: unknown, bearer?: string) {
  return new Request(new URL('/api/harness-mcp', BASE), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mocks.isEnabled.mockReset()
  mocks.lookup.mockReset()
  mocks.whitelistTools.mockReset()
  mocks.handleToolCall.mockReset()
})

describe('开关与鉴权', () => {
  it('默认关闭时一律 404，不看 key', async () => {
    mocks.isEnabled.mockReturnValue(false)
    const res = await POST(rawRequest({ method: 'tools/list' }, 'anything'))
    expect(res.status).toBe(404)
    expect(mocks.lookup).not.toHaveBeenCalled()
  })

  it('启用但 key 不合法 → 401', async () => {
    mocks.isEnabled.mockReturnValue(true)
    mocks.lookup.mockReturnValue(null)
    const res = await POST(rawRequest({ method: 'tools/list' }, 'bad-key'))
    expect(res.status).toBe(401)
  })

  it('启用且 key 合法但未携带 Authorization → 401', async () => {
    mocks.isEnabled.mockReturnValue(true)
    mocks.lookup.mockReturnValue(null)
    const res = await POST(rawRequest({ method: 'tools/list' }))
    expect(res.status).toBe(401)
  })

  it('启用 + 合法 key → 放行到 tools/list', async () => {
    mocks.isEnabled.mockReturnValue(true)
    mocks.lookup.mockReturnValue({ key: 'k', userId: 'user_x' })
    mocks.whitelistTools.mockReturnValue([])
    const res = await POST(rawRequest({ method: 'tools/list' }, 'valid-key'))
    expect(res.status).toBe(200)
    const json = (await res.json()) as { result: { tools: unknown[] } }
    expect(json.result.tools).toEqual([])
  })
})

describe('JSON-RPC 协议', () => {
  it('非 JSON 请求体 → 客户端错误', async () => {
    mocks.isEnabled.mockReturnValue(true)
    mocks.lookup.mockReturnValue({ key: 'k', userId: 'user_x' })
    const res = await POST(
      new Request(new URL('/api/harness-mcp', BASE), {
        method: 'POST',
        headers: { authorization: 'Bearer k' },
      }),
    )
    const json = (await res.json()) as { error: { code: number } }
    expect(json.error.code).toBe(-32600)
  })

  it('initialize 返回 server 能力与工具能力', async () => {
    mocks.isEnabled.mockReturnValue(true)
    mocks.lookup.mockReturnValue({ key: 'k', userId: 'user_x' })
    const res = await POST(
      rawRequest(
        { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } },
        'k',
      ),
    )
    const json = (await res.json()) as {
      result: { protocolVersion: string; capabilities: { tools: unknown } }
    }
    expect(json.result.protocolVersion).toBe('2025-03-26')
    expect(json.result.capabilities.tools).toBeTruthy()
  })

  it('tools/list 用白名单规格转成 MCP inputSchema 形状', async () => {
    mocks.isEnabled.mockReturnValue(true)
    mocks.lookup.mockReturnValue({ key: 'k', userId: 'user_x' })
    mocks.whitelistTools.mockReturnValue([
      {
        name: 'update_project',
        description: '改项目',
        parameters: {
          type: 'object',
          required: ['projectId'],
          properties: { projectId: { type: 'string' } },
        },
        mutates: true,
      },
    ])
    const res = await POST(rawRequest({ method: 'tools/list' }, 'k'))
    const json = (await res.json()) as {
      result: { tools: { name: string; inputSchema: { required?: string[] } }[] }
    }
    expect(json.result.tools[0].name).toBe('update_project')
    expect(json.result.tools[0].inputSchema.required).toEqual(['projectId'])
  })

  it('tools/call 把 userId 与参数交给 handleToolCall，返回文本 content', async () => {
    mocks.isEnabled.mockReturnValue(true)
    mocks.lookup.mockReturnValue({ key: 'k', userId: 'user_x' })
    mocks.handleToolCall.mockResolvedValue({
      ok: true,
      mutated: false,
      content: { text: '已读取' },
    })
    const res = await POST(
      rawRequest(
        {
          method: 'tools/call',
          params: { name: 'get_project_details', arguments: { projectId: 'p1' } },
        },
        'k',
      ),
    )
    const json = (await res.json()) as {
      result: { content: { type: string; text: string }[]; isError: boolean }
    }
    expect(mocks.handleToolCall).toHaveBeenCalledWith({ userId: 'user_x' }, 'get_project_details', {
      projectId: 'p1',
    })
    expect(json.result.isError).toBe(false)
    expect(json.result.content[0].type).toBe('text')
    expect(json.result.content[0].text).toContain('已读取')
  })

  it('未知方法 → 方法不支持错误码', async () => {
    mocks.isEnabled.mockReturnValue(true)
    mocks.lookup.mockReturnValue({ key: 'k', userId: 'user_x' })
    const res = await POST(rawRequest({ method: 'notifications/unknown' }, 'k'))
    const json = (await res.json()) as { error: { code: number } }
    expect(json.error.code).toBe(-32601)
  })
})
