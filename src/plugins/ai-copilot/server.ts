/**
 * AI 对话的服务端部分：调用 DeepSeek（OpenAI 兼容接口）、把系统全流程与插件包装成模型可调用的工具。
 * 只在服务端（路由处理函数）里使用，密钥只从 process.env.DEEPSEEK_API_KEY 读取。
 */
import { relId } from '@/lib/access'
import { inferAreaType, isAreaType } from '@/lib/area-types'
import { getCatalog, getCompanyInfo } from '@/lib/cached-data'
import {
  DEFAULT_CONTRACT_TERMS,
  DEFAULT_DURATION_DAYS,
  DEFAULT_PAYMENTS,
  DEFAULT_WARRANTY_MONTHS,
  isContractStatus,
  paymentPercentTotal,
} from '@/lib/contracts'
import { DEVICE_TYPE_ORDER, deviceTypeOf, isDeviceType } from '@/lib/device-types'
import { getPayloadClient } from '@/lib/payload'
import { countScenePoints } from '@/lib/point-count'
import { isPointData, parseDefaults, pointDeviceType, summarizePoints, type PointCustomData } from '@/lib/point-map-items'
import {
  analyzeScene,
  buildAreaElements,
  buildPointElements,
  buildSheetElements,
  compactScene,
  nextPointCode,
  normalizeScene,
  type StoredScene,
} from '@/lib/point-scene'
import { inPointScope } from '@/lib/point-scopes'
import { loadProjectDocs } from '@/lib/project-docs'
import { DEFAULT_PLATFORM, isProjectPlatform, PROJECT_PLATFORMS } from '@/lib/projects'
import { QUOTE_STATUSES, type QuoteStatus } from '@/lib/quotes'
import { resolveDeviceType } from '@/plugins/ai-import/point-import'
import { autoSelectProducts, isSelectionTier, SELECTION_TIERS } from '@/plugins/smart-select/auto-select'
import type { PluginFlags } from '@/plugins/state'
import type { Project, User } from '@/payload-types'

import { AI_MODELS } from './templates'

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

const parseQuoteStatus = (v: unknown): QuoteStatus | null => {
  if (v === 'confirmed') return 'accepted'
  return QUOTE_STATUSES.some((s) => s.value === v) ? (v as QuoteStatus) : null
}

export const aiConfigured = () => Boolean(process.env.DEEPSEEK_API_KEY)
export const findModel = (id: unknown) => AI_MODELS.find((m) => m.id === id) ?? AI_MODELS[0]

export type LlmMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: LlmToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string }
export type LlmToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } }

export class AiError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message)
  }
}

async function postOnce(body: Record<string, unknown>, timeoutMs: number) {
  let res: Response
  try {
    res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    throw new AiError((error as Error)?.name === 'TimeoutError' ? 'AI 响应超时，请稍后重试' : 'AI 服务暂时无法连接，请稍后重试')
  }
  return res
}

async function post(body: Record<string, unknown>, timeoutMs: number) {
  let res = await postOnce(body, timeoutMs)
  // 兼容不同网关对 DeepSeek V4.1-Flash-1017 的模型 ID 命名（官方 /models 返回 deepseek-flash）
  if (res.status === 400 && body.model === 'deepseek-flash') {
    for (const alias of ['deepseek-v4.1-flash-1017', 'DeepSeek-V4.1-Flash', 'deepseek-chat']) {
      res = await postOnce({ ...body, model: alias }, timeoutMs)
      if (res.ok) return res
    }
  }
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    if (res.status === 401) throw new AiError('DeepSeek 密钥无效，请在 Make 设置 → Secrets 里检查 DEEPSEEK_API_KEY', 503)
    if (res.status === 402) throw new AiError('DeepSeek 账户余额不足，请先在 DeepSeek 平台充值', 503)
    if (res.status === 429) throw new AiError('请求太频繁，请稍后再试', 429)
    if (res.status === 520) throw new AiError('当前预览环境不允许连接外部 AI 服务。请点击 Publish 发布后，在正式站点或自建服务器使用。', 503)
    console.error('[ai] deepseek error', res.status, detail?.error?.message)
    throw new AiError('AI 服务出错，请稍后重试')
  }
  return res
}

/** 不流式的一次调用（用于判断是否需要调用工具）。 */
export async function complete(model: string, messages: LlmMessage[], tools?: unknown[]) {
  const res = await post({ model, messages, ...(tools?.length ? { tools } : {}), stream: false }, 60_000)
  const json = (await res.json()) as { choices?: { message?: { content?: string | null; tool_calls?: LlmToolCall[] } }[] }
  return json.choices?.[0]?.message ?? { content: '' }
}

/** 流式调用：逐段回调正文和思考过程，返回完整正文。 */
export async function stream(
  model: string,
  messages: LlmMessage[],
  onDelta: (text: string) => void,
  onReasoning: (text: string) => void,
  signal?: AbortSignal,
) {
  const res = await post({ model, messages, stream: true }, 120_000)
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  while (true) {
    if (signal?.aborted) {
      await reader.cancel()
      break
    }
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const data = line.trim().replace(/^data:\s*/, '')
      if (!data || data === '[DONE]' || !line.trim().startsWith('data:')) continue
      try {
        const delta = (JSON.parse(data) as { choices?: { delta?: { content?: string; reasoning_content?: string } }[] }).choices?.[0]?.delta
        if (delta?.reasoning_content) onReasoning(delta.reasoning_content)
        if (delta?.content) {
          full += delta.content
          onDelta(delta.content)
        }
      } catch {
        // 忽略不完整的行
      }
    }
  }
  return full
}

/** 系统提示词：身份、业务背景、当前项目概况。 */
export function systemPrompt(project: Awaited<ReturnType<typeof loadProjectDocs>> | null) {
  const lines = [
    '你是 FMKJ 全屋智能家居方案设计平台的 AI 助手，服务对象是方案设计师和安装团队。',
    '平台主流程：项目信息 → 点位图 → 报价 → 合同 → 归档。',
    '你拥有完整的系统操作工具，可以直接替用户完成：',
    '1. 查询/创建/修改项目与归档状态（list_projects, create_project, update_project）；',
    '2. 在项目点位图上直接创建房间区域并布置智能设备点位（setup_rooms_and_points）；',
    '3. 检索 728 款产品库、按平台与档次一键选型或指定某类设备的默认产品（search_products, smart_select, set_project_defaults）；',
    '4. 进行房间点位完整度审查（room_insights）；',
    '5. 从点位图直接生成报价单草稿、修改报价单优惠/附加费/状态（get_project_details, create_or_update_quote）；',
    '6. 生成或修改项目合同、设置付款分期、标记签约与登记收款（create_or_update_contract）；',
    '7. 生成各类打印与导出文档的直达链接（get_document_links）。',
    '当用户提出创建或修改请求时，请主动调用对应工具直接完成操作（可分多步连续调用，例如：新建项目 → 布置房间和点位 → 智能选型 → 生成报价单），不要只给口头步骤。回答使用简体中文，简洁、准确。',
  ]
  if (project) {
    const p = project.project
    lines.push(
      '',
      `当前关联项目：${p.name}（ID: ${p.id}，客户：${p.customerName || '未填写'}，主平台：${p.platform || '待定'}）`,
      `点位 ${project.points.length} 个，房间 ${project.rooms.length} 个，图纸 ${project.sheets.length} 张，${project.pending} 个点位待选型。`,
      `设备构成：${project.categories.map((c) => `${c.name} ${c.count}`).join('、') || '暂无'}`,
      `按当前选型的设备预算：${project.total.toFixed(0)} 元${project.quote ? `；最新报价「${project.quote.title}」合计 ${project.quote.total} 元` : ''}。`,
    )
  } else {
    lines.push('', '当前尚未关联具体项目。你可以调用 list_projects 查找已有项目，或调用 create_project 直接新建项目（新建后会自动关联）。')
  }
  return lines.join('\n')
}

export type ActiveProjectUpdate = {
  id: string
  name: string
  customerName: string | null
  platform: string | null
  pointCount: number
}

export type ToolContext = {
  user: User
  projectId: string | null
  project: Awaited<ReturnType<typeof loadProjectDocs>> | null
  onProjectChange?: (proj: ActiveProjectUpdate) => void
  mutated?: boolean
}

type AiTool = {
  /** null 表示核心内置工具（始终可用）；非 null 表示需开启并勾选对应插件 */
  pluginId: keyof PluginFlags | null
  pluginName: string
  definition: Record<string, unknown>
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<{ result: unknown; summary: string; href?: string; hrefLabel?: string }>
}

async function refreshContextProject(ctx: ToolContext, targetProjectId: string) {
  ctx.projectId = targetProjectId
  ctx.project = await loadProjectDocs(targetProjectId, ctx.user).catch(() => null)
  if (ctx.project) {
    ctx.onProjectChange?.({
      id: String(ctx.project.project.id),
      name: ctx.project.project.name,
      customerName: ctx.project.project.customerName ?? null,
      platform: ctx.project.project.platform ?? null,
      pointCount: ctx.project.points.length,
    })
  }
}

/** 系统全流程内置工具 + 插件工具。 */
const TOOLS: AiTool[] = [
  {
    pluginId: null,
    pluginName: '项目查询',
    definition: {
      type: 'function',
      function: {
        name: 'list_projects',
        description: '查询或搜索项目列表（可按关键词、状态、主平台筛选），也可用来把某个已有项目设为当前操作项目。',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '项目名称、客户姓名或小区关键词（可选）' },
            status: { type: 'string', enum: ['active', 'archived', 'all'], description: '进行中 active / 已归档 archived / 全部 all（默认 active）' },
            switchToProjectId: { type: 'string', description: '如果需要切换到某个项目继续操作，传入该项目 ID（可选）' },
          },
        },
      },
    },
    async run(args, ctx) {
      if (typeof args.switchToProjectId === 'string' && args.switchToProjectId.trim()) {
        await refreshContextProject(ctx, args.switchToProjectId.trim())
        if (ctx.project) {
          return {
            result: { switchedTo: ctx.project.project.name, projectId: ctx.projectId },
            summary: `已切换到项目「${ctx.project.project.name}」`,
            href: `/projects/${ctx.projectId}`,
            hrefLabel: '打开项目',
          }
        }
      }
      const payload = await getPayloadClient()
      const status = args.status === 'archived' || args.status === 'all' ? args.status : 'active'
      const q = typeof args.query === 'string' ? args.query.trim().toLowerCase() : ''
      const res = await payload.find({
        collection: 'projects',
        ...(status !== 'all' ? { where: { status: { equals: status } } } : {}),
        sort: '-updatedAt',
        limit: 30,
        depth: 0,
        user: ctx.user,
        overrideAccess: false,
        select: { name: true, customerName: true, customerPhone: true, community: true, address: true, platform: true, budget: true, status: true, pointMap: true },
      })
      const list = res.docs
        .filter((p) => (!q ? true : `${p.name} ${p.customerName ?? ''} ${p.community ?? ''} ${p.address ?? ''}`.toLowerCase().includes(q)))
        .slice(0, 15)
        .map((p) => ({
          id: String(p.id),
          name: p.name,
          customerName: p.customerName ?? null,
          community: p.community ?? null,
          address: p.address ?? null,
          platform: p.platform ?? null,
          budget: p.budget ?? null,
          status: p.status,
          pointCount: countScenePoints(p.pointMap),
        }))
      return {
        result: { count: list.length, projects: list },
        summary: `查找到 ${list.length} 个项目`,
        href: '/projects',
        hrefLabel: '项目列表',
      }
    },
  },
  {
    pluginId: null,
    pluginName: '新建项目',
    definition: {
      type: 'function',
      function: {
        name: 'create_project',
        description: '创建一个新的全屋智能项目。项目名称留空时会按「小区 + 房号」或客户姓名自动生成。创建成功后会自动将当前会话关联到该新项目。',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '项目名称（可选，留空自动按小区+房号或客户名生成）' },
            customerName: { type: 'string', description: '客户姓名（如 张先生）' },
            customerPhone: { type: 'string', description: '客户电话' },
            community: { type: 'string', description: '小区 / 楼盘名称（如 西溪壹号）' },
            address: { type: 'string', description: '房号 / 详细地址（如 3幢1201）' },
            platform: {
              type: 'string',
              enum: [...PROJECT_PLATFORMS],
              description: '主平台（米家 / Aqara Home / Apple Home / 华为鸿蒙智家 / KNX / Control4 / 网络/弱电 / 待定）',
            },
            budget: { type: 'number', description: '客户预算（元，可选）' },
            notes: { type: 'string', description: '项目备注（可选）' },
          },
        },
      },
    },
    async run(args, ctx) {
      const payload = await getPayloadClient()
      const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
      const platformRaw = str(args.platform, 40)
      const platform = (isProjectPlatform(platformRaw) ? platformRaw : DEFAULT_PLATFORM) as Project['platform']
      const budget = typeof args.budget === 'number' && Number.isFinite(args.budget) && args.budget >= 0 ? Math.round(args.budget) : null

      const doc = await payload.create({
        collection: 'projects',
        data: {
          name: str(args.name, 120),
          customerName: str(args.customerName, 60) || null,
          customerPhone: str(args.customerPhone, 30) || null,
          community: str(args.community, 80) || null,
          address: str(args.address, 200) || null,
          platform,
          budget,
          notes: str(args.notes, 2000) || null,
          owner: ctx.user.id,
          status: 'active',
        },
        user: ctx.user,
        overrideAccess: false,
        depth: 0,
      })
      ctx.mutated = true
      await refreshContextProject(ctx, String(doc.id))
      return {
        result: {
          projectId: String(doc.id),
          name: doc.name,
          customerName: doc.customerName ?? null,
          community: doc.community ?? null,
          address: doc.address ?? null,
          platform: doc.platform ?? null,
          budget: doc.budget ?? null,
        },
        summary: `已创建项目「${doc.name}」`,
        href: `/projects/${doc.id}`,
        hrefLabel: '打开新项目',
      }
    },
  },
  {
    pluginId: null,
    pluginName: '修改项目信息',
    definition: {
      type: 'function',
      function: {
        name: 'update_project',
        description: '修改当前关联项目（或指定 projectId）的基本信息、主平台、预算、备注，或将项目归档/恢复。',
        parameters: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: '项目 ID（可选，不传则修改当前关联项目）' },
            name: { type: 'string', description: '项目名称' },
            customerName: { type: 'string', description: '客户姓名' },
            customerPhone: { type: 'string', description: '客户电话' },
            community: { type: 'string', description: '小区 / 楼盘' },
            address: { type: 'string', description: '房号 / 详细地址' },
            platform: { type: 'string', enum: [...PROJECT_PLATFORMS], description: '主平台' },
            budget: { type: 'number', description: '预算（元）' },
            notes: { type: 'string', description: '备注' },
            status: { type: 'string', enum: ['active', 'archived'], description: '状态：active 进行中 / archived 已归档' },
          },
        },
      },
    },
    async run(args, ctx) {
      const targetId = typeof args.projectId === 'string' && args.projectId.trim() ? args.projectId.trim() : ctx.projectId
      if (!targetId) return { result: { error: '没有指定或关联项目' }, summary: '未指定项目' }

      const patch: Record<string, unknown> = {}
      if (typeof args.name === 'string' && args.name.trim()) patch.name = args.name.trim().slice(0, 120)
      if (typeof args.customerName === 'string') patch.customerName = args.customerName.trim().slice(0, 60) || null
      if (typeof args.customerPhone === 'string') patch.customerPhone = args.customerPhone.trim().slice(0, 30) || null
      if (typeof args.community === 'string') patch.community = args.community.trim().slice(0, 80) || null
      if (typeof args.address === 'string') patch.address = args.address.trim().slice(0, 200) || null
      if (typeof args.platform === 'string' && isProjectPlatform(args.platform)) patch.platform = args.platform
      if (typeof args.budget === 'number' && Number.isFinite(args.budget) && args.budget >= 0) patch.budget = Math.round(args.budget)
      if (typeof args.notes === 'string') patch.notes = args.notes.trim().slice(0, 2000) || null
      if (args.status === 'active' || args.status === 'archived') patch.status = args.status

      const payload = await getPayloadClient()
      const updated = await payload.update({
        collection: 'projects',
        id: targetId,
        data: patch as never,
        user: ctx.user,
        overrideAccess: false,
        depth: 0,
      })
      ctx.mutated = true
      await refreshContextProject(ctx, String(updated.id))
      return {
        result: { projectId: String(updated.id), name: updated.name, status: updated.status, platform: updated.platform, budget: updated.budget },
        summary: `已更新项目「${updated.name}」`,
        href: `/projects/${updated.id}`,
        hrefLabel: '查看项目',
      }
    },
  },
  {
    pluginId: null,
    pluginName: '点位图房间与布点',
    definition: {
      type: 'function',
      function: {
        name: 'setup_rooms_and_points',
        description:
          '在当前项目的点位图上自动创建或补充房间区域（如玄关、客厅、餐厅、厨房、主卧、次卧、卫生间、阳台）并布置智能设备点位。如果项目尚未上传户型图，会自动创建一张标准图纸并排布好房间框和点位符号。',
        parameters: {
          type: 'object',
          properties: {
            sheetName: { type: 'string', description: '图纸名称（默认「一层平面图」）' },
            mode: { type: 'string', enum: ['append', 'replace'], description: 'append 在现有基础上追加（默认）；replace 清空当前图纸后重新生成' },
            rooms: {
              type: 'array',
              description: '要布置的房间及每个房间内的设备点位列表',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: '房间名称（如 玄关、客厅、餐厅、厨房、主卧、次卧、儿童房、书房、主卫、客卫、阳台）' },
                  type: { type: 'string', description: '房间类型可选：entrance, living, dining, kitchen, bedroom, kids, study, bathroom, balcony, corridor, cloakroom, utility' },
                  devices: {
                    type: 'array',
                    description: '该房间内要放置的设备类型及数量',
                    items: {
                      type: 'object',
                      properties: {
                        deviceType: {
                          type: 'string',
                          description:
                            '设备类型（如 switch-1, switch-2, switch-3, switch-4, socket, socket-double, socket-usb, downlight, spotlight, track-light, ceiling-light, light-strip, curtain-track, smart-lock, doorbell, camera, motion-sensor, contact-sensor, water-sensor, smoke-sensor, temp-sensor, gateway, touch-panel, speaker, ac-router, ap-node, network-panel, vrf-controller）',
                        },
                        count: { type: 'number', description: '数量（1–20）' },
                      },
                      required: ['deviceType', 'count'],
                    },
                  },
                },
                required: ['name', 'devices'],
              },
            },
          },
          required: ['rooms'],
        },
      },
    },
    async run(args, ctx) {
      if (!ctx.projectId) return { result: { error: '没有关联项目，请先新建或选择项目' }, summary: '未关联项目' }
      const rawRooms = Array.isArray(args.rooms) ? (args.rooms as Record<string, unknown>[]) : []
      if (!rawRooms.length) return { result: { error: '请提供 rooms 房间列表' }, summary: '未提供房间列表' }

      const payload = await getPayloadClient()
      const project = await payload
        .findByID({ collection: 'projects', id: ctx.projectId, depth: 0, user: ctx.user, overrideAccess: false, select: { status: true, pointMap: true } })
        .catch(() => null)
      if (!project) return { result: { error: '项目不存在或无权限' }, summary: '项目不可用' }
      if (project.status === 'archived') return { result: { error: '项目已归档，无法修改点位图' }, summary: '项目已归档' }

      const norm = normalizeScene(project.pointMap as Partial<StoredScene> | null)
      let elements = [...norm.elements]
      const files = { ...norm.files }
      const sheetName = typeof args.sheetName === 'string' && args.sheetName.trim() ? args.sheetName.trim().slice(0, 40) : '一层平面图'
      const replace = args.mode === 'replace'

      if (replace) {
        elements = []
      }

      let analyzed = analyzeScene({ elements, files })
      let sheet = analyzed.sheets.find((s) => s.name === sheetName) ?? analyzed.sheets[0]
      if (!sheet) {
        const blankFileId = 'blank-sheet'
        files[blankFileId] = { id: blankFileId, dataURL: '/blank-sheet.svg', mimeType: 'image/svg+xml' }
        elements.push(...buildSheetElements({ index: 0, name: sheetName, fileId: blankFileId }))
        analyzed = analyzeScene({ elements, files })
        sheet = analyzed.sheets[0]!
      }

      const usedCodes = new Set(analyzed.points.map((p) => p.code).filter(Boolean))
      const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(rawRooms.length))))
      const rows = Math.ceil(rawRooms.length / cols)
      const padX = 48
      const padY = 48
      const gapX = 24
      const gapY = 24
      const cellW = Math.floor((sheet.width - padX * 2 - gapX * (cols - 1)) / cols)
      const cellH = Math.floor((sheet.height - padY * 2 - gapY * (rows - 1)) / rows)

      let addedAreas = 0
      let addedPoints = 0
      for (const [idx, r] of rawRooms.entries()) {
        const rName = typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 30) : `房间 ${idx + 1}`
        const rType = isAreaType(r.type) ? r.type : inferAreaType(rName)
        const col = idx % cols
        const row = Math.floor(idx / cols)
        const rx = sheet.x + padX + col * (cellW + gapX)
        const ry = sheet.y + padY + row * (cellH + gapY)

        elements.push(...buildAreaElements({ name: rName, areaType: rType, x: rx, y: ry, width: cellW, height: cellH }))
        addedAreas++

        const devs = Array.isArray(r.devices) ? (r.devices as Record<string, unknown>[]) : []
        const flatTypes: string[] = []
        for (const d of devs) {
          const dt = resolveDeviceType(d.deviceType ?? d.type) ?? (isDeviceType(d.deviceType) ? String(d.deviceType) : null)
          if (!dt) continue
          const c = Math.min(20, Math.max(1, Math.round(Number(d.count) || 1)))
          for (let i = 0; i < c; i++) flatTypes.push(dt)
        }
        if (!flatTypes.length) continue

        const pCols = Math.min(5, Math.max(2, Math.ceil(Math.sqrt(flatTypes.length))))
        const pRows = Math.ceil(flatTypes.length / pCols)
        for (const [pIdx, dt] of flatTypes.entries()) {
          const pc = pIdx % pCols
          const pr = Math.floor(pIdx / pCols)
          const cx = rx + ((pc + 0.6) / (pCols + 0.2)) * cellW
          const cy = ry + 26 + ((pr + 0.5) / (pRows + 0.2)) * (cellH - 36)
          const code = nextPointCode(dt, usedCodes)
          usedCodes.add(code)
          elements.push(...buildPointElements({ deviceType: dt, cx, cy, code }))
          addedPoints++
        }
      }

      const compacted = compactScene(elements, files, norm.appState)
      await payload.update({
        collection: 'projects',
        id: ctx.projectId,
        data: { pointMap: compacted as never },
        user: ctx.user,
        overrideAccess: false,
        depth: 0,
      })
      ctx.mutated = true
      await refreshContextProject(ctx, ctx.projectId)
      return {
        result: {
          sheetName: sheet.name,
          addedAreas,
          addedPoints,
          totalPoints: ctx.project?.points.length ?? addedPoints,
        },
        summary: `已布置 ${addedAreas} 个房间、${addedPoints} 个点位`,
        href: `/projects/${ctx.projectId}/point-map`,
        hrefLabel: '查看点位图',
      }
    },
  },
  {
    pluginId: null,
    pluginName: '产品库检索',
    definition: {
      type: 'function',
      function: {
        name: 'search_products',
        description: '搜索平台产品库（728 款在售产品）：可按关键词、设备类型、品牌名称、生态平台、最高价格筛选，返回产品 ID、型号、SKU、品牌、售价与成本。',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '搜索关键词（如 零火开关、人体存在、静音窗帘、网关）' },
            deviceType: { type: 'string', description: '设备类型代号（如 switch-1, switch-2, switch-3, curtain-track, smart-lock, motion-sensor, water-sensor, gateway, downlight）' },
            brand: { type: 'string', description: '品牌名称（如 Aqara、小米、领普、易来）' },
            platform: { type: 'string', description: '生态平台（如 米家、Apple Home、华为、涂鸦、Matter、KNX）' },
            maxPrice: { type: 'number', description: '最高单价（元）' },
          },
        },
      },
    },
    async run(args) {
      const catalog = await getCatalog()
      const q = typeof args.query === 'string' ? args.query.trim().toLowerCase() : ''
      const dt = typeof args.deviceType === 'string' ? args.deviceType.trim() : ''
      const brand = typeof args.brand === 'string' ? args.brand.trim().toLowerCase() : ''
      const platform = typeof args.platform === 'string' ? args.platform.trim().toLowerCase() : ''
      const maxPrice = typeof args.maxPrice === 'number' && args.maxPrice > 0 ? args.maxPrice : null

      const matched = catalog
        .filter((p) => (p.status ?? 'active') === 'active')
        .filter((p) => (!dt ? true : p.deviceType === dt))
        .filter((p) => (!brand ? true : (p.brand?.name ?? '').toLowerCase().includes(brand)))
        .filter((p) => (!platform ? true : p.platforms.some((pl) => pl.toLowerCase().includes(platform))))
        .filter((p) => (maxPrice === null ? true : p.price <= maxPrice))
        .filter((p) => (!q ? true : `${p.name} ${p.sku} ${p.brand?.name ?? ''} ${deviceTypeOf(p.deviceType ?? '')?.name ?? ''}`.toLowerCase().includes(q)))
        .slice(0, 15)
        .map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          brand: p.brand?.name ?? null,
          deviceType: p.deviceType,
          deviceTypeLabel: deviceTypeOf(p.deviceType ?? '')?.name ?? p.deviceType,
          platforms: p.platforms,
          price: p.price,
          cost: p.cost,
          unit: p.unit,
        }))

      return {
        result: { count: matched.length, products: matched },
        summary: `检索到 ${matched.length} 款产品`,
        href: '/products',
        hrefLabel: '打开产品库',
      }
    },
  },
  {
    pluginId: null,
    pluginName: '指定默认型号',
    definition: {
      type: 'function',
      function: {
        name: 'set_project_defaults',
        description: '为当前关联项目的指定设备类型设置具体的默认产品型号（传入设备类型与对应的产品 ID）。',
        parameters: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  deviceType: { type: 'string', description: '设备类型代号（如 switch-3, curtain-track）' },
                  productId: { type: 'string', description: '产品 ID（可通过 search_products 获取）' },
                },
                required: ['deviceType', 'productId'],
              },
            },
          },
          required: ['items'],
        },
      },
    },
    async run(args, ctx) {
      if (!ctx.projectId) return { result: { error: '没有关联项目' }, summary: '未关联项目' }
      const payload = await getPayloadClient()
      const project = await payload
        .findByID({ collection: 'projects', id: ctx.projectId, depth: 0, user: ctx.user, overrideAccess: false, select: { status: true, defaultProducts: true } })
        .catch(() => null)
      if (!project || project.status === 'archived') return { result: { error: '项目不可用或已归档' }, summary: '项目不可修改' }

      const catalog = await getCatalog()
      const byId = new Map(catalog.map((p) => [p.id, p]))
      const defaults = parseDefaults(project.defaultProducts)
      const rawItems = Array.isArray(args.items) ? (args.items as { deviceType?: unknown; productId?: unknown }[]) : []
      const updated: { deviceType: string; productName: string; price: number }[] = []

      for (const it of rawItems) {
        const dt = typeof it.deviceType === 'string' && isDeviceType(it.deviceType) ? it.deviceType : null
        const pid = typeof it.productId === 'string' ? it.productId : null
        const prod = pid ? byId.get(pid) : null
        if (!dt || !prod) continue
        defaults[dt] = prod.id
        updated.push({ deviceType: deviceTypeOf(dt)?.name ?? dt, productName: prod.name, price: prod.price })
      }
      if (!updated.length) return { result: { error: '未匹配到有效的设备类型或产品 ID' }, summary: '未更新型号' }

      await payload.update({
        collection: 'projects',
        id: ctx.projectId,
        data: { defaultProducts: defaults },
        user: ctx.user,
        overrideAccess: false,
        depth: 0,
      })
      ctx.mutated = true
      await refreshContextProject(ctx, ctx.projectId)
      return {
        result: { updated },
        summary: `已更新 ${updated.length} 类设备的默认型号`,
        href: `/projects/${ctx.projectId}/point-map`,
        hrefLabel: '查看点位图',
      }
    },
  },
  {
    pluginId: null,
    pluginName: '项目点位与报价明细',
    definition: {
      type: 'function',
      function: {
        name: 'get_project_details',
        description: '读取当前关联项目的详细点位清单、已汇总的产品金额、以及项目下所有报价单和合同信息。',
        parameters: { type: 'object', properties: {} },
      },
    },
    async run(_args, ctx) {
      if (!ctx.project || !ctx.projectId) {
        return { result: { error: '没有关联项目，请先新建或关联项目' }, summary: '未关联项目' }
      }
      const payload = await getPayloadClient()
      const quotes = await payload.find({
        collection: 'quotes',
        where: { project: { equals: ctx.projectId } },
        sort: '-updatedAt',
        limit: 5,
        depth: 0,
        user: ctx.user,
        overrideAccess: false,
        select: { title: true, status: true, discount: true, total: true, items: true, fees: true, notes: true },
      })
      return {
        result: {
          project: {
            id: ctx.projectId,
            name: ctx.project.project.name,
            customerName: ctx.project.project.customerName,
            customerPhone: ctx.project.project.customerPhone,
            community: ctx.project.project.community,
            address: ctx.project.project.address,
            platform: ctx.project.project.platform,
            budget: ctx.project.project.budget,
            totalPoints: ctx.project.points.length,
            pendingPoints: ctx.project.pending,
            equipmentTotal: ctx.project.total,
          },
          products: ctx.project.products.map((r) => ({
            deviceType: deviceTypeOf(r.deviceType)?.name ?? r.deviceType,
            name: r.product.name,
            brand: r.product.brand?.name ?? null,
            price: r.product.price,
            count: r.count,
            subtotal: r.subtotal,
            rooms: r.rooms,
          })),
          quotes: quotes.docs.map((q) => ({
            id: String(q.id),
            title: q.title,
            status: q.status,
            discount: q.discount,
            total: q.total,
            fees: q.fees ?? [],
            itemCount: (q.items ?? []).length,
          })),
          contract: ctx.project.contract
            ? {
                id: String(ctx.project.contract.id),
                number: ctx.project.contract.number,
                amount: ctx.project.contract.amount,
                status: ctx.project.contract.status,
                payments: ctx.project.contract.payments ?? [],
              }
            : null,
        },
        summary: `读取了 ${ctx.project.products.length} 项设备与 ${quotes.docs.length} 份报价`,
        href: `/projects/${ctx.projectId}`,
        hrefLabel: '查看项目',
      }
    },
  },
  {
    pluginId: null,
    pluginName: '报价单生成与修改',
    definition: {
      type: 'function',
      function: {
        name: 'create_or_update_quote',
        description:
          '为当前关联项目生成一份新的报价单（根据点位图和默认型号汇总），或修改已有的报价单（传入 quoteId 可修改标题、状态 draft/sent/accepted、优惠金额 discount、附加费用 fees 如安装调试费、备注 notes）。',
        parameters: {
          type: 'object',
          properties: {
            quoteId: { type: 'string', description: '要修改的已有报价单 ID（不传则根据点位图新建一份报价单）' },
            title: { type: 'string', description: '报价单标题（可选）' },
            status: { type: 'string', enum: ['draft', 'sent', 'accepted'], description: '报价单状态：draft 草稿 / sent 已发送 / accepted 已确认' },
            discount: { type: 'number', description: '优惠减免金额（元，非负数字）' },
            fees: {
              type: 'array',
              description: '附加费用列表（如安装调试费、线材辅料费）',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: '费用名称（如 安装调试费）' },
                  amount: { type: 'number', description: '金额（元）' },
                },
                required: ['name', 'amount'],
              },
            },
            notes: { type: 'string', description: '报价单备注说明' },
          },
        },
      },
    },
    async run(args, ctx) {
      if (!ctx.projectId) return { result: { error: '没有关联项目，请先新建或选择项目' }, summary: '未关联项目' }
      const payload = await getPayloadClient()
      const fees = Array.isArray(args.fees)
        ? (args.fees as { name?: unknown; amount?: unknown }[])
            .map((f) => ({
              name: typeof f.name === 'string' ? f.name.trim().slice(0, 60) : '',
              amount: typeof f.amount === 'number' && Number.isFinite(f.amount) && f.amount >= 0 ? Math.round(f.amount * 100) / 100 : 0,
            }))
            .filter((f) => f.name && f.amount > 0)
        : undefined

      // 修改已有报价单
      if (typeof args.quoteId === 'string' && args.quoteId.trim()) {
        const qid = args.quoteId.trim()
        const patch: Record<string, unknown> = {}
        if (typeof args.title === 'string' && args.title.trim()) patch.title = args.title.trim().slice(0, 60)
        const nextStatus = parseQuoteStatus(args.status)
        if (nextStatus) patch.status = nextStatus
        if (typeof args.discount === 'number' && args.discount >= 0) patch.discount = Math.round(args.discount * 100) / 100
        if (fees !== undefined) patch.fees = fees
        if (typeof args.notes === 'string') patch.notes = args.notes.trim().slice(0, 2000) || null

        const updated = await payload.update({
          collection: 'quotes',
          id: qid,
          data: patch as never,
          user: ctx.user,
          overrideAccess: false,
          depth: 0,
        })
        ctx.mutated = true
        await refreshContextProject(ctx, ctx.projectId)
        return {
          result: { quoteId: String(updated.id), title: updated.title, status: updated.status, total: updated.total, discount: updated.discount },
          summary: `已更新「${updated.title}」（合计 ¥${updated.total}）`,
          href: `/projects/${ctx.projectId}/quotes/${updated.id}`,
          hrefLabel: '查看报价单',
        }
      }

      // 新建报价单
      const project = await payload
        .findByID({ collection: 'projects', id: ctx.projectId, depth: 0, user: ctx.user, overrideAccess: false, select: { name: true, status: true, pointMap: true, defaultProducts: true } })
        .catch(() => null)
      if (!project) return { result: { error: '项目不存在或无权限' }, summary: '项目不可用' }
      if (project.status === 'archived') return { result: { error: '项目已归档，不能新建报价' }, summary: '项目已归档' }

      const elements = ((project.pointMap as { elements?: unknown[] } | null)?.elements ?? []) as { isDeleted?: boolean; customData?: PointCustomData }[]
      const allPoints = elements.filter((el) => !el?.isDeleted && isPointData(el?.customData)).map((el) => el.customData!)
      const catalog = await getCatalog()
      const byId = new Map(catalog.map((p) => [p.id, p]))
      const points = allPoints.filter((cd) => inPointScope(pointDeviceType(cd, byId), 'all'))
      const summary = summarizePoints(points, byId, parseDefaults(project.defaultProducts))
      const items = [...summary.products.entries()]
        .map(([id, row]) => ({ p: byId.get(id)!, row }))
        .sort((a, b) => DEVICE_TYPE_ORDER.indexOf(a.p.deviceType ?? a.row.deviceType) - DEVICE_TYPE_ORDER.indexOf(b.p.deviceType ?? b.row.deviceType))
        .map(({ p, row }) => ({
          product: p.id,
          deviceType: (p.deviceType ?? row.deviceType) as never,
          image: p.image?.id ?? null,
          name: p.name,
          sku: p.sku,
          unit: p.unit,
          price: p.price,
          quantity: row.count,
        }))

      if (items.length === 0) {
        return {
          result: { error: '当前项目还没有已选型的点位。请先调用 setup_rooms_and_points 布置点位，并调用 smart_select(apply=true) 配好默认型号后再生成报价。' },
          summary: '点位尚未选型',
          href: `/projects/${ctx.projectId}/point-map`,
        }
      }

      const company = await getCompanyInfo()
      const existing = await payload.count({ collection: 'quotes', where: { project: { equals: ctx.projectId } }, user: ctx.user, overrideAccess: false })
      const title = typeof args.title === 'string' && args.title.trim() ? args.title.trim().slice(0, 60) : `报价 ${existing.totalDocs + 1}`
      const discount = typeof args.discount === 'number' && args.discount >= 0 ? Math.round(args.discount * 100) / 100 : 0
      const notes = typeof args.notes === 'string' && args.notes.trim() ? args.notes.trim().slice(0, 2000) : (company.quoteNotes ?? null)
      const status = parseQuoteStatus(args.status) ?? 'draft'

      const quote = await payload.create({
        collection: 'quotes',
        data: { title, project: ctx.projectId, status, items, fees: fees ?? [], discount, notes },
        user: ctx.user,
        overrideAccess: false,
        depth: 0,
      })
      ctx.mutated = true
      await refreshContextProject(ctx, ctx.projectId)
      return {
        result: {
          quoteId: String(quote.id),
          title: quote.title,
          status: quote.status,
          itemCount: items.length,
          pendingPoints: summary.pendingTotal,
          total: quote.total,
        },
        summary: `已生成「${quote.title}」（合计 ¥${quote.total}）`,
        href: `/projects/${ctx.projectId}/quotes/${quote.id}`,
        hrefLabel: '打开报价单',
      }
    },
  },
  {
    pluginId: null,
    pluginName: '合同生成与管理',
    definition: {
      type: 'function',
      function: {
        name: 'create_or_update_contract',
        description:
          '为当前关联项目生成合同（若尚无合同则基于最新报价单自动创建），或修改已有合同的金额、工期、质保期、付款分期比例（合计需 100%）、合同条款、签订状态（draft/signed）及各期收款登记。',
        parameters: {
          type: 'object',
          properties: {
            quoteId: { type: 'string', description: '依据的报价单 ID（可选，不传则自动取项目最新报价单）' },
            amount: { type: 'number', description: '合同总金额（元，可选）' },
            durationDays: { type: 'number', description: '工期天数（1–365，可选）' },
            warrantyMonths: { type: 'number', description: '质保月数（0–120，可选）' },
            payments: {
              type: 'array',
              description: '付款节点列表（各期 percent 合计需为 100）',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: '款项节点名称（如 签约预付款 / 设备到场款 / 验收尾款）' },
                  percent: { type: 'number', description: '比例（0–100）' },
                  received: { type: 'boolean', description: '是否已收款' },
                },
                required: ['name', 'percent'],
              },
            },
            terms: { type: 'string', description: '合同条款正文（可选）' },
            status: { type: 'string', enum: ['draft', 'signed'], description: '合同状态：draft 草稿 / signed 已签订' },
          },
        },
      },
    },
    async run(args, ctx) {
      if (!ctx.projectId) return { result: { error: '没有关联项目，请先新建或选择项目' }, summary: '未关联项目' }
      const payload = await getPayloadClient()
      const [project, existingContracts, quotesRes, company] = await Promise.all([
        payload.findByID({ collection: 'projects', id: ctx.projectId, depth: 0, user: ctx.user, overrideAccess: false }).catch(() => null),
        payload.find({ collection: 'contracts', where: { project: { equals: ctx.projectId } }, limit: 1, depth: 0, user: ctx.user, overrideAccess: false }),
        payload.find({ collection: 'quotes', where: { project: { equals: ctx.projectId } }, sort: '-updatedAt', limit: 5, depth: 0, user: ctx.user, overrideAccess: false }),
        getCompanyInfo(),
      ])
      if (!project) return { result: { error: '项目不存在或无权限' }, summary: '项目不可用' }

      let contract = existingContracts.docs[0] ?? null
      const targetQuoteId = typeof args.quoteId === 'string' && args.quoteId.trim() ? args.quoteId.trim() : null
      const quote = (targetQuoteId ? quotesRes.docs.find((q) => String(q.id) === targetQuoteId) : null) ?? quotesRes.docs[0] ?? null

      if (!contract) {
        if (!quote) {
          return {
            result: { error: '该项目还没有报价单，请先调用 create_or_update_quote 生成报价单后再创建合同' },
            summary: '缺少报价单',
            href: `/projects/${ctx.projectId}/quotes`,
          }
        }
        contract = await payload.create({
          collection: 'contracts',
          data: {
            project: project.id,
            quote: quote.id,
            status: 'draft',
            amount: quote.total ?? 0,
            customerName: project.customerName ?? null,
            customerPhone: project.customerPhone ?? null,
            address: [project.community, project.address].filter(Boolean).join(' ') || null,
            durationDays: DEFAULT_DURATION_DAYS,
            warrantyMonths: DEFAULT_WARRANTY_MONTHS,
            payments: DEFAULT_PAYMENTS.map((p) => ({ name: p.name, percent: p.percent, received: false })),
            terms: company.contractTerms?.trim() || DEFAULT_CONTRACT_TERMS,
          } as never,
          user: ctx.user,
          overrideAccess: false,
          depth: 0,
        })
      }

      const patch: Record<string, unknown> = {}
      if (contract.status !== 'signed') {
        if (typeof args.amount === 'number' && args.amount >= 0) patch.amount = Math.round(args.amount * 100) / 100
        if (typeof args.durationDays === 'number' && args.durationDays >= 1 && args.durationDays <= 365) patch.durationDays = Math.round(args.durationDays)
        if (typeof args.warrantyMonths === 'number' && args.warrantyMonths >= 0 && args.warrantyMonths <= 120) patch.warrantyMonths = Math.round(args.warrantyMonths)
        if (typeof args.terms === 'string' && args.terms.trim()) patch.terms = args.terms.trim().slice(0, 5000)
        if (Array.isArray(args.payments) && args.payments.length > 0 && args.payments.length <= 6) {
          const parsed = (args.payments as { name?: unknown; percent?: unknown; received?: unknown }[])
            .map((p) => ({
              name: typeof p.name === 'string' ? p.name.trim().slice(0, 40) : '',
              percent: typeof p.percent === 'number' ? Math.round(p.percent * 100) / 100 : 0,
              received: Boolean(p.received),
            }))
            .filter((p) => p.name && p.percent >= 0 && p.percent <= 100)
          if (parsed.length && Math.abs(paymentPercentTotal(parsed) - 100) < 0.01) {
            patch.payments = parsed
          }
        }
      } else if (Array.isArray(args.payments)) {
        const receivedFlags = (args.payments as { received?: unknown }[]).map((p) => Boolean(p?.received))
        patch.payments = (contract.payments ?? []).map((p, i) => ({
          id: p.id,
          name: p.name,
          percent: p.percent,
          received: receivedFlags[i] ?? Boolean(p.received),
        }))
      }
      if (isContractStatus(args.status) && args.status !== contract.status) {
        patch.status = args.status
        if (args.status === 'signed') patch.signedAt = new Date().toISOString()
      }

      if (Object.keys(patch).length > 0) {
        contract = await payload.update({
          collection: 'contracts',
          id: contract.id,
          data: patch as never,
          user: ctx.user,
          overrideAccess: false,
          depth: 0,
        })
      }

      ctx.mutated = true
      await refreshContextProject(ctx, ctx.projectId)
      return {
        result: {
          contractId: String(contract.id),
          number: contract.number,
          status: contract.status,
          amount: contract.amount,
          payments: contract.payments ?? [],
        },
        summary: `合同「${contract.number}」（¥${contract.amount}，${contract.status === 'signed' ? '已签订' : '草稿'}）`,
        href: `/projects/${ctx.projectId}/contract`,
        hrefLabel: '打开合同页',
      }
    },
  },
  {
    pluginId: null,
    pluginName: '打印与导出文档',
    definition: {
      type: 'function',
      function: {
        name: 'get_document_links',
        description: '获取当前项目所有可打印/导出 PDF 文档的直达链接（点位图、点位交底清单、报价单、合同、栖序提案等），支持指定风格与版式。',
        parameters: {
          type: 'object',
          properties: {
            style: {
              type: 'string',
              enum: ['qixu', 'business', 'oriental', 'tech', 'minimal'],
              description: '文档风格：qixu 栖序雅致 / business 商务蓝 / oriental 东方雅韵 / tech 科技 / minimal 简约',
            },
          },
        },
      },
    },
    async run(args, ctx) {
      if (!ctx.projectId || !ctx.project) return { result: { error: '没有关联项目' }, summary: '未关联项目' }
      const style = typeof args.style === 'string' && ['qixu', 'business', 'oriental', 'tech', 'minimal'].includes(args.style) ? args.style : 'qixu'
      const pid = ctx.projectId
      const qid = ctx.project.quote ? String(ctx.project.quote.id) : null
      const cid = ctx.project.contract ? String(ctx.project.contract.id) : null
      const links = {
        plans: `/print/projects/${pid}/plans?style=${style}`,
        checklist: `/print/projects/${pid}/checklist?style=${style}`,
        proposalQixu: `/print/projects/${pid}/proposal?template=qixu`,
        quote: qid ? `/print/quotes/${qid}?style=${style}` : null,
        contract: cid ? `/print/contracts/${cid}?style=${style}` : null,
        archive: `/projects/${pid}/archive`,
      }
      return {
        result: { project: ctx.project.project.name, style, links },
        summary: `已生成「${ctx.project.project.name}」的文档打印链接`,
        href: `/projects/${pid}/archive`,
        hrefLabel: '打开项目归档与文档页',
      }
    },
  },
  {
    pluginId: 'room-insights',
    pluginName: '房间智能分析',
    definition: {
      type: 'function',
      function: {
        name: 'room_insights',
        description: '读取当前关联项目的房间点位配置：每个房间的设备、配置完整度、缺少的必备/推荐设备和推荐场景。',
        parameters: { type: 'object', properties: {} },
      },
    },
    async run(_args, ctx) {
      if (!ctx.project) return { result: { error: '没有关联项目，请先新建或关联项目' }, summary: '未关联项目' }
      const rooms = ctx.project.rooms.map((r) => ({
        room: r.name,
        type: r.typeLabel,
        points: r.total,
        score: r.score,
        devices: r.devices.map((d) => `${deviceTypeOf(d.deviceType)?.name ?? d.deviceType}×${d.count}`),
        missing: r.missing.map((m) => `${m.label}（${m.reason}）`),
        scenes: r.scenes,
      }))
      return {
        result: { rooms, highlights: ctx.project.analysis.highlights, warnings: ctx.project.analysis.warnings },
        summary: `分析了 ${rooms.length} 个房间`,
        href: `/projects/${ctx.projectId}/point-map`,
        hrefLabel: '查看点位图',
      }
    },
  },
  {
    pluginId: 'smart-select',
    pluginName: '智能选型',
    definition: {
      type: 'function',
      function: {
        name: 'smart_select',
        description:
          '按项目主平台和档次（economy 经济 / standard 标准 / premium 高端），为当前关联项目点位图里用到的设备类型匹配默认型号。当 apply=true 时，会直接把选型结果写入该项目的默认型号。',
        parameters: {
          type: 'object',
          properties: {
            tier: { type: 'string', enum: SELECTION_TIERS.map((t) => t.value), description: 'economy 经济 / standard 标准 / premium 高端' },
            apply: { type: 'boolean', description: '是否直接写入当前项目的默认型号（默认 true）' },
          },
          required: ['tier'],
        },
      },
    },
    async run(args, ctx) {
      if (!ctx.projectId) return { result: { error: '没有关联项目' }, summary: '未关联项目' }
      const tier = isSelectionTier(args.tier) ? args.tier : 'standard'
      const shouldApply = args.apply !== false
      const payload = await getPayloadClient()
      const project = await payload
        .findByID({ collection: 'projects', id: ctx.projectId, depth: 0, user: ctx.user, overrideAccess: false, select: { status: true, platform: true, pointMap: true, defaultProducts: true } })
        .catch(() => null)
      if (!project) return { result: { error: '项目不存在或没有权限' }, summary: '项目不可用' }
      const { points } = analyzeScene(project.pointMap as Partial<StoredScene> | null)
      const types = [...new Set(points.map((p) => p.deviceType))].filter((t) => isDeviceType(t) && t !== 'other')
      const { chosen, missing } = autoSelectProducts(await getCatalog(), types, { platform: project.platform, tier })
      let applied = false
      if (shouldApply && project.status !== 'archived' && chosen.length > 0) {
        const defaults = parseDefaults(project.defaultProducts)
        for (const r of chosen) defaults[r.deviceType] = r.product.id
        await payload.update({
          collection: 'projects',
          id: ctx.projectId,
          data: { defaultProducts: defaults },
          user: ctx.user,
          overrideAccess: false,
          depth: 0,
        })
        applied = true
        ctx.mutated = true
        await refreshContextProject(ctx, ctx.projectId)
      }
      return {
        result: {
          platform: project.platform,
          tier,
          applied,
          picks: chosen.map((r) => ({
            deviceType: deviceTypeOf(r.deviceType)?.name ?? r.deviceType,
            product: r.product.name,
            brand: r.product.brand?.name,
            price: r.product.price,
            platformMatched: r.platformMatched,
          })),
          noCandidate: missing.map((t) => deviceTypeOf(t)?.name ?? t),
        },
        summary: applied ? `已应用 ${chosen.length} 类设备的默认型号` : `推荐了 ${chosen.length} 类设备的型号`,
        href: `/projects/${ctx.projectId}/point-map`,
        hrefLabel: '查看点位图',
      }
    },
  },
]

/** 本次对话可用的工具：内置工具始终可用，插件工具需对应插件已开启且已勾选。 */
export function availableTools(_modelId: string, pluginIds: string[], flags: PluginFlags) {
  return TOOLS.filter((t) => t.pluginId === null || (flags[t.pluginId] && pluginIds.includes(t.pluginId)))
}

export async function runTool(tools: AiTool[], call: LlmToolCall, ctx: ToolContext) {
  const tool = tools.find((t) => (t.definition.function as { name: string }).name === call.function.name)
  if (!tool) return { tool: null, output: { error: '未知工具' } }
  let args: Record<string, unknown> = {}
  try {
    args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>
  } catch {
    // 参数解析失败按空参数处理
  }
  try {
    const { result, summary, href, hrefLabel } = await tool.run(args, ctx)
    return { tool, output: result, summary, href, hrefLabel }
  } catch (error) {
    console.error('[ai] tool failed', call.function.name, error)
    return { tool, output: { error: `工具执行失败：${(error as Error)?.message ?? '未知错误'}` } }
  }
}
