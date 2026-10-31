import Image from 'next/image'
import { Bot, Check, ClipboardCheck, FileSignature, House, MapPinned, Package, Presentation, QrCode, Receipt, Share2, Smartphone, Sparkles, Users, type LucideIcon } from 'lucide-react'

import { PointMarker } from '@/components/point-marker'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DEFAULT_PAYMENTS } from '@/lib/contracts'
import { yuan } from '@/lib/quotes'
import { cn } from '@/lib/utils'
import { SELECTION_TIERS } from '@/plugins/smart-select/auto-select'

import { brandBySlug, brandSrc } from './brand-logos'
import { DEMO_QUOTE_TOTALS, PLAN_H, PLAN_POINTS, PLAN_ROOMS, PLAN_W } from './demo-data'
import { Reveal } from './reveal'
import { SectionHeading } from './section-heading'

/** 「更多能力」便当格：每张卡片配一个小型示意界面 */
export function FeatureBento() {
  return (
    <section id="features" aria-labelledby="features-title" className="relative isolate scroll-mt-20 py-20 sm:py-28">
      <div aria-hidden className="pointer-events-none absolute top-1/4 left-1/2 -z-10 size-160 -translate-x-1/2 rounded-full bg-chart-2/10 blur-3xl" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading id="features-title" eyebrow="更多能力" title="一个工作台，覆盖方案全流程" description="从第一次见客户到交付验收，常用的工具都在这里。" />
        </Reveal>
        <div className="mt-14 grid gap-4 md:grid-cols-6">
          <FeatureCard
            className="md:col-span-4"
            icon={Presentation}
            tone="bg-chart-4/15 text-chart-4"
            title="方案演示"
            description="栖序提案等横版方案，自动套用点位图、房间分析与预算，一键导出 PDF。"
          >
            <DeckVisual />
          </FeatureCard>
          <FeatureCard className="md:col-span-2" delay={80} icon={Bot} tone="bg-chart-1/15 text-chart-1" title="AI 助手" description="一句话改方案：换型号、调预算、生成报价，结果直接写回项目。">
            <ChatVisual />
          </FeatureCard>
          <FeatureCard className="md:col-span-2" icon={FileSignature} tone="bg-chart-5/15 text-chart-5" title="合同与收款" description="报价一键转合同，付款节点和收款进度清清楚楚。">
            <PaymentsVisual />
          </FeatureCard>
          <FeatureCard className="md:col-span-2" delay={80} icon={ClipboardCheck} tone="bg-chart-2/15 text-chart-2" title="施工交底" description="按房间、设备或图纸生成交底清单，现场逐点打勾。">
            <ChecklistVisual />
          </FeatureCard>
          <FeatureCard className="md:col-span-2" delay={160} icon={Users} tone="bg-chart-3/15 text-chart-3" title="多人协作" description="分享链接邀请同事或施工方，可编辑、仅查看分级授权。">
            <CollaborationVisual />
          </FeatureCard>
          <FeatureCard className="md:col-span-3" icon={Smartphone} tone="bg-chart-2/15 text-chart-2" title="微信小程序" description="手机上看项目、改点位、发报价，扫码即可登录电脑端。">
            <PhoneVisual />
          </FeatureCard>
          <FeatureCard className="md:col-span-3" delay={80} icon={Package} tone="bg-chart-1/15 text-chart-1" title="产品库与智能选型" description="内置主流品牌产品库，经济、标准、高端三档一键套用。">
            <CatalogVisual />
          </FeatureCard>
        </div>
      </div>
    </section>
  )
}

function FeatureCard({
  icon: Icon,
  tone,
  title,
  description,
  className,
  delay = 0,
  children,
}: {
  icon: LucideIcon
  tone: string
  title: string
  description: string
  className?: string
  delay?: number
  children: React.ReactNode
}) {
  return (
    <Reveal delay={delay} className={cn('h-full', className)}>
      <Card className="h-full bg-card/60 transition-colors duration-300 hover:bg-card">
        <CardHeader>
          <span className={cn('mb-2 flex size-9 items-center justify-center rounded-xl', tone)}>
            <Icon className="size-4.5" />
          </span>
          <CardTitle>
            <h3>{title}</h3>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="mt-auto">{children}</CardContent>
      </Card>
    </Reveal>
  )
}

/* ---------- 方案演示：三张扇形展开的横版方案页 ---------- */

function DeckVisual() {
  return (
    <div aria-hidden className="relative h-60 sm:h-72">
      <MiniSlide className="top-10 left-[2%] w-1/2 -rotate-6 group-hover/card:-translate-x-3 group-hover/card:-rotate-9 md:w-[38%]" no="02" title="方案总览">
        <div className="space-y-1.5">
          {['w-4/5 bg-chart-1/70', 'w-3/5 bg-chart-2/70', 'w-2/5 bg-chart-3/70', 'w-1/3 bg-chart-4/70'].map((bar) => (
            <div key={bar} className={cn('h-1.5 rounded-full', bar)} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {['bg-chart-1/20', 'bg-chart-2/20', 'bg-chart-4/20'].map((tile) => (
            <span key={tile} className={cn('h-8 rounded-md', tile)} />
          ))}
        </div>
      </MiniSlide>
      <MiniSlide className="top-10 right-[2%] w-1/2 rotate-6 group-hover/card:translate-x-3 group-hover/card:rotate-9 md:w-[38%]" no="06" title="预算汇总">
        <div className="flex h-16 items-end gap-1.5">
          {['h-5 bg-chart-1/70', 'h-9 bg-chart-2/70', 'h-7 bg-chart-3/70', 'h-11 bg-chart-4/70', 'h-12 bg-chart-5/70', 'h-8 bg-chart-1/50'].map((bar) => (
            <span key={bar} className={cn('flex-1 rounded-sm', bar)} />
          ))}
        </div>
      </MiniSlide>
      <MiniSlide className="top-1 left-1/2 z-10 w-[64%] -translate-x-1/2 group-hover/card:-translate-y-2 md:w-[44%]" no="01" title="湖山赋 · 全屋智能设计方案">
        <MiniPlan />
        <p className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {PLAN_POINTS.length} 个点位 · {PLAN_ROOMS.length} 个区域
          </span>
          <span className="rounded bg-chart-4/15 px-1.5 text-chart-4">PDF</span>
        </p>
      </MiniSlide>
    </div>
  )
}

function MiniSlide({ className, no, title, children }: { className?: string; no: string; title: string; children: React.ReactNode }) {
  return (
    <div className={cn('absolute overflow-hidden rounded-xl border border-border bg-background p-3 shadow-2xl transition-transform duration-700 ease-out', className)}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-linear-to-br from-chart-1 to-chart-4" />
          <span className="h-1.5 w-10 rounded-full bg-muted" />
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">{no}</span>
      </div>
      <p className="mt-2 truncate text-xs font-semibold">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  )
}

/** 方案页里的迷你户型：房间轮廓 + 按设备类别着色的点位 */
const DOT_TONES: Record<string, string> = {
  switch: 'fill-chart-1',
  socket: 'fill-chart-2',
  lighting: 'fill-chart-3',
  sensor: 'fill-chart-2',
  security: 'fill-chart-5',
  curtain: 'fill-chart-5',
  gateway: 'fill-chart-4',
  network: 'fill-chart-4',
  vrf: 'fill-chart-3',
}

function MiniPlan() {
  return (
    <svg viewBox={`0 0 ${PLAN_W} ${PLAN_H}`} className="w-full rounded-md bg-muted/40" focusable="false">
      {PLAN_ROOMS.map((r) => (
        <rect key={r.name} x={r.x} y={r.y} width={r.w} height={r.h} className="fill-foreground/3 stroke-foreground/35" strokeWidth={4} />
      ))}
      {PLAN_POINTS.map((p) => (
        <circle key={p.id} cx={p.x} cy={p.y} r={11} className={DOT_TONES[p.category] ?? 'fill-muted-foreground'} />
      ))}
    </svg>
  )
}

/* ---------- AI 助手：对话气泡 ---------- */

function ChatVisual() {
  return (
    <div aria-hidden className="space-y-2.5">
      <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-xs text-primary-foreground">把客厅的筒灯都换成调光款</p>
      <div className="w-fit max-w-[90%] rounded-2xl rounded-bl-md border border-border bg-background px-3 py-2 text-xs">
        <p className="flex items-center gap-1.5 font-medium">
          <Sparkles className="size-3.5 text-chart-4" />
          已更换 4 处型号
        </p>
        <p className="mt-1 text-muted-foreground">报价已同步更新 +{yuan(640)}</p>
      </div>
      <div className="flex w-fit items-center gap-1 rounded-2xl rounded-bl-md border border-border bg-background px-3 py-2.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1.5 rounded-full bg-muted-foreground motion-safe:animate-typing" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    </div>
  )
}

/* ---------- 合同与收款：付款节点（与合同默认付款比例一致） ---------- */

const PAYMENT_TONES = ['bg-success', 'bg-chart-1/70', 'bg-muted-foreground/30']

function PaymentsVisual() {
  const total = DEMO_QUOTE_TOTALS.total
  const payments = DEFAULT_PAYMENTS.map((p, i) => ({
    name: p.name.split('（')[0] ?? p.name,
    percent: p.percent,
    amount: Math.round((total * p.percent) / 100),
    tone: PAYMENT_TONES[i] ?? PAYMENT_TONES[2],
    received: i === 0,
  }))
  return (
    <div aria-hidden className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">合同金额</span>
        <span className="text-lg font-semibold tabular-nums">{yuan(total)}</span>
      </div>
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
        {payments.map((p) => (
          <span key={p.name} className={cn('h-full', p.tone)} style={{ width: `${p.percent}%` }} />
        ))}
      </div>
      <ul className="space-y-1.5 text-xs">
        {payments.map((p) => (
          <li key={p.name} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <span className={cn('size-2 rounded-full', p.tone)} />
              {p.name} · {p.percent}%
            </span>
            <span className={cn('tabular-nums', p.received ? 'text-success' : 'text-muted-foreground')}>
              {p.received ? '已收 ' : ''}
              {yuan(p.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------- 施工交底：逐点打勾 ---------- */

const CHECKS = [
  { code: 'K01', text: '主卧 · 双键开关', done: true },
  { code: 'L12', text: '客厅 · 筒灯 ×4', done: true },
  { code: 'C04', text: '客厅 · 电动窗帘', done: true },
  { code: 'S06', text: '卫生间 · 水浸传感器', done: false },
]

function ChecklistVisual() {
  return (
    <ul aria-hidden className="space-y-2">
      {CHECKS.map((c) => (
        <li key={c.code} className="flex items-center gap-2.5 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs">
          <span className={cn('flex size-4 shrink-0 items-center justify-center rounded border', c.done ? 'border-success bg-success text-background' : 'border-muted-foreground/40')}>
            {c.done ? <Check className="size-3" /> : null}
          </span>
          <span className="font-medium text-muted-foreground tabular-nums">{c.code}</span>
          <span className={cn('min-w-0 flex-1 truncate', c.done && 'text-muted-foreground line-through decoration-muted-foreground/40')}>{c.text}</span>
        </li>
      ))}
    </ul>
  )
}

/* ---------- 多人协作：成员与权限 ---------- */

const MEMBERS = [
  { name: '林设计', initial: '林', role: '项目管理员' },
  { name: '王工', initial: '王', role: '可编辑' },
  { name: '陈施工', initial: '陈', role: '仅查看' },
]

function CollaborationVisual() {
  return (
    <div aria-hidden className="space-y-3">
      <ul className="space-y-2">
        {MEMBERS.map((m, i) => (
          <li key={m.name} className="flex items-center gap-2.5 text-sm">
            <Avatar size="sm">
              <AvatarFallback>{m.initial}</AvatarFallback>
            </Avatar>
            <span className="flex-1">{m.name}</span>
            <Badge variant={i === 0 ? 'secondary' : 'outline'} className="rounded-full">
              {m.role}
            </Badge>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
        <Share2 className="size-3.5 shrink-0" />
        <span className="truncate">湖山赋 · 协作链接</span>
        <span className="ml-auto text-foreground">复制</span>
      </div>
    </div>
  )
}

/* ---------- 微信小程序：手机界面 ---------- */

const PHONE_PROJECTS = [
  { name: '湖山赋 A区 12栋', points: PLAN_POINTS.length, amount: DEMO_QUOTE_TOTALS.total, progress: 'w-4/5' },
  { name: '万科城 3-1201', points: 36, amount: 68_000, progress: 'w-1/2' },
  { name: '龙湖春江天镜 5-2101', points: 28, amount: 45_000, progress: 'w-1/4' },
]
const PHONE_TABS = [House, MapPinned, Receipt, Bot]

function PhoneVisual() {
  return (
    <div aria-hidden className="relative flex h-72 items-start justify-center overflow-hidden pt-1">
      <div className="relative w-52 rounded-4xl border-4 border-muted bg-background p-2.5 shadow-2xl transition-transform duration-700 ease-out group-hover/card:-translate-y-2">
        <div className="mx-auto h-1.5 w-14 rounded-full bg-muted" />
        <div className="mt-3 flex items-center justify-between px-1">
          <p className="text-xs font-semibold">我的项目</p>
          <span className="text-xs text-muted-foreground tabular-nums">{PHONE_PROJECTS.length}</span>
        </div>
        <ul className="mt-2 space-y-1.5">
          {PHONE_PROJECTS.map((p) => (
            <li key={p.name} className="rounded-xl border border-border bg-card px-2.5 py-2">
              <p className="truncate text-xs font-medium">{p.name}</p>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{p.points} 点位</span>
                <span className="tabular-nums">¥{p.amount.toLocaleString('zh-CN')}</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                <span className={cn('block h-full rounded-full bg-chart-2', p.progress)} />
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-2 grid grid-cols-4 gap-1 border-t border-border pt-2 text-muted-foreground">
          {PHONE_TABS.map((Tab, i) => (
            <span key={i} className={cn('flex justify-center', i === 0 && 'text-foreground')}>
              <Tab className="size-3.5" />
            </span>
          ))}
        </div>
      </div>
      <div className="absolute top-4 right-4 flex items-center gap-2 rounded-xl border border-border bg-card/90 p-2.5 text-xs shadow-xl backdrop-blur motion-safe:animate-float">
        <QrCode className="size-8" />
        <span>
          扫码登录
          <br />
          电脑端
        </span>
      </div>
    </div>
  )
}

/* ---------- 产品库与智能选型 ---------- */

const TIER_TOTALS: Record<string, number> = { economy: 9_800, standard: DEMO_QUOTE_TOTALS.total, premium: 31_600 }
const CATALOG_ROWS = [
  { type: 'switch-3', name: '智能开关 三键 · 零火版', brand: 'yeelight', price: 149 },
  { type: 'downlight', name: '自然光筒灯 · 调光调色', brand: 'sumi', price: 199 },
  { type: 'ap-node', name: 'Wi-Fi 7 面板 AP', brand: 'ruijie', price: 675 },
]

function CatalogVisual() {
  return (
    <div aria-hidden className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {SELECTION_TIERS.map((t) => (
          <div key={t.value} className={cn('rounded-xl border px-3 py-2.5', t.value === 'standard' ? 'border-chart-1/60 bg-chart-1/10' : 'border-border')}>
            <p className="text-xs text-muted-foreground">{t.label}</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">¥{(TIER_TOTALS[t.value] ?? 0).toLocaleString('zh-CN')}</p>
          </div>
        ))}
      </div>
      <ul className="space-y-2">
        {CATALOG_ROWS.map((row) => {
          const brand = brandBySlug(row.brand)
          return (
            <li key={row.type} className="flex items-center gap-3 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs">
              <PointMarker type={row.type} className="size-5" />
              <span className="min-w-0 flex-1 truncate">{row.name}</span>
              {brand ? <Image src={brandSrc(brand.slug, 'mono')} alt="" width={brand.width} height={brand.height} unoptimized className="h-3.5 w-auto opacity-60" /> : null}
              <span className="text-muted-foreground tabular-nums">{yuan(row.price)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
