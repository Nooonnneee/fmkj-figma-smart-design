import Link from 'next/link'
import { ArrowRight, Check, MapPin, Phone } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { relId } from '@/lib/access'
import { getProjectOwnerOptions } from '@/lib/cached-data'
import { getMembershipContext } from '@/lib/membership-policy'
import { getPluginFlags } from '@/plugins/state'
import { contractStatusLabel } from '@/lib/contracts'
import { resolveFinalQuote } from '@/lib/deliverables'
import { fmtDate, PROJECT_SECTIONS, projectProgress, sectionHref, type ProjectSectionKey } from '@/lib/projects'
import { yuan } from '@/lib/quotes'
import { cn } from '@/lib/utils'

import { ProjectForm } from '../project-form'
import { DeleteProject } from './delete-project'
import { ProjectToolbox } from './project-toolbox'
import { getProject, getProjectDeals } from './project-data'

/** 信息：项目进度（由数据自动得出）+ 下一步 + 项目资料。 */
export default async function ProjectInfoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [{ user, project, role, archived, readOnly }, { quotes, contract }] = await Promise.all([getProject(id), getProjectDeals(id)])
  const pid = String(project.id)
  // 仅项目负责人（owner）可以看到并修改「负责人」下拉框；协作者只编辑项目资料，不能篡改负责人
  const [ownerOptions, flags, access] = await Promise.all([
    role === 'owner' ? getProjectOwnerOptions(project as never) : Promise.resolve(undefined),
    getPluginFlags(relId(project.owner) || user.id),
    getMembershipContext(user),
  ])
  const points = project.pointCount ?? 0
  const finalQuote = resolveFinalQuote(quotes, { contractQuoteId: relId(contract?.quote), finalQuoteId: relId(project.finalQuote) }).quote
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
      {/* 概览：客户、地址和关键数字，一眼看清项目 */}
      <section aria-label="项目概览" className="overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-foreground/5 dark:ring-foreground/10">
        <div className="flex flex-wrap items-start gap-4 bg-linear-to-br from-primary/8 via-transparent to-transparent px-5 py-5">
          <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
            {(project.customerName || project.name || '项').slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg leading-tight font-semibold">{project.customerName || '未填写客户'}</p>
              {project.platform ? <Badge variant="secondary">{project.platform}</Badge> : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {project.customerPhone ? (
                <Link href={`tel:${project.customerPhone}`} className="inline-flex items-center gap-1.5 tabular-nums transition-colors hover:text-foreground">
                  <Phone className="size-3.5" />
                  {project.customerPhone}
                </Link>
              ) : null}
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <MapPin className="size-3.5 shrink-0" />
                <span className="truncate">{[project.community, project.address].filter(Boolean).join(' ') || '未填写地址'}</span>
              </span>
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-2 border-t sm:grid-cols-4">
          {[
            { label: '预算', value: project.budget ? yuan(project.budget) : '—' },
            { label: '点位', value: points ? `${points} 个` : '—' },
            { label: quotes.length > 1 ? '定稿报价' : '报价', value: finalQuote ? yuan(finalQuote.total) : '—' },
            { label: '合同', value: contract ? contractStatusLabel(contract.status) : '—' },
          ].map((s, i) => (
            <div key={s.label} className={cn('px-5 py-3.5', i % 2 === 1 && 'border-l', i >= 2 && 'border-t sm:border-t-0', i === 2 && 'sm:border-l')}>
              <dt className="text-xs text-muted-foreground">{s.label}</dt>
              <dd className="mt-1 truncate text-base font-semibold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="progress-title" className="rounded-xl bg-card shadow-sm ring-1 ring-foreground/5 dark:ring-foreground/10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5">
          <div className="flex items-baseline gap-2.5">
            <h2 id="progress-title" className="text-base font-semibold">进度</h2>
            {!progress.next ? <span className="text-xs text-muted-foreground">已归档（只读）</span> : null}
          </div>
          {progress.next ? (
            <Button asChild size="sm">
              <Link href={sectionHref(pid, progress.next.section)}>
                {progress.next.label}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : null}
        </div>
        <ol className="grid grid-cols-5">
          {PROJECT_SECTIONS.map((s, i) => {
            const step = steps[s.key]
            const current = progress.next?.section === s.key
            return (
              <li key={s.key} className="border-r last:border-r-0">
                <Link
                  href={sectionHref(pid, s.key)}
                  aria-current={current ? 'step' : undefined}
                  className="flex h-full flex-col items-center gap-1.5 px-1 py-3 text-center transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:items-start sm:gap-2 sm:px-4 sm:py-4 sm:text-left"
                >
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums',
                      step.done ? 'border-primary bg-primary text-primary-foreground' : current ? 'border-primary text-primary ring-3 ring-primary/15' : 'text-muted-foreground',
                    )}
                  >
                    {step.done ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <span className="w-full min-w-0">
                    <span className={cn('block text-sm font-medium', !step.done && !current && 'text-muted-foreground')}>{s.label}</span>
                    <span className="hidden truncate text-xs text-muted-foreground sm:block" title={step.note}>{step.note}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
        {/* 窄屏只显示当前一步的说明，避免五行说明把表单挤到第二屏 */}
        {progress.next ? (
          <p className="border-t px-5 py-2.5 text-xs text-muted-foreground sm:hidden">
            下一步 · {PROJECT_SECTIONS.find((s) => s.key === progress.next?.section)?.label}：{steps[progress.next.section].note}
          </p>
        ) : null}
      </section>

      <ProjectToolbox projectId={pid} flags={flags} membership={access.membership} strict={access.strict} />

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
      {role === 'owner' ? <DeleteProject projectId={pid} projectName={project.name} quoteCount={quotes.length} /> : null}
    </div>
  )
}
