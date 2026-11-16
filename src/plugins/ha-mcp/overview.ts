/**
 * 「智能家居」独立页（/smart-home）的只读数据装配层（SM-1）。
 *
 * 目标：把现场 Home Assistant 通过 ha-mcp 读回来的**生数据**（区域清单、实体列表、
 * 系统健康）聚合成页面刚好够用的结构 —— 总览统计、实体行、区域分布、健康卡。
 *
 * 这份文件只放**纯函数 + 类型**：不碰网络、不读环境变量、不调用 mcp-client，
 * 唯一目的是给页面一个可单测的「喂输入 → 断言输出」的数据变换中枢
 * （延续页面数据模式：页面渲染前唯一会变的逻辑集中在此，直接断言结果，
 * 避免被渲染层源码字符串敷衍过去）。
 *
 * 未配置（configured=false）走 `unconfiguredData()`，页面据此渲染空态引导，
 * 不做任何统计。
 */

/** 一个实体的页面可见行：实体 ID、显示名、所属区域、类型域、状态、是否「活跃在线上」。 */
export type EntityRow = {
  entityId: string
  /** 优先取「友好名」，没有就用实体 ID 的可读段兜底 */
  name: string
  area: string | null
  /** 实体类型域，由 entity_id 前缀（如 light / switch / cover）推断 */
  domain: string
  state: string
  /** 是否算「在线/开启」：见 ACTIVE_STATES */
  active: boolean
}

/** 区域统计：某区域名 + 该区域下的实体数量 */
export type AreaStat = { name: string; entityCount: number }

/** 系统健康卡数据（未提供时为 null） */
export type SystemHealth = {
  version: string | null
  /** 集成报错数（页面上 0 视为健康） */
  errors: number
  /** 离线设备数量 */
  offline: number
}

/** 已配置且聚合完成的页面数据 */
export type SmartHomeOverview = {
  configured: true
  totalEntities: number
  /** 当前处于「在线/开启」状态的实体数 */
  activeEntities: number
  areas: AreaStat[]
  entities: EntityRow[]
  health: SystemHealth | null
}

/** 未配置时的结构化返回：页面据此渲染空态 + 引导文案 */
export type SmartHomeUnconfigured = {
  configured: false
  /** 提示用户去哪配置（保持与 ha-mcp 的提示一致） */
  hint: string
}

/** 页面数据装配层对外暴露的最终形态（判别联合，按 configured 分支渲染） */
export type SmartHomeData = SmartHomeOverview | SmartHomeUnconfigured

/** 装配层接受的标准「源数据」形态 —— 由页面数据加载器（overview-loader.ts）从 read handler 结果里归一化而来。 */
export type OverviewSource = {
  configured: boolean
  /** 区域及其实体数量（对应 ha_get_overview 的区域统计 / ha_list_areas） */
  areas?: Array<{ name: string; entityCount?: number }>
  /** 实体列表（对应 ha_search_entities 的非受限返回） */
  entities?: Array<{ entityId: string; name?: string; area?: string | null; state?: string }>
  /** 系统健康（对应 ha_get_system_health） */
  health?: { version?: string; errors?: number; offline?: number }
}

/** 未配置引导文案：与 ai-handlers.ts 的 NOT_CONFIGURED 措辞一致，告诉用户去哪配。 */
export const NOT_CONFIGURED_HINT =
  '还没有连接客户现场的 Home Assistant。请在设置里配置 HA_MCP_ENDPOINT（形如 https://<你的 HA 域名>/api/webhook/<webhook-id> 或 http://<ha-ip>:9584/private_xxx），必要时再加 HA_MCP_TOKEN。'

/** 未配置分支：不聚合任何统计，直接给空态数据。 */
export function unconfiguredData(): SmartHomeUnconfigured {
  return { configured: false, hint: NOT_CONFIGURED_HINT }
}

/**
 * 判定实体是否「活跃/在线」。HA 的开关/状态枚举庞杂，只用一组明确的
 * 「处于开/在线/可用」态白名单：命中算活跃，其余（off、unavailable、closed…）算非活跃。
 * 放进表达式后的纯逻辑，目的是让统计口径可测、可调，而不是散落在渲染层。
 */
const ACTIVE_STATES = new Set([
  'on',
  'open',
  'home',
  'opened',
  'unlocked',
  'playing',
  'available',
  'connected',
])

/** 从实体 ID 推断类型域：`light.living_main` → `light`；缺前缀时给 `other`。 */
export function domainOf(entityId: string): string {
  const dot = entityId.indexOf('.')
  if (dot <= 0) return 'other'
  return entityId.slice(0, dot)
}

/** 从实体 ID 提炼可读名段：`light.living_main` → `living_main`，供 name 兜底。 */
export function readableEntityId(entityId: string): string {
  const dot = entityId.indexOf('.')
  return dot >= 0 ? entityId.slice(dot + 1) : entityId
}

/** 归一化一条实体源记录 → EntityRow。纯函数，直接喂进测试。 */
export function toEntityRow(
  e: NonNullable<OverviewSource['entities']>[number],
): EntityRow {
  const entityId = (e.entityId ?? '').trim()
  return {
    entityId,
    name: (e.name ?? '').trim() || readableEntityId(entityId),
    area: (e.area ?? '').trim() || null,
    domain: domainOf(entityId),
    state: (e.state ?? '').trim() || 'unknown',
    active: ACTIVE_STATES.has((e.state ?? '').trim()),
  }
}

/** 按区域聚合实体数量（同时折叠「未分配区域」）。只统计已归一化后的实体，顺序稳定。 */
export function areaStatsOf(entities: readonly EntityRow[]): AreaStat[] {
  const byName = new Map<string, number>()
  for (const e of entities) {
    const key = e.area ? e.area : '未分配区域'
    byName.set(key, (byName.get(key) ?? 0) + 1)
  }
  return [...byName.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hans-CN'))
    .map(([name, entityCount]) => ({ name, entityCount }))
}

/**
 * 装配入口（纯函数）：把归一化好的 OverviewSource 聚合成 SmartHomeOverview。
 * - configured=false → 直接走未配置分支（不做统计）。
 * - 已配置：实体列表优先从 `source.entities` 得出；若实体源缺失，退回用
 *   `source.areas` 的 entityCount 汇总 totalEntities（仍可展示区域统计）。
 */
export function assembleOverview(source: OverviewSource): SmartHomeData {
  if (!source?.configured) return unconfiguredData()

  const entities = (source.entities ?? []).map(toEntityRow)
  const totalEntities =
    entities.length > 0
      ? entities.length
      : (source.areas ?? []).reduce((sum, a) => sum + (a.entityCount ?? 0), 0)
  const activeEntities = entities.filter((e) => e.active).length

  const areas: AreaStat[] =
    entities.length > 0
      ? areaStatsOf(entities)
      : (source.areas ?? [])
          .map((a) => ({ name: a.name, entityCount: a.entityCount ?? 0 }))
          .filter((a) => a.name)
          .sort((a, b) => b.entityCount - a.entityCount)

  const health: SystemHealth | null = source.health
    ? {
        version: (source.health.version ?? '').trim() || null,
        errors: source.health.errors ?? 0,
        offline: source.health.offline ?? 0,
      }
    : null

  return {
    configured: true,
    totalEntities,
    activeEntities,
    areas,
    entities,
    health,
  }
}