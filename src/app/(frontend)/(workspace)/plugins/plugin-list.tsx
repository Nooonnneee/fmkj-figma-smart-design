'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export type PluginViewItem = {
  id: string
  name: string
  description: string
  status: 'ready' | 'coming-soon'
  where: string
  provides: string[]
  enabled: boolean
}

export function PluginList({ items, selectedId }: { items: PluginViewItem[]; selectedId: string | null }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({})

  async function toggle(item: PluginViewItem, next: boolean) {
    if (item.status !== 'ready' || busyId) return
    setBusyId(item.id)
    setOptimistic((prev) => ({ ...prev, [item.id]: next }))
    try {
      const res = await fetch('/plugins/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, enabled: next }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setOptimistic((prev) => ({ ...prev, [item.id]: item.enabled }))
        toast.error(data.error ?? '操作失败，请稍后重试')
        return
      }
      toast.success(next ? `已开启「${item.name}」` : `已关闭「${item.name}」`)
      router.refresh()
    } catch {
      setOptimistic((prev) => ({ ...prev, [item.id]: item.enabled }))
      toast.error('网络错误，请稍后重试')
    } finally {
      setBusyId(null)
    }
  }

  const ready = items.filter((p) => p.status === 'ready')
  const comingSoon = items.filter((p) => p.status === 'coming-soon')

  const renderRow = (p: PluginViewItem) => {
    const enabled = optimistic[p.id] ?? p.enabled
    const pending = p.status === 'coming-soon'
    const selected = selectedId === p.id
    return (
      <div
        key={p.id}
        id={p.id}
        className={cn(
          'flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0',
          selected && '-mx-3 rounded-lg bg-muted/60 px-3',
        )}
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/plugins/${p.id}`}
              className={cn('text-sm font-semibold underline-offset-4 hover:underline', pending && 'text-muted-foreground')}
            >
              {p.name}
            </Link>
            {pending ? (
              <Badge variant="outline" className="text-muted-foreground">
                待开发
              </Badge>
            ) : (
              <Badge variant={enabled ? 'success' : 'outline'}>{enabled ? '已开启' : '已关闭'}</Badge>
            )}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{p.description}</p>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[11px] text-muted-foreground">{pending ? '规划位置：' : '生效位置：'}{p.where}</span>
            <span className="text-[11px] text-muted-foreground">·</span>
            {p.provides.map((x) => (
              <span key={x} className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {x}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          {pending ? (
            <span className="text-xs text-muted-foreground">待开发</span>
          ) : (
            <Switch
              id={`plugin-${p.id}`}
              checked={enabled}
              disabled={busyId === p.id}
              onCheckedChange={(next) => void toggle(p, next)}
              aria-label={`切换${p.name}`}
            />
          )}
          <Button asChild variant="ghost" size="xs" className="text-muted-foreground">
            <Link href={`/plugins/${p.id}`}>
              详情
              <ChevronRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {ready.length ? (
        <Card>
          <CardHeader>
            <CardTitle>已开发插件</CardTitle>
            <CardDescription>可以随时按需开启或关闭；关闭后相关入口自动隐藏，已有项目和报价数据不受影响</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">{ready.map(renderRow)}</CardContent>
        </Card>
      ) : null}
      {comingSoon.length ? (
        <Card>
          <CardHeader>
            <CardTitle>待开发插件</CardTitle>
            <CardDescription>围绕现场勘测、强弱电交底、采购备货与售后维保的外围能力规划，后续按独立插件逐步接入</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">{comingSoon.map(renderRow)}</CardContent>
        </Card>
      ) : null}
    </div>
  )
}
