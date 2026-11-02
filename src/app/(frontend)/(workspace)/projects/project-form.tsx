'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Home, Loader2, NotebookPen, Plus, Save, Settings2, UserRound } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { registerLeaveGuard } from '@/lib/leave-guard'
import { autoProjectName, PROJECT_PLATFORMS } from '@/lib/projects'
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

/**
 * 项目信息表单（新建和编辑共用）。所有字段都可以留空：
 * 项目名称按小区 + 房号或客户姓名自动生成，主平台默认沿用上一个项目，负责人默认是自己。
 */
export function ProjectForm({
  initial = {},
  owners,
  readOnly = false,
  onCancelHref,
}: {
  initial?: ProjectFormValues
  owners?: Option[]
  readOnly?: boolean
  onCancelHref?: string
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState<ProjectFormState, FormData>(saveProject, null)
  const [dirty, setDirty] = useState(false)
  const [nameSource, setNameSource] = useState({ customerName: initial.customerName ?? '', community: initial.community ?? '', address: initial.address ?? '' })
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {}
  const isNew = !initial.id
  const suggestedName = autoProjectName(nameSource)

  useEffect(() => {
    if (!state?.ok) return
    setDirty(false)
    if (isNew) router.push(`/projects/${state.id}`)
    else {
      toast.success('项目信息已保存')
      router.refresh()
    }
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

  const text = (name: keyof ProjectFormValues, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="grid content-start gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        defaultValue={(initial[name] as string | number | null | undefined) ?? ''}
        aria-invalid={errors[name] ? true : undefined}
        disabled={readOnly}
        {...props}
        onChange={(e) => {
          if (name === 'customerName' || name === 'community' || name === 'address') setNameSource((s) => ({ ...s, [name]: e.target.value }))
          props.onChange?.(e)
        }}
      />
      {errors[name] ? <p className="text-xs text-destructive-strong">{errors[name]}</p> : null}
    </div>
  )

  const select = (name: keyof ProjectFormValues, label: string, options: readonly Option[], fallback: string, allowNone = false) => (
    <div className="grid content-start gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Select name={name} defaultValue={(initial[name] as string | null | undefined) || fallback} disabled={readOnly} onValueChange={() => setDirty(true)}>
        <SelectTrigger id={name} className="w-full" aria-invalid={errors[name] ? true : undefined}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allowNone ? <SelectItem value="__none">未指定</SelectItem> : null}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {errors[name] ? <p className="text-xs text-destructive-strong">{errors[name]}</p> : null}
    </div>
  )

  const group = (Icon: typeof Home, title: string, children: React.ReactNode, first = false) => (
    <fieldset className={cn('min-w-0', !first && 'border-t pt-6')}>
      <legend className="float-left mb-4 flex w-full items-center gap-2 text-sm font-medium">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        {title}
      </legend>
      <div className="clear-both grid gap-x-4 gap-y-5 md:grid-cols-2">{children}</div>
    </fieldset>
  )

  return (
    <form action={action} onChange={() => setDirty(true)} className="flex flex-col gap-4">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      {state && !state.ok ? (
        <div role="alert" className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive-strong">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </div>
      ) : null}

      <Card className="gap-0">
        {isNew ? null : (
          <CardHeader className="pb-5">
            <CardTitle className="text-base">项目信息</CardTitle>
          </CardHeader>
        )}
        <CardContent className="flex flex-col gap-6">
          {group(
            UserRound,
            '客户',
            <>
              {text('customerName', '客户姓名', { placeholder: '例如：王女士', autoFocus: isNew, autoComplete: 'off' })}
              {text('customerPhone', '客户电话', { inputMode: 'tel', autoComplete: 'off' })}
            </>,
            true,
          )}
          {group(
            Home,
            '房屋地址',
            <>
              {text('community', '小区 / 楼盘', { placeholder: '例如：万科城' })}
              {text('address', '房号 / 详细地址', { placeholder: '例如：3-1201' })}
            </>,
          )}
          {group(
            Settings2,
            '项目设置',
            <>
          {select('platform', '主平台', PROJECT_PLATFORMS.map((p) => ({ value: p, label: p })), initial.platform || PROJECT_PLATFORMS[0])}
          {text('budget', '预算（元）', { type: 'number', min: 0, step: 1000, inputMode: 'numeric', placeholder: '可不填' })}
          {owners && !isNew ? select('owner', '负责人', owners, '__none', true) : null}
          <div className={cn('grid content-start gap-2', owners && !isNew ? '' : 'md:col-span-2')}>
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="name">项目名称</Label>
              <span id="name-hint" className="text-xs text-muted-foreground">留空自动生成</span>
            </div>
            <Input
              id="name"
              name="name"
              defaultValue={initial.name ?? ''}
              placeholder={suggestedName}
              maxLength={120}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby="name-hint"
              disabled={readOnly}
            />
          </div>
            </>,
          )}
          {group(
            NotebookPen,
            '备注',
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="notes" className="sr-only">备注</Label>
              <Textarea id="notes" name="notes" rows={3} maxLength={2000} defaultValue={initial.notes ?? ''} disabled={readOnly} placeholder="户型、装修进度、客户偏好等" />
            </div>,
          )}
        </CardContent>
        {readOnly ? null : (
          <CardFooter className="mt-6 justify-end gap-2 border-t">
            {isNew ? (
              <Button type="button" variant="outline" onClick={() => router.push(onCancelHref ?? '/projects')}>取消</Button>
            ) : dirty ? (
              <span className="mr-auto text-xs text-muted-foreground">有未保存的修改</span>
            ) : null}
            <Button type="submit" disabled={pending || (!isNew && !dirty)}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : isNew ? <Plus className="size-4" /> : <Save className="size-4" />}
              {isNew ? '创建项目' : '保存'}
            </Button>
          </CardFooter>
        )}
      </Card>
    </form>
  )
}
