import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Layers, MapPinned, Play, ScanLine, SlidersHorizontal, type LucideIcon } from 'lucide-react'

import { PointMarker } from '@/components/point-marker'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { CountUp } from './count-up'
import { PLAN_POINTS, PLAN_ROOMS } from './demo-data'
import type { LandingPlan } from '@/lib/landing-plan'

import { FloorPlanDemo } from './floor-plan-demo'
import { PlanCompare } from './plan-compare'
import { Reveal } from './reveal'
import { SectionHeading } from './section-heading'

/* ---------------- 能力数据条 ---------------- */

export type LandingStat = { label: string; value: number; suffix?: string }

export function StatsBand({ stats }: { stats: LandingStat[] }) {
  return (
    <section aria-label="产品能力一览" className="relative border-y border-border bg-card/30">
      <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-10 px-4 py-12 sm:grid-cols-3 sm:px-6 lg:grid-cols-5 lg:px-8">
        {stats.map((s, i) => (
          <div key={s.label} className={cn('flex flex-col-reverse items-center gap-2 text-center', i === stats.length - 1 && stats.length % 2 === 1 && 'col-span-2 sm:col-span-1')}>
            <dt className="text-sm text-muted-foreground">{s.label}</dt>
            <dd className="text-4xl font-semibold tracking-tight text-foreground tabular-nums sm:text-5xl">
              <CountUp value={s.value} suffix={s.suffix} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/* ---------------- 点位图 ---------------- */

function planFeatures(deviceTypeCount: number): { icon: LucideIcon; title: string; text: string }[] {
  return [
    { icon: ScanLine, title: 'AI 识别户型图', text: '拖入开关插座布置图，AI 自动识别点位与房间，一键导入。' },
    { icon: MapPinned, title: `${deviceTypeCount} 种设备图标`, text: '按类别着色、代号自动编号，多楼层、多分区一目了然。' },
    { icon: SlidersHorizontal, title: '智能选型三档', text: '经济、标准、高端一键套用，按生态与品牌自动匹配型号。' },
    { icon: Layers, title: '点位与报价联动', text: '改一个点位，报价单、方案演示和交底清单同步更新。' },
  ]
}

export function PointMapSection({ deviceTypeCount, plan = null }: { deviceTypeCount: number; plan?: LandingPlan | null }) {
  return (
    <section id="pointmap" aria-labelledby="pointmap-title" className="relative isolate scroll-mt-20 py-20 sm:py-28">
      <div aria-hidden className="pointer-events-none absolute top-1/3 -left-40 -z-10 size-140 rounded-full bg-chart-1/15 blur-3xl" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            id="pointmap-title"
            eyebrow="点位图"
            title="在户型图上布点，像画画一样简单"
            description="每个点位自带型号与单价，画完点位，设备清单和预算自动生成。"
          />
        </Reveal>
        <div className="mt-14 grid items-start gap-6 lg:grid-cols-12 lg:gap-8">
          <Reveal className="lg:col-span-8">
            <div className="rounded-2xl border border-border bg-card p-3 shadow-2xl sm:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                {/* 只演示一层，不放看似可点的楼层切换 */}
                <span className="font-medium text-foreground">{plan ? `示例项目 · ${plan.name}` : '1F 一层平面图'}</span>
                <span className="tabular-nums">
                  {plan ? `原始图纸 → 设计方案 · 拖动分割线对比` : `${PLAN_POINTS.length} 个点位 · ${PLAN_ROOMS.length} 个区域 · 悬停查看代号`}
                </span>
              </div>
              {plan ? <PlanCompare plan={plan} /> : <FloorPlanDemo variant="full" />}
            </div>
          </Reveal>
          <ul className="grid gap-3 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1">
            {planFeatures(deviceTypeCount).map(({ icon: Icon, title, text }, i) => (
              <li key={title}>
                <Reveal delay={i * 90} className="h-full">
                  <div className="h-full rounded-2xl border border-border bg-card/50 p-5 transition-colors hover:border-chart-1/40 hover:bg-card">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-chart-1/15 text-chart-1">
                      <Icon className="size-5" />
                    </span>
                    <h3 className="mt-4 text-base font-semibold">{title}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/* ---------------- 场景 ---------------- */

const SCENE_PHOTO =
  'https://images.unsplash.com/photo-1666585607888-3f6fe0b323d8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwzfHxtb2Rlcm4lMjBsaXZpbmclMjByb29tJTIwaW50ZXJpb3IlMjB3YXJtJTIwZXZlbmluZyUyMGxpZ2h0aW5nfGVufDF8fHx8MTc5MzQzNDc2Nnww&ixlib=rb-4.1.0&q=80&w=2000'

/** 照片上的设备热点（百分比坐标对应照片里的吊灯、灯带、落地窗、沙发、落地灯等位置） */
const HOTSPOTS: { type: string; x: number; y: number; title: string; text: string; side: 'left' | 'right' }[] = [
  { type: 'pendant-light', x: 30.5, y: 11, title: '餐厅吊灯', text: '用餐模式 · 暖光', side: 'right' },
  { type: 'light-strip', x: 62, y: 14, title: '无主灯灯带', text: '回家场景渐亮', side: 'right' },
  { type: 'ap-node', x: 90, y: 24, title: 'Wi-Fi 7 AP', text: '全屋无缝漫游', side: 'left' },
  { type: 'curtain-track', x: 52, y: 34, title: '电动窗帘', text: '日落后自动合上', side: 'right' },
  { type: 'touch-panel', x: 29.5, y: 50, title: '中控面板', text: '一键切换场景', side: 'right' },
  { type: 'motion-sensor', x: 60, y: 60, title: '人在传感器', text: '无人 5 分钟关灯', side: 'left' },
  { type: 'socket', x: 92, y: 70, title: '智能插座', text: '落地灯定时开关', side: 'left' },
]

export function SceneSection() {
  return (
    <section aria-labelledby="scene-title" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            id="scene-title"
            eyebrow="场景"
            title="每个房间，都恰到好处地聪明"
            description="把每一个点位变成业主可感知的日常场景。"
          />
        </Reveal>
        <Reveal className="mt-14">
          <figure className="relative overflow-hidden rounded-3xl border border-border shadow-2xl">
            <div className="relative aspect-3/2">
              <Image
                src={SCENE_PHOTO}
                alt="傍晚的现代客厅：落地窗外是城市夜景，天花灯带与吊灯亮起"
                fill
                unoptimized
                sizes="(min-width: 1280px) 1216px, 100vw"
                className="object-cover"
              />
              <div aria-hidden className="absolute inset-0 bg-linear-to-t from-background/85 via-background/10 to-background/20" />
              {HOTSPOTS.map((h, i) => (
                <div key={h.title} className="absolute" style={{ left: `${h.x}%`, top: `${h.y}%` }}>
                  <span className="absolute flex -translate-x-1/2 -translate-y-1/2">
                    <span aria-hidden className="absolute inset-0 rounded-full bg-foreground/50 motion-safe:animate-ping" style={{ animationDelay: `${i * 350}ms` }} />
                    <PointMarker type={h.type} title className="relative size-5 drop-shadow-lg sm:size-7" />
                  </span>
                  <span
                    className={cn(
                      'absolute top-0 hidden -translate-y-1/2 items-center gap-2 rounded-full border border-border bg-background/70 py-1.5 text-xs whitespace-nowrap shadow-lg backdrop-blur-md md:flex',
                      h.side === 'right' ? 'left-5 pr-3 pl-2.5' : 'right-5 flex-row-reverse pr-2.5 pl-3',
                    )}
                  >
                    <span className="font-medium text-foreground">{h.title}</span>
                    <span className="text-muted-foreground">{h.text}</span>
                  </span>
                </div>
              ))}
              <div className="absolute bottom-4 left-4 hidden w-72 rounded-2xl border border-border bg-background/70 p-4 shadow-2xl backdrop-blur-md md:block">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className="flex size-6 items-center justify-center rounded-full bg-chart-3/20 text-chart-3">
                    <Play className="size-3" />
                  </span>
                  日落模式 · 已触发
                </p>
                <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <PointMarker type="light-strip" className="size-4" />
                    灯光渐暖到 2700K
                  </li>
                  <li className="flex items-center gap-2">
                    <PointMarker type="curtain-track" className="size-4" />
                    窗帘缓缓合上
                  </li>
                  <li className="flex items-center gap-2">
                    <PointMarker type="vrf-controller" className="size-4" />
                    空调调到 26℃
                  </li>
                </ul>
              </div>
            </div>
            <figcaption className="absolute right-4 bottom-3 text-xs text-foreground/60">
              照片：
              <Link href="https://unsplash.com/@sgroup?utm_source=fmkj&utm_medium=referral" target="_blank" rel="noreferrer" className="underline-offset-2 hover:text-foreground hover:underline">
                S.Group Official
              </Link>{' '}
              / Unsplash
            </figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  )
}

/* ---------------- 行动区 ---------------- */

const ORBIT_TYPES = ['switch-3', 'downlight', 'curtain-track', 'camera', 'smart-lock', 'ap-node', 'speaker', 'motion-sensor']

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative isolate overflow-hidden rounded-4xl border border-border bg-card/60 px-6 py-20 text-center sm:px-12 sm:py-28">
            <div aria-hidden className="absolute inset-0 -z-10 landing-grid landing-mask-radial opacity-60" />
            <div aria-hidden className="absolute -top-32 left-1/2 -z-10 size-140 -translate-x-1/2 rounded-full bg-chart-1/25 blur-3xl motion-safe:animate-aurora" />
            <div aria-hidden className="absolute -bottom-40 -left-24 -z-10 size-100 rounded-full bg-chart-4/20 blur-3xl motion-safe:animate-aurora [--landing-delay:-9s]" />
            <Orbit />
            <h2 id="cta-title" className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
              下一个项目，从一张户型图开始
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base text-balance text-muted-foreground sm:text-lg">登录工作台，把今天的方案做得更快、更漂亮。</p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="h-11 rounded-full px-6 text-base">
                <Link href="/projects">
                  进入工作台
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 rounded-full px-6 text-base">
                <Link href="/login">登录账号</Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/** 环绕的设备图标：整圈缓慢旋转，图标自身反向旋转保持正立 */
function Orbit() {
  return (
    <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 -z-10 hidden size-160 -translate-x-1/2 -translate-y-1/2 sm:block">
      <div className="absolute inset-0 rounded-full border border-border/70" />
      <div className="absolute inset-20 rounded-full border border-dashed border-border/50" />
      <div className="absolute inset-0 motion-safe:animate-orbit">
        {ORBIT_TYPES.map((type, i) => {
          const angle = (360 / ORBIT_TYPES.length) * i
          return (
            <div key={type} className="absolute inset-0" style={{ rotate: `${angle}deg` }}>
              <span className="absolute top-0 left-1/2 flex -translate-x-1/2 -translate-y-1/2 rounded-full bg-background p-1.5 ring-1 ring-border" style={{ rotate: `${-angle}deg` }}>
                <span className="flex motion-safe:animate-orbit-reverse">
                  <PointMarker type={type} className="size-7" />
                </span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
