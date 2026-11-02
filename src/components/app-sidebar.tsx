"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import {
  Blocks,
  Bot,
  ChevronsUpDown,
  Crown,
  FolderKanban,
  LayoutGrid,
  LogOut,
  MessageSquareText,
  PackageSearch,
  Palette,
  Plus,
  Settings,
} from "lucide-react"

import type { AiModelOption, AiProjectContext } from "@/components/ai/ai-elements"
import { AppearanceMenuItems } from "@/components/appearance-menu"
import { BrandMark } from "@/components/brand/brand-mark"
import { GuardedLink } from "@/components/guarded-link"
import { LinkPending } from "@/components/link-pending"
import { MembershipDialog } from "@/components/workspace-dialogs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
} from "@/components/ui/sidebar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { APP_NAME, APP_TAGLINE } from "@/lib/brand"
import type { PluginId } from "@/plugins/types"
import { isDemoProjectName, projectDisplayName, projectInitial } from "@/lib/project-name"

// AI 对话面板只在切到「AI 对话」时才加载，不拖慢其他页面的首屏
const AiSidebarDock = dynamic(() => import("@/components/ai/ai-sidebar-dock").then((m) => m.AiSidebarDock), { ssr: false })

export type SidebarUser = { name: string; email: string; membershipBadge?: string }
export type SidebarBrand = { name: string; logo: string | null }
export type SidebarPlugin = {
  id: PluginId
  name: string
  description: string
  status: "ready" | "coming-soon"
  enabled: boolean
  where: string
  provides: string[]
}

/** 日常工作：项目 → 产品 → AI */
const workNav = [
  { icon: FolderKanban, label: "项目", url: "/projects" },
  { icon: PackageSearch, label: "产品库", url: "/products" },
] as const

/** 扩展与账户：低频入口，放在底部 */
const moreNav = [
  { icon: Blocks, label: "插件市场", url: "/plugins" },
  { icon: Crown, label: "会员与积分", url: "/membership" },
  { icon: Settings, label: "设置", url: "/settings" },
] as const

const RECENT_LIMIT = 5

const initials = (name: string) => name.trim().slice(0, 1).toUpperCase() || "我"

function NavItem({ icon: Icon, label, url, active }: { icon: React.ComponentType; label: string; url: string; active: boolean }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={label}>
        <GuardedLink href={url}>
          <Icon />
          <span>{label}</span>
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
  projects,
  ai,
}: {
  user: SidebarUser
  brand: SidebarBrand
  plugins: SidebarPlugin[]
  projects: AiProjectContext[]
  ai: { credits: number; configured: boolean; models?: AiModelOption[] }
}) {
  const pathname = usePathname()
  const { state, setOpen, widthPx } = useSidebar()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [mode, setMode] = useState<"nav" | "chat">("nav")
  const [membershipOpen, setMembershipOpen] = useState(false)

  const aiCopilotEnabled = plugins.some((p) => p.id === "ai-copilot" && p.status === "ready" && p.enabled)
  const effectiveMode = aiCopilotEnabled && state === "expanded" ? mode : "nav"
  const recent = projects.slice(0, RECENT_LIMIT)
  const isActive = (url: string) => pathname === url || pathname.startsWith(`${url}/`)

  async function handleLogout() {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await fetch("/auth/logout", { method: "POST" })
    } finally {
      window.location.assign("/login?switch=1")
    }
  }

  return (
    <Sidebar
      collapsible="icon"
      style={
        effectiveMode === "chat" && !widthPx
          ? // AI 对话比导航宽一些便于阅读，但随屏幕宽度收放，避免挤压右侧工作区（1280 宽约 19rem，1440 宽约 21.5rem）
            ({ "--sidebar-width": "clamp(18rem, 24vw, 22rem)" } as React.CSSProperties)
          : undefined
      }
    >
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
                  <span className="truncate text-xs text-muted-foreground">{brand.name && brand.name !== APP_NAME ? brand.name : APP_TAGLINE}</span>
                </div>
              </GuardedLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* 侧边栏模式：导航 | AI 对话（仅在启用「AI 对话侧栏（高级）」插件时显示） */}
        {aiCopilotEnabled ? (
          <>
            <Tabs
              value={effectiveMode}
              onValueChange={(v) => setMode(v === "chat" ? "chat" : "nav")}
              className="group-data-[collapsible=icon]:hidden"
            >
              <TabsList className="w-full">
                <TabsTrigger value="nav" aria-controls="sidebar-panel" className="text-xs">
                  <LayoutGrid className="size-3.5" />
                  导航
                </TabsTrigger>
                <TabsTrigger value="chat" aria-controls="sidebar-panel" className="text-xs">
                  <MessageSquareText className="size-3.5" />
                  AI 对话
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* 折叠为图标模式时，提供一键展开到 AI 对话侧栏的按钮 */}
            <SidebarMenu className="hidden group-data-[collapsible=icon]:flex">
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="展开 AI 对话侧栏"
                  onClick={() => {
                    setOpen(true)
                    setMode("chat")
                  }}
                >
                  <MessageSquareText />
                  <span>AI 对话</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </>
        ) : null}
      </SidebarHeader>

      {effectiveMode === "chat" ? (
        <div id="sidebar-panel" className="flex min-h-0 flex-1 flex-col">
          <AiSidebarDock plugins={plugins.filter((p) => p.id !== "ai-copilot")} projects={projects} credits={ai.credits} configured={ai.configured} models={ai.models} />
        </div>
      ) : (
        <>
          <SidebarContent id="sidebar-panel">
            {/* 最常用的动作放在最显眼的位置 */}
            <SidebarGroup className="pb-0">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip="新建项目"
                    className="bg-sidebar-primary font-medium text-sidebar-primary-foreground shadow-xs hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground active:bg-sidebar-primary/90 active:text-sidebar-primary-foreground"
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
              <SidebarGroupLabel>工作台</SidebarGroupLabel>
              <SidebarMenu>
                {workNav.map((item) => (
                  <NavItem key={item.url} {...item} active={isActive(item.url) && pathname !== "/projects/new"} />
                ))}
                {aiCopilotEnabled ? <NavItem icon={Bot} label="AI 对话" url="/ai" active={isActive("/ai")} /> : null}
              </SidebarMenu>
            </SidebarGroup>

            {recent.length > 0 ? (
              <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                <SidebarGroupLabel>最近项目</SidebarGroupLabel>
                <SidebarMenu>
                  {recent.map((p) => (
                    <SidebarMenuItem key={p.id}>
                      <SidebarMenuButton asChild size="sm" isActive={isActive(`/projects/${p.id}`)} className="text-sidebar-foreground/80">
                        <GuardedLink href={`/projects/${p.id}`}>
                          <span aria-hidden className="flex size-4 shrink-0 items-center justify-center rounded-sm bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
                            {projectInitial(p.name)}
                          </span>
                          <span className="truncate">{projectDisplayName(p.name)}</span>
                          {isDemoProjectName(p.name) ? <span className="ml-auto shrink-0 text-xs text-muted-foreground">示例</span> : null}
                        </GuardedLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            ) : null}

            <SidebarGroup className="mt-auto">
              <SidebarGroupLabel>扩展与账户</SidebarGroupLabel>
              <SidebarMenu>
                <NavItem icon={Blocks} label="插件市场" url="/plugins" active={isActive("/plugins")} />
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="会员与积分" isActive={isActive("/membership")} onClick={() => setMembershipOpen(true)}>
                    <Crown />
                    <span>会员与积分</span>
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">{ai.credits}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <NavItem icon={Settings} label="设置" url="/settings" active={isActive("/settings")} />
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      size="lg"
                      tooltip={user.name}
                      className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    >
                      <Avatar className="size-8 rounded-lg">
                        <AvatarFallback className="rounded-lg bg-sidebar-primary/10 font-medium text-sidebar-primary">{initials(user.name)}</AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="flex items-center gap-1.5 truncate font-semibold">
                          <span className="truncate">{user.name}</span>
                          {user.membershipBadge ? (
                            <Badge variant="outline" className="h-4 px-1.5 text-xs">
                              {user.membershipBadge}
                            </Badge>
                          ) : null}
                        </span>
                        <span className="truncate text-xs text-muted-foreground tabular-nums">
                          {ai.credits.toLocaleString("zh-CN")} 积分
                        </span>
                      </div>
                      <ChevronsUpDown className="ml-auto size-4" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                    side="top"
                    sideOffset={4}
                  >
                    <DropdownMenuLabel className="p-0 font-normal">
                      <div className="grid px-1 py-1.5 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">{user.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem onSelect={() => setMembershipOpen(true)}>
                        <Crown />
                        会员与积分
                        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{ai.credits}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <GuardedLink href="/plugins">
                          <Blocks />
                          插件市场
                        </GuardedLink>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <GuardedLink href="/settings">
                          <Settings />
                          公司与账户设置
                        </GuardedLink>
                      </DropdownMenuItem>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <Palette />
                          外观
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-44">
                          <AppearanceMenuItems />
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled={isLoggingOut} onSelect={() => void handleLogout()}>
                      <LogOut />
                      {isLoggingOut ? "退出中" : "退出登录"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </>
      )}
      <SidebarRail />
      <MembershipDialog
        open={membershipOpen}
        onOpenChange={setMembershipOpen}
        membershipBadge={user.membershipBadge}
        credits={ai.credits}
      />
    </Sidebar>
  )
}
