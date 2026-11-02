/** 文档（报价单、合同、点位图、交底清单）的风格定义。风格只决定外观，内容结构由各文档的「版式」决定。 */
export type DocStyle = {
  id: string
  name: string
  description: string
  colors: {
    /** 纸张底色 */
    paper: string
    /** 正文 */
    ink: string
    /** 次要文字 */
    muted: string
    /** 强调色：编号、小标题旁注、比例等 */
    accent: string
    /** 浅色强调底（联系卡片、高亮）及其渐变终点 */
    soft: string
    softTo: string
    /** 分隔线、表格线 */
    rule: string
    /** 表头 / 页眉色带 */
    headBg: string
    headFg: string
    /** 表格斑马纹 */
    stripe: string
  }
  /** 字体角色：大标题、强调、正文、数字编号、英文 */
  fonts: { display: string; strong: string; body: string; numeral: string; latin: string }
  weights: { display: number; strong: number; numeral: number }
  /** 页眉：line 细线 / band 色带 / editorial 品牌标记 + 英文副标 */
  header: 'line' | 'band' | 'editorial'
  /** 标题：plain 普通 / underline 强调短线 / numbered 大号编号 */
  title: 'plain' | 'underline' | 'numbered'
  /** 表格：ruled 细线 / dark 深色表头 + 斑马纹 / grid 网格 */
  table: 'ruled' | 'dark' | 'grid'
  radius: string
  /** editorial 页眉右侧的英文副标 */
  tagline?: string
}

/** 有模板的文档种类 */
export type DocKind = 'quote' | 'plans' | 'contract' | 'checklist'

export type DocLayout = { value: string; label: string; description: string }
