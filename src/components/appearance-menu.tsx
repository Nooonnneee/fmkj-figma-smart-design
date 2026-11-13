'use client'

import { Check, Monitor, Moon, Palette, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import { useAstryxTheme } from '@/components/astryx-theme-provider'
import { useAccent } from '@/components/theme-provider'
import { IconButton } from '@astryxdesign/core/IconButton'
import {
  DropdownMenu,
  DropdownMenuDivider,
  DropdownMenuGroup,
  DropdownMenuItem,
} from '@astryxdesign/core/DropdownMenu'
import { ACCENT_SWATCH, ACCENTS } from '@/lib/appearance'
import { ASTRYX_SWATCH, ASTRYX_THEMES } from '@/lib/astryx-theme'
import { cn } from '@/lib/utils'

const MODES = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
] as const

/**
 * 选中标记。
 *
 * 官方的 `DropdownMenuRadioItem` 自带单选指示器，且没有关掉它的 prop；
 * 我们的色块本身已经在 `icon` 槽里，再叠一个圆点就变成「圆点 + 色块」两个图标。
 * 所以改用官方 `DropdownMenuItem`，选中态放在 `endContent` 的勾选标记上。
 */
function SelectionCheck({ selected }: { selected: boolean }) {
  return selected ? <Check aria-hidden className="size-4 text-foreground" /> : null
}

/**
 * 主题风格色块：官方 item 的 `icon` 槽会把已渲染节点原样透传，尺寸由这里决定。
 *
 * `pill` 用形状反映该主题真实的按钮形态——「官网」的按钮是全圆胶囊（见 `ACCENTS`
 * 里「墨色胶囊」的描述），所以画成胶囊，其余仍是圆点。只靠颜色分不开这两套：
 * 官网 `oklch(0.205 0.012 265)` 和经典 `oklch(0.205 0 0)` 明度相同、彩度只差 0.012，
 * 都是近黑的 14px 圆点，肉眼看不出差别（视觉评审指出过这一点）。
 */
function AccentSwatch({ className, pill = false }: { className: string; pill?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'h-3.5 shrink-0 rounded-full ring-1 ring-foreground/10',
        pill ? 'w-6' : 'w-3.5',
        className,
      )}
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
  const mode = theme ?? 'system'

  return (
    <>
      <DropdownMenuGroup title="颜色模式">
        {MODES.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem
            key={value}
            label={label}
            icon={<Icon className="size-4" />}
            endContent={<SelectionCheck selected={mode === value} />}
            onClick={() => setTheme(value)}
          />
        ))}
      </DropdownMenuGroup>
      <DropdownMenuDivider />
      <DropdownMenuGroup title="主题风格">
        {ACCENTS.map((a) => (
          <DropdownMenuItem
            key={a.id}
            label={a.label}
            icon={<AccentSwatch className={ACCENT_SWATCH[a.id]} pill={a.id === 'official'} />}
            endContent={<SelectionCheck selected={accent === a.id} />}
            onClick={() => setAccent(a.id)}
          />
        ))}
      </DropdownMenuGroup>
      <DropdownMenuDivider />
      <DropdownMenuGroup title="组件主题">
        {ASTRYX_THEMES.map((t) => (
          <DropdownMenuItem
            key={t.id}
            label={t.label}
            icon={<ThemeSwatch color={ASTRYX_SWATCH[t.id]} />}
            endContent={<SelectionCheck selected={themeId === t.id} />}
            onClick={() => setThemeId(t.id)}
          />
        ))}
      </DropdownMenuGroup>
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
