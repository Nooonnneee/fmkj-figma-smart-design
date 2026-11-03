'use client'

import { Download, Eye, EyeOff, FileJson, FileUp, Grid3x3, Hand, ImageDown, MousePointer2, Pentagon, Redo2, Ruler, Sparkles, Undo2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { SystemPack } from '@/board/core/pack'
import { SYMBOL_SIZES } from '@/board/core/symbols'
import type { BoardTool, LayerId, ViewSettings } from '@/board/core/types'
import { cn } from '@/lib/utils'

const TOOLS: { id: BoardTool; label: string; key: string; icon: typeof Hand; edit?: boolean }[] = [
  { id: 'select', label: '选择', key: 'V', icon: MousePointer2 },
  { id: 'pan', label: '平移', key: 'H / 空格', icon: Hand },
  { id: 'area', label: '画区域：点出房间轮廓', key: 'A', icon: Pentagon, edit: true },
  { id: 'calibrate', label: '标定比例', key: 'C', icon: Ruler, edit: true },
]

/** 显示面板里的图层顺序（自上而下，和画面里的前后一致）；「点位代号」挂在点位下面 */
const LAYER_ROWS: { id: LayerId; hint: string }[] = [
  { id: 'symbol', hint: '设备图标' },
  { id: 'area', hint: '房间轮廓与名称' },
  { id: 'shape', hint: '线、文字等标注' },
  { id: 'sheet', hint: '户型底图' },
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
  onAutoGenerate?: () => void
  onExportPng: () => void
  onExportJson: () => void
  onImportJson: () => void
  offset: boolean
}) {
  const { tool, view, onView, readOnly } = props
  const btn = 'size-8 rounded-md'
  const layerName = (id: LayerId) => props.pack.layers.find((l) => l.id === id)?.name ?? id
  const hiddenCount = LAYER_ROWS.filter((l) => !view.layers[l.id]).length + (view.labels ? 0 : 1)
  const showAll = () => onView({ labels: true, layers: { sheet: true, area: true, shape: true, symbol: true } })
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
          {props.onAutoGenerate ? (
            <Button
              variant="ghost"
              size="icon"
              className={cn(btn, 'text-primary hover:text-primary')}
              aria-label="智能生成点位"
              title="智能生成点位（覆盖当前点位，可随时撤销）"
              onClick={props.onAutoGenerate}
            >
              <Sparkles className="size-4" />
            </Button>
          ) : null}
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
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={hiddenCount ? 'secondary' : 'ghost'}
            size="icon"
            className={cn(btn, 'relative')}
            aria-label={hiddenCount ? `显示与隐藏（${hiddenCount} 项已隐藏）` : '显示与隐藏'}
            title={hiddenCount ? `有 ${hiddenCount} 项已隐藏` : '显示与隐藏：图层、代号、底图浓度、符号样式'}
          >
            {hiddenCount ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {hiddenCount ? <span aria-hidden className="absolute top-1 right-1 size-1.5 rounded-full bg-warning" /> : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 gap-0 p-0" onPointerDown={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
            <p className="text-sm font-medium">显示与隐藏</p>
            {hiddenCount ? (
              <Button variant="ghost" size="xs" onClick={showAll}>
                全部显示
              </Button>
            ) : null}
          </div>
          {/* 每个图层一行：眼睛图标就是开关，隐藏的行变灰 */}
          <ul className="px-1.5 pb-1.5">
            {LAYER_ROWS.map((row) => {
              const on = view.layers[row.id]
              return (
                <li key={row.id}>
                  <LayerRow on={on} name={layerName(row.id)} hint={row.hint} onToggle={() => onView({ layers: { ...view.layers, [row.id]: !on } })} />
                  {row.id === 'symbol' ? (
                    <LayerRow on={view.labels} name="点位代号" hint="图标下方的编号" indent disabled={!on} onToggle={() => onView({ labels: !view.labels })} />
                  ) : null}
                </li>
              )
            })}
          </ul>
          <div className="space-y-3 border-t px-3 py-3 text-xs">
            <label className="block">
              <span className="mb-1.5 flex justify-between text-muted-foreground">
                <span>底图浓度</span>
                <span className="tabular-nums">{Math.round(view.sheetOpacity * 100)}%</span>
              </span>
              <input type="range" min={15} max={100} step={5} value={Math.round(view.sheetOpacity * 100)} onChange={(e) => onView({ sheetOpacity: Number(e.target.value) / 100 })} className="w-full accent-primary" aria-label="底图浓度" />
            </label>
            <Segmented
              label="符号样式"
              value={view.symbolStyle}
              options={[
                { value: 'plan', label: '平面符号' },
                { value: 'marker', label: '实心标记' },
              ]}
              onChange={(v) => onView({ symbolStyle: v as ViewSettings['symbolStyle'] })}
            />
            <Segmented label="符号大小" value={String(view.symbolSize)} options={SYMBOL_SIZES.map((s) => ({ value: String(s.value), label: s.label }))} onChange={(v) => onView({ symbolSize: Number(v) })} />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">标尺（Shift + R）</span>
              <Button variant={view.rulers ? 'secondary' : 'outline'} size="xs" aria-pressed={view.rulers} onClick={() => onView({ rulers: !view.rulers })}>
                {view.rulers ? '已显示' : '已隐藏'}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
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

function LayerRow({ on, name, hint, onToggle, indent, disabled }: { on: boolean; name: string; hint: string; onToggle: () => void; indent?: boolean; disabled?: boolean }) {
  return (
    <Button
      variant="ghost"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onToggle}
      className={cn('h-auto w-full justify-start gap-2.5 px-1.5 py-1.5 text-left font-normal disabled:opacity-40', indent && 'pl-7', !on && 'text-muted-foreground')}
    >
      {on ? <Eye className="size-4 shrink-0" /> : <EyeOff className="size-4 shrink-0" />}
      <span className={cn('flex-1', !on && 'line-through decoration-muted-foreground/50')}>{name}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </Button>
  )
}

function Segmented({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex rounded-md bg-muted p-0.5" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <Button
            key={o.value}
            variant="ghost"
            size="xs"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn('h-6 rounded px-2', value === o.value ? 'bg-background font-medium shadow-sm hover:bg-background' : 'font-normal text-muted-foreground')}
          >
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
