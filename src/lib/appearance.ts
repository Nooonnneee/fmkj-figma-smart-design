/**
 * 外观：颜色模式（浅色 / 深色 / 跟随系统，由 next-themes 管理）+ 主题风格（强调色）。
 * 主题风格写在 <html data-accent="…">，CSS 变量见 styles.css；页面绘制前由内联脚本恢复，避免闪烁。
 */
export const ACCENTS = [
  { id: 'fanmeng', label: '繁梦紫', description: '品牌紫，灵动有梦想感' },
  { id: 'jade', label: '青碧', description: '清爽青绿，适合长时间工作' },
  { id: 'classic', label: '经典', description: '黑白灰为主，专注内容本身' },
] as const

export type AccentId = (typeof ACCENTS)[number]['id']

export const DEFAULT_ACCENT: AccentId = 'fanmeng'
export const ACCENT_STORAGE_KEY = 'fmkj-accent'

export const isAccent = (v: unknown): v is AccentId => ACCENTS.some((a) => a.id === v)

/** 主题风格色块（对应 styles.css 中的 --color-swatch-*） */
export const ACCENT_SWATCH: Record<AccentId, string> = {
  fanmeng: 'bg-swatch-fanmeng',
  jade: 'bg-swatch-jade',
  classic: 'bg-swatch-classic',
}

/** 在 <head> 里尽早执行：恢复上次选择的主题风格 */
export const ACCENT_INIT_SCRIPT = `(function(){var d=document.documentElement;try{var a=localStorage.getItem('${ACCENT_STORAGE_KEY}');d.setAttribute('data-accent',a==='jade'||a==='classic'||a==='fanmeng'?a:'${DEFAULT_ACCENT}')}catch(e){d.setAttribute('data-accent','${DEFAULT_ACCENT}')}})()`
