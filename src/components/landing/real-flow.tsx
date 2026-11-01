'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'

import { PointMarker } from '@/components/point-marker'
import { categoryOf } from '@/lib/device-types'
import { cn } from '@/lib/utils'

import { SectionHeading } from './section-heading'

/** 示例项目「平层三居」智能布点结果（与系统里的示例项目一致，按设计规范生成） */
const DESIGN_SUMMARY: { category: string; label: string; count: number }[] = [
  { category: 'network', label: '全屋 WiFi', count: 6 },
  { category: 'curtain', label: '窗帘电轨', count: 4 },
  { category: 'sensor', label: '人体感应', count: 4 },
  { category: 'gateway', label: '网关 · 音箱', count: 3 },
  { category: 'security', label: '摄像头', count: 2 },
  { category: 'vrf', label: 'VRF 控制器', count: 1 },
]

const QUOTE_LINES: { type: string; name: string; qty: string; room: string }[] = [
  { type: 'ap-node', name: '吸顶 AP 面板', qty: '4 台', room: '客餐厅 · 过道 · 主卧' },
  { type: 'network-panel', name: '网络面板', qty: '2 个', room: '玄关 · 书房' },
  { type: 'gateway', name: '智能网关', qty: '1 台', room: '玄关弱电箱' },
  { type: 'speaker', name: '智能音箱', qty: '2 台', room: '客厅 · 书房' },
  { type: 'vrf-controller', name: 'VRF 控制器', qty: '1 台', room: '客厅' },
  { type: 'curtain-track', name: '窗帘电轨', qty: '4 套', room: '客厅 · 卧室 · 飘窗' },
  { type: 'motion-sensor', name: '人体传感器', qty: '4 个', room: '玄关 · 过道 · 卫生间' },
  { type: 'camera', name: '摄像头', qty: '2 台', room: '入户 · 客厅' },
]

type Step = { key: string; title: string; text: string; image: string; alt: string }

const STEPS: Step[] = [
  {
    key: 'base',
    title: '上传户型底图',
    text: '拖入带家具的平面图（图片或 DWG），自动裁掉图框、放进 3:2 标准图纸。',
    image: '/demo-flow/web/flow-1-base.webp',
    alt: '示例项目平层三居的家具布置底图',
  },
  {
    key: 'render',
    title: '风格化彩平',
    text: '生成写实彩平，材质、软装和灯光氛围一眼看懂，给客户看方案更直观。',
    image: '/demo-flow/web/flow-2-render.webp',
    alt: '平层三居的写实彩色平面图',
  },
  {
    key: 'design',
    title: 'AI 智能布点',
    text: '按设计规范划分房间并布点。这张图没有开关、灯光点位，所以只设计弱电与智能设备，不凭空推测开关灯具。',
    image: '/demo-flow/web/flow-3-design.webp',
    alt: '平层三居的智能点位设计图，含房间分区与 20 个设备点位',
  },
  {
    key: 'quote',
    title: '一键出报价',
    text: '点位自动汇总成按房间分区的报价单，逐行换型号、改单价，金额实时核算。',
    image: '/demo-flow/web/flow-3-design.webp',
    alt: '',
  },
]

const AUTO_MS = 5000

/** 首页主线：用系统里的示例项目完整走一遍「底图 → 彩平 → 布点 → 报价」。 */
export function RealFlowSection() {
  const [active, setActive] = useState(0)
  const [auto, setAuto] = useState(true)
  const ref = useRef<HTMLElement>(null)

  // 进入视口后自动轮播；访客点过任一步骤、或系统要求减少动态效果时停止
  useEffect(() => {
    if (!auto || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let visible = false
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0.35 })
    if (ref.current) io.observe(ref.current)
    const timer = window.setInterval(() => {
      if (visible) setActive((i) => (i + 1) % STEPS.length)
    }, AUTO_MS)
    return () => {
      window.clearInterval(timer)
      io.disconnect()
    }
  }, [auto])

  const pick = (i: number) => {
    setAuto(false)
    setActive(i)
  }
  const step = STEPS[active]

  return (
    <section ref={ref} id="workflow" aria-labelledby="flow-title" className="relative scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="flow-title"
          title="一个真实项目，从图纸到报价"
          description="系统里的示例项目「平层三居」，从上传底图到一键出报价，完整走一遍。"
        />

        <div className="mt-12 grid items-start gap-6 lg:mt-16 lg:grid-cols-12 lg:gap-8">
          <ol role="tablist" aria-label="项目流程" className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:col-span-4 lg:grid-cols-1 lg:gap-3">
            {STEPS.map((s, i) => {
              const on = i === active
              const done = i < active
              return (
                <li key={s.key} className="min-w-0">
                  <button
                    type="button"
                    role="tab"
                    id={`flow-tab-${s.key}`}
                    aria-selected={on}
                    aria-controls="flow-panel"
                    onClick={() => pick(i)}
                    className={cn(
                      'group relative flex h-full w-full items-start gap-3 overflow-hidden rounded-2xl border p-3 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none lg:p-4',
                      on ? 'border-primary/60 bg-card' : 'border-border bg-card/30 hover:bg-card/70',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition-colors',
                        on ? 'border-primary bg-primary text-primary-foreground' : done ? 'border-primary/50 text-primary' : 'border-border text-muted-foreground',
                      )}
                    >
                      {done ? <Check className="size-3.5" /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className={cn('block text-sm font-semibold', !on && 'text-muted-foreground group-hover:text-foreground')}>{s.title}</span>
                      <span className={cn('mt-1 hidden text-sm text-muted-foreground lg:block', !on && 'lg:line-clamp-1')}>{s.text}</span>
                    </span>
                    {/* 自动轮播时的进度条 */}
                    {on && auto ? (
                      <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-primary/15 motion-reduce:hidden">
                        <span key={active} className="block h-full origin-left bg-primary motion-safe:animate-flow-progress" />
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ol>

          <div id="flow-panel" role="tabpanel" aria-labelledby={`flow-tab-${step.key}`} className="lg:col-span-8">
            <div className="rounded-2xl border border-border bg-card p-2 shadow-2xl sm:p-3">
              <div className="relative">
              <div className="relative aspect-[3/2] overflow-hidden rounded-xl bg-white">
                {STEPS.slice(0, 3).map((s, i) => (
                  <Image
                    key={s.key}
                    src={s.image}
                    alt={s.alt}
                    width={1800}
                    height={1200}
                    sizes="(min-width: 1024px) 760px, 100vw"
                    className={cn(
                      'absolute inset-0 size-full object-contain transition-[opacity,filter] duration-500 ease-out',
                      // 第 4 步沿用布点图作底，压暗后叠报价卡
                      i === Math.min(active, 2) ? 'opacity-100' : 'opacity-0',
                      active === 3 && i === 2 && 'blur-[1px] brightness-75',
                    )}
                  />
                ))}

                <span className="absolute top-3 left-3 rounded-full bg-neutral-900/80 px-2.5 py-1 text-xs font-medium text-white tabular-nums">
                  {active + 1} / {STEPS.length} · {step.title}
                </span>
                </div>
                {active === 3 ? (
                  <div className="mt-2 rounded-xl border border-neutral-200 bg-white p-3 text-neutral-900 shadow-xl sm:absolute sm:top-3 sm:right-3 sm:mt-0 sm:w-80 sm:p-4 motion-safe:animate-flow-card">
                    <div className="flex items-baseline justify-between border-b border-neutral-200 pb-2">
                      <span className="text-sm font-semibold">报价单 · 平层三居</span>
                      <span className="text-xs text-neutral-500 tabular-nums">20 个点位 · 9 个房间</span>
                    </div>
                    <ul className="mt-1 divide-y divide-neutral-100">
                      {QUOTE_LINES.map((l, i) => (
                        <li key={l.type} className={cn('flex items-center gap-2 py-1.5', i > 3 && 'hidden sm:flex')}>
                          <PointMarker type={l.type} className="size-5" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium">{l.name}</span>
                            <span className="block truncate text-[0.6875rem] text-neutral-500">{l.room}</span>
                          </span>
                          <span className="shrink-0 text-xs font-semibold tabular-nums">{l.qty}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 border-t border-neutral-200 pt-2 text-[0.6875rem] text-neutral-500">按房间分区汇总，选好型号后自动带出单价与合计</p>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-2 pt-3 pb-1 text-xs text-muted-foreground sm:px-1">
                {active === 0 ? <span>标准图纸 2400 × 1600 · 自动去掉图框与标题栏</span> : null}
                {active === 1 ? <span>写实彩平只做展示，点位坐标始终以标准图纸为准</span> : null}
                {active >= 2
                  ? DESIGN_SUMMARY.map((d) => (
                      <span key={d.category} className="inline-flex items-center gap-1.5">
                        <span aria-hidden className="size-2 rounded-full" style={{ background: categoryOf(d.category)?.color }} />
                        {d.label}
                        <span className="font-semibold text-foreground tabular-nums">{d.count}</span>
                      </span>
                    ))
                  : null}
                {active === 3 ? (
                  <Link href="/#quote" className="ml-auto inline-flex items-center gap-1 font-medium text-primary hover:underline">
                    看报价单样张 <ArrowRight className="size-3.5" />
                  </Link>
                ) : null}
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground lg:hidden">{step.text}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
