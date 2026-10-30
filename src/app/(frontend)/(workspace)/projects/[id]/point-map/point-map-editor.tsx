'use client'

import '@excalidraw/excalidraw/index.css'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { AlertTriangle, ArrowLeftRight, Check, Eye, FileText, ChevronDown, Download, ListChecks, Printer, FilePlus2, FileUp, ImagePlus, Layers, Loader2, MapPinned, Maximize2, Minus, Plus, ReceiptText, Save, X } from 'lucide-react'
import { toast } from 'sonner'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useSidebar } from '@/components/ui/sidebar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { analyzeAreas } from '@/lib/area-analysis'
import { areaTypeLabel } from '@/lib/area-types'
import { categoryOfType, DEVICE_GROUPS, DEVICE_TYPE_ORDER, deviceTypeLabel, deviceTypeOf } from '@/lib/device-types'
import { registerLeaveGuard } from '@/lib/leave-guard'
import { resolvePoint, summarizePoints, type ProjectDefaults } from '@/lib/point-map-items'
import { markerBinaryFile } from '@/lib/point-marker-data'
import { isMarkerFileId, markerFileId } from '@/lib/point-markers'
import { inferScopeFromTitle, inPointScope, POINT_SCOPES, pointScopeLabel, type PointScope } from '@/lib/point-scopes'
import {
  buildAreaElements,
  buildPointElements,
  buildSheetElements,
  compactScene,
  inlineFileIds,
  isPointElement,
  nextPointCode,
  sceneAreas,
  scenePoints,
  sceneSheets,
  type AreaInfo,
  type PointInfo,
  type SceneEl,
  type SceneFile,
  type SheetInfo,
  type StoredScene,
} from '@/lib/point-scene'
import { SHEET } from '@/lib/sheet-spec'
import { cn } from '@/lib/utils'

import { createQuoteFromProject, syncQuoteFromPointMap } from '../quotes/actions'
import { AiPanel, type ImportOutcome } from '@/plugins/ai-import/ai-panel'
import { exportPoints, parsePointImport, planToElements, recognitionPrompt } from '@/plugins/ai-import/point-import'
import type { SelectionTier } from '@/plugins/smart-select/auto-select'
import { SmartSelect } from '@/plugins/smart-select/smart-select-panel'

import { AreasPanel, DRAG_TYPE, PlacePanel, SelectedArea, SelectedPoint, TypeDefaultRow, yuan, type PointProduct } from './editor-panels'
import { SheetCropper } from './sheet-cropper'

export type { PointProduct } from './editor-panels'

const Excalidraw = dynamic(async () => (await import('@excalidraw/excalidraw')).Excalidraw, {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 size-4 animate-spin" />
      正在加载画布…
    </div>
  ),
})

/** 图纸铺满画布时四周留一点边：这个状态显示为 100% */
const FIT = 0.96
const kindOf = (el: SceneEl) => (typeof el.customData?.kind === 'string' ? (el.customData.kind as string) : null)
const contains = (r: { x: number; y: number; width: number; height: number }, x: number, y: number) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height
type Snapshot = { sheets: SheetInfo[]; areas: AreaInfo[]; points: PointInfo[] }
type AppStateLike = { width: number; height: number; zoom: { value: number }; scrollX: number; scrollY: number; offsetLeft: number; offsetTop: number; selectedElementIds: Record<string, boolean> }

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

type ProjectQuoteSummary = { id: string; title: string; status: string; total: number }
/** 点位图里由插件提供的功能是否可用（服务端按「设置 → 插件」计算后传入）。 */
export type PointMapPlugins = { aiImport: boolean; smartSelect: boolean; dwg: boolean; roomInsights: boolean; proposal: boolean }
type InitialFocus = { quoteId: string | null; sheet: string | null; area: string | null; point: string | null; scope: PointScope | null }

export function PointMapEditor({
  projectId,
  projectName,
  platform,
  initialScene,
  warnings,
  needsSave,
  products,
  initialDefaults,
  quotes = [],
  initialFocus,
  readOnly,
  plugins,
}: {
  projectId: string
  projectName: string
  platform: string | null
  initialScene: StoredScene
  warnings: string[]
  needsSave: boolean
  products: PointProduct[]
  initialDefaults: ProjectDefaults
  quotes?: ProjectQuoteSummary[]
  initialFocus?: InitialFocus
  readOnly: boolean
  plugins: PointMapPlugins
}) {
  const dwgEnabled = plugins.dwg
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const sidebar = useSidebar()
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)
  const [snap, setSnap] = useState<Snapshot>(() => {
    const sheets = sceneSheets(initialScene.elements, initialScene.files)
    const areas = sceneAreas(initialScene.elements, sheets)
    return { sheets, areas, points: scenePoints(initialScene.elements, sheets, areas) }
  })
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null)
  const [zoomPct, setZoomPct] = useState<number | null>(null)
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null)
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null)
  const [armed, setArmed] = useState<string | null>(null)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [defaults, setDefaults] = useState<ProjectDefaults>(initialDefaults)
  const [savingDefault, setSavingDefault] = useState<string | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [query, setQuery] = useState('')
  const [dirty, setDirty] = useState(needsSave)
  const [saving, setSaving] = useState(false)
  const [converting, setConverting] = useState(false)
  const [notices, setNotices] = useState<string[]>(warnings)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [tab, setTab] = useState(readOnly ? 'summary' : 'place')
  const activeQuote = useMemo(
    () => (initialFocus?.quoteId ? quotes.find((q) => q.id === initialFocus.quoteId) : undefined) ?? quotes[0] ?? null,
    [quotes, initialFocus?.quoteId],
  )
  /** 显示范围：只看开关等。只改画面显示，保存时恢复原样 */
  const [scope, setScope] = useState<PointScope>(() => initialFocus?.scope ?? (activeQuote ? inferScopeFromTitle(activeQuote.title) : 'all'))
  const [syncingQuote, setSyncingQuote] = useState(false)
  const hidden = useRef(new Map<string, { opacity: number; locked: boolean }>())

  /** 每张图纸「铺满画布」时的实际缩放值（Excalidraw 会对缩放取整），作为 100% 的基准 */
  const fitZoom = useRef(new Map<string, { zoom: number; w: number; h: number }>())
  /** 当前是否处于「图纸铺满」状态：用户没有再缩放或平移时，画布尺寸变化会自动重新铺满 */
  const fitState = useRef<{ sheetId: string | null; zoom: number; scrollX: number; scrollY: number } | null>(null)
  const sigRef = useRef('')
  const activeRef = useRef<string | null>(null)
  const pctRef = useRef<number | null>(null)
  const savedVersion = useRef<number | null>(null)
  const pendingSave = useRef(needsSave)
  const fitted = useRef(false)
  const canvasWrap = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const dwgInput = useRef<HTMLInputElement>(null)
  const quoteForm = useRef<HTMLFormElement>(null)

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const activeByType = useMemo(() => {
    const map = new Map<string, PointProduct[]>()
    for (const p of products) {
      if (p.status !== 'active' || !p.deviceType) continue
      map.set(p.deviceType, [...(map.get(p.deviceType) ?? []), p])
    }
    return map
  }, [products])

  const initialData = useMemo(
    () => ({
      elements: initialScene.elements as never,
      // 标记图标用内嵌 SVG 数据（保存时换回静态地址）
      files: Object.fromEntries(Object.entries(initialScene.files).map(([id, f]) => [id, isMarkerFileId(id) ? markerBinaryFile(id.replace(/^mk\d+-/, '')) : f])) as never,
      appState: {
        viewBackgroundColor: (initialScene.appState?.viewBackgroundColor as string) ?? '#ffffff',
        currentItemRoughness: 0,
        currentItemFontFamily: 2,
        currentItemStrokeWidth: 1,
      },
    }),
    [initialScene],
  )

  const elementsNow = useCallback(() => (api ? (api.getSceneElementsIncludingDeleted() as unknown as SceneEl[]) : []), [api])

  const handleChange = useCallback((elements: readonly unknown[], appState: AppStateLike, files: Record<string, SceneFile>) => {
    const els = elements as SceneEl[]
    const sheets = sceneSheets(els, files)
    const areas = sceneAreas(els, sheets)
    const points = scenePoints(els, sheets, areas)
    const sig = [
      sheets.map((s) => `${s.id}:${s.name}:${Math.round(s.x)}:${s.missing}:${s.url ?? ''}`).join(','),
      areas.map((a) => `${a.id}:${a.name}:${a.areaType}:${Math.round(a.x)}:${Math.round(a.y)}:${Math.round(a.width)}:${Math.round(a.height)}`).join(','),
      points.map((p) => `${p.id}:${p.deviceType}:${p.productId ?? ''}:${p.code}:${p.areaId ?? ''}:${p.sheetId ?? ''}`).join(','),
    ].join('|')
    if (sig !== sigRef.current) {
      sigRef.current = sig
      setSnap({ sheets, areas, points })
    }

    // 选中符号、代号文字或整组都算选中这个点位；区域同理
    const live = els.filter((e) => !e.isDeleted)
    const selected = live.filter((e) => appState.selectedElementIds[e.id])
    const groups = new Set(selected.flatMap((e) => e.groupIds ?? []))
    const point = selected.find(isPointElement) ?? live.find((e) => isPointElement(e) && e.groupIds?.some((g) => groups.has(g)))
    const area = point ? undefined : (selected.find((e) => kindOf(e) === 'area') ?? live.find((e) => kindOf(e) === 'area' && e.groupIds?.some((g) => groups.has(g))))
    setSelectedPointId(point && selected.length <= 2 ? point.id : null)
    setSelectedAreaId(area && selected.length <= 2 ? area.id : null)

    // 当前图纸 = 视野中心所在的图纸；缩放百分比以「图纸铺满画布」为 100%
    const z = appState.zoom.value
    const cx = appState.width / 2 / z - appState.scrollX
    const cy = appState.height / 2 / z - appState.scrollY
    const active = sheets.find((s) => contains(s, cx, cy)) ?? sheets.slice().sort((a, b) => Math.hypot(a.x + a.width / 2 - cx, a.y + a.height / 2 - cy) - Math.hypot(b.x + b.width / 2 - cx, b.y + b.height / 2 - cy))[0]
    if ((active?.id ?? null) !== activeRef.current) {
      activeRef.current = active?.id ?? null
      setActiveSheetId(activeRef.current)
    }
    const base = active ? fitZoom.current.get(active.id) : undefined
    const fit = base && base.w === appState.width && base.h === appState.height ? base.zoom : active && appState.width ? Math.min(appState.width / active.width, appState.height / active.height) * FIT : null
    const pct = Math.round(fit ? (z / fit) * 100 : z * 100)
    if (pct !== pctRef.current) {
      pctRef.current = pct
      setZoomPct(pct)
    }

    const fs = fitState.current
    if (fs && (Math.abs(fs.zoom - z) > 1e-4 || Math.abs(fs.scrollX - appState.scrollX) > 1 || Math.abs(fs.scrollY - appState.scrollY) > 1)) fitState.current = null

    const version = els.reduce((sum, e) => sum + ((e.version as number) ?? 0), 0)
    if (savedVersion.current === null) savedVersion.current = version
    setDirty(pendingSave.current || version !== savedVersion.current)
  }, [])

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // 画布页默认收起左侧导航，给图纸更多空间；离开时恢复
  const sidebarRef = useRef(sidebar)
  sidebarRef.current = sidebar
  useEffect(() => {
    const was = sidebarRef.current.open
    if (was) sidebarRef.current.setOpen(false)
    return () => {
      if (was) sidebarRef.current.setOpen(true)
    }
  }, [])

  /* ---------------- 视图：图纸铺满 = 100% ---------------- */

  const fitSheet = useCallback(
    (sheetId: string | null, animate = true) => {
      if (!api) return
      const els = api.getSceneElements() as unknown as SceneEl[]
      const sheet = sheetId ? sceneSheets(els, api.getFiles() as never).find((s) => s.id === sheetId) : null
      const target = sheet ? els.find((e) => e.id === sheet.elementId) : null
      if (!target && !els.length) return
      // 顶部留出 Excalidraw 工具栏的位置
      api.scrollToContent((target ?? els) as never, { fitToViewport: true, viewportZoomFactor: FIT, animate, duration: 280, canvasOffsets: { top: 64, bottom: 8, left: 8, right: 8 } })
      fitState.current = null
      // 动画结束后记下实际缩放值，之后以它为 100%
      setTimeout(() => {
        const s = api.getAppState() as unknown as AppStateLike
        if (sheet) fitZoom.current.set(sheet.id, { zoom: s.zoom.value, w: s.width, h: s.height })
        fitState.current = { sheetId: sheet?.id ?? null, zoom: s.zoom.value, scrollX: s.scrollX, scrollY: s.scrollY }
        pctRef.current = null
        api.updateScene({ appState: {} as never })
      }, animate ? 340 : 30)
    },
    [api],
  )

  // 画布尺寸变化（收起导航、调整窗口）时，如果还处于铺满状态就重新铺满
  useEffect(() => {
    const wrap = canvasWrap.current
    if (!api || !wrap) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const ro = new ResizeObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const fs = fitState.current
        if (fs) fitSheet(fs.sheetId, false)
      }, 180)
    })
    ro.observe(wrap)
    return () => {
      ro.disconnect()
      clearTimeout(timer)
    }
  }, [api, fitSheet])

  const firstSheetId = useRef<string | null>(snap.sheets[0]?.id ?? null)
  const focusRef = useRef(initialFocus)
  useEffect(() => {
    if (!api || fitted.current) return
    fitted.current = true
    // 如果是从报价单点击某个点位、房间或楼层跳回来的，直接定位并选中它；否则铺满第一张图纸
    setTimeout(() => {
      const f = focusRef.current
      const els = api.getSceneElements() as unknown as SceneEl[]
      if (f?.point) {
        const pt = els.find((e) => !e.isDeleted && isPointElement(e) && String(e.customData?.pointCode ?? '') === f.point)
        if (pt) {
          api.updateScene({ appState: { selectedElementIds: { [pt.id]: true } } as never })
          api.scrollToContent(pt as never, { fitToViewport: true, viewportZoomFactor: 0.28, animate: true, duration: 280 })
          return
        }
      }
      if (f?.area) {
        const targetArea = f.area
        const ar = els.find(
          (e) =>
            !e.isDeleted &&
            kindOf(e) === 'area' &&
            (e.id === targetArea || String(e.customData?.name ?? '').replace(/\s+/g, '') === targetArea.replace(/\s+/g, '')),
        )
        if (ar) {
          api.updateScene({ appState: { selectedElementIds: { [ar.id]: true } } as never })
          api.scrollToContent(ar as never, { fitToViewport: true, viewportZoomFactor: 0.65, animate: true, duration: 280 })
          return
        }
      }
      if (f?.sheet) {
        fitSheet(f.sheet, false)
        return
      }
      fitSheet(firstSheetId.current, false)
    }, 80)
  }, [api, fitSheet])

  const zoomBy = useCallback(
    (factor: number) => {
      if (!api) return
      const s = api.getAppState() as unknown as AppStateLike
      const z = Math.min(30, Math.max(0.1, s.zoom.value * factor))
      const cx = s.width / 2
      const cy = s.height / 2
      const sx = cx / s.zoom.value - s.scrollX
      const sy = cy / s.zoom.value - s.scrollY
      api.updateScene({ appState: { zoom: { value: z }, scrollX: cx / z - sx, scrollY: cy / z - sy } as never })
    },
    [api],
  )

  /* ---------------- 元素操作 ---------------- */

  const ensureMarkers = useCallback(
    (types: string[]) => {
      if (!api) return
      const files = api.getFiles()
      const add = [...new Set(types)].filter((t) => !files[markerFileId(t)]).map(markerBinaryFile)
      if (add.length) api.addFiles(add as never)
    },
    [api],
  )

  /** 插入元素：zone=top 放最上层；aboveSheets 放在图纸之上、其他元素之下（区域框）；bottom 放最底层（图纸）。 */
  const insertElements = useCallback(
    async (created: SceneEl[], zone: 'top' | 'aboveSheets' | 'bottom', opts: { select?: string; remove?: Set<string> } = {}) => {
      if (!api) return
      const ex = await import('@excalidraw/excalidraw')
      const restored = ex.restoreElements(created as never, null) as unknown as SceneEl[]
      let current = elementsNow()
      if (opts.remove?.size) current = current.map((e) => (opts.remove!.has(e.id) && !e.isDeleted ? (ex.newElementWith(e as never, { isDeleted: true } as never) as unknown as SceneEl) : e))
      let next: SceneEl[]
      if (zone === 'bottom') next = [...restored, ...current]
      else if (zone === 'aboveSheets') {
        let idx = -1
        current.forEach((e, i) => {
          if (!e.isDeleted && (kindOf(e) === 'sheet' || kindOf(e) === 'sheet-title')) idx = i
        })
        next = [...current.slice(0, idx + 1), ...restored, ...current.slice(idx + 1)]
      } else next = [...current, ...restored]
      api.updateScene({
        elements: next as never,
        appState: opts.select ? ({ selectedElementIds: { [opts.select]: true } } as never) : undefined,
        captureUpdate: ex.CaptureUpdateAction.IMMEDIATELY,
      })
    },
    [api, elementsNow],
  )

  /** 修改已有元素（自动提升版本号，支持撤销） */
  const patchElements = useCallback(
    async (patch: (el: SceneEl) => Partial<SceneEl> | null) => {
      if (!api) return
      const ex = await import('@excalidraw/excalidraw')
      const next = elementsNow().map((el) => {
        if (el.isDeleted) return el
        const p = patch(el)
        return p ? (ex.newElementWith(el as never, p as never) as unknown as SceneEl) : el
      })
      api.updateScene({ elements: next as never, captureUpdate: ex.CaptureUpdateAction.IMMEDIATELY })
    },
    [api, elementsNow],
  )

  const usedCodes = useCallback(
    () => elementsNow().filter((e) => !e.isDeleted && isPointElement(e)).map((e) => String(e.customData?.pointCode ?? '')),
    [elementsNow],
  )

  const placePoint = useCallback(
    async (type: string, cx: number, cy: number) => {
      if (!api || readOnly) return
      ensureMarkers([type])
      const code = nextPointCode(type, usedCodes())
      await insertElements(buildPointElements({ deviceType: type, cx, cy, code }), 'top')
    },
    [api, readOnly, ensureMarkers, usedCodes, insertElements],
  )

  const sceneCoords = useCallback(
    (clientX: number, clientY: number) => {
      const s = api!.getAppState() as unknown as AppStateLike
      return { x: (clientX - s.offsetLeft) / s.zoom.value - s.scrollX, y: (clientY - s.offsetTop) / s.zoom.value - s.scrollY }
    },
    [api],
  )

  // 选中设备后在画布上点击放置；Esc 结束
  useEffect(() => {
    const wrap = canvasWrap.current
    if (!armed || !api || !wrap) return
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !(e.target instanceof HTMLCanvasElement)) return
      e.preventDefault()
      e.stopPropagation()
      const { x, y } = sceneCoords(e.clientX, e.clientY)
      void placePoint(armed, x, y)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setArmed(null)
    }
    wrap.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      wrap.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [armed, api, placePoint, sceneCoords])

  // 从设备面板拖到画布
  useEffect(() => {
    const wrap = canvasWrap.current
    if (!api || !wrap || readOnly) return
    const onOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes(DRAG_TYPE)) {
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'copy'
      }
    }
    const onDrop = (e: DragEvent) => {
      const type = e.dataTransfer?.getData(DRAG_TYPE)
      if (!type) return
      e.preventDefault()
      e.stopPropagation()
      const { x, y } = sceneCoords(e.clientX, e.clientY)
      void placePoint(type, x, y)
    }
    wrap.addEventListener('dragover', onOver, true)
    wrap.addEventListener('drop', onDrop, true)
    return () => {
      wrap.removeEventListener('dragover', onOver, true)
      wrap.removeEventListener('drop', onDrop, true)
    }
  }, [api, readOnly, placePoint, sceneCoords])

  /* ---------------- 保存 ---------------- */

  const uploadImage = useCallback(
    async (blob: Blob, name: string, kind: 'sheet' | 'asset') => {
      const body = new FormData()
      body.append('file', blob, `${kind}.${blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png'}`)
      body.append('name', name)
      body.append('kind', kind)
      const res = await fetch(`/projects/${projectId}/point-map/sheets`, { method: 'POST', body })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; url?: string; mediaId?: string }
      if (!res.ok || !data.ok || !data.url) throw new Error(data.error ?? '图片上传失败，请稍后重试')
      return { url: data.url, mediaId: data.mediaId ?? null }
    },
    [projectId],
  )

  const save = useCallback(async () => {
    if (!api || saving) return false
    setSaving(true)
    try {
      const visible = (api.getSceneElements() as unknown as SceneEl[]).map((e) => (hidden.current.has(e.id) ? { ...e, ...hidden.current.get(e.id) } : e))
      const scene = compactScene(visible, api.getFiles() as unknown as Record<string, SceneFile>, api.getAppState() as never)
      // 画布上直接插入的图片先存进媒体库，场景里只留地址
      for (const id of inlineFileIds(scene)) {
        const blob = await (await fetch(scene.files[id].dataURL)).blob()
        const { url } = await uploadImage(blob, '画布图片', 'asset')
        scene.files[id] = { ...scene.files[id], dataURL: url }
      }
      const body = JSON.stringify(scene)
      const res = await fetch(`/projects/${projectId}/point-map/data`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? '保存失败，请稍后重试')
      savedVersion.current = (api.getSceneElementsIncludingDeleted() as unknown as SceneEl[]).reduce((s, e) => s + ((e.version as number) ?? 0), 0)
      pendingSave.current = false
      setDirty(false)
      toast.success('点位图已保存')
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败，请稍后重试')
      return false
    } finally {
      setSaving(false)
    }
  }, [api, projectId, saving, uploadImage])

  // 切换项目板块或侧边栏导航时，先自动保存点位图
  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => {
    if (!dirty || readOnly) return
    return registerLeaveGuard(async () => (await saveRef.current()) || window.confirm('点位图保存失败，仍要离开吗？未保存的修改会丢失。'))
  }, [dirty, readOnly])

  useEffect(() => {
    if (readOnly) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save, readOnly])

  /* ---------------- 图纸 ---------------- */

  const addSheet = useCallback(
    async (png: Blob, name: string) => {
      if (!api) return
      const { url, mediaId } = await uploadImage(png, name, 'sheet')
      const fileId = `sheet-${mediaId ?? Date.now().toString(36)}`
      api.addFiles([{ id: fileId, dataURL: url, mimeType: 'image/png', created: Date.now() }] as never)
      const created = buildSheetElements({ index: snap.sheets.length, name, fileId, mediaId })
      await insertElements(created, 'bottom')
      setCropFile(null)
      const sheetId = created[0].customData!.sheetId as string
      setTimeout(() => fitSheet(sheetId), 80)
      toast.success(`已添加图纸「${name}」`)
      // 图纸已经存进媒体库，立即保存场景，避免离开页面后丢失
      setTimeout(() => void save(), 200)
    },
    [api, uploadImage, snap.sheets.length, insertElements, fitSheet, save],
  )

  const renameSheet = useCallback(
    async (sheetId: string, name: string) => {
      const v = name.trim().slice(0, 40)
      setRenaming(null)
      if (!v) return
      await patchElements((el) => {
        if (el.customData?.sheetId !== sheetId) return null
        if (kindOf(el) === 'sheet') return { customData: { ...el.customData, name: v } }
        if (kindOf(el) === 'sheet-title') return { text: v, originalText: v, width: [...v].length * SHEET.titleSize }
        return null
      })
    },
    [patchElements],
  )

  const deleteSheet = useCallback(
    async (sheet: SheetInfo) => {
      setConfirmDelete(null)
      const remove = new Set<string>()
      for (const el of elementsNow()) {
        if (el.isDeleted) continue
        const k = kindOf(el)
        if ((k === 'sheet' || k === 'sheet-title') && (el.customData?.sheetId === sheet.id || el.id === sheet.elementId)) remove.add(el.id)
        else if (k !== 'sheet' && k !== 'sheet-title' && contains(sheet, el.x + el.width / 2, el.y + el.height / 2)) remove.add(el.id)
      }
      await insertElements([], 'top', { remove })
      toast.success(`已删除图纸「${sheet.name}」，可按 Ctrl/⌘ + Z 撤销`)
    },
    [elementsNow, insertElements],
  )

  const exportSheetPng = useCallback(async () => {
    if (!api) return
    const sheet = snap.sheets.find((s) => s.id === activeSheetId) ?? snap.sheets[0]
    const els = api.getSceneElements() as unknown as SceneEl[]
    const picked = els.filter((e) => !hidden.current.has(e.id)).filter((e) => !sheet || contains({ ...sheet, y: sheet.y - SHEET.titleOffset - 4, height: sheet.height + SHEET.titleOffset + 4 }, e.x + e.width / 2, e.y + e.height / 2))
    // 导出图片时放大设备图标（24 → 32），并把下方文字从内部编号（K1）替换为类别名（单开、双开、中控屏等）
    const exportSize = 32
    const pointByGroup = new Map<string, { cx: number; cy: number; typeName: string }>()
    for (const e of picked) {
      if (isPointElement(e)) {
        const g = e.groupIds?.[0]
        const typeName = deviceTypeOf(String(e.customData?.deviceType ?? 'other'))?.name ?? '设备'
        if (g) pointByGroup.set(g, { cx: e.x + e.width / 2, cy: e.y + e.height / 2, typeName })
      }
    }
    const forExport = picked.map((e) => {
      if (isPointElement(e)) {
        const cx = e.x + e.width / 2
        const cy = e.y + e.height / 2
        return { ...e, x: cx - exportSize / 2, y: cy - exportSize / 2, width: exportSize, height: exportSize }
      }
      if (kindOf(e) === 'label') {
        const g = e.groupIds?.[0]
        const pt = g ? pointByGroup.get(g) : undefined
        if (pt) {
          const fontSize = 10
          const w = Math.max(exportSize, pt.typeName.length * fontSize + 4)
          return { ...e, x: pt.cx - w / 2, y: pt.cy + exportSize / 2 + 2, width: w, height: fontSize * 1.25, text: pt.typeName, originalText: pt.typeName, fontSize }
        }
      }
      return e
    })
    const { exportToBlob } = await import('@excalidraw/excalidraw')
    const blob = await exportToBlob({
      elements: forExport as never,
      appState: { ...api.getAppState(), exportBackground: true, exportWithDarkMode: false, exportScale: 2, viewBackgroundColor: '#ffffff' } as never,
      files: api.getFiles(),
      mimeType: 'image/png',
      exportPadding: 16,
    })
    download(`${projectName}-${sheet?.name ?? '点位图'}.png`, blob)
  }, [api, snap.sheets, activeSheetId, projectName])

  const importDwg = useCallback(
    async (file: File) => {
      if (converting) return
      if (!/\.dwg$/i.test(file.name)) return toast.error('请选择 .dwg 文件')
      setConverting(true)
      const pending = toast.loading('正在转换 DWG，可能需要几十秒…')
      try {
        const body = new FormData()
        body.append('file', file)
        const res = await fetch(`/projects/${projectId}/point-map/dwg`, { method: 'POST', body })
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; url?: string; name?: string }
        if (!res.ok || !data.ok || !data.url) throw new Error(data.error ?? '转换失败，请稍后重试')
        const img = await fetch(data.url)
        if (!img.ok) throw new Error('户型图已生成，但读取失败')
        const blob = await img.blob()
        setCropFile(new File([blob], data.name ?? file.name.replace(/\.dwg$/i, '.png'), { type: blob.type || 'image/png' }))
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '转换失败，请稍后重试')
      } finally {
        toast.dismiss(pending)
        setConverting(false)
      }
    },
    [converting, projectId],
  )

  const cancelCrop = useCallback(() => setCropFile(null), [])

  /* ---------------- 区域 ---------------- */

  const addArea = useCallback(
    async (areaType: string) => {
      if (!api) return
      const s = api.getAppState() as unknown as AppStateLike
      const cx = s.width / 2 / s.zoom.value - s.scrollX
      const cy = s.height / 2 / s.zoom.value - s.scrollY
      const created = buildAreaElements({ name: areaTypeLabel(areaType), areaType, x: cx - 110, y: cy - 75, width: 220, height: 150 })
      await insertElements(created, 'aboveSheets', { select: created[0].id })
      toast.success('已添加区域，拖动边框调整到房间范围')
    },
    [api, insertElements],
  )

  const updateArea = useCallback(
    async (areaId: string, patch: { name?: string; areaType?: string }) => {
      const rect = elementsNow().find((e) => e.id === areaId)
      const group = rect?.groupIds?.[0]
      await patchElements((el) => {
        if (el.id === areaId) return { customData: { ...el.customData, ...patch } }
        if (patch.name && group && kindOf(el) === 'area-label' && el.groupIds?.includes(group)) return { text: patch.name, originalText: patch.name, width: [...patch.name].length * 11 }
        return null
      })
    },
    [elementsNow, patchElements],
  )

  const deleteArea = useCallback(
    async (areaId: string) => {
      const rect = elementsNow().find((e) => e.id === areaId)
      const group = rect?.groupIds?.[0]
      const remove = new Set(elementsNow().filter((e) => e.id === areaId || (group && kindOf(e) === 'area-label' && e.groupIds?.includes(group))).map((e) => e.id))
      await insertElements([], 'top', { remove })
    },
    [elementsNow, insertElements],
  )

  const focusArea = useCallback(
    (areaId: string) => {
      if (!api) return
      const el = (api.getSceneElements() as unknown as SceneEl[]).find((e) => e.id === areaId)
      if (!el) return
      api.updateScene({ appState: { selectedElementIds: { [areaId]: true } } as never })
      api.scrollToContent(el as never, { fitToViewport: true, viewportZoomFactor: 0.7, animate: true, duration: 280 })
    },
    [api],
  )

  /* ---------------- AI 识别导入 ---------------- */

  const activeSheet = snap.sheets.find((s) => s.id === activeSheetId) ?? snap.sheets[0] ?? null

  const runImport = useCallback(
    async (text: string, replace: boolean): Promise<ImportOutcome> => {
      if (!api) return { ok: false, error: '画布还没有加载完成' }
      const parsed = parsePointImport(text, snap.sheets, activeSheet?.id ?? null)
      if (!parsed.ok) return parsed
      const remove = new Set<string>()
      if (replace) {
        for (const { sheet } of parsed.plan.sheets) {
          for (const el of elementsNow()) {
            const k = kindOf(el)
            if (el.isDeleted || k === 'sheet' || k === 'sheet-title') continue
            if ((isPointElement(el) || k === 'label' || k === 'area' || k === 'area-label') && contains(sheet, el.x + el.width / 2, el.y + el.height / 2)) remove.add(el.id)
          }
        }
      }
      const codes = elementsNow().filter((e) => !e.isDeleted && !remove.has(e.id) && isPointElement(e)).map((e) => String(e.customData?.pointCode ?? ''))
      const { areas, points } = planToElements(parsed.plan, codes)
      ensureMarkers(parsed.plan.sheets.flatMap((s) => s.points.map((p) => p.deviceType)))
      if (areas.length) await insertElements(areas, 'aboveSheets', { remove })
      await insertElements(points, 'top', areas.length ? {} : { remove })
      const first = parsed.plan.sheets[0]?.sheet.id
      if (first) setTimeout(() => fitSheet(first), 60)
      return { ok: true, points: parsed.plan.pointCount, areas: parsed.plan.areaCount, warnings: parsed.plan.warnings }
    },
    [api, snap.sheets, activeSheet, elementsNow, ensureMarkers, insertElements, fitSheet],
  )

  const copyPrompt = useCallback(async () => {
    if (!activeSheet) return
    try {
      await navigator.clipboard.writeText(recognitionPrompt(activeSheet.name))
      toast.success('识别提示词已复制，连同标准图纸一起发给 AI')
    } catch {
      toast.error('复制失败，请检查浏览器的剪贴板权限')
    }
  }, [activeSheet])

  const exportJson = useCallback(() => {
    const data = exportPoints(snap.sheets, snap.areas, snap.points)
    download(`${projectName}-点位.json`, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  }, [snap, projectName])

  /* ---------------- 选型 ---------------- */

  const updatePointProduct = useCallback(
    async (pointId: string, productId: string | null) => {
      await patchElements((el) => {
        if (el.id !== pointId) return null
        const { productId: _old, ...rest } = el.customData ?? {}
        return { customData: productId ? { ...rest, productId } : rest }
      })
    },
    [patchElements],
  )

  /** 切换选中点位的设备类型：自动替换画布图标，跨大类时自动更新代号前缀与文字颜色 */
  const updatePointType = useCallback(
    async (pointId: string, newType: string) => {
      const target = elementsNow().find((e) => e.id === pointId)
      if (!target) return
      const oldType = String(target.customData?.deviceType ?? 'other')
      if (oldType === newType) return
      ensureMarkers([newType])
      const oldCat = categoryOfType(oldType)
      const newCat = categoryOfType(newType)
      const oldCode = String(target.customData?.pointCode ?? '')
      const nextCode = oldCat?.code === newCat?.code && oldCode ? oldCode : nextPointCode(newType, usedCodes())
      const group = target.groupIds?.[0]
      const newColor = newCat?.color ?? '#525252'
      await patchElements((el) => {
        if (el.id === pointId) {
          const { productId: _oldProd, ...rest } = el.customData ?? {}
          return {
            fileId: markerFileId(newType),
            status: 'saved',
            customData: { ...rest, deviceType: newType, pointCode: nextCode },
          }
        }
        if (group && kindOf(el) === 'label' && el.groupIds?.includes(group)) {
          return {
            text: nextCode,
            originalText: nextCode,
            strokeColor: newColor,
            customData: { ...el.customData, pointCode: nextCode },
          }
        }
        return null
      })
      toast.success(`已切换为「${deviceTypeLabel(newType)}」`)
    },
    [elementsNow, ensureMarkers, usedCodes, patchElements],
  )

  const deletePoint = useCallback(
    async (pointId: string) => {
      const target = elementsNow().find((e) => e.id === pointId)
      const group = target?.groupIds?.[0]
      const remove = new Set(
        elementsNow()
          .filter((e) => e.id === pointId || (group && kindOf(e) === 'label' && e.groupIds?.includes(group)))
          .map((e) => e.id),
      )
      await insertElements([], 'top', { remove })
    },
    [elementsNow, insertElements],
  )

  const saveDefault = useCallback(
    async (deviceType: string, productId: string | null) => {
      setSavingDefault(deviceType)
      try {
        const res = await fetch(`/projects/${projectId}/point-map/defaults`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceType, productId }) })
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; defaults?: ProjectDefaults }
        if (!res.ok || !data.ok || !data.defaults) throw new Error(data.error ?? '保存失败，请稍后重试')
        setDefaults(data.defaults)
        toast.success(productId ? `已设为「${deviceTypeLabel(deviceType)}」的默认型号` : '已清除默认型号')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '保存失败，请稍后重试')
      } finally {
        setSavingDefault(null)
      }
    },
    [projectId],
  )

  const autoSelect = useCallback(
    async (tier: SelectionTier, overwrite: boolean) => {
      // 服务端按已保存的点位图统计设备类型，先保存
      if (dirty && !(await save())) return
      setSelecting(true)
      try {
        const res = await fetch(`/projects/${projectId}/point-map/auto-defaults`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier, overwrite, scope }) })
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; defaults?: ProjectDefaults; changed?: unknown[]; missing?: string[] }
        if (!res.ok || !data.ok || !data.defaults) throw new Error(data.error ?? '选型失败，请稍后重试')
        setDefaults(data.defaults)
        const n = data.changed?.length ?? 0
        const missing = data.missing?.length ? `；${data.missing.map((t) => deviceTypeLabel(t)).join('、')} 产品库里没有在售产品` : ''
        toast.success(n ? `已为 ${n} 类设备设置默认型号${missing}` : `所有设备类型都已选型${missing}`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '选型失败，请稍后重试')
      } finally {
        setSelecting(false)
      }
    },
    [dirty, save, projectId, scope],
  )

  const createNewQuote = useCallback(async () => {
    if (dirty && !(await save())) return
    quoteForm.current?.requestSubmit()
  }, [dirty, save])

  /** 无缝切换到报价单：已有报价单时自动把最新点位同步过去（保留临时改价、换过的型号与附加费用），没有则新建 */
  const switchToQuote = useCallback(
    async (targetQuoteId?: string) => {
      if (syncingQuote || saving) return
      if (dirty && !(await save())) return
      const qid = targetQuoteId ?? activeQuote?.id
      if (!qid) {
        quoteForm.current?.requestSubmit()
        return
      }
      if (readOnly) {
        router.push(`/projects/${projectId}/quotes/${qid}`)
        return
      }
      setSyncingQuote(true)
      try {
        const res = await syncQuoteFromPointMap(qid, scope)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        router.push(`/projects/${projectId}/quotes/${qid}${res.pending ? `?pending=${res.pending}` : ''}`)
      } finally {
        setSyncingQuote(false)
      }
    },
    [syncingQuote, saving, dirty, save, activeQuote, readOnly, router, scope],
  )

  /** 打开打印文档（点位图、交底清单、方案）：有未保存的修改先保存 */
  const openDocument = useCallback(
    async (path: 'plans' | 'checklist' | 'proposal') => {
      if (dirty && !readOnly && !(await save())) return
      router.push(`/print/projects/${projectId}/${path}?scope=${scope}`)
    },
    [dirty, readOnly, save, router, projectId, scope],
  )

  /* ---------------- 显示范围 ---------------- */

  useEffect(() => {
    if (!api) return
    void (async () => {
      const ex = await import('@excalidraw/excalidraw')
      const els = elementsNow()
      const hideGroups = new Set<string>()
      if (scope !== 'all') for (const e of els) if (!e.isDeleted && isPointElement(e) && !inPointScope(String(e.customData?.deviceType), scope)) for (const g of e.groupIds ?? []) hideGroups.add(g)
      let changed = false
      const before = els.reduce((sum, e) => sum + ((e.version as number) ?? 0), 0)
      const next = els.map((e) => {
        const shouldHide = !e.isDeleted && (e.groupIds ?? []).some((g) => hideGroups.has(g))
        const orig = hidden.current.get(e.id)
        if (shouldHide && !orig) {
          hidden.current.set(e.id, { opacity: (e.opacity as number) ?? 100, locked: !!e.locked })
          changed = true
          return ex.newElementWith(e as never, { opacity: 0, locked: true } as never) as unknown as SceneEl
        }
        if (!shouldHide && orig) {
          hidden.current.delete(e.id)
          changed = true
          return ex.newElementWith(e as never, orig as never) as unknown as SceneEl
        }
        return e
      })
      if (!changed) return
      api.updateScene({ elements: next as never, appState: { selectedElementIds: {} } as never, captureUpdate: ex.CaptureUpdateAction.NEVER })
      // 切换显示不算修改
      const after = next.reduce((sum, e) => sum + ((e.version as number) ?? 0), 0)
      if (savedVersion.current !== null) savedVersion.current += after - before
    })()
  }, [api, scope, snap.points.length, elementsNow])

  /* ---------------- 派生数据 ---------------- */

  const scopedPoints = useMemo(() => snap.points.filter((p) => inPointScope(p.deviceType, scope)), [snap.points, scope])
  const summary = useMemo(() => summarizePoints(scopedPoints.map((p) => ({ deviceType: p.deviceType, productId: p.productId })), productById, defaults), [scopedPoints, productById, defaults])
  const total = useMemo(() => [...summary.products.entries()].reduce((s, [id, r]) => s + (productById.get(id)?.price ?? 0) * r.count, 0), [summary, productById])
  const typesInUse = DEVICE_TYPE_ORDER.filter((t) => summary.byType.has(t))
  // 房间智能分析插件关闭时不计算配置完整度和建议
  const analysis = useMemo(() => (plugins.roomInsights ? analyzeAreas(snap.areas, scopedPoints) : new Map()), [plugins.roomInsights, snap.areas, scopedPoints])
  const unassigned = scopedPoints.filter((p) => !p.areaId).length
  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return DEVICE_GROUPS
    return DEVICE_GROUPS.map((g) => ({
      ...g,
      types: g.types.filter((t) => `${g.category.name}${t.name}`.toLowerCase().includes(q) || (activeByType.get(t.value) ?? []).some((p) => `${p.name} ${p.sku} ${p.brand}`.toLowerCase().includes(q))),
    })).filter((g) => g.types.length)
  }, [query, activeByType])

  const selectedPoint = selectedPointId ? snap.points.find((p) => p.id === selectedPointId) : undefined
  const selectedResolved = selectedPoint ? resolvePoint({ deviceType: selectedPoint.deviceType, productId: selectedPoint.productId }, productById, defaults) : null
  const selectedArea = selectedAreaId ? snap.areas.find((a) => a.id === selectedAreaId) : undefined
  const missingSheets = snap.sheets.filter((s) => s.missing).length

  return (
    <div className="full-bleed-page -mx-4 -mt-6 -mb-5 flex h-[calc(100svh-5.5rem)] flex-col md:-mx-8 md:-mb-7 md:h-[calc(100svh-3rem)]">
      <form ref={quoteForm} action={createQuoteFromProject} className="hidden">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="scope" value={scope} />
      </form>
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) setCropFile(f)
          e.target.value = ''
        }}
      />
      <input
        ref={dwgInput}
        type="file"
        accept=".dwg"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void importDwg(f)
          e.target.value = ''
        }}
      />

      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 md:px-4">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <MapPinned className="size-4 text-muted-foreground" />
          点位图
          <span className="text-xs font-normal text-muted-foreground tabular-nums">{scopedPoints.length} 个点位</span>
        </span>
        {readOnly ? <Badge variant="secondary">只读</Badge> : dirty ? <Badge variant="outline">未保存</Badge> : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {readOnly ? null : (
            <>
              <Button variant="outline" size="sm" disabled={!api || !!cropFile} onClick={() => fileInput.current?.click()}><ImagePlus className="size-4" />添加图纸</Button>
              {dwgEnabled ? (
                <Button variant="outline" size="sm" disabled={!api || converting || !!cropFile} onClick={() => dwgInput.current?.click()}>
                  {converting ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}导入 DWG
                </Button>
              ) : null}
            </>
          )}
          <Button variant="outline" size="sm" disabled={!api || !snap.sheets.length} onClick={() => void exportSheetPng()}><Download className="size-4" />导出图纸</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={!api || saving}>
                <Printer className="size-4" />打印<ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem disabled={!snap.sheets.length} onSelect={() => void openDocument('plans')}>
                <MapPinned className="size-4" />
                <span className="flex-1">点位图</span>
                <span className="text-xs text-muted-foreground">{scope === 'all' ? '全部' : POINT_SCOPES.find((x) => x.value === scope)?.label}</span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!scopedPoints.length} onSelect={() => void openDocument('checklist')}>
                <ListChecks className="size-4" />
                <span className="flex-1">点位交底清单</span>
              </DropdownMenuItem>
              {plugins.proposal ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled={!scopedPoints.length} onSelect={() => void openDocument('proposal')}>
                    <FileText className="size-4" />
                    <span className="flex-1">方案演示</span>
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          {readOnly ? (
            activeQuote ? (
              <Button variant="outline" size="sm" onClick={() => void switchToQuote()}><ReceiptText className="size-4" />查看报价</Button>
            ) : null
          ) : (
            <>
              <div className="flex items-center">
                <Button
                  variant="outline"
                  size="sm"
                  className={quotes.length ? 'rounded-r-none border-r-0' : undefined}
                  disabled={!api || saving || syncingQuote || !scopedPoints.length}
                  onClick={() => void switchToQuote()}
                  title={activeQuote ? `把点位同步到「${activeQuote.title}」并打开` : undefined}
                >
                  {syncingQuote ? <Loader2 className="size-4 animate-spin" /> : activeQuote ? <ArrowLeftRight className="size-4" /> : <FilePlus2 className="size-4" />}
                  {activeQuote
                    ? `同步到报价${scope === 'all' ? '' : `（${POINT_SCOPES.find((s) => s.value === scope)?.label}）`}`
                    : scope === 'all'
                      ? '生成报价'
                      : `生成报价（${POINT_SCOPES.find((s) => s.value === scope)?.label}）`}
                </Button>
                {quotes.length ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="rounded-l-none px-1.5" disabled={!api || saving || syncingQuote} aria-label="选择要同步的报价，或新建报价">
                        <ChevronDown className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {quotes.map((q) => (
                        <DropdownMenuItem key={q.id} disabled={!scopedPoints.length} onSelect={() => void switchToQuote(q.id)}>
                          <span className={cn('flex-1 truncate', q.id === activeQuote?.id && 'font-semibold')}>同步到「{q.title}」</span>
                          <span className="ml-3 text-xs text-muted-foreground tabular-nums">{yuan(q.total)}</span>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled={!scopedPoints.length} onSelect={() => void createNewQuote()}>
                        <FilePlus2 className="size-4" />新建一份报价（{POINT_SCOPES.find((s) => s.value === scope)?.label}）
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
              <Button size="sm" disabled={!api || saving} onClick={() => void save()}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}保存
              </Button>
            </>
          )}
        </div>
      </div>

      {cropFile ? <SheetCropper file={cropFile} onCancel={cancelCrop} onConfirm={addSheet} /> : null}

      <div className={cn('flex min-h-0 flex-1', cropFile && 'hidden')}>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-1 overflow-x-auto border-b px-3 py-1.5">
            <span className="mr-1 flex shrink-0 items-center gap-1 text-xs text-muted-foreground"><Layers className="size-3.5" />图纸</span>
            {snap.sheets.map((s) =>
              renaming?.id === s.id ? (
                <Input
                  key={s.id}
                  autoFocus
                  value={renaming.name}
                  maxLength={40}
                  aria-label="图纸名称"
                  className="h-7 w-44"
                  onChange={(e) => setRenaming({ id: s.id, name: e.target.value })}
                  onBlur={() => void renameSheet(s.id, renaming.name)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void renameSheet(s.id, renaming.name)
                    if (e.key === 'Escape') setRenaming(null)
                  }}
                />
              ) : (
                <div key={s.id} className={cn('flex shrink-0 items-center rounded-md', s.id === activeSheetId && 'bg-secondary')}>
                  <Button variant="ghost" size="sm" className={cn('pr-1.5', s.id === activeSheetId && 'font-semibold')} onClick={() => fitSheet(s.id)}>
                    {s.missing ? <AlertTriangle className="size-3.5 text-warning" /> : null}
                    {s.name}
                    <span className="text-[11px] font-normal text-muted-foreground tabular-nums">{scopedPoints.filter((p) => p.sheetId === s.id).length}</span>
                  </Button>
                  {readOnly ? null : (
                    <DropdownMenu onOpenChange={(open) => !open && setConfirmDelete(null)}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-xs" aria-label={`图纸「${s.name}」的操作`}><ChevronDown /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onSelect={() => setRenaming({ id: s.id, name: s.name })}>重命名</DropdownMenuItem>
                        {s.url ? <DropdownMenuItem asChild><a href={s.url} download={`${s.name}.png`}>下载标准图纸</a></DropdownMenuItem> : null}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={(e) => {
                            if (confirmDelete !== s.id) {
                              e.preventDefault()
                              setConfirmDelete(s.id)
                            } else void deleteSheet(s)
                          }}
                        >
                          {confirmDelete === s.id ? <><Check />确认删除（含 {snap.points.filter((p) => p.sheetId === s.id).length} 个点位）</> : '删除图纸'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ),
            )}
            {readOnly ? null : (
              <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground" disabled={!api} onClick={() => fileInput.current?.click()}><Plus className="size-4" />添加</Button>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-0.5 pl-2">
              <Button variant="ghost" size="icon-sm" aria-label="缩小" disabled={!api} onClick={() => zoomBy(1 / 1.2)}><Minus className="size-4" /></Button>
              <Button variant="ghost" size="sm" className="min-w-14 tabular-nums" disabled={!api} title="图纸铺满画布（100%）" onClick={() => fitSheet(activeSheetId)}>{zoomPct ?? 100}%</Button>
              <Button variant="ghost" size="icon-sm" aria-label="放大" disabled={!api} onClick={() => zoomBy(1.2)}><Plus className="size-4" /></Button>
              {snap.sheets.length > 1 ? (
                <Button variant="ghost" size="sm" disabled={!api} onClick={() => fitSheet(null)}><Maximize2 className="size-4" />全部</Button>
              ) : null}
            </div>
          </div>

          <div ref={canvasWrap} className={cn('point-map-canvas relative min-h-0 flex-1', armed && 'is-armed')}>
            <Excalidraw
              excalidrawAPI={setApi}
              initialData={initialData}
              onChange={handleChange as never}
              langCode="zh-CN"
              theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
              viewModeEnabled={readOnly}
              UIOptions={{
                canvasActions: { loadScene: false, saveToActiveFile: false, export: false, toggleTheme: false, saveAsImage: false, clearCanvas: false },
                tools: { image: !readOnly },
              }}
            />
            {snap.points.length ? (
              <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-xl border bg-background/95 p-1 pl-2.5 shadow-sm">
                  <Eye className="size-3.5 text-muted-foreground" />
                  <div className="flex rounded-lg bg-muted p-0.5" role="radiogroup" aria-label="显示范围">
                    {POINT_SCOPES.map(({ value: v, label }) => (
                      <Button key={v} size="xs" variant="ghost" role="radio" aria-checked={scope === v} className={cn('h-6 rounded-md px-2', scope === v && 'bg-background shadow-sm')} onClick={() => setScope(v)}>{label}</Button>
                    ))}
                  </div>
                  {scope !== 'all' ? (
                    <Button asChild size="xs" variant="outline" className="h-7">
                      <Link href={`/print/projects/${projectId}/plans?scope=${scope}`}><FileText className="size-3.5" />出{scope === 'switch' ? '开关' : scope === 'no-light' ? '不含灯具' : '灯光开关'}布局图</Link>
                    </Button>
                  ) : null}
              </div>
            ) : null}
            {notices.length || missingSheets ? (
              <div className="absolute top-16 left-1/2 z-10 flex max-w-xl -translate-x-1/2 items-start gap-2 rounded-lg border border-warning/30 bg-background px-3 py-2 text-xs shadow-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                <div className="space-y-0.5">{(notices.length ? notices : [`有 ${missingSheets} 张图纸的图片丢失，请删除后重新添加`]).map((n) => <p key={n}>{n}</p>)}</div>
                <Button variant="ghost" size="icon-xs" aria-label="关闭提示" onClick={() => setNotices([])}><X /></Button>
              </div>
            ) : null}
            {api && !snap.sheets.length && !readOnly ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
                <div className="pointer-events-auto flex max-w-sm flex-col items-center gap-3 rounded-xl border border-dashed bg-background/95 p-6 text-center shadow-sm">
                  <ImagePlus className="size-8 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">先添加户型图</p>
                    <p className="text-xs text-muted-foreground">上传图片后会自动裁掉图框、标题栏和图名，放进 3:2 标准图纸，缩放 100% 时正好铺满画布。</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => fileInput.current?.click()}><ImagePlus className="size-4" />添加图纸</Button>
                    {dwgEnabled ? <Button size="sm" variant="outline" onClick={() => dwgInput.current?.click()}><FileUp className="size-4" />导入 DWG</Button> : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="point-map-aside hidden w-84 shrink-0 flex-col border-l bg-background lg:flex">
          {selectedPoint && selectedResolved ? (
            <SelectedPoint
              code={selectedPoint.code}
              resolved={selectedResolved}
              own={selectedPoint.productId ? productById.get(selectedPoint.productId) : undefined}
              options={activeByType.get(selectedResolved.deviceType) ?? []}
              defaults={defaults}
              productById={productById}
              areaName={snap.areas.find((a) => a.id === selectedPoint.areaId)?.name ?? null}
              readOnly={readOnly}
              onChangeType={(newType) => void updatePointType(selectedPoint.id, newType)}
              onChange={(productId) => void updatePointProduct(selectedPoint.id, productId)}
              onDelete={() => void deletePoint(selectedPoint.id)}
            />
          ) : selectedArea ? (
            <SelectedArea area={selectedArea} analysis={analysis.get(selectedArea.id)} readOnly={readOnly} onChange={(patch) => void updateArea(selectedArea.id, patch)} onDelete={() => void deleteArea(selectedArea.id)} />
          ) : null}

          <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1 gap-0">
            <TabsList className={cn('mx-4 mt-3 grid w-auto', readOnly ? 'grid-cols-2' : 'grid-cols-4')}>
              {readOnly ? null : <TabsTrigger value="place" className="text-xs">放置</TabsTrigger>}
              <TabsTrigger value="areas" className="text-xs">区域</TabsTrigger>
              {readOnly || !plugins.aiImport ? null : <TabsTrigger value="ai" className="text-xs">AI 识别</TabsTrigger>}
              <TabsTrigger value="summary" className="text-xs">
                选型
                {summary.pendingTotal ? <Badge variant="warning" className="ml-0.5 h-4 px-1 text-[10px] tabular-nums">{summary.pendingTotal}</Badge> : null}
              </TabsTrigger>
            </TabsList>

            {readOnly ? null : (
              <TabsContent value="place" className="flex min-h-0 flex-col">
                <PlacePanel groups={filteredGroups} query={query} onQuery={setQuery} counts={summary.byType} armed={armed} onArm={setArmed} disabled={!api || !snap.sheets.length} />
              </TabsContent>
            )}

            <TabsContent value="areas" className="flex min-h-0 flex-col">
              <AreasPanel sheets={snap.sheets} areas={snap.areas} analysis={analysis} unassigned={unassigned} selectedAreaId={selectedAreaId} onAdd={(t) => void addArea(t)} onFocus={focusArea} readOnly={readOnly} />
            </TabsContent>

            {readOnly || !plugins.aiImport ? null : (
              <TabsContent value="ai" className="flex min-h-0 flex-col">
                <AiPanel sheet={activeSheet} onCopyPrompt={() => void copyPrompt()} onImport={runImport} onExport={exportJson} readOnly={readOnly} />
              </TabsContent>
            )}

            <TabsContent value="summary" className="flex min-h-0 flex-col">
              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-2 p-4">
                  {readOnly || !plugins.smartSelect ? null : <SmartSelect platform={platform} busy={selecting} disabled={!scopedPoints.length || saving} onRun={(tier, overwrite) => void autoSelect(tier, overwrite)} />}
                  <div className="flex items-baseline justify-between pt-2">
                    <h2 className="text-sm font-semibold">设备统计{scope !== 'all' ? ` · ${pointScopeLabel(scope)}` : ''}</h2>
                    <span className="text-xs text-muted-foreground tabular-nums">共 {scopedPoints.length} 个点位</span>
                  </div>
                  {typesInUse.length === 0 ? <p className="text-xs text-muted-foreground">还没有放置设备</p> : null}
                  {typesInUse.map((t) => {
                    const def = defaults[t]
                    return (
                      <TypeDefaultRow
                        key={t}
                        type={t}
                        count={summary.byType.get(t) ?? 0}
                        pending={summary.pending.get(t) ?? 0}
                        options={activeByType.get(t) ?? []}
                        value={def && productById.get(def) ? def : null}
                        saving={savingDefault === t}
                        readOnly={readOnly}
                        onChange={(v) => void saveDefault(t, v)}
                      />
                    )
                  })}
                </div>
              </ScrollArea>
              <div className="space-y-2 border-t p-4 text-sm">
                <div className="flex items-baseline justify-between">
                  <span className="text-muted-foreground">设备合计（售价）</span>
                  <span className="font-semibold tabular-nums">{yuan(total)}</span>
                </div>
                {summary.pendingTotal ? <p className="text-xs text-warning">另有 {summary.pendingTotal} 个点位待选型，未计入金额</p> : null}
                {readOnly ? null : (
                  <Button className="w-full" size="sm" disabled={!api || saving || syncingQuote || !scopedPoints.length} onClick={() => void switchToQuote()}>
                    {syncingQuote ? <Loader2 className="size-4 animate-spin" /> : activeQuote ? <ArrowLeftRight className="size-4" /> : <FilePlus2 className="size-4" />}
                    {activeQuote
                      ? `同步并打开报价单${scope === 'all' ? '' : `（${POINT_SCOPES.find((s) => s.value === scope)?.label}）`}`
                      : scope === 'all'
                        ? '生成报价'
                        : `生成报价（${POINT_SCOPES.find((s) => s.value === scope)?.label}）`}
                  </Button>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </div>
  )
}
