'use client'

import { useEffect, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { FilePlus2, Trash2 } from 'lucide-react'

import { Button } from '@astryxdesign/core/Button'
import { Selector } from '@astryxdesign/core/Selector'
import { useToast } from '@astryxdesign/core/Toast'
import { POINT_SCOPES } from '@/lib/point-scopes'

import { createQuoteFromProject, deleteQuote } from './actions'

function SubmitButton({ children }: { children: string }) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      isDisabled={pending}
      isLoading={pending}
      icon={<FilePlus2 />}
      label={children}
    />
  )
}
/** 从点位图生成报价：可选统计范围（全部 / 不含灯具 / 仅开关 …）；没有点位时生成空白报价。 */
export function GenerateQuoteForm({
  projectId,
  hasPoints,
}: {
  projectId: string
  hasPoints: boolean
}) {
  // 官方的 Selector 是受控组件；它的 hidden input 变更不会冒泡成 React form 的
  // onChange，所以这里自己存一份 range，值仍通过 htmlName="scope" 交给 Server Action。
  const [scope, setScope] = useState('all')
  return (
    <form action={createQuoteFromProject} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      {hasPoints ? (
        <>
          <Selector
            label="统计范围"
            isLabelHidden
            htmlName="scope"
            value={scope}
            onChange={(v) => setScope(v)}
            width="100%"
            containerClassName="w-36"
            options={POINT_SCOPES.map((s) => ({ value: s.value, label: s.fullLabel }))}
          />
          <SubmitButton>从点位图生成报价</SubmitButton>
        </>
      ) : (
        <SubmitButton>新建空白报价</SubmitButton>
      )}
    </form>
  )
}

/** 删除报价：点一次变成「确认删除」，3 秒内再点才删除，不弹窗。 */
export function DeleteQuoteButton({ quoteId, title }: { quoteId: string; title: string }) {
  const router = useRouter()
  const showToast = useToast()
  const [armed, setArmed] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])

  return (
    <Button
      type="button"
      variant={armed ? 'destructive' : 'ghost'}
      size="sm"
      isDisabled={pending}
      label="删除"
      className="relative z-10"
      onClick={() => {
        if (!armed) return setArmed(true)
        startTransition(async () => {
          const result = await deleteQuote(quoteId)
          if (!result.ok) {
            showToast({ body: result.error, type: 'error' })
            setArmed(false)
            return
          }
          showToast({ body: `已删除「${title}」` })
          router.refresh()
        })
      }}
      isLoading={pending}
      icon={<Trash2 />}
    />
  )
}
