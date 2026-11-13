'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileSignature,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
  Undo2,
} from 'lucide-react'

import { Button } from '@astryxdesign/core/Button'
import { Selector } from '@astryxdesign/core/Selector'
import { TextArea } from '@astryxdesign/core/TextArea'
import { IconButton } from '@astryxdesign/core/IconButton'
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput'
import { DateInput } from '@astryxdesign/core/DateInput'
import type { ISODateString } from '@astryxdesign/core/Calendar'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout'
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu'
import { Field, FieldLabel } from '@astryxdesign/core/Field'
import { NumberInput } from '@astryxdesign/core/NumberInput'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useToast } from '@astryxdesign/core/Toast'
import { Popover } from '@astryxdesign/core/Popover'
import type { ContractEditSection } from '@/documents/contract-document'
import {
  DEFAULT_CONTRACT_TERMS,
  paymentAmounts,
  paymentPercentTotal,
  rmbUpper,
  shanghaiDate,
} from '@/lib/contracts'
import { yuan } from '@/lib/quotes'
import { cn } from '@/lib/utils'

import { deleteContract, saveContract, setContractStatus } from './actions'
import type { ContractValues, QuoteOption } from './contract-editor'

type Draft = Omit<ContractValues, 'payments'> & {
  payments: { key: string; name: string; percent: number; received: boolean }[]
}

const SECTION: Record<ContractEditSection, { title: string; description: string }> = {
  number: { title: '合同编号', description: '显示在合同页眉、页脚与导出文件名里。' },
  parties: {
    title: '甲方信息',
    description: '甲方（客户）的姓名、电话和施工地址。乙方信息来自「设置 → 报价单与合同抬头」。',
  },
  amount: {
    title: '金额、工期与质保',
    description: '合同金额以这里为准；更换依据报价会带入该报价的金额。',
  },
  payments: { title: '付款方式', description: '分期名称与比例，金额按合同金额自动计算。' },
  terms: { title: '其他约定', description: '写进合同「其他约定」一条，按行分段。' },
}

const toNum = (v: string) => (v.trim() === '' ? NaN : Number(v))

/**
 * 需要「边输边算」的金额 / 比例输入仍是原生 number 输入：
 * 官方 `NumberInput` 只在失焦 / 回车时提交，会让合同金额的大写、分期金额
 * 与比例合计停止实时联动。这里就地保留原生的逐击提交语义。
 */
const NATIVE_NUM_CLASS =
  'h-8 w-full min-w-0 rounded-[var(--radius-element)] border border-input bg-background px-2.5 py-1 text-base text-foreground shadow-xs outline-none transition-[color,box-shadow,border-color] duration-150 placeholder:text-muted-foreground/75 hover:border-border-strong focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-70 md:text-sm dark:bg-input/20'

const toDraft = (v: ContractValues): Draft => ({
  ...v,
  payments: v.payments.map((p) => ({ ...p, key: crypto.randomUUID() })),
})

/**
 * 合同预览里某一部分的「编辑」入口：只打开这一部分的字段，保存后刷新预览。
 * 合同签订后只能登记收款（服务端同样只接受收款状态的修改）。
 */
export function ContractSectionEdit({
  section,
  values,
  quotes,
  signed,
}: {
  section: ContractEditSection
  values: ContractValues
  quotes: QuoteOption[]
  signed: boolean
}) {
  const router = useRouter()
  const showToast = useToast()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => toDraft(values))
  const [pending, startTransition] = useTransition()
  const meta = SECTION[section]
  const receiptOnly = signed && section === 'payments'
  const title = receiptOnly ? '登记收款' : `编辑${meta.title}`
  // 表单由内容槽里的 <form> 承载，「保存」按钮挪到 LayoutFooter 后用 form 属性关联，
  // 这样回车提交与点按钮提交走同一条路径。
  const formId = `contract-edit-${section}`

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const setPayment = (key: string, patch: Partial<Draft['payments'][number]>) =>
    setDraft((d) => ({
      ...d,
      payments: d.payments.map((p) => (p.key === key ? { ...p, ...patch } : p)),
    }))
  const amounts = useMemo(
    () => paymentAmounts(draft.amount || 0, draft.payments),
    [draft.amount, draft.payments],
  )
  const percentTotal = paymentPercentTotal(draft.payments)
  const selectedQuote = quotes.find((q) => q.id === draft.quoteId)

  const save = () =>
    startTransition(async () => {
      const result = await saveContract(draft.id, {
        number: draft.number,
        quoteId: draft.quoteId,
        amount: draft.amount,
        customerName: draft.customerName,
        customerPhone: draft.customerPhone,
        address: draft.address,
        durationDays: draft.durationDays,
        warrantyMonths: draft.warrantyMonths,
        terms: draft.terms,
        payments: draft.payments.map(({ key: _key, ...p }) => p),
      })
      if (!result.ok) return void showToast({ body: result.error, type: 'error' })
      showToast({ body: receiptOnly ? '收款状态已更新' : `${meta.title}已更新` })
      setOpen(false)
      router.refresh()
    })

  // 官方 TextInput 没有 maxLength（也不收 className），长度上限改为受控截断，
  // 尺寸 / 字体类挪到 controlClassName。
  const text = (
    id: 'number' | 'customerName' | 'customerPhone' | 'address',
    label: string,
    opts: {
      maxLength?: number
      controlClassName?: string
      inputMode?: React.ComponentProps<typeof TextInput>['inputMode']
      autoComplete?: string
    } = {},
  ) => (
    <Field label={label} inputID={`contract-${id}`}>
      <TextInput
        label={label}
        isLabelHidden
        id={`contract-${id}`}
        value={draft[id] ?? ''}
        onChange={(v) => set({ [id]: opts.maxLength ? v.slice(0, opts.maxLength) : v })}
        inputMode={opts.inputMode}
        autoComplete={opts.autoComplete}
        controlClassName={cn('h-9', opts.controlClassName)}
      />
    </Field>
  )
  const int = (id: 'durationDays' | 'warrantyMonths', label: string, unit: string, max: number) => (
    <NumberInput
      label={label}
      id={`contract-${id}`}
      value={draft[id] ?? undefined}
      onChange={(n) => set({ [id]: n })}
      min={0}
      max={max}
      isIntegerOnly
      units={unit}
      width="100%"
    />
  )

  const fields = () => {
    switch (section) {
      case 'number':
        return text('number', '合同编号', { maxLength: 40, controlClassName: 'font-mono' })
      case 'parties':
        return (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {text('customerName', '甲方（客户）', { maxLength: 60, autoComplete: 'off' })}
              {text('customerPhone', '甲方电话', {
                maxLength: 30,
                inputMode: 'tel',
                autoComplete: 'off',
              })}
            </div>
            {text('address', '施工地址', { maxLength: 200 })}
          </>
        )
      case 'amount':
        return (
          <>
            <Field label="依据报价" inputID="contract-quote">
              <Selector
                label="依据报价"
                isLabelHidden
                value={draft.quoteId}
                onChange={(v) => {
                  const q = quotes.find((x) => x.id === v)
                  set({ quoteId: v, ...(q ? { amount: q.total } : {}) })
                }}
                width="100%"
                options={quotes.map((q) => ({
                  value: q.id,
                  label: `${q.title} ${yuan(q.total)}`,
                }))}
              />
            </Field>
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <FieldLabel label="合同金额" inputID="contract-amount" />
                {selectedQuote && Math.abs(selectedQuote.total - (draft.amount || 0)) > 0.001 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="-my-1 text-muted-foreground"
                    onClick={() => set({ amount: selectedQuote.total })}
                    icon={<RotateCcw />}
                    label="按报价金额"
                  />
                ) : null}
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                  ¥
                </span>
                <input
                  id="contract-amount"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  aria-label="合同金额"
                  value={Number.isFinite(draft.amount) ? draft.amount : ''}
                  className={cn(NATIVE_NUM_CLASS, 'pl-7 text-base font-semibold tabular-nums')}
                  onChange={(e) => set({ amount: toNum(e.target.value) })}
                />
              </div>
              <p className="text-xs text-muted-foreground">大写：{rmbUpper(draft.amount || 0)}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {int('durationDays', '工期', '天', 365)}
              {int('warrantyMonths', '质保期', '个月', 120)}
            </div>
          </>
        )
      case 'payments':
        return (
          <div className="grid gap-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                合同金额{' '}
                <span className="font-medium text-foreground tabular-nums">
                  {yuan(draft.amount || 0)}
                </span>
              </span>
              <span
                className={cn(
                  'tabular-nums',
                  Math.abs(percentTotal - 100) > 0.001 && draft.payments.length
                    ? 'font-medium text-destructive-strong'
                    : undefined,
                )}
              >
                比例合计 {percentTotal}%
              </span>
            </div>
            <ul className="divide-y rounded-lg border">
              {draft.payments.map((p, i) => (
                <li key={p.key} className="flex items-center gap-2 px-3 py-2">
                  <span className="w-4 shrink-0 text-xs text-muted-foreground tabular-nums">
                    {i + 1}
                  </span>
                  {receiptOnly ? (
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {p.name || `第 ${i + 1} 期`}{' '}
                      <span className="text-muted-foreground tabular-nums">{p.percent}%</span>
                    </span>
                  ) : (
                    <>
                      <TextInput
                        label={'款项名称'}
                        isLabelHidden
                        aria-label={`第 ${i + 1} 期款项名称`}
                        value={p.name}
                        placeholder="款项名称"
                        controlClassName="h-8 min-w-0 flex-1"
                        onChange={(v) => setPayment(p.key, { name: v })}
                      />
                      <div className="relative w-20 shrink-0">
                        <input
                          aria-label={`第 ${i + 1} 期比例`}
                          type="number"
                          min={0}
                          max={100}
                          step="any"
                          value={Number.isFinite(p.percent) ? p.percent : ''}
                          className={cn(NATIVE_NUM_CLASS, 'h-8 pr-6 text-right tabular-nums')}
                          onChange={(e) => setPayment(p.key, { percent: toNum(e.target.value) })}
                        />
                        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">
                          %
                        </span>
                      </div>
                    </>
                  )}
                  <span className="w-24 shrink-0 text-right text-sm font-medium tabular-nums">
                    {yuan(amounts[i])}
                  </span>
                  <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckboxInput
                      label={'选择'}
                      isLabelHidden
                      value={p.received}
                      onChange={(c) => setPayment(p.key, { received: c === true })}
                      aria-label={`第 ${i + 1} 期已收款`}
                    />
                    已收
                  </label>
                  {receiptOnly ? null : (
                    <IconButton
                      type="button"
                      variant="ghost"

                      className="shrink-0 text-muted-foreground"
                      aria-label={`删除第 ${i + 1} 期`}
                      onClick={() =>
                        set({ payments: draft.payments.filter((x) => x.key !== p.key) })
                      }
                      label={`删除第 ${i + 1} 期`}
                      icon={<Trash2 />}
                      size="sm"
                    />
                  )}
                </li>
              ))}
              {draft.payments.length ? null : (
                <li className="px-3 py-4 text-center text-sm text-muted-foreground">
                  还没有分期，合同里不显示付款表
                </li>
              )}
            </ul>
            {receiptOnly || draft.payments.length >= 6 ? null : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-self-start"
                onClick={() =>
                  set({
                    payments: [
                      ...draft.payments,
                      {
                        key: crypto.randomUUID(),
                        name: '',
                        percent: Math.max(0, Math.round((100 - percentTotal) * 100) / 100),
                        received: false,
                      },
                    ],
                  })
                }
                icon={<Plus />}
                label="添加一期"
              />
            )}
          </div>
        )
      case 'terms':
        return (
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <FieldLabel label="约定内容" inputID="contract-terms" />
              {draft.terms === DEFAULT_CONTRACT_TERMS ? null : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-my-1 text-muted-foreground"
                  onClick={() => set({ terms: DEFAULT_CONTRACT_TERMS })}
                  icon={<RotateCcw />}
                  label="恢复默认条款"
                />
              )}
            </div>
            <TextArea
              label="约定内容"
              isLabelHidden
              id="contract-terms"
              rows={10}
              maxLength={5000}
              value={draft.terms}
              onChange={(v) => set({ terms: v })}
              controlClassName="leading-relaxed"
            />
          </div>
        )
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        // 按钮放在白色的合同纸上：用文档自己的纸色和墨色，深色主题下也保持清晰（不跟随应用的深色按钮）
        className="border-doc-rule bg-doc-paper text-doc-ink shadow-sm hover:bg-[color-mix(in_oklch,var(--doc-accent)_8%,var(--doc-paper))] hover:text-doc-accent aria-expanded:bg-doc-paper dark:bg-doc-paper dark:hover:bg-[color-mix(in_oklch,var(--doc-accent)_8%,var(--doc-paper))]"
        onClick={() => {
          setDraft(toDraft(values))
          setOpen(true)
        }}
        icon={<Pencil />}
        label={'恢复默认条款'}
      />
      <Dialog
        isOpen={open}
        onOpenChange={(o) => !pending && setOpen(o)}
        width={section === 'payments' || section === 'terms' ? 576 : 448}
      >
        <Layout
          header={
            <DialogHeader
              title={title}
              subtitle={
                receiptOnly ? '合同已签订，内容已锁定，只能登记各期是否已收款。' : meta.description
              }
              onOpenChange={(o) => !pending && setOpen(o)}
            />
          }
          content={
            <LayoutContent padding={5}>
              <form
                id={formId}
                className="grid gap-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  save()
                }}
              >
                {fields()}
              </form>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <div className="flex w-full justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  isDisabled={pending}
                  onClick={() => setOpen(false)}
                  label="取消"
                />
                <Button
                  type="submit"
                  form={formId}
                  isDisabled={pending}
                  isLoading={pending}
                  label="保存"
                />
              </div>
            </LayoutFooter>
          }
        />
      </Dialog>
    </>
  )
}

/** 合同顶部的操作：打印 / 导出、标记签订（选签订日期）、撤销签订、删除。 */
export function ContractActions({
  id,
  signed,
  readOnly,
  printHref,
}: {
  id: string
  signed: boolean
  readOnly: boolean
  printHref: string
}) {
  const router = useRouter()
  const showToast = useToast()
  const [busy, setBusy] = useState<'sign' | 'unsign' | 'delete' | null>(null)
  const [signOpen, setSignOpen] = useState(false)
  const [signDate, setSignDate] = useState(() => shanghaiDate())
  const [confirmDelete, setConfirmDelete] = useState(false)

  const changeStatus = async (status: 'signed' | 'draft') => {
    if (busy) return
    setBusy(status === 'signed' ? 'sign' : 'unsign')
    try {
      const result = await setContractStatus(id, status, status === 'signed' ? signDate : undefined)
      if (!result.ok) return void showToast({ body: result.error, type: 'error' })
      showToast({
        body: status === 'signed' ? '已标记为签订，合同内容已锁定' : '已撤销签订，可以修改合同',
      })
      setSignOpen(false)
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    setBusy('delete')
    try {
      const result = await deleteContract(id)
      if (!result.ok) return void showToast({ body: result.error, type: 'error' })
      showToast({ body: '合同已删除' })
      setConfirmDelete(false)
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        href={printHref}
        icon={<Printer />}
        label="打印 / 导出 PDF"
      />
      {readOnly ? null : signed ? (
        <Button
          variant="secondary"
          size="sm"
          isDisabled={busy !== null}
          isLoading={busy === 'unsign'}
          onClick={() => void changeStatus('draft')}
          icon={<Undo2 />}
          label="撤销签订"
        />
      ) : (
        <>
          <Popover
            isOpen={signOpen}
            onOpenChange={setSignOpen}
            placement="below"
            alignment="end"
            label="标记为已签订"
            width={288}
            content={
              <form
                className="grid gap-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  void changeStatus('signed')
                }}
              >
                <div className="grid gap-1">
                  <p className="text-sm font-medium">标记为已签订</p>
                  <p className="text-xs text-muted-foreground">
                    签订后合同与依据的报价都会锁定，仍可登记收款。
                  </p>
                </div>
                <DateInput
                  label="签订日期"
                  value={signDate as ISODateString}
                  max={shanghaiDate() as ISODateString}
                  onChange={(v) => setSignDate(v ?? '')}
                />
                <Button
                  type="submit"
                  size="sm"
                  isDisabled={busy !== null || !signDate}
                  isLoading={busy === 'sign'}
                  label="确认签订"
                />
              </form>
            }
          >
            <Button
              size="sm"
              isDisabled={busy !== null}
              icon={<FileSignature />}
              label="标记为已签订"
            />
          </Popover>
          <DropdownMenu
            alignment="end"
            renderTrigger={(props) => (
              <IconButton
                {...props}
                variant="ghost"
                isDisabled={busy !== null}
                label="更多合同操作"
                icon={<MoreHorizontal />}
                size="sm"
              />
            )}
            items={[
              {
                label: '删除合同',
                icon: <Trash2 />,
                variant: 'destructive',
                onClick: () => setConfirmDelete(true),
              },
            ]}
          />
          <Dialog
            isOpen={confirmDelete}
            onOpenChange={(o) => busy !== 'delete' && setConfirmDelete(o)}
            width={384}
            purpose="form"
          >
            <Layout
              header={
                <DialogHeader
                  title="删除这份合同？"
                  subtitle="合同内容和收款记录会一起删除，之后可以重新从报价生成。"
                  onOpenChange={(o) => busy !== 'delete' && setConfirmDelete(o)}
                />
              }
              content={
                <LayoutContent padding={5}>
                  <div className="flex w-full justify-end gap-2">
                    <Button
                      variant="secondary"
                      isDisabled={busy === 'delete'}
                      onClick={() => setConfirmDelete(false)}
                      label="取消"
                    />
                    <Button
                      variant="destructive"
                      isDisabled={busy === 'delete'}
                      isLoading={busy === 'delete'}
                      onClick={() => void remove()}
                      icon={<Trash2 />}
                      label="删除合同"
                    />
                  </div>
                </LayoutContent>
              }
            />
          </Dialog>
        </>
      )}
    </div>
  )
}
