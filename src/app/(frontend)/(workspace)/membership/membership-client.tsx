'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Coins, Crown, FolderKanban, Gift, History, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { MembershipTier } from '@/lib/membership'
import { cn } from '@/lib/utils'

type TierItem = {
  value: MembershipTier
  label: string
  badge: string
  activeProjectLimit: number | null
  description: string
  features: string[]
}

type LedgerRow = {
  id: string
  delta: number
  balanceAfter: number
  reason: string
  model: string | null
  createdAt: string
}

export function MembershipClient({
  initial,
}: {
  initial: {
    name: string
    email: string
    aiCredits: number
    activeProjectCount: number
    membership: {
      rawTier: MembershipTier
      effectiveTier: MembershipTier
      expired: boolean
      expiresAt: string | null
      label: string
      badge: string
      activeProjectLimit: number | null
    }
    tiers: TierItem[]
    ledger: LedgerRow[]
  }
}) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [pending, startTransition] = useTransition()

  const m = initial.membership
  const limit = m.activeProjectLimit
  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : null

  function handleRedeem(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) {
      toast.error('请输入兑换码')
      return
    }
    startTransition(async () => {
      try {
        const res = await fetch('/membership/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: trimmed }),
        })
        const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null
        if (!res.ok || !data?.ok) {
          toast.error(data?.error || '兑换失败，请核对兑换码')
          return
        }
        toast.success(data.message || '兑换成功')
        setCode('')
        router.refresh()
      } catch {
        toast.error('网络错误，请稍后重试')
      }
    })
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader title="会员与积分" description="查看当前账号的会员权益、活跃项目额度、AI 积分余额，或使用兑换码激活升级" />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>当前会员等级</span>
              <Crown className="size-4 text-chart-4" />
            </CardDescription>
            <CardTitle className="flex items-center gap-2 text-xl">
              <span>{m.label}</span>
              <Badge variant={m.effectiveTier === 'free' ? 'secondary' : 'default'}>{m.badge}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {m.expired ? (
              <span className="text-warning">原会员已于 {fmtDate(m.expiresAt)} 到期，已恢复为标准体验版</span>
            ) : m.expiresAt ? (
              <span>有效期至 {fmtDate(m.expiresAt)}</span>
            ) : m.effectiveTier === 'free' ? (
              <span>输入兑换码可升级为专业版或旗舰版</span>
            ) : (
              <span>长期有效</span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>AI 积分余额</span>
              <Coins className="size-4 text-chart-3" />
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">{initial.aiCredits.toLocaleString('zh-CN')}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            用于 AI 户型点位识别、智能选型与 AI 方案助手对话
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>进行中项目额度</span>
              <FolderKanban className="size-4 text-chart-1" />
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {initial.activeProjectCount}
              <span className="text-sm font-normal text-muted-foreground"> / {limit === null ? '不限' : `${limit} 个`}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            已归档的项目不占用进行中额度
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gift className="size-4 text-chart-4" />
            使用兑换码激活会员或充值积分
          </CardTitle>
          <CardDescription>输入管理员发放的兑换码（如 FMKJ-XXXX-XXXX-XXXX），会员时长与 AI 积分立即到账</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRedeem} className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="请输入兑换码，例如 FMKJ-8K3P-9M2X-4Q7W"
              maxLength={40}
              disabled={pending}
              className="sm:max-w-sm font-mono uppercase tracking-wider"
            />
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              立即兑换
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-base font-semibold">会员等级与权益说明</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {initial.tiers.map((tier) => {
            const current = m.effectiveTier === tier.value
            return (
              <Card key={tier.value} className={cn(current && 'ring-2 ring-primary')}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{tier.label}</CardTitle>
                    {current ? <Badge>当前等级</Badge> : <Badge variant="outline">{tier.badge}</Badge>}
                  </div>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-xs text-muted-foreground">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4 text-muted-foreground" />
            AI 积分变动明细
          </CardTitle>
          <CardDescription>最近 30 条积分发放、兑换码充值与 AI 对话扣减记录</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {initial.ledger.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">暂无积分流水记录</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">说明</TableHead>
                  <TableHead>模型</TableHead>
                  <TableHead className="text-right">变动</TableHead>
                  <TableHead className="text-right">变动后余额</TableHead>
                  <TableHead className="pr-6 text-right">时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initial.ledger.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="pl-6 font-medium">{row.reason}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.model || '—'}</TableCell>
                    <TableCell className={cn('text-right font-semibold tabular-nums', row.delta > 0 ? 'text-success' : 'text-muted-foreground')}>
                      {row.delta > 0 ? `+${row.delta}` : row.delta}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.balanceAfter}</TableCell>
                    <TableCell className="pr-6 text-right text-xs text-muted-foreground tabular-nums">
                      {new Date(row.createdAt).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
