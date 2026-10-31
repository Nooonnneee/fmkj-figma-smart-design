import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { relId } from '@/lib/access'
import { getProjectOwnerOptions } from '@/lib/cached-data'
import { contractStatusLabel } from '@/lib/contracts'
import { fmtDate, PROJECT_SECTIONS, projectProgress, sectionHref, type ProjectSectionKey } from '@/lib/projects'
import { yuan } from '@/lib/quotes'
import { cn } from '@/lib/utils'

import { ProjectForm } from '../project-form'
import { getProject, getProjectDeals } from './project-data'

/** 信息：项目进度（由数据自动得出）+ 下一步 + 项目资料。 */
export default async function ProjectInfoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [{ project, role, archived, readOnly }, { quotes, contract }] = await Promise.all([getProject(id), getProjectDeals(id)])
  const pid = String(project.id)
  // 仅项目负责人（owner）可以看到并修改「负责人」下拉框；协作者只编辑项目资料，不能篡改负责人
  const ownerOptions = role === 'owner' ? await getProjectOwnerOptions(project as never) : undefined
  const points = project.pointCount ?? 0
  const progress = projectProgress({ status: project.status, pointCount: points, quoteCount: quotes.length, contractStatus: contract?.status })

  const steps: Record<ProjectSectionKey, { done: boolean; note: string }> = {
    info: {
      done: Boolean(project.customerName || project.community),
      note: [project.customerName, project.customerPhone].filter(Boolean).join(' · ') || '补充客户信息',
    },
    points: { done: points > 0, note: points ? `${points} 个点位` : '还没有布置' },
    quotes: { done: quotes.length > 0, note: quotes.length ? `${quotes.length} 份 · 最新 ${yuan(quotes[0].total)}` : '还没有报价' },
    contract: {
      done: contract?.status === 'signed',
      note: contract ? `${contractStatusLabel(contract.status)} · ${yuan(contract.amount)}` : '还没有合同',
    },
    archive: { done: archived, note: archived ? `${fmtDate(project.archivedAt)} 归档` : '交付后归档' },
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <section aria-labelledby="progress-title" className="rounded-xl bg-card shadow-sm ring-1 ring-foreground/5 dark:ring-foreground/10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 id="progress-title" className="text-base font-semibold">进度</h2>
            <p className="text-sm text-muted-foreground">{progress.next ? `下一步：${progress.next.label}` : '项目已归档，资料只读保存'}</p>
          </div>
          {progress.next ? (
            <Button asChild>
              <Link href={sectionHref(pid, progress.next.section)}>
                {progress.next.label}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : null}
        </div>
        <ol className="grid grid-cols-1 sm:grid-cols-5">
          {PROJECT_SECTIONS.map((s, i) => {
            const step = steps[s.key]
            const current = progress.next?.section === s.key
            return (
              <li key={s.key} className="border-b last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0">
                <Link
                  href={sectionHref(pid, s.key)}
                  aria-current={current ? 'step' : undefined}
                  className="flex h-full items-start gap-2.5 px-5 py-4 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:flex-col sm:gap-2 sm:px-4"
                >
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums',
                      step.done ? 'border-primary bg-primary text-primary-foreground' : current ? 'border-primary text-primary ring-3 ring-primary/15' : 'text-muted-foreground',
                    )}
                  >
                    {step.done ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className={cn('block text-sm font-medium', !step.done && !current && 'text-muted-foreground')}>{s.label}</span>
                    <span className="block truncate text-xs text-muted-foreground" title={step.note}>{step.note}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      </section>

      <ProjectForm
        owners={ownerOptions}
        readOnly={readOnly}
        initial={{
          id: pid,
          name: project.name,
          customerName: project.customerName,
          customerPhone: project.customerPhone,
          community: project.community,
          address: project.address,
          platform: project.platform,
          budget: project.budget,
          notes: project.notes,
          owner: relId(project.owner),
        }}
      />
    </div>
  )
}
