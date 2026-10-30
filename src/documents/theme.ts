import type { CSSProperties } from 'react'

import type { DocStyle } from './types'

/** 把风格转成文档根节点上的 CSS 变量（Tailwind 的 bg-doc-*、doc-display 等工具类读取它们）。 */
export function docVars(style: DocStyle): CSSProperties {
  const c = style.colors
  return {
    '--doc-paper': c.paper,
    '--doc-ink': c.ink,
    '--doc-muted': c.muted,
    '--doc-accent': c.accent,
    '--doc-soft': c.soft,
    '--doc-soft-to': c.softTo,
    '--doc-rule': c.rule,
    '--doc-head-bg': c.headBg,
    '--doc-head-fg': c.headFg,
    '--doc-stripe': c.stripe,
    '--doc-font-display': style.fonts.display,
    '--doc-font-strong': style.fonts.strong,
    '--doc-font-body': style.fonts.body,
    '--doc-font-numeral': style.fonts.numeral,
    '--doc-font-latin': style.fonts.latin,
    '--doc-w-display': String(style.weights.display),
    '--doc-w-strong': String(style.weights.strong),
    '--doc-w-numeral': String(style.weights.numeral),
    '--doc-radius': style.radius,
  } as CSSProperties
}
