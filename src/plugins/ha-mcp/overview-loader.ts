/**
 * SM-1 数据加载器：页面（Server Component）→ read handler 结果的桥。
 *
 * 职责很窄：判断是否已配置 → 逐个调用 ha-mcp 的只读能力（get_overview /
 * list_areas / search_entities / get_system_health）→ 把 MCP 回的结构化内容
 * 归一化成 `overview.ts` 的 `OverviewSource`，交给纯函数 `assembleOverview` 聚合。
 *
 * 刻意**不在这层做任何统计/过滤**：那些全在 `overview.ts` 的纯函数里，能被单测
 * 直接断言。这里只做「拿数据 + 拍平 + 表防错」，尽量薄。
 *
 * ⚠️ 只读、不控制：本期页面只呈现（smart-home:read），不调用 ha_call_service，
 * 也不做历史图表。
 *
 * 未配置（HA_MCP_ENDPOINT 缺省）→ 立即返回 `{ configured: false }` 的结构化空态，
 * 页面据此渲染「请在设置中配置 Home Assistant 连接」，不静默失败也不 500。
 */

import { callTool, type HaMcpConfig } from './mcp-client'
import type { OverviewSource } from './overview'

/** 读页面侧连接配置；未配置返回 null（与 ai-handlers.ts 的 readConfig 同一口径）。 */
export function readPageConfig(): HaMcpConfig | null {
  const endpoint = process.env.HA_MCP_ENDPOINT?.trim()
  if (!endpoint) return null
  const token = process.env.HA_MCP_TOKEN?.trim()
  return {
    endpoint,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    timeoutMs: Number(process.env.HA_MCP_TIMEOUT_MS ?? 20_000),
  }
}

/** MCP 返回的结构化内容：可能是任意形状，逐字段防御性读取。 */
type RawToolContent = unknown

function asRecord(x: unknown): Record<string, unknown> | null {
  return x && typeof x === 'object' && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : null
}

const pick = (rec: Record<string, unknown>, keys: string[]): unknown => {
  for (const k of keys) if (rec[k] != null) return rec[k]
  return undefined
}

const toNum = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

/** 把 MCP 结构化内容里的实体/区域/健康字段抽取成 OverviewSource。 */
export function normalizeToolResult(raw: RawToolContent): OverviewSource {
  const rec = asRecord(raw)
  if (!rec) return { configured: true }

  // 区域内嵌实体（各 HA-MCP 实现命名不一，尽量兼容常见的几种）
  const areasRawRaw = pick(rec, ['areas', 'floors', 'areaList', 'rooms']) ?? []
  const areasRaw = Array.isArray(areasRawRaw)
    ? (areasRawRaw as unknown[]).map(asRecord).filter(Boolean)
    : []

  const entities: OverviewSource['entities'] = []
  const areas: OverviewSource['areas'] = []

  for (const a of areasRaw as Record<string, unknown>[]) {
    const name = String(pick(a, ['name', 'area', 'label', 'id']) ?? '').trim()
    if (!name) continue
    const entityArr = Array.isArray(a.entities) ? (a.entities as unknown[]) : []
    // 该区域的实体：优先内嵌实体数组，否则回退 entity_count
    if (entityArr.length > 0) {
      for (const ent of entityArr) {
        const er = asRecord(ent)
        if (!er) continue
        const entityId = String(pick(er, ['entityId', 'entity_id', 'id']) ?? '').trim()
        if (!entityId) continue
        entities.push({
          entityId,
          name: String(pick(er, ['name', 'friendlyName', 'friendly_name', 'label']) ?? ''),
          area: name,
          state: String(pick(er, ['state', 'status', 'value']) ?? ''),
        })
      }
    }
    const count = pick(a, ['entityCount', 'entity_count', 'deviceCount', 'devices'])
    areas.push({ name, entityCount: toNum(count) ?? entityArr.length })
  }

  // 顶层实体列表（area 嵌得深、实现拿不出时兜底）
  const topEntitiesRaw = pick(rec, ['entities', 'entityList', 'states', 'devices']) ?? []
  if (Array.isArray(topEntitiesRaw)) {
    for (const ent of topEntitiesRaw as unknown[]) {
      const er = asRecord(ent)
      if (!er) continue
      const entityId = String(pick(er, ['entityId', 'entity_id', 'id']) ?? '').trim()
      if (!entityId) continue
      entities.push({
        entityId,
        name: String(pick(er, ['name', 'friendlyName', 'friendly_name', 'label']) ?? ''),
        area: String(pick(er, ['area', 'areaName', 'room']) ?? '') || null,
        state: String(pick(er, ['state', 'status', 'value']) ?? ''),
      })
    }
  }

  const healthRec = asRecord(pick(rec, ['health', 'systemHealth', 'diagnostics']))
  let health: OverviewSource['health']
  if (healthRec) {
    const version = String(
      pick(healthRec, ['version', 'coreVersion', 'haVersion', 'hassVersion']) ?? '',
    )
    // 错误集/离线数都可能以数组或数值出现，归一到数字
    const errRaw = pick(healthRec, ['errors', 'integrationErrors', 'failed', 'errorCount'])
    const offRaw = pick(healthRec, ['offline', 'offlineDevices', 'unavailable'])
    health = {
      version: version.trim(),
      errors: Array.isArray(errRaw) ? errRaw.length : (toNum(errRaw) ?? 0),
      offline: Array.isArray(offRaw) ? offRaw.length : (toNum(offRaw) ?? 0),
    }
  }

  return { configured: true, areas, entities, health }
}

/**
 * 页面数据加载入口（Server Component 调用）：
 * 未配置 → `{ configured:false }`；已配置 → 拉真实数据并归一化成 OverviewSource。
 * 单工具的失败只影响该区块，不让整页崩（页面自己按空区块渲染）。
 */
export async function loadOverview(): Promise<OverviewSource> {
  const config = readPageConfig()
  if (!config) return { configured: false }

  const sourceBase: OverviewSource = { configured: true }
  try {
    // 用 overview 覆盖区域+实体两个区块；找不到实体时再补一次全量搜索。
    const overview = await callTool(config, 'ha_get_overview', { include_states: true })
    sourceBase.areas = []
    sourceBase.entities = []

    const structured = asRecord(overview.raw)
    if (structured) {
      const nested = normalizeToolResult(structured)
      sourceBase.areas = nested.areas ?? []
      sourceBase.entities = nested.entities ?? []
    }

    // 实体不足时用 list_areas / search_entities 补齐
    if ((sourceBase.entities ?? []).length === 0) {
      try {
        const areas = await callTool(config, 'ha_list_floors_areas', {})
        if (asRecord(areas.raw)) {
          const nested = normalizeToolResult(areas.raw)
          if (sourceBase.areas?.length === 0 && nested.areas?.length) {
            sourceBase.areas = nested.areas
          }
        }
      } catch {
        /* 区域读取失败不阻塞实体与健康 */
      }
    }
    if ((sourceBase.entities ?? []).length === 0) {
      try {
        const search = await callTool(config, 'ha_search_entities', { query: '', limit: 200 })
        if (asRecord(search.raw)) {
          const nested = normalizeToolResult(search.raw)
          if (nested.entities?.length) sourceBase.entities = nested.entities
        }
      } catch {
        /* 搜索失败不阻塞健康 */
      }
    }

    // 系统健康独立拉取；失败时把 health 留空，页面显示「暂无健康数据」
    try {
      const health = await callTool(config, 'ha_get_system_health', {})
      const h = asRecord(health.raw)
      if (h) sourceBase.health = normalizeToolResult(h).health ?? undefined
    } catch {
      /* 健康缺失不是致命错误 */
    }
  } catch {
    // 总览主调用失败：保留已 partial 拉到的数据（可能为空），不吞配置态
  }

  return sourceBase
}