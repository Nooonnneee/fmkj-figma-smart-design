'use client'

import { useState } from 'react'

import { Card } from '@astryxdesign/core/Card'
import { FieldLabel } from '@astryxdesign/core/Field'
import { Layout, LayoutContent, LayoutHeader } from '@astryxdesign/core/Layout'
import { Selector } from '@astryxdesign/core/Selector'

export type DocKindOption = {
  kind: string
  label: string
  layouts: { value: string; label: string }[]
}
export type DocStyleOption = {
  id: string
  name: string
  description: string
  swatch: string[]
  enabled: boolean
}

function Swatch({ colors }: { colors: string[] }) {
  return (
    <span
      className="flex shrink-0 overflow-hidden rounded-sm ring-1 ring-foreground/10"
      aria-hidden
    >
      {colors.map((c) => (
        <span key={c} className="size-3" style={{ backgroundColor: c }} />
      ))}
    </span>
  )
}

/** 文档模板：每类文档的默认风格和版式（打印页仍可临时切换）。 */
export function DocumentTemplateSettings({
  kinds,
  styles,
  defaults,
}: {
  kinds: DocKindOption[]
  styles: DocStyleOption[]
  defaults: Record<string, { style?: string; layout?: string }>
}) {
  // 官方 Selector 只有受控写法：每类文档各记一份当前风格 + 版式，提交仍靠 htmlName。
  const [selection, setSelection] = useState<Record<string, { style: string; layout: string }>>(
    () =>
      Object.fromEntries(
        kinds.map((k) => {
          const d = defaults[k.kind] ?? {}
          return [
            k.kind,
            {
              style: styles.some((s) => s.id === d.style) ? d.style! : (styles[0]?.id ?? ''),
              layout: k.layouts.some((l) => l.value === d.layout)
                ? d.layout!
                : (k.layouts[0]?.value ?? ''),
            },
          ]
        }),
      ),
  )

  const pick = (kind: string, key: 'style' | 'layout', value: string) =>
    setSelection((s) => ({ ...s, [kind]: { ...s[kind]!, [key]: value } }))

  const styleOptions = styles.map((s) => ({
    value: s.id,
    label: s.name,
    icon: <Swatch colors={s.swatch} />,
    description: s.enabled ? undefined : '（插件已关闭，暂用简约）',
  }))

  return (
    <Card
      padding={0}
      className="border-0 bg-card text-sm text-card-foreground shadow-xs ring-1 ring-border"
    >
      <Layout
        height="auto"
        header={
          <LayoutHeader padding={5} paddingBlockEnd={0}>
            <div className="font-heading text-base font-semibold tracking-tight">文档模板</div>
          </LayoutHeader>
        }
        content={
          <LayoutContent padding={5} isScrollable={false}>
            <div className="grid gap-4">
              {kinds.map((k) => (
                <div key={k.kind} className="grid items-center gap-2 sm:grid-cols-[7rem_1fr_1fr]">
                  <FieldLabel isGroupLabel label={k.label} inputID={`doc-${k.kind}-style`} />
                  <Selector
                    label={k.label}
                    isLabelHidden
                    aria-label={`${k.label}风格`}
                    value={selection[k.kind]!.style}
                    onChange={(v) => pick(k.kind, 'style', v)}
                    htmlName={`doc-${k.kind}-style`}
                    width="100%"
                    options={styleOptions}
                  />
                  <Selector
                    label={k.label}
                    isLabelHidden
                    aria-label={`${k.label}版式`}
                    value={selection[k.kind]!.layout}
                    onChange={(v) => pick(k.kind, 'layout', v)}
                    htmlName={`doc-${k.kind}-layout`}
                    width="100%"
                    options={k.layouts.map((l) => ({ value: l.value, label: l.label }))}
                  />
                </div>
              ))}
            </div>
          </LayoutContent>
        }
      />
    </Card>
  )
}
