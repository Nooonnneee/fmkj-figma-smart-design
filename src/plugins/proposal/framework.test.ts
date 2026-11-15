/**
 * 方案章节编排回归：封面固定第一页、章节去重、投资明细在服务交付之前、
 * 服务交付固定最后，以及「没有点位时不出现平面 / 场景等空章节」。
 * 这些规则错了，客户 PDF 会缺页或章节顺序乱掉。
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/payload', () => ({ getPayloadClient: async () => null }))
vi.mock('@/lib/cached-data', () => ({
  getCatalog: async () => [],
  getCompanyInfo: async () => ({ name: '公司' }),
  resolveMediaUrl: () => null,
}))
vi.mock('@/lib/scenes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/scenes')>()
  return { ...actual, loadSceneLibrary: async () => ({ scenes: [], source: 'builtin' }) }
})
vi.mock('next/image', () => ({ default: () => null }))

import type { ProjectDocsData } from '@/lib/project-docs'

import {
  DECK_SECTIONS,
  frameworkSections,
  isDeckSection,
  kindOfFramework,
  normalizeSections,
} from './framework'
import { buildDeck } from './deck/model'
import { deckPages, countDeckPages } from './deck/index'
import { deckScenes } from './deck/pages/scenes'
import { DECK_THEMES } from './deck/themes'

describe('normalizeSections：编排规范', () => {
  it('封面永远在第一页，即使模板没选封面也会补上', () => {
    expect(normalizeSections(['investment', 'service'], 'full')[0]).toBe('cover')
    expect(normalizeSections([], 'full')[0]).toBe('cover')
  })

  it('重复章节只保留第一次出现', () => {
    expect(normalizeSections(['plans', 'plans', 'system', 'plans'], 'full')).toEqual([
      'cover',
      'plans',
      'system',
    ])
  })

  it('投资明细排在服务交付之前，服务交付固定在最后', () => {
    expect(normalizeSections(['service', 'investment', 'zones'], 'full')).toEqual([
      'cover',
      'zones',
      'investment',
      'service',
    ])
  })

  it('非法章节被忽略，不会出现在方案里', () => {
    expect(normalizeSections(['plans', 'bogus', 42, null], 'full')).toEqual(['cover', 'plans'])
  })

  it('空列表回退到版式框架的推荐章节', () => {
    expect(normalizeSections([], 'budget')).toEqual(frameworkSections('budget'))
    expect(normalizeSections([], 'story')).toEqual(frameworkSections('story'))
  })

  it('施工交底不参与章节编排（返回空）', () => {
    expect(normalizeSections(['plans', 'investment'], 'construction')).toEqual([])
  })
})

describe('章节与框架的取值一致性', () => {
  it('框架里的章节都是合法章节，且施工交底框架为空', () => {
    for (const id of ['full', 'story', 'budget'] as const) {
      for (const s of frameworkSections(id)) expect(isDeckSection(s), `${id}:${s}`).toBe(true)
    }
    expect(frameworkSections('construction')).toEqual([])
  })

  it('kindOfFramework：只有施工交底是 construction', () => {
    expect(kindOfFramework('construction')).toBe('construction')
    expect(kindOfFramework('full')).toBe('owner')
    expect(kindOfFramework('budget')).toBe('owner')
  })

  /**
   * 这里只钉「声明」本身，名字就是它测的东西。
   * 装配层的 needsPoints 集合在 deck/index.tsx 里是私有常量，无法从外部读到；
   * 之前那条「声明与装配一致」把声明和硬编码字面量比，根本没碰装配层，
   * 删掉 'zones' 也照样绿 —— 已删除。装配层真正可观测的证据是下面
   * 「上传了图纸但一个点位都没有」那条（只有 plans 能凭空产出页面）。
   */
  it('DECK_SECTIONS 的 needsPoints 声明：平面/系统/空间/场景/其余空间需要点位', () => {
    const declared = DECK_SECTIONS.filter((s) => s.needsPoints).map((s) => s.value)
    expect(new Set(declared)).toEqual(new Set(['plans', 'system', 'zones', 'scenes', 'rooms']))
  })
})

describe('deckPages 装配：页数与顺序', () => {
  /**
   * 装配层 `needsPoints` 集合里，'plans' 和 'scenes' 是可观测的：
   * - plans：有图纸、无点位时必须 0 页（渲染函数会为每张图纸无条件出一页）；
   * - scenes：场景不限设备且空间没有点位时，deckScenes 仍会匹配出场景并渲染出页，
   *   必须靠集合拦截才为 0（复核实测：从 needsPoints 删掉 'scenes' 会变成 1 页）。
   * system / zones / rooms 的渲染函数在无数据时自己就不 push 任何页，
   * 从集合里删掉也不会多出一页（等价变异，测不出来）。
   */
  it('有图纸但无点位时，装配层拦住平面页（needsPoints 里唯一可观测的章节）', () => {
    const d = {
      ...(emptyDocs() as unknown as Record<string, unknown>),
      sheets: [
        {
          id: 's1',
          elementId: 'e1',
          index: 0,
          name: '一层平面',
          x: 0,
          y: 0,
          width: 1000,
          height: 700,
          fileId: 'floor',
          url: '/floor.png',
          missing: false,
        },
      ],
    } as unknown as ProjectDocsData
    expect(buildDeck(d).sheets).toHaveLength(1)
    expect(
      deckPages(d, DECK_THEMES.qixu, { markers: 'symbol', insights: true, sections: ['plans'] }),
    ).toHaveLength(0)
  })
  it('场景不限设备 + 空间无点位：装配层拦住场景页（needsPoints 里第二个可观测的章节）', () => {
    // 后台场景允许 requiredDevices / anyDevices 都留空（不限设备）。
    // 这种情况下 deckScenes 仍能从「有该场景标记但 0 点位」的空间匹配出场景并渲染出页，
    // 所以真实方案要靠 needsPoints 里的 'scenes' 才为 0 页。
    // 变红方式：从 deck/index.tsx 的 needsPoints 删掉 'scenes' → 这里变成 1 页。
    const scene = {
      id: 'sc-1',
      name: '回家',
      summary: '开灯并拉开窗帘',
      headline: null,
      subtitle: null,
      tagline: null,
      steps: [],
      image: null,
      scope: 'room' as const,
      chapter: 'arrive',
      roomTypes: [],
      requiredDevices: [],
      anyDevices: [],
    }
    const d = {
      ...(emptyDocs() as unknown as Record<string, unknown>),
      sceneLibrary: [scene],
      rooms: [
        {
          areaId: 'a1',
          areaIds: ['a1'],
          name: '客厅',
          areaType: 'living',
          typeLabel: '客厅',
          devices: [],
          total: 0,
          met: [],
          missing: [],
          warnings: [],
          scenes: [`${scene.name}：${scene.summary}`],
          score: 100,
          floorName: '一层',
          displayName: '客厅',
          sheets: [],
          points: [],
          lines: [],
          subtotal: 0,
        },
      ],
    } as unknown as ProjectDocsData
    // 先证明场景匹配本身不是空转：deckScenes 能产出 1 个场景
    expect(deckScenes(buildDeck(d))).toHaveLength(1)
    expect(
      deckPages(d, DECK_THEMES.qixu, { markers: 'symbol', insights: true, sections: ['scenes'] }),
    ).toHaveLength(0)
  })
  const emptyDocs = () =>
    ({
      project: {
        id: 'p',
        name: '空项目',
        community: '',
        address: '',
        customerName: '',
        platform: '米家',
      },
      owner: null,
      company: { name: '公司' },
      sceneLibrary: [],
      sceneSource: 'builtin',
      sheets: [],
      areas: [],
      points: [],
      rooms: [],
      floors: [],
      roomKey: {},
      analysis: {},
      products: [],
      productById: new Map(),
      categories: [],
      total: 0,
      pending: 0,
      quote: null,
      quotes: [],
      contract: null,
      projectList: [],
      scope: 'all',
      finalQuoteId: null,
      finalQuoteSource: 'latest',
      proposalTemplate: null,
    }) as unknown as ProjectDocsData

  it('没有点位时只保留封面、投资与服务交付（不出现空白平面页）', () => {
    const pages = deckPages(emptyDocs(), DECK_THEMES.qixu, { markers: 'symbol', insights: true })
    expect(pages).toHaveLength(3)
    expect(countDeckPages(emptyDocs(), DECK_THEMES.qixu, { insights: true })).toBe(3)
  })

  it('上传了图纸但一个点位都没有：也不生成空白平面页', () => {
    // 这是 needsPoints 过滤真正起作用的场景：图纸存在，plan 章节会无条件为每张图纸出一页。
    const d = {
      ...(emptyDocs() as unknown as Record<string, unknown>),
      sheets: [
        {
          id: 's1',
          elementId: 'e1',
          index: 0,
          name: '一层平面',
          x: 0,
          y: 0,
          width: 1000,
          height: 700,
          fileId: 'floor',
          url: '/floor.png',
          missing: false,
        },
      ],
    } as unknown as ProjectDocsData
    // buildDeck 在 scope=all 时会保留空图纸
    expect(buildDeck(d).sheets).toHaveLength(1)
    const pages = deckPages(d, DECK_THEMES.qixu, { markers: 'symbol', insights: true })
    expect(pages).toHaveLength(3)
  })

  it('指定的章节按模板顺序装配，投资在服务之前', () => {
    const d = emptyDocs()
    const sections = normalizeSections(['service', 'investment'], 'full')
    expect(sections).toEqual(['cover', 'investment', 'service'])
    // 装配层与编排层使用同一份章节列表，页面数 = 章节各 1 页
    expect(
      deckPages(d, DECK_THEMES.qixu, { markers: 'symbol', insights: true, sections }),
    ).toHaveLength(3)
  })

  it('没有任何点位时 buildDeck 仍能算出 0 金额，不写 NaN', () => {
    const m = buildDeck(emptyDocs())
    expect(m.finalAmount).toBe(0)
    expect(Number.isFinite(m.finalAmount)).toBe(true)
    expect(m.nodes.reduce((s, n) => s + n.amount, 0)).toBe(0)
  })
})
