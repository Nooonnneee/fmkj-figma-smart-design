'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Check, Coins, Gift, History } from 'lucide-react'

import { PageHeader } from '@/components/page-header'
import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { Card as AstryxCard } from '@astryxdesign/core/Card'
import { Layout, LayoutContent, LayoutHeader } from '@astryxdesign/core/Layout'
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from '@astryxdesign/core/Table'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useToast } from '@astryxdesign/core/Toast'
import type { CreditTaskId, UserCreditTaskStatus } from '@/lib/credit-tasks'
import { cn } from '@/lib/utils'

import { claimTaskCredit } from './actions'

type LedgerRow = {
  id: string
  delta: number
  balanceAfter: number
  reason: string
  model: string | null
  createdAt: string
}

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

/** 积分与账单：积分余额 → 兑换码充值 → 任务领分 → 积分明细 */
export function MembershipClient({
  initial,
}: {
  initial: {
    aiCredits: number
    upgradeHint: string
    ledger: LedgerRow[]
    creditTasks?: UserCreditTaskStatus[]
  }
}) {
  const router = useRouter()
  const showToast = useToast()
  const [code, setCode] = useState('')
  const [pending, startTransition] = useTransition()
  const [claimingTaskId, setClaimingTaskId] = useState<string | null>(null)

  function handleRedeem(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) return void showToast({ body: '请输入兑换码', type: 'error' })
    startTransition(async () => {
      try {
        const res = await fetch('/membership/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: trimmed }),
        })
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean
          message?: string
          error?: string
        } | null
        if (!res.ok || !data?.ok)
          return void showToast({ body: data?.error || '兑换失败，请核对兑换码', type: 'error' })
        showToast({ body: data.message || '兑换成功' })
        setCode('')
        router.refresh()
      } catch {
        showToast({ body: '网络错误，请稍后重试', type: 'error' })
      }
    })
  }

  function handleClaimTask(taskId: CreditTaskId) {
    setClaimingTaskId(taskId)
    startTransition(async () => {
      try {
        const res = await claimTaskCredit(taskId)
        if (!res.ok) {
          showToast({ body: res.error, type: 'error' })
          return
        }
        showToast({ body: res.message })
        router.refresh()
      } finally {
        setClaimingTaskId(null)
      }
    })
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        title="会员与积分"
        description="平台所有功能统一按 AI 积分扣除，不再区分会员等级。可用兑换码充值积分，完成绑定与成长任务也可领取积分。"
        actions={
          <Button
            variant="secondary"
            size="sm"
            href="/docs#ai-billing"
            as={Link}
            icon={<BookOpen />}
            label="使用文档与计费规则"
          />
        }
      />

      <AstryxCard
        padding={0}
        className="overflow-hidden border-0 bg-card text-sm text-card-foreground shadow-xs ring-1 ring-border"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 bg-linear-to-br from-primary/10 via-transparent to-transparent px-6 py-5">
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Coins className="size-3.5" />
              AI 积分余额
            </p>
            <p className="text-3xl font-semibold tabular-nums">
              {initial.aiCredits.toLocaleString('zh-CN')}
            </p>
            <p className="text-xs text-muted-foreground">{initial.upgradeHint}</p>
          </div>
        </div>
      </AstryxCard>

      {/* py-4 反推：block 16px → padding={4}，槽的块向坍缩不影响（无 header） */}
      <AstryxCard
        padding={0}
        className="border-0 bg-card text-sm text-card-foreground shadow-xs ring-1 ring-border"
      >
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Gift className="size-4 text-muted-foreground" />
            输入兑换码充值 AI 积分
          </p>
          <form
            onSubmit={handleRedeem}
            className="flex flex-1 flex-col gap-2 sm:max-w-md sm:flex-row"
          >
            <TextInput
              label={'兑换码'}
              isLabelHidden
              value={code}
              onChange={(v) => setCode(v.toUpperCase())}
              placeholder="FMKJ-XXXX-XXXX-XXXX"
              aria-label="兑换码"
              isDisabled={pending}
              controlClassName="font-mono tracking-wider uppercase"
            />
            <Button
              type="submit"
              isDisabled={pending}
              className="shrink-0"
              isLoading={pending}
              icon={<Gift />}
              label="兑换"
            />
          </form>
        </div>
      </AstryxCard>

      {/* 积分任务与绑定奖励中心 */}
      {initial.creditTasks && initial.creditTasks.length > 0 ? (
        // py-5 反推：block 20px；header 到 content 再 12px → pb-3（pb-5 的 header 与 content 的 pt-5 取 max）
        <AstryxCard
          padding={0}
          className="border-0 bg-card text-sm text-card-foreground shadow-xs ring-1 ring-border"
        >
          <div className="px-5 pt-5 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 font-heading text-base font-semibold tracking-tight">
                  <Gift className="size-4 text-primary" />
                  积分任务与绑定奖励
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  绑定邮箱赠 10 积分、绑定微信小程序赠 10 积分、关注公众号赠 5
                  积分；每项任务每个账号限领一次，自动记入积分流水。
                </p>
              </div>
              <Badge
                variant="neutral"
                className="text-xs"
                label={`已完成 ${initial.creditTasks.filter((t) => t.claimed).length} /${' '}${initial.creditTasks.length}`}
              />
            </div>
          </div>
          <div className="grid gap-2.5 px-5 pt-3 pb-5 sm:grid-cols-2">
            {initial.creditTasks.map((task) => {
              const isBusy = claimingTaskId === task.id && pending
              return (
                <div
                  key={task.id}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-xl border p-3.5 transition-colors',
                    task.claimed ? 'bg-muted/30' : 'bg-card hover:border-primary/35',
                  )}
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {task.title}
                      </span>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.2 text-xs font-semibold text-primary tabular-nums">
                        +{task.credits} 积分
                      </span>
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
                  </div>
                  <div className="shrink-0">
                    {task.claimed ? (
                      <Badge
                        variant="neutral"
                        className="gap-1"
                        label={'已领取'}
                        icon={<Check />}
                      />
                    ) : task.eligible ? (
                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        isDisabled={isBusy}
                        isLoading={isBusy}
                        onClick={() => handleClaimTask(task.id)}
                        label={
                          task.id === 'follow_official_account'
                            ? '已关注 · 领 5 分'
                            : `领取 +${task.credits ?? 0} 积分`
                        }
                      />
                    ) : task.id === 'complete_company_profile' ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 text-xs"
                        href="/settings"
                        as={Link}
                        label="去设置"
                      />
                    ) : task.id === 'first_quote' ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 text-xs"
                        href="/projects"
                        as={Link}
                        label="去生成"
                      />
                    ) : (
                      <Badge variant="neutral" label={'待绑定'} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </AstryxCard>
      ) : null}

      {/* 最近积分明细 */}
      {initial.ledger.length > 0 ? (
        <AstryxCard
          padding={0}
          className="overflow-hidden border-0 bg-card text-sm text-card-foreground shadow-xs ring-1 ring-border"
        >
          <Layout
            height="auto"
            header={
              <LayoutHeader padding={0}>
                <div className="flex items-center gap-2 border-b px-5 pt-4 pb-5 font-heading text-base font-semibold tracking-tight">
                  <History className="size-4 text-muted-foreground" />
                  最近积分明细
                </div>
              </LayoutHeader>
            }
            content={
              <LayoutContent padding={0} isScrollable={false}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHeaderCell className="max-w-none pl-6">说明</TableHeaderCell>
                      <TableHeaderCell className="max-w-none text-right">变动</TableHeaderCell>
                      <TableHeaderCell className="max-w-none text-right">结余</TableHeaderCell>
                      <TableHeaderCell className="max-w-none pr-6 text-right">时间</TableHeaderCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {initial.ledger.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="max-w-none pl-6">
                          <span className="font-medium">{row.reason}</span>
                          {row.model ? (
                            <span className="ml-2 text-xs text-muted-foreground">{row.model}</span>
                          ) : null}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'max-w-none text-right font-medium tabular-nums',
                            row.delta > 0 ? 'text-success' : 'text-foreground',
                          )}
                        >
                          {row.delta > 0 ? `+${row.delta}` : row.delta}
                        </TableCell>
                        <TableCell className="max-w-none text-right text-muted-foreground tabular-nums">
                          {row.balanceAfter}
                        </TableCell>
                        <TableCell className="max-w-none pr-6 text-right text-xs text-muted-foreground tabular-nums">
                          {fmtDateTime(row.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </LayoutContent>
            }
          />
        </AstryxCard>
      ) : null}
    </section>
  )
}
