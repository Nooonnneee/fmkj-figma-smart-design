'use client'

import * as React from 'react'
import { Theme } from '@astryxdesign/core/theme'
import { InternationalizationProvider } from '@astryxdesign/core/i18n'
import zhCN from '@astryxdesign/core/locales/zh-CN.generated.js'
import { useTheme } from 'next-themes'

import { themes } from '@/astryx-themes'
import {
  ASTRYX_THEME_STORAGE_KEY,
  DEFAULT_ASTRYX_THEME,
  isAstryxTheme,
  type AstryxThemeId,
} from '@/lib/astryx-theme'

type AstryxThemeContextValue = {
  themeId: AstryxThemeId
  setThemeId: (id: AstryxThemeId) => void
}

const AstryxThemeContext = React.createContext<AstryxThemeContextValue>({
  themeId: DEFAULT_ASTRYX_THEME,
  setThemeId: () => {},
})

export function useAstryxTheme() {
  return React.useContext(AstryxThemeContext)
}

/**
 * 组件主题（Astryx）的 Provider。
 *
 * ⚠️ 必须由 React 渲染 `<Theme>`，**不能只改 `<html data-astryx-theme>` 属性**：
 * `<Theme>` 会在内层 `<div>` 上再写一份该属性，而主题 CSS 是
 * `@scope ([data-astryx-theme="X"])` —— 内层离组件更近，会遮蔽 `<html>`。
 * （实测：只改 `<html>` → 组件不变；两处都改 → 才生效。）
 *
 * 首屏不闪：`<head>` 里的 `ASTRYX_THEME_INIT_SCRIPT` 先把值写到 `<html>`，
 * 这里 hydration 后立刻用同一个值渲染 `<Theme>`，两处保持一致。
 */
export function AstryxThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = React.useState<AstryxThemeId>(DEFAULT_ASTRYX_THEME)

  // ⚠️ 必须把明暗模式传给 `<Theme mode>`，否则组件 token 永远取浅色那一侧。
  // 主题 CSS 里的 `light-dark()` 被 Lightning CSS 编译成
  // `var(--lightningcss-light, 浅色) var(--lightningcss-dark, 深色)`，
  // 而 `<Theme>` 那层 div 用 Stylex 的 `:not(#\#)`×3 高特异性把浅色分支钉死；
  // 只有 mode="dark" 才会换成深色分支。默认 'system' 只跟操作系统，
  // 用户在应用里选「深色」而系统是浅色时，就会深底深字（归档页 2026-11-14 实测）。
  // 首帧必须与 SSR 一致（'system'），否则 `<Theme>` 会写出不同的 data-theme 属性，
  // React 报 hydration mismatch。挂载后再切到用户实际选的模式。
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  const { resolvedTheme } = useTheme()
  const mode = !mounted
    ? 'system'
    : resolvedTheme === 'dark'
      ? 'dark'
      : resolvedTheme === 'light'
        ? 'light'
        : 'system'

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(ASTRYX_THEME_STORAGE_KEY)
      if (isAstryxTheme(saved)) setThemeIdState(saved)
    } catch {
      // 隐私模式下读不到，保持默认主题
    }
  }, [])

  const setThemeId = React.useCallback((next: AstryxThemeId) => {
    setThemeIdState(next)
    try {
      localStorage.setItem(ASTRYX_THEME_STORAGE_KEY, next)
    } catch {
      // 隐私模式下无法写入时，本次会话内仍然生效
    }
  }, [])

  const value = React.useMemo(() => ({ themeId, setThemeId }), [themeId, setThemeId])

  return (
    <AstryxThemeContext.Provider value={value}>
      <Theme theme={themes[themeId]} mode={mode}>
        {/* 组件内置文案（日历「选择日期 / 选择时间」、对话框「关闭」等）默认是英文。
            产品是全中文的，所以固定中文目录；日期控件此前在归档页显示英文占位符
            （Select a date / Select a time），2026-11-14 修复。
            locale 是常量、不随用户状态变化，SSR 与客户端首帧一致，不会 hydration mismatch。 */}
        <InternationalizationProvider locale="zh-CN" messages={{ 'zh-CN': zhCN }}>
          {children}
        </InternationalizationProvider>
      </Theme>
    </AstryxThemeContext.Provider>
  )
}
