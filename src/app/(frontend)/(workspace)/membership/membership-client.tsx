'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Coins, Crown, FolderKanban, Gift, History, Loader2, Minus, Sparkles, Users } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader title="会员与积分" description="会员决定项目额度、协作人数、可用的方案模板与插件；AI 对话按积分计费" />

      {!initial.strict ? (
        <p className="-mt-2 rounded-lg bg-muted/60 px-4 py-2.5 text-xs text-muted-foreground">当前为试运营：所有功能都可以使用，标注的会员等级只作提示。</p>
      ) : null}

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
            <p className="text-xs text-muted-foreground">
              {m.expired ? (
                <span className="text-warning">已于 {fmtDate(m.expiresAt)} 到期，已恢复为标准体验版</span>
              ) : m.expiresAt ? (
                `有效期至 ${fmtDate(m.expiresAt)}`
              ) : m.effectiveTier === 'free' ? (
                '输入兑换码即可升级'
              ) : (
                '长期有效'
              )}
            </p>
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
            {limit ? <Progress value={usage} aria-label="项目额度用量" /> : <p className="text-xs text-muted-foreground">归档项目不占额度</p>}
          </div>
          <div className="space-y-2 px-6 py-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Coins className="size-3.5" />
              AI 积分余额
            </p>
            <p className="text-2xl font-semibold tabular-nums">{initial.aiCredits.toLocaleString('zh-CN')}</p>
            <p className="text-xs text-muted-foreground">{m.monthlyCredits ? `每月可领取 ${m.monthlyCredits} 积分` : '按实际调用扣减，可用兑换码充值'}</p>
          </div>
          <div className="space-y-2 px-6 py-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="size-3.5" />
              每个项目的协作成员
            </p>
            <p className="text-2xl font-semibold tabular-nums">{m.collaboratorLimit === null ? '不限' : `${m.collaboratorLimit} 人`}</p>
            <p className="text-xs text-muted-foreground">在项目里通过「协作」邀请</p>
          </div>
        </div>
      </Card>

      <Card className="py-4">
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-muted-foreground" />
              兑换码开通、续期或充值积分
            </p>
            <p className="text-xs text-muted-foreground">{initial.upgradeHint}</p>
          </div>
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

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-base">会员权益对比</CardTitle>
          <CardDescription>方案模板和插件的等级可在后台调整，这里按当前设置统计</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[34%] pl-6">权益</TableHead>
                {initial.tiers.map((t) => (
                  <TableHead key={t.value} className={cn('text-center', m.effectiveTier === t.value && 'bg-primary/5')}>
                    <div className="flex flex-col items-center gap-0.5 py-2">
                      <span className="font-semibold text-foreground">{t.label}</span>
                      <span className="text-xs font-normal">{t.price}</span>
                      {m.effectiveTier === t.value ? <Badge className="mt-1">当前</Badge> : null}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {initial.benefitRows.map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="pl-6 align-top whitespace-normal">
                    <div className="font-medium">{row.label}</div>
                    {row.hint ? <div className="mt-0.5 text-xs text-muted-foreground">{row.hint}</div> : null}
                  </TableCell>
                  {initial.tiers.map((t) => {
                    const v = row.values[t.value]
                    return (
                      <TableCell key={t.value} className={cn('text-center tabular-nums', m.effectiveTier === t.value && 'bg-primary/5')}>
                        {v === true ? (
                          <Check className="mx-auto size-4 text-success" aria-label="包含" />
                        ) : v === false ? (
                          <Minus className="mx-auto size-4 text-muted-foreground/60" aria-label="不包含" />
                        ) : (
                          v
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
              <TableRow className="hover:bg-transparent">
                <TableCell className="pl-6 text-xs text-muted-foreground">适合</TableCell>
                {initial.tiers.map((t) => (
                  <TableCell key={t.value} className={cn('text-center text-xs whitespace-normal text-muted-foreground', m.effectiveTier === t.value && 'bg-primary/5')}>
                    {t.description}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4 text-muted-foreground" />
            积分明细
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {initial.ledger.length === 0 ? (
            <div className="mx-6 mb-6 flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
              <Coins className="size-6 text-muted-foreground" />
              <p className="text-sm font-medium">还没有积分流水</p>
              <p className="max-w-sm text-xs text-muted-foreground">使用 AI 对话、兑换积分、领取会员积分或管理员发放积分后，每一笔增减都会记录在这里。</p>
              <Button asChild size="sm" variant="outline" className="mt-1">
                <Link href="/ai">去 AI 对话</Link>
              </Button>
            </div>
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
                      {new Date(row.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
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
