import Form from 'next/form'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, CircleCheck, FolderKanban, Plus, Search } from 'lucide-react'
import type { Where } from 'payload'

import { BrandMark } from '@/components/brand/brand-mark'
import { FilterTabs } from '@/components/filter-tabs'
import { PageHeader } from '@/components/page-header'
import { SearchSubmit } from '@/components/search-submit'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { relId } from '@/lib/access'
import { appAuth } from '@/lib/app-auth'
import { pageTitle } from '@/lib/brand'
import { getCompanyInfo } from '@/lib/cached-data'
import { getPayloadClient } from '@/lib/payload'
import { countScenePoints } from '@/lib/point-count'
import { fmtDate, PROJECT_SECTIONS, projectProgress } from '@/lib/projects'
import { yuan } from '@/lib/quotes'
import { cn } from '@/lib/utils'
import { isDemoProjectName, projectDisplayName } from '@/lib/project-name'

export const metadata = { title: pageTitle('项目') }

type Amount = { value: number; caption: string }

/** 系统为新成员发放的示例项目，名称带「【示例】」前缀 */
const isDemo = isDemoProjectName

const compactYuan = (n: number) => `¥${Math.round(n).toLocaleString('zh-CN')}`

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ q?: string; view?: string }> }) {
  const user = await appAuth.getCurrentUser()
  if (!user) redirect('/login')
  const { q = '', view = '' } = await searchParams
  const archived = view === 'archived'
  const keyword = q.trim()
  const payload = await getPayloadClient()

  const statusWhere: Where = archived ? { status: { equals: 'archived' } } : { status: { not_equals: 'archived' } }
  const where: Where = keyword
    ? {
        and: [
          statusWhere,
          {
            or: [
              { name: { like: keyword } },
              { customerName: { like: keyword } },
              { community: { like: keyword } },
              { address: { like: keyword } },
              { customerPhone: { like: keyword } },
            ],
          },
        ],
      }
    : statusWhere

  const [result, activeCount, archivedCount] = await Promise.all([
    payload.find({
      collection: 'projects',
      where,
      depth: 0,
      limit: 500,
      sort: '-updatedAt',
      user,
      overrideAccess: false,
      // 列表只取显示用的字段，不读取点位图
      select: { name: true, customerName: true, community: true, status: true, pointCount: true, updatedAt: true },
    }),
    payload.count({ collection: 'projects', where: { status: { not_equals: 'archived' } }, user, overrideAccess: false }),
    payload.count({ collection: 'projects', where: { status: { equals: 'archived' } }, user, overrideAccess: false }),
  ])
  const projects = result.docs
  const ids = projects.map((p) => p.id)

  // 还没有点位数统计的旧项目：一次查询补算（下次保存点位图时会写入）
  const legacy = projects.filter((p) => p.pointCount == null).map((p) => p.id)
  if (legacy.length) {
    const maps = await payload.find({ collection: 'projects', where: { id: { in: legacy } }, depth: 0, limit: legacy.length, user, overrideAccess: false, select: { pointMap: true } })
    const counts = new Map(maps.docs.map((d) => [d.id, countScenePoints(d.pointMap)]))
    for (const p of projects) if (p.pointCount == null) p.pointCount = counts.get(p.id) ?? 0
  }

  // 每个项目的报价数量、要展示的金额和合同状态：两次批量查询，不按项目逐个查
  const [quotes, contracts] = ids.length
    ? await Promise.all([
        payload.find({
          collection: 'quotes',
          where: { project: { in: ids } },
          depth: 0,
          limit: 2000,
          sort: '-updatedAt',
          user,
          overrideAccess: false,
          select: { project: true, total: true, status: true },
        }),
        payload.find({
          collection: 'contracts',
          where: { project: { in: ids } },
          depth: 0,
          limit: 500,
          user,
          overrideAccess: false,
          select: { project: true, status: true, amount: true },
        }),
      ])
    : [{ docs: [] }, { docs: [] }]

  const quoteStats = new Map<string, { count: number; latest: number; accepted: number | null }>()
  for (const quote of quotes.docs) {
    const pid = relId(quote.project)
    if (!pid) continue
    const stat = quoteStats.get(pid) ?? { count: 0, latest: quote.total ?? 0, accepted: null }
    stat.count++
    if (quote.status === 'accepted' && stat.accepted === null) stat.accepted = quote.total ?? 0
    quoteStats.set(pid, stat)
  }
  const contractOf = new Map(contracts.docs.map((c) => [relId(c.project), c]))

  const amountOf = (pid: string): Amount | null => {
    const contract = contractOf.get(pid)
    if (contract) return { value: contract.amount ?? 0, caption: '合同金额' }
    const stat = quoteStats.get(pid)
    if (!stat) return null
    return stat.accepted !== null ? { value: stat.accepted, caption: '已确认报价' } : { value: stat.latest, caption: '最新报价' }
  }

  const href = (patch: Record<string, string>) => {
    const params = new URLSearchParams({ q, view, ...patch })
    for (const [k, v] of [...params]) if (!v) params.delete(k)
    const s = params.toString()
    return s ? `/projects?${s}` : '/projects'
  }

  // 概览数字：只在「进行中、未搜索」时展示，口径与下方列表一致
  const overview = !archived && !keyword && projects.length > 0
  const totals = { amount: 0, points: 0, signed: 0 }
  if (overview) {
    for (const p of projects) {
      const pid = String(p.id)
      totals.amount += amountOf(pid)?.value ?? 0
      totals.points += p.pointCount ?? 0
      if (contractOf.get(pid)?.status === 'signed') totals.signed++
    }
  }

  // 新成员上手引导：还没有自己的项目时显示，建好第一个项目后自动消失
  const demo = !archived && !keyword ? projects.find((p) => isDemo(p.name)) : undefined
  const isNewMember = !archived && !keyword && archivedCount.totalDocs === 0 && projects.every((p) => isDemo(p.name))
  const company = isNewMember ? await getCompanyInfo(user.id) : null
  const steps = [
    ...(demo
      ? [{ title: '浏览示例项目', description: '查看三层别墅点位与报价', href: `/projects/${demo.id}/point-map`, done: false }]
      : []),
    { title: '完善公司抬头', description: '用于报价单与合同页眉', href: '/settings', done: Boolean(company?.isCustom) },
    { title: '新建首个项目', description: '录入客户信息并布置点位', href: '/projects/new', done: false },
  ]

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <PageHeader
        title="项目"
        description={
          overview ? (
            <span className="tabular-nums">
              共 {totals.points.toLocaleString('zh-CN')} 个点位 · 已签合同 {totals.signed} 份 · 合计 <span className="font-medium text-foreground">{compactYuan(totals.amount)}</span>
            </span>
          ) : keyword ? (
            <>匹配「{keyword}」共 <span className="font-medium text-foreground tabular-nums">{projects.length}</span> 个</>
          ) : undefined
        }
        actions={
          <Button asChild>
            <Link href="/projects/new"><Plus className="size-4" />新建项目</Link>
          </Button>
        }
      />

      {isNewMember ? (
        <Card className="gap-3 px-5 py-4 ring-primary/20">
          <div className="flex items-center gap-2.5">
            <BrandMark decorative className="size-6" />
            <p className="text-sm font-semibold">快速上手</p>
          </div>
          <ol className={cn('grid gap-2', steps.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2')}>
            {steps.map((s, i) => (
              <li key={s.title}>
                <Link
                  href={s.href}
                  className="group flex h-full items-start gap-3 rounded-lg border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-accent/50"
                >
                  {s.done ? (
                    <CircleCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-label="已完成" />
                  ) : (
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-primary/40 text-xs font-medium text-primary">
                      {i + 1}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm font-medium', s.done && 'text-muted-foreground line-through')}>{s.title}</span>
                    <span className="block text-xs text-muted-foreground">{s.description}</span>
                  </span>
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          label="项目状态"
          items={[
            { key: 'active', label: '进行中', count: activeCount.totalDocs, href: href({ view: '' }), active: !archived },
            { key: 'archived', label: '已归档', count: archivedCount.totalDocs, href: href({ view: 'archived' }), active: archived },
          ]}
        />
        <Form action="/projects" className="flex w-full items-center gap-2 sm:w-auto">
          {archived ? <input type="hidden" name="view" value="archived" /> : null}
          <div className="relative flex-1 sm:w-72 sm:flex-none">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={q} placeholder="搜索项目、客户、小区或电话" aria-label="搜索项目" className="pl-9" />
          </div>
          <SearchSubmit />
        </Form>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-16 text-center">
          <span className="mb-1 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FolderKanban className="size-6" />
          </span>
          <p className="font-medium">{keyword ? '没有找到符合条件的项目' : archived ? '还没有归档的项目' : '还没有进行中的项目'}</p>
          <p className="text-sm text-muted-foreground">
            {keyword ? '请尝试其他关键词' : archived ? '交付完成的项目可在「归档」页移入此处' : '创建项目后即可上传户型图并布置点位'}
          </p>
          {!keyword && !archived ? (
            <Button asChild size="sm" className="mt-2"><Link href="/projects/new"><Plus className="size-4" />新建项目</Link></Button>
          ) : null}
        </div>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4 sm:pl-6">项目</TableHead>
                <TableHead>进度</TableHead>
                <TableHead className="hidden text-right sm:table-cell">金额</TableHead>
                <TableHead className="hidden pr-6 text-right md:table-cell">更新</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => {
                const pid = String(p.id)
                const stat = quoteStats.get(pid)
                const progress = projectProgress({ status: p.status, pointCount: p.pointCount, quoteCount: stat?.count ?? 0, contractStatus: contractOf.get(pid)?.status })
                const amount = amountOf(pid)
                return (
                  <TableRow key={pid} className="relative">
                    <TableCell className="max-w-0 pl-4 sm:pl-6">
                      <div className="flex min-w-0 items-center gap-2">
                        <Link href={`/projects/${pid}`} className="truncate font-medium after:absolute after:inset-0 hover:underline">
                          {projectDisplayName(p.name)}
                        </Link>
                        {isDemo(p.name) ? <Badge variant="secondary" className="shrink-0">示例</Badge> : null}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {[p.customerName, p.community].filter(Boolean).join(' · ') || '未填写客户'}
                      </div>
                    </TableCell>
                    <TableCell className="w-44">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-sm">
                          {progress.label}
                          <span className="ml-1.5 text-xs text-muted-foreground">{progress.detail}</span>
                        </span>
                        {/* 五个板块的迷你进度，由数据自动推算 */}
                        <span className="flex w-28 gap-0.5" aria-hidden="true">
                          {PROJECT_SECTIONS.map((s, i) => (
                            <span key={s.key} className={cn('h-1 flex-1 rounded-full', i <= progress.index ? 'bg-primary' : 'bg-muted')} />
                          ))}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden w-36 text-right sm:table-cell">
                      {amount ? (
                        <>
                          <div className="text-sm font-semibold tabular-nums">{yuan(amount.value)}</div>
                          <div className="text-xs text-muted-foreground">{amount.caption}</div>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden w-28 pr-6 text-right text-sm text-muted-foreground tabular-nums md:table-cell">{fmtDate(p.updatedAt)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </section>
  )
}
