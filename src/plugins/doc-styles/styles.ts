import type { DocStyle } from '@/documents/types'
import { SANS } from '@/documents/minimal'

const NOTO_FALLBACK = "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif"
const SERIF = "'Noto Serif SC', 'Songti SC', 'STSong', 'SimSun', serif"
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace"

/** 栖序雅致：来自 Figma 设计稿——暖白纸色、灰紫强调、细体大编号、深灰表头。 */
export const QIXU_STYLE: DocStyle = {
  id: 'qixu',
  name: '栖序雅致',
  description: '暖白纸色、灰紫强调、细体大编号，适合提案和高端住宅',
  colors: {
    paper: '#f8f7f4',
    ink: '#252523',
    muted: '#787771',
    accent: '#7773b8',
    soft: '#e7dff4',
    softTo: '#d9e7f2',
    rule: '#dad8d1',
    headBg: '#333338',
    headFg: '#ffffff',
    stripe: '#efeee9',
  },
  fonts: {
    display: `'Noto Sans SC:Bold', ${NOTO_FALLBACK}`,
    strong: `'Noto Sans SC:Medium', ${NOTO_FALLBACK}`,
    body: `'Noto Sans SC:Regular', ${NOTO_FALLBACK}`,
    numeral: `'Inter:Light', ${SANS}`,
    latin: `'Inter:Regular', ${SANS}`,
  },
  weights: { display: 700, strong: 500, numeral: 300 },
  header: 'editorial',
  title: 'numbered',
  table: 'dark',
  radius: '0px',
  tagline: 'RESIDENTIAL INTELLIGENCE',
}

/** 商务蓝：深蓝页眉色带、深色表头，正式稳重。 */
export const BUSINESS_STYLE: DocStyle = {
  id: 'business',
  name: '商务蓝',
  description: '深蓝页眉色带、深色表头，正式稳重，适合企业客户',
  colors: {
    paper: '#ffffff',
    ink: '#0f172a',
    muted: '#5b6678',
    accent: '#1e40af',
    soft: '#eef4ff',
    softTo: '#e0ebff',
    rule: '#cfd8e3',
    headBg: '#1e3a8a',
    headFg: '#ffffff',
    stripe: '#f6f8fb',
  },
  fonts: { display: SANS, strong: SANS, body: SANS, numeral: SANS, latin: SANS },
  weights: { display: 700, strong: 600, numeral: 600 },
  header: 'band',
  title: 'underline',
  table: 'dark',
  radius: '4px',
}

/** 东方雅韵：米色纸、朱红点缀、衬线标题。 */
export const ORIENTAL_STYLE: DocStyle = {
  id: 'oriental',
  name: '东方雅韵',
  description: '米色纸、朱红点缀、衬线标题，适合中式和新中式住宅',
  colors: {
    paper: '#fbf8f2',
    ink: '#2a2420',
    muted: '#7f7467',
    accent: '#9b2c2c',
    soft: '#f3e9dc',
    softTo: '#efe2cf',
    rule: '#e2d6c4',
    headBg: '#f1e6d6',
    headFg: '#2a2420',
    stripe: '#f7f1e7',
  },
  fonts: { display: SERIF, strong: SERIF, body: SANS, numeral: SERIF, latin: SERIF },
  weights: { display: 700, strong: 600, numeral: 400 },
  header: 'line',
  title: 'underline',
  table: 'ruled',
  radius: '2px',
}

/** 科技：冷白底、天蓝强调、等宽数字、网格表格。 */
export const TECH_STYLE: DocStyle = {
  id: 'tech',
  name: '科技',
  description: '冷白底、天蓝强调、等宽数字和网格表格，适合年轻客户和极客',
  colors: {
    paper: '#ffffff',
    ink: '#0b1220',
    muted: '#566074',
    accent: '#0369a1',
    soft: '#e6f4fd',
    softTo: '#eafcff',
    rule: '#d6deea',
    headBg: '#e9f1fa',
    headFg: '#0b1220',
    stripe: '#f5f8fc',
  },
  fonts: { display: SANS, strong: SANS, body: SANS, numeral: MONO, latin: MONO },
  weights: { display: 700, strong: 600, numeral: 500 },
  header: 'line',
  title: 'numbered',
  table: 'grid',
  radius: '8px',
}

export const PLUGIN_DOC_STYLES = [QIXU_STYLE, BUSINESS_STYLE, ORIENTAL_STYLE, TECH_STYLE]
