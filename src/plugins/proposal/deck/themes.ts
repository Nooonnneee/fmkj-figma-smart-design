/**
 * 8 章提案的三种风格。每种风格 = 颜色字体（DocStyle，驱动 bg-doc-* / doc-display 等工具类）
 * + 方案专用变量（--deck-*：说明卡、平面卡、编号圆点、照片标注、圆角）+ 版式变体（封面、章节标题、表格）。
 *
 * - 栖序雅致：Figma 设计稿原样（暖白纸、灰紫、Inter 细体大编号、深灰表头、照片色带封面）；
 * - 墨金臻选：深色画面、香槟金、衬线标题、整幅照片封面、金线表头，适合电子版演示；
 * - 原木自然：燕麦纸、橄榄绿、衬线标题、左右分栏封面、圆角照片与卡片。
 */
import type { CSSProperties } from 'react'

import type { DocStyle } from '@/documents/types'
import { GROVE_STYLE, QIXU_STYLE } from '@/plugins/doc-styles/styles'

const NOTO_FALLBACK = "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif"
const SERIF = "'Noto Serif SC', 'Songti SC', 'STSong', 'SimSun', serif"

/** 墨金臻选的深色画面（方案专用；报价单、合同用的是纸面版 NOIR_STYLE） */
const NOIR_DECK_STYLE: DocStyle = {
  id: 'noir-deck',
  name: '墨金臻选',
  description: '深色画面、香槟金、衬线标题',
  colors: {
    paper: '#141416',
    ink: '#f1ebdf',
    muted: '#9b9588',
    accent: '#c9a86a',
    soft: '#2a2621',
    softTo: '#1c1b19',
    rule: '#34322d',
    headBg: '#1c1b19',
    headFg: '#c9a86a',
    stripe: '#18181a',
  },
  fonts: {
    display: SERIF,
    strong: `'Noto Sans SC:Medium', ${NOTO_FALLBACK}`,
    body: `'Noto Sans SC:Regular', ${NOTO_FALLBACK}`,
    numeral: SERIF,
    latin: `'Inter:Regular', ${NOTO_FALLBACK}`,
  },
  weights: { display: 700, strong: 500, numeral: 400 },
  header: 'editorial',
  title: 'underline',
  table: 'dark',
  radius: '0px',
  tagline: 'PRIVATE RESIDENCE',
}

export type DeckThemeId = 'qixu' | 'noir' | 'grove'

export type DeckTheme = {
  id: DeckThemeId
  style: DocStyle
  /** 方案专用颜色与圆角 */
  vars: Record<string, string>
  cover: 'band' | 'immersive' | 'split'
  chapter: 'numeral' | 'eyebrow' | 'badge'
  table: 'dark' | 'gold' | 'soft'
  headline: string
  /** 页眉右侧英文（品牌英文名之后） */
  tagline: string
  coverTagline: string
  coverPhoto: string
  /** 照片上的说明标签 */
  photoNote: string
}

export const DECK_THEMES: Record<DeckThemeId, DeckTheme> = {
  qixu: {
    id: 'qixu',
    style: QIXU_STYLE,
    vars: {
      '--deck-panel': '#ecebf6',
      '--deck-panel-border': 'transparent',
      '--deck-card': '#ffffff',
      '--deck-card-border': 'transparent',
      '--deck-diagram': '#ffffff',
      '--deck-muted-panel': '#efeee9',
      '--deck-box': '#efeee9',
      '--deck-marker': '#7773b8',
      '--deck-marker-ring': '#ffffff',
      '--deck-marker-fg': '#ffffff',
      '--deck-plan-code': '#6c68b0',
      '--deck-chip': '#ffffff',
      '--deck-chip-fg': '#7773b8',
      '--deck-chip-ink': '#252523',
      '--deck-badge': '#ecebf6',
      '--deck-service-row': '#ecebf6',
      '--deck-radius': '0px',
      '--deck-radius-sm': '0px',
    },
    cover: 'band',
    chapter: 'numeral',
    table: 'dark',
    headline: '让家，懂你的生活。',
    tagline: 'RESIDENTIAL INTELLIGENCE',
    coverTagline: 'A HOME THAT UNDERSTANDS YOU',
    coverPhoto: '/proposal/photos/cover-qixu.jpg',
    photoNote: '氛围意向图 · 生活场景示意，非项目实景',
  },
  noir: {
    id: 'noir',
    style: NOIR_DECK_STYLE,
    vars: {
      '--deck-panel': '#1c1b19',
      '--deck-panel-border': 'rgba(201, 168, 106, 0.45)',
      '--deck-card': '#f3efe6',
      '--deck-card-border': 'transparent',
      '--deck-diagram': '#19191b',
      '--deck-muted-panel': '#1c1b19',
      '--deck-box': '#232220',
      '--deck-marker': '#c9a86a',
      '--deck-marker-ring': '#141416',
      '--deck-marker-fg': '#141416',
      '--deck-plan-code': '#7a5c22',
      '--deck-chip': '#141416',
      '--deck-chip-fg': '#c9a86a',
      '--deck-chip-ink': '#f1ebdf',
      '--deck-badge': '#262420',
      '--deck-service-row': '#1f1d1a',
      '--deck-radius': '0px',
      '--deck-radius-sm': '0px',
    },
    cover: 'immersive',
    chapter: 'eyebrow',
    table: 'gold',
    headline: '静享不凡，智在无声。',
    tagline: 'PRIVATE RESIDENCE',
    coverTagline: 'PRIVATE RESIDENCE · SMART LIVING',
    coverPhoto: '/proposal/photos/cover-noir.jpg',
    photoNote: '氛围意向图 · 非项目实景',
  },
  grove: {
    id: 'grove',
    style: GROVE_STYLE,
    vars: {
      '--deck-panel': '#e6eadb',
      '--deck-panel-border': 'transparent',
      '--deck-card': '#fffdf8',
      '--deck-card-border': '#ddd4c3',
      '--deck-diagram': '#fffdf8',
      '--deck-muted-panel': '#ece6d9',
      '--deck-box': '#f3eee4',
      '--deck-marker': '#5e6e4f',
      '--deck-marker-ring': '#ffffff',
      '--deck-marker-fg': '#ffffff',
      '--deck-plan-code': '#4b5a3e',
      '--deck-chip': '#fffdf8',
      '--deck-chip-fg': '#5e6e4f',
      '--deck-chip-ink': '#2e2b25',
      '--deck-badge': '#e6eadb',
      '--deck-service-row': '#eef1e6',
      '--deck-radius': '18px',
      '--deck-radius-sm': '12px',
    },
    cover: 'split',
    chapter: 'badge',
    table: 'soft',
    headline: '让家，回到自然的节奏。',
    tagline: 'NATURAL LIVING',
    coverTagline: 'LIVING WITH NATURE',
    coverPhoto: '/proposal/photos/cover-grove.jpg',
    photoNote: '氛围意向图 · 非项目实景',
  },
}

export const isDeckTheme = (v: unknown): v is DeckThemeId => v === 'qixu' || v === 'noir' || v === 'grove'

export const deckVars = (theme: DeckTheme) => theme.vars as CSSProperties
