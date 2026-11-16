'use client'

import { useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  Activity,
  BookOpen,
  Cable,
  Crown,
  FolderKanban,
  Home,
  IdCard,
  LayoutTemplate,
  LogOut,
  PackageSearch,
  Plus,
  Settings,
  Wrench,
} from 'lucide-react'

import { BetaBadge } from '@/components/beta-badge'
import { BrandMark } from '@/components/brand/brand-mark'
import { GuardedLink } from '@/components/guarded-link'
import { LinkPending } from '@/components/link-pending'
import { activeNavUrl } from '@/lib/nav-active'
import { MembershipDialog } from '@/components/workspace-dialogs'
import { Avatar } from '@astryxdesign/core/Avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { Tooltip } from '@astryxdesign/core/Tooltip'
import { APP_NAME, APP_TAGLINE } from '@/lib/brand'
import { cn } from '@/lib/utils'
import type { PluginId } from '@/plugins/types'

export type SidebarUser = { name: string; email: string }
export type SidebarBrand = { name: string; logo: string | null }
export type SidebarPlugin = {
  id: PluginId
  name: string
  description: string
  status: 'ready' | 'coming-soon'
  enabled: boolean
  where: string
  provides: string[]
}

/** 空间设计工作台：项目 + 产品库 */
const workNav = [
  { icon: FolderKanban, label: '项目', url: '/projects' },
  { icon: PackageSearch, label: '产品库', url: '/products' },
] as const

/** HA 助手：只读查看已连接现场 Home Assistant（第一期只读模组，开发中） */
const homeNav = [{ icon: Home, label: '智能家居', url: '/smart-home', beta: true }] as const

/** KNX / ETS：第一期只留模块位，点进去是空态页（开发中） */
const knxNav = [{ icon: Cable, label: 'KNX 工程', url: '/knx', beta: true }] as const

/** 营销工具：第一期只放名片（页面与 URL 沿用现有的能力页） */
const marketingNav = [{ icon: IdCard, label: '名片', url: '/capabilities/business-card' }] as const

/** 低频入口不占侧栏：收在左下角齿轮的「设置」菜单里 */
const settingsNav = [
  { icon: Settings, label: '公司与报价设置', url: '/settings' },
  { icon: Activity, label: '客户使用报告', url: '/settings/reports' },
  { icon: BookOpen, label: '使用文档', url: '/docs' },
] as const

/**
 * 模板与工具入口：留在侧栏的两个能力功能（模板中心 / 全部工具）。
 * 原「能力中心」分组标题和「AI 能力」组都已从侧栏移除——
 * AI 对话挪到了右侧常驻一列（components/ai/ai-panel.tsx），
 * 能力中心总览页 /capabilities 保留、可直接 URL 访问（帮助手册里已说明），
 * 但不再占侧栏：只把这两个高频能力功能作为独立组挂在侧栏主体。
 * 普通用户不安装、不启停：点条目直接进对应页面按积分使用。
 */
const toolNav = [
  { icon: LayoutTemplate, label: '模板中心', url: '/capabilities/templates' },
  { icon: Wrench, label: '全部工具', url: '/capabilities/tools' },
] as const

/** 侧边栏所有可点入口 —— 判定当前页要看全集，见 activeNavUrl */
const ALL_NAV_URLS = [
  ...workNav.map((i) => i.url),
  ...homeNav.map((i) => i.url),
  ...knxNav.map((i) => i.url),
  ...marketingNav.map((i) => i.url),
  ...settingsNav.map((i) => i.url),
  ...toolNav.map((i) => i.url),
] as const

/** 左下角两个按钮共用的样式：图标模式下都收成 32px 的方块 */
const footerButton =
  'flex items-center rounded-lg outline-hidden transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'

function NavItem({
  icon: Icon,
  label,
  url,
  active,
  beta = false,
}: {
  icon: React.ComponentType
  label: string
  url: string
  active: boolean
  /** 开发中的模块：在 label 后显示 Beta 标签（折叠成图标栏时隐藏） */
  beta?: boolean
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={label}>
        <GuardedLink href={url}>
          <Icon />
          <span>{label}</span>
          {beta ? <BetaBadge className="group-data-[collapsible=icon]:hidden" /> : null}
          <LinkPending className="ml-auto size-3.5" />
        </GuardedLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function AppSidebar({
  user,
  brand,
  plugins,
  ai,
  showOperatorReports = false,
}: {
  user: SidebarUser
  brand: SidebarBrand
  plugins: SidebarPlugin[]
  /** 会员与积分菜单里显示的剩余积分（AI 面板本身在右栏，由 layout 直接传参） */
  ai: { credits: number }
  /** 跨客户的使用报告只对平台运营人员显示入口 */
  showOperatorReports?: boolean
}) {
  const pathname = usePathname()
  const { state, isMobile } = useSidebar()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [membershipOpen, setMembershipOpen] = useState(false)

  // ⚠️ 只让**最长匹配**的那条亮，否则父级入口会跟子路由一起亮
  //（`/ai` 是 `/ai/image` 的前缀、`/capabilities` 是 `/capabilities/templates` 的前缀）。
  // 2026-11-14 用户报「点了能力中心的选项一直是点击状态，切换也还是」就是这个。
  // 判定逻辑在 lib/nav-active.ts，有单测盯住。
  const activeUrl = useMemo(() => activeNavUrl(pathname, ALL_NAV_URLS), [pathname])
  const isActive = (url: string) => activeUrl === url
  const collapsed = state === 'collapsed' && !isMobile
  const visibleSettingsNav = settingsNav.filter(
    (item) => showOperatorReports || item.url !== '/settings/reports',
  )
  const inSettings = visibleSettingsNav.some((item) => isActive(item.url))

  async function handleLogout() {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await fetch('/auth/logout', { method: 'POST' })
    } finally {
      window.location.assign('/login?switch=1')
    }
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip={APP_NAME}>
              <GuardedLink href="/projects">
                {/* 平台标志；副标题是当前工作区（公司）名称，公司 Logo 仍用于报价单与合同抬头 */}
                <BrandMark decorative className="size-8" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold tracking-wide">{APP_NAME}</span>
                  {/* 公司名与平台名相同（自营团队）时显示平台副标，避免上下两行重复 */}
                  <span className="truncate text-xs text-muted-foreground">
                    {brand.name && brand.name !== APP_NAME ? brand.name : APP_TAGLINE}
                  </span>
                </div>
              </GuardedLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/*
        AI 对话已从左侧栏挪到页面右侧独立一列（components/ai/ai-panel.tsx），
        左侧始终是导航。原来的「导航 / AI 对话」标签切换和折叠态的
        「展开 AI 对话侧栏」按钮随之删除：AI 栏在窄屏有自己的顶栏开关，
        宽屏则常驻，不再需要从左侧栏展开。
      */}
      <SidebarContent id="sidebar-panel">
        {/* 最常用的动作放在最显眼的位置 */}
        <SidebarGroup className="pb-0">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip="新建项目"
                className="justify-center bg-sidebar-primary font-medium text-sidebar-primary-foreground shadow-xs inset-shadow-btn hover:bg-[color-mix(in_oklch,var(--sidebar-primary),black_10%)] hover:text-sidebar-primary-foreground active:bg-sidebar-primary active:text-sidebar-primary-foreground group-data-[collapsible=icon]:justify-start dark:hover:bg-[color-mix(in_oklch,var(--sidebar-primary),white_12%)]"
              >
                <GuardedLink href="/projects/new">
                  <Plus />
                  <span>新建项目</span>
                </GuardedLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>空间设计工作台</SidebarGroupLabel>
          <SidebarMenu>
            {workNav.map((item) => (
              <NavItem
                key={item.url}
                {...item}
                active={isActive(item.url) && pathname !== '/projects/new'}
              />
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {/* HA 助手：只读查看已连接现场 Home Assistant（第一期只读模组） */}
        <SidebarGroup>
          <SidebarGroupLabel>HA 助手</SidebarGroupLabel>
          <SidebarMenu className="gap-0.5">
            {homeNav.map((item) => (
              <NavItem key={item.url} {...item} active={isActive(item.url)} />
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {/* KNX / ETS：第一期只留模块位，点进去是「建设中」空态页 */}
        <SidebarGroup>
          <SidebarGroupLabel>KNX / ETS</SidebarGroupLabel>
          <SidebarMenu className="gap-0.5">
            {knxNav.map((item) => (
              <NavItem key={item.url} {...item} active={isActive(item.url)} />
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {/* 营销工具：第一期只放名片，页面与 URL 不动 */}
        <SidebarGroup>
          <SidebarGroupLabel>营销工具</SidebarGroupLabel>
          <SidebarMenu className="gap-0.5">
            {marketingNav.map((item) => (
              <NavItem key={item.url} {...item} active={isActive(item.url)} />
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {/* 模板与工具：独立成组挂在侧栏主体。原「能力中心」分组标题入口
            与「AI 能力」组都已移除；/capabilities 总览页保留、可直接 URL 访问。 */}
        <SidebarGroup>
          <SidebarGroupLabel>模板与工具</SidebarGroupLabel>
          <SidebarMenu className="gap-0.5">
            {toolNav.map((item) => (
              <NavItem key={item.url} {...item} active={isActive(item.url)} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* 左下角：头像（账户菜单）+ 齿轮（设置菜单）；外观切换在顶栏右侧，这里不重复 */}
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col">
          <DropdownMenu>
            <Tooltip content={user.name} placement="end" isEnabled={collapsed}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`账户：${user.name}`}
                  className={cn(
                    footerButton,
                    'h-9 min-w-0 flex-1 gap-2 px-1.5 text-left group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0',
                  )}
                >
                  <Avatar name={user.name} size={32} className="text-xs font-semibold" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium group-data-[collapsible=icon]:hidden">
                    {user.name}
                  </span>
                </button>
              </DropdownMenuTrigger>
            </Tooltip>
            <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-64">
              <DropdownMenuLabel className="flex items-center gap-2.5 p-2 font-normal">
                <Avatar name={user.name} size={36} className="text-sm font-semibold" />
                <span className="grid min-w-0 flex-1 gap-0.5 leading-tight">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">{user.name}</span>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setMembershipOpen(true)}>
                <Crown />
                会员与积分
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {ai.credits.toLocaleString('zh-CN')}
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={isLoggingOut} onSelect={() => void handleLogout()}>
                <LogOut />
                {isLoggingOut ? '退出中' : '退出登录'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <Tooltip content="设置" placement={collapsed ? 'end' : 'above'}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="设置"
                  data-active={inSettings || undefined}
                  className={cn(
                    footerButton,
                    'size-8 shrink-0 justify-center text-sidebar-foreground/70 data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground',
                  )}
                >
                  <Settings className="size-4" />
                </button>
              </DropdownMenuTrigger>
            </Tooltip>
            <DropdownMenuContent
              side="top"
              align={collapsed ? 'start' : 'end'}
              sideOffset={8}
              className="w-52"
            >
              {visibleSettingsNav.map(({ icon: Icon, label, url }) => (
                <DropdownMenuItem
                  key={url}
                  asChild
                  className={cn(isActive(url) && 'bg-accent/60 font-medium')}
                >
                  <GuardedLink href={url} aria-current={isActive(url) ? 'page' : undefined}>
                    <Icon />
                    {label}
                  </GuardedLink>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarFooter>
      <SidebarRail />
      <MembershipDialog
        open={membershipOpen}
        onOpenChange={setMembershipOpen}
        credits={ai.credits}
      />
    </Sidebar>
  )
}
