'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  ChevronDown,
  CircleAlert,
  Eye,
  FilePlus2,
  FileUp,
  ImagePlus,
  Info,
  Layers,
  Loader2,
  MapPinned,
  Maximize2,
  Minus,
  Plus,
  ReceiptText,
  RotateCcw,
  RotateCw,
  Ruler,
  Save,
  Trash2,
  X,
  ChevronLeft,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSidebar } from '@/components/ui/sidebar'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BoardCanvas, type CanvasContext } from '@/board/canvas/board-canvas'
import { download, exportSheetPng } from '@/board/canvas/export'
import { useViewSettings } from '@/board/canvas/use-view-settings'
import { fromDeg, toDeg, unionBox } from '@/board/core/geometry'
import { useBoardHistory } from '@/board/core/history'
import { moveObjects, rawBox, removeObjects, rotateSymbols, sheetsOf } from '@/board/core/ops'
import type { CheckIssue } from '@/board/core/pack'
import type { BoardFile, BoardObj, BoardTool, Box, SheetObj, SymbolObj, SymbolTemplate, Vec, Viewport } from '@/board/core/types'
import { fitBox, lerpViewport, toScene, zoomAt, type Size } from '@/board/core/viewport'
import { smartHomePack } from '@/board/packs/smart-home'
import { analyzeDoc, decodeScene, encodeDoc, exportBoardJson, parseBoardJson } from '@/board/packs/smart-home/codec'
import { lightingVariant } from '@/board/packs/smart-home/look'
import { changePointType, cloneObjects, createArea, createPoint, createSheet, removeSheet, setPointReal, setPointVariant, updateArea as updateAreaOp, updateSheet } from '@/board/packs/smart-home/ops'
import { analyzeAreas } from '@/lib/area-analysis'
import { areaTypeLabel } from '@/lib/area-types'
import { DEVICE_GROUPS, DEVICE_TYPE_ORDER, deviceTypeLabel } from '@/lib/device-types'
import { registerLeaveGuard } from '@/lib/leave-guard'
import { summarizePoints, type ProjectDefaults } from '@/lib/point-map-items'
import { inferScopeFromTitle, inPointScope, POINT_SCOPES, pointScopeLabel, type PointScope } from '@/lib/point-scopes'
import { compactScene, inlineFileIds, type SceneFile, type StoredScene } from '@/lib/point-scene'
import { cn } from '@/lib/utils'

import { createQuoteFromProject, syncQuoteFromPointMap } from '../quotes/actions'

import { BoardToolbar } from './board-toolbar'
import { AreasPanel, DRAG_TYPE, PlacePanel, PointMapContextMenu, SelectedArea, SelectedPoint, TypeDefaultRow, yuan, type CanvasContextMenuTarget, type PointProduct } from './editor-panels'
import { LightingPanel } from './lighting-panel'
import { SheetCropper } from './sheet-cropper'

export type { PointProduct } from './editor-panels'

/** 图纸铺满画布时四周留一点边：这个状态显示为 100% */
const FIT = 0.96
const pack = smartHomePack

type ProjectQuoteSummary = { id: string; title: string; status: string; total: number }
/** 点位图里由插件提供的功能是否可用（服务端按「设置 → 插件」计算后传入）。 */
export type PointMapPlugins = { aiImport: boolean; smartSelect: boolean; dwg: boolean; roomInsights: boolean; proposal: boolean }
type InitialFocus = { quoteId: string | null; sheet: string | null; area: string | null; point: string | null; scope: PointScope | null }
type Draft = { v: 1; base: string | null; at: number; scene: StoredScene }

const draftKey = (projectId: string) => `fmkj:pointmap:draft:${projectId}`
const deviceTpl = (deviceType: string): SymbolTemplate => ({ symbolId: deviceType, sizeCm: null, real: false, data: { deviceType } })
const boxOf = (o: BoardObj): Box | null =>
  o.kind === 'symbol' ? { x: o.x - 14, y: o.y - 14, w: 28, h: 28 } : o.kind === 'raw' ? rawBox(o.el) : { x: o.x, y: o.y, w: o.w, h: o.h }

function isTyping() {
  const el = document.activeElement as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

export function PointMapEditor({
  projectId,
  projectName,
  initialScene,
  serverUpdatedAt = null,
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
  serverUpdatedAt?: string | null
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
  const board = useBoardHistory(() => decodeScene(initialScene))
  const { doc, commit } = board
  const [files, setFiles] = useState<Record<string, BoardFile>>(() => ({ ...initialScene.files }))
  const filesRef = useRef(files)
  filesRef.current = files
  const [view, setView] = useViewSettings()
  const [viewport, setViewportState] = useState<Viewport>({ zoom: 1, scrollX: 0, scrollY: 0 })
  const viewportRef = useRef(viewport)
  const [size, setSize] = useState<Size>({ w: 0, h: 0 })
  const sizeRef = useRef(size)
  const [ready, setReady] = useState(false)
  const [selection, setSelection] = useState<Set<string>>(() => new Set())
  const [tool, setTool] = useState<BoardTool>('select')
  const [armed, setArmed] = useState<SymbolTemplate | null>(null)
  const [placeTab, setPlaceTab] = useState<'devices' | 'lighting'>('devices')
  const [ctxMenu, setCtxMenu] = useState<CanvasContextMenuTarget | null>(null)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [defaults] = useState<ProjectDefaults>(initialDefaults)
  const [query, setQuery] = useState('')
  const [savedVersion, setSavedVersion] = useState<number | null>(needsSave ? -1 : 0)
  const [saving, setSaving] = useState(false)
  const [converting, setConverting] = useState(false)
  const [notices, setNotices] = useState<string[]>(warnings)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [tab, setTab] = useState(readOnly ? 'summary' : 'place')
  const [calib, setCalib] = useState<{ sheetId: string; units: number; value: string } | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const activeQuote = useMemo(() => (initialFocus?.quoteId ? quotes.find((q) => q.id === initialFocus.quoteId) : undefined) ?? quotes[0] ?? null, [quotes, initialFocus?.quoteId])
  /** 显示范围：只看开关等。只改画面显示，不改图纸数据 */
  const [scope, setScope] = useState<PointScope>(() => initialFocus?.scope ?? (activeQuote ? inferScopeFromTitle(activeQuote.title) : 'all'))
  const [syncingQuote, setSyncingQuote] = useState(false)
  const fitState = useRef<{ sheetId: string | null } | null>(null)
  const anim = useRef<number | null>(null)
  const clipboard = useRef<BoardObj[]>([])
  const lastPointer = useRef<Vec | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const dwgInput = useRef<HTMLInputElement>(null)
  const jsonInput = useRef<HTMLInputElement>(null)
  const quoteForm = useRef<HTMLFormElement>(null)

  // 首次版本号为 0；needsSave 时用 -1 让页面一打开就处于「未保存」
  const dirty = !readOnly && savedVersion !== board.version
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const activeByType = useMemo(() => {
    const map = new Map<string, PointProduct[]>()
    for (const p of products) {
      if (p.status !== 'active' || !p.deviceType) continue
      map.set(p.deviceType, [...(map.get(p.deviceType) ?? []), p])
    }
    return map
  }, [products])

  const snap = useMemo(() => analyzeDoc(doc, files), [doc, files])
  const sheetObjs = useMemo(() => sheetsOf(doc), [doc])
  const hidden = useMemo(() => {
    const set = new Set<string>()
    if (scope !== 'all') for (const p of snap.points) if (!inPointScope(p.deviceType, scope)) set.add(p.id)
    return set
  }, [snap.points, scope])

  /* ---------------- 视口 ---------------- */

  const setViewport = useCallback((v: Viewport, user = true) => {
    if (user) {
      fitState.current = null
      if (anim.current) cancelAnimationFrame(anim.current)
      anim.current = null
    }
    viewportRef.current = v
    setViewportState(v)
  }, [])

  const animateTo = useCallback(
    (target: Viewport, animate = true) => {
      if (anim.current) cancelAnimationFrame(anim.current)
      const from = viewportRef.current
      if (!animate || !sizeRef.current.w) return setViewport(target, false)
      const t0 = performance.now()
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / 280)
        const e = 1 - Math.pow(1 - k, 3)
        setViewport(lerpViewport(from, target, e, sizeRef.current), false)
        anim.current = k < 1 ? requestAnimationFrame(step) : null
      }
      anim.current = requestAnimationFrame(step)
    },
    [setViewport],
  )

  // 顶部浮动工具条约 44px 高，适配视图时让图纸标题落在工具条下方
  const insets = useMemo(() => ({ top: (view.rulers ? 28 : 8) + 48, left: view.rulers ? 28 : 8, right: 8, bottom: 8 }), [view.rulers])
  const fitSheet = useCallback(
    (sheetId: string | null, animate = true) => {
      const d = board.current.current.doc
      const sheets = sheetsOf(d)
      const s = sheetId ? sheets.find((x) => x.sheetId === sheetId) : null
      const box = s ? { x: s.x, y: s.y - 50, w: s.w, h: s.h + 50 } : unionBox(sheets.length ? sheets.map((x) => ({ x: x.x, y: x.y - 50, w: x.w, h: x.h + 50 })) : d.objects.map(boxOf).filter((b): b is Box => !!b))
      if (!box || !sizeRef.current.w) return
      animateTo(fitBox(box, sizeRef.current, FIT, insets), animate)
      fitState.current = { sheetId: s?.sheetId ?? null }
    },
    [animateTo, board, insets],
  )

  const focusBox = useCallback(
    (box: Box, factor: number) => {
      if (!sizeRef.current.w) return
      const pad = Math.max(box.w, box.h, 60)
      animateTo(fitBox({ x: box.x + box.w / 2 - pad / 2, y: box.y + box.h / 2 - pad / 2, w: pad, h: pad }, sizeRef.current, factor, insets))
    },
    [animateTo, insets],
  )

  const onSize = useCallback(
    (s: Size) => {
      sizeRef.current = s
      setSize(s)
      if (fitState.current) fitSheet(fitState.current.sheetId, false)
    },
    [fitSheet],
  )

  // 当前图纸 = 视野中心所在的图纸；缩放百分比以「图纸铺满画布」为 100%
  const center = size.w ? toScene(viewport, size.w / 2, size.h / 2) : null
  const activeSheet: SheetObj | null = useMemo(() => {
    if (!center) return sheetObjs[0] ?? null
    return (
      sheetObjs.find((s) => center.x >= s.x && center.x <= s.x + s.w && center.y >= s.y - 60 && center.y <= s.y + s.h) ??
      sheetObjs.slice().sort((a, b) => Math.hypot(a.x + a.w / 2 - center.x, a.y + a.h / 2 - center.y) - Math.hypot(b.x + b.w / 2 - center.x, b.y + b.h / 2 - center.y))[0] ??
      null
    )
  }, [center?.x, center?.y, sheetObjs]) // eslint-disable-line react-hooks/exhaustive-deps
  const activeSheetId = activeSheet?.sheetId ?? null
  const zoomPct = useMemo(() => {
    if (!activeSheet || !size.w) return Math.round(viewport.zoom * 100)
    const fit = fitBox({ x: activeSheet.x, y: activeSheet.y - 50, w: activeSheet.w, h: activeSheet.h + 50 }, size, FIT, insets).zoom
    return Math.round((viewport.zoom / fit) * 100)
  }, [activeSheet, size, viewport.zoom, insets])

  const zoomBy = useCallback((factor: number) => {
    const v = viewportRef.current
    const s = sizeRef.current
    setViewport(zoomAt(v, s.w / 2, s.h / 2, v.zoom * factor))
  }, [setViewport])

  /* ---------------- 初次定位：从报价单跳回时定位到点位 / 区域 / 楼层，否则铺满第一张图纸 ---------------- */

  const focusRef = useRef(initialFocus)
  useEffect(() => {
    if (ready || !size.w) return
    setReady(true)
    const f = focusRef.current
    const d = board.current.current.doc
    if (f?.point) {
      const pt = d.objects.find((o): o is SymbolObj => o.kind === 'symbol' && o.code === f.point)
      if (pt) {
        setSelection(new Set([pt.id]))
        animateTo(fitBox({ x: pt.x - 100, y: pt.y - 70, w: 200, h: 140 }, size, 1, insets), false)
        return
      }
    }
    if (f?.area) {
      const target = f.area.replace(/\s+/g, '')
      const ar = d.objects.find((o) => o.kind === 'area' && (o.id === f.area || o.name.replace(/\s+/g, '') === target))
      if (ar && ar.kind === 'area') {
        setSelection(new Set([ar.id]))
        animateTo(fitBox(ar, size, 0.7, insets), false)
        return
      }
    }
    fitSheet(f?.sheet ?? sheetsOf(d)[0]?.sheetId ?? null, false)
  }, [ready, size, board, animateTo, fitSheet, insets])

  // 侧边栏 AI 工具改了服务端点位图并 router.refresh() 时，没有未保存修改就直接换成最新内容
  const prevInitial = useRef(initialScene)
  useEffect(() => {
    if (prevInitial.current === initialScene) return
    prevInitial.current = initialScene
    if (dirty) return
    board.reset(decodeScene(initialScene))
    setFiles({ ...initialScene.files })
    setSelection(new Set())
    setSavedVersion(null)
    setTimeout(() => fitSheet(sheetsOf(decodeScene(initialScene))[0]?.sheetId ?? null), 60)
  }, [initialScene, dirty, board, fitSheet])
  // reset 后把当前版本记为已保存
  useEffect(() => {
    if (savedVersion === null) setSavedVersion(board.version)
  }, [savedVersion, board.version])

  // 画布页默认收起左侧导航；离开时恢复
  const sidebarRef = useRef(sidebar)
  sidebarRef.current = sidebar
  useEffect(() => {
    const was = sidebarRef.current.open
    if (was) sidebarRef.current.setOpen(false)
    return () => {
      if (was) sidebarRef.current.setOpen(true)
    }
  }, [])

  /* ---------------- 保存 / 本地草稿 ---------------- */

  const currentScene = useCallback(() => compactScene(encodeDoc(board.current.current.doc), filesRef.current as Record<string, SceneFile>, { viewBackgroundColor: '#ffffff' }), [board])

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // 有未保存修改时，停手 1 秒存一份本地草稿（浏览器崩溃、断网也不丢）
  useEffect(() => {
    if (!dirty) return
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey(projectId), JSON.stringify({ v: 1, base: serverUpdatedAt, at: Date.now(), scene: currentScene() } satisfies Draft))
      } catch {
        /* 存储已满时跳过 */
      }
    }, 1000)
    return () => clearTimeout(t)
  }, [dirty, doc, projectId, serverUpdatedAt, currentScene])

  // 打开时发现基于同一版本的草稿 → 提示恢复
  useEffect(() => {
    if (readOnly) return
    try {
      const d = JSON.parse(localStorage.getItem(draftKey(projectId)) ?? 'null') as Draft | null
      if (!d || d.v !== 1 || !d.scene) return
      if (d.base !== serverUpdatedAt || JSON.stringify(d.scene.elements) === JSON.stringify(compactScene(initialScene.elements, initialScene.files).elements)) {
        localStorage.removeItem(draftKey(projectId))
        return
      }
      setDraft(d)
    } catch {
      /* 忽略 */
    }
  }, [projectId, serverUpdatedAt, readOnly, initialScene])

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
    if (saving || readOnly) return false
    setSaving(true)
    const version = board.current.current.version
    try {
      const scene = currentScene()
      // 导入的 JSON 里内嵌的图片先存进媒体库，场景里只留地址
      for (const id of inlineFileIds(scene)) {
        const blob = await (await fetch(scene.files[id].dataURL)).blob()
        const { url } = await uploadImage(blob, '画布图片', 'asset')
        scene.files[id] = { ...scene.files[id], dataURL: url }
        setFiles((f) => ({ ...f, [id]: { ...f[id], dataURL: url } }))
      }
      const res = await fetch(`/projects/${projectId}/point-map/data`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(scene) })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? '保存失败，请稍后重试')
      setSavedVersion(version)
      try {
        localStorage.removeItem(draftKey(projectId))
      } catch {
        /* 忽略 */
      }
      setDraft(null)
      toast.success('点位图已保存')
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败，请稍后重试')
      return false
    } finally {
      setSaving(false)
    }
  }, [saving, readOnly, board, currentScene, uploadImage, projectId])

  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => {
    if (!dirty || readOnly) return
    return registerLeaveGuard(async () => (await saveRef.current()) || window.confirm('点位图保存失败，仍要离开吗？未保存的修改会丢失。'))
  }, [dirty, readOnly])

  /* ---------------- 点位 ---------------- */

  const placePoint = useCallback(
    (tpl: SymbolTemplate, at: Vec) => {
      if (readOnly) return
      commit((d) => createPoint(d, tpl, at).doc)
    },
    [readOnly, commit],
  )

  const updatePointType = useCallback(
    (pointId: string, newType: string) => {
      commit((d) => changePointType(d, pointId, newType))
      toast.success(`已切换为「${deviceTypeLabel(newType)}」`)
    },
    [commit],
  )

  const duplicate = useCallback(
    (ids: string[]) => {
      if (readOnly) return
      const d = board.current.current.doc
      const src = d.objects.filter((o) => ids.includes(o.id) && o.kind !== 'sheet')
      if (!src.length) return
      const r = cloneObjects(d, src, { x: 28, y: 16 })
      commit(r.doc)
      setSelection(new Set(r.ids))
    },
    [readOnly, board, commit],
  )

  const removeIds = useCallback(
    (ids: Iterable<string>) => {
      if (readOnly) return
      const set = new Set(ids)
      commit((d) => removeObjects(d, new Set(d.objects.filter((o) => set.has(o.id) && o.kind !== 'sheet').map((o) => o.id))))
      setSelection(new Set())
    },
    [readOnly, commit],
  )

  const rotate = useCallback((ids: Iterable<string>, deg: number) => commit((d) => rotateSymbols(d, [...ids], { delta: fromDeg(deg) })), [commit])

  /* ---------------- 图纸 ---------------- */

  const addSheet = useCallback(
    async (png: Blob, name: string) => {
      const { url, mediaId } = await uploadImage(png, name, 'sheet')
      const fileId = `sheet-${mediaId ?? Date.now().toString(36)}`
      setFiles((f) => ({ ...f, [fileId]: { id: fileId, dataURL: url, mimeType: 'image/png', created: Date.now() } }))
      const r = createSheet(board.current.current.doc, { name, fileId, mediaId })
      commit(r.doc)
      setCropFile(null)
      setTimeout(() => fitSheet(r.obj.sheetId), 80)
      toast.success(`已添加图纸「${name}」`)
      // 图纸已经存进媒体库，立即保存，避免离开页面后丢失
      setTimeout(() => void saveRef.current(), 200)
    },
    [uploadImage, board, commit, fitSheet],
  )

  const renameSheet = useCallback(
    (sheetId: string, name: string) => {
      const v = name.trim().slice(0, 40)
      setRenaming(null)
      if (v) commit((d) => updateSheet(d, sheetId, { name: v }))
    },
    [commit],
  )

  const deleteSheet = useCallback(
    (sheetId: string) => {
      setConfirmDelete(null)
      const s = sheetsOf(board.current.current.doc).find((x) => x.sheetId === sheetId)
      if (!s) return
      commit((d) => removeSheet(d, s))
      setSelection(new Set())
      toast.success(`已删除图纸「${s.name}」，可按 Ctrl/⌘ + Z 撤销`)
    },
    [board, commit],
  )

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

  /** 标定：在图纸上拖一条线，输入真实长度 */
  const startCalibrate = useCallback(() => {
    if (readOnly) return
    setArmed(null)
    setTool('calibrate')
    toast.info('在图纸上沿一段已知长度（如门洞、墙段尺寸）拖一条线，松开后输入真实长度')
  }, [readOnly])

  const applyCalibration = useCallback(() => {
    if (!calib) return
    const m = Number(calib.value.replace(/[^\d.]/g, ''))
    if (!(m > 0)) return toast.error('请输入大于 0 的长度（米）')
    const mmPerUnit = (m * 1000) / calib.units
    commit((d) => updateSheet(d, calib.sheetId, { mmPerUnit }))
    setCalib(null)
    setTool('select')
    if (!view.grid) setView({ grid: true })
    toast.success(`已标定：1 米 ≈ ${Math.round(1000 / mmPerUnit)} 个单位，网格按 25cm 显示`)
  }, [calib, commit, view.grid, setView])

  /* ---------------- 区域 ---------------- */

  const addAreaAt = useCallback(
    (cx: number, cy: number, areaType = 'living') => {
      const r = createArea(board.current.current.doc, { x: cx - 110, y: cy - 75, w: 220, h: 150 }, areaType)
      commit(r.doc)
      setSelection(new Set([r.obj.id]))
      toast.success('已添加区域：拖动顶点调整形状，拖动边的中点可以加顶点')
    },
    [board, commit],
  )
  const addArea = useCallback(
    (areaType: string) => {
      const s = sizeRef.current
      const c = toScene(viewportRef.current, s.w / 2, s.h / 2)
      addAreaAt(c.x, c.y, areaType)
    },
    [addAreaAt],
  )
  const createAreaBox = useCallback(
    (box: Box, poly?: Vec[]) => {
      const r = createArea(board.current.current.doc, box, 'living', undefined, poly)
      commit(r.doc)
      setSelection(new Set([r.obj.id]))
      setTool('select')
    },
    [board, commit],
  )
  const updateArea = useCallback((areaId: string, patch: { name?: string; areaType?: string }) => commit((d) => updateAreaOp(d, areaId, patch)), [commit])
  // 从区域列表定位前的视角；关闭选中卡片时回到这里（连续切换区域时保留最早的那个视角）
  const viewBeforeFocus = useRef<Viewport | null>(null)
  const focusArea = useCallback(
    (areaId: string) => {
      const a = board.current.current.doc.objects.find((o) => o.id === areaId)
      if (!a || a.kind !== 'area') return
      if (!viewBeforeFocus.current) viewBeforeFocus.current = viewportRef.current
      setSelection(new Set([areaId]))
      animateTo(fitBox(a, sizeRef.current, 0.7, insets))
    },
    [board, animateTo, insets],
  )
  const closeSelectedArea = useCallback(() => {
    setSelection(new Set())
    if (viewBeforeFocus.current) animateTo(viewBeforeFocus.current)
    viewBeforeFocus.current = null
  }, [animateTo])
  // 用 Esc 或点空白处取消选中时不还原视角，但要清掉记录，下次定位重新记
  useEffect(() => {
    if (selection.size === 0) viewBeforeFocus.current = null
  }, [selection])
  const focusTargets = useCallback(
    (ids: string[]) => {
      const d = board.current.current.doc
      const box = unionBox(d.objects.filter((o) => ids.includes(o.id)).map(boxOf).filter((b): b is Box => !!b))
      if (!box) return
      setSelection(new Set(ids))
      focusBox(box, 0.6)
    },
    [board, focusBox],
  )

  /* ---------------- 报价 ---------------- */

  const createNewQuote = useCallback(async () => {
    if (dirty && !(await save())) return
    quoteForm.current?.requestSubmit()
  }, [dirty, save])

  /** 无缝切换到报价单：已有报价单时自动同步最新点位，没有则新建 */
  const switchToQuote = useCallback(
    async (targetQuoteId?: string) => {
      if (syncingQuote || saving) return
      if (dirty && !(await save())) return
      const qid = targetQuoteId ?? activeQuote?.id
      if (!qid) return quoteForm.current?.requestSubmit()
      if (readOnly) return router.push(`/projects/${projectId}/quotes/${qid}`)
      setSyncingQuote(true)
      try {
        const res = await syncQuoteFromPointMap(qid, scope)
        if (!res.ok) return toast.error(res.error)
        router.push(`/projects/${projectId}/quotes/${qid}${res.pending ? `?pending=${res.pending}` : ''}`)
      } finally {
        setSyncingQuote(false)
      }
    },
    [syncingQuote, saving, dirty, save, activeQuote, readOnly, router, projectId, scope],
  )

  /* ---------------- 导入导出 ---------------- */

  const exportPng = useCallback(async () => {
    const sheet = activeSheet
    if (!sheet) return toast.error('还没有图纸')
    const pending = toast.loading('正在生成图片…')
    try {
      const { blob, scale } = await exportSheetPng({ doc: board.current.current.doc, files: filesRef.current, sheet, pack, view, hidden, project: projectName })
      download(blob, `${projectName}-${sheet.name}-点位图.png`)
      toast.success(scale ? `已导出（${pack.paper} · 1:${scale}，打印选「实际大小」）` : '已导出（图纸未标定，按纸张铺满）')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导出失败')
    } finally {
      toast.dismiss(pending)
    }
  }, [activeSheet, board, view, hidden, projectName])

  const exportJson = useCallback(() => {
    download(new Blob([exportBoardJson(board.current.current.doc, filesRef.current, projectName)], { type: 'application/json' }), `${projectName}-画板.json`)
  }, [board, projectName])

  const importJson = useCallback(
    async (file: File) => {
      try {
        const r = parseBoardJson(await file.text())
        setFiles((f) => ({ ...f, ...r.files }))
        commit(r.doc)
        setSelection(new Set())
        setTimeout(() => fitSheet(sheetsOf(r.doc)[0]?.sheetId ?? null), 60)
        toast.success('已导入，可按 Ctrl/⌘ + Z 撤销；确认无误后保存')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '导入失败')
      }
    },
    [commit, fitSheet],
  )

  /* ---------------- 画布事件 ---------------- */

  const onContextMenu = useCallback(
    ({ hit, scene, local, wrap }: CanvasContext) => {
      if (readOnly) return
      if (armed) {
        setArmed(null)
        return
      }
      const base = { x: local.x, y: local.y, wrapW: wrap.w, wrapH: wrap.h }
      if (hit?.kind === 'symbol') {
        const p = snap.points.find((x) => x.id === hit.id)
        if (!p) return
        setCtxMenu({ kind: 'point', pointId: p.id, code: p.code, deviceType: p.deviceType, areaName: snap.areas.find((a) => a.id === p.areaId)?.name ?? null, ...base })
      } else if (hit?.kind === 'area') {
        const a = snap.areas.find((x) => x.id === hit.id)
        if (a) setCtxMenu({ kind: 'area', areaId: a.id, name: a.name, areaType: a.areaType, ...base })
      } else setCtxMenu({ kind: 'canvas', sceneX: scene.x, sceneY: scene.y, ...base })
    },
    [readOnly, armed, snap],
  )

  const onDrop = useCallback(
    (data: string, at: Vec) => {
      if (readOnly) return
      let tpl: SymbolTemplate
      try {
        tpl = data.startsWith('{') ? (JSON.parse(data) as SymbolTemplate) : deviceTpl(data)
      } catch {
        return
      }
      placePoint(tpl, at)
    },
    [readOnly, placePoint],
  )

  const onCalibrateLine = useCallback((sheet: SheetObj, a: Vec, b: Vec) => {
    setCalib({ sheetId: sheet.sheetId, units: Math.hypot(a.x - b.x, a.y - b.y), value: '' })
  }, [])

  // 记录鼠标位置，粘贴时贴到鼠标处
  useEffect(() => {
    const onMove = (e: PointerEvent) => (lastPointer.current = { x: e.clientX, y: e.clientY })
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  /* ---------------- 快捷键 ---------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping() || document.querySelector('[role=dialog],[role=menu]')) return
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      const sel = [...selection]
      if (mod && key === 's') {
        e.preventDefault()
        if (!readOnly) void save()
        return
      }
      if (mod && key === '0') {
        e.preventDefault()
        return fitSheet(activeSheetId)
      }
      if (mod && (key === '=' || key === '+')) {
        e.preventDefault()
        return zoomBy(1.2)
      }
      if (mod && key === '-') {
        e.preventDefault()
        return zoomBy(1 / 1.2)
      }
      if (key === 'escape') {
        if (armed) setArmed(null)
        else if (tool !== 'select') setTool('select')
        else setSelection(new Set())
        return
      }
      if (key === 'g' && !mod) return setView({ grid: !view.grid })
      if (key === 'r' && e.shiftKey && !mod) return setView({ rulers: !view.rulers })
      if (!mod && key === 'v') return setTool('select')
      if (!mod && key === 'h') return setTool('pan')
      if (readOnly) return
      if (mod && key === 'z') {
        e.preventDefault()
        return e.shiftKey ? board.redo() : board.undo()
      }
      if (mod && key === 'y') {
        e.preventDefault()
        return board.redo()
      }
      if (!mod && key === 'a') return setTool('area')
      if (!mod && key === 'c') return startCalibrate()
      if (mod && key === 'a') {
        e.preventDefault()
        return setSelection(new Set(doc.objects.filter((o) => o.kind === 'symbol' && !hidden.has(o.id)).map((o) => o.id)))
      }
      if (!sel.length) return
      if (key === 'delete' || key === 'backspace') {
        e.preventDefault()
        return removeIds(sel)
      }
      if (mod && key === 'd') {
        e.preventDefault()
        return duplicate(sel)
      }
      if (mod && key === 'c') {
        clipboard.current = doc.objects.filter((o) => selection.has(o.id) && o.kind !== 'sheet')
        return toast.success(`已复制 ${clipboard.current.length} 个对象`)
      }
      if (key === 'r' && !mod && !e.shiftKey) return rotate(sel, 90)
      const nudge = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[key]
      if (nudge) {
        e.preventDefault()
        const k = e.shiftKey ? 10 : 1
        commit((d) => moveObjects(d, sel, nudge[0] * k, nudge[1] * k))
      }
    }
    const onPaste = (e: KeyboardEvent) => {
      if (readOnly || isTyping() || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'v' || !clipboard.current.length) return
      e.preventDefault()
      const src = clipboard.current
      const box = unionBox(src.map(boxOf).filter((b): b is Box => !!b))
      let offset = { x: 24, y: 24 }
      const lp = lastPointer.current
      const wrap = document.querySelector('.point-map-canvas')?.getBoundingClientRect()
      if (box && lp && wrap && lp.x >= wrap.left && lp.x <= wrap.right && lp.y >= wrap.top && lp.y <= wrap.bottom) {
        const p = toScene(viewportRef.current, lp.x - wrap.left, lp.y - wrap.top)
        offset = { x: p.x - (box.x + box.w / 2), y: p.y - (box.y + box.h / 2) }
      }
      const r = cloneObjects(board.current.current.doc, src, offset)
      commit(r.doc)
      setSelection(new Set(r.ids))
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keydown', onPaste)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keydown', onPaste)
    }
  }, [selection, readOnly, save, fitSheet, activeSheetId, zoomBy, armed, tool, view.grid, view.rulers, setView, board, startCalibrate, doc, hidden, removeIds, duplicate, rotate, commit])

  /* ---------------- 派生数据 ---------------- */

  const scopedPoints = useMemo(() => snap.points.filter((p) => inPointScope(p.deviceType, scope)), [snap.points, scope])
  const summary = useMemo(() => summarizePoints(scopedPoints.map((p) => ({ deviceType: p.deviceType, productId: p.productId })), productById, defaults), [scopedPoints, productById, defaults])
  const typesInUse = DEVICE_TYPE_ORDER.filter((t) => summary.byType.has(t))
  const analysis = useMemo(() => (plugins.roomInsights ? analyzeAreas(snap.areas, scopedPoints) : new Map()), [plugins.roomInsights, snap.areas, scopedPoints])
  const unassigned = scopedPoints.filter((p) => !p.areaId).length
  const issues: CheckIssue[] = useMemo(() => pack.check(doc), [doc])
  // 灯具统一在「灯光设计」里放（按款式和尺寸），智能设备不再重复列出
  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const groups = DEVICE_GROUPS.filter((g) => g.category.slug !== 'lighting')
    if (!q) return groups
    return groups.map((g) => ({
      ...g,
      types: g.types.filter((t) => `${g.category.name}${t.name}`.toLowerCase().includes(q) || (activeByType.get(t.value) ?? []).some((p) => `${p.name} ${p.sku} ${p.brand}`.toLowerCase().includes(q))),
    })).filter((g) => g.types.length)
  }, [query, activeByType])

  const selectedIds = [...selection]
  const selectedSymbol = selectedIds.length === 1 ? doc.objects.find((o): o is SymbolObj => o.kind === 'symbol' && o.id === selectedIds[0]) : undefined
  const selectedPoint = selectedSymbol ? snap.points.find((p) => p.id === selectedSymbol.id) : undefined
  const selectedArea = selectedIds.length === 1 ? snap.areas.find((a) => a.id === selectedIds[0]) : undefined
  const variant = selectedSymbol ? lightingVariant(selectedSymbol.symbolId) : undefined
  const missingSheets = snap.sheets.filter((s) => s.missing).length
  const armedDevice = armed && armed.symbolId === armed.data.deviceType ? String(armed.data.deviceType) : null
  const armedLabel = armed ? pack.look({ symbolId: armed.symbolId, data: armed.data }).name : ''

  return (
    <div className="full-bleed-page -mx-4 -mt-6 -mb-5 flex h-[calc(100svh-5.5rem)] flex-col md:-mx-8 md:-mb-7 md:h-[calc(100svh-3rem)]">
      <form ref={quoteForm} action={createQuoteFromProject} className="hidden">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="scope" value={scope} />
      </form>
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setCropFile(f); e.target.value = '' }} />
      <input ref={dwgInput} type="file" accept=".dwg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importDwg(f); e.target.value = '' }} />
      <input ref={jsonInput} type="file" accept=".json,.excalidraw,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importJson(f); e.target.value = '' }} />

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
              <Button variant="outline" size="sm" disabled={!!cropFile} onClick={() => fileInput.current?.click()} aria-label="添加图纸" title="添加图纸"><ImagePlus className="size-4" /><span className="hidden sm:inline">添加图纸</span></Button>
              {dwgEnabled ? (
                <Button variant="outline" size="sm" disabled={converting || !!cropFile} onClick={() => dwgInput.current?.click()} aria-label="导入 DWG" title="导入 DWG">
                  {converting ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}<span className="hidden sm:inline">导入 DWG</span>
                </Button>
              ) : null}
            </>
          )}
          {readOnly ? (
            activeQuote ? <Button variant="outline" size="sm" onClick={() => void switchToQuote()}><ReceiptText className="size-4" />查看报价</Button> : null
          ) : (
            <>
              <div className="flex items-center">
                <Button variant="outline" size="sm" className={quotes.length ? 'rounded-r-none border-r-0' : undefined} disabled={saving || syncingQuote || !scopedPoints.length} onClick={() => void switchToQuote()} title={activeQuote ? `把点位同步到「${activeQuote.title}」并打开` : undefined}>
                  {syncingQuote ? <Loader2 className="size-4 animate-spin" /> : activeQuote ? <ArrowLeftRight className="size-4" /> : <FilePlus2 className="size-4" />}
                  {activeQuote ? `同步到报价${scope === 'all' ? '' : `（${pointScopeLabel(scope)}）`}` : scope === 'all' ? '生成报价' : `生成报价（${pointScopeLabel(scope)}）`}
                </Button>
                {quotes.length ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="rounded-l-none px-1.5" disabled={saving || syncingQuote} aria-label="选择要同步的报价，或新建报价"><ChevronDown className="size-3.5" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {quotes.map((q) => (
                        <DropdownMenuItem key={q.id} disabled={!scopedPoints.length} onSelect={() => void switchToQuote(q.id)}>
                          <span className={cn('flex-1 truncate', q.id === activeQuote?.id && 'font-semibold')}>同步到「{q.title}」</span>
                          <span className="ml-3 text-xs text-muted-foreground tabular-nums">{yuan(q.total)}</span>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled={!scopedPoints.length} onSelect={() => void createNewQuote()}><FilePlus2 className="size-4" />新建一份报价（{pointScopeLabel(scope)}）</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
              <Button size="sm" disabled={saving} onClick={() => void save()}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}保存</Button>
            </>
          )}
        </div>
      </div>

      {cropFile ? <SheetCropper file={cropFile} onCancel={cancelCrop} onConfirm={addSheet} /> : null}

      <div className={cn('flex min-h-0 flex-1 flex-col lg:flex-row', cropFile && 'hidden')}>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-1 overflow-x-auto border-b px-3 py-1.5">
            <span className="mr-1 flex shrink-0 items-center gap-1 text-xs text-muted-foreground"><Layers className="size-3.5" />图纸</span>
            {snap.sheets.map((s) => {
              const obj = sheetObjs.find((o) => o.sheetId === s.id)
              return renaming?.id === s.id ? (
                <Input key={s.id} autoFocus value={renaming.name} maxLength={40} aria-label="图纸名称" className="h-7 w-44" onChange={(e) => setRenaming({ id: s.id, name: e.target.value })} onBlur={() => renameSheet(s.id, renaming.name)} onKeyDown={(e) => { if (e.key === 'Enter') renameSheet(s.id, renaming.name); if (e.key === 'Escape') setRenaming(null) }} />
              ) : (
                <div key={s.id} className={cn('flex shrink-0 items-center rounded-md', s.id === activeSheetId && 'bg-secondary')}>
                  <Button variant="ghost" size="sm" className={cn('pr-1.5', s.id === activeSheetId && 'font-semibold')} onClick={() => fitSheet(s.id)}>
                    {s.missing ? <AlertTriangle className="size-3.5 text-warning" /> : null}
                    {s.name}
                    {obj?.mmPerUnit ? <Ruler className="size-3 text-muted-foreground" aria-label="已标定" /> : null}
                    <span className="text-xs font-normal text-muted-foreground tabular-nums">{scopedPoints.filter((p) => p.sheetId === s.id).length}</span>
                  </Button>
                  {readOnly ? null : (
                    <DropdownMenu onOpenChange={(open) => !open && setConfirmDelete(null)}>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-xs" aria-label={`图纸「${s.name}」的操作`}><ChevronDown /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onSelect={() => setRenaming({ id: s.id, name: s.name })}>重命名</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => { fitSheet(s.id); startCalibrate() }}>{obj?.mmPerUnit ? '重新标定比例' : '标定比例'}</DropdownMenuItem>
                        {obj?.mmPerUnit ? <DropdownMenuItem onSelect={() => commit((d) => updateSheet(d, s.id, { mmPerUnit: null }))}>清除标定</DropdownMenuItem> : null}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={(e) => { if (confirmDelete !== s.id) { e.preventDefault(); setConfirmDelete(s.id) } else deleteSheet(s.id) }}>
                          {confirmDelete === s.id ? <><Check />确认删除（含 {snap.points.filter((p) => p.sheetId === s.id).length} 个点位）</> : '删除图纸'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )
            })}
            {readOnly ? null : <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground" onClick={() => fileInput.current?.click()}><Plus className="size-4" />添加</Button>}
            <div className="ml-auto flex shrink-0 items-center gap-0.5 pl-2">
              <Button variant="ghost" size="icon-sm" aria-label="缩小" onClick={() => zoomBy(1 / 1.2)}><Minus className="size-4" /></Button>
              <Button variant="ghost" size="sm" className="min-w-14 tabular-nums" title="图纸铺满画布（100%，Ctrl/⌘ + 0）" onClick={() => fitSheet(activeSheetId)}>{zoomPct}%</Button>
              <Button variant="ghost" size="icon-sm" aria-label="放大" onClick={() => zoomBy(1.2)}><Plus className="size-4" /></Button>
              {snap.sheets.length > 1 ? <Button variant="ghost" size="sm" onClick={() => fitSheet(null)}><Maximize2 className="size-4" />全部</Button> : null}
            </div>
          </div>

          <div className="point-map-canvas relative min-h-0 flex-1">
            <BoardCanvas
              doc={doc}
              files={files}
              pack={pack}
              view={view}
              viewport={viewport}
              onViewport={setViewport}
              onSize={onSize}
              tool={tool}
              armed={armed}
              selection={selection}
              onSelection={(ids) => {
                setSelection(ids)
                setCtxMenu(null)
              }}
              hidden={hidden}
              readOnly={readOnly}
              dark={resolvedTheme === 'dark'}
              ready={ready}
              activeSheetId={activeSheetId}
              onCommit={commit}
              onPlace={(at) => armed && placePoint(armed, at)}
              onCreateArea={createAreaBox}
              onCalibrateLine={onCalibrateLine}
              onCalibrateRequest={readOnly ? undefined : startCalibrate}
              onContextMenu={onContextMenu}
              dropType={DRAG_TYPE}
              onDrop={onDrop}
            />
            <BoardToolbar
              tool={tool}
              onTool={(t) => {
                setArmed(null)
                if (t === 'calibrate') startCalibrate()
                else setTool(t)
              }}
              view={view}
              onView={setView}
              pack={pack}
              readOnly={readOnly}
              canUndo={board.canUndo}
              canRedo={board.canRedo}
              onUndo={board.undo}
              onRedo={board.redo}
              onExportPng={() => void exportPng()}
              onExportJson={exportJson}
              onImportJson={() => jsonInput.current?.click()}
              offset={view.rulers}
            />
            {armed || tool === 'area' || tool === 'calibrate' ? (
              <div className="absolute top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-primary/30 bg-background/95 px-3 py-1.5 text-xs shadow-sm">
                {armed
                  ? `点击图纸放置「${armedLabel}」，右键或 Esc 结束`
                  : tool === 'area'
                    ? '点击房间拐角描出轮廓，点回起点或双击完成；直接拖动画矩形'
                    : '沿已知长度拖一条线（按住 Shift 水平 / 垂直）'}
                <Button size="xs" variant="ghost" className="h-6 px-2" onClick={() => { setArmed(null); setTool('select') }}>结束</Button>
              </div>
            ) : null}
            {ctxMenu ? (
              <PointMapContextMenu
                target={ctxMenu}
                onClose={() => setCtxMenu(null)}
                onChangePointType={(pointId, dt) => updatePointType(pointId, dt)}
                onDuplicatePoint={(pointId) => duplicate([pointId])}
                onArmType={(dt) => setArmed(deviceTpl(dt))}
                onDeletePoint={(pointId) => removeIds([pointId])}
                onChangeAreaType={(areaId, areaType) => updateArea(areaId, { areaType, name: areaTypeLabel(areaType) })}
                onDeleteArea={(areaId) => removeIds([areaId])}
                onAddAreaAt={(sx, sy) => addAreaAt(sx, sy)}
                onFitSheet={() => fitSheet(activeSheetId)}
              />
            ) : null}
            {snap.points.length ? (
              <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-xl border bg-background/95 p-1 pl-2.5 shadow-sm">
                <Eye className="size-3.5 text-muted-foreground" />
                <div className="flex rounded-lg bg-muted p-0.5" role="radiogroup" aria-label="显示范围">
                  {POINT_SCOPES.map(({ value: v, label }) => (
                    <Button key={v} size="xs" variant="ghost" role="radio" aria-checked={scope === v} className={cn('h-6 rounded-md px-2', scope === v && 'bg-background shadow-sm')} onClick={() => { setScope(v); setSelection(new Set()) }}>{label}</Button>
                  ))}
                </div>
              </div>
            ) : null}
            {draft ? (
              <div className="absolute top-16 left-1/2 z-10 flex max-w-xl -translate-x-1/2 items-center gap-2 rounded-lg border border-primary/30 bg-background px-3 py-2 text-xs shadow-sm">
                <Info className="size-4 shrink-0 text-primary" />
                <span>发现 {new Date(draft.at).toLocaleString('zh-CN')} 未保存的本地草稿</span>
                <Button size="xs" onClick={() => { const r = decodeScene(draft.scene); setFiles((f) => ({ ...f, ...draft.scene.files })); commit(r); setDraft(null); toast.success('已恢复本地草稿，确认无误后保存') }}>恢复</Button>
                <Button size="xs" variant="ghost" onClick={() => { localStorage.removeItem(draftKey(projectId)); setDraft(null) }}>丢弃</Button>
              </div>
            ) : notices.length || missingSheets ? (
              <div className="absolute top-16 left-1/2 z-10 flex max-w-xl -translate-x-1/2 items-start gap-2 rounded-lg border border-warning/30 bg-background px-3 py-2 text-xs shadow-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                <div className="space-y-0.5">{(notices.length ? notices : [`有 ${missingSheets} 张图纸的图片丢失，请删除后重新添加`]).map((n) => <p key={n}>{n}</p>)}</div>
                <Button variant="ghost" size="icon-xs" aria-label="关闭提示" onClick={() => setNotices([])}><X /></Button>
              </div>
            ) : null}
            {ready && !snap.sheets.length && !readOnly ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
                <div className="pointer-events-auto flex max-w-sm flex-col items-center gap-3 rounded-xl border border-dashed bg-background/95 p-6 text-center shadow-sm">
                  <ImagePlus className="size-8 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">先添加户型图</p>
                    <p className="text-xs text-muted-foreground">支持 PNG / JPG 户型图，自动裁切适配标准图纸。</p>
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

        <aside className="point-map-aside flex max-h-[32svh] w-full shrink-0 flex-col border-t bg-background lg:max-h-none lg:w-84 lg:border-t-0 lg:border-l">
          {selectedPoint && selectedSymbol ? (
            <>
              <SelectedPoint
                code={selectedPoint.code}
                deviceType={selectedPoint.deviceType}
                areaName={snap.areas.find((a) => a.id === selectedPoint.areaId)?.name ?? null}
                readOnly={readOnly}
                onChangeType={(newType) => updatePointType(selectedPoint.id, newType)}
                onDuplicate={() => duplicate([selectedPoint.id])}
                onDelete={() => removeIds([selectedPoint.id])}
              />
              {readOnly ? null : (
                <div className="space-y-2.5 border-b bg-muted/40 px-4 pb-4">
                  {variant ? (
                    <div className="grid gap-1.5">
                      <div className="text-xs font-medium text-muted-foreground">{variant.family.name} · 尺寸</div>
                      <div className="flex gap-2">
                        <Select value={selectedSymbol.symbolId} onValueChange={(id) => { const v = variant.family.variants.find((x) => x.id === id); if (v) commit((d) => setPointVariant(d, selectedSymbol.id, v, selectedSymbol.real)) }}>
                          <SelectTrigger className="flex-1 bg-background"><SelectValue /></SelectTrigger>
                          <SelectContent>{variant.family.variants.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          按比例
                          <Switch checked={selectedSymbol.real} disabled={!selectedSymbol.sizeCm} onCheckedChange={(v) => commit((d) => setPointReal(d, [selectedSymbol.id], v))} aria-label="按真实尺寸落图" />
                        </label>
                      </div>
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">旋转</span>
                    <Button variant="outline" size="icon-sm" aria-label="逆时针旋转 90°" onClick={() => rotate([selectedSymbol.id], -90)}><RotateCcw className="size-3.5" /></Button>
                    <Button variant="outline" size="icon-sm" aria-label="顺时针旋转 90°（R）" title="顺时针 90°（R）" onClick={() => rotate([selectedSymbol.id], 90)}><RotateCw className="size-3.5" /></Button>
                    <Input
                      key={`${selectedSymbol.id}-${selectedSymbol.angle}`}
                      defaultValue={toDeg(selectedSymbol.angle)}
                      inputMode="numeric"
                      aria-label="旋转角度"
                      className="h-8 w-16 bg-background text-xs tabular-nums"
                      onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) commit((d) => rotateSymbols(d, [selectedSymbol.id], { absolute: fromDeg(v) })) }}
                      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
                    />
                    <span className="text-xs text-muted-foreground">°</span>
                  </div>
                </div>
              )}
            </>
          ) : selectedArea ? (
            <SelectedArea area={selectedArea} analysis={analysis.get(selectedArea.id)} readOnly={readOnly} onChange={(patch) => updateArea(selectedArea.id, patch)} onDelete={() => removeIds([selectedArea.id])} onClose={closeSelectedArea} />
          ) : selectedIds.length > 1 ? (
            <div className="flex items-center justify-between gap-2 border-b bg-muted/40 p-4 text-sm">
              <span>已选 {selectedIds.length} 个对象</span>
              {readOnly ? null : (
                <div className="flex gap-1">
                  <Button variant="ghost" size="xs" onClick={() => rotate(selectedIds, 90)}><RotateCw className="size-3.5" />旋转</Button>
                  <Button variant="ghost" size="xs" className="hover:text-destructive" onClick={() => removeIds(selectedIds)}><Trash2 className="size-3.5" />删除</Button>
                </div>
              )}
            </div>
          ) : null}

          <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1 gap-0">
            {/* 放置是主要工作，独占侧栏；区域和统计不常用，收在放置面板底部，打开后可一键返回 */}
            {readOnly ? (
              <TabsList className="mx-4 mt-3 grid w-auto grid-cols-2">
                <TabsTrigger value="areas" className="text-xs">区域</TabsTrigger>
                <TabsTrigger value="summary" className="text-xs">统计</TabsTrigger>
              </TabsList>
            ) : tab !== 'place' ? (
              <div className="mx-4 mt-3 flex items-center justify-between">
                <Button variant="ghost" size="xs" onClick={() => setTab('place')}><ChevronLeft className="size-3.5" />返回放置</Button>
                <span className="text-xs font-medium">{tab === 'areas' ? '区域' : '统计'}</span>
              </div>
            ) : null}

            {readOnly ? null : (
              <TabsContent value="place" className="flex min-h-0 flex-col">
                <div className="mx-4 mt-3 flex rounded-lg bg-muted p-0.5" role="radiogroup" aria-label="符号库">
                  {(['devices', 'lighting'] as const).map((t) => (
                    <Button key={t} size="xs" variant="ghost" role="radio" aria-checked={placeTab === t} className={cn('h-7 flex-1 rounded-md', placeTab === t && 'bg-background shadow-sm')} onClick={() => setPlaceTab(t)}>{t === 'devices' ? '智能设备' : '灯光设计'}</Button>
                  ))}
                </div>
                {placeTab === 'devices' ? (
                  <PlacePanel groups={filteredGroups} query={query} onQuery={setQuery} counts={summary.byType} armed={armedDevice} onArm={(t) => { setTool('select'); setArmed(t ? deviceTpl(t) : null) }} disabled={!snap.sheets.length} />
                ) : (
                  <LightingPanel armedId={armed && !armedDevice ? armed.symbolId : null} onArm={(tpl) => { setTool('select'); setArmed(tpl) }} disabled={!snap.sheets.length} calibrated={!!activeSheet?.mmPerUnit} />
                )}
                <div className="mt-auto flex gap-1 border-t px-3 py-2">
                  <Button variant="ghost" size="xs" className="flex-1 text-muted-foreground" onClick={() => setTab('areas')}>区域</Button>
                  <Button variant="ghost" size="xs" className="flex-1 text-muted-foreground" onClick={() => setTab('summary')}>
                    统计{issues.some((i) => i.level !== 'info') ? <span className="size-1.5 rounded-full bg-warning" /> : null}
                  </Button>
                </div>
              </TabsContent>
            )}

            <TabsContent value="areas" className="flex min-h-0 flex-col">
              <AreasPanel sheets={snap.sheets} areas={snap.areas} analysis={analysis} unassigned={unassigned} selectedAreaId={selectedArea?.id ?? null} onAdd={addArea} onFocus={focusArea} readOnly={readOnly} />
            </TabsContent>

            <TabsContent value="summary" className="flex min-h-0 flex-col">
              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-2 p-4">
                  {issues.length ? (
                    <section className="mb-3 space-y-1">
                      <h2 className="text-sm font-semibold">图纸检查</h2>
                      {issues.map((i) => (
                        <button key={i.id} type="button" onClick={() => focusTargets(i.targets)} className="flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors hover:bg-accent">
                          {i.level === 'info' ? <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /> : <CircleAlert className={cn('mt-0.5 size-3.5 shrink-0', i.level === 'error' ? 'text-destructive' : 'text-warning')} />}
                          <span className="min-w-0">
                            <span className="block font-medium">{i.title}</span>
                            {i.detail ? <span className="block text-muted-foreground">{i.detail}</span> : null}
                          </span>
                        </button>
                      ))}
                    </section>
                  ) : null}
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-sm font-semibold">设备统计{scope !== 'all' ? ` · ${pointScopeLabel(scope)}` : ''}</h2>
                    <span className="text-xs text-muted-foreground tabular-nums">共 {scopedPoints.length} 个点位</span>
                  </div>
                  {typesInUse.length === 0 ? <p className="text-xs text-muted-foreground">还没有放置设备</p> : null}
                  {typesInUse.map((t) => (
                    <TypeDefaultRow key={t} type={t} count={summary.byType.get(t) ?? 0} readOnly={readOnly} onArm={(dt) => { setArmed(deviceTpl(dt)); setPlaceTab('devices'); setTab('place') }} />
                  ))}
                </div>
              </ScrollArea>
              {readOnly ? null : (
                <div className="border-t p-4">
                  <Button className="w-full" size="sm" disabled={saving || syncingQuote || !scopedPoints.length} onClick={() => void switchToQuote()}>
                    {syncingQuote ? <Loader2 className="size-4 animate-spin" /> : activeQuote ? <ArrowLeftRight className="size-4" /> : <FilePlus2 className="size-4" />}
                    {activeQuote ? `同步并打开报价单${scope === 'all' ? '' : `（${pointScopeLabel(scope)}）`}` : scope === 'all' ? '生成报价' : `生成报价（${pointScopeLabel(scope)}）`}
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </aside>
      </div>

      <Dialog open={!!calib} onOpenChange={(o) => !o && setCalib(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>标定图纸比例</DialogTitle>
            <DialogDescription>刚才画的线在图纸上长 {calib ? Math.round(calib.units) : 0} 个单位，它实际有多长？标定后网格按 25cm 显示，灯具可按真实尺寸落图。</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); applyCalibration() }} className="flex items-center gap-2">
            <Input autoFocus inputMode="decimal" placeholder="例如 3.6" value={calib?.value ?? ''} onChange={(e) => setCalib((c) => (c ? { ...c, value: e.target.value } : c))} aria-label="实际长度（米）" />
            <span className="text-sm text-muted-foreground">米</span>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCalib(null)}>取消</Button>
            <Button onClick={applyCalibration}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
