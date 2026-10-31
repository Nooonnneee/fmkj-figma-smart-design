'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { PointMarker } from '@/components/point-marker'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { deviceTypeLabel } from '@/lib/device-types'
import { cn } from '@/lib/utils'

import { PLAN_H, PLAN_POINTS, PLAN_ROOMS, PLAN_W, planCategories } from './demo-data'

const OUTER_WALL = 'M20 20 H780 V480 H20 Z'
const INNER_WALLS = ['M20 220 H780', 'M270 20 V220', 'M370 20 V220', 'M560 20 V220', 'M270 130 H370', 'M200 220 V480', 'M20 370 H200', 'M200 380 H400', 'M400 220 V480', 'M400 410 H780']

/** 门：先用卡片底色在墙上「开洞」，再画门扇与开启弧线 */
const DOORS = [
  { gap: 'M206 220 H242', leaf: 'M206 220 V184 M242 220 A36 36 0 0 0 206 184' },
  { gap: 'M386 220 H422', leaf: 'M386 220 V184 M422 220 A36 36 0 0 0 386 184' },
  { gap: 'M576 220 H612', leaf: 'M576 220 V184 M612 220 A36 36 0 0 0 576 184' },
  { gap: 'M200 300 V336', leaf: 'M200 300 H164 M200 336 A36 36 0 0 1 164 300' },
  { gap: 'M200 400 V430', leaf: 'M200 400 H170 M200 430 A30 30 0 0 1 170 400' },
  { gap: 'M262 480 H302', leaf: 'M262 480 V440 M302 480 A40 40 0 0 0 262 440' },
]

const WINDOWS = [
  { x: 60, y: 16, w: 170, h: 8 },
  { x: 405, y: 16, w: 130, h: 8 },
  { x: 600, y: 16, w: 140, h: 8 },
  { x: 16, y: 250, w: 8, h: 90 },
  { x: 776, y: 250, w: 8, h: 130 },
  { x: 430, y: 476, w: 320, h: 8 },
]

/** 与中枢网关连线的设备（演示全屋联动） */
const LINK_TYPES = new Set(['ap-node', 'touch-panel', 'smart-lock', 'camera', 'vrf-controller', 'curtain-track'])

/* 播放控制：首屏版本加载即播放；下方的完整版本滚动到视口才播放（data-play 由 off 变为 on） */
const DRAW = 'landing-draw motion-safe:group-data-[play=off]/plan:[stroke-dashoffset:1] motion-safe:group-data-[play=on]/plan:animate-draw'
const SHOW = 'motion-safe:group-data-[play=off]/plan:opacity-0 motion-safe:group-data-[play=on]/plan:animate-fade'
const POP = 'motion-safe:group-data-[play=off]/plan:opacity-0 motion-safe:group-data-[play=on]/plan:animate-pop'
const MARKER_START = 1300
const MARKER_STEP = 45

/** 户型图里的家具轮廓（细线，只作氛围） */
function Furniture() {
  return (
    <>
      <rect x={70} y={70} width={120} height={100} rx={6} />
      <rect x={80} y={78} width={46} height={18} rx={4} />
      <rect x={134} y={78} width={46} height={18} rx={4} />
      <rect x={44} y={76} width={20} height={20} rx={3} />
      <rect x={196} y={76} width={20} height={20} rx={3} />
      <rect x={282} y={30} width={50} height={40} rx={4} />
      <path d="M282 30 L332 70" />
      <rect x={415} y={80} width={110} height={90} rx={6} />
      <rect x={425} y={88} width={90} height={16} rx={4} />
      <rect x={600} y={42} width={140} height={34} rx={4} />
      <circle cx={670} cy={96} r={12} />
      <path d="M24 224 H196 V246 H46 V364 H24 Z" />
      <ellipse cx={52} cy={448} rx={12} ry={16} />
      <rect x={106} y={448} width={46} height={24} rx={8} />
      <rect x={255} y={275} width={90} height={50} rx={6} />
      {[270, 300, 330].map((x) => (
        <circle key={`t${x}`} cx={x} cy={265} r={7} />
      ))}
      {[270, 300, 330].map((x) => (
        <circle key={`b${x}`} cx={x} cy={335} r={7} />
      ))}
      <rect x={330} y={388} width={62} height={18} rx={3} />
      <rect x={480} y={228} width={220} height={12} rx={3} />
      <rect x={530} y={285} width={110} height={44} rx={8} />
      <rect x={470} y={345} width={230} height={36} rx={8} />
      <rect x={720} y={300} width={36} height={40} rx={6} />
      <circle cx={430} cy={445} r={10} />
      <circle cx={756} cy={445} r={10} />
    </>
  )
}

/**
 * 首页的动态户型点位图：墙体描边绘制 → 房间标注淡入 → 点位依次弹出 → 网关连线流动 → AI 扫描光带。
 * full 版本带类别图例（点击高亮）和点位悬停提示。
 */
export function FloorPlanDemo({ variant = 'hero', className }: { variant?: 'hero' | 'full'; className?: string }) {
  const interactive = variant === 'full'
  const ref = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(!interactive)
  const [active, setActive] = useState<string | null>(null)
  const categories = useMemo(() => planCategories(), [])
  const hub = PLAN_POINTS.find((p) => p.type === 'gateway')
  const links = hub ? PLAN_POINTS.filter((p) => LINK_TYPES.has(p.type)) : []
  const linksDelay = MARKER_START + PLAN_POINTS.length * MARKER_STEP + 150

  useEffect(() => {
    if (playing) return
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setPlaying(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setPlaying(true)
          io.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [playing])

  return (
    <div className={cn('space-y-4', className)}>
      <div ref={ref} data-play={playing ? 'on' : 'off'} className="group/plan relative aspect-8/5 w-full overflow-hidden rounded-xl bg-card select-none">
        <svg viewBox={`0 0 ${PLAN_W} ${PLAN_H}`} className="absolute inset-0 size-full" aria-hidden focusable="false">
          <g>
            {PLAN_ROOMS.map((r) => (
              <rect key={r.name} x={r.x} y={r.y} width={r.w} height={r.h} className={r.accent ? 'fill-chart-1/10' : 'fill-foreground/3'} />
            ))}
          </g>
          <g fill="none" strokeWidth={1.5} className={cn('stroke-foreground/20', SHOW)} style={{ animationDelay: '900ms' }}>
            <Furniture />
          </g>
          <path d={OUTER_WALL} fill="none" strokeWidth={7} strokeLinejoin="round" pathLength={1} className={cn('stroke-foreground/85', DRAW)} />
          {INNER_WALLS.map((d, i) => (
            <path
              key={d}
              d={d}
              fill="none"
              strokeWidth={3.5}
              strokeLinecap="round"
              pathLength={1}
              className={cn('stroke-foreground/55', DRAW)}
              style={{ animationDelay: `${150 + i * 70}ms` }}
            />
          ))}
          <g className={SHOW} style={{ animationDelay: '1000ms' }}>
            {DOORS.map((door) => (
              <g key={door.gap}>
                <path d={door.gap} className="stroke-card" strokeWidth={9} />
                <path d={door.leaf} fill="none" className="stroke-foreground/45" strokeWidth={1.5} />
              </g>
            ))}
            {WINDOWS.map((w) => (
              <g key={`${w.x}-${w.y}`}>
                <rect x={w.x} y={w.y} width={w.w} height={w.h} className="fill-card stroke-chart-1/80" strokeWidth={1.5} />
                <path d={w.w > w.h ? `M${w.x} ${w.y + w.h / 2} H${w.x + w.w}` : `M${w.x + w.w / 2} ${w.y} V${w.y + w.h}`} className="stroke-chart-1/50" strokeWidth={1} />
              </g>
            ))}
          </g>
          <g className={cn('fill-muted-foreground', SHOW)} style={{ animationDelay: '1100ms' }}>
            {PLAN_ROOMS.map((r) => (
              <text key={r.name} x={r.lx} y={r.ly} textAnchor="middle" fontSize={12} className="font-medium">
                {r.name}
                {r.area ? (
                  <tspan x={r.lx} dy={14} fontSize={10} className="fill-muted-foreground/70 font-normal">
                    {r.area}
                  </tspan>
                ) : null}
              </text>
            ))}
          </g>
          {hub ? (
            <g fill="none" strokeWidth={1.5} strokeLinecap="round" className={cn('stroke-chart-4/50', SHOW)} style={{ animationDelay: `${linksDelay}ms` }}>
              {links.map((p) => (
                <path
                  key={p.id}
                  d={`M${hub.x} ${hub.y} Q${(hub.x + p.x) / 2} ${Math.min(hub.y, p.y) - 46} ${p.x} ${p.y}`}
                  className="[stroke-dasharray:3_7] motion-safe:animate-dash"
                />
              ))}
            </g>
          ) : null}
        </svg>

        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-x-0 top-0 h-1/4 border-b border-chart-1/70 bg-linear-to-b from-transparent to-chart-1/20 opacity-0 motion-safe:group-data-[play=on]/plan:animate-scan"
            style={{ animationDelay: `${linksDelay + 300}ms` }}
          />
        </div>

        {PLAN_POINTS.map((p, i) => {
          const dimmed = active !== null && p.category !== active
          const pulse = p.type === 'gateway' || p.type === 'ap-node'
          const marker = (
            <span className="relative flex">
              {pulse ? <span aria-hidden className="absolute inset-0 rounded-full bg-chart-4/60 motion-safe:animate-ping" /> : null}
              <PointMarker
                type={p.type}
                className={cn('relative size-3 drop-shadow-md transition-[opacity,scale,filter] duration-300 sm:size-5 lg:size-6', dimmed && 'scale-75 opacity-20 grayscale')}
              />
            </span>
          )
          return (
            <span
              key={p.id}
              data-plan-marker
              className={cn('absolute z-10 -translate-x-1/2 -translate-y-1/2', POP)}
              style={{ left: `${(p.x / PLAN_W) * 100}%`, top: `${(p.y / PLAN_H) * 100}%`, animationDelay: `${MARKER_START + i * MARKER_STEP}ms` }}
            >
              {interactive ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span role="img" aria-label={`${deviceTypeLabel(p.type)}，代号 ${p.code}`} className="flex cursor-default transition-transform duration-200 hover:scale-125">
                      {marker}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {deviceTypeLabel(p.type)} · {p.code}
                  </TooltipContent>
                </Tooltip>
              ) : (
                marker
              )}
            </span>
          )
        })}
      </div>

      {interactive ? (
        <div role="group" aria-label="按设备类别高亮点位" className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant={active === null ? 'default' : 'outline'} aria-pressed={active === null} className="rounded-full" onClick={() => setActive(null)}>
            全部
            <span className="tabular-nums opacity-60">{PLAN_POINTS.length}</span>
          </Button>
          {categories.map((c) => {
            const on = active === c.slug
            return (
              <Button key={c.slug} type="button" size="sm" variant={on ? 'default' : 'outline'} aria-pressed={on} className="rounded-full" onClick={() => setActive(on ? null : c.slug)}>
                <PointMarker type={c.sampleType} className="size-4" />
                {c.name}
                <span className="tabular-nums opacity-60">{c.count}</span>
              </Button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
