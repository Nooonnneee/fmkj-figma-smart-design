'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeftRight, ArrowRight, ChevronDown, ChevronLeft, FileDown, FileSignature, ImageIcon, Layers, Loader2, Lock, MapPinned, Plus, Printer, RefreshCw, RotateCcw, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { DeviceSymbol } from '@/components/device-symbol'
import { GuardedLink } from '@/components/guarded-link'
import { PlanFigure } from '@/components/plan-figure'
import { PointMarker } from '@/components/point-marker'
import { ProductThumb } from '@/components/product-thumb'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { contractStatusLabel } from '@/lib/contracts'
import { DEVICE_TYPE_ORDER, deviceTypeLabel } from '@/lib/device-types'
import { registerLeaveGuard } from '@/lib/leave-guard'
import { inferScopeFromTitle, POINT_SCOPES, type PointScope } from '@/lib/point-scopes'
import type { StoredScene } from '@/lib/point-scene'
import { buildQuoteFloorGroups } from '@/lib/quote-areas'
import { QUOTE_STATUSES, quoteTotals, yuan } from '@/lib/quotes'
import { cn } from '@/lib/utils'

import { createContract } from '../../contract/actions'
import { saveQuote, setQuoteProjectDefault, syncQuoteFromPointMap } from '../actions'
import { SwapProductDialog, type SwapScope } from './swap-product-dialog'

export type ProductOption = {
  id: string
  name: string
  sku: string
  unit: string
  price: number
  status: string
  deviceType: string | null
  brand: { slug: string; name: string; logo: string | null } | null
  platforms: string[]
  image: string | null
}
type Line = {
  key: string
  rev?: number
  /** 数据库中的明细行 ID，保存时回传以便服务端识别换型号 */
  id: string | null
  product: string | null
  deviceType: string | null
  image: string | null
  name: string
  sku: string
  unit: string
  price: number
  quantity: number
}
type Fee = { key: string; name: string; amount: number }
type QuoteState = { id: string; title: string; status: string; discount: number; notes: string; items: Line[]; fees: Fee[] }

const toNum = (v: string) => (v.trim() === '' ? 0 : Number(v))

/** 受控数字输入框：输入时保持原始文本（方便输入小数点），失焦或外部变更时同步数值 */
function EditableNumber({
  value,
  onChange,
  label,
  disabled,
  className = 'w-24',
}: {
  value: number
  onChange: (n: number) => void
  label: string
  disabled?: boolean
  className?: string
}) {
  const [text, setText] = useState(() => String(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setText(String(value))
  }, [value, focused])
  return (
    <Input
      type="number"
      min={0}
      step="any"
      inputMode="decimal"
      aria-label={label}
      value={focused ? text : String(value)}
      disabled={disabled}
      className={cn('h-7 px-2 text-right tabular-nums', className)}
      onFocus={() => {
        setFocused(true)
        setText(String(value))
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        setText(e.target.value)
        const n = toNum(e.target.value)
        if (Number.isFinite(n) && n >= 0) onChange(n)
      }}
    />
  )
}

export function QuoteEditor({
  quote: initial,
  project,
  projectQuotes = [],
  projectScene,
  projectDefaults,
  products,
  costs,
  readOnly,
  lockReason = null,
  contract = null,
  pendingPoints = 0,
}: {
  quote: QuoteState
  project: { id: string; name: string; customerName: string }
  projectQuotes?: { id: string; title: string; total: number }[]
  projectScene?: Partial<StoredScene> | null
  projectDefaults?: unknown
  products: ProductOption[]
  /** 产品成本（内部参考，不会打印）；为 null 时不显示成本与毛利。 */
  costs: Record<string, number> | null
  readOnly: boolean
  /** 只读原因：项目已归档，或报价已用于已签订的合同 */
  lockReason?: string | null
  /** 项目的合同（每个项目一份）以及是否依据这份报价 */
  contract?: { number: string; status: string; usesThisQuote: boolean } | null
  /** 从点位图生成时未能确定型号的点位数 */
  pendingPoints?: number
}) {
  const router = useRouter()
  const [quote, setQuote] = useState(initial)
  const [dirty, setDirty] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [swapKey, setSwapKey] = useState<string | null>(null)
  const [saving, startSaving] = useTransition()
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    setQuote(initial)
    setDirty(false)
  }, [initial])

  const floorGroups = useMemo(
    () => buildQuoteFloorGroups(projectScene, projectDefaults, products, quote.items),
    [projectScene, projectDefaults, products, quote.items],
  )
  const [viewMode, setViewMode] = useState<'floors' | 'summary'>(() => (floorGroups.length > 0 ? 'floors' : 'summary'))
  const [planMode, setPlanMode] = useState<'symbol' | 'product' | 'hide'>('symbol')
  const currentScope = useMemo(() => inferScopeFromTitle(quote.title), [quote.title])

  const update = (patch: Partial<QuoteState>) => {
    setQuote((q) => ({ ...q, ...patch }))
    setDirty(true)
  }
  const updateLine = (key: string, patch: Partial<Line>) => update({ items: quote.items.map((l) => (l.key === key ? { ...l, ...patch } : l)) })
  const updateFee = (key: string, patch: Partial<Fee>) => update({ fees: quote.fees.map((f) => (f.key === key ? { ...f, ...patch } : f)) })

  const addProduct = (p: ProductOption) => {
    const existing = quote.items.find((l) => l.product === p.id)
    if (existing) updateLine(existing.key, { quantity: existing.quantity + 1, rev: (existing.rev ?? 0) + 1 })
    else update({ items: [...quote.items, { key: crypto.randomUUID(), id: null, product: p.id, deviceType: p.deviceType, image: p.image, name: p.name, sku: p.sku, unit: p.unit, price: p.price, quantity: 1 }] })
    setPickerOpen(false)
  }

  const activeProducts = useMemo(() => products.filter((p) => p.status === 'active'), [products])
  const catalogPriceById = useMemo(() => new Map(products.map((p) => [p.id, p.price])), [products])
  const catalogPriceOf = (productId: string | null) => (productId ? catalogPriceById.get(productId) : undefined)
  const pickerGroups = useMemo(
    () =>
      DEVICE_TYPE_ORDER.map((t) => ({ type: t, items: activeProducts.filter((p) => p.deviceType === t) }))
        .concat([{ type: '', items: activeProducts.filter((p) => !p.deviceType) }])
        .filter((g) => g.items.length),
    [activeProducts],
  )

  const swapLine = swapKey ? quote.items.find((l) => l.key === swapKey) ?? null : null
  const applySwap = (p: ProductOption, scope: SwapScope, setDefault: boolean) => {
    if (!swapLine) return
    const targets = scope === 'type' ? quote.items.filter((l) => l.deviceType && l.deviceType === swapLine.deviceType) : [swapLine]
    const keys = new Set(targets.map((l) => l.key))
    // 数量保持不变；单价改为新产品售价
    update({
      items: quote.items.map((l) =>
        keys.has(l.key) ? { ...l, product: p.id, deviceType: p.deviceType, image: p.image, name: p.name, sku: p.sku, unit: p.unit, price: p.price, rev: (l.rev ?? 0) + 1 } : l,
      ),
    })
    toast.success(`已更换 ${targets.length} 行为「${p.name}」，记得保存`)
    if (setDefault && project && p.deviceType) {
      void setQuoteProjectDefault(project.id, p.deviceType, p.id).then((r) =>
        r.ok ? toast.success('已同时设为项目默认型号') : toast.error(r.error),
      )
    }
  }

  const totals = useMemo(() => quoteTotals(quote.items, quote.fees, quote.discount), [quote])
  const unitCost = (l: Line) => (costs && l.product ? costs[l.product] : undefined)
  const margin = useMemo(() => {
    if (!costs) return null
    let cost = 0
    let missing = 0
    for (const l of quote.items) {
      const c = l.product ? costs[l.product] : undefined
      if (c === undefined) missing++
      else cost += c * l.quantity
    }
    const profit = totals.total - cost
    return { cost, profit, rate: totals.total > 0 ? profit / totals.total : 0, missing }
  }, [costs, quote.items, totals.total])

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const persist = async () => {
    const result = await saveQuote(quote.id, {
      title: quote.title,
      status: quote.status,
      discount: quote.discount,
      notes: quote.notes,
      items: quote.items.map((l) => ({ id: l.id, product: l.product, name: l.name, sku: l.sku, unit: l.unit, price: l.price, quantity: l.quantity })),
      fees: quote.fees.map(({ key: _k, ...f }) => f),
    })
    if (!result.ok) {
      toast.error(result.error)
      return false
    }
    setDirty(false)
    toast.success('报价已保存')
    router.refresh()
    return true
  }
  const save = (then?: () => void) =>
    startSaving(async () => {
      if (await persist()) then?.()
    })

  // 切换项目板块或侧边栏导航时，先自动保存未保存的修改
  const persistRef = useRef(persist)
  persistRef.current = persist
  useEffect(() => {
    if (!dirty || readOnly) return
    return registerLeaveGuard(async () => (await persistRef.current()) || window.confirm('报价保存失败，仍要离开吗？未保存的修改会丢失。'))
  }, [dirty, readOnly])

  const [creatingContract, setCreatingContract] = useState(false)
  const generateContract = async () => {
    if (creatingContract) return
    if (dirty && !readOnly && !(await persist())) return
    setCreatingContract(true)
    try {
      const result = await createContract(project.id, quote.id)
      if (!result.ok) return void toast.error(result.error)
      toast.success('已生成合同，请核对内容后打印')
      router.push(`/projects/${project.id}/contract`)
    } finally {
      setCreatingContract(false)
    }
  }

  const openPrint = (autoPdf = false) => {
    const url = autoPdf ? `/print/quotes/${quote.id}?auto=pdf` : `/print/quotes/${quote.id}`
    const go = () => router.push(url)
    if (dirty && !readOnly) save(go)
    else go()
  }

  /** 无缝跳回点位图（如有未保存的临时改价或换型号，先自动保存再跳转；支持直接定位到指定楼层、房间或点位代号） */
  const switchToPointMap = (opts?: { sheet?: string; area?: string; point?: string }) => {
    const params = new URLSearchParams({ quoteId: quote.id, scope: currentScope })
    if (opts?.sheet) params.set('sheet', opts.sheet)
    if (opts?.area) params.set('area', opts.area)
    if (opts?.point) params.set('point', opts.point)
    const url = `/projects/${project.id}/point-map?${params.toString()}`
    const go = () => router.push(url)
    if (dirty && !readOnly) save(go)
    else go()
  }

  /** 从点位图同步最新点位数量到当前报价（保留临时改价、换过的型号与附加费用） */
  const syncFromPointMap = async (targetScope: PointScope = currentScope) => {
    if (syncing || saving) return
    const runSync = async () => {
      setSyncing(true)
      try {
        const res = await syncQuoteFromPointMap(quote.id, targetScope)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success(`已从点位图同步（${POINT_SCOPES.find((s) => s.value === res.scope)?.fullLabel}）`)
        router.refresh()
      } finally {
        setSyncing(false)
      }
    }
    if (dirty && !readOnly) save(() => void runSync())
    else await runSync()
  }

  const numInput = (value: number, onChange: (n: number) => void, label: string, className = 'w-24') => (
    <EditableNumber value={value} onChange={onChange} label={label} disabled={readOnly} className={cn('h-8', className)} />
  )

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <SwapProductDialog
        open={Boolean(swapLine)}
        onOpenChange={(o) => !o && setSwapKey(null)}
        line={swapLine}
        products={products}
        sameTypeLines={swapLine ? quote.items.filter((l) => l.deviceType && l.deviceType === swapLine.deviceType).length : 0}
        canSetDefault={Boolean(project)}
        onConfirm={applySwap}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
            <GuardedLink href={`/projects/${project.id}/quotes`}><ChevronLeft className="size-4" />全部报价</GuardedLink>
          </Button>
          {projectQuotes.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" aria-label="切换到项目里的其他报价">
                  切换<ChevronDown className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {projectQuotes.map((q) => (
                  <DropdownMenuItem
                    key={q.id}
                    onSelect={() => {
                      if (q.id === quote.id) return
                      const go = () => router.push(`/projects/${project.id}/quotes/${q.id}`)
                      if (dirty && !readOnly) save(go)
                      else go()
                    }}
                  >
                    <span className={cn('flex-1 truncate', q.id === quote.id && 'font-semibold')}>{q.title}</span>
                    <span className="ml-3 text-xs text-muted-foreground tabular-nums">{yuan(q.total)}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {readOnly ? <Badge variant="secondary"><Lock className="size-3" />只读</Badge> : dirty ? <Badge variant="outline">未保存</Badge> : null}
          <Button variant="outline" size="sm" disabled={saving || syncing} onClick={() => switchToPointMap()}>
            <MapPinned className="size-4" />调整点位
          </Button>
          <Button variant="outline" size="sm" onClick={() => openPrint(false)}><Printer className="size-4" />打印预览</Button>
          <Button variant="outline" size="sm" onClick={() => openPrint(true)}><FileDown className="size-4" />导出 PDF</Button>
          {readOnly ? null : (
            <Button size="sm" disabled={saving} onClick={() => save()}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}保存
            </Button>
          )}
        </div>
      </div>

      {lockReason ? (
        <div role="status" className="flex items-start gap-2 rounded-lg border bg-muted/50 px-4 py-3 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>{lockReason}</span>
        </div>
      ) : null}

      <header className="grid gap-4 md:grid-cols-[1fr_12rem]">
        <div className="grid gap-2">
          <Label htmlFor="title">报价名称</Label>
          <Input id="title" value={quote.title} disabled={readOnly} onChange={(e) => update({ title: e.target.value })} className="text-base font-semibold" />
          <p className="text-xs text-muted-foreground">{[project.name, project.customerName && `客户 ${project.customerName}`].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="status">状态</Label>
          <Select value={quote.status} onValueChange={(v) => update({ status: v })} disabled={readOnly}>
            <SelectTrigger id="status" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {QUOTE_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </header>

      {contract?.usesThisQuote ? (
        <p className="-mt-2 text-sm text-muted-foreground">
          已用于合同 {contract.number}（{contractStatusLabel(contract.status)}）
          <GuardedLink href={`/projects/${project.id}/contract`} className="ml-2 font-medium text-foreground underline-offset-4 hover:underline">查看合同</GuardedLink>
        </p>
      ) : !contract && !readOnly && quote.status === 'accepted' ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3">
          <div className="text-sm">
            <div className="font-medium">客户已确认这份报价</div>
            <div className="text-muted-foreground">下一步：用它生成合同，金额、客户信息和付款方式会自动带入。</div>
          </div>
          <Button size="sm" disabled={creatingContract || saving} onClick={() => void generateContract()}>
            {creatingContract ? <Loader2 className="size-4 animate-spin" /> : <FileSignature className="size-4" />}生成合同<ArrowRight className="size-4" />
          </Button>
        </div>
      ) : null}

      {pendingPoints ? (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            <div className="font-medium">点位图中有 {pendingPoints} 个点位待选型，未计入本报价</div>
            <div className="text-muted-foreground">
              可回到点位图给这些点位指定产品，或在「统计与默认型号」里设置项目默认型号后重新生成；也可以直接在下方「添加产品」。
              <button type="button" className="ml-1 underline underline-offset-2" onClick={() => switchToPointMap()}>打开点位图</button>
            </div>
          </div>
        </div>
      ) : null}

      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-wrap items-center justify-between gap-2 border-b py-4">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">产品明细</CardTitle>
            {floorGroups.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg bg-muted p-0.5" role="tablist" aria-label="明细视图">
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    role="tab"
                    aria-selected={viewMode === 'floors'}
                    className={cn('h-7 rounded-md px-2.5 text-xs', viewMode === 'floors' && 'bg-background shadow-sm')}
                    onClick={() => setViewMode('floors')}
                  >
                    <Layers className="size-3.5" />按楼层房间（{floorGroups.length} 层 / {floorGroups.reduce((s, f) => s + f.rooms.length, 0)} 间）
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    role="tab"
                    aria-selected={viewMode === 'summary'}
                    className={cn('h-7 rounded-md px-2.5 text-xs', viewMode === 'summary' && 'bg-background shadow-sm')}
                    onClick={() => setViewMode('summary')}
                  >
                    整单汇总
                  </Button>
                </div>
                {viewMode === 'floors' ? (
                  <div className="flex rounded-lg bg-muted p-0.5" role="radiogroup" aria-label="点位图显示">
                    {(
                      [
                        ['symbol', '点位图：设备图标'],
                        ['product', '点位图：产品图'],
                        ['hide', '收起点位图'],
                      ] as const
                    ).map(([v, label]) => (
                      <Button
                        key={v}
                        type="button"
                        size="xs"
                        variant="ghost"
                        role="radio"
                        aria-checked={planMode === v}
                        className={cn('h-7 rounded-md px-2 text-xs', planMode === v && 'bg-background shadow-sm')}
                        onClick={() => setPlanMode(v)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          {readOnly ? null : (
            <div className="flex items-center gap-2">
              {project ? (
                <div className="flex items-center">
                  <Button variant="outline" size="sm" disabled={syncing || saving} className="rounded-r-none border-r-0" onClick={() => void syncFromPointMap(currentScope)}>
                    {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}从点位图同步
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" disabled={syncing || saving} className="rounded-l-none px-1.5" aria-label="选择同步范围">
                        <ChevronDown className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {POINT_SCOPES.map((s) => (
                        <DropdownMenuItem key={s.value} onSelect={() => void syncFromPointMap(s.value)}>
                          <span className={cn('flex-1', s.value === currentScope && 'font-semibold')}>按「{s.fullLabel}」同步</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : null}
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm"><Plus className="size-4" />添加产品</Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-96 p-0">
                <Command>
                  <CommandInput placeholder="搜索产品名称、型号、品牌或设备类型" />
                  <CommandList className="max-h-96">
                    <CommandEmpty>没有匹配的产品</CommandEmpty>
                    {pickerGroups.map((g) => (
                      <CommandGroup key={g.type || 'none'} heading={g.type ? deviceTypeLabel(g.type) : '未分类'}>
                        {g.items.map((p) => (
                          <CommandItem key={p.id} value={`${p.name} ${p.sku} ${p.brand?.name ?? ''} ${deviceTypeLabel(p.deviceType)}`} onSelect={() => addProduct(p)}>
                            <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                              {p.image ? (
                                <Image src={p.image} alt="" width={32} height={32} className="size-full bg-white object-contain" />
                              ) : (
                                <span className="size-5"><DeviceSymbol type={p.deviceType} /></span>
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate">{p.name}</div>
                              <div className="truncate text-xs text-muted-foreground">{p.brand?.name} · {p.sku}</div>
                            </div>
                            <span className="text-xs tabular-nums">{yuan(p.price)}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
              </Popover>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {quote.items.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">还没有产品。可以在点位图里放置设备后重新生成，或点击「添加产品」。</p>
          ) : viewMode === 'floors' && floorGroups.length > 0 ? (
            <div className="divide-y">
              {floorGroups.map((floor) => (
                <div key={floor.sheetId} className="space-y-3 p-4 md:p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h3 className="text-base font-semibold">{floor.floorName}</h3>
                      <span className="text-xs text-muted-foreground">{floor.sheetName} · {floor.rooms.length} 个区域 · {floor.pointCount} 个点位</span>
                      {project ? (
                        <Button type="button" variant="link" size="xs" className="h-auto p-0 text-xs" onClick={() => switchToPointMap({ sheet: floor.sheetId })}>
                          <MapPinned className="size-3" />去点位图看本层
                        </Button>
                      ) : null}
                    </div>
                    <div className="text-sm font-semibold tabular-nums">楼层小计 {yuan(floor.subtotal)}</div>
                  </div>
                  {planMode !== 'hide' && floor.sheetUrl ? (
                    <div className="overflow-hidden rounded-xl border bg-white">
                      <PlanFigure
                        sheetUrl={floor.sheetUrl}
                        points={floor.planPoints}
                        areas={floor.planAreas}
                        mode={planMode}
                        className="w-full"
                      />
                    </div>
                  ) : null}
                  <div className="grid gap-3 md:grid-cols-2">
                    {floor.rooms.map((room) => (
                      <div key={room.id} className="flex flex-col rounded-xl border bg-background p-3.5">
                        <div className="mb-2.5 flex items-baseline justify-between border-b pb-2">
                          <div className="flex flex-wrap items-baseline gap-1.5">
                            <span className="text-sm font-semibold">{room.name}</span>
                            <span className="text-xs text-muted-foreground">{room.typeLabel} · {room.pointCount} 个点位</span>
                            {project && room.typeLabel !== '未分区' ? (
                              <Button type="button" variant="link" size="xs" className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground" onClick={() => switchToPointMap({ area: room.name })}>
                                定位房间
                              </Button>
                            ) : null}
                          </div>
                          <span className="text-sm font-semibold tabular-nums">{yuan(room.subtotal)}</span>
                        </div>
                        <div className="divide-y">
                          {room.lines.map((line) => {
                            const originPrice = catalogPriceOf(line.productId)
                            const priceChanged = originPrice !== undefined && Math.abs(originPrice - line.price) > 0.001
                            return (
                              <div key={`${room.id}-${line.deviceType}-${line.productId}`} className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0">
                                <ProductThumb src={line.image} alt={line.name} className="size-10" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <PointMarker type={line.deviceType} className="size-4" />
                                    <span className="truncate text-sm font-medium">{line.name}</span>
                                  </div>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                                    <span>{line.typeName}</span>
                                    {line.sku ? <span>· {line.sku}</span> : null}
                                    {line.codes.length ? (
                                      <span className="inline-flex flex-wrap items-center gap-1 font-mono text-[11px]">
                                        （
                                        {line.codes.map((code, idx) => (
                                          <span key={code}>
                                            {project ? (
                                              <button
                                                type="button"
                                                title={`在点位图中定位并选中 ${code}`}
                                                className="underline decoration-dotted underline-offset-2 hover:text-foreground"
                                                onClick={() => switchToPointMap({ point: code })}
                                              >
                                                {code}
                                              </button>
                                            ) : (
                                              code
                                            )}
                                            {idx < line.codes.length - 1 ? '、' : ''}
                                          </span>
                                        ))}
                                        ）
                                      </span>
                                    ) : null}
                                    {!readOnly && line.lineKey ? (
                                      <Button variant="link" size="xs" className="h-auto p-0 text-xs" onClick={() => setSwapKey(line.lineKey)}>
                                        <ArrowLeftRight className="size-3" />更换型号
                                      </Button>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="shrink-0 text-right text-xs tabular-nums">
                                  <div className="text-sm font-semibold">{yuan(line.subtotal)}</div>
                                  <div className="mt-1 flex items-center justify-end gap-1 text-muted-foreground">
                                    <span>¥</span>
                                    <EditableNumber
                                      value={line.price}
                                      disabled={readOnly || !line.lineKey}
                                      label={`${room.name} ${line.name} 单价`}
                                      className="h-6 w-20 px-1.5 text-xs"
                                      onChange={(n) => line.lineKey && updateLine(line.lineKey, { price: n })}
                                    />
                                    <span>× {line.quantity}{line.unit || '个'}</span>
                                  </div>
                                  {priceChanged && line.lineKey ? (
                                    <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-warning">
                                      <span>原价 {yuan(originPrice)}</span>
                                      {!readOnly ? (
                                        <Button
                                          type="button"
                                          variant="link"
                                          size="xs"
                                          className="h-auto p-0 text-[11px]"
                                          onClick={() => updateLine(line.lineKey!, { price: originPrice })}
                                        >
                                          <RotateCcw className="size-2.5" />恢复
                                        </Button>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">产品</TableHead>
                  {costs ? <TableHead className="text-right">成本</TableHead> : null}
                  <TableHead className="text-right">单价</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                  <TableHead className="text-right">小计</TableHead>
                  {readOnly ? null : <TableHead className="w-10 pr-4" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {quote.items.map((l) => (
                  <TableRow key={l.key}>
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                          {l.image ? (
                            <Image src={l.image} alt="" width={44} height={44} className="size-full bg-white object-contain" />
                          ) : l.deviceType ? (
                            <span className="size-6"><DeviceSymbol type={l.deviceType} /></span>
                          ) : (
                            <ImageIcon className="size-4 text-muted-foreground/50" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium">{l.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {[l.deviceType ? deviceTypeLabel(l.deviceType) : null, l.sku, l.unit && `单位：${l.unit}`].filter(Boolean).join(' · ')}
                          </div>
                          {!readOnly && l.deviceType ? (
                            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setSwapKey(l.key)}>
                              <ArrowLeftRight className="size-3" />更换型号
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    {costs ? (
                      <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                        {unitCost(l) === undefined ? '—' : yuan(unitCost(l))}
                      </TableCell>
                    ) : null}
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        {numInput(l.price, (n) => updateLine(l.key, { price: n }), `${l.name} 单价`, 'ml-auto w-28')}
                        {(() => {
                          const originPrice = catalogPriceOf(l.product)
                          if (originPrice === undefined || Math.abs(originPrice - l.price) <= 0.001) return null
                          return (
                            <span className="flex items-center gap-1 text-[11px] text-warning tabular-nums">
                              原价 {yuan(originPrice)}
                              {!readOnly ? (
                                <Button type="button" variant="link" size="xs" className="h-auto p-0 text-[11px]" onClick={() => updateLine(l.key, { price: originPrice })}>
                                  <RotateCcw className="size-2.5" />恢复
                                </Button>
                              ) : null}
                            </span>
                          )
                        })()}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{numInput(l.quantity, (n) => updateLine(l.key, { quantity: n }), `${l.name} 数量`, 'ml-auto w-20')}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{yuan(l.price * l.quantity)}</TableCell>
                    {readOnly ? null : (
                      <TableCell className="pr-4">
                        <Button variant="ghost" size="icon-sm" aria-label={`删除 ${l.name}`} onClick={() => update({ items: quote.items.filter((x) => x.key !== l.key) })}>
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="pl-6" colSpan={costs ? 4 : 3}>产品小计</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{yuan(totals.productTotal)}</TableCell>
                  {readOnly ? null : <TableCell />}
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid items-start gap-5 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">附加费用</CardTitle>
            {readOnly ? null : (
              <Button variant="outline" size="sm" onClick={() => update({ fees: [...quote.fees, { key: crypto.randomUUID(), name: quote.fees.length ? '' : '安装调试费', amount: 0 }] })}>
                <Plus className="size-4" />添加费用
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {quote.fees.length === 0 ? <p className="text-sm text-muted-foreground">如安装调试费、布线费、上门费等</p> : null}
            {quote.fees.map((f) => (
              <div key={f.key} className="flex items-center gap-2">
                <Input value={f.name} placeholder="费用名称" aria-label="费用名称" className="h-8" disabled={readOnly} onChange={(e) => updateFee(f.key, { name: e.target.value })} />
                {numInput(f.amount, (n) => updateFee(f.key, { amount: n }), `${f.name || '费用'} 金额`, 'w-28')}
                {readOnly ? null : (
                  <Button variant="ghost" size="icon-sm" aria-label="删除费用" onClick={() => update({ fees: quote.fees.filter((x) => x.key !== f.key) })}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">合计</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">产品小计</span><span className="tabular-nums">{yuan(totals.productTotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">附加费用</span><span className="tabular-nums">{yuan(totals.feeTotal)}</span></div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">优惠</span>
              {numInput(quote.discount, (n) => update({ discount: n }), '优惠金额', 'w-28')}
            </div>
            <div className="flex items-baseline justify-between border-t pt-3">
              <span className="font-medium">报价总额</span>
              <span className="text-2xl font-bold tabular-nums">{yuan(totals.total)}</span>
            </div>
            {margin ? (
              <div className="mt-3 space-y-1.5 rounded-lg bg-muted/60 p-3">
                <div className="text-xs font-medium text-muted-foreground">内部参考，不会打印</div>
                <div className="flex justify-between"><span className="text-muted-foreground">产品成本</span><span className="tabular-nums">{yuan(margin.cost)}</span></div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">毛利</span>
                  <span className={`font-semibold tabular-nums ${margin.profit < 0 ? 'text-destructive-strong' : 'text-success'}`}>
                    {yuan(margin.profit)}（{(margin.rate * 100).toFixed(1)}%）
                  </span>
                </div>
                {margin.missing ? <p className="text-xs text-warning">有 {margin.missing} 行产品未设置成本，毛利按 0 成本计算</p> : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="notes">备注（会打印在报价单上）</Label>
        <Textarea id="notes" rows={3} value={quote.notes} disabled={readOnly} placeholder="例如：报价有效期 30 天；含一年免费上门维护" onChange={(e) => update({ notes: e.target.value })} />
      </div>
    </section>
  )
}
