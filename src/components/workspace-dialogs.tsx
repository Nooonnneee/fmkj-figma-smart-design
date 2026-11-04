'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, Coins, Crown, Gift, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { MEMBERSHIP_TIERS } from '@/lib/membership'
import { cn } from '@/lib/utils'

const TIER_HIGHLIGHTS: Record<string, { subtitle: string; tag?: string; perks: string[] }> = {
  free: {
    subtitle: '个人设计师入门体验',
    tag: '免费',
    perks: [
      '10 个进行中项目 · 每项目 2 人协作',
      'AI 模型：Go 标准高速国产模型（DeepSeek-V3 / 通义 Qwen-Plus / 豆包 Pro）',
      '方案模板：栖序雅致、原木自然、预算速览（3 套）',
      '基础插件：方案演示、房间分析、智能选型、AI 识图、现场勘测单',
    ],
  },
  pro: {
    subtitle: '独立设计师与工作室主力首选',
    tag: '推荐订阅',
    perks: [
      '每月免费赠送 300 AI 积分 · 50 个项目 · 5 人协同',
      'AI 高阶模型：解锁 Plus 视觉多模态模型（Qwen-VL-Max / 豆包 Vision-Pro / GLM-4V-Plus / Kimi K2）',
      '高定模板：解锁「墨金臻选」「智域科技」「晨曦暖调」「素白极简」+ 6 套报价风格包',
      '进阶插件：解锁 AI 对话侧栏、DWG 导入、强弱电布线表、场景与账号移交单',
      '交付特权：解锁「业主交付资料包」一键合并 PDF 与 ZIP 打包',
    ],
  },
  team: {
    subtitle: '全屋智能集成商与工程团队旗舰',
    tag: '旗舰尊享',
    perks: [
      '每月免费赠送 1,000 AI 积分 · 不限项目数 · 不限协作成员',
      'AI 旗舰模型：独占 Pro 满血深度推理模型（DeepSeek-R1 / 通义 QwQ-Plus / QVQ-Max / 豆包 Thinking）',
      '顶奢模板：包含 Plus 全部模板 + 独占「东方雅韵」顶奢新中式别墅提案',
      '工程插件：包含 Plus 全部插件 + 独占「采购与备货核验单」「售后维保记录」',
      '包含业主交付资料包一键打包与团队级技术支持',
    ],
  },
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
  const inputRef = useRef<HTMLInputElement>(null)
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const currentBadge = membershipBadge || 'Go'

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
      <DialogContent className="max-h-[90vh] max-w-4xl gap-5 overflow-y-auto p-6 sm:max-w-4xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
            <div>
              <DialogTitle className="text-lg font-semibold">会员订阅（Go / Plus / Pro）与 AI 积分</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
                升级 Plus 或 Pro 会员，解锁高阶视觉/深度推理大模型、高定方案模板、施工算量插件、一键交付资料包与每月赠分
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-1.5 text-xs">
              <span className="flex items-center gap-1 font-medium">
                <Crown className="size-3.5 text-primary" />
                当前：{currentBadge}
              </span>
              <span aria-hidden className="text-muted-foreground/60">|</span>
              <span className="flex items-center gap-1 font-medium tabular-nums">
                <Coins className="size-3.5 text-primary" />
                {credits.toLocaleString('zh-CN')} 积分
              </span>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-3.5 md:grid-cols-3">
          {MEMBERSHIP_TIERS.map((tier) => {
            const isCurrent = tier.badge === currentBadge
            const isPro = tier.value === 'pro'
            const info = TIER_HIGHLIGHTS[tier.value] ?? { subtitle: tier.description, perks: [...tier.features] }
            return (
              <div
                key={tier.value}
                className={cn(
                  'relative flex flex-col justify-between rounded-xl border p-4 transition-all',
                  isPro ? 'border-primary bg-primary/[0.03] shadow-sm ring-1 ring-primary/25' : 'bg-card',
                )}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-base font-semibold">{tier.label}</h3>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{info.subtitle}</p>
                    </div>
                    {isCurrent ? (
                      <Badge variant="secondary" className="shrink-0">
                        当前方案
                      </Badge>
                    ) : info.tag ? (
                      <Badge variant={isPro ? 'default' : 'outline'} className="shrink-0">
                        {info.tag}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="flex items-baseline justify-between border-y py-2.5">
                    <div>
                      <span className="text-xs text-muted-foreground">项目上限 </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {tier.activeProjectLimit === null ? '不限' : `${tier.activeProjectLimit} 个`}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">每月赠 </span>
                      <span className="text-sm font-semibold text-primary tabular-nums">
                        {tier.monthlyCredits ? `${tier.monthlyCredits} 积分` : '—'}
                      </span>
                    </div>
                  </div>

                  <ul className="space-y-2 text-xs leading-relaxed">
                    {info.perks.map((perk) => (
                      <li key={perk} className="flex items-start gap-2">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 pt-2">
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
                      onClick={() => inputRef.current?.focus()}
                    >
                      <Sparkles className="size-3.5" />
                      使用兑换码开通{tier.badge}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex flex-col gap-3 rounded-xl border bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between">
          <form onSubmit={handleRedeem} className="flex flex-1 items-center gap-2">
            <Input
              ref={inputRef}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="输入会员或积分兑换码（如 FMKJ-XXXX-XXXX）"
              aria-label="兑换码"
              maxLength={40}
              disabled={pending}
              className="bg-background font-mono tracking-wider uppercase"
            />
            <Button type="submit" disabled={pending} className="shrink-0">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />}
              立即兑换
            </Button>
          </form>
          <Button asChild variant="ghost" size="sm" className="shrink-0 text-xs text-muted-foreground hover:text-foreground">
            <Link href="/membership" onClick={() => onOpenChange(false)}>
              查看完整对比与积分明细
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
