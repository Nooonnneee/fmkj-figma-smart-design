/**
 * MCP-3 endpoint：把白名单工具暴露给外部 DeepSeek harness。
 *
 * Streamable HTTP（POST JSON-RPC）：只实现三个方法——
 * - `initialize`：握手，返回 server 能力（无 session 强制、支持 tools）；
 * - `tools/list`：枚举白名单工具；
 * - `tools/call`：执行白名单工具（落回 runTool）。
 *
 * 鉴权：
 * - 端点默认关闭，需 `HARNESS_MCP_ENABLED=1`；
 * - 每次请求都带 `Authorization: Bearer <key>`，key 在 `HARNESS_MCP_KEYS` 里查，
 *   映射到绑定好的受限账号 userId；
 * - 校验失败 / 未配置 / 未启用 → 一律 401 / 404，不泻细节。
 *
 * 保留参数 `__projectId`：供没有 projectArg 的布点位类工具指定目标项目，
 * 端点层把它转成 ctx.projectId 并剥掉，不进工具业务参数。
 */
import { NextResponse } from 'next/server'

import { isHarnessMcpEnabled, lookupIdentityByKey } from '@/plugins/harness-mcp/config'
import { handleToolCall, whitelistTools } from '@/plugins/harness-mcp/server'
import { RESERVED_PROJECT_ARG } from '@/plugins/harness-mcp/runner'

export const dynamic = 'force-dynamic'

const METHOD_NOT_SUPPORTED = -32601
const INVALID_REQUEST = -32600

type JsonRpcError = { code: number; message: string }

function jsonRpc(id: unknown, ok: boolean, payload: unknown, error?: JsonRpcError) {
  if (!ok) {
    return NextResponse.json({ jsonrpc: '2.0', id: id ?? null, error }, { status: 200 })
  }
  return NextResponse.json({ jsonrpc: '2.0', id: id ?? null, result: payload }, { status: 200 })
}

function reject(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

export async function POST(request: Request) {
  if (!isHarnessMcpEnabled()) {
    return reject('未启用', 404)
  }
  const auth = request.headers.get('authorization') ?? ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : ''
  const identity = lookupIdentityByKey(bearer)
  if (!identity) {
    return reject('未授权', 401)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonRpc(null, false, undefined, { code: INVALID_REQUEST, message: '请求体必须是 JSON' })
  }
  if (!body || typeof body !== 'object') {
    return jsonRpc(null, false, undefined, { code: INVALID_REQUEST, message: '请求体必须是对象' })
  }
  const method = (body as Record<string, unknown>).method
  const id = (body as Record<string, unknown>).id ?? null
  const params = ((body as Record<string, unknown>).params ?? {}) as Record<string, unknown>
  if (typeof method !== 'string') {
    return jsonRpc(id, false, undefined, { code: INVALID_REQUEST, message: '缺少 method' })
  }

  switch (method) {
    case 'initialize': {
      const p = (params ?? {}) as Record<string, unknown>
      const protocol = typeof p.protocolVersion === 'string' ? p.protocolVersion : undefined
      return jsonRpc(id, true, {
        protocolVersion: protocol,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'fmkj-harness-mcp', version: '0.1.0' },
      })
    }
    case 'tools/list': {
      const tools = whitelistTools().map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: {
          type: 'object',
          properties: t.parameters?.properties ?? {},
          ...(t.parameters?.required ? { required: t.parameters.required } : {}),
        },
      }))
      return jsonRpc(id, true, { tools })
    }
    case 'tools/call': {
      const name = typeof params.name === 'string' ? params.name : ''
      if (!name) {
        return jsonRpc(id, false, undefined, {
          code: INVALID_REQUEST,
          message: 'tools/call 缺少 name',
        })
      }
      const rawArgs =
        typeof params.arguments === 'string' ||
        (params.arguments && typeof params.arguments === 'object')
          ? (params.arguments as string | Record<string, unknown>)
          : {}
      const out = await handleToolCall({ userId: identity.userId }, name, rawArgs)
      const content = [
        {
          type: 'text',
          text: typeof out.content === 'string' ? out.content : JSON.stringify(out.content ?? {}),
        },
      ]
      // 保留 __projectId 说明：调用成功且已用它设定目标项目时提示，便于模型知道上下文。
      const specifiedProject =
        typeof rawArgs === 'object' &&
        rawArgs !== null &&
        typeof (rawArgs as Record<string, unknown>)[RESERVED_PROJECT_ARG] === 'string'
      if (out.ok && specifiedProject) {
        ;(content[0] as { text: string }).text +=
          `（目标项目已由保留参数 ${RESERVED_PROJECT_ARG} 指定并生效）`
      }
      return jsonRpc(id, true, {
        content,
        isError: !out.ok,
      })
    }
    default:
      return jsonRpc(id, false, undefined, {
        code: METHOD_NOT_SUPPORTED,
        message: `不支持的方法：${method}`,
      })
  }
}

/** 只接受 POST。其它方法一律 404。 */
export async function GET() {
  return reject('not found', 404)
}
