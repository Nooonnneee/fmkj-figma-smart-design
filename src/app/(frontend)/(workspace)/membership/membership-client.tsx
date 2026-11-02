'use client'

import { useRef, useState, useTransition } from 'react'
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
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

const TIER_PERKS: Record<MembershipTier, { tag?: string; highlights: string[] }> = {
  free: {
    highlights: [
      '10 个进行中项目（归档不占额度）',
      '每个项目最多 2 位协作成员',
      '基础横版方案模板与核心流程',
      '点位图、报价单、合同与交底单 PDF 导出',
    ],
  },
  pro: {
    tag: '推荐订阅',
    highlights: [
      '每月免费赠送 300 AI 积分（识图布点 / 方案生成）',
      '50 个进行中项目 + 每项目 5 人协同设计',
      '解锁全部高定方案模板（栖序雅致 / 东方雅韵 / 墨金臻选）',
      '解锁全部施工与算量扩展插件（布线表 / 备货单 / 勘测单 / DWG）',
      '业主交付资料包一键合并 PDF 与打包 ZIP',
    ],
  },
  team: {
    tag: '团队尊享',
    highlights: [
      '每月免费赠送 1,000 AI 积分（高频识图与全案生成）',
      '不限进行中项目数量，大型工程团队无限扩容',
      '不限项目协作成员（支持可编辑 / 仅查看权限分级）',
      '包含专业版全部高定方案模板与施工交付插件',
      '包含业主交付资料包一键打包与团队级优先支持',
    ],
  },
}

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
  const redeemInputRef = useRef<HTMLInputElement>(null)
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
      <PageHeader
        title="会员与积分"
        description="升级专业版或旗舰版，解锁全套高定方案模板、专业施工算量插件、业主交付资料包与每月赠送 AI 积分。"
      />

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
              ref={redeemInputRef}
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

      {/* 订阅方案与核心优势卡片 */}
      <div className="grid gap-4 lg:grid-cols-3">
        {initial.tiers.map((tier) => {
          const isCurrent = m.effectiveTier === tier.value
          const isPro = tier.value === 'pro'
          const meta = TIER_PERKS[tier.value]
          return (
            <Card
              key={tier.value}
              className={cn(
                'flex flex-col justify-between py-5 transition-all',
                isPro && 'border-primary bg-primary/[0.02] shadow-sm ring-1 ring-primary/25',
              )}
            >
              <CardHeader className="space-y-2 pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{tier.label}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">{tier.description}</p>
                  </div>
                  {isCurrent ? (
                    <Badge variant="secondary">当前方案</Badge>
                  ) : meta.tag ? (
                    <Badge variant={isPro ? 'default' : 'outline'}>{meta.tag}</Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="flex-1 py-4">
                <ul className="space-y-2.5 text-sm">
                  {meta.highlights.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <div className="px-6 pt-1">
                {isCurrent ? (
                  <Button variant="outline" size="sm" className="w-full" disabled>
                    当前正在使用
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant={isPro ? 'default' : 'secondary'}
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      redeemInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      redeemInputRef.current?.focus()
                    }}
                  >
                    <Sparkles className="size-3.5" />
                    使用兑换码开通{tier.badge}
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {/* 完整会员权益对比表 */}
      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-base">版本权益完整对比</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-2/5 pl-6">权益项</TableHead>
                {initial.tiers.map((t) => (
                  <TableHead key={t.value} className="text-center">
                    <span className={cn(t.value === 'pro' && 'font-semibold text-primary')}>{t.badge}</span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {initial.benefitRows.map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="pl-6">
                    <span className="font-medium">{row.label}</span>
                    {row.hint ? <span className="block text-xs text-muted-foreground">{row.hint}</span> : null}
                  </TableCell>
                  {initial.tiers.map((t) => {
                    const val = row.values[t.value]
                    return (
                      <TableCell key={t.value} className="text-center">
                        {typeof val === 'boolean' ? (
                          val ? (
                            <Check className="mx-auto size-4 text-primary" />
                          ) : (
                            <Minus className="mx-auto size-4 text-muted-foreground/40" />
                          )
                        ) : (
                          <span className={cn('text-sm tabular-nums', t.value === 'pro' && 'font-medium text-primary')}>{val}</span>
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 最近积分明细 */}
      {initial.ledger.length > 0 ? (
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="border-b py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4 text-muted-foreground" />
              最近积分明细
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">说明</TableHead>
                  <TableHead className="text-right">变动</TableHead>
                  <TableHead className="text-right">结余</TableHead>
                  <TableHead className="pr-6 text-right">时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initial.ledger.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="pl-6">
                      <span className="font-medium">{row.reason}</span>
                      {row.model ? <span className="ml-2 text-xs text-muted-foreground">{row.model}</span> : null}
                    </TableCell>
                    <TableCell className={cn('text-right font-medium tabular-nums', row.delta > 0 ? 'text-emerald-600' : 'text-foreground')}>
                      {row.delta > 0 ? `+${row.delta}` : row.delta}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">{row.balanceAfter}</TableCell>
                    <TableCell className="pr-6 text-right text-xs text-muted-foreground tabular-nums">{fmtDateTime(row.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </section>
  )
}
