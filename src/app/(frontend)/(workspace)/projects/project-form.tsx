'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Home, Loader2, NotebookPen, Save, Settings2, UserRound } from 'lucide-react'

import { Button } from '@astryxdesign/core/Button'
import { Field } from '@astryxdesign/core/Field'
import { Card as AstryxCard } from '@astryxdesign/core/Card'
import { NumberInput } from '@astryxdesign/core/NumberInput'
import { Selector } from '@astryxdesign/core/Selector'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useToast } from '@astryxdesign/core/Toast'
import { autoProjectName, PROJECT_PLATFORMS } from '@/lib/projects'
import { registerLeaveGuard } from '@/lib/leave-guard'
import { cn } from '@/lib/utils'

import { saveProject, type ProjectFormState } from './actions'

export type ProjectFormValues = {
  id?: string
  name?: string
  customerName?: string | null
  customerPhone?: string | null
  community?: string | null
  address?: string | null
  owner?: string | null
  platform?: string | null
  budget?: number | null
  notes?: string | null
}

type Option = { value: string; label: string }

/** 官方 TextInput / Selector 都是受控写法：单行文本与下拉各收进一份 state。 */
type TextKey = 'customerName' | 'customerPhone' | 'community' | 'address' | 'name'
type SelectKey = 'platform' | 'owner'

/** 官方 TextInput 没有 maxLength（受控，长度由这里截断；服务端仍会二次校验）。 */
type TextFieldOptions = Partial<
  Pick<
    React.ComponentProps<typeof TextInput>,
    'placeholder' | 'inputMode' | 'autoComplete' | 'hasAutoFocus'
  >
> & { maxLength?: number }

/**
 * 项目信息表单（新建和编辑共用）。所有字段都可以留空：
 * 项目名称按小区 + 房号或客户姓名自动生成，主平台默认沿用上一个项目，负责人默认是自己。
 * 编辑已有项目时可传 onSaved / onCancel：保存成功或取消后回到项目信息的展示视图。
 */
export function ProjectForm({
  initial = {},
  owners,
  readOnly = false,
  onCancelHref,
  onSaved,
  onCancel,
}: {
  initial?: ProjectFormValues
  owners?: Option[]
  readOnly?: boolean
  onCancelHref?: string
  onSaved?: () => void
  onCancel?: () => void
}) {
  const router = useRouter()
  const showToast = useToast()
  const [state, action, pending] = useActionState<ProjectFormState, FormData>(saveProject, null)
  const [dirty, setDirty] = useState(false)
  // 官方输入组件只有受控写法：字段统一进一份 state，提交仍靠 htmlName / FormData
  const [fields, setFields] = useState<Record<string, string>>({
    customerName: initial.customerName ?? '',
    customerPhone: initial.customerPhone ?? '',
    community: initial.community ?? '',
    address: initial.address ?? '',
    name: initial.name ?? '',
    platform: initial.platform || PROJECT_PLATFORMS[0],
    owner: initial.owner ?? '__none',
  })
  const [budget, setBudget] = useState<number | null>(initial.budget ?? null)
  const [notes, setNotes] = useState(initial.notes ?? '')
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}
  const isNew = !initial.id
  const setField = (key: TextKey | SelectKey, value: string) =>
    setFields((f) => ({ ...f, [key]: value }))
  const suggestedName = autoProjectName({
    customerName: fields.customerName,
    community: fields.community,
    address: fields.address,
  })

  useEffect(() => {
    if (!state?.ok) return
    setDirty(false)
    if (isNew) router.push(`/projects/${state.id}`)
    else {
      showToast({ body: '项目信息已保存' })
      router.refresh()
      onSaved?.()
    }
    // onSaved 只在保存成功（state 变化）时调用一次，不放进依赖，避免父组件重新渲染时重复触发。
    // 这是有意的：若把 onSaved 放进依赖，父组件每次重渲染都会换新函数引用，
    // 导致这个 effect 反复触发、重复弹 toast / 重复 router.refresh。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isNew, router])

  useEffect(() => {
    if (!dirty || readOnly || isNew) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    const release = registerLeaveGuard(() => window.confirm('项目信息还没有保存，确定离开吗？'))
    return () => {
      window.removeEventListener('beforeunload', warn)
      release()
    }
  }, [dirty, readOnly, isNew])

  const text = (name: TextKey, label: string, { maxLength, ...props }: TextFieldOptions = {}) => (
    <TextInput
      id={name}
      label={label}
      htmlName={name}
      value={fields[name]}
      onChange={(v) => setField(name, maxLength ? v.slice(0, maxLength) : v)}
      isDisabled={readOnly}
      status={errors[name] ? { type: 'error', message: errors[name] } : undefined}
      {...props}
    />
  )

  const select = (
    name: SelectKey,
    label: string,
    options: readonly Option[],
    allowNone = false,
  ) => (
    <Selector
      label={label}
      value={fields[name]}
      onChange={(v) => {
        setField(name, v)
        setDirty(true)
      }}
      htmlName={name}
      isDisabled={readOnly}
      width="100%"
      status={errors[name] ? { type: 'error', message: errors[name] } : undefined}
      options={allowNone ? [{ value: '__none', label: '未指定' }, ...options] : [...options]}
    />
  )

  const group = (
    Icon: typeof Home,
    title: string,
    desc: string,
    children: React.ReactNode,
    first = false,
  ) => (
    <fieldset
      className={cn(
        'min-w-0 grid gap-4 md:grid-cols-[14rem_1fr] md:gap-8',
        !first && 'border-t border-border pt-6',
      )}
    >
      <div className="space-y-1">
        <legend className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="flex size-6.5 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-3.5" />
          </span>
          {title}
        </legend>
        <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
      </div>
      <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  )

  return (
    <form action={action} onChange={() => setDirty(true)} className="flex flex-col gap-4">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      {state && !state.ok ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive-strong"
        >
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </div>
      ) : null}

      {/* 三槽 + 条件 header/footer，且无 gap：自己排布，不套 padding 统一的槽 */}
      <AstryxCard
        padding={0}
        className="gap-0 border-0 bg-card text-sm text-card-foreground shadow-xs ring-1 ring-border"
      >
        {isNew ? null : (
          <div className="flex flex-col gap-1.5 border-b border-border px-5 pt-5 pb-4">
            <div className="font-heading text-base font-semibold tracking-tight">项目基础档案</div>
            <p className="text-xs text-muted-foreground">
              管理业主联系方式、房产地址、全屋智能主生态平台与预算范围
            </p>
          </div>
        )}
        <div className="flex flex-col gap-6 px-5 pt-6">
          {group(
            UserRound,
            '业主信息',
            '用于方案封面、报价单与合同抬头自动署名。',
            <>
              {text('customerName', '客户姓名', {
                placeholder: '例如：王女士',
                hasAutoFocus: isNew,
                autoComplete: 'off',
              })}
              {text('customerPhone', '客户电话', { inputMode: 'tel', autoComplete: 'off' })}
            </>,
            true,
          )}
          {group(
            Home,
            '房屋地址',
            '填写楼盘小区与房号，系统可自动生成规范项目名称。',
            <>
              {text('community', '小区 / 楼盘', { placeholder: '例如：万科城' })}
              {text('address', '房号 / 详细地址', { placeholder: '例如：3-1201' })}
            </>,
          )}
          {group(
            Settings2,
            '方案与平台配置',
            '选择主要智能生态平台与客户期望预算，辅助 AI 智能配单。',
            <>
              {select(
                'platform',
                '主平台',
                PROJECT_PLATFORMS.map((p) => ({ value: p, label: p })),
              )}
              <NumberInput
                id="budget"
                label="预算（元）"
                htmlName="budget"
                value={budget}
                onChange={setBudget}
                min={0}
                step={1000}
                placeholder="可不填"
                isDisabled={readOnly}
                status={errors.budget ? { type: 'error', message: errors.budget } : undefined}
              />
              {owners && !isNew ? select('owner', '负责人', owners, true) : null}
              <div
                className={cn('grid content-start gap-2', owners && !isNew ? '' : 'sm:col-span-2')}
              >
                <TextInput
                  id="name"
                  label="项目名称"
                  description="留空自动生成"
                  htmlName="name"
                  value={fields.name}
                  onChange={(v) => setField('name', v.slice(0, 120))}
                  placeholder={suggestedName}
                  isDisabled={readOnly}
                  status={errors.name ? { type: 'error', message: errors.name } : undefined}
                />
              </div>
            </>,
          )}
          {group(
            NotebookPen,
            '项目备注与需求',
            '记录家庭常住成员、装修阶段、特殊联动场景或网路条件。',
            <div className="grid gap-2 sm:col-span-2">
              <Field label="备注" inputID="notes" isLabelHidden>
                <TextArea
                  id="notes"
                  label="备注"
                  isLabelHidden
                  value={notes}
                  onChange={setNotes}
                  htmlName="notes"
                  rows={3}
                  maxLength={2000}
                  isDisabled={readOnly}
                  placeholder="户型、装修进度、客户偏好等"
                />
              </Field>
            </div>,
          )}
        </div>
        {readOnly ? null : (
          <div className="mt-6 flex items-center justify-end gap-2 border-t px-5 pt-5">
            {isNew ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push(onCancelHref ?? '/projects')}
                label="取消"
              />
            ) : (
              <>
                {dirty ? (
                  <span className="mr-auto text-xs text-muted-foreground">有未保存的修改</span>
                ) : null}
                {onCancel ? (
                  <Button
                    type="button"
                    variant="secondary"
                    isDisabled={pending}
                    onClick={() => {
                      if (dirty && !window.confirm('项目信息还没有保存，确定放弃修改吗？')) return
                      onCancel()
                    }}
                    label="取消"
                  />
                ) : null}
              </>
            )}
            <Button
              type="submit"
              isDisabled={pending || (!isNew && !dirty)}
              icon={<Loader2 />}
              endContent={<Save />}
              label={isNew ? '创建项目' : '保存'}
            />
          </div>
        )}
      </AstryxCard>
    </form>
  )
}
