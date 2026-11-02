'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import type { SymbolTemplate } from '@/board/core/types'
import { artOf, defaultVariant, LIGHTING_GROUPS, type LightingFamily } from '@/board/packs/smart-home/look'
import { cn } from '@/lib/utils'

import { DRAG_TYPE } from './editor-panels'

export const variantTemplate = (fam: LightingFamily, variantId: string, real: boolean): SymbolTemplate => {
  const v = fam.variants.find((x) => x.id === variantId) ?? defaultVariant(fam)
  return { symbolId: v.id, sizeCm: v.sizeCm, real: real && !!v.sizeCm, data: { deviceType: fam.deviceType } }
}

function Art({ id, className }: { id: string; className?: string }) {
  const art = artOf(id)
  if (!art) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={art.srcSm} alt="" draggable={false} className={cn('object-contain', className)} />
}

/** 灯光设计：按款式分组，每款几个尺寸档；可按真实尺寸落图（图纸需先标定） */
export function LightingPanel({ armedId, onArm, disabled, calibrated }: { armedId: string | null; onArm: (tpl: SymbolTemplate | null) => void; disabled: boolean; calibrated: boolean }) {
  const [famId, setFamId] = useState<string>(LIGHTING_GROUPS[0].families[0].id)
  const [real, setReal] = useState(true)
  const fam = LIGHTING_GROUPS.flatMap((g) => g.families).find((f) => f.id === famId)!
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4 pt-2">
          {LIGHTING_GROUPS.map((g) => (
            <section key={g.name}>
              <div className="mb-1.5 text-xs font-semibold">{g.name}</div>
              <div className="grid grid-cols-3 gap-1.5">
                {g.families.map((f) => (
                  <Button
                    key={f.id}
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    draggable={!disabled}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(variantTemplate(f, defaultVariant(f).id, real)))
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                    onClick={() => {
                      setFamId(f.id)
                      const inFam = f.variants.some((v) => v.id === armedId)
                      onArm(inFam && f.id === famId ? null : variantTemplate(f, defaultVariant(f).id, real))
                    }}
                    aria-pressed={f.id === famId}
                    className={cn('h-auto flex-col gap-1 px-1 py-2 text-xs font-normal', f.id === famId && 'border-primary bg-primary/5')}
                  >
                    <Art id={f.cover} className="size-8" />
                    <span className="leading-tight">{f.name}</span>
                  </Button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </ScrollArea>
      <div className="space-y-2 border-t p-4">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold">{fam.name} · 尺寸</span>
          <label className="flex items-center gap-1.5 text-muted-foreground">
            按比例
            <Switch
              checked={real}
              onCheckedChange={(next) => {
                setReal(next)
                if (armedId && fam.variants.some((v) => v.id === armedId)) {
                  onArm(variantTemplate(fam, armedId, next))
                }
              }}
              aria-label="按真实尺寸落图"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-1">
          {fam.variants.map((v) => (
            <Button
              key={v.id}
              size="xs"
              variant={armedId === v.id ? 'default' : 'outline'}
              disabled={disabled}
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => onArm(armedId === v.id ? null : variantTemplate(fam, v.id, real))}
            >
              {fam.variants.some((x) => x.art !== v.art) ? <Art id={v.art} className="size-4" /> : null}
              {v.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {real && !calibrated ? '当前图纸未标定，按比例的灯具先按固定大小示意；标定后自动换成真实尺寸。' : `计入报价：按设备类型统计（${fam.variants.length} 个尺寸档）。`}
        </p>
      </div>
    </div>
  )
}
