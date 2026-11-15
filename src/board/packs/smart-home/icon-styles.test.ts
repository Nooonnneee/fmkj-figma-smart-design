import { describe, expect, it } from 'vitest'

import { MARKER_BASE, lookOptionsFor, symbolGeom } from '@/board/core/symbols'
import type { ViewSettings } from '@/board/core/types'
import { DEVICE_TYPES, symbolOfType } from '@/lib/device-types'

import { CAD_SYMBOL_KEYS, cadSymbolBody, cadSymbolBodyForKey, cadSymbolSvg } from './cad-symbols'
import { applyIconArt, resolveIconArt, sketchArt, type IconArtInput } from './icon-styles'
import { deviceLook, lookOf } from './look'
import { SYMBOL_ASSETS } from './symbols.generated'

/** 一个「有默认图标」的代表性输入：camera / switch-1 / downlight */
const inputFor = (deviceType: string, extra: Partial<IconArtInput> = {}): IconArtInput => {
  const t = DEVICE_TYPES.find((d) => d.value === deviceType)!
  return {
    symbol: t.symbol,
    switchKeys: 'keys' in t ? t.keys : undefined,
    fallback: deviceLook(deviceType).art,
    sketch: sketchArt(t.symbol),
    ...extra,
  }
}

/** 便于断言：把解析结果压成一个字符串来源标签 */
const sourceOf = (choice: ReturnType<typeof resolveIconArt>) => {
  if (!choice) return 'none'
  if (choice.kind === 'vector') return 'vector'
  return choice.art.src
}

describe('四种图标风格各有各的图源', () => {
  for (const deviceType of ['camera', 'switch-1', 'downlight']) {
    it(`${deviceType}：default / cad / sketch / photo 互不相同`, () => {
      const input = inputFor(deviceType, { productImage: 'https://cdn.example/p.jpg' })
      const sources = {
        default: sourceOf(resolveIconArt('default', input)),
        cad: sourceOf(resolveIconArt('cad', input)),
        sketch: sourceOf(resolveIconArt('sketch', input)),
        photo: sourceOf(resolveIconArt('photo', input)),
      }
      // 四种风格四种图源，不能有两种落回同一张图
      expect(sources.cad).toBe('vector')
      expect(sources.default).toContain('/point-icons/')
      expect(sources.sketch).toContain('/board/symbols/smart-home/')
      expect(sources.photo).toBe('https://cdn.example/p.jpg')
      expect(new Set(Object.values(sources)).size).toBe(4)
    })
  }

  it('switch-1 与 switch-4 的 CAD 图形不同（按开关键数画不同根数的斜杠）', () => {
    const one = cadSymbolBodyForKey('switch', 1)
    const four = cadSymbolBodyForKey('switch', 4)
    expect(one).not.toBe(four)
    expect((four.match(/<path d="M/g) ?? []).length).toBeGreaterThan(
      (one.match(/<path d="M/g) ?? []).length,
    )
  })

  it('CAD 图标对每个 SymbolKey 都是「与默认图标不同」的矢量', () => {
    // 1) 覆盖全部 30 个符号键
    const symbolKeys = [...new Set(DEVICE_TYPES.map((t) => t.symbol))]
    expect(symbolKeys.length).toBe(30)
    expect([...CAD_SYMBOL_KEYS].sort()).toEqual([...symbolKeys].sort())
    // 2) 每个都有独立可用的矢量图形，且不是换皮的默认图标（不是 <image>，是真实图元）
    for (const key of symbolKeys) {
      const svg = cadSymbolSvg(key)
      expect(svg, key).toBeTruthy()
      expect(svg, key).not.toContain('<image')
      expect(svg!.length, key).toBeGreaterThan(60)
    }
    // 3) 图形互不重复（同一段矢量不能标两个设备）
    const bodies = symbolKeys.map((k) => cadSymbolBody(k))
    expect(new Set(bodies).size).toBe(symbolKeys.length)
  })

  it('手绘风格对全部 30 个符号键都有素材，且和默认图标不是同一张', () => {
    const symbolKeys = [...new Set(DEVICE_TYPES.map((t) => t.symbol))]
    for (const key of symbolKeys) {
      expect(SYMBOL_ASSETS[key], `缺少手绘素材：${key}`).toBeTruthy()
      const art = sketchArt(key)
      expect(art?.src).toContain('/board/symbols/smart-home/')
      expect(art?.src).not.toContain('/point-icons/')
    }
  })

  it('未知 / 缺数据时回退而不是画空白', () => {
    // 没有默认图标、没有手绘、没有照片：CAD 仍能画矢量，其余风格返回空交给调用方画实心标记
    const bare: IconArtInput = { symbol: 'other', fallback: null }
    expect(resolveIconArt('cad', bare)?.kind).toBe('vector')
    expect(resolveIconArt('default', bare)).toBeNull()
    expect(resolveIconArt('sketch', bare)).toBeNull()
    expect(resolveIconArt('photo', bare)).toBeNull()
    // 未知设备类型：deviceLook 走 other，永远有图形
    expect(deviceLook('不存在的类型').art).toBeTruthy()
  })
})

describe('photo 风格的回退矩阵', () => {
  it('有产品照片时用产品照片', () => {
    const choice = resolveIconArt('photo', inputFor('camera', { productImage: '/media/a.jpg' }))
    expect(choice?.kind).toBe('image')
    expect(choice && choice.kind === 'image' ? choice.art.src : null).toBe('/media/a.jpg')
  })

  it('点位有 productId、但产品 image 为 null：用默认图标，不是空白', () => {
    const fallback = deviceLook('camera').art
    expect(fallback).toBeTruthy()
    for (const productImage of [null, undefined, '', '   ']) {
      const choice = resolveIconArt('photo', inputFor('camera', { productImage }))
      expect(choice?.kind).toBe('image')
      expect(choice && choice.kind === 'image' ? choice.art.src : null).toBe(fallback!.src)
    }
  })

  it('没有产品 / 没有产品表（画布外路径）时同样回退默认图标', () => {
    const choice = resolveIconArt('photo', inputFor('downlight'))
    expect(choice?.kind).toBe('image')
    expect(choice && choice.kind === 'image' ? choice.art.src : null).toContain('/point-icons/')
  })

  it('整条链路（lookOptionsFor → lookOf）：productId 查不到 / image 为 null 都回退默认图标', () => {
    const products: Record<string, string | null> = { p1: '/media/cam.jpg', p2: null }
    const lookup = (id: string) => (id in products ? products[id] : null)
    const point = (productId?: string) => ({
      symbolId: 'camera',
      data: { deviceType: 'camera', ...(productId ? { productId } : {}) },
    })
    const photoOf = (productId?: string) => {
      const o = point(productId)
      return lookOf(o, lookOptionsFor(o, 'photo', lookup)).art?.src
    }
    expect(photoOf('p1')).toBe('/media/cam.jpg')
    expect(photoOf('p2')).toContain('/point-icons/camera.png')
    expect(photoOf('ghost')).toContain('/point-icons/camera.png')
    expect(photoOf()).toContain('/point-icons/camera.png')
    // 画布 / 方案页不传产品表：同样回退，不会画空白
    expect(lookOf(point('p1'), { iconStyle: 'photo' }).art?.src).toContain(
      '/point-icons/camera.png',
    )
  })
})

describe('lookOf 的图标风格', () => {
  const point = (deviceType: string, productId?: string) => ({
    symbolId: deviceType,
    data: { deviceType, ...(productId ? { productId } : {}) },
  })

  it('不传 opts 时与今天完全一致（旧视图不受影响）', () => {
    const plain = lookOf(point('switch-1'))
    expect(plain.art?.src).toContain('/point-icons/switch-1.png')
    expect(plain.marker).toBeTruthy()
    // 传 { iconStyle: 'default' } 与不传等价
    expect(lookOf(point('switch-1'), {})).toEqual(plain)
    expect(lookOf(point('switch-1'), { iconStyle: 'default' })).toEqual(plain)
  })

  it('CAD 风格：art 变成内联矢量 data URL（导出可照旧取用）', () => {
    const look = lookOf(point('switch-1'), { iconStyle: 'cad' })
    expect(look.art?.src.startsWith('data:image/svg+xml')).toBe(true)
    expect(look.art?.src).not.toContain('/point-icons/')
    // data URL 里确实装着矢量图元，不是一张占位图
    expect(decodeURIComponent(look.art!.src)).toContain('<path')
    expect(look.marker).toBeTruthy() // 切换 marker 时仍然有实心标记
  })

  it('手绘风格：换成 Procreate 素材，保留设备名与颜色', () => {
    const base = lookOf(point('camera'))
    const look = lookOf(point('camera'), { iconStyle: 'sketch' })
    expect(look.art?.src).toContain('/board/symbols/smart-home/camera.png')
    expect(look.name).toBe(base.name)
    expect(look.color).toBe(base.color)
  })

  it('手绘风格不会比默认图标更粗：单开 / 四开各有自己的手绘素材', () => {
    const one = lookOf(point('switch-1'), { iconStyle: 'sketch' }).art?.src
    const four = lookOf(point('switch-4'), { iconStyle: 'sketch' }).art?.src
    expect(one).toContain('switch-1')
    expect(four).toContain('switch-4')
    expect(one).not.toBe(four)
  })

  it('手绘风格对灯光款式保留款式图（不是退化成通用筒灯）', () => {
    const variant = {
      symbolId: 'lt-recessed-mount-ceiling-downlight-10cm-4',
      data: { deviceType: 'downlight' },
    }
    const look = lookOf(variant, { iconStyle: 'sketch' })
    // 款式名仍在（图例分组不变），图形是手绘素材里的一张
    expect(look.key).toContain(':')
    expect(look.art?.src).toContain('/board/symbols/smart-home/')
    expect(look.art?.src).not.toContain('/point-icons/')
  })

  it('photo 风格：传了照片用照片，没传就回退默认图标', () => {
    const withPhoto = lookOf(point('camera', 'p1'), {
      iconStyle: 'photo',
      productImage: '/media/camera.jpg',
    })
    expect(withPhoto.art?.src).toBe('/media/camera.jpg')
    // 照片按 contain 放进方框，不被拉伸
    expect(withPhoto.art?.fit).toBe('contain')

    const missing = lookOf(point('camera', 'p2'), { iconStyle: 'photo', productImage: null })
    expect(missing.art?.src).toContain('/point-icons/camera.png')
  })

  it('applyIconArt 在无图形时原样返回（不会把 look 变成空壳）', () => {
    const base = lookOf(point('camera'))
    expect(applyIconArt(base, null)).toBe(base)
  })
})

describe('marker 样式不受图标风格影响（回归）', () => {
  const point = { symbolId: 'camera', data: { deviceType: 'camera' } }
  const view = (iconStyle: ViewSettings['iconStyle']) => ({
    symbolStyle: 'marker' as const,
    symbolSize: 28,
    iconStyle,
  })

  it('marker 始终画实心标记，尺寸与今天一致', () => {
    const plain = symbolGeom(
      { x: 0, y: 0, angle: 0.3, sizeCm: null, real: false },
      lookOf(point),
      view(undefined),
      null,
    )
    expect(plain.marker).toBe(true)
    expect(plain.w).toBe(MARKER_BASE)
    for (const style of ['default', 'cad', 'sketch', 'photo'] as const) {
      const g = symbolGeom(
        { x: 0, y: 0, angle: 0.3, sizeCm: null, real: false },
        lookOf(point, { iconStyle: style }),
        view(style),
        null,
      )
      expect(g.marker, style).toBe(true)
      expect(g.w).toBe(plain.w)
      expect(g.h).toBe(plain.h)
      expect(g.imgW).toBe(plain.imgW)
      // 标记不旋转（与旧版点位图一致）
      expect(g.aabb).toEqual(plain.aabb)
    }
  })

  it('marker 的图源不随图标风格变化（与今天逐字节一致）', () => {
    const today = lookOf(point).marker
    expect(today).toBeTruthy()
    for (const style of ['default', 'cad', 'sketch', 'photo'] as const) {
      const look = lookOf(point, { iconStyle: style, productImage: '/media/x.jpg' })
      expect(look.marker, style).toBe(today)
      // 风格只影响平面图形，不能把 marker 换成矢量 / 产品照片
      expect(look.marker, style).not.toContain('data:')
      expect(look.marker, style).not.toBe('/media/x.jpg')
    }
  })
})

describe('symbolOfType 与 CAD 符号键对得上', () => {
  it('每个设备类型的符号键都在 CAD 表里', () => {
    for (const t of DEVICE_TYPES) expect(cadSymbolBody(symbolOfType(t.value)), t.value).toBeTruthy()
  })
})
