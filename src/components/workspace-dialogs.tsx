'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Blocks, Coins, Crown, Gift, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { PLUGIN_ICONS } from '@/app/(frontend)/(workspace)/plugins/plugin-icons'
import type { SidebarPlugin } from '@/components/app-sidebar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { PluginId } from '@/plugins/types'

export function PluginsDialog({
  open,
  onOpenChange,
  plugins,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  plugins: SidebarPlugin[]
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({})
  const readyPlugins = plugins.filter((p) => p.status === 'ready')

  async function toggle(item: SidebarPlugin, next: boolean) {
    if (busyId) return
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-4 p-5 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">插件市场</DialogTitle>
          <DialogDescription className="sr-only">按需开启或关闭扩展插件</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2 sm:grid-cols-2">
          {readyPlugins.map((p) => {
            const enabled = optimistic[p.id] ?? p.enabled
            const Icon = PLUGIN_ICONS[p.id as PluginId] ?? Blocks
            return (
              <li key={p.id} className="flex items-center justify-between gap-2.5 rounded-xl border px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-lg border',
                      enabled ? 'border-primary/20 bg-primary/10 text-primary' : 'bg-muted/60 text-muted-foreground',
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="truncate text-sm font-medium">{p.name.replace(/（.*?）/, '')}</span>
                </div>
                <Switch
                  checked={enabled}
                  disabled={busyId === p.id}
                  onCheckedChange={(next) => void toggle(p, next)}
                  aria-label={`切换${p.name}`}
                />
              </li>
            )
          })}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

export function MembershipDialog({
  open,
  onOpenChange,
  membershipBadge,
  credits,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  membershipBadge?: string
  credits: number
}) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) {
      toast.error('请输入兑换码')
      return
    }
    setPending(true)
    try {
      const res = await fetch('/membership/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string }
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? '兑换失败，请检查兑换码')
        return
      }
      toast.success(data.message ?? '兑换成功')
      setCode('')
      router.refresh()
    } catch {
      toast.error('网络错误，请稍后重试')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-5 p-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">会员与积分</DialogTitle>
          <DialogDescription className="sr-only">查看当前会员等级、AI 积分余额与兑换码激活</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border bg-muted/30 p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Crown className="size-3.5" />
              当前等级
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-base font-semibold">{membershipBadge || '体验版'}</span>
              <Badge variant="secondary" className="text-xs">
                生效中
              </Badge>
            </div>
          </div>
          <div className="rounded-xl border bg-muted/30 p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Coins className="size-3.5" />
              AI 积分
            </div>
            <div className="mt-1.5 text-xl font-semibold tabular-nums">{credits.toLocaleString('zh-CN')}</div>
          </div>
        </div>

        <form onSubmit={handleRedeem} className="space-y-2.5">
          <p className="text-xs font-medium text-muted-foreground">使用兑换码升级会员或充值积分</p>
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="FMKJ-XXXX-XXXX"
              aria-label="兑换码"
              maxLength={40}
              disabled={pending}
              className="font-mono tracking-wider uppercase"
            />
            <Button type="submit" disabled={pending} className="shrink-0">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />}
              兑换
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
