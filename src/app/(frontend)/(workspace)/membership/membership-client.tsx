'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Coins, Crown, FolderKanban, Gift, History, Loader2, Minus, Sparkles, Users } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { MembershipState, MembershipTier } from '@/lib/membership'
import { cn } from '@/lib/utils'

import { claimMonthlyCredits } from './actions'

type TierItem = { value: MembershipTier; label: string; badge: string; price: string; description: string }
type BenefitRow = { label: string; hint?: string; values: Record<MembershipTier, string | boolean> }
type LedgerRow = { id: string; delta: number; balanceAfter: number; reason: string; model: string | null; createdAt: string }

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }) : null)

/** 会员与积分：当前方案与用量 → 领取本月积分 / 兑换码 → 权益对比 → 积分明细 */
export function MembershipClient({
  initial,
}: {
  initial: {
    name: string
    email: string
    aiCredits: number
    activeProjectCount: number
    membership: MembershipState
    claimedThisMonth: boolean
    strict: boolean
    upgradeHint: string
    tiers: TierItem[]
    benefitRows: BenefitRow[]
    ledger: LedgerRow[]
  }
}) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [pending, startTransition] = useTransition()
  const [claiming, startClaim] = useTransition()
  const m = initial.membership
  const limit = m.activeProjectLimit
  const usage = limit ? Math.min(100, (initial.activeProjectCount / limit) * 100) : 0

  function handleRedeem(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) return void toast.error('请输入兑换码')
    startTransition(async () => {
      try {
        const res = await fetch('/membership/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: trimmed }),
        })
        const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null
        if (!res.ok || !data?.ok) return void toast.error(data?.error || '兑换失败，请核对兑换码')
        toast.success(data.message || '兑换成功')
        setCode('')
        router.refresh()
      } catch {
        toast.error('网络错误，请稍后重试')
      }
    })
  }

  const claim = () =>
    startClaim(async () => {
      const res = await claimMonthlyCredits()
      if (!res.ok) return void toast.error(res.error)
      toast.success(`已领取本月 ${res.credits} 积分`)
      router.refresh()
    })

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <PageHeader title="会员与积分" />

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-start justify-between gap-4 bg-linear-to-br from-primary/10 via-transparent to-transparent px-6 py-5">
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Crown className="size-3.5" />
              当前会员
            </p>
            <div className="flex items-center gap-2">
              <p className="text-xl font-semibold">{m.label}</p>
              <Badge variant={m.effectiveTier === 'free' ? 'secondary' : 'default'}>{m.badge}</Badge>
            </div>
            {m.expired ? (
              <p className="text-xs text-warning">已于 {fmtDate(m.expiresAt)} 到期，已恢复为标准体验版</p>
            ) : m.expiresAt ? (
              <p className="text-xs text-muted-foreground">有效期至 {fmtDate(m.expiresAt)}</p>
            ) : m.effectiveTier !== 'free' ? (
              <p className="text-xs text-muted-foreground">长期有效</p>
            ) : null}
          </div>
          {m.monthlyCredits ? (
            <Button onClick={claim} disabled={claiming || initial.claimedThisMonth} variant={initial.claimedThisMonth ? 'outline' : 'default'}>
              {claiming ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />}
              {initial.claimedThisMonth ? '本月积分已领取' : `领取本月 ${m.monthlyCredits} 积分`}
            </Button>
          ) : null}
        </div>
        <div className="grid divide-y border-t sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="space-y-2 px-6 py-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FolderKanban className="size-3.5" />
              进行中项目
            </p>
            <p className="text-2xl font-semibold tabular-nums">
              {initial.activeProjectCount}
              <span className="text-sm font-normal text-muted-foreground"> / {limit === null ? '不限' : `${limit} 个`}</span>
            </p>
            {limit ? <Progress value={usage} aria-label="项目额度用量" /> : null}
          </div>
          <div className="space-y-2 px-6 py-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Coins className="size-3.5" />
              AI 积分余额
            </p>
            <p className="text-2xl font-semibold tabular-nums">{initial.aiCredits.toLocaleString('zh-CN')}</p>
            {m.monthlyCredits ? <p className="text-xs text-muted-foreground">每月可领取 {m.monthlyCredits} 积分</p> : null}
          </div>
          <div className="space-y-2 px-6 py-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="size-3.5" />
              每个项目的协作成员
            </p>
            <p className="text-2xl font-semibold tabular-nums">{m.collaboratorLimit === null ? '不限' : `${m.collaboratorLimit} 人`}</p>
          </div>
        </div>
      </Card>

      <Card className="py-4">
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="size-4 text-muted-foreground" />
            兑换会员或积分
          </p>
          <form onSubmit={handleRedeem} className="flex flex-1 flex-col gap-2 sm:max-w-md sm:flex-row">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="FMKJ-XXXX-XXXX-XXXX"
              aria-label="兑换码"
              maxLength={40}
              disabled={pending}
              className="font-mono tracking-wider uppercase"
            />
            <Button type="submit" disabled={pending} className="shrink-0">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />}
              兑换
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}
