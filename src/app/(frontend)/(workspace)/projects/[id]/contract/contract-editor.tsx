'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, FileSignature, Loader2, Lock, Plus, Printer, RotateCcw, Save, Trash2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  contractStatusLabel,
  DEFAULT_CONTRACT_TERMS,
  fmtLongDate,
  paymentAmounts,
  paymentPercentTotal,
  rmbUpper,
  shanghaiDate,
} from '@/lib/contracts'
import { registerLeaveGuard } from '@/lib/leave-guard'
import { quoteStatusLabel, yuan } from '@/lib/quotes'
import { cn } from '@/lib/utils'

import { createContract, deleteContract, saveContract, setContractStatus, type ContractInput } from './actions'

export type QuoteOption = { id: string; title: string; total: number; status: string }
type Payment = { key: string; name: string; percent: number; received: boolean }
export type ContractValues = Omit<ContractInput, 'payments'> & {
  id: string
  status: string
  signedAt: string | null
  payments: { name: string; percent: number; received: boolean }[]
}

const toNum = (v: string) => (v.trim() === '' ? NaN : Number(v))

/** 还没有合同：选一份报价生成。默认选客户已确认的报价，没有则选最新的。 */
export function CreateContractPanel({ projectId, quotes, defaultQuoteId }: { projectId: string; quotes: QuoteOption[]; defaultQuoteId: string }) {
  const router = useRouter()
  const [quoteId, setQuoteId] = useState(defaultQuoteId)
  const [pending, startTransition] = useTransition()
  return (
    <div className="rounded-xl bg-card shadow-sm ring-1 ring-foreground/5 dark:ring-foreground/10">
      <div className="border-b px-5 py-4">
        <h3 className="text-base font-semibold">选择合同依据的报价</h3>
        <p className="text-sm text-muted-foreground">合同金额、客户信息会按报价和项目资料自动填好，付款方式、工期、质保和条款带默认值，生成后都可以修改。</p>
      </div>
      <div role="radiogroup" aria-label="合同依据的报价" className="divide-y">
        {quotes.map((q) => (
          <label key={q.id} className="flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40 has-[:checked]:bg-muted/60">
            <input type="radio" name="quote" value={q.id} checked={quoteId === q.id} onChange={() => setQuoteId(q.id)} className="size-4 accent-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{q.title}</span>
              <span className="text-xs text-muted-foreground">{quoteStatusLabel(q.status)}</span>
            </span>
            <span className="text-sm font-semibold tabular-nums">{yuan(q.total)}</span>
          </label>
        ))}
      </div>
      <div className="flex justify-end border-t px-5 py-4">
        <Button
          disabled={pending || !quoteId}
          onClick={() =>
            startTransition(async () => {
              const result = await createContract(projectId, quoteId)
              if (!result.ok) return void toast.error(result.error)
              toast.success('合同已生成，请核对内容')
              router.refresh()
            })
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <FileSignature className="size-4" />}生成合同
        </Button>
      </div>
    </div>
  )
}

export function ContractEditor({ initial, quotes, readOnly, archived }: { initial: ContractValues; quotes: QuoteOption[]; readOnly: boolean; archived: boolean }) {
  const router = useRouter()
  const signed = initial.status === 'signed'
  /** 签订后只能登记收款；归档后全部只读 */
  const locked = readOnly || signed
  const [values, setValues] = useState(() => ({ ...initial, payments: initial.payments.map((p) => ({ ...p, key: crypto.randomUUID() })) as Payment[] }))
  const [dirty, setDirty] = useState(false)
  const [saving, startSaving] = useTransition()
  const [busy, setBusy] = useState<'sign' | 'unsign' | 'delete' | null>(null)
  const [signDate, setSignDate] = useState(() => shanghaiDate())
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setValues({ ...initial, payments: initial.payments.map((p) => ({ ...p, key: crypto.randomUUID() })) })
    setDirty(false)
  }, [initial])

  const set = (patch: Partial<typeof values>) => {
    setValues((v) => ({ ...v, ...patch }))
    setDirty(true)
  }
  const setPayment = (key: string, patch: Partial<Payment>) => set({ payments: values.payments.map((p) => (p.key === key ? { ...p, ...patch } : p)) })

  const selectedQuote = quotes.find((q) => q.id === values.quoteId)
  const percentTotal = paymentPercentTotal(values.payments)
  const amounts = useMemo(() => paymentAmounts(values.amount || 0, values.payments), [values.amount, values.payments])
  const receivedTotal = values.payments.reduce((s, p, i) => s + (p.received ? amounts[i] : 0), 0)

  const persist = async () => {
    const result = await saveContract(values.id, {
      number: values.number,
      quoteId: values.quoteId,
      amount: values.amount,
      customerName: values.customerName,
      customerPhone: values.customerPhone,
      address: values.address,
      durationDays: values.durationDays,
      warrantyMonths: values.warrantyMonths,
      terms: values.terms,
      payments: values.payments.map(({ key: _k, ...p }) => p),
    })
    if (!result.ok) {
      toast.error(result.error)
      return false
    }
    setDirty(false)
    toast.success('合同已保存')
    router.refresh()
    return true
  }
  const save = (then?: () => void) =>
    startSaving(async () => {
      if (await persist()) then?.()
    })

  const persistRef = useRef(persist)
  persistRef.current = persist
  useEffect(() => {
    if (!dirty || readOnly) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    const release = registerLeaveGuard(async () => (await persistRef.current()) || window.confirm('合同保存失败，仍要离开吗？未保存的修改会丢失。'))
    return () => {
      window.removeEventListener('beforeunload', warn)
      release()
    }
  }, [dirty, readOnly])

  const changeStatus = async (status: 'signed' | 'draft') => {
    if (busy) return
    if (status === 'signed' && dirty && !(await persist())) return
    setBusy(status === 'signed' ? 'sign' : 'unsign')
    try {
      const result = await setContractStatus(values.id, status, status === 'signed' ? signDate : undefined)
      if (!result.ok) return void toast.error(result.error)
      toast.success(status === 'signed' ? '已标记为签订，合同内容已锁定' : '已撤销签订，可以修改合同')
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!confirmDelete) return setConfirmDelete(true)
    setBusy('delete')
    try {
      const result = await deleteContract(values.id)
      if (!result.ok) return void toast.error(result.error)
      toast.success('合同已删除')
      setDirty(false)
      router.refresh()
    } finally {
      setBusy(null)
      setConfirmDelete(false)
    }
  }

  const field = (id: keyof typeof values, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={String(values[id] ?? '')} disabled={locked} onChange={(e) => set({ [id]: e.target.value } as Partial<typeof values>)} {...props} />
    </div>
  )
  const intField = (id: 'durationDays' | 'warrantyMonths', label: string, unit: string, max: number) => (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          min={0}
          max={max}
          inputMode="numeric"
          value={values[id] ?? ''}
          disabled={locked}
          className="pr-10 tabular-nums"
          onChange={(e) => {
            const n = toNum(e.target.value)
            set({ [id]: Number.isFinite(n) ? Math.round(n) : null } as Partial<typeof values>)
          }}
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">{unit}</span>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight">合同</h2>
          <span className="font-mono text-sm text-muted-foreground">{values.number}</span>
          <Badge variant={signed ? 'success' : 'outline'}>{contractStatusLabel(initial.status)}</Badge>
          {dirty ? <Badge variant="outline">未保存</Badge> : null}
        </div>
        <div className="flex items-center gap-2">
          {readOnly ? null : (
            <Button size="sm" disabled={saving || !dirty} onClick={() => save()}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}保存
            </Button>
          )}
        </div>
      </div>

      {locked ? (
        <div role="status" className="flex items-start gap-2 rounded-lg border bg-muted/50 px-4 py-3 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>
            {archived
              ? '项目已归档，合同只读。需要修改时请在「归档」里恢复项目。'
              : `合同已于 ${fmtLongDate(initial.signedAt)} 签订，内容已锁定，仍可登记收款。需要修改时请先撤销签订。`}
          </span>
        </div>
      ) : null}

      <section className="rounded-xl bg-card shadow-sm ring-1 ring-foreground/5 dark:ring-foreground/10">
        <div className="grid gap-x-4 gap-y-5 p-5 md:grid-cols-2">
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="amount">合同金额</Label>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="relative w-44">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">¥</span>
                <Input
                  id="amount"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={Number.isFinite(values.amount) ? values.amount : ''}
                  disabled={locked}
                  className="pl-7 text-base font-semibold tabular-nums"
                  onChange={(e) => set({ amount: toNum(e.target.value) })}
                />
              </div>
              <span className="text-sm text-muted-foreground">大写：{rmbUpper(values.amount || 0)}</span>
            </div>
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="quote">依据报价</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={values.quoteId}
                disabled={locked}
                onValueChange={(v) => {
                  const q = quotes.find((x) => x.id === v)
                  set({ quoteId: v, ...(q ? { amount: q.total } : {}) })
                }}
              >
                <SelectTrigger id="quote" className="w-full sm:w-80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {quotes.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.title} · {yuan(q.total)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedQuote && Math.abs(selectedQuote.total - (values.amount || 0)) > 0.001 && !locked ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => set({ amount: selectedQuote.total })}>
                  <RotateCcw className="size-3.5" />按报价金额 {yuan(selectedQuote.total)}
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">报价明细会作为合同附件打印。</p>
          </div>
          {field('customerName', '甲方（客户）', { maxLength: 60 })}
          {field('customerPhone', '甲方电话', { maxLength: 30, inputMode: 'tel' })}
          <div className="md:col-span-2">{field('address', '施工地址', { maxLength: 200 })}</div>
          {intField('durationDays', '工期', '天', 365)}
          {intField('warrantyMonths', '质保期', '个月', 120)}
          {field('number', '合同编号', { maxLength: 40, className: 'font-mono' })}
        </div>
      </section>

      <section aria-labelledby="payments-title" className="rounded-xl bg-card shadow-sm ring-1 ring-foreground/5 dark:ring-foreground/10">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
          <h3 id="payments-title" className="text-base font-semibold">付款方式</h3>
          <span className={cn('text-sm tabular-nums', Math.abs(percentTotal - 100) > 0.001 && values.payments.length ? 'text-destructive-strong' : 'text-muted-foreground')}>
            比例合计 {percentTotal}%{receivedTotal ? ` · 已收 ${yuan(receivedTotal)}` : ''}
          </span>
        </div>
        <ul className="divide-y">
          {values.payments.map((p, i) => (
            <li key={p.key} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className="w-5 text-sm text-muted-foreground tabular-nums">{i + 1}</span>
              <Input aria-label={`第 ${i + 1} 期款项名称`} value={p.name} disabled={locked} maxLength={40} className="min-w-40 flex-1" onChange={(e) => setPayment(p.key, { name: e.target.value })} />
              <div className="relative w-24">
                <Input
                  aria-label={`第 ${i + 1} 期比例`}
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  value={Number.isFinite(p.percent) ? p.percent : ''}
                  disabled={locked}
                  className="pr-7 text-right tabular-nums"
                  onChange={(e) => setPayment(p.key, { percent: toNum(e.target.value) })}
                />
                <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground">%</span>
              </div>
              <span className="w-28 text-right text-sm font-medium tabular-nums">{yuan(amounts[i])}</span>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={p.received} disabled={readOnly} onCheckedChange={(c) => setPayment(p.key, { received: c === true })} aria-label={`第 ${i + 1} 期已收款`} />
                已收
              </label>
              {locked ? null : (
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`删除第 ${i + 1} 期`} onClick={() => set({ payments: values.payments.filter((x) => x.key !== p.key) })}>
                  <Trash2 className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
        {locked || values.payments.length >= 6 ? null : (
          <div className="border-t px-5 py-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => set({ payments: [...values.payments, { key: crypto.randomUUID(), name: '', percent: Math.max(0, Math.round((100 - percentTotal) * 100) / 100), received: false }] })}
            >
              <Plus className="size-4" />添加一期
            </Button>
          </div>
        )}
      </section>

      <section aria-labelledby="terms-title" className="rounded-xl bg-card shadow-sm ring-1 ring-foreground/5 dark:ring-foreground/10">
        <div className="flex items-center justify-between gap-2 border-b px-5 py-3.5">
          <h3 id="terms-title" className="text-base font-semibold">合同条款</h3>
          {locked || values.terms === DEFAULT_CONTRACT_TERMS ? null : (
            <Button type="button" variant="ghost" size="sm" onClick={() => set({ terms: DEFAULT_CONTRACT_TERMS })}>
              <RotateCcw className="size-3.5" />恢复默认条款
            </Button>
          )}
        </div>
        <div className="p-5">
          <Textarea aria-label="合同条款" rows={8} maxLength={5000} value={values.terms} disabled={locked} onChange={(e) => set({ terms: e.target.value })} className="leading-relaxed" />
          <p className="mt-2 text-xs text-muted-foreground">默认条款可以在「设置」里修改，之后生成的合同都会带上。</p>
        </div>
      </section>

      {readOnly ? null : (
        <section aria-labelledby="sign-title" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed px-5 py-4">
          {signed ? (
            <>
              <div>
                <h3 id="sign-title" className="flex items-center gap-1.5 text-sm font-medium"><Check className="size-4 text-success" />已于 {fmtLongDate(initial.signedAt)} 签订</h3>
                <p className="text-sm text-muted-foreground">撤销签订后可以修改合同内容和依据的报价。</p>
              </div>
              <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void changeStatus('draft')}>
                {busy === 'unsign' ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}撤销签订
              </Button>
            </>
          ) : (
            <>
              <div>
                <h3 id="sign-title" className="text-sm font-medium">客户签字后，标记为已签订</h3>
                <p className="text-sm text-muted-foreground">签订后合同和依据的报价都会锁定，避免和纸质合同对不上。</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="sign-date" className="sr-only">签订日期</Label>
                <Input id="sign-date" type="date" value={signDate} max={shanghaiDate()} onChange={(e) => setSignDate(e.target.value)} className="w-40" />
                <Button size="sm" disabled={busy !== null || saving || !signDate} onClick={() => void changeStatus('signed')}>
                  {busy === 'sign' ? <Loader2 className="size-4 animate-spin" /> : <FileSignature className="size-4" />}标记为已签订
                </Button>
                <Button variant={confirmDelete ? 'destructive' : 'ghost'} size="sm" disabled={busy !== null} onClick={() => void remove()} onBlur={() => setConfirmDelete(false)}>
                  {busy === 'delete' ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  {confirmDelete ? '确认删除合同' : '删除'}
                </Button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}
