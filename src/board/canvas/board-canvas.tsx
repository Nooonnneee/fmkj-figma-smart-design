'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Ruler } from 'lucide-react'

import { cn } from '@/lib/utils'

import { boxContains, boxInside, normBox, normAngle, snapAngle, toDeg } from '../core/geometry'
import { moveObjects, rawBox, resizeArea, rotateSymbols, sheetAt } from '../core/ops'
import type { SystemPack } from '../core/pack'
import { fittingScale, formatMm, gridSpec, niceStep, rulerStep } from '../core/paper'
import { symbolGeom, type SymbolGeom } from '../core/symbols'
import type { AreaObj, BoardDoc, BoardFile, BoardTool, Box, SheetObj, SymbolObj, SymbolTemplate, Vec, Viewport, ViewSettings } from '../core/types'
import { panBy, toScene, visibleBox, zoomAt, type Size } from '../core/viewport'
import { areaHandles, HANDLE_CURSOR, hitTest, resizeBox, rotateHandle, type Handle, type Hit } from './hit'
import { AreaView, RawView, SheetView, SymbolView } from './layers'

export type CanvasContext = { hit: Hit | null; scene: Vec; local: Vec; wrap: Size }

export type BoardCanvasProps = {
  doc: BoardDoc
  files: Record<string, BoardFile>
  pack: SystemPack
  view: ViewSettings
  viewport: Viewport
  onViewport: (v: Viewport) => void
  onSize: (size: Size) => void
  tool: BoardTool
  armed: SymbolTemplate | null
  selection: ReadonlySet<string>
  onSelection: (ids: Set<string>) => void
  hidden?: ReadonlySet<string>
  readOnly?: boolean
  dark?: boolean
  ready?: boolean
  activeSheetId?: string | null
  onCommit: (doc: BoardDoc) => void
  onPlace: (at: Vec) => void
  onCreateArea: (box: Box) => void
  onCalibrateLine: (sheet: SheetObj, a: Vec, b: Vec) => void
  onCalibrateRequest?: () => void
  onContextMenu: (ctx: CanvasContext) => void
  dropType?: string
  onDrop?: (data: string, at: Vec) => void
  className?: string
}

type Gesture =
  | { t: 'pan'; last: Vec; moved: boolean; clearOnTap: boolean }
  | { t: 'pinch'; startDist: number; startZoom: number; anchor: Vec }
  | { t: 'move'; start: Vec; startLocal: Vec; ids: string[]; moved: boolean }
  | { t: 'marquee'; start: Vec; startLocal: Vec; additive: boolean }
  | { t: 'resize'; id: string; handle: Handle; orig: Box; start: Vec }
  | { t: 'rotate'; id: string; center: Vec; origAngle: number; startAngle: number }
  | { t: 'area'; start: Vec }
  | { t: 'calibrate'; sheet: SheetObj; start: Vec }

type Preview = { doc?: BoardDoc; marquee?: Box; draft?: Box; calib?: [Vec, Vec] }

const EMPTY = new Set<string>()
/** 显示尺寸小于这个像素时用小图（线条预先加粗过） */
const SMALL_PX = 44

function isTyping() {
  const el = document.activeElement as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

export function BoardCanvas(props: BoardCanvasProps) {
  const { doc, files, pack, view, viewport, tool, armed, selection, hidden = EMPTY, readOnly = false, dark = false } = props
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<Size>({ w: 0, h: 0 })
  const [preview, setPreviewState] = useState<Preview | null>(null)
  const [hover, setHover] = useState<{ cursor: string; pos: Vec | null }>({ cursor: 'default', pos: null })
  const [space, setSpace] = useState(false)
  const gesture = useRef<Gesture | null>(null)
  const pointers = useRef(new Map<number, Vec>())
  const previewRef = useRef<Preview | null>(null)
  const setPreview = (p: Preview | null) => {
    previewRef.current = p
    setPreviewState(p)
  }
  const latest = useRef(props)
  latest.current = props
  const spaceRef = useRef(false)

  const shown = preview?.doc ?? doc

  // 符号几何（显示尺寸、外接框、代号位置）
  const geoms = useMemo(() => {
    const map = new Map<string, SymbolGeom>()
    for (const o of shown.objects) if (o.kind === 'symbol') map.set(o.id, symbolGeom(o, pack.look(o), view, sheetAt(shown, o.x, o.y)?.mmPerUnit ?? null))
    return map
  }, [shown, pack, view])
  const geomsRef = useRef(geoms)
  geomsRef.current = geoms

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const s = { w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }
      setSize(s)
      latest.current.onSize(s)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const local = (e: { clientX: number; clientY: number }): Vec => {
    const r = wrapRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const hitAt = useCallback((p: Vec) => {
    const c = latest.current
    return hitTest(p, { doc: c.doc, geoms: geomsRef.current, view: c.view, zoom: c.viewport.zoom, hidden: c.hidden ?? EMPTY, selection: c.selection, readOnly: !!c.readOnly })
  }, [])

  // 滚轮：平移；Ctrl / ⌘ + 滚轮（含触控板双指捏合）：缩放
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const c = latest.current
      const l = local(e)
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
      if (e.ctrlKey || e.metaKey) c.onViewport(zoomAt(c.viewport, l.x, l.y, c.viewport.zoom * Math.exp(-e.deltaY * unit * 0.0022)))
      else {
        let dx = e.deltaX * unit
        let dy = e.deltaY * unit
        if (e.shiftKey && !dx) [dx, dy] = [dy, 0]
        c.onViewport(panBy(c.viewport, -dx, -dy))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // 按住空格临时平移
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isTyping() || document.querySelector('[role=dialog]')) return
      if (!wrapRef.current?.matches(':hover')) return
      e.preventDefault()
      if (!spaceRef.current) {
        spaceRef.current = true
        setSpace(true)
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      spaceRef.current = false
      setSpace(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return
    const c = latest.current
    const l = local(e)
    const p = toScene(c.viewport, l.x, l.y)
    pointers.current.set(e.pointerId, l)
    wrapRef.current?.setPointerCapture(e.pointerId)
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      setPreview(null)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      gesture.current = { t: 'pinch', startDist: Math.hypot(a.x - b.x, a.y - b.y) || 1, startZoom: c.viewport.zoom, anchor: toScene(c.viewport, mid.x, mid.y) }
      return
    }
    if (pointers.current.size > 2) return
    const touch = e.pointerType === 'touch'
    if (e.button === 1 || spaceRef.current || c.tool === 'pan') {
      gesture.current = { t: 'pan', last: l, moved: false, clearOnTap: false }
      return
    }
    if (c.armed && !c.readOnly) {
      c.onPlace(p)
      return
    }
    if (c.tool === 'area' && !c.readOnly) {
      gesture.current = { t: 'area', start: p }
      return
    }
    if (c.tool === 'calibrate' && !c.readOnly) {
      const sheet = sheetAt(c.doc, p.x, p.y)
      if (sheet) gesture.current = { t: 'calibrate', sheet, start: p }
      return
    }
    const hit = hitAt(p)
    if (hit?.kind === 'handle') {
      const o = c.doc.objects.find((x) => x.id === hit.id)
      if (o?.kind === 'area') gesture.current = { t: 'resize', id: o.id, handle: hit.handle, orig: { x: o.x, y: o.y, w: o.w, h: o.h }, start: p }
      else if (o?.kind === 'symbol') gesture.current = { t: 'rotate', id: o.id, center: { x: o.x, y: o.y }, origAngle: o.angle, startAngle: Math.atan2(p.y - o.y, p.x - o.x) }
      return
    }
    if (hit && hit.kind !== 'sheet') {
      let sel = new Set(c.selection)
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        if (sel.has(hit.id)) sel.delete(hit.id)
        else sel.add(hit.id)
        c.onSelection(sel)
        if (!sel.has(hit.id)) return
      } else if (!sel.has(hit.id)) {
        sel = new Set([hit.id])
        c.onSelection(sel)
      }
      if (!c.readOnly) gesture.current = { t: 'move', start: p, startLocal: l, ids: [...sel], moved: false }
      return
    }
    if (touch || c.readOnly) gesture.current = { t: 'pan', last: l, moved: false, clearOnTap: true }
    else gesture.current = { t: 'marquee', start: p, startLocal: l, additive: e.shiftKey }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const c = latest.current
    const l = local(e)
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, l)
    const g = gesture.current
    const p = toScene(c.viewport, l.x, l.y)
    if (!g) {
      let cursor = 'default'
      if (spaceRef.current || c.tool === 'pan') cursor = 'grab'
      else if (c.armed || c.tool === 'area' || c.tool === 'calibrate') cursor = 'crosshair'
      else {
        const hit = hitAt(p)
        if (hit?.kind === 'handle') cursor = HANDLE_CURSOR[hit.handle]
        else if (hit && hit.kind !== 'sheet') cursor = c.readOnly ? 'pointer' : 'move'
      }
      const pos = c.armed ? p : null
      if (cursor !== hover.cursor || pos || hover.pos) setHover({ cursor, pos })
      return
    }
    switch (g.t) {
      case 'pan': {
        const dx = l.x - g.last.x
        const dy = l.y - g.last.y
        if (Math.abs(dx) + Math.abs(dy) > 0) {
          c.onViewport(panBy(c.viewport, dx, dy))
          g.last = l
          g.moved = true
        }
        break
      }
      case 'pinch': {
        const pts = [...pointers.current.values()]
        if (pts.length < 2) break
        const [a, b] = pts
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        const z = Math.min(16, Math.max(0.05, (g.startZoom * Math.hypot(a.x - b.x, a.y - b.y)) / g.startDist))
        c.onViewport({ zoom: z, scrollX: mid.x / z - g.anchor.x, scrollY: mid.y / z - g.anchor.y })
        break
      }
      case 'move': {
        if (!g.moved && Math.hypot(l.x - g.startLocal.x, l.y - g.startLocal.y) < 3) break
        g.moved = true
        let dx = p.x - g.start.x
        let dy = p.y - g.start.y
        if (e.shiftKey) {
          if (Math.abs(dx) > Math.abs(dy)) dy = 0
          else dx = 0
        }
        setPreview({ doc: moveObjects(c.doc, g.ids, dx, dy) })
        break
      }
      case 'marquee':
        setPreview({ marquee: normBox(g.start, p) })
        break
      case 'resize':
        setPreview({ doc: resizeArea(c.doc, g.id, resizeBox(g.orig, g.handle, p.x - g.start.x, p.y - g.start.y)) })
        break
      case 'rotate': {
        let a = g.origAngle + Math.atan2(p.y - g.center.y, p.x - g.center.x) - g.startAngle
        a = e.altKey ? normAngle(a) : snapAngle(a)
        setPreview({ doc: rotateSymbols(c.doc, [g.id], { absolute: a }) })
        break
      }
      case 'area':
        setPreview({ draft: normBox(g.start, p) })
        break
      case 'calibrate': {
        let q = p
        if (e.shiftKey) q = Math.abs(p.x - g.start.x) > Math.abs(p.y - g.start.y) ? { x: p.x, y: g.start.y } : { x: g.start.x, y: p.y }
        setPreview({ calib: [g.start, q] })
        break
      }
    }
  }

  const finish = (e: React.PointerEvent, cancel = false) => {
    pointers.current.delete(e.pointerId)
    const c = latest.current
    const g = gesture.current
    const pv = previewRef.current
    if (g?.t === 'pinch') {
      if (pointers.current.size === 0) gesture.current = null
      return
    }
    gesture.current = null
    setPreview(null)
    if (!g || cancel) return
    switch (g.t) {
      case 'move':
      case 'resize':
      case 'rotate':
        if (pv?.doc && pv.doc !== c.doc) c.onCommit(pv.doc)
        break
      case 'pan':
        if (!g.moved && g.clearOnTap) {
          const hit = hitAt(toScene(c.viewport, local(e).x, local(e).y))
          c.onSelection(hit && hit.kind !== 'sheet' && hit.kind !== 'handle' ? new Set([hit.id]) : new Set())
        }
        break
      case 'marquee': {
        const box = pv?.marquee
        if (!box || box.w * c.viewport.zoom < 3) {
          if (!g.additive) c.onSelection(new Set())
          break
        }
        const sel = new Set(g.additive ? c.selection : [])
        const hid = c.hidden ?? EMPTY
        for (const o of c.doc.objects) {
          if (o.kind === 'symbol' && c.view.layers.symbol && !hid.has(o.id) && boxContains(box, o)) sel.add(o.id)
          else if (o.kind === 'area' && c.view.layers.area && boxInside(o, box)) sel.add(o.id)
          else if (o.kind === 'raw' && c.view.layers.shape && !o.el.locked && boxInside(rawBox(o.el), box)) sel.add(o.id)
        }
        c.onSelection(sel)
        break
      }
      case 'area':
        if (pv?.draft && pv.draft.w >= 16 && pv.draft.h >= 16) c.onCreateArea(pv.draft)
        break
      case 'calibrate':
        if (pv?.calib) {
          const [a, b] = pv.calib
          if (Math.hypot(a.x - b.x, a.y - b.y) >= 10) c.onCalibrateLine(g.sheet, a, b)
        }
        break
    }
  }

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const c = latest.current
    const l = local(e)
    const p = toScene(c.viewport, l.x, l.y)
    let hit = hitAt(p)
    if (hit?.kind === 'handle') hit = { kind: c.doc.objects.find((o) => o.id === hit!.id)?.kind === 'area' ? 'area' : 'symbol', id: hit.id }
    if (hit && hit.kind !== 'sheet' && !c.selection.has(hit.id)) c.onSelection(new Set([hit.id]))
    c.onContextMenu({ hit, scene: p, local: l, wrap: size })
  }

  const z = viewport.zoom
  const vis = visibleBox(viewport, size)
  const objs = shown.objects
  const sheets = objs.filter((o): o is SheetObj => o.kind === 'sheet')
  const activeSheet = sheets.find((s) => s.sheetId === props.activeSheetId) ?? sheets[0] ?? null
  const cursor = gesture.current?.t === 'pan' ? 'grabbing' : space ? 'grab' : hover.cursor
  const accent = dark ? '#60a5fa' : '#2563eb'
  const ghost = props.armed && hover.pos ? (() => {
    const o: SymbolObj = { kind: 'symbol', id: '__ghost', x: hover.pos!.x, y: hover.pos!.y, code: '', angle: props.armed!.angle ?? 0, ...props.armed! }
    const look = pack.look(o)
    const g = symbolGeom(o, look, view, sheetAt(doc, o.x, o.y)?.mmPerUnit ?? null)
    return <SymbolView o={o} g={g} look={look} small={Math.max(g.imgW, g.imgH) * z < SMALL_PX} showLabel={false} ghost />
  })() : null

  return (
    <div
      ref={wrapRef}
      role="application"
      aria-label="画板"
      tabIndex={0}
      className={cn('relative size-full touch-none overflow-hidden outline-none select-none', dark ? 'bg-neutral-900' : 'bg-neutral-100', props.className)}
      style={{ cursor, ['--board-accent' as string]: accent, ['--board-accent-soft' as string]: dark ? 'rgba(96,165,250,0.08)' : 'rgba(37,99,235,0.05)' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => finish(e)}
      onPointerCancel={(e) => finish(e, true)}
      onPointerLeave={() => hover.pos && setHover((h) => ({ ...h, pos: null }))}
      onContextMenu={onContextMenu}
      onDragOver={(e) => {
        if (props.dropType && e.dataTransfer.types.includes(props.dropType)) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }
      }}
      onDrop={(e) => {
        const data = props.dropType ? e.dataTransfer.getData(props.dropType) : ''
        if (!data) return
        e.preventDefault()
        const l = local(e)
        props.onDrop?.(data, toScene(viewport, l.x, l.y))
      }}
    >
      <svg className={cn('absolute inset-0 size-full transition-opacity', props.ready === false && 'opacity-0')} aria-hidden>
        <defs>
          <filter id="board-paper-shadow" x="-5%" y="-5%" width="110%" height="110%">
            <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor="#000" floodOpacity={dark ? 0.5 : 0.12} />
          </filter>
        </defs>
        <g transform={`scale(${z}) translate(${viewport.scrollX} ${viewport.scrollY})`}>
          {view.layers.sheet
            ? sheets.map((s) => <SheetView key={s.id} s={s} href={s.fileId ? (files[s.fileId]?.dataURL ?? null) : null} opacity={view.sheetOpacity} titleColor={dark ? '#d4d4d8' : '#404040'} />)
            : null}
          {view.grid ? sheets.map((s) => <Grid key={s.id} sheet={s} vis={vis} zoom={z} />) : null}
          {view.layers.area ? objs.map((o) => (o.kind === 'area' ? <AreaView key={o.id} a={o} selected={selection.has(o.id)} /> : null)) : null}
          {view.layers.shape
            ? objs.map((o) => (o.kind === 'raw' ? <RawView key={o.id} el={o.el} href={typeof o.el.fileId === 'string' ? (files[o.el.fileId]?.dataURL ?? null) : null} /> : null))
            : null}
          {view.layers.symbol
            ? objs.map((o) => {
                if (o.kind !== 'symbol' || hidden.has(o.id)) return null
                const g = geoms.get(o.id)!
                return <SymbolView key={o.id} o={o} g={g} look={pack.look(o)} small={Math.max(g.imgW, g.imgH) * z < SMALL_PX} showLabel={view.labels} />
              })
            : null}
          <SelectionOverlay doc={shown} geoms={geoms} selection={selection} zoom={z} readOnly={readOnly} />
          {preview?.marquee ? <rect {...rectOf(preview.marquee)} fill="var(--board-accent-soft)" stroke="var(--board-accent)" strokeWidth={1} vectorEffect="non-scaling-stroke" /> : null}
          {preview?.draft ? <AreaDraft box={preview.draft} /> : null}
          {preview?.calib ? <CalibLine a={preview.calib[0]} b={preview.calib[1]} zoom={z} /> : null}
          {ghost}
        </g>
      </svg>
      {view.rulers && size.w ? <Rulers viewport={viewport} size={size} sheet={activeSheet} dark={dark} onCalibrate={props.onCalibrateRequest} /> : null}
      {activeSheet?.mmPerUnit && size.w ? <ScaleBar mmPerUnit={activeSheet.mmPerUnit} zoom={z} sheet={activeSheet} pack={pack} left={view.rulers ? 32 : 12} /> : null}
    </div>
  )
}

const rectOf = (b: Box) => ({ x: b.x, y: b.y, width: b.w, height: b.h })

function Grid({ sheet, vis, zoom }: { sheet: SheetObj; vis: Box; zoom: number }) {
  const spec = gridSpec(sheet.mmPerUnit, zoom)
  const x0 = Math.max(sheet.x, vis.x)
  const y0 = Math.max(sheet.y, vis.y)
  const x1 = Math.min(sheet.x + sheet.w, vis.x + vis.w)
  const y1 = Math.min(sheet.y + sheet.h, vis.y + vis.h)
  if (x1 <= x0 || y1 <= y0) return null
  const path = (step: number | null) => {
    if (!step) return ''
    let d = ''
    for (let x = sheet.x + Math.ceil((x0 - sheet.x) / step) * step; x <= x1; x += step) d += `M${x} ${y0}V${y1}`
    for (let y = sheet.y + Math.ceil((y0 - sheet.y) / step) * step; y <= y1; y += step) d += `M${x0} ${y}H${x1}`
    return d
  }
  const color = spec.calibrated ? '#0ea5e9' : '#64748b'
  return (
    <g pointerEvents="none">
      <path d={path(spec.minor)} stroke={color} strokeOpacity={0.14} strokeWidth={0.6} vectorEffect="non-scaling-stroke" fill="none" />
      <path d={path(spec.major)} stroke={color} strokeOpacity={0.28} strokeWidth={0.8} vectorEffect="non-scaling-stroke" fill="none" />
    </g>
  )
}

function SelectionOverlay({ doc, geoms, selection, zoom, readOnly }: { doc: BoardDoc; geoms: Map<string, SymbolGeom>; selection: ReadonlySet<string>; zoom: number; readOnly: boolean }) {
  if (!selection.size) return null
  const single = selection.size === 1
  const hs = 7 / zoom
  return (
    <g pointerEvents="none">
      {doc.objects.map((o) => {
        if (!selection.has(o.id)) return null
        if (o.kind === 'symbol') {
          const g = geoms.get(o.id)
          if (!g) return null
          const pad = 3 / zoom + 1
          const a = g.marker ? 0 : o.angle
          const rh = single && !readOnly && !g.marker ? rotateHandle(o, g, zoom) : null
          return (
            <g key={o.id}>
              <rect x={o.x - g.w / 2 - pad} y={o.y - g.h / 2 - pad} width={g.w + 2 * pad} height={g.h + 2 * pad} transform={a ? `rotate(${toDeg(a)} ${o.x} ${o.y})` : undefined} fill="none" stroke="var(--board-accent)" strokeWidth={1.5} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
              {rh ? (
                <>
                  <line x1={o.x} y1={o.y} x2={rh.x} y2={rh.y} stroke="var(--board-accent)" strokeWidth={1} vectorEffect="non-scaling-stroke" strokeOpacity={0.6} />
                  <circle cx={rh.x} cy={rh.y} r={4.5 / zoom} fill="#fff" stroke="var(--board-accent)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                </>
              ) : null}
            </g>
          )
        }
        if (o.kind === 'area') {
          return single && !readOnly ? (
            <g key={o.id}>
              {areaHandles(o as AreaObj).map(([h, q]) => (
                <rect key={h} x={q.x - hs / 2} y={q.y - hs / 2} width={hs} height={hs} fill="#fff" stroke="var(--board-accent)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
              ))}
            </g>
          ) : null
        }
        if (o.kind === 'raw') return <rect key={o.id} {...rectOf(rawBox(o.el))} fill="none" stroke="var(--board-accent)" strokeWidth={1.5} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
        return null
      })}
    </g>
  )
}

function AreaDraft({ box }: { box: Box }) {
  return (
    <g pointerEvents="none">
      <rect {...rectOf(box)} fill="var(--board-accent-soft)" stroke="var(--board-accent)" strokeWidth={1.5} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
    </g>
  )
}

function CalibLine({ a, b, zoom }: { a: Vec; b: Vec; zoom: number }) {
  const len = Math.hypot(a.x - b.x, a.y - b.y)
  const fs = 12 / zoom
  return (
    <g pointerEvents="none">
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#f97316" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {[a, b].map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4 / zoom} fill="#fff" stroke="#f97316" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      ))}
      <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - fs * 0.6} fontSize={fs} textAnchor="middle" fill="#c2410c" stroke="#fff" strokeWidth={fs * 0.3} paintOrder="stroke" fontWeight={700}>
        拖到已知长度的两端后松开（{Math.round(len)}）
      </text>
    </g>
  )
}

function Rulers({ viewport, size, sheet, dark, onCalibrate }: { viewport: Viewport; size: Size; sheet: SheetObj | null; dark: boolean; onCalibrate?: () => void }) {
  const R = 20
  const mm = sheet?.mmPerUnit ?? null
  const ox = sheet?.x ?? 0
  const oy = sheet?.y ?? 0
  const step = rulerStep(mm, viewport.zoom)
  const label = (u: number) => (mm ? formatMm(Math.round(u * mm)) : String(Math.round(u)))
  const ticks = (from: number, to: number, origin: number) => {
    const out: { v: number; major: boolean }[] = []
    const minor = step.units / 5
    for (let u = Math.floor((from - origin) / minor) * minor; u <= to - origin; u += minor) out.push({ v: u, major: Math.abs(u / step.units - Math.round(u / step.units)) < 1e-6 })
    return out
  }
  const vx0 = -viewport.scrollX
  const vy0 = -viewport.scrollY
  const tx = ticks(vx0, vx0 + size.w / viewport.zoom, ox)
  const ty = ticks(vy0, vy0 + size.h / viewport.zoom, oy)
  const sx = (u: number) => (ox + u + viewport.scrollX) * viewport.zoom
  const sy = (u: number) => (oy + u + viewport.scrollY) * viewport.zoom
  const fg = dark ? '#a1a1aa' : '#71717a'
  const bg = dark ? 'rgba(24,24,27,0.92)' : 'rgba(255,255,255,0.92)'
  return (
    <>
      <svg className="pointer-events-none absolute top-0 left-0" width={size.w} height={R} style={{ background: bg }} aria-hidden>
        <line x1={0} y1={R - 0.5} x2={size.w} y2={R - 0.5} stroke={fg} strokeOpacity={0.4} />
        {tx.map((t) => {
          const x = sx(t.v)
          return x < R ? null : (
            <g key={t.v}>
              <line x1={x} y1={t.major ? 6 : 14} x2={x} y2={R} stroke={fg} strokeOpacity={t.major ? 0.8 : 0.4} />
              {t.major ? <text x={x + 3} y={11} fontSize={9.5} fill={fg}>{label(t.v)}</text> : null}
            </g>
          )
        })}
      </svg>
      <svg className="pointer-events-none absolute top-0 left-0" width={R} height={size.h} style={{ background: bg }} aria-hidden>
        <line x1={R - 0.5} y1={0} x2={R - 0.5} y2={size.h} stroke={fg} strokeOpacity={0.4} />
        {ty.map((t) => {
          const y = sy(t.v)
          return y < R ? null : (
            <g key={t.v}>
              <line x1={t.major ? 6 : 14} y1={y} x2={R} y2={y} stroke={fg} strokeOpacity={t.major ? 0.8 : 0.4} />
              {t.major ? <text transform={`translate(11 ${y + 3}) rotate(-90)`} fontSize={9.5} fill={fg} textAnchor="end">{label(t.v)}</text> : null}
            </g>
          )
        })}
      </svg>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onCalibrate}
        title={mm ? `已标定：1 单位 = ${mm.toFixed(2)}mm，点击重新标定` : '未标定比例：点击后在图纸上拖一条已知长度的线'}
        aria-label="标定比例"
        className={cn('absolute top-0 left-0 flex size-5 items-center justify-center border-r border-b', mm ? 'text-muted-foreground' : 'text-warning')}
        style={{ background: bg }}
      >
        <Ruler className="size-3" />
      </button>
    </>
  )
}

function ScaleBar({ mmPerUnit, zoom, sheet, pack, left }: { mmPerUnit: number; zoom: number; sheet: SheetObj; pack: SystemPack; left: number }) {
  const mm = niceStep((90 / zoom) * mmPerUnit)
  const px = (mm / mmPerUnit) * zoom
  const fit = fittingScale(sheet.w, sheet.h, mmPerUnit, pack.paper)
  return (
    <div className="pointer-events-none absolute bottom-4 flex flex-col gap-0.5 rounded-md bg-background/85 px-2 py-1 text-[10px] text-muted-foreground shadow-sm" style={{ left }}>
      <div className="flex items-end gap-1.5">
        <div className="flex h-2 border-x border-b border-foreground/70" style={{ width: px }}>
          <div className="w-1/2 border-r border-foreground/40" />
        </div>
        <span className="tabular-nums text-foreground">{formatMm(mm)}</span>
      </div>
      {fit ? <span className="tabular-nums">{pack.paper} 横版可按 1:{fit} 打印</span> : null}
    </div>
  )
}
