/**
 * 显示方案一致性回归：四个预设 × 三个画平面图的页（plan / zone / network-camera）
 * 必须是同一套网格 / 覆盖圈 / 光晕 / 底图透明度——同一份 PDF 里不能前后不一致。
 *
 * 这里真的渲染三个页面组件（react-dom/server），读渲染结果里实际生效的
 * 底图 opacity、effects 图层、覆盖编号，而不是只读源码 props。
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
 * 从渲染结果里读实际生效的底图不透明度、effects 图层、覆盖编号。
 * code 传该页图上真实存在的那个点位编号（plan 整层用 N01，zone 只画卧室用 S01）。
 */
function measure(html: string, code: string) {
  const opacity = /opacity:([0-9.]+)/.exec(html)?.[1]
  return {
    opacity: opacity ? Number(Number(opacity).toFixed(4)) : null,
    effects: /data-point-display-effects/.test(html),
    codes: html.includes(code),
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

describe('显示方案：三个画平面图的页', () => {
  it('四个预设 × 三页的实际渲染结果', () => {
    const table: Table = Object.fromEntries(DISPLAY_PROFILES.map((p) => [p.id, renderAll(p.id)]))
    for (const [id, row] of Object.entries(table)) {
      // 打印成一行，便于贴进提交说明 / 复核记录
      process.stdout.write(
        `${id.padEnd(13)} plan=${JSON.stringify(row.plan)} zone=${JSON.stringify(row.zone)} network=${JSON.stringify(row.network)}\n`,
      )
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
})
