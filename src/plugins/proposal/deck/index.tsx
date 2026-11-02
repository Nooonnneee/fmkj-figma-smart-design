/**
 * 横版提案（Figma 设计稿 FGGahF8jZGnRLwcgZfJloK 演化而来的模板框架）：
 * 模板决定章节顺序（framework.ts）和视觉主题（themes.ts）；页数随项目自动增减——
 * 图纸、空间、场景、条目越多，页数越多；章节编号即页码。
 */
import { Fragment } from 'react'

import { DocRoot } from '@/documents/parts'
import type { ProjectDocsData } from '@/lib/project-docs'

import type { DeckSection } from '../framework'
import type { ProposalMarkers } from '../templates'
import { buildDeck } from './model'
import { CoverPage } from './pages/cover'
import { InvestmentPage, paginateRows, type InvestRow } from './pages/investment'
import { PlanPage } from './pages/plan'
import { paginateRooms, RoomsPage } from './pages/rooms'
import { deckScenes, ScenesPage } from './pages/scenes'
import { ServicePage } from './pages/service'
import { SystemPage } from './pages/system'
import { ZonePage } from './pages/zone'
import type { DeckCtx } from './parts'
import { deckVars, type DeckTheme } from './themes'

export { customizeTheme, DECK_THEME_LIST, DECK_THEMES, isDeckTheme, type DeckTheme, type DeckThemeId } from './themes'

type PageRender = (no: number, total: number) => React.ReactNode

const ALL_SECTIONS: DeckSection[] = ['cover', 'plans', 'system', 'zones', 'scenes', 'rooms', 'investment', 'service']

/**
 * 按模板的章节顺序生成页面（framework.ts）。没有点位时只保留封面、投资与服务交付。
 */
export function deckPages(d: ProjectDocsData, theme: DeckTheme, opts: { markers: ProposalMarkers; insights: boolean; sections?: DeckSection[] }) {
  const m = buildDeck(d)
  const ctx: DeckCtx = { m, theme, markers: opts.markers === 'symbol' ? 'symbol' : 'number' }
  const pages: PageRender[] = []
  const needsPoints = new Set<DeckSection>(['plans', 'system', 'zones', 'scenes', 'rooms'])
  const sections = (opts.sections?.length ? opts.sections : ALL_SECTIONS).filter((s) => d.points.length || !needsPoints.has(s))
  // 服务交付页的页码（投资页里引用），先占位，最后回填
  let servicePage = 0
  const render: Record<DeckSection, () => void> = {
    cover: () => pages.push((no, total) => <CoverPage ctx={ctx} no={no} total={total} />),
    plans: () => m.sheets.forEach((s, i) => pages.push((no, total) => <PlanPage ctx={ctx} no={no} total={total} s={s} first={i === 0} />)),
    system: () => pages.push((no, total) => <SystemPage ctx={ctx} no={no} total={total} />),
    zones: () => {
      for (const zone of m.zones) pages.push((no, total) => <ZonePage ctx={ctx} no={no} total={total} zone={zone} insights={opts.insights} />)
    },
    // 场景库匹配到的场景，每页两个
    scenes: () => {
      const list = deckScenes(m)
      const n = Math.ceil(list.length / 2)
      for (let i = 0; i < n; i++) pages.push((no, total) => <ScenesPage ctx={ctx} no={no} total={total} scenes={list.slice(i * 2, i * 2 + 2)} part={n > 1 ? `（${i + 1}/${n}）` : ''} />)
    },
    rooms: () => {
      const roomPages = paginateRooms(m.otherRooms)
      roomPages.forEach((page, i) =>
        pages.push((no, total) => <RoomsPage ctx={ctx} no={no} total={total} page={page} rooms={m.otherRooms.length} part={roomPages.length > 1 ? `（${i + 1}/${roomPages.length}）` : ''} />),
      )
    },
    investment: () => {
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
            servicePage={servicePage || total}
          />
        )),
      )
    },
    service: () => {
      pages.push((no, total) => <ServicePage ctx={ctx} no={no} total={total} />)
      servicePage = pages.length
    },
  }
  for (const s of sections) render[s]()
  return pages.map((r, i) => <Fragment key={i}>{r(i + 1, pages.length)}</Fragment>)
}

/** 方案根节点：风格变量 + 方案专用变量；页面按 1440px 设计稿排版，窄屏横向滚动 */
export function DeckRoot({ theme, children }: { theme: DeckTheme; children: React.ReactNode }) {
  return (
    <DocRoot style={theme.style} className="overflow-x-auto print:overflow-visible">
      <div style={deckVars(theme)} className="min-w-[1440px] space-y-6 py-6 print:min-w-0 print:space-y-0 print:py-0">
        {children}
      </div>
    </DocRoot>
  )
}
