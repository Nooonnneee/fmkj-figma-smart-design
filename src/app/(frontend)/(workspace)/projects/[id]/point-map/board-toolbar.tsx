'use client'

import { Download, Eye, FileJson, FileUp, Grid3x3, Hand, ImageDown, MousePointer2, Redo2, Ruler, SquareDashed, Undo2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { SystemPack } from '@/board/core/pack'
import { SYMBOL_SIZES } from '@/board/core/symbols'
import type { BoardTool, ViewSettings } from '@/board/core/types'
import { cn } from '@/lib/utils'

const TOOLS: { id: BoardTool; label: string; key: string; icon: typeof Hand; edit?: boolean }[] = [
  { id: 'select', label: '选择', key: 'V', icon: MousePointer2 },
  { id: 'pan', label: '平移', key: 'H / 空格', icon: Hand },
  { id: 'area', label: '画区域', key: 'A', icon: SquareDashed, edit: true },
  { id: 'calibrate', label: '标定比例', key: 'C', icon: Ruler, edit: true },
]

/** 画布左上角的工具条：工具、撤销重做、网格 / 标尺、视图、导入导出 */
export function BoardToolbar(props: {
  tool: BoardTool
  onTool: (t: BoardTool) => void
  view: ViewSettings
  onView: (patch: Partial<ViewSettings>) => void
  pack: SystemPack
  readOnly: boolean
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onExportPng: () => void
  onExportJson: () => void
  onImportJson: () => void
  offset: boolean
}) {
  const { tool, view, onView, readOnly } = props
  const btn = 'size-8 rounded-md'
  return (
    <div className={cn('absolute z-10 flex items-center gap-0.5 rounded-xl border bg-background/95 p-1 shadow-sm', props.offset ? 'top-7 left-7' : 'top-3 left-3')} onPointerDown={(e) => e.stopPropagation()}>
      {TOOLS.filter((t) => !t.edit || !readOnly).map((t) => (
        <Button key={t.id} variant={tool === t.id ? 'secondary' : 'ghost'} size="icon" className={btn} aria-pressed={tool === t.id} aria-label={t.label} title={`${t.label}（${t.key}）`} onClick={() => props.onTool(t.id)}>
          <t.icon className="size-4" />
        </Button>
      ))}
      {readOnly ? null : (
        <>
          <span className="mx-0.5 h-5 w-px bg-border" />
          <Button variant="ghost" size="icon" className={btn} disabled={!props.canUndo} aria-label="撤销" title="撤销（Ctrl/⌘ + Z）" onClick={props.onUndo}>
            <Undo2 className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className={btn} disabled={!props.canRedo} aria-label="重做" title="重做（Ctrl/⌘ + Shift + Z）" onClick={props.onRedo}>
            <Redo2 className="size-4" />
          </Button>
        </>
      )}
      <span className="mx-0.5 h-5 w-px bg-border" />
      <Button variant={view.grid ? 'secondary' : 'ghost'} size="icon" className={btn} aria-pressed={view.grid} aria-label="网格" title="网格 25cm（G）" onClick={() => onView({ grid: !view.grid })}>
        <Grid3x3 className="size-4" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className={btn} aria-label="视图设置" title="视图：符号样式、大小、图层">
            <Eye className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs">符号样式</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={view.symbolStyle} onValueChange={(v) => onView({ symbolStyle: v as ViewSettings['symbolStyle'] })}>
            <DropdownMenuRadioItem value="plan">平面符号</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="marker">实心标记</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuLabel className="text-xs">符号大小（固定大小的点位）</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={String(view.symbolSize)} onValueChange={(v) => onView({ symbolSize: Number(v) })}>
            {SYMBOL_SIZES.map((s) => (
              <DropdownMenuRadioItem key={s.value} value={String(s.value)}>
                {s.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5 text-xs">
            <div className="mb-1 flex justify-between text-muted-foreground">
              <span>底图浓度</span>
              <span className="tabular-nums">{Math.round(view.sheetOpacity * 100)}%</span>
            </div>
            <input type="range" min={15} max={100} step={5} value={Math.round(view.sheetOpacity * 100)} onChange={(e) => onView({ sheetOpacity: Number(e.target.value) / 100 })} className="w-full accent-primary" aria-label="底图浓度" />
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={view.rulers} onCheckedChange={(v) => onView({ rulers: !!v })} onSelect={(e) => e.preventDefault()}>
            标尺（Shift + R）
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={view.labels} onCheckedChange={(v) => onView({ labels: !!v })} onSelect={(e) => e.preventDefault()}>
            点位代号
          </DropdownMenuCheckboxItem>
          <DropdownMenuLabel className="text-xs">图层</DropdownMenuLabel>
          {props.pack.layers.map((l) => (
            <DropdownMenuCheckboxItem key={l.id} checked={view.layers[l.id]} onCheckedChange={(v) => onView({ layers: { ...view.layers, [l.id]: !!v } })} onSelect={(e) => e.preventDefault()}>
              {l.name}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className={btn} aria-label="导入导出" title="导出图片 / 画板 JSON">
            <Download className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onSelect={props.onExportPng}>
            <ImageDown className="size-4" />
            导出当前图纸 PNG（{props.pack.paper}，含图例）
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={props.onExportJson}>
            <FileJson className="size-4" />
            导出画板 JSON
          </DropdownMenuItem>
          {readOnly ? null : (
            <DropdownMenuItem onSelect={props.onImportJson}>
              <FileUp className="size-4" />
              导入画板 JSON（替换当前内容）
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <p className="px-2 py-1 text-xs text-muted-foreground">{props.pack.export.note}</p>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
