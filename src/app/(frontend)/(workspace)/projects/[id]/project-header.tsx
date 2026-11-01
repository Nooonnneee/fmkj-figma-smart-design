'use client'

import { useSelectedLayoutSegment } from 'next/navigation'
import { Archive, ChevronRight } from 'lucide-react'

import { GuardedLink } from '@/components/guarded-link'
import { ThemeMenu } from '@/components/site-header'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import type { ProjectRole } from '@/lib/project-access'
import { PROJECT_SECTIONS, sectionHref } from '@/lib/projects'
import { cn } from '@/lib/utils'

import { ProjectShareDialog } from './project-share-dialog'

/**
 * 项目顶栏：项目名称 + 五个板块（信息、点位、报价、合同、归档）。
 * 替代全局顶栏，桌面端一行 48px；窄屏时板块换到第二行。
 * 有未保存修改时，切换板块会先自动保存（见 leave-guard）。
 */
export function ProjectHeader({
  projectId,
  name,
  demo = false,
  subtitle,
  archived,
  role = 'owner',
  collaboratorCount = 0,
}: {
  projectId: string
  name: string
  demo?: boolean
  subtitle: string
  archived: boolean
  role?: ProjectRole
  collaboratorCount?: number
}) {
  const segment = useSelectedLayoutSegment()
  const active = PROJECT_SECTIONS.find((s) => s.segment === segment)?.key ?? 'info'

  return (
    <header className="project-header sticky top-0 z-40 -mx-4 -mt-5 border-b bg-background md:-mx-8 md:-mt-7">
      <div className="flex flex-wrap items-center md:h-12 md:flex-nowrap">
        <div className="flex h-12 min-w-0 flex-1 items-center gap-2 pl-3 md:flex-none md:pl-4">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
          <Separator orientation="vertical" className="data-vertical:h-5 data-vertical:self-center" />
          <GuardedLink href="/projects" className="hidden shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline">
            项目
          </GuardedLink>
          <ChevronRight aria-hidden className="hidden size-3.5 shrink-0 text-muted-foreground/60 sm:block" />
          <div className="min-w-0 md:max-w-[16rem] xl:max-w-[22rem]">
            <div className="flex min-w-0 items-center gap-1.5">
              <h1 className="truncate text-sm leading-tight font-semibold" title={name}>{name}</h1>
              {demo ? <Badge variant="secondary" className="h-4 shrink-0 px-1.5 text-[0.6875rem]">示例</Badge> : null}
            </div>
            {subtitle ? <p className="truncate text-xs leading-tight text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        <div className="flex h-12 items-center gap-1.5 pr-3 md:order-last md:ml-auto md:pr-4">
          {role !== 'owner' ? (
            <Badge variant={role === 'edit' ? 'outline' : 'secondary'} className="text-xs">
              {role === 'edit' ? '协作 · 可编辑' : '协作 · 仅查看'}
            </Badge>
          ) : null}
          {archived ? (
            <Badge variant="secondary">
              <Archive className="size-3" />
              已归档
            </Badge>
          ) : null}
          <ProjectShareDialog
            projectId={projectId}
            projectName={name}
            initialRole={role}
            initialCollaboratorCount={collaboratorCount}
          />
          <ThemeMenu />
        </div>
        <nav
          aria-label="项目板块"
          className="order-last flex h-10 w-full items-stretch overflow-x-auto border-t px-1 [scrollbar-width:none] md:order-none md:ml-6 md:h-full md:w-auto md:border-t-0 md:px-0"
        >
          {PROJECT_SECTIONS.map((s) => {
            const isActive = s.key === active
            return (
              <GuardedLink
                key={s.key}
                href={sectionHref(projectId, s.key)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative inline-flex shrink-0 items-center px-3 text-sm transition-colors duration-150',
                  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset',
                  isActive
                    ? 'font-medium text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {s.label}
              </GuardedLink>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
