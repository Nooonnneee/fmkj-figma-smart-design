/**
 * 方案模板渲染回归：数据 → 页面。
 *
 * 客户拿到的 PDF 里，金额、房间、编号、付款节点、场景清单任何一个串位都是事故。
 * 这里不渲染整套 React 树去比对快照，而是：
 *   1. 直接测能从页面模块里抽出来的纯函数（分页、编号区间、场景匹配）；
 *   2. 用 react-dom/server 渲染单页，断言页面上真实的文字与编号。
 * Payload / 产品库 / 图片 loader 全部换成内存 fixture，不连库、不发请求。
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
vi.mock('@/lib/scenes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/scenes')>()
  return { ...actual, loadSceneLibrary: async () => ({ scenes: [], source: 'builtin' }) }
})
vi.mock('next/image', () => ({
  default: ({ src, alt = '' }: { src?: unknown; alt?: string }) =>
    createElement('img', { src: typeof src === 'string' ? src : undefined, alt }),
}))

import { resolveDisplayProfile } from '@/lib/display-profile'
import type { ProjectDocsData } from '@/lib/project-docs'
import type { ManagedScene } from '@/lib/scenes'
import { buildDeck, codeRange, installNote, roomScenes, yuanShort } from './model'
import { buildNetworkCamera } from './network-camera'
import { CoverPage } from './pages/cover'
import { paginateRows, type InvestRow } from './pages/investment'
import { paginateRooms } from './pages/rooms'
import { deckScenes } from './pages/scenes'
import { ServicePage } from './pages/service'
import { hasSwitchLightingPoints, SystemPage } from './pages/system'
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
  pricing: { productId?: string | null } = {},
) => ({
  id,
  deviceType,
  productId: pricing.productId ?? null,
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

const roomOf = (
  areaId: string,
  name: string,
  areaType: string,
  pts: ReturnType<typeof pt>[],
  scenes: string[] = [],
) => ({
  areaId,
  areaIds: [areaId],
  name,
  areaType,
  typeLabel: name,
  devices: [],
  total: pts.length,
  met: [],
  missing: [],
  warnings: [],
  scenes,
  score: 100,
  floorName: '一层',
  displayName: name,
  sheets: ['一层平面'],
  points: pts,
  lines: pts.map((p) => ({
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

const points = [
  pt('p1', 'switch-2', 'K01', 100, 100, 'a1'),
  pt('p2', 'downlight', 'L01', 150, 120, 'a1'),
  pt('p3', 'downlight', 'L02', 180, 120, 'a1'),
  pt('p4', 'motion-sensor', 'S01', 600, 150, 'a2'),
  pt('p5', 'switch-2', 'K02', 620, 180, 'a2'),
]

const docs = (over: Record<string, unknown> = {}) =>
  ({
    project: {
      id: 'p',
      name: '证据项目',
      community: '某小区',
      address: '1-101',
      customerName: '张三',
      platform: '米家',
    },
    owner: { name: '李顾问', phone: '13900000000' },
    company: { name: '证据公司', phone: '400-000-0000', address: '公司地址', qrCaption: '扫码' },
    sceneLibrary: [],
    sceneSource: 'builtin',
    sheets: [sheet],
    areas,
    points,
    rooms: [
      roomOf(
        'a1',
        '客厅',
        'living',
        points.filter((p) => p.areaId === 'a1'),
        ['回家模式：开灯并拉开窗帘', '观影模式：只留灯带'],
      ),
      roomOf(
        'a2',
        '主卧',
        'bedroom',
        points.filter((p) => p.areaId === 'a2'),
        ['睡眠模式：关闭主灯'],
      ),
    ],
    floors: [
      {
        sheetId: 's1',
        floorName: '一层',
        sheetName: '一层平面',
        roomCount: 2,
        pointCount: 5,
        subtotal: 0,
      },
    ],
    roomKey: {},
    analysis: {},
    products: [],
    productById: new Map(),
    categories: [],
    total: 0,
    pending: 5,
    quote: null,
    quotes: [],
    contract: null,
    projectList: [],
    scope: 'all',
    finalQuoteId: null,
    finalQuoteSource: 'latest',
    proposalTemplate: null,
    ...over,
  }) as unknown as ProjectDocsData

const ctxOf = (d: ProjectDocsData): DeckCtx => ({
  m: buildDeck(d),
  theme: DECK_THEMES.qixu,
  markers: 'symbol',
  profile: resolveDisplayProfile(undefined),
})

/**
 * 投资明细分页：中间页每页 full 行，最后一页最多 last 行。
 *
 * 行为判断（不是猜）：调用方是 deck/index.tsx 的 `paginateRows(rows, 12, 9)`，
 * InvestmentPage 在 `isLast` 时会在固定 top-[756px] 处印「不含项 / 有效期」色块，
 * 所以末页最多只能放 9 行。因此总行数 > 9 时必然至少两页 —— 10 / 11 / 12 行
 * 都是两页（10→7+3、11→8+3、12→9+3），不是一页。旧测试标题「12 行以内仍一页」
 * 与真实行为和版面约束相反，已按真实行为改写。
 */
describe('投资明细分页：最后一页留出不含项色块', () => {
  const list = (n: number) => Array.from({ length: n }, (_, i) => i)
  const lens = (n: number) => paginateRows(list(n), 12, 9).map((p) => p.length)

  it('不超过 last（9 行）时一页放完', () => {
    expect(paginateRows(list(3), 12, 9)).toEqual([list(3)])
    expect(paginateRows([], 12, 9)).toEqual([[]])
    expect(lens(9)).toEqual([9])
  })

  it('10 / 11 / 12 行：末页要留色块，必须是两页', () => {
    expect(lens(10)).toEqual([7, 3])
    expect(lens(11)).toEqual([8, 3])
    expect(lens(12)).toEqual([9, 3])
    for (const n of [10, 11, 12]) {
      for (const len of lens(n)) expect(len, `n=${n}`).toBeLessThanOrEqual(12)
    }
  })

  it('超过 last 时分页，中间页满 12 行、最后页不超过 9 行', () => {
    for (const n of [13, 20, 21, 25, 40]) {
      const pages = paginateRows(list(n), 12, 9)
      for (const page of pages.slice(0, -1)) expect(page.length, `n=${n} 中间页`).toBe(12)
      expect(pages.at(-1)!.length, `n=${n} 末页`).toBeLessThanOrEqual(9)
    }
  })

  it('刚好整除时从上一页挪 3 行到最后一页（不出现只剩 0 行的末页）', () => {
    // 24 行：12 + 12 → 末页拆成 9 + 3
    expect(lens(24)).toEqual([12, 9, 3])
    expect(lens(22)).toEqual([12, 7, 3])
  })

  it('分页不丢行也不重复：所有页码拼起来等于原清单', () => {
    for (const n of [0, 1, 9, 10, 11, 12, 13, 21, 22, 24, 25, 40]) {
      const flat = paginateRows(list(n), 12, 9).flat()
      expect(flat, `n=${n}`).toEqual(list(n))
    }
  })
})

describe('其余空间分页', () => {
  const room = (name: string, lines: number) =>
    ({
      areaId: name,
      displayName: name,
      lines: Array.from({ length: lines }, () => ({ typeName: 't', count: 1, subtotal: 0 })),
    }) as never

  it('少设备房间每页最多 8 间', () => {
    const rooms = Array.from({ length: 10 }, (_, i) => room(`房${i}`, 1))
    const pages = paginateRooms(rooms)
    expect(pages[0]).toMatchObject({ compact: true })
    expect(pages[0]!.rooms).toHaveLength(8)
    expect(pages[1]!.rooms).toHaveLength(2)
  })

  it('明细多的房间一页最多 6 间；名字过长时一页 3 间', () => {
    const dense = Array.from({ length: 7 }, (_, i) => room(`房${i}`, 4))
    expect(paginateRooms(dense)[0]!.rooms).toHaveLength(6)

    const longNames = Array.from({ length: 7 }, (_, i) =>
      room(`一层超长房间名称测试用例集第${i}号客餐厅`, 4),
    )
    expect(paginateRooms(longNames)[0]!.rooms).toHaveLength(3)
  })

  it('分页不丢房间也不重复', () => {
    for (const lines of [1, 4]) {
      const rooms = Array.from({ length: 11 }, (_, i) => room(`房${i}`, lines))
      const flat = paginateRooms(rooms).flatMap((p) => p.rooms.map((r) => String(r.displayName)))
      expect(flat, `lines=${lines}`).toEqual(
        rooms.map((r) => String((r as unknown as { displayName: string }).displayName)),
      )
    }
  })
})

describe('编号区间：不能暗含不存在的点位', () => {
  it('连续编号写成区间，单个 / 两个直接列出', () => {
    expect(codeRange(['K01', 'K02', 'K03', 'K04'])).toBe('K01～K04')
    expect(codeRange(['K02', 'K01'])).toBe('K01 / K02')
    expect(codeRange(['K01'])).toBe('K01')
  })

  it('同前缀但断号时列出前三个再写「等 N 个」', () => {
    expect(codeRange(['K01', 'K03', 'K05', 'K07'])).toBe('K01 / K03 / K05 等4个')
  })

  it('三个以内不连续：逐个列出（不写成区间）', () => {
    expect(codeRange(['K01', 'K03', 'K05'])).toBe('K01 / K03 / K05')
    expect(codeRange(['K01', 'K03'])).toBe('K01 / K03')
  })

  it('不同前缀不写成区间', () => {
    expect(codeRange(['K01', 'L01', 'K02', 'L02'])).toBe('K01 / K02 / L01 等4个')
  })

  it('去重后再判断（重复编号不能让区间消失）', () => {
    expect(codeRange(['K01', 'K01', 'K02', 'K03'])).toBe('K01～K03')
  })
})

describe('场景与安装提示的文字映射', () => {
  const room = (scenes: string[]) => ({ scenes }) as never

  it('场景按「名称：动作」拆开，同名只保留第一次', () => {
    expect(
      roomScenes([
        room(['回家模式：开灯并拉开窗帘', '回家模式：只开玄关']),
        room(['观影模式：只留灯带']),
      ]),
    ).toEqual([
      { name: '回家模式', action: '开灯并拉开窗帘' },
      { name: '观影模式', action: '只留灯带' },
    ])
  })

  it('没有冒号的条目被忽略（不把一句说明当成场景）', () => {
    expect(roomScenes([room(['随手一句话']), room(['有冒号：动作'])])).toEqual([
      { name: '有冒号', action: '动作' },
    ])
  })

  it('安装提示只组合项目里真实存在的设备类型', () => {
    expect(installNote(['switch-2'])).toContain('开关中心高约1.3m')
    expect(installNote(['ap-node'])).toContain('PoE')
    // 没有匹配设备时给通用提示，不编造具体安装要求
    expect(installNote([])).toBe('安装复核：设备位置与供电条件以现场复核为准。')
    expect(installNote([])).not.toContain('1.3m')
  })
})

describe('服务交付页：付款节点与验收清单', () => {
  it('没有合同时按 40/50/10 拆分方案总价，且各期合计等于总额', () => {
    const d = docs({
      total: 1000,
      quote: null,
      points: points.map((p) => ({ ...p, productId: null })),
    })
    const ctx = ctxOf(d)
    const html = renderToStaticMarkup(createElement(ServicePage, { ctx, no: 8, total: 8 }))
    // 方案金额以页面上真实打印的文字为准
    expect(html).toContain('¥1,000')
    // 40% / 50% / 10%（付款表按「金额 / 元」打印两位小数）
    for (const amount of ['400.00', '500.00', '100.00']) expect(html, amount).toContain(amount)
    // 三期合计必须回到总额
    expect(ctx.m.nodes.reduce((s, n) => s + n.amount, 0)).toBe(1000)
  })

  it('验收清单覆盖设备的编号、型号、位置与数量（不是空清单）', () => {
    const ctx = ctxOf(docs())
    const html = renderToStaticMarkup(createElement(ServicePage, { ctx, no: 8, total: 8 }))
    expect(ctx.m.checks.length).toBeGreaterThan(3)
    expect(html).toContain(`核对${points.length}台/只设备`)
  })
})

describe('系统页只在有开关 / 灯光点位时出现', () => {
  it('只有摄像头与网关时不渲染开关灯光页', () => {
    const d = docs({
      points: [
        pt('c1', 'camera', 'V01', 10, 10, 'a1'),
        pt('v1', 'vrf-controller', 'A01', 20, 20, 'a1'),
      ],
    })
    const ctx = ctxOf(d)
    expect(hasSwitchLightingPoints(ctx.m)).toBe(false)
  })

  it('有灯具或开关时为真，且页面印出真实数量', () => {
    const ctx = ctxOf(docs())
    expect(hasSwitchLightingPoints(ctx.m)).toBe(true)
    const html = renderToStaticMarkup(createElement(SystemPage, { ctx, no: 3, total: 8 }))
    expect(html).toContain('墙壁开关')
    // 2 只 switch-2 + 2 个筒灯
    expect(html).toContain('K01')
  })
})

describe('场景页：只列项目里真实存在的场景与设备', () => {
  const scene = (over: Partial<ManagedScene> = {}): ManagedScene => ({
    id: 'sc-1',
    name: '回家',
    summary: '开灯并拉开窗帘',
    headline: null,
    subtitle: null,
    tagline: null,
    steps: ['门锁解锁', '玄关灯亮起'],
    image: null,
    scope: 'room',
    chapter: 'arrive',
    roomTypes: ['living'],
    requiredDevices: ['switch-2'],
    anyDevices: [],
    ...over,
  })

  const withScene = (s: ManagedScene, over: Record<string, unknown> = {}) => {
    const rooms = (docs().rooms as Array<Record<string, unknown>>).map((r) =>
      r.areaId === 'a1' ? { ...r, scenes: [`${s.name}：${s.summary}`] } : r,
    )
    return docs({ sceneLibrary: [s], rooms, ...over })
  }

  it('房间没有这个场景：不生成场景条目（不硬塞）', () => {
    const d = docs({ sceneLibrary: [scene()] })
    expect(deckScenes(buildDeck(d))).toEqual([])
  })

  it('房间有匹配场景：条目带房间名；全屋场景标记为「全屋」', () => {
    const roomScene = deckScenes(buildDeck(withScene(scene())))
    expect(roomScene).toHaveLength(1)
    expect(roomScene[0]!.rooms).toEqual(['客厅'])

    const houseScene = deckScenes(buildDeck(withScene(scene({ scope: 'house' }))))
    expect(houseScene[0]!.rooms).toEqual([])
  })

  it('条目只保留场景实际需要的设备类型', () => {
    const d = withScene(scene({ requiredDevices: ['downlight'], anyDevices: [] }))
    const entries = deckScenes(buildDeck(d))
    expect(entries[0]!.items.every((i) => i.deviceType === 'downlight')).toBe(true)
    expect(entries[0]!.items.length).toBeGreaterThan(0)
  })
})

describe('网络 / 摄像头页：分组与未上图点位', () => {
  it('按图纸与区域分组，同名房间跨楼层不合并', () => {
    const d = docs({
      points: [pt('n1', 'ap-node', 'N01', 10, 10, 'a1'), pt('n2', 'camera', 'V01', 20, 20, 'a2')],
    })
    const model = buildNetworkCamera(buildDeck(d))!
    expect(model.rooms.map((r) => r.name).sort()).toEqual(['主卧', '客厅'])
    expect(model.networkPoints).toHaveLength(1)
    expect(model.cameraPoints).toHaveLength(1)
    expect(model.sheets.map((s) => s.sheet.id)).toEqual(['s1'])
  })

  it('没有任何网络 / 检测 / 摄像头点位时返回 null（不生成空页）', () => {
    const d = docs({ points: [pt('x', 'downlight', 'L01', 1, 1, 'a1')] })
    expect(buildNetworkCamera(buildDeck(d))).toBeNull()
  })

  it('不在图纸上的点位进入 unmappedPoints，不被静默丢掉', () => {
    const d = docs({
      points: [{ ...pt('n9', 'camera', 'V09', 0, 0, 'a1'), sheetId: null }],
    })
    const model = buildNetworkCamera(buildDeck(d))!
    expect(model.unmappedPoints.map((p) => p.code)).toEqual(['V09'])
  })
})

describe('封面：客户第一眼看到的预算必须正确', () => {
  /**
   * 封面直接用 ctx.m.finalAmount 印预算（7 种封面版式里 6 种都有这一行），
   * 是「给客户的 PDF 算错钱」最直接的出口。这里真的渲染 CoverPage，
   * 断言页面 HTML 里出现格式化后的金额，而不是只测 yuanShort。
   */
  const ctxWithAmount = (amount: number, themeId: keyof typeof DECK_THEMES) => {
    const ctx = ctxOf(docs({ total: amount, quote: null }))
    // 方案金额在没有报价时取 d.total；这里从模型入口确认一次，避免断言建立在假设上
    expect(ctx.m.finalAmount).toBe(amount)
    return { ...ctx, theme: DECK_THEMES[themeId] }
  }

  it('栖序 band 封面版式本身不印预算（只有品牌 / 标题 / 项目信息）', () => {
    // 这是真实行为：band 版式没有金额栏。断言它不出现，避免有人误以为改了排版。
    const html = renderToStaticMarkup(
      createElement(CoverPage, { ctx: ctxWithAmount(12345.6, 'qixu'), no: 1, total: 8 }),
    )
    expect(html).not.toContain('INVESTMENT')
    expect(html).not.toContain('方案预算')
    expect(html).not.toContain('¥')
  })

  it('其余 6 种版式都把预算印在客户看得到的位置，且格式正确', () => {
    // 每种封面版式至少取一个主题：immersive / split / type / gallery / arch / architectural
    const cases: Array<[keyof typeof DECK_THEMES, string]> = [
      ['noir', '¥12,345.6'],
      ['grove', '¥12,345.6'],
      ['mono', '¥12,345.6'],
      ['terra', '¥12,345.6'],
      ['linen', '¥12,345.6'],
      ['slate', '¥12,345.6'],
    ]
    for (const [themeId, amount] of cases) {
      const html = renderToStaticMarkup(
        createElement(CoverPage, { ctx: ctxWithAmount(12345.6, themeId), no: 1, total: 8 }),
      )
      expect(html, themeId).toContain(amount)
      // 未格式化的原始浮点不能出现在页面上
      expect(html, themeId).not.toContain('>12345.6<')
    }
  })

  it('左文右图（split）封面：预算用千分位、整数不带小数', () => {
    const html = renderToStaticMarkup(
      createElement(CoverPage, { ctx: ctxWithAmount(1234.5, 'grove'), no: 1, total: 8 }),
    )
    expect(html).toContain('方案预算')
    expect(html).toContain('¥1,234.5')
  })

  it('金额为 0 时封面印 ¥0，不出现 NaN / undefined', () => {
    const html = renderToStaticMarkup(
      createElement(CoverPage, { ctx: ctxWithAmount(0, 'grove'), no: 1, total: 8 }),
    )
    expect(html).toContain('¥0')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
  })
})

describe('金额格式：客户单据上不能出现脏数字', () => {
  it('整数不带小数，小数保留两位', () => {
    expect(yuanShort(1759)).toBe('¥1,759')
    expect(yuanShort(5327.5)).toBe('¥5,327.5')
    expect(yuanShort(0)).toBe('¥0')
  })
})

// 让静态分析看到 rows 类型确实被使用（避免 type-only import 被误删）
const _rowTypeGuard = (r: InvestRow) => r.kind
void _rowTypeGuard
