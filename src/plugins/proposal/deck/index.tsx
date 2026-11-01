/**
 * 8 章提案（Figma 设计稿 FGGahF8jZGnRLwcgZfJloK）：
 * 封面 → 住宅平面（每张图纸一页）→ 系统与设备 → 生活场景（进门 / 休息 / 看护 / 专注）→ 其余空间 → 投资明细 → 服务交付。
 * 页数随项目自动增减：图纸、空间、条目越多，页数越多；章节编号即页码。
 */
import { Fragment } from 'react'

import { DocRoot } from '@/documents/parts'
import type { ProjectDocsData } from '@/lib/project-docs'

import type { ProposalMarkers } from '../templates'
import { buildDeck } from './model'
import { CoverPage } from './pages/cover'
import { InvestmentPage, paginateRows, type InvestRow } from './pages/investment'
import { PlanPage } from './pages/plan'
import { paginateRooms, RoomsPage } from './pages/rooms'
import { ServicePage } from './pages/service'
import { SystemPage } from './pages/system'
import { ZonePage } from './pages/zone'
import type { DeckCtx } from './parts'
import { DECK_THEMES, deckVars, type DeckThemeId } from './themes'

export { isDeckTheme, type DeckThemeId } from './themes'

type PageRender = (no: number, total: number) => React.ReactNode

export function deckPages(d: ProjectDocsData, themeId: DeckThemeId, opts: { markers: ProposalMarkers; insights: boolean }) {
  const m = buildDeck(d)
  const ctx: DeckCtx = { m, theme: DECK_THEMES[themeId], markers: opts.markers === 'symbol' ? 'symbol' : 'number' }
  const pages: PageRender[] = []
  pages.push((no, total) => <CoverPage ctx={ctx} no={no} total={total} />)
  if (d.points.length) {
    m.sheets.forEach((s, i) => pages.push((no, total) => <PlanPage ctx={ctx} no={no} total={total} s={s} first={i === 0} />))
    pages.push((no, total) => <SystemPage ctx={ctx} no={no} total={total} />)
    for (const zone of m.zones) pages.push((no, total) => <ZonePage ctx={ctx} no={no} total={total} zone={zone} insights={opts.insights} />)
    const roomPages = paginateRooms(m.otherRooms)
    roomPages.forEach((page, i) =>
      pages.push((no, total) => <RoomsPage ctx={ctx} no={no} total={total} page={page} part={roomPages.length > 1 ? `（${i + 1}/${roomPages.length}）` : ''} />),
    )
  }
  const rows: InvestRow[] = [...m.items.map((item) => ({ kind: 'item' as const, item })), ...m.fees.map((fee) => ({ kind: 'fee' as const, fee }))]
  const investPages = paginateRows(rows, 12, 9)
  investPages.forEach((list, i) =>
    pages.push((no, total) => (
      <InvestmentPage
        ctx={ctx}
        no={no}
        total={total}
        rows={list}
        part={investPages.length > 1 ? `（${i + 1}/${investPages.length}）` : ''}
        isLast={i === investPages.length - 1}
        servicePage={total}
      />
    )),
  )
  pages.push((no, total) => <ServicePage ctx={ctx} no={no} total={total} />)
  return pages.map((render, i) => <Fragment key={i}>{render(i + 1, pages.length)}</Fragment>)
}

/** 方案根节点：风格变量 + 方案专用变量；页面按 1440px 设计稿排版，窄屏横向滚动 */
export function DeckRoot({ themeId, children }: { themeId: DeckThemeId; children: React.ReactNode }) {
  const theme = DECK_THEMES[themeId]
  return (
    <DocRoot style={theme.style} className="overflow-x-auto print:overflow-visible">
      <div style={deckVars(theme)} className="min-w-[1440px] space-y-6 py-6 print:min-w-0 print:space-y-0 print:py-0">
        {children}
      </div>
    </DocRoot>
  )
}
