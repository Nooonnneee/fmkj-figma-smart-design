import { describe, expect, it } from 'vitest'

import {
  assembleOverview,
  areaStatsOf,
  domainOf,
  NOT_CONFIGURED_HINT,
  readableEntityId,
  toEntityRow,
  unconfiguredData,
} from './overview'

/**
 * SM-1 数据装配层单测：喂输入 → 断言输出，覆盖已配置聚合与「未配置」分支。
 * 这些是纯函数测试，不触碰网络/环境变量，只验证聚合逻辑本身。
 */

describe('unconfiguredData 未配置分支', () => {
  it('返回 configured:false，且不做任何统计', () => {
    const d = unconfiguredData()
    expect(d.configured).toBe(false)
  })

  it('提示文案里点名 HA_MCP_ENDPOINT（引导用户去设置），不是空话', () => {
    expect(NOT_CONFIGURED_HINT).toContain('HA_MCP_ENDPOINT')
    expect(NOT_CONFIGURED_HINT).toContain('设置')
  })

  it('assembleOverview 在未配置源上直接走未配置分支，不做统计', () => {
    const d = assembleOverview({ configured: false })
    expect(d.configured).toBe(false)
    if (d.configured) throw new Error('不应进入已配置分支')
    expect(d.hint).toBe(NOT_CONFIGURED_HINT)
  })
})

describe('domainOf / readableEntityId 实体 ID 解析', () => {
  it('按前缀解析类型域', () => {
    expect(domainOf('light.living_main')).toBe('light')
    expect(domainOf('cover.garage_door')).toBe('cover')
    expect(domainOf('sensor.outdoor_temp')).toBe('sensor')
  })

  it('无前缀或缺前缀给 other', () => {
    expect(domainOf('living_main')).toBe('other')
    expect(domainOf('')).toBe('other')
  })

  it('提炼可读名段', () => {
    expect(readableEntityId('light.living_main')).toBe('living_main')
    expect(readableEntityId('living_main')).toBe('living_main')
  })
})

describe('toEntityRow 实体归一化', () => {
  it('友好的 name 优先，缺了用实体 ID 可读段兜底', () => {
    const row = toEntityRow({ entityId: 'light.living_main' })
    expect(row.name).toBe('living_main')
    expect(row.entityId).toBe('light.living_main')
    const named = toEntityRow({ entityId: 'light.living_main', name: '客厅主灯' })
    expect(named.name).toBe('客厅主灯')
  })

  it('active 判定：on/open 命中活跃集，off/unavailable 不是', () => {
    expect(toEntityRow({ entityId: 'light.a', state: 'on' }).active).toBe(true)
    expect(toEntityRow({ entityId: 'cover.b', state: 'open' }).active).toBe(true)
    expect(toEntityRow({ entityId: 'light.c', state: 'off' }).active).toBe(false)
    expect(toEntityRow({ entityId: 'light.d', state: 'unavailable' }).active).toBe(false)
  })

  it('缺 state 时给 unknown 且不算活跃', () => {
    const row = toEntityRow({ entityId: 'switch.e' })
    expect(row.state).toBe('unknown')
    expect(row.active).toBe(false)
  })
})

describe('areaStatsOf 区域聚合', () => {
  it('按区域名聚合并带排序（数量降序、同数量按区域名）', () => {
    const rows = [
      toEntityRow({ entityId: 'light.a', area: '客厅' }),
      toEntityRow({ entityId: 'light.b', area: '客厅' }),
      toEntityRow({ entityId: 'light.c', area: '卧室' }),
    ]
    expect(areaStatsOf(rows)).toEqual([
      { name: '客厅', entityCount: 2 },
      { name: '卧室', entityCount: 1 },
    ])
  })

  it('无区域实体的归入「未分配区域」', () => {
    const rows = [toEntityRow({ entityId: 'light.a' }), toEntityRow({ entityId: 'light.b' })]
    expect(areaStatsOf(rows)).toEqual([{ name: '未分配区域', entityCount: 2 }])
  })
})

/** 一份带三类实体的样例源数据（客厅 2 个、卧室 1 个，其中 2 个活跃） */
const sampleSource = {
  configured: true,
  areas: [{ name: '客厅' }, { name: '卧室' }],
  entities: [
    { entityId: 'light.living_main', name: '客厅主灯', area: '客厅', state: 'on' },
    { entityId: 'light.living_spot', name: '客厅射灯', area: '客厅', state: 'on' },
    { entityId: 'switch.bedroom', name: '卧室开关', area: '卧室', state: 'off' },
  ],
  health: { version: '2025.10', errors: 0, offline: 1 },
}

describe('assembleOverview 已配置聚合', () => {
  it('总览统计：实体总数、活跃数、区域统计都正确', () => {
    const d = assembleOverview(sampleSource)
    if (!d.configured) throw new Error('应进入已配置分支')
    expect(d.totalEntities).toBe(3)
    expect(d.activeEntities).toBe(2)
    expect(d.areas).toEqual([
      { name: '客厅', entityCount: 2 },
      { name: '卧室', entityCount: 1 },
    ])
  })

  it('实体列表完整保留领域/区域/状态', () => {
    const d = assembleOverview(sampleSource)
    if (!d.configured) throw new Error('应进入已配置分支')
    expect(d.entities).toHaveLength(3)
    const first = d.entities[0]!
    expect(first.entityId).toBe('light.living_main')
    expect(first.domain).toBe('light')
    expect(first.area).toBe('客厅')
    expect(first.state).toBe('on')
    expect(first.active).toBe(true)
  })

  it('健康卡数据透传', () => {
    const d = assembleOverview(sampleSource)
    if (!d.configured) throw new Error('应进入已配置分支')
    expect(d.health).toEqual({ version: '2025.10', errors: 0, offline: 1 })
  })

  it('health 缺失时页面拿 null，不伪造健康卡', () => {
    const d = assembleOverview({ configured: true, entities: [] })
    if (!d.configured) throw new Error('应进入已配置分支')
    expect(d.health).toBeNull()
  })

  it('无实体源但有区域计数时，总数用区域计数兜底', () => {
    const d = assembleOverview({
      configured: true,
      areas: [
        { name: '客厅', entityCount: 3 },
        { name: '卧室', entityCount: 2 },
      ],
      entities: [],
    })
    if (!d.configured) throw new Error('应进入已配置分支')
    expect(d.totalEntities).toBe(5)
    expect(d.areas).toEqual([
      { name: '客厅', entityCount: 3 },
      { name: '卧室', entityCount: 2 },
    ])
    expect(d.activeEntities).toBe(0)
  })

  it('完全空的已配置源给出零统计结构，不炸', () => {
    const d = assembleOverview({ configured: true })
    if (!d.configured) throw new Error('应进入已配置分支')
    expect(d.totalEntities).toBe(0)
    expect(d.activeEntities).toBe(0)
    expect(d.areas).toEqual([])
    expect(d.entities).toEqual([])
    expect(d.health).toBeNull()
  })
})