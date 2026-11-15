/**
 * 复核阻塞项的回归测试：
 * A. CAD / 实拍把线形灯具画成方块（几何必须保住默认风格的细长比例）
 * B. 实拍拿不到照片（点位没有 productId 时按设备类型取项目默认型号）
 * C. 导出一张图失败就整张图纸失败（改为回退默认图标 / 标记）
 *
 * 每个 describe 都能独立变红：删掉 artGeom 覆盖、productIdForPoint、toDataUrlSafe
 * 中的任意一块，对应断言立刻失败。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveExportIcon, toDataUrlSafe, type ExportImageCache } from '@/board/canvas/export'
import { lookOptionsFor, productIdForPoint, symbolGeom } from '@/board/core/symbols'
import type { SymbolObj, ViewSettings } from '@/board/core/types'
import { DEVICE_TYPES } from '@/lib/device-types'

import { smartHomePack } from './index'
import { LIGHTING, lookOf, type LightingVariant } from './look'

const view = (iconStyle?: ViewSettings['iconStyle']): ViewSettings => ({
  grid: false,
  rulers: false,
  labels: false,
  symbolStyle: 'plan',
  iconStyle,
  symbolSize: 28,
  sheetOpacity: 1,
  layers: { sheet: true, area: true, shape: true, symbol: true },
  overlays: {},
})

const point = (
  deviceType: string,
  symbolId: string,
  sizeCm: [number, number | null] | null = null,
  real = false,
  extra: Record<string, unknown> = {},
): SymbolObj => ({
  kind: 'symbol',
  id: 'p1',
  symbolId,
  x: 0,
  y: 0,
  angle: 0,
  code: 'L1',
  sizeCm,
  real,
  data: { deviceType, ...extra },
})

const geomOf = (o: SymbolObj, style: ViewSettings['iconStyle'], mmPerUnit = 1) => {
  const look = lookOf(o, { iconStyle: style })
  return symbolGeom(o, look, view(style), mmPerUnit)
}

const wh = (o: SymbolObj, style: ViewSettings['iconStyle'], mmPerUnit = 1) => {
  const g = geomOf(o, style, mmPerUnit)
  return { w: +g.w.toFixed(1), h: +g.h.toFixed(1) }
}

describe('A. 线形灯具在 CAD / 实拍下保持细长比例', () => {
  // 复核给出的基准：2 米轨道灯曾经被画成 2000×2000 的大方块
  const cases = [
    {
      name: '轨道灯 100cm 按真实尺寸',
      o: point('track-light', 'lt-track-light-100cm-40', [100, null], true),
      // 默认风格今天就是 1000 × 41.5（复核口头的 1000×42 是四舍五入）
      exact: { w: 1000, h: 41.5 },
    },
    {
      name: '嵌入式磁吸轨道 200cm 按真实尺寸',
      o: point('track-light', 'lt-recessed-magnetic-track-light-200cm-79', [200, null], true),
      exact: { w: 2000, h: 58.8 },
    },
    {
      name: '轨道灯 NTS（未标定，按固定尺寸示意）',
      o: point('track-light', 'lt-track-light-100cm-40', [100, null], false),
      exact: { w: 46.7, h: 1.9 },
    },
  ]

  for (const c of cases) {
    it(`${c.name}：default / cad / sketch / photo 的宽高完全一致`, () => {
      const base = wh(c.o, 'default')
      expect(base.w).toBeCloseTo(c.exact.w, 1)
      expect(base.h).toBeCloseTo(c.exact.h, 1)
      for (const style of ['cad', 'sketch', 'photo'] as const)
        expect(wh(c.o, style), style).toEqual(base)
    })
  }

  it('CAD 下绝不出现正方形：宽高比与默认风格一致（1:20 图纸上不再压住标签）', () => {
    for (const c of cases) {
      const base = wh(c.o, 'default')
      const cad = wh(c.o, 'cad')
      // 关键断言：修复前 cad 是 1000×1000 / 2000×2000 / 46.7×46.7，比值会变成 1
      expect(cad.h / cad.w, c.name).toBeLessThan(0.1)
      expect(cad.h / cad.w, c.name).toBeCloseTo(base.h / base.w, 6)
      expect(cad.h, c.name).not.toBe(cad.w)
    }
  })

  it('图纸标定比例时同样保持比例（mmPerUnit = 2）', () => {
    const o = point('track-light', 'lt-track-light-100cm-40', [100, null], true)
    const base = wh(o, 'default', 2)
    expect(base).toEqual({ w: 500, h: 20.8 })
    for (const style of ['cad', 'sketch', 'photo'] as const) expect(wh(o, style, 2)).toEqual(base)
  })

  it('其他设备在 CAD 下仍然按方形画（不是把几何全改成非方形）', () => {
    for (const dt of ['camera', 'switch-1', 'socket']) {
      const g = wh(point(dt, dt), 'cad')
      expect(g.w, dt).toBe(g.h)
    }
  })

  it('手绘风格本来就有细长比例，落图尺寸与默认完全一致', () => {
    const o = point('track-light', 'lt-track-light-100cm-40', [100, null], true)
    expect(wh(o, 'sketch')).toEqual(wh(o, 'default'))
    expect(lookOf(o, { iconStyle: 'sketch' }).art?.geom).toEqual({ gw: 1, gh: 0.0415 })
  })
})

describe('A2. 共享符号键的灯具按「这个点位」选 CAD 画面（回归：落地灯被画成一条线）', () => {
  /**
   * track-light / light-strip / other-light 三个符号键同时被真线形灯具和非线形灯具共用。
   * 9c31acf 按符号键选 160×6 的细长画面，落地灯从 1:1 变成 1:0.0375（26.7:1）。
   */
  const square = [
    { name: '落地灯', o: point('other-light', 'lt-floor-lamp-42cmdi-17di') },
    { name: '弧形落地灯', o: point('other-light', 'lt-floor-arc-lamp-192x48cm-76x19') },
    { name: '轨道射灯头', o: point('track-light', 'lt-track-light') },
    { name: 'LED 灯带', o: point('light-strip', 'lt-led-light') },
  ]

  for (const c of square) {
    it(`${c.name}：CAD 下回到 1:1（不再画成细长条）`, () => {
      const cad = wh(c.o, 'cad')
      // 修复前实测：1×0.0375（28×1.05），其它非线形灯具同样是 28×1.05
      expect(cad.h, `${c.name} 被画成 ${cad.w}×${cad.h}`).toBe(cad.w)
      expect(cad).toEqual({ w: 28, h: 28 })
    })
  }

  it('落地灯在 CAD 下与默认风格逐像素一致（默认图形本来就是方的）', () => {
    const o = point('other-light', 'lt-floor-lamp-42cmdi-17di')
    expect(wh(o, 'cad')).toEqual(wh(o, 'default'))
  })

  it('轨道射灯头 / LED 灯带用回 32×32 的方形矢量，而不是 160×6 的线性画面', () => {
    for (const o of [
      point('track-light', 'lt-track-light'),
      point('light-strip', 'lt-led-light'),
    ]) {
      const art = lookOf(o, { iconStyle: 'cad' }).art!
      // applyIconArt 写入的矢量画面比例：方形 32×32 → 1×1；线性 160×6 → 1×0.0375
      expect({ gw: art.gw, gh: art.gh }, o.symbolId).toEqual({ gw: 1, gh: 1 })
      expect(art.geom, o.symbolId).toBeUndefined()
    }
  })

  it('真线形灯具在 CAD 下保持 9c31acf 验证过的细长数字（不受本次修复影响）', () => {
    const exactWh = (o: SymbolObj) => {
      const g = geomOf(o, 'cad')
      return { w: +g.w.toFixed(4), h: +g.h.toFixed(4) }
    }
    const cases = [
      { o: point('track-light', 'lt-track-light-100cm-40'), exact: { w: 28, h: 1.162 } },
      {
        o: point('track-light', 'lt-recessed-magnetic-track-light-200cm-79'),
        exact: { w: 28, h: 0.8232 },
      },
      { o: point('other-light', 'lt-t5-light-120cm-48'), exact: { w: 28, h: 1.176 } },
    ]
    for (const c of cases) {
      expect(exactWh(c.o), c.o.symbolId).toEqual(c.exact)
      expect(wh(c.o, 'cad'), c.o.symbolId).toEqual(wh(c.o, 'default'))
    }
    // NTS（未标定、按固定尺寸示意）同样是细长的一条
    const nts = point('track-light', 'lt-track-light-100cm-40')
    const g = geomOf(nts, 'cad')
    expect(g.h).toBeLessThan(g.w)
  })

  it('真线形灯具用 160×6 的细长画面（per-point 标志必须真的传进 CAD 分支）', () => {
    const cases = [
      point('track-light', 'lt-track-light-100cm-40'),
      point('track-light', 'lt-recessed-magnetic-track-light-200cm-79'),
      point('other-light', 'lt-t5-light-120cm-48'),
    ]
    for (const o of cases) {
      const art = lookOf(o, { iconStyle: 'cad' }).art!
      // 矢量自己的画面是 160×6，几何覆盖是默认风格的细长比例
      expect({ gw: art.gw, gh: art.gh }, o.symbolId).toEqual({ gw: 1, gh: 0.0375 })
      const plain = lookOf(o).art!
      expect(art.geom, o.symbolId).toEqual({ gw: plain.gw, gh: plain.gh })
      // 图元本身确实画到 160 的宽度（不是缩在 32×32 里的方形图例）
      const svg = decodeURIComponent(art.src)
      expect(svg, o.symbolId).toContain('viewBox="0 0 160 6"')
      expect(svg, o.symbolId).toContain('x2="158"')
    }
  })

  it('全量守卫：所有灯光款式在 CAD 下 1:1 ⇔ 非线形且默认比例在 5 倍以内', () => {
    const variants: { variant: LightingVariant; deviceType: string }[] = LIGHTING.flatMap((f) =>
      f.variants.map((variant) => ({ variant, deviceType: f.deviceType })),
    )
    expect(variants.length).toBeGreaterThan(100)
    const mismatch: string[] = []
    for (const { variant, deviceType } of variants) {
      const o = point(deviceType, variant.id)
      const plain = lookOf(o).art!
      const aspect = plain.gh / plain.gw
      const elongated = variant.family.linear || aspect < 1 / 5 || aspect > 5
      const cad = wh(o, 'cad')
      const isSquare = cad.w === cad.h
      if (isSquare === elongated)
        mismatch.push(
          `${variant.id}（${deviceType}，linear=${variant.family.linear}，默认 ${plain.gw}×${plain.gh}，CAD ${cad.w}×${cad.h}）`,
        )
    }
    expect(mismatch, mismatch.join('\n')).toEqual([])
  })

  it('守卫与后置的 isElongated 不会出现两套真值：CAD 方框比例要么是 1:1，要么等于默认比例', () => {
    for (const f of LIGHTING)
      for (const v of f.variants) {
        const o = point(f.deviceType, v.id)
        const plain = lookOf(o).art!
        const cad = lookOf(o, { iconStyle: 'cad' }).art!
        const geom = cad.geom ?? { gw: cad.gw, gh: cad.gh }
        if (geom.gw === geom.gh)
          expect({ gw: geom.gw, gh: geom.gh }, v.id).toEqual({ gw: 1, gh: 1 })
        else expect({ gw: geom.gw, gh: geom.gh }, v.id).toEqual({ gw: plain.gw, gh: plain.gh })
      }
  })

  it('每个 DEVICE_TYPES 都满足同一规则：CAD 1:1 ⇔ 默认比例在 5 倍以内（不是只看方的那几个）', () => {
    for (const t of DEVICE_TYPES) {
      const o = point(t.value, t.value)
      const plain = lookOf(o).art!
      const aspect = plain.gh / plain.gw
      const elongated = aspect < 1 / 5 || aspect > 5 // 真线形灯具的默认图标本身就是一条线
      const cad = wh(o, 'cad')
      expect(
        cad.w === cad.h,
        `${t.value}：默认 ${plain.gw}×${plain.gh}，CAD ${cad.w}×${cad.h}`,
      ).toBe(!elongated)
    }
  })
})

describe('B. 实拍的产品查表优先级', () => {
  const defaults = { camera: 'prod-default', downlight: 'prod-down' }
  const products: Record<string, string> = {
    'prod-default': '/media/default-cam.jpg',
    'prod-point': '/media/point-cam.jpg',
  }
  const lookup = (id: string) => products[id] ?? null

  it('点位没有 productId：用设备类型的项目默认型号照片', () => {
    const o = point('camera', 'camera')
    expect(productIdForPoint(o, defaults)).toBe('prod-default')
    expect(lookOptionsFor(o, 'photo', lookup, defaults).productImage).toBe('/media/default-cam.jpg')
    expect(lookOf(o, lookOptionsFor(o, 'photo', lookup, defaults)).art?.src).toBe(
      '/media/default-cam.jpg',
    )
  })

  it('默认表里也没有该设备类型：回退默认图标，不空白', () => {
    const o = point('speaker', 'speaker')
    expect(productIdForPoint(o, defaults)).toBeNull()
    expect(lookOptionsFor(o, 'photo', lookup, defaults).productImage).toBeNull()
    expect(lookOf(o, lookOptionsFor(o, 'photo', lookup, defaults)).art?.src).toContain(
      '/point-icons/speaker.png',
    )
  })

  it('点位自带 productId 时优先用它，不被默认表覆盖', () => {
    const o = point('camera', 'camera', null, false, { productId: 'prod-point' })
    expect(productIdForPoint(o, defaults)).toBe('prod-point')
    expect(lookOptionsFor(o, 'photo', lookup, defaults).productImage).toBe('/media/point-cam.jpg')
    expect(lookOf(o, lookOptionsFor(o, 'photo', lookup, defaults)).art?.src).toBe(
      '/media/point-cam.jpg',
    )
  })

  it('不传产品表 / 默认表时 photo 仍然回退默认图标（打印、方案页的路径）', () => {
    const o = point('camera', 'camera')
    expect(lookOf(o, lookOptionsFor(o, 'photo', null, defaults)).art?.src).toContain(
      '/point-icons/camera.png',
    )
    expect(lookOf(o, lookOptionsFor(o, 'photo', lookup, null)).art?.src).toContain(
      '/point-icons/camera.png',
    )
  })

  it('非实拍风格不查产品数据（默认表不影响 CAD / 手绘 / 默认图标）', () => {
    const o = point('camera', 'camera')
    for (const style of ['default', 'cad', 'sketch'] as const)
      expect(lookOptionsFor(o, style, lookup, defaults).productImage, style).toBeUndefined()
  })
})

describe('C. 导出取不到图时回退，而不是整张图纸失败', () => {
  const cache = (): ExportImageCache => new Map()
  const okImage = (type = 'image/png') => ({
    ok: true,
    status: 200,
    blob: async () => new Blob([new Uint8Array([1, 2, 3, 4])], { type }),
  })
  const failImage = { ok: false, status: 404, blob: async () => new Blob([]) }

  afterEach(() => vi.unstubAllGlobals())

  it('toDataUrlSafe：fetch 拒绝（跨域）或 404 时返回 null，不抛错', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    await expect(toDataUrlSafe('https://cdn.example/x.jpg', cache())).resolves.toBeNull()

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => failImage),
    )
    await expect(toDataUrlSafe('/media/404.jpg', cache())).resolves.toBeNull()
  })

  it('toDataUrlSafe：取得到时转成内联 data URL（不再依赖 FileReader）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => okImage()),
    )
    const href = await toDataUrlSafe('/media/a.png', cache())
    expect(href).toMatch(/^data:image\/png;base64,/)
  })

  it('实拍照片取不到 → 回退默认图标，导出继续', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => (String(url).includes('cam.jpg') ? failImage : okImage())),
    )
    // 点位有产品型号，实拍风格真的去取那张照片（它 404）
    const o = point('camera', 'camera', null, false, { productId: 'p-cam' })
    const icon = await resolveExportIcon(
      o,
      view('photo'),
      smartHomePack,
      { productImage: () => '/media/cam.jpg' },
      cache(),
    )
    expect(icon?.kind).toBe('art')
    expect(icon?.kind === 'art' ? icon.art.src : '').toContain('/point-icons/camera.png')
  })

  it('风格图和默认图标都取不到 → 回退实心标记', async () => {
    // contact-sensor 没有专属点位图标，实心标记是 /point-markers/*.svg，和默认图形不是同一张
    // 只放行 point-markers，其余（产品照片、默认图标）全部 404
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        String(url).includes('/point-markers/') ? okImage('image/svg+xml') : failImage,
      ),
    )
    const o = point('contact-sensor', 'contact-sensor')
    const icon = await resolveExportIcon(
      o,
      view('photo'),
      smartHomePack,
      { productImage: () => '/media/missing.jpg' },
      cache(),
    )
    expect(icon?.kind).toBe('marker')
    expect(icon?.kind === 'marker' ? icon.href : '').toMatch(/^data:image\/svg\+xml/)
  })

  it('全部取不到 → 跳过该点位并返回 null，不抛错', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => failImage),
    )
    const o = point('camera', 'camera')
    await expect(
      resolveExportIcon(
        o,
        view('photo'),
        smartHomePack,
        { productImage: () => '/media/missing.jpg' },
        cache(),
      ),
    ).resolves.toBeNull()
  })

  it('坏图只请求一次：N 个点位共用同一个失败地址不重复 fetch', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      String(url).includes('missing.jpg') ? failImage : okImage(),
    )
    vi.stubGlobal('fetch', fetchMock)
    const shared = cache()
    const points = Array.from({ length: 5 }, (_, i) => ({
      ...point('camera', 'camera', null, false, { productId: `p${i}` }),
      id: `p${i}`,
    }))
    // 5 个点位的产品照片都是同一个坏地址；默认图标正常
    for (const o of points)
      await resolveExportIcon(
        o,
        view('photo'),
        smartHomePack,
        { productImage: () => '/media/missing.jpg' },
        shared,
      )
    // 修复前：5 个点位各取一次坏照片 + 各取一次默认图标 = 10 次（一个点位 2 次）
    const badCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('missing.jpg'))
    expect(badCalls).toHaveLength(1)
  })

  it('坏图连默认图标也坏：每个 URL 仍然只请求一次（不是每个点位 3 次）', async () => {
    const fetchMock = vi.fn(async (_url: string) => failImage)
    vi.stubGlobal('fetch', fetchMock)
    const shared = cache()
    for (let i = 0; i < 5; i++)
      await resolveExportIcon(
        { ...point('camera', 'camera', null, false, { productId: `p${i}` }), id: `p${i}` },
        view('photo'),
        smartHomePack,
        { productImage: () => '/media/missing.jpg' },
        shared,
      )
    const urls = fetchMock.mock.calls.map(([url]) => String(url))
    // 默认图标 + 产品照片 + 实心标记，三个地址各一次
    expect(new Set(urls).size).toBe(urls.length)
    expect(urls.length).toBeLessThanOrEqual(3)
  })

  it('toDataUrlSafe 的失败也被缓存：同一个地址第二次不再 fetch', async () => {
    const fetchMock = vi.fn(async () => failImage)
    vi.stubGlobal('fetch', fetchMock)
    const shared = cache()
    await toDataUrlSafe('/media/404.jpg', shared)
    await toDataUrlSafe('/media/404.jpg', shared)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(shared.get('/media/404.jpg')).toBeNull()
  })

  it('CAD 矢量是内联 data URL，不进网络：导出不因网络失败而丢图', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => failImage),
    )
    const o = point('downlight', 'downlight')
    const icon = await resolveExportIcon(o, view('cad'), smartHomePack, {}, cache())
    expect(icon?.kind).toBe('art')
    expect(icon?.kind === 'art' ? icon.art.src : '').toMatch(/^data:image\/svg\+xml/)
  })
})
