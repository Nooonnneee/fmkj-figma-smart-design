'use client'

import { useCallback, useEffect, useState } from 'react'

import { DEFAULT_SYMBOL_SIZE } from '../core/symbols'
import type { ViewSettings } from '../core/types'

const KEY = 'fmkj:board:view:v1'

export const DEFAULT_VIEW: ViewSettings = {
  grid: true,
  rulers: true,
  labels: false,
  symbolStyle: 'plan',
  symbolSize: DEFAULT_SYMBOL_SIZE,
  sheetOpacity: 0.72,
  sheetStyle: 'cad',
  layers: { sheet: true, area: true, shape: true, symbol: true },
  overlays: {},
}

/** 视图设置存在本机（按浏览器记住），不写进图纸 */
export function useViewSettings() {
  const [view, setView] = useState<ViewSettings>(DEFAULT_VIEW)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<ViewSettings> | null
      if (saved && typeof saved === 'object') setView({ ...DEFAULT_VIEW, ...saved, layers: { ...DEFAULT_VIEW.layers, ...saved.layers }, overlays: { ...DEFAULT_VIEW.overlays, ...saved.overlays } })
    } catch {
      /* 忽略损坏的设置 */
    }
  }, [])
  const update = useCallback((patch: Partial<ViewSettings>) => {
    setView((v) => {
      const next = { ...v, ...patch, layers: { ...v.layers, ...patch.layers }, overlays: { ...v.overlays, ...patch.overlays } }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* 存储不可用时只在本次生效 */
      }
      return next
    })
  }, [])
  return [view, update] as const
}
