'use client'

/**
 * 智能家居总览页的客户端交互区。
 *
 * 两种数据来源：
 *   1. 服务器数据（SM-2，浏览器 / 桌面端未配 HA 时的回退）——
 *      由 Server Component 拉好整包传进来（`data` 是纯结构的判别联合），
 *      这里只做客户端裁剪：实体搜索 + 类型筛选 + 空态兜底。
 *   2. 桌面客户端实时数据（HC-3/HC-4）——
 *      挂载后检测 `window.fanmengDesktop.ha`。有桥且已配置时用 `getStates()`
 *      渲染，并只对 light / switch / cover / climate 白名单实体显示控制按钮。
 *      有桥但未配置 → 明确的「去设置」空态；无桥 → 完全保持服务器数据。
 *
 * 控制行为：调用 `callService`，pending 时禁用，失败就地提示，成功后重新
 * `getStates()`。不做乐观更新 —— 界面只反映主进程真正读回来的状态。
 */

import { Cpu, Home, PanelLeft, Search, Settings } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

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
import {
  callHaService,
  detectDesktopHa,
  isHaControlDomain,
  openDesktopSettings,
  readHaStates,
  readHaStatus,
  type DesktopHaBridge,
  type HaControlService,
  type HaEntityState,
  type HaStatus,
} from '@/lib/desktop-ha'
import {
  assembleOverview,
  type EntityRow,
  type SmartHomeData,
  type SmartHomeOverview,
} from '@/plugins/ha-mcp/overview'

/** 实体类型域的展示白名单：从已有实体里挑出现的域。 */
function domainOptions(entities: SmartHomeOverview['entities']): string[] {
  return [...new Set(entities.map((e) => e.domain))].sort((a, b) =>
    a.localeCompare(b, 'zh-Hans-CN'),
  )
}

function stringAttr(attributes: Record<string, unknown>, key: string): string | null {
  const value = attributes[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function numberAttr(attributes: Record<string, unknown>, key: string): number | null {
  const value = attributes[key]
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function stringListAttr(attributes: Record<string, unknown>, key: string): string[] {
  const value = attributes[key]
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())
}

/** 把桥返回的 states 映射成既有 `SmartHomeData` 的展示结构（统计口径复用 overview.ts）。 */
function liveOverview(states: HaEntityState[]): SmartHomeOverview {
  const assembled = assembleOverview({
    configured: true,
    entities: states.map((state) => ({
      entityId: state.entityId,
      name: stringAttr(state.attributes, 'friendly_name') ?? '',
      area: stringAttr(state.attributes, 'area_name') ?? stringAttr(state.attributes, 'area'),
      state: state.state,
    })),
  })
  if (assembled.configured) return assembled
  // assembleOverview({ configured: true }) 不会走到这里，纯为类型收窄。
  return {
    configured: true,
    totalEntities: 0,
    activeEntities: 0,
    areas: [],
    entities: [],
    health: null,
  }
}

function roundTemperature(value: number): number {
  return Math.round(value * 10) / 10
}

const HVAC_MODE_LABELS: Record<string, string> = {
  off: '关闭',
  heat: '制热',
  cool: '制冷',
  auto: '自动',
  heat_cool: '自动',
  dry: '除湿',
  fan_only: '送风',
}

function hvacModeLabel(mode: string): string {
  return HVAC_MODE_LABELS[mode] ?? mode
}

function StatCard({
  label,
  value,
  icon,
  testId,
}: {
  label: string
  value: number
  icon: React.ElementType
  testId?: string
}) {
  const Icon = icon
  return (
    <div
      data-testid={testId}
      className="rounded-[var(--radius-container)] border border-border bg-card px-5 py-4 shadow-xs"
    >
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

function OverviewStats({
  data,
  showArea = true,
}: {
  data: SmartHomeOverview
  /** 实时数据没有区域字段时不显示区域数，避免把「未分配区域」当成 1 个区域。 */
  showArea?: boolean
}) {
  return (
    <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {showArea ? (
        <StatCard label="区域" value={data.areas.length} icon={Home} testId="ha-stat-areas" />
      ) : null}
      <StatCard label="实体总数" value={data.totalEntities} icon={Cpu} testId="ha-stat-total" />
      <StatCard
        label="在线状态下"
        value={data.activeEntities}
        icon={Search}
        testId="ha-stat-active"
      />
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

/** 桌面客户端连接卡：只展示主进程真实返回的连接态，不伪造健康数据。 */
function LiveStatusCard({ status }: { status: HaStatus }) {
  return (
    <div className="rounded-[var(--radius-container)] border border-border bg-card px-5 py-4 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">桌面客户端直连</span>
        <Badge
          variant={status.connected ? 'success' : 'warning'}
          label={status.connected ? '已连接' : '未连接'}
        />
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        {status.version ? (
          <div className="flex justify-between gap-4">
            <span>Home Assistant 版本</span>
            <span className="font-medium text-foreground tabular-nums">{status.version}</span>
          </div>
        ) : null}
        {status.baseUrl ? (
          <div className="mt-1 flex justify-between gap-4">
            <span>地址</span>
            <span className="truncate font-medium text-foreground">{status.baseUrl}</span>
          </div>
        ) : null}
        {status.error ? <p className="mt-2 text-destructive">{status.error}</p> : null}
      </div>
    </div>
  )
}

/**
 * 实体表。`renderControl` 只在桌面实时分支传入 —— 服务器回退分支
 * 不渲染「控制」列，行为与改造前一致。
 */
function EntityTable({
  data,
  renderControl,
}: {
  data: SmartHomeOverview
  renderControl?: (entity: EntityRow) => React.ReactNode
}) {
  const [query, setQuery] = useState('')
  const [domain, setDomain] = useState('all')

  const domains = useMemo(() => domainOptions(data.entities), [data.entities])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.entities.filter((e) => {
      if (domain !== 'all' && e.domain !== domain) return false
      if (!q) return true
      return (
        e.name.toLowerCase().includes(q) ||
        e.entityId.toLowerCase().includes(q) ||
        (e.area ?? '').toLowerCase().includes(q)
      )
    })
  }, [data.entities, query, domain])

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
          title={data.entities.length === 0 ? '暂无可显示的实体' : '没有匹配的实体'}
          description={
            data.entities.length === 0
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
              {renderControl ? (
                <TableHeaderCell className="pr-6 text-right">控制</TableHeaderCell>
              ) : null}
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
                {renderControl ? (
                  <TableCell className="pr-6 text-right">{renderControl(e)}</TableCell>
                ) : null}
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
        <EntityTable data={data} />
      </div>
      <HealthCard health={data.health} />
    </div>
  )
}

/** 服务器回退空态：与改造前完全一致（浏览器 / 未配 HA）。 */
function UnconfiguredView({ hint }: { hint: string }) {
  return (
    <EmptyState
      icon={<Home className="size-5" />}
      title="还没有连接 Home Assistant"
      description={hint}
    />
  )
}

/** 桌面客户端尚未配置：不伪造数据，直接引导去客户端设置。 */
function DesktopUnconfiguredView({ status }: { status: HaStatus }) {
  return (
    <EmptyState
      icon={<PanelLeft className="size-5" />}
      title="客户端还没有连接 Home Assistant"
      description={
        status.error ??
        '在客户端设置里填写 Home Assistant 地址和长期访问令牌，保存后这里会显示实时设备。'
      }
      action={
        <Button
          label="去设置"
          variant="secondary"
          icon={<Settings className="size-4" />}
          data-testid="ha-open-settings"
          onClick={() => void openDesktopSettings()}
        />
      }
    />
  )
}

/** 桥在、但读不到数据（HA 不在线 / 令牌失效等）：明确状态 + 去设置。 */
function DesktopErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <EmptyState
      icon={<PanelLeft className="size-5" />}
      title="无法读取 Home Assistant 数据"
      description={message}
      action={
        <>
          <Button label="重试" variant="secondary" data-testid="ha-retry" onClick={onRetry} />
          <Button
            label="去设置"
            variant="ghost"
            icon={<Settings className="size-4" />}
            data-testid="ha-open-settings"
            onClick={() => void openDesktopSettings()}
          />
        </>
      }
    />
  )
}

function LoadingView() {
  return (
    <EmptyState
      compact
      title="正在读取客户端数据"
      description="正在从桌面客户端获取 Home Assistant 实时状态。"
    />
  )
}

/** 桌面实时视图：白名单实体的控制按钮都在这里生成，非白名单一律不渲染按钮。 */
function LiveView({
  ha,
  status,
  states,
  onStates,
}: {
  ha: DesktopHaBridge
  status: HaStatus
  states: HaEntityState[]
  onStates: (states: HaEntityState[]) => void
}) {
  const [pending, setPending] = useState<Record<string, HaControlService>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const overview = useMemo(() => liveOverview(states), [states])
  const attributesById = useMemo(
    () => new Map(states.map((state) => [state.entityId, state.attributes])),
    [states],
  )
  // HA 的 /api/states 默认不带区域字段；没有区域信息时不展示区域统计，
  // 否则所有实体会落进「未分配区域」，显示成恒定的 1 个区域。
  const hasAreaInfo = useMemo(
    () =>
      states.some((state) =>
        Boolean(stringAttr(state.attributes, 'area_name') ?? stringAttr(state.attributes, 'area')),
      ),
    [states],
  )

  async function runAction(
    entity: EntityRow,
    service: HaControlService,
    data?: Record<string, unknown>,
  ) {
    if (pending[entity.entityId]) return

    setPending((prev) => ({ ...prev, [entity.entityId]: service }))
    setErrors((prev) => {
      if (!(entity.entityId in prev)) return prev
      const next = { ...prev }
      delete next[entity.entityId]
      return next
    })

    const result = await callHaService(
      { domain: entity.domain, service, entityId: entity.entityId, ...(data ? { data } : {}) },
      ha,
    )

    if (!result.ok) {
      setErrors((prev) => ({ ...prev, [entity.entityId]: result.error ?? '操作失败' }))
      setPending((prev) => {
        const next = { ...prev }
        delete next[entity.entityId]
        return next
      })
      return
    }

    // 成功不做乐观更新：重新读一遍主进程聚合后的真实状态。
    const nextStates = await readHaStates(ha)
    if (nextStates) {
      onStates(nextStates)
    } else {
      setErrors((prev) => ({
        ...prev,
        [entity.entityId]: '操作已提交，但刷新状态失败，请重试。',
      }))
    }
    setPending((prev) => {
      const next = { ...prev }
      delete next[entity.entityId]
      return next
    })
  }

  function renderControl(entity: EntityRow): React.ReactNode {
    if (!isHaControlDomain(entity.domain)) return null

    const busy = Boolean(pending[entity.entityId])
    const error = errors[entity.entityId]
    const attributes = attributesById.get(entity.entityId) ?? {}
    const testId = (suffix: string) => `ha-control-${entity.entityId}-${suffix}`

    let controls: React.ReactNode = null

    if (entity.domain === 'light' || entity.domain === 'switch') {
      const isOn = entity.state === 'on'
      controls = (
        <Button
          size="sm"
          variant="ghost"
          label={isOn ? '关闭' : '开启'}
          isDisabled={busy}
          data-testid={testId('toggle')}
          onClick={() => void runAction(entity, isOn ? 'turn_off' : 'turn_on')}
        />
      )
    } else if (entity.domain === 'cover') {
      const position = numberAttr(attributes, 'current_position')
      const baseline = position ?? 0
      const clamped = (next: number) => Math.max(0, Math.min(100, next))
      controls = (
        <>
          <Button
            size="sm"
            variant="ghost"
            label="打开"
            isDisabled={busy}
            data-testid={testId('open')}
            onClick={() => void runAction(entity, 'turn_on')}
          />
          <Button
            size="sm"
            variant="ghost"
            label="关闭"
            isDisabled={busy}
            data-testid={testId('close')}
            onClick={() => void runAction(entity, 'turn_off')}
          />
          <span className="px-1 text-xs text-muted-foreground tabular-nums">
            位置 {position === null ? '—' : `${position}%`}
          </span>
          <Button
            size="sm"
            variant="ghost"
            label="位置 +10%"
            isDisabled={busy}
            data-testid={testId('position-up')}
            onClick={() =>
              void runAction(entity, 'set_cover_position', {
                position: clamped(baseline + 10),
              })
            }
          />
          <Button
            size="sm"
            variant="ghost"
            label="位置 −10%"
            isDisabled={busy}
            data-testid={testId('position-down')}
            onClick={() =>
              void runAction(entity, 'set_cover_position', {
                position: clamped(baseline - 10),
              })
            }
          />
        </>
      )
    } else if (entity.domain === 'climate') {
      const current = numberAttr(attributes, 'temperature')
      const rawStep = numberAttr(attributes, 'target_temp_step')
      const step = rawStep !== null && rawStep > 0 ? rawStep : 0.5
      const modes = stringListAttr(attributes, 'hvac_modes')
      controls = (
        <>
          <Button
            size="sm"
            variant="ghost"
            label="温度 −"
            isDisabled={busy || current === null}
            data-testid={testId('temp-down')}
            onClick={() =>
              current !== null &&
              void runAction(entity, 'set_temperature', {
                temperature: roundTemperature(current - step),
              })
            }
          />
          <span className="px-1 text-xs text-muted-foreground tabular-nums">
            {current === null ? '—' : `${current}°C`}
          </span>
          <Button
            size="sm"
            variant="ghost"
            label="温度 +"
            isDisabled={busy || current === null}
            data-testid={testId('temp-up')}
            onClick={() =>
              current !== null &&
              void runAction(entity, 'set_temperature', {
                temperature: roundTemperature(current + step),
              })
            }
          />
          {modes.map((mode) => (
            <Button
              key={mode}
              size="sm"
              variant={entity.state === mode ? 'secondary' : 'ghost'}
              label={hvacModeLabel(mode)}
              isDisabled={busy}
              data-testid={testId(`mode-${mode}`)}
              onClick={() => void runAction(entity, 'set_hvac_mode', { hvac_mode: mode })}
            />
          ))}
        </>
      )
    }

    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex flex-wrap items-center justify-end gap-1">{controls}</div>
        {error ? (
          <span role="alert" className="max-w-56 text-xs text-destructive">
            {error}
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <LiveStatusCard status={status} />
      <OverviewStats data={overview} showArea={hasAreaInfo} />
      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-foreground">实体列表</h2>
        <EntityTable data={overview} renderControl={renderControl} />
      </div>
    </div>
  )
}

type BridgeView =
  | { kind: 'server' }
  | { kind: 'loading' }
  | { kind: 'unconfigured'; status: HaStatus }
  | { kind: 'live'; ha: DesktopHaBridge; status: HaStatus; states: HaEntityState[] }
  | { kind: 'error'; message: string }

/**
 * 入口：先按服务器数据渲染（SSR / 浏览器与改造前完全一致），
 * 挂载后再探测桌面桥；有桥才切换到实时分支。
 */
export function SmartHomeClient({ data }: { data: SmartHomeData }) {
  const [view, setView] = useState<BridgeView>({ kind: 'server' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const ha = await detectDesktopHa()
      if (cancelled) return

      // 无桥（浏览器 / 主进程桥未就绪）：保持服务器数据，不做任何事。
      if (!ha) {
        setView({ kind: 'server' })
        return
      }

      setView({ kind: 'loading' })

      const status = await readHaStatus(ha)
      if (cancelled) return
      if (!status) {
        setView({ kind: 'error', message: '无法读取桌面客户端的 Home Assistant 状态。' })
        return
      }

      if (!status.configured) {
        setView({ kind: 'unconfigured', status })
        return
      }

      const states = await readHaStates(ha)
      if (cancelled) return
      if (!states) {
        setView({
          kind: 'error',
          message: status.error ?? '无法读取 Home Assistant 实体状态，请检查连接或令牌。',
        })
        return
      }

      setView({ kind: 'live', ha, status, states })
    })()

    return () => {
      cancelled = true
    }
  }, [attempt])

  if (view.kind === 'loading') return <LoadingView />
  if (view.kind === 'unconfigured') return <DesktopUnconfiguredView status={view.status} />
  if (view.kind === 'error') {
    return <DesktopErrorView message={view.message} onRetry={() => setAttempt((n) => n + 1)} />
  }
  if (view.kind === 'live') {
    return (
      <LiveView
        ha={view.ha}
        status={view.status}
        states={view.states}
        onStates={(states) =>
          setView((current) => (current.kind === 'live' ? { ...current, states } : current))
        }
      />
    )
  }

  return data.configured ? (
    <ConfiguredOverview data={data} />
  ) : (
    <UnconfiguredView hint={data.hint} />
  )
}
