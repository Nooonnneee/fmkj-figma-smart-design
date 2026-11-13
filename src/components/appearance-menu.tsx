'use client'

import { useId } from 'react'
import { Monitor, Moon, Palette, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import { useAstryxTheme } from '@/components/astryx-theme-provider'
import { useAccent } from '@/components/theme-provider'
import { IconButton } from '@astryxdesign/core/IconButton'
import {
  DropdownMenu,
  DropdownMenuDivider,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@astryxdesign/core/DropdownMenu'
import { ACCENT_SWATCH, ACCENTS, isAccent } from '@/lib/appearance'
import { ASTRYX_SWATCH, ASTRYX_THEMES, isAstryxTheme } from '@/lib/astryx-theme'
import { cn } from '@/lib/utils'

const MODES = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
] as const

/**
 * 组标题。
 *
 * 官方 `DropdownMenuRadioGroup` 自己就渲染 `role="group"` + `aria-label`，
 * 如果外面再套一层 `DropdownMenuGroup`（同样是 `role="group"`）就会变成
 * 嵌套的重复分组，屏幕阅读器会把同一组播报两遍。所以这里只渲染一段
 * 纯展示的标题文本，并用 `aria-labelledby` 指回它 —— 可访问名只有一份。
 */
function GroupHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div id={id} className="px-2 py-1 text-xs text-muted-foreground select-none">
      {children}
    </div>
  )
}

/** 主题风格色块：官方 item 的 `icon` 槽会把已渲染节点原样透传，尺寸由这里决定。 */
function AccentSwatch({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={cn('size-3.5 rounded-full ring-1 ring-foreground/10', className)}
    />
  )
}

/** 组件主题色块：颜色来自内联 style，不走 Tailwind 调色板。 */
function ThemeSwatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="size-3.5 shrink-0 rounded-full ring-1 ring-foreground/10"
      style={{ backgroundColor: color }}
    />
  )
}

/** 外观菜单项：颜色模式 + 主题风格 + 组件主题（顶栏按钮共用）。 */
export function AppearanceMenuItems() {
  const { theme, setTheme } = useTheme()
  const { accent, setAccent } = useAccent()
  const { themeId, setThemeId } = useAstryxTheme()
  const modeHeadingId = useId()
  const accentHeadingId = useId()
  const componentHeadingId = useId()

  return (
    <>
      <GroupHeading id={modeHeadingId}>颜色模式</GroupHeading>
      <DropdownMenuRadioGroup
        label="颜色模式"
        aria-labelledby={modeHeadingId}
        value={theme ?? 'system'}
        onChange={(v) => setTheme(v)}
      >
        {MODES.map(({ value, label, icon: Icon }) => (
          <DropdownMenuRadioItem
            key={value}
            value={value}
            label={label}
            icon={<Icon className="size-4" />}
          />
        ))}
      </DropdownMenuRadioGroup>
      <DropdownMenuDivider />
      <GroupHeading id={accentHeadingId}>主题风格</GroupHeading>
      <DropdownMenuRadioGroup
        label="主题风格"
        aria-labelledby={accentHeadingId}
        value={accent}
        onChange={(v) => isAccent(v) && setAccent(v)}
      >
        {ACCENTS.map((a) => (
          <DropdownMenuRadioItem
            key={a.id}
            value={a.id}
            label={a.label}
            icon={<AccentSwatch className={ACCENT_SWATCH[a.id]} />}
          />
        ))}
      </DropdownMenuRadioGroup>
      <DropdownMenuDivider />
      <GroupHeading id={componentHeadingId}>组件主题</GroupHeading>
      <DropdownMenuRadioGroup
        label="组件主题"
        aria-labelledby={componentHeadingId}
        value={themeId}
        onChange={(v) => isAstryxTheme(v) && setThemeId(v)}
      >
        {ASTRYX_THEMES.map((t) => (
          <DropdownMenuRadioItem
            key={t.id}
            value={t.id}
            label={t.label}
            icon={<ThemeSwatch color={ASTRYX_SWATCH[t.id]} />}
          />
        ))}
      </DropdownMenuRadioGroup>
    </>
  )
}

/** 顶栏外观按钮 */
export function AppearanceMenu() {
  return (
    <DropdownMenu
      alignment="end"
      menuWidth={176}
      // 三组一共 13 行，官方默认 300px 上限会把「组件主题」压到滚动区里；
      // 抬到和内容同高，保持原来一屏看全的样子。
      menuMaxHeight={700}
      renderTrigger={(props) => (
        <IconButton
          {...props}
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
          label="外观：颜色模式、主题风格与组件主题"
          icon={<Palette />}
          size="sm"
        />
      )}
    >
      <AppearanceMenuItems />
    </DropdownMenu>
  )
}
