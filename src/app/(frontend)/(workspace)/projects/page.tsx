import Form from 'next/form'
import Link from 'next/link'
import { FolderKanban, Plus, Search, Sparkles } from 'lucide-react'
import type { Where } from 'payload'

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
import { getPayloadClient } from '@/lib/payload'
import { countScenePoints } from '@/lib/point-count'
import { fmtDate } from '@/lib/projects'
import { yuan } from '@/lib/quotes'
import { isDemoProjectName, projectDisplayName } from '@/lib/project-name'

import { claimDemoProject } from './actions'
import { redirectToLogin } from '@/lib/login-redirect'

export const metadata = { title: pageTitle('项目') }

type Amount = { value: number; caption: string }

/** 系统为新成员发放的示例项目，名称带「【示例】」前缀 */
const isDemo = isDemoProjectName

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ q?: string; view?: string }> }) {
  const user = await appAuth.getCurrentUser()
  if (!user) return redirectToLogin()
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

  // 账号名下（含已归档）没有示例项目时，提供「领取示例项目」
  const demoCount = await payload.count({ collection: 'projects', where: { and: [{ owner: { equals: user.id } }, { name: { like: '【示例】' } }] }, overrideAccess: false, user })
  const canClaimDemo = demoCount.totalDocs === 0
  const claimButton = canClaimDemo ? (
    <form action={claimDemoProject}>
      <Button type="submit" variant="outline">
        <Sparkles className="size-4" />
        领取示例项目
      </Button>
    </form>
  ) : null

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <PageHeader
        title="项目"
        description={
          keyword ? (
            <>匹配「{keyword}」共 <span className="font-medium text-foreground tabular-nums">{projects.length}</span> 个</>
          ) : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            {claimButton}
            {/* 桌面端侧栏已有「新建项目」，这里只在手机上显示 */}
            <Button asChild className="md:hidden">
              <Link href="/projects/new"><Plus className="size-4" />新建项目</Link>
            </Button>
          </div>
        }
      />

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
            <div className="mt-2 flex items-center gap-2">
              <Button asChild size="sm"><Link href="/projects/new"><Plus className="size-4" />新建项目</Link></Button>
              {claimButton}
            </div>
          ) : null}
        </div>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4 sm:pl-6">项目</TableHead>
                <TableHead className="w-24 text-right">点位</TableHead>
                <TableHead className="hidden text-right sm:table-cell">金额</TableHead>
                <TableHead className="hidden pr-6 text-right md:table-cell">更新</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => {
                const pid = String(p.id)
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
                    <TableCell className="w-24 text-right text-sm text-muted-foreground tabular-nums">
                      {p.pointCount ? `${p.pointCount}` : '—'}
                    </TableCell>
                    <TableCell className="hidden w-36 text-right sm:table-cell">
                      {amount ? (
                        <span className="text-sm font-semibold tabular-nums">{yuan(amount.value)}</span>
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
