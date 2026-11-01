import Link from 'next/link'
import { ArrowRight, Check, CircleCheck, ScanLine, SlidersHorizontal, Sparkles } from 'lucide-react'

import { PointMarker } from '@/components/point-marker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PROJECT_SECTIONS } from '@/lib/projects'
import { yuan } from '@/lib/quotes'
import { cn } from '@/lib/utils'
import { SELECTION_TIERS } from '@/plugins/smart-select/auto-select'

import { CountUp } from './count-up'
import { DEMO_QUOTE, DEMO_QUOTE_TOTALS, PLAN_POINTS, PLAN_ROOMS, planCategories } from './demo-data'
import { FloorPlanDemo } from './floor-plan-demo'

const HIGHLIGHTS = ['网页 + 微信小程序', '多人协作同一个项目', '一键导出 PDF 与图片']

/** 智能选型三档的示意总价（标准档与示例报价一致） */
const TIER_TOTALS: Record<string, number> = { economy: 9_800, standard: DEMO_QUOTE_TOTALS.total, premium: 31_600 }
const wan = (n: number) => `¥${(n / 10_000).toFixed(2)} 万`

/** 首屏：标题、行动按钮，以及一个正在「自动布点」的工作台窗口。 */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      <HeroBackdrop />
      <div className="mx-auto max-w-7xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 id="hero-title" className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl motion-safe:animate-rise">
            画完点位，
            <span className="text-primary">报价就好了</span>
          </h1>
          {/* 按分句换行：中文自动平衡换行会把「型号」这类词拆开 */}
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg motion-safe:animate-rise [--landing-delay:120ms]">
            <span className="inline-block">上传户型图，AI 自动识别点位、匹配型号，</span>
            <span className="inline-block">一键导出报价单、合同与施工交底。</span>
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3 motion-safe:animate-rise [--landing-delay:240ms]">
            <Button asChild size="lg" className="h-11 rounded-full px-6 text-base">
              <Link href="/projects">
                进入工作台
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11 rounded-full px-6 text-base">
              <Link href="#quote">看看报价单</Link>
            </Button>
          </div>
          <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground motion-safe:animate-rise [--landing-delay:320ms]">
            {HIGHLIGHTS.map((text) => (
              <li key={text} className="flex items-center gap-1.5">
                <CircleCheck className="size-4 text-chart-2" />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <HeroVisual />
      </div>
    </section>
  )
}

/** 背景：细网格 + 三团缓慢漂移的极光 */
function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute inset-0 landing-grid landing-mask-radial opacity-70" />
      <div className="absolute -top-48 left-1/2 size-160 -translate-x-1/2 rounded-full bg-chart-1/25 blur-3xl motion-safe:animate-aurora" />
      <div className="absolute top-48 -left-48 size-120 rounded-full bg-chart-4/20 blur-3xl motion-safe:animate-aurora [--landing-delay:-7s]" />
      <div className="absolute top-72 -right-48 size-120 rounded-full bg-chart-2/15 blur-3xl motion-safe:animate-aurora [--landing-delay:-14s]" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-linear-to-b from-transparent to-background" />
    </div>
  )
}

/** 工作台窗口：设备面板 + 动态点位图，四周漂浮 AI 识别、智能选型、报价卡片 */
function HeroVisual() {
  const categories = planCategories()
  const lines = DEMO_QUOTE.items.slice(0, 3)
  return (
    <div className="relative mx-auto mt-16 max-w-6xl motion-safe:animate-rise [--landing-delay:420ms] sm:mt-20">
      <div aria-hidden className="absolute -inset-x-8 -top-10 bottom-16 -z-10 rounded-4xl bg-linear-to-b from-chart-1/30 via-chart-4/15 to-transparent blur-3xl" />
      <div className="overflow-hidden rounded-2xl border border-border bg-card/80 shadow-2xl ring-1 ring-foreground/5 backdrop-blur-xl">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
          <div aria-hidden className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-chart-5/80" />
            <span className="size-2.5 rounded-full bg-chart-3/80" />
            <span className="size-2.5 rounded-full bg-chart-2/80" />
          </div>
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            <span className="text-foreground">湖山赋 A区 12栋</span> · 三层联排别墅
          </p>
          <div aria-hidden className="hidden items-center gap-0.5 rounded-lg bg-muted/70 p-0.5 md:flex">
            {PROJECT_SECTIONS.map((s) => (
              <span key={s.key} className={cn('rounded-md px-2.5 py-1 text-xs', s.key === 'points' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground')}>
                {s.label}
              </span>
            ))}
          </div>
          <Badge variant="success" className="hidden sm:inline-flex">
            <Check />
            已自动保存
          </Badge>
        </div>
        <div className="grid lg:grid-cols-12">
          <aside aria-label="设备面板（演示）" className="hidden border-r border-border p-4 lg:col-span-3 lg:block">
            <p className="text-xs font-medium text-muted-foreground">设备面板</p>
            <ul className="mt-3 space-y-1">
              {categories.map((c, i) => (
                <li key={c.slug} className={cn('flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm', i === 0 ? 'bg-muted text-foreground' : 'text-muted-foreground')}>
                  <PointMarker type={c.sampleType} className="size-5" />
                  <span className="flex-1">{c.name}</span>
                  <span className="text-xs tabular-nums">{c.count}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5 font-medium text-foreground">
                <ScanLine className="size-3.5 text-chart-1" />
                AI 识别户型图
              </p>
              <p className="mt-1">拖入开关插座布置图，自动生成点位</p>
            </div>
          </aside>
          <div className="p-3 sm:p-5 lg:col-span-9">
            <FloorPlanDemo variant="hero" />
          </div>
        </div>
      </div>

      <FloatCard className="top-24 -left-4 hidden md:block xl:-left-14">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-chart-4/20 text-chart-4">
            <Sparkles className="size-4.5" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">AI 识别户型图</p>
            <p className="text-sm font-semibold">
              已识别 <CountUp value={PLAN_POINTS.length} delay={1300} duration={2000} /> 个点位
            </p>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full origin-left rounded-full bg-linear-to-r from-chart-4 to-chart-1 motion-safe:animate-progress [--landing-delay:1.3s]" />
        </div>
        <p className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{PLAN_ROOMS.length} 个房间</span>
          <span>3 张图纸</span>
        </p>
      </FloatCard>

      <FloatCard className="top-36 -right-4 hidden lg:block xl:-right-20" delay="-4s">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <SlidersHorizontal className="size-3.5 text-chart-3" />
          智能选型 · 一键套用
        </p>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {SELECTION_TIERS.map((t) => (
            <div
              key={t.value}
              className={cn('rounded-lg border px-2 py-1.5 text-center', t.value === 'standard' ? 'border-chart-1/60 bg-chart-1/15 text-foreground' : 'border-border text-muted-foreground')}
            >
              <p className="text-xs">{t.label}</p>
              <p className="mt-0.5 text-xs font-semibold tabular-nums">{wan(TIER_TOTALS[t.value] ?? 0)}</p>
            </div>
          ))}
        </div>
      </FloatCard>

      <FloatCard className="-right-3 bottom-8 hidden sm:block xl:-right-14" delay="-2s">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">报价总额</p>
          <Badge variant="success">已生成报价单</Badge>
        </div>
        <p className="mt-1 text-2xl font-semibold tracking-tight">
          <CountUp value={DEMO_QUOTE_TOTALS.total} prefix="¥" delay={1600} duration={1800} />
        </p>
        <ul className="mt-3 space-y-2 border-t border-border pt-3">
          {lines.map((item) => (
            <li key={item.sku} className="flex items-center gap-2 text-xs">
              <PointMarker type={item.type} className="size-4" />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{item.name}</span>
              <span className="tabular-nums">{yuan(item.price * item.qty)}</span>
            </li>
          ))}
        </ul>
      </FloatCard>
    </div>
  )
}

function FloatCard({ className, delay = '0s', children }: { className?: string; delay?: string; children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      className={cn('absolute z-10 w-64 rounded-2xl border border-border bg-card/90 p-4 text-left shadow-2xl backdrop-blur-xl motion-safe:animate-float', className)}
      style={{ animationDelay: delay }}
    >
      {children}
    </div>
  )
}
