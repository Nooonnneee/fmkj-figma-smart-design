/**
 * 显示方案一致性回归：四个预设 × 三个画平面图的页（plan / zone / network-camera）
 * 必须是同一套网格 / 覆盖圈 / 光晕 / 底图透明度——同一份 PDF 里不能前后不一致。
 *
 * 这里真的渲染三个页面组件（react-dom/server），读渲染结果里实际生效的
 * 底图 opacity、effects 图层、覆盖编号，而不是只读源码 props。
 * 只量 PlanView 的子树：整页 HTML 里右侧配置栏会无条件印出点位代号，
 * 拿整页 includes(code) 当证据永远为真，覆盖圈关掉也测不出来。
 * 最后一条从 deckPages 进去，验证装配层（index.tsx 的 resolveDisplayProfile）真的接上。
 * Payload / 产品库 / 场景库都换成内存 fixture，不连数据库、不发网络请求。
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/payload', () => ({ getPayloadClient: async () => null }))
vi.mock('@/lib/cached-data', () => ({
  getCatalog: async () => [],
  getCompanyInfo: async () => ({ name: '证据公司' }),
  resolveMediaUrl: (m: { url?: string } | null) => m?.url ?? null,
}))
vi.mock('@/lib/scenes', () => ({
  loadSceneLibrary: async () => ({ scenes: [], source: 'builtin' }),
  assignScenes: () => [],
}))
vi.mock('next/image', () => ({
  default: ({ src, alt = '' }: { src?: unknown; alt?: string }) =>
    createElement('img', { src: typeof src === 'string' ? src : undefined, alt }),
}))

import { DISPLAY_PROFILES, resolveDisplayProfile } from '@/lib/display-profile'
import type { ProjectDocsData } from '@/lib/project-docs'
import { deckPages } from './index'
import { buildDeck } from './model'
import { buildNetworkCamera } from './network-camera'
import { NetworkCameraPage } from './pages/network-camera'
import { PlanPage } from './pages/plan'
import { ZonePage } from './pages/zone'
import type { DeckCtx } from './parts'
import { DECK_THEMES } from './themes'

const sheet = {
  id: 's1',
  elementId: 'e1',
  index: 0,
  name: '一层平面',
  x: 0,
  y: 0,
  width: 1000,
  height: 700,
  fileId: 'floor',
  url: '/sample-floor.png',
  missing: false,
}
const areas = [
  {
    id: 'a1',
    name: '客厅',
    areaType: 'living',
    sheetId: 's1',
    x: 0,
    y: 0,
    width: 500,
    height: 350,
    poly: null,
  },
  {
    id: 'a2',
    name: '主卧',
    areaType: 'bedroom',
    sheetId: 's1',
    x: 500,
    y: 0,
    width: 400,
    height: 350,
    poly: null,
  },
]
const pt = (
  id: string,
  deviceType: string,
  code: string,
  cx: number,
  cy: number,
  areaId: string,
) => ({
  id,
  deviceType,
  productId: null,
  code,
  cx,
  cy,
  sheetId: 's1',
  rx: cx / 1000,
  ry: cy / 700,
  areaId,
  angle: 0,
  source: 'pending' as const,
})
const points = [
  pt('p1', 'ap-node', 'N01', 200, 150, 'a1'),
  pt('p2', 'downlight', 'L01', 300, 200, 'a1'),
  pt('p3', 'motion-sensor', 'S01', 600, 150, 'a2'),
  pt('p4', 'camera', 'V01', 700, 250, 'a2'),
]
const room = (areaId: string, name: string, areaType: string, tp: typeof points) => ({
  areaId,
  areaIds: [areaId],
  name,
  areaType,
  typeLabel: name,
  devices: [],
  total: tp.length,
  met: [],
  missing: [],
  warnings: [],
  scenes: [],
  score: 100,
  floorName: '一层',
  displayName: name,
  sheets: ['一层平面'],
  points: tp,
  lines: tp.map((p) => ({
    deviceType: p.deviceType,
    typeName: p.deviceType,
    product: null,
    count: 1,
    unitPrice: 0,
    subtotal: 0,
    codes: [p.code],
  })),
  subtotal: 0,
})
const docs = {
  project: {
    id: 'p',
    name: '证据项目',
    community: '',
    address: '',
    customerName: '业主',
    platform: '米家',
  },
  owner: null,
  company: { name: '证据公司' },
  sceneLibrary: [],
  sceneSource: 'builtin',
  sheets: [sheet],
  areas,
  points,
  rooms: [
    room(
      'a1',
      '客厅',
      'living',
      points.filter((p) => p.areaId === 'a1'),
    ),
    room(
      'a2',
      '主卧',
      'bedroom',
      points.filter((p) => p.areaId === 'a2'),
    ),
  ],
  floors: [
    {
      sheetId: 's1',
      floorName: '一层',
      sheetName: '一层平面',
      roomCount: 2,
      pointCount: 4,
      subtotal: 0,
    },
  ],
  roomKey: {},
  analysis: {},
  products: [],
  productById: new Map(),
  categories: [],
  total: 0,
  pending: 4,
  quote: null,
  quotes: [],
  contract: null,
  projectList: [],
  scope: 'all',
  finalQuoteId: null,
  finalQuoteSource: 'latest',
  proposalTemplate: null,
} as unknown as ProjectDocsData

const m = buildDeck(docs)
const network = buildNetworkCamera(m)!
/** 只有 rest / care 章节会画房间小平面（zone.tsx 的 RoomMini），用卧室那一章取证 */
const miniZone = m.zones.find((z) => z.key === 'rest')!

/**
 * 从整页渲染结果里只取出 PlanView 的子树。
 *
 * 整页 HTML 不能直接拿来判断「图上有没有编号」：network-camera 页右侧的配置栏
 * 会把每个点位代号（N01 等）无条件印出来（pages/network-camera.tsx 的 codeRange），
 * 于是 html.includes('N01') 永远为真，覆盖圈关掉也测不出来。
 * PlanView 的根节点是 `<div class="relative shrink-0 overflow-hidden" style="width:…;height:…">`
 * （parts.tsx），页面里只此一处；按它切出子树后再量。
 */
const PLAN_VIEW_ROOT = '<div class="relative shrink-0 overflow-hidden" style="width:'
function planViewMarkup(html: string): string {
  const start = html.indexOf(PLAN_VIEW_ROOT)
  if (start < 0) throw new Error('页面里没有 PlanView')
  let depth = 0
  let i = start
  while (i < html.length) {
    const open = html.indexOf('<div', i)
    const close = html.indexOf('</div>', i)
    if (close < 0) throw new Error('PlanView 子树未闭合')
    if (open >= 0 && open < close) {
      depth++
      i = open + 4
    } else {
      depth--
      i = close + 6
      if (depth === 0) return html.slice(start, i)
    }
  }
  throw new Error('PlanView 子树未闭合')
}

/**
 * 从 PlanView 的渲染结果里读实际生效的底图不透明度、effects 图层、覆盖编号。
 * code 传该页图上真实存在的那个点位编号（plan 整层用 N01，zone 只画卧室用 S01）。
 */
function measure(html: string, code: string) {
  const plan = planViewMarkup(html)
  const opacity = /opacity:([0-9.]+)/.exec(plan)?.[1]
  return {
    opacity: opacity ? Number(Number(opacity).toFixed(4)) : null,
    effects: /data-point-display-effects/.test(plan),
    // 网格只认 PlanView 子树里 SVG 实际画出的那层，配置栏不印网格，可整页无歧义
    grid: /data-deck-plan-grid/.test(plan),
    // 编号只认 SVG 里 <text> 画出来的那个，不认配置栏 / title 里的同名字符串
    codes: new RegExp(`>${code}</text>`).test(plan),
  }
}

function renderAll(profileId: string) {
  const ctx: DeckCtx = {
    m,
    theme: DECK_THEMES.qixu,
    markers: 'symbol',
    profile: resolveDisplayProfile(profileId),
  }
  return {
    plan: measure(
      renderToStaticMarkup(
        createElement(PlanPage, { ctx, no: 2, total: 9, s: m.sheets[0], first: true }),
      ),
      'N01',
    ),
    zone: measure(
      renderToStaticMarkup(
        createElement(ZonePage, { ctx, no: 4, total: 9, zone: miniZone, insights: true }),
      ),
      'S01',
    ),
    network: measure(
      renderToStaticMarkup(
        createElement(NetworkCameraPage, {
          ctx,
          no: 3,
          total: 9,
          network,
          s: network.sheets[0],
        }),
      ),
      'N01',
    ),
  }
}

type Measured = ReturnType<typeof measure>
type Table = Record<string, { plan: Measured; zone: Measured; network: Measured }>

/**
 * 走真实装配入口（deck/index.tsx 的 deckPages）渲染整套方案，按页眉名取出目标页。
 * 这里不手搭 DeckCtx：profile 必须由 deckPageRenders 里的
 * resolveDisplayProfile(d.project.displayProfile) 解析并下发，才能证明装配层真的接上了。
 */
function renderDeck(displayProfile: unknown) {
  const d = {
    ...docs,
    project: { ...docs.project, displayProfile },
  } as unknown as ProjectDocsData
  const pages = deckPages(d, DECK_THEMES.qixu, { markers: 'symbol', insights: true }).map((page) =>
    renderToStaticMarkup(page),
  )
  const pick = (frameIncludes: string) => {
    const page = pages.find((html) =>
      /data-figma-frame="([^"]*)"/.exec(html)?.[1]?.includes(frameIncludes),
    )
    if (!page) throw new Error(`deckPages 里没有「${frameIncludes}」页`)
    return page
  }
  return {
    plan: pick('住宅平面'),
    zone: pick('REST'),
    network: pick('全屋网络与检测覆盖'),
  }
}

/** 与 renderAll 相同的口径：plan 整层用 N01，zone 只画卧室用 S01，network 用 N01 */
const measureDeck = (deck: ReturnType<typeof renderDeck>) => ({
  plan: measure(deck.plan, 'N01'),
  zone: measure(deck.zone, 'S01'),
  network: measure(deck.network, 'N01'),
})

describe('显示方案：三个画平面图的页', () => {
  it('四个预设 × 三页的实际渲染结果', () => {
    const table: Table = Object.fromEntries(DISPLAY_PROFILES.map((p) => [p.id, renderAll(p.id)]))
    // 打印成一行，便于贴进提交说明 / 复核记录；CI 里不再刷日志
    if (!process.env.CI) {
      for (const [id, row] of Object.entries(table)) {
        process.stdout.write(
          `${id.padEnd(13)} plan=${JSON.stringify(row.plan)} zone=${JSON.stringify(row.zone)} network=${JSON.stringify(row.network)}\n`,
        )
      }
    }
    expect(Object.keys(table)).toHaveLength(4)
  })

  it('plan 与 zone 完全跟随方案：覆盖圈/光晕/底图浓淡', () => {
    for (const p of DISPLAY_PROFILES) {
      const r = renderAll(p.id)
      expect(r.plan.opacity, `${p.id} plan 底图`).toBe(r.zone.opacity)
      expect(r.plan.effects, `${p.id} plan effects`).toBe(p.displayEffects)
      expect(r.zone.effects, `${p.id} zone effects`).toBe(p.displayEffects)
      expect(r.plan.codes, `${p.id} plan 编号`).toBe(p.coverage)
      expect(r.zone.codes, `${p.id} zone 编号`).toBe(p.coverage)
      // 建网格开关必须真正在平面图上画出网格
      expect(r.plan.grid, `${p.id} plan 网格`).toBe(p.grid)
      expect(r.zone.grid, `${p.id} zone 网格`).toBe(p.grid)
    }
  })

  it('network 是覆盖展示页：覆盖圈与光晕恒开，底图浓淡跟随方案', () => {
    for (const p of DISPLAY_PROFILES) {
      const r = renderAll(p.id)
      // 页面副标题与 CoverageLegend 承诺「叠加信号波与检测范围」，图上必须有
      expect(r.network.effects, `${p.id} network effects`).toBe(true)
      expect(r.network.codes, `${p.id} network 编号`).toBe(true)
      // 底图仍跟随方案，和 plan 页一致（同一份 PDF 不能一页浓一页淡）
      expect(r.network.opacity, `${p.id} network 底图`).toBe(r.plan.opacity)
    }
  })

  it('老项目（displayProfile 为空）等同施工图，network 仍保留改前的波形', () => {
    const legacy = resolveDisplayProfile(undefined)
    expect(legacy.id).toBe('construction')
    const r = renderAll(legacy.id)
    expect(r.plan.effects).toBe(false)
    expect(r.zone.effects).toBe(false)
    // 改前 network 写死 coverage，老项目看到的是波形；不能退化
    expect(r.network.effects).toBe(true)
    expect(r.network.codes).toBe(true)
  })

  /**
   * 上面的用例手搭 DeckCtx，绕过了 deck/index.tsx 的装配层——真正修 bug 的那一行
   * resolveDisplayProfile(d.project.displayProfile) 就在那里。这一条从 deckPages 进去，
   * 证明项目的 displayProfile 会一路落到三个页面的 PlanView 上，且老数据（null / 缺字段）回落施工图。
   */
  it('装配层：项目的 displayProfile 经 deckPages 下发到三个页面', () => {
    for (const p of DISPLAY_PROFILES) {
      const r = measureDeck(renderDeck(p.id))
      expect(r.plan.effects, `${p.id} plan effects`).toBe(p.displayEffects)
      expect(r.zone.effects, `${p.id} zone effects`).toBe(p.displayEffects)
      expect(r.plan.codes, `${p.id} plan 编号`).toBe(p.coverage)
      expect(r.zone.codes, `${p.id} zone 编号`).toBe(p.coverage)
      // 网格经装配层一路落到两个页面
      expect(r.plan.grid, `${p.id} plan 网格`).toBe(p.grid)
      expect(r.zone.grid, `${p.id} zone 网格`).toBe(p.grid)
      // network 是覆盖展示页：波形恒开，底图仍跟方案
      expect(r.network.effects, `${p.id} network effects`).toBe(true)
      expect(r.network.codes, `${p.id} network 编号`).toBe(true)
      expect(r.plan.opacity, `${p.id} plan/zone 底图`).toBe(r.zone.opacity)
      expect(r.network.opacity, `${p.id} network 底图`).toBe(r.plan.opacity)
    }
    // 「业主展示」是有覆盖圈 + 有光晕的一套，用它区分「真的读到方案」和「回落到施工图」
    const owner = measureDeck(renderDeck('owner'))
    expect(owner.plan.effects).toBe(true)
    expect(owner.plan.codes).toBe(true)
    // 老数据：displayProfile 为 null 或字段缺失，一律回落施工图
    for (const legacy of [null, undefined]) {
      const r = measureDeck(renderDeck(legacy))
      expect(r.plan.effects, `${String(legacy)} plan effects`).toBe(false)
      expect(r.zone.effects, `${String(legacy)} zone effects`).toBe(false)
      expect(r.plan.codes, `${String(legacy)} plan 编号`).toBe(false)
      expect(r.zone.codes, `${String(legacy)} zone 编号`).toBe(false)
      expect(r.network.effects, `${String(legacy)} network effects`).toBe(true)
      expect(r.network.codes, `${String(legacy)} network 编号`).toBe(true)
    }
  })
})
