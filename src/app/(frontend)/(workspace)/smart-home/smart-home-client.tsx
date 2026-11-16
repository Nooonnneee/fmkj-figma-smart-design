'use client'

/**
 * 智能家居总览页的客户端交互区（SM-2）。
 *
 * 数据由 Server Component 拉好整包传进来（`data` 是纯结构的判别联合），
 * 这里只做纯客户端裁剪：实体搜索 + 按类型筛选 + 空态兜底 + 各区块渲染。
 * 不下发网络请求、不碰 MCP。
 *
 * ⚠️ Server Component 不能传函数、也不能处理 onChange，所以搜索/筛选状态必须
 * 从这个客户端边界里 hold。官方 `TextInput` 是受控的（value 必填），用 useState 包住。
 */

import { Home, PanelLeft, Cpu, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { EmptyState } from '@/components/empty-state'
import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { TextInput } from '@astryxdesign/core/TextInput'
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from '@astryxdesign/core/Table'
import type { SmartHomeData, SmartHomeOverview } from '@/plugins/ha-mcp/overview'

/** 实体类型域的展示白名单：从已有实体里挑出现的域。 */
function domainOptions(entities: SmartHomeOverview['entities']): string[] {
  return [...new Set(entities.map((e) => e.domain))].sort((a, b) =>
    a.localeCompare(b, 'zh-Hans-CN'),
  )
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: number
  icon: React.ElementType
}) {
  const Icon = icon
  return (
    <div className="rounded-[var(--radius-container)] border border-border bg-card px-5 py-4 shadow-xs">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="mt-1.5 font-heading text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </div>
    </div>
  )
}

function OverviewStats({ data }: { data: SmartHomeOverview }) {
  return (
    <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard label="区域" value={data.areas.length} icon={Home} />
      <StatCard label="实体总数" value={data.totalEntities} icon={Cpu} />
      <StatCard label="在线状态下" value={data.activeEntities} icon={Search} />
    </div>
  )
}

function HealthCard({ health }: { health: SmartHomeOverview['health'] }) {
  if (!health) {
    return (
      <div className="rounded-[var(--radius-container)] border border-border bg-card px-5 py-4 shadow-xs">
        <div className="text-sm font-medium text-foreground">系统健康</div>
        <p className="mt-1 text-xs text-muted-foreground">暂无健康数据（未读到系统健康状态）。</p>
      </div>
    )
  }
  const version = health.version || '未知版本'
  const degraded = health.errors > 0 || health.offline > 0
  return (
    <div className="rounded-[var(--radius-container)] border border-border bg-card px-5 py-4 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">系统健康</span>
        <Badge variant={degraded ? 'warning' : 'success'} label={degraded ? '有告警' : '运行中'} />
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>核心版本</span>
          <span className="font-medium text-foreground tabular-nums">{version}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span>集成报错</span>
          <span className="font-medium tabular-nums">{health.errors}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span>离线设备</span>
          <span className="font-medium tabular-nums">{health.offline}</span>
        </div>
      </div>
    </div>
  )
}

function EntityTable({ initially }: { initially: SmartHomeOverview }) {
  const [query, setQuery] = useState('')
  const [domain, setDomain] = useState('all')

  const domains = useMemo(() => domainOptions(initially.entities), [initially.entities])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return initially.entities.filter((e) => {
      if (domain !== 'all' && e.domain !== domain) return false
      if (!q) return true
      return (
        e.name.toLowerCase().includes(q) ||
        e.entityId.toLowerCase().includes(q) ||
        (e.area ?? '').toLowerCase().includes(q)
      )
    })
  }, [initially.entities, query, domain])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <TextInput
          label="搜索实体"
          isLabelHidden
          value={query}
          onChange={(v) => setQuery(v)}
          placeholder="搜索实体名称 / ID / 区域"
          hasClear
          width="100%"
          controlClassName="w-full sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant={domain === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            label="全部类型"
            onClick={() => setDomain('all')}
          />
          {domains.map((d) => (
            <Button
              key={d}
              variant={domain === d ? 'secondary' : 'ghost'}
              size="sm"
              label={d}
              onClick={() => setDomain(d)}
            />
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          compact
          title={initially.entities.length === 0 ? '暂无可显示的实体' : '没有匹配的实体'}
          description={
            initially.entities.length === 0
              ? '现场 Home Assistant 已连接，但还没读到任何实体。'
              : '换个关键词或筛选条件试试。'
          }
        />
      ) : (
        <Table hasHover>
          <TableHeader>
            <TableRow isHeaderRow>
              <TableHeaderCell className="pl-4 sm:pl-6">实体</TableHeaderCell>
              <TableHeaderCell className="hidden sm:table-cell">类型</TableHeaderCell>
              <TableHeaderCell className="hidden sm:table-cell">区域</TableHeaderCell>
              <TableHeaderCell className="pr-6 text-right">状态</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((e) => (
              <TableRow key={e.entityId}>
                <TableCell className="max-w-0 py-3 pl-4 sm:pl-6">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{e.name}</span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">{e.entityId}</div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="neutral" className="rounded-md" label={e.domain} />
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                  {e.area ?? '—'}
                </TableCell>
                <TableCell className="pr-6 text-right">
                  <span
                    className={
                      e.active
                        ? 'inline-flex items-center gap-1.5 text-sm font-medium text-foreground'
                        : 'inline-flex items-center gap-1.5 text-sm text-muted-foreground'
                    }
                  >
                    <span
                      className={
                        e.active
                          ? 'size-2 rounded-full bg-emerald-500'
                          : 'size-2 rounded-full bg-border'
                      }
                    />
                    {e.state}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

/** 已配置：总览区 + 实体列表 + 健康卡 */
function ConfiguredOverview({ data }: { data: SmartHomeOverview }) {
  return (
    <div className="flex flex-col gap-6">
      <OverviewStats data={data} />
      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-foreground">实体列表</h2>
        <EntityTable initially={data} />
      </div>
      <HealthCard health={data.health} />
    </div>
  )
}

/** 未配置空态（引导已在服务端做了，这里兜底给可能需要内联用的场景） */
function UnconfiguredView({ hint }: { hint: string }) {
  return (
    <EmptyState
      icon={<PanelLeft className="size-5" />}
      title="还没有连接 Home Assistant"
      description={hint}
    />
  )
}

export function SmartHomeClient({ data }: { data: SmartHomeData }) {
  if (!data.configured) return <UnconfiguredView hint={data.hint} />
  return <ConfiguredOverview data={data} />
}
