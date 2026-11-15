import { describe, expect, it } from 'vitest'

import { A4_LANDSCAPE_PX, A4_PORTRAIT_PX, resolvePrintPreview } from './print-preview'

describe('resolvePrintPreview', () => {
  it('390 宽下纵向长文改为重排，不再缩放到 0.47', () => {
    const r = resolvePrintPreview({ paperWidth: A4_PORTRAIT_PX, viewportWidth: 390, kind: 'flow' })
    expect(r).toEqual({ mode: 'reflow', zoom: 1 })
  })

  it('纵向长文在桌面宽屏下也重排（缩放恒为 1）', () => {
    const r = resolvePrintPreview({
      paperWidth: A4_PORTRAIT_PX,
      viewportWidth: 1440,
      kind: 'flow',
    })
    expect(r.mode).toBe('reflow')
    expect(r.zoom).toBe(1)
  })

  it('390 宽下的横向 A4 单据整体等比缩小到屏宽', () => {
    const r = resolvePrintPreview({
      paperWidth: A4_LANDSCAPE_PX,
      viewportWidth: 390,
      kind: 'sheet',
    })
    // 390 - 16 = 374；374 / 1123 ≈ 0.3331
    expect(r.mode).toBe('fit')
    expect(r.zoom).toBeCloseTo(374 / A4_LANDSCAPE_PX, 4)
  })

  it('屏宽足够时定宽画布不缩放', () => {
    const r = resolvePrintPreview({
      paperWidth: A4_LANDSCAPE_PX,
      viewportWidth: 1440,
      kind: 'sheet',
    })
    expect(r).toEqual({ mode: 'fit', zoom: 1 })
  })

  it('缩放有 0.22 下限，极小屏也不会缩到看不见', () => {
    const r = resolvePrintPreview({ paperWidth: 1440, viewportWidth: 120, kind: 'sheet' })
    expect(r.zoom).toBe(0.22)
  })

  it('视口宽度为 0 时退回 1，避免除零得到 Infinity', () => {
    const r = resolvePrintPreview({ paperWidth: A4_LANDSCAPE_PX, viewportWidth: 0, kind: 'sheet' })
    expect(r.zoom).toBe(1)
    expect(Number.isFinite(r.zoom)).toBe(true)
  })
})
