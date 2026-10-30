"use client"

import { useState } from "react"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  Blocks,
  Bot,
  Cable,
  ChevronsUpDown,
  ClipboardList,
  FileUp,
  FolderKanban,
  KeyRound,
  LayoutGrid,
  LogOut,
  MessageSquareText,
  PackageCheck,
  PackageSearch,
  Palette,
  Presentation,
  ScanSearch,
  Settings,
  Sparkles,
  Wand2,
  Wrench,
  type LucideIcon,
} from "lucide-react"

import type { AiProjectContext } from "@/components/ai/ai-elements"
import { AiSidebarDock } from "@/components/ai/ai-sidebar-dock"
import { GuardedLink } from "@/components/guarded-link"
import { LinkPending } from "@/components/link-pending"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import { APP_TAGLINE, brandInitials } from "@/lib/brand"
import { cn } from "@/lib/utils"
import type { PluginId } from "@/plugins/types"

export type SidebarUser = { name: string; email: string }
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

const baseNav = [
  { icon: FolderKanban, label: "项目", url: "/projects" },
  { icon: PackageSearch, label: "产品库", url: "/products" },
  { icon: Blocks, label: "插件", url: "/plugins" },
  { icon: Settings, label: "设置", url: "/settings" },
] as const

const PLUGIN_ICONS: Record<PluginId, LucideIcon> = {
  "ai-copilot": Bot,
  "doc-styles": Palette,
  proposal: Presentation,
  "room-insights": Sparkles,
  "smart-select": Wand2,
  "ai-import": ScanSearch,
  "dwg-import": FileUp,
  "site-survey": ClipboardList,
  "wiring-schedule": Cable,
  procurement: PackageCheck,
  "scene-handover": KeyRound,
  "after-sales": Wrench,
}

const initials = (name: string) => name.trim().slice(0, 1).toUpperCase() || "我"

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
  ai: { credits: number; configured: boolean }
}) {
  const pathname = usePathname()
  const { state, setOpen } = useSidebar()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [mode, setMode] = useState<"nav" | "chat">("nav")

  const aiCopilotEnabled = plugins.some((p) => p.id === "ai-copilot" && p.status === "ready" && p.enabled)
  const effectiveMode = aiCopilotEnabled && state === "expanded" ? mode : "nav"

  async function handleLogout() {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await fetch("/auth/logout", { method: "POST" })
    } finally {
      window.location.assign("/login")
    }
  }

  return (
    <Sidebar
      collapsible="icon"
      style={
        effectiveMode === "chat"
          ? ({ "--sidebar-width": "24rem" } as React.CSSProperties)
          : undefined
      }
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="group-data-[collapsible=icon]:px-1.5">
              <GuardedLink href="/projects">
                {/* 字标：设置里上传了 Logo 就用 Logo，否则用名称缩写 */}
                <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sidebar-primary text-[11px] font-bold tracking-tight text-sidebar-primary-foreground">
                  {brand.logo ? (
                    <Image src={brand.logo} alt="" width={32} height={32} className="size-full bg-white object-contain p-0.5" />
                  ) : (
                    brandInitials(brand.name)
                  )}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{brand.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{APP_TAGLINE}</span>
                </div>
              </GuardedLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Figma Make 式侧边栏模式切换：导航 | AI 对话（仅在启用「AI 对话侧栏（高级）」插件时显示） */}
        {aiCopilotEnabled ? (
          <>
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-sidebar-border bg-muted/50 p-0.5 group-data-[collapsible=icon]:hidden">
              <button
                type="button"
                onClick={() => setMode("nav")}
                className={cn(
                  "inline-flex h-7 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors",
                  effectiveMode === "nav"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <LayoutGrid className="size-3.5" />
                <span>导航</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("chat")}
                className={cn(
                  "inline-flex h-7 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors",
                  effectiveMode === "chat"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <MessageSquareText className="size-3.5" />
                <span>AI 对话</span>
              </button>
            </div>

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
        <div className="flex min-h-0 flex-1 flex-col">
          <AiSidebarDock plugins={plugins.filter((p) => p.id !== "ai-copilot")} projects={projects} credits={ai.credits} configured={ai.configured} />
        </div>
      ) : (
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {baseNav.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={item.url === "/plugins" ? pathname === "/plugins" : pathname.startsWith(item.url)}
                    tooltip={item.label}
                  >
                    <GuardedLink href={item.url}>
                      <item.icon />
                      <span>{item.label}</span>
                      <LinkPending className="ml-auto size-3.5" />
                    </GuardedLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {aiCopilotEnabled ? (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith("/ai")} tooltip="AI 对话工作台">
                    <GuardedLink href="/ai">
                      <Bot />
                      <span>AI 对话</span>
                      <LinkPending className="ml-auto size-3.5" />
                    </GuardedLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
            </SidebarMenu>
          </SidebarGroup>

          <SidebarSeparator />

          <SidebarGroup>
            <SidebarGroupLabel>插件</SidebarGroupLabel>
            <SidebarMenu>
              {plugins.map((p) => {
                const Icon = PLUGIN_ICONS[p.id] ?? Blocks
                const pending = p.status === "coming-soon"
                const stateText = pending ? "待开发" : p.enabled ? "已开启" : "已关闭"
                const href = `/plugins/${p.id}`
                return (
                  <SidebarMenuItem key={p.id}>
                    <SidebarMenuButton
                      asChild
                      size="sm"
                      isActive={pathname === href}
                      tooltip={`${p.name}（${stateText}）`}
                      className="pr-14"
                    >
                      <GuardedLink href={href} className={cn(pending && "text-muted-foreground")}>
                        <Icon />
                        <span>{p.name}</span>
                      </GuardedLink>
                    </SidebarMenuButton>
                    <SidebarMenuBadge className={cn("text-[11px] font-normal", pending || !p.enabled ? "text-muted-foreground" : "text-success")}>
                      {stateText}
                    </SidebarMenuBadge>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      )}

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">{initials(user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
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
                <DropdownMenuItem disabled={isLoggingOut} onSelect={() => void handleLogout()}>
                  <LogOut />
                  {isLoggingOut ? "退出中" : "退出登录"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
