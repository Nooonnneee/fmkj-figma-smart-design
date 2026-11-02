'use client'

/* eslint-disable @next/next/no-img-element -- 1440×960 方案画布同源静态图片直接渲染以保持与打印导出完全一致 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Maximize2 } from 'lucide-react'

import { PointMarker } from '@/components/point-marker'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { brandLatin, DocCheckbox, DocRoot } from '@/documents/parts'
import { DEFAULT_PAYMENTS, paymentAmounts } from '@/lib/contracts'
import { categoryOfType, DEVICE_CATEGORIES, deviceTypeOf } from '@/lib/device-types'
import type { CompanyInfo } from '@/lib/cached-data'
import type { LandingShowcase } from '@/lib/landing-showcase'
import { yuan } from '@/lib/quotes'
import { cn } from '@/lib/utils'
import { DECK_THEMES, deckVars, type DeckTheme, type DeckThemeId } from '@/plugins/proposal/deck/themes'

import { money } from './section'

const SLIDE_W = 1440
const SLIDE_H = 960
const CARD_W = 604
const CARD_H = 428

const THEME_IDS: DeckThemeId[] = ['qixu', 'noir', 'grove', 'jade', 'azure', 'dawn', 'mono']

type ChapterId = 'cover' | 'plan' | 'system' | 'zone' | 'service'

const FRAMEWORKS: {
  value: 'full' | 'story' | 'budget'
  label: string
  description: string
  chapters: ChapterId[]
}[] = [
  {
    value: 'full',
    label: '完整提案',
    description: '封面 → 住宅平面 → 网络与中控拓扑 → 空间场景 → 服务交付',
    chapters: ['cover', 'plan', 'system', 'zone', 'service'],
  },
  {
    value: 'story',
    label: '场景故事',
    description: '封面 → 空间场景 → 住宅平面 → 网络与中控拓扑 → 服务交付',
    chapters: ['cover', 'zone', 'plan', 'system', 'service'],
  },
  {
    value: 'budget',
    label: '精简汇报',
    description: '封面 → 网络与中控拓扑 → 服务交付，快速讲清核心架构与预算',
    chapters: ['cover', 'system', 'service'],
  },
]

type TopoBox = { title: string; sub: string; badge?: string }
type TopoApRoom = { room: string; codes: string; sub: string; count: number }

const byCode = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true })

function codeRange(codes: string[]) {
  const c = [...new Set(codes.filter(Boolean))].sort(byCode)
  if (c.length <= 2) return c.join(' / ')
  const parts = c.map((x) => /^(\D*)(\d+)$/.exec(x))
  const contiguous = parts.every((m, i) => m && m[1] === parts[0]![1] && (i === 0 || Number(m[2]) === Number(parts[i - 1]![2]) + 1))
  if (contiguous) return `${c[0]}～${c[c.length - 1]}`
  return c.length <= 3 ? c.join(' / ') : `${c.slice(0, 3).join(' / ')} 等${c.length}个`
}

/**
 * 首页「方案演示」模块：与下方「报价单」模块保持一致的交互体验——
 * 左侧吸顶切换「方案结构」与「视觉主题」，右侧将整套横版方案页面纵向排开，直接向下滚动浏览全部章节。
 */
export function ProposalShowcase({
  data,
  company,
}: {
  data: LandingShowcase
  company: CompanyInfo
}) {
  const [themeId, setThemeId] = useState<DeckThemeId>('qixu')
  const [frameworkId, setFrameworkId] = useState<'full' | 'story' | 'budget'>('full')
  const [zoomOpen, setZoomOpen] = useState(false)
  const theme = DECK_THEMES[themeId] ?? DECK_THEMES.qixu
  const activeFramework = FRAMEWORKS.find((f) => f.value === frameworkId) ?? FRAMEWORKS[0]!

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(0.55)
  const modalViewportRef = useRef<HTMLDivElement | null>(null)
  const [modalScale, setModalScale] = useState(0.85)

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const update = () => {
      const w = el.clientWidth
      if (w > 0) setScale(w / SLIDE_W)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!zoomOpen) return
    const timer = setTimeout(() => {
      const el = modalViewportRef.current
      if (!el) return
      const update = () => {
        const w = el.clientWidth
        if (w > 0) setModalScale(w / SLIDE_W)
      }
      update()
      const ro = new ResizeObserver(update)
      ro.observe(el)
      return () => ro.disconnect()
    }, 20)
    return () => clearTimeout(timer)
  }, [zoomOpen])

  return (
    <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
      <div className="lg:sticky lg:top-28 lg:col-span-5 lg:self-start xl:col-span-4">
        <h2 id="proposal-title" className="text-headline font-medium">
          方案演示
        </h2>

        <div className="mt-6 space-y-2">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-medium text-foreground">方案结构</span>
            <span className="text-muted-foreground">{activeFramework.chapters.length} 页</span>
          </div>
          <Tabs value={frameworkId} onValueChange={(v) => setFrameworkId(v as 'full' | 'story' | 'budget')}>
            <TabsList aria-label="方案结构" className="grid h-auto w-full grid-cols-3 gap-1 p-1 group-data-horizontal/tabs:h-auto">
              {FRAMEWORKS.map((f) => (
                <TabsTrigger
                  key={f.value}
                  value={f.value}
                  aria-controls="proposal-slide-preview"
                  className="h-8 justify-center px-2.5 text-xs font-normal data-[state=active]:font-medium data-[state=active]:shadow-sm"
                >
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="mt-5 space-y-2">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-medium text-foreground">视觉主题</span>
            <span className="text-muted-foreground">{theme.label}</span>
          </div>
          <Tabs value={themeId} onValueChange={(v) => setThemeId(v as DeckThemeId)}>
            <TabsList aria-label="方案视觉主题" className="grid h-auto w-full grid-cols-2 gap-1 p-1 group-data-horizontal/tabs:h-auto">
              {THEME_IDS.map((id) => {
                const t = DECK_THEMES[id]
                return (
                  <TabsTrigger
                    key={id}
                    value={id}
                    aria-controls="proposal-slide-preview"
                    className="h-9 justify-start gap-2.5 px-3 font-normal data-[state=active]:font-medium data-[state=active]:shadow-sm"
                  >
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full ring-1 ring-foreground/15 dark:ring-foreground/40"
                      style={{ backgroundColor: t.style.colors.accent }}
                    />
                    <span className="truncate">{t.label}</span>
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </Tabs>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => setZoomOpen(true)}
          className="mt-6 h-10 w-full gap-2 rounded-full"
        >
          <Maximize2 className="size-4" />
          放大查看方案
        </Button>
      </div>

      <div className="relative min-w-0 rounded-2xl bg-muted/60 p-3 sm:p-8 lg:col-span-7 lg:p-10 xl:col-span-8">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {activeFramework.label} · {theme.label}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setZoomOpen(true)}
            className="h-7 gap-1.5 rounded-full px-3 text-xs"
          >
            <Maximize2 className="size-3.5" />
            放大查看
          </Button>
        </div>
        <div
          id="proposal-slide-preview"
          ref={viewportRef}
          role="region"
          aria-label={`方案演示样张（${activeFramework.label} · ${theme.label}）`}
        >
          <DocRoot style={theme.style} className="space-y-5 overflow-hidden sm:space-y-6">
            {activeFramework.chapters.map((chapterId, index) => {
              const pageNo = String(index + 1).padStart(2, '0')
              const pageTotal = String(activeFramework.chapters.length).padStart(2, '0')
              return (
                <div
                  key={chapterId}
                  onClick={() => setZoomOpen(true)}
                  title="点击放大查看"
                  className="relative aspect-3/2 w-full cursor-zoom-in overflow-hidden rounded-md shadow-sm ring-1 ring-foreground/10"
                >
                  <div
                    style={{
                      ...deckVars(theme),
                      width: SLIDE_W,
                      height: SLIDE_H,
                      transform: `scale(${scale})`,
                      transformOrigin: 'top left',
                    }}
                    className="bg-doc-paper text-doc-ink select-none"
                  >
                    <ShowcaseSlide
                      data={data}
                      company={company}
                      theme={theme}
                      chapterId={chapterId}
                      pageNo={pageNo}
                      pageTotal={pageTotal}
                    />
                  </div>
                </div>
              )
            })}
          </DocRoot>
        </div>
      </div>

      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="flex h-[92vh] max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(94vw,1360px)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-5 py-3 pr-14">
            <div>
              <DialogTitle className="text-sm font-medium">
                方案演示 · {data.project.name}
              </DialogTitle>
              <DialogDescription className="sr-only">
                高清放大浏览整套横版智能家居方案，支持切换方案结构与视觉主题
              </DialogDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Tabs value={frameworkId} onValueChange={(v) => setFrameworkId(v as 'full' | 'story' | 'budget')}>
                <TabsList className="h-8 p-0.5">
                  {FRAMEWORKS.map((f) => (
                    <TabsTrigger key={f.value} value={f.value} className="h-7 px-2.5 text-xs">
                      {f.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <Tabs value={themeId} onValueChange={(v) => setThemeId(v as DeckThemeId)}>
                <TabsList className="h-8 p-0.5">
                  {THEME_IDS.map((id) => {
                    const t = DECK_THEMES[id]
                    return (
                      <TabsTrigger key={id} value={id} className="h-7 gap-1.5 px-2.5 text-xs">
                        <span className="size-2 rounded-full" style={{ backgroundColor: t.style.colors.accent }} />
                        {t.label}
                      </TabsTrigger>
                    )
                  })}
                </TabsList>
              </Tabs>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto bg-muted/60 p-4 sm:p-8">
            <div ref={modalViewportRef} className="mx-auto max-w-[1240px]">
              <DocRoot style={theme.style} className="space-y-6 overflow-hidden">
                {activeFramework.chapters.map((chapterId, index) => {
                  const pageNo = String(index + 1).padStart(2, '0')
                  const pageTotal = String(activeFramework.chapters.length).padStart(2, '0')
                  return (
                    <div
                      key={chapterId}
                      className="relative aspect-3/2 w-full overflow-hidden rounded-lg shadow-md ring-1 ring-foreground/10"
                    >
                      <div
                        style={{
                          ...deckVars(theme),
                          width: SLIDE_W,
                          height: SLIDE_H,
                          transform: `scale(${modalScale})`,
                          transformOrigin: 'top left',
                        }}
                        className="bg-doc-paper text-doc-ink select-none"
                      >
                        <ShowcaseSlide
                          data={data}
                          company={company}
                          theme={theme}
                          chapterId={chapterId}
                          pageNo={pageNo}
                          pageTotal={pageTotal}
                        />
                      </div>
                    </div>
                  )
                })}
              </DocRoot>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ShowcaseSlide({
  data,
  company,
  theme,
  chapterId,
  pageNo,
  pageTotal,
}: {
  data: LandingShowcase
  company: CompanyInfo
  theme: DeckTheme
  chapterId: ChapterId
  pageNo: string
  pageTotal: string
}) {
  const allPoints = useMemo(
    () =>
      data.sheets.flatMap((sh) =>
        sh.points.map((pt) => ({
          ...pt,
          floor: sh.floor,
          displayRoom: pt.room ? `${sh.floor} · ${pt.room}` : `${sh.floor} · 公共区域`,
        })),
      ),
    [data.sheets],
  )

  const topology = useMemo(() => {
    const acPts = allPoints.filter((p) => p.type === 'ac-router')
    const apPts = allPoints.filter((p) => p.type === 'ap-node' || p.type === 'ceiling-ap')
    const acLine = data.quote?.lines.find((l) => l.type === 'ac-router')
    const ac: TopoBox = {
      title: `${acPts.length ? codeRange(acPts.map((p) => p.code)) : 'N3'} AC 控制器 / PoE 核心交换`,
      badge: `AC 控制 · ${acPts.length || 1}台`,
      sub: `统一管控 ${apPts.length} 台 AP 漫游与千兆 PoE 供电 · ${acPts[0]?.displayRoom ?? '1F · 客厅'}${acLine?.name ? ` · ${acLine.name}` : ''}`,
    }

    const roomBuckets = new Map<string, typeof apPts>()
    for (const p of apPts) {
      const key = p.displayRoom
      roomBuckets.set(key, [...(roomBuckets.get(key) ?? []), p])
    }
    const apRooms: TopoApRoom[] = [...roomBuckets.entries()].map(([room, rAps]) => {
      const hasCeiling = rAps.some((p) => p.type === 'ceiling-ap')
      const hasPanel = rAps.some((p) => p.type === 'ap-node')
      const kind = hasCeiling && hasPanel ? '吸顶+面板AP' : hasCeiling ? '吸顶AP' : '面板AP'
      return {
        room,
        codes: codeRange(rAps.map((p) => p.code)),
        sub: `${kind}${rAps.length > 1 ? ` ×${rAps.length}` : ''} · PoE 漫游`,
        count: rAps.length,
      }
    })

    const gwPts = allPoints.filter((p) => p.type === 'gateway')
    const ctrlPts = allPoints.filter((p) => p.type === 'touch-panel' || p.type === 'speaker' || p.type === 'vrf-controller')
    const hubs: TopoBox[] = [
      {
        title: `${codeRange(gwPts.map((p) => p.code)) || 'G1～G7'} 智能中枢网关`,
        badge: `网关 ×${gwPts.length || 4}`,
        sub: '各楼层居中部署 · LAN 有线接入 · Zigbee / 蓝牙 Mesh',
      },
      {
        title: `${codeRange(ctrlPts.map((p) => p.code)) || 'G2～G6'} 中控与语音交互`,
        badge: `中控屏 / 音箱 ×${ctrlPts.length || 3}`,
        sub: '玄关、客厅与主卧 · 场景触控与语音控制',
      },
    ]

    const leaves: TopoBox[] = DEVICE_CATEGORIES.filter((c) => c.slug !== 'gateway' && c.slug !== 'network')
      .map((c) => {
        const pts = allPoints.filter((p) => categoryOfType(p.type)?.slug === c.slug)
        return { c, pts }
      })
      .filter((x) => x.pts.length > 0)
      .sort((a, b) => b.pts.length - a.pts.length)
      .slice(0, 4)
      .map(({ c, pts }) => ({
        title: codeRange(pts.map((p) => p.code)) || c.name,
        badge: `${pts.length}处${c.name}`,
        sub: `${c.name}系统联动 · 覆盖 ${new Set(pts.map((p) => p.displayRoom)).size} 个空间`,
      }))

    return {
      ac,
      apRooms,
      apLink: `PoE 供电 + AC 漫游 · ${apRooms.length} 房间（${apPts.length} 台 AP）`,
      hubs,
      leaves,
      link: 'Zigbee / 蓝牙 Mesh · 中控联动总线',
    }
  }, [allPoints, data.quote?.lines])

  const totalAmount = data.quote?.total ?? 51820
  const place = [data.project.community, data.project.address].filter(Boolean).join('') || data.project.name
  const customer = data.project.customer || '林先生'
  const layoutText = `${data.sheets.length}层 · ${data.roomCount}个空间`
  const tagline = [brandLatin(company.name), theme.tagline].filter(Boolean).join('  /  ')

  if (chapterId === 'cover') {
    return (
      <CoverSlide
        company={company}
        theme={theme}
        place={place}
        customer={customer}
        layoutText={layoutText}
        pointCount={data.pointCount}
        roomCount={data.roomCount}
        totalAmount={totalAmount}
        tagline={tagline}
        pageNo={pageNo}
        pageTotal={pageTotal}
      />
    )
  }

  return (
    <div className="relative flex size-full flex-col gap-[24px] overflow-hidden px-[56px] pt-[36px] pb-[72px]">
      {/* 页眉 */}
      <div className="flex h-[32px] w-full shrink-0 items-center justify-between">
        <SlideBrand company={company} theme={theme} />
        <p className={cn('doc-latin text-[11px] text-doc-muted', theme.trackedTagline && 'tracking-[0.18em]')}>{tagline}</p>
      </div>

      {chapterId === 'system' ? (
        <>
          <SlideChapter
            theme={theme}
            no={pageNo}
            title="连接有章法，能力有边界。"
            subtitle="网络、中控与设备架构 / 先确认兼容，再联调场景"
            tag="SYSTEM & DEVICES"
          />
          <div className="flex min-h-0 w-full flex-1 items-start gap-[32px] overflow-hidden">
            <div className="flex w-[604px] shrink-0 flex-col gap-[16px]">
              <div className="flex items-baseline justify-between">
                <p className="doc-display text-[20px]">网络与中控拓扑</p>
                <p className="doc-body text-[13px] text-doc-accent">
                  AC 控制 + {topology.apRooms.length} 间 AP 房间拓扑 / 中控架构
                </p>
              </div>
              <TopologyDiagram topology={topology} />
              <div className="flex flex-col gap-[6px] rounded-(--deck-radius-sm) border border-(--deck-panel-border) bg-(--deck-panel) px-[20px] py-[14px]">
                <p className="doc-strong text-[14px]">本地执行 ≠ 无条件断网可用</p>
                <p className="doc-body text-[12.5px] leading-[1.6] text-doc-muted">
                  本地场景能否执行取决于网关、设备及规则支持，须在现场断网实测后写入验收记录。远程访问与推送依赖可用网络；不作绝对离线承诺。
                </p>
              </div>
            </div>

            <div className="flex w-[692px] shrink-0 flex-col gap-[16px] overflow-hidden">
              <div className="flex items-baseline justify-between">
                <p className="doc-display text-[20px]">本次设备清单</p>
                <p className="doc-body text-[13px] text-doc-accent">按类别汇总 / 共 {data.pointCount} 台/只设备</p>
              </div>
              <div className="overflow-hidden rounded-(--deck-radius-sm) border border-doc-rule">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-doc-head text-left text-doc-head-fg">
                      <th className="w-[88px] px-3 py-2.5 font-medium">条目</th>
                      <th className="w-[160px] px-3 py-2.5 font-medium">系统类别 / 数量</th>
                      <th className="px-3 py-2.5 font-medium">代表产品与品牌</th>
                      <th className="w-[150px] px-3 py-2.5 text-right font-medium">系统小计</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DEVICE_CATEGORIES.map((c, idx) => {
                      const lines = (data.quote?.lines ?? []).filter((l) => categoryOfType(l.type)?.slug === c.slug)
                      if (!lines.length) return null
                      const count = lines.reduce((s, l) => s + l.qty, 0)
                      const sub = lines.reduce((s, l) => s + l.price * l.qty, 0)
                      return (
                        <tr key={c.slug} className={cn('h-[42px] border-b border-doc-rule', idx % 2 === 1 && 'bg-(--deck-box)/50')}>
                          <td className="doc-latin px-3 text-doc-accent">Q0{idx + 1}</td>
                          <td className="doc-body px-3">
                            {c.name} ×{count}
                          </td>
                          <td className="doc-body truncate px-3 text-doc-ink/90">
                            {lines[0]?.name}
                            {lines.length > 1 ? ` 等 ${lines.length} 款` : ''}
                          </td>
                          <td className="doc-latin px-3 text-right tabular-nums">{yuan(sub)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="doc-display mt-[4px] text-[18px]">实施前，逐项确认</p>
              <ol className="doc-body flex flex-col gap-[8px] text-[13.5px] leading-[1.6] text-doc-muted">
                <li>① 同为 Zigbee / 蓝牙 Mesh 不代表必然兼容；设备接入、场景指令与状态回传均以清单及联调结果确认。</li>
                <li>② AP 漫游与无线覆盖须到场实测调优；电动窗帘须复核轨道匹配、行程与窗帘盒供电。</li>
                <li>③ 全部设备位置、零火线供电条件及弱电箱六类网线汇聚以现场勘测复核为准。</li>
              </ol>
            </div>
          </div>
        </>
      ) : chapterId === 'plan' ? (
        <PlanSlide data={data} theme={theme} no={pageNo} />
      ) : chapterId === 'zone' ? (
        <ZoneSlide data={data} theme={theme} no={pageNo} />
      ) : (
        <ServiceSlide data={data} company={company} theme={theme} totalAmount={totalAmount} no={pageNo} />
      )}

      {/* 页脚 */}
      <div className="absolute inset-x-[56px] top-[906px] flex flex-col gap-[12px]">
        <div className="h-px w-full bg-doc-rule" />
        <div className="flex w-full items-start justify-between text-[11px] text-doc-muted">
          <p>{`${place} / ${customer}　 ·　 ${data.project.platform ? `${data.project.platform} · ` : ''}全屋智能设计方案`}</p>
          <p className="doc-latin">QX-DEMO  /  V1.0</p>
          <p className="doc-latin text-[12px] text-doc-ink">{`${pageNo} / ${pageTotal}`}</p>
        </div>
      </div>
    </div>
  )
}

function TopologyDiagram({
  topology,
}: {
  topology: {
    ac: TopoBox
    apRooms: TopoApRoom[]
    apLink: string
    hubs: TopoBox[]
    leaves: TopoBox[]
    link: string
  }
}) {
  const { ac, apRooms, apLink, hubs, leaves, link } = topology
  const coreX = 28
  const coreY = 12
  const coreW = CARD_W - 56
  const coreH = 52
  const coreBottom = coreY + coreH
  const pillTop = 74
  const pillBottom = 94

  const leftBusX = 166
  const shownRooms = apRooms.slice(0, 8)
  const twoColAp = shownRooms.length >= 4
  const apRows = twoColAp ? Math.ceil(shownRooms.length / 2) : Math.max(1, shownRooms.length)
  const apStartY = 104
  const apAvailH = CARD_H - apStartY - 14
  const apGapY = apRows >= 4 ? 10 : 12
  const apCardH = Math.min(62, Math.max(46, Math.floor((apAvailH - (apRows - 1) * apGapY) / apRows)))

  const apPlacements = shownRooms.map((item, idx) => {
    const row = Math.floor(idx / 2)
    const col = idx % 2
    const y = apStartY + row * (apCardH + apGapY)
    const w = 138
    const x = col === 0 ? 16 : 178
    return { item, x, y, w, h: apCardH, cy: y + apCardH / 2, side: col === 0 ? ('left' as const) : ('right' as const) }
  })
  const apLastCy = apPlacements.length ? apPlacements[apPlacements.length - 1]!.cy : apStartY + 32

  const rightTrunkX = 460
  const hubX = 332
  const hubW = 256
  const hubH = 48
  const hubGap = 8
  const hubStartY = 104
  const hubPlacements = hubs.slice(0, 2).map((h, i) => {
    const y = hubStartY + i * (hubH + hubGap)
    return { box: h, x: hubX, y, w: hubW, h: hubH, cy: y + hubH / 2 }
  })
  const lastHubBottom = hubPlacements.length ? hubPlacements[hubPlacements.length - 1]!.y + hubH : hubStartY

  const leafSpineX = 344
  const leafX = 358
  const leafW = 230
  const leafStartY = lastHubBottom + 28
  const leafAvailH = CARD_H - leafStartY - 12
  const shownLeaves = leaves.slice(0, 4)
  const leafGap = shownLeaves.length >= 4 ? 6 : 8
  const leafH = shownLeaves.length
    ? Math.min(48, Math.max(36, Math.floor((leafAvailH - (shownLeaves.length - 1) * leafGap) / shownLeaves.length)))
    : 44
  const leafPlacements = shownLeaves.map((l, i) => {
    const y = leafStartY + i * (leafH + leafGap)
    return { box: l, x: leafX, y, w: leafW, h: leafH, cy: y + leafH / 2 }
  })
  const leafLastCy = leafPlacements.length ? leafPlacements[leafPlacements.length - 1]!.cy : lastHubBottom

  return (
    <div className="relative h-[428px] w-[604px] shrink-0 overflow-hidden rounded-(--deck-radius) border border-(--deck-card-border) bg-(--deck-diagram)">
      <svg className="absolute inset-0" width={CARD_W} height={CARD_H} aria-hidden>
        <g fill="none" strokeWidth={1.5} className="stroke-(--deck-marker)">
          <path d={`M${leftBusX} ${coreBottom} V${pillTop}`} />
          <path d={`M${rightTrunkX} ${coreBottom} V${pillTop}`} />
          <path d={`M${leftBusX} ${pillBottom} V${apLastCy}`} />
          {apPlacements.map((p, i) => (
            <path key={i} d={p.side === 'left' ? `M${p.x + p.w} ${p.cy} H${leftBusX}` : `M${leftBusX} ${p.cy} H${p.x}`} />
          ))}
          <path d={`M${rightTrunkX} ${pillBottom} V${hubStartY}`} />
          {hubPlacements.length > 1 ? <path d={`M${rightTrunkX} ${hubPlacements[0]!.y + hubH} V${hubPlacements[1]!.y}`} /> : null}
          {leafPlacements.length ? (
            <>
              <path d={`M${leafSpineX} ${lastHubBottom} V${leafLastCy}`} />
              {leafPlacements.map((p, i) => (
                <path key={i} d={`M${leafSpineX} ${p.cy} H${p.x}`} />
              ))}
            </>
          ) : null}
        </g>
        <g className="fill-(--deck-marker)">
          <circle cx={leftBusX} cy={coreBottom} r={3} />
          <circle cx={rightTrunkX} cy={coreBottom} r={3} />
          {apPlacements.map((p, i) => (
            <circle key={`ap-dot-${i}`} cx={leftBusX} cy={p.cy} r={2.5} />
          ))}
          {apPlacements.map((p, i) => (
            <circle key={`ap-port-${i}`} cx={p.side === 'left' ? p.x + p.w : p.x} cy={p.cy} r={2} />
          ))}
          {leafPlacements.map((p, i) => (
            <circle key={`leaf-dot-${i}`} cx={leafSpineX} cy={p.cy} r={2.5} />
          ))}
          {leafPlacements.map((p, i) => (
            <circle key={`leaf-port-${i}`} cx={p.x} cy={p.cy} r={2} />
          ))}
        </g>
      </svg>

      <TopoNodeCard box={ac} x={coreX} y={coreY} w={coreW} h={coreH} tone="core" />
      <div className="doc-body absolute top-[74px] left-[16px] flex h-[20px] w-[298px] items-center justify-center rounded-full border border-doc-rule bg-(--deck-box) px-[10px] text-[10.5px] leading-none text-doc-accent">
        <span className="truncate">{apLink}</span>
      </div>
      <div className="doc-body absolute top-[74px] left-[332px] flex h-[20px] w-[256px] items-center justify-center rounded-full border border-doc-rule bg-(--deck-box) px-[10px] text-[10.5px] leading-none text-doc-accent">
        <span className="truncate">LAN 局域网 · 中控网关接入</span>
      </div>

      {apPlacements.map((p, i) => (
        <div
          key={`${p.item.room}-${i}`}
          className="absolute flex flex-col justify-center gap-[2px] overflow-hidden rounded-[calc(var(--deck-radius-sm)/2)] border border-doc-accent/75 bg-(--deck-panel) px-[10px]"
          style={{ left: p.x, top: p.y, width: p.w, height: p.h }}
        >
          <div className="flex items-center justify-between gap-[4px]">
            <p className="doc-strong min-w-0 truncate text-[12px] leading-tight">{p.item.room}</p>
            {p.item.codes ? (
              <span className="doc-latin shrink-0 rounded bg-(--deck-badge) px-[5px] py-[1px] text-[10px] leading-tight text-doc-accent">
                {p.item.codes}
              </span>
            ) : null}
          </div>
          <p className="doc-body truncate text-[10px] leading-tight text-doc-muted">{p.item.sub}</p>
        </div>
      ))}

      {hubPlacements.map((p) => (
        <TopoNodeCard key={p.box.title} box={p.box} x={p.x} y={p.y} w={p.w} h={p.h} tone="hub" />
      ))}
      <p className="doc-body absolute truncate text-[10.5px] leading-none text-doc-accent" style={{ left: leafSpineX + 8, top: lastHubBottom + 9, width: 236 }}>
        {link}
      </p>
      {leafPlacements.map((p, i) => (
        <TopoNodeCard key={`${p.box.title}-${i}`} box={p.box} x={p.x} y={p.y} w={p.w} h={p.h} tone="leaf" />
      ))}
    </div>
  )
}

function TopoNodeCard({
  box,
  x,
  y,
  w,
  h,
  tone,
}: {
  box: TopoBox
  x: number
  y: number
  w: number
  h: number
  tone: 'core' | 'hub' | 'leaf'
}) {
  return (
    <div
      className={cn(
        'absolute flex flex-col justify-center gap-[2px] overflow-hidden rounded-[calc(var(--deck-radius-sm)/2)] border px-[12px]',
        tone === 'core' ? 'border-doc-accent bg-(--deck-box)' : 'bg-(--deck-panel)',
        tone === 'hub' && 'border-doc-accent',
        tone === 'leaf' && 'border-doc-accent/65',
      )}
      style={{ left: x, top: y, width: w, height: h }}
    >
      <div className="flex items-center justify-between gap-[6px]">
        <p className={cn('doc-strong min-w-0 truncate leading-tight', tone === 'core' ? 'text-[14.5px]' : 'text-[13px]')}>{box.title}</p>
        {box.badge ? (
          <span className="doc-latin shrink-0 rounded bg-(--deck-badge) px-[6px] py-[1px] text-[10px] leading-tight text-doc-accent">
            {box.badge}
          </span>
        ) : null}
      </div>
      <p className="doc-body truncate text-[10.5px] leading-tight text-doc-muted">{box.sub}</p>
    </div>
  )
}

function SlideBrand({ company, theme, large = false }: { company: CompanyInfo; theme: DeckTheme; large?: boolean }) {
  return (
    <div className="flex items-center gap-[10px]">
      {company.logo ? (
        <img src={company.logo.url} alt={company.name} className={cn('w-auto object-contain', large ? 'h-[28px]' : 'h-[22px]')} />
      ) : (
        <span
          aria-hidden
          className={cn(
            'shrink-0',
            large ? 'size-[26px]' : 'size-[22px]',
            theme.brandMark === 'outline' ? 'border border-doc-accent' : 'bg-linear-to-r from-doc-soft to-doc-soft-to',
            theme.rounded && 'rounded-full',
          )}
        />
      )}
      <p className={cn('doc-display leading-normal whitespace-nowrap', large ? 'text-[21px]' : 'text-[17px]')}>{company.name}</p>
    </div>
  )
}

function SlideChapter({
  theme,
  no,
  title,
  subtitle,
  tag,
}: {
  theme: DeckTheme
  no: string
  title: string
  subtitle: string
  tag: string
}) {
  if (theme.chapter === 'eyebrow') {
    return (
      <div className="flex h-[92px] w-full shrink-0 items-end gap-[24px] overflow-hidden">
        <div className="flex min-w-px flex-1 flex-col gap-[4px] overflow-hidden">
          <p className="doc-latin text-[11px] tracking-[0.32em] text-doc-accent">{`CHAPTER ${no}  ·  ${tag}`}</p>
          <p className="doc-display truncate text-[36px] leading-[1.3]">{title}</p>
          <p className="doc-body truncate text-[14px] text-doc-muted">{subtitle}</p>
        </div>
        <p className="doc-numeral text-[96px] leading-[0.8] text-doc-accent/25">{no}</p>
      </div>
    )
  }
  if (theme.chapter === 'badge') {
    return (
      <div className="flex h-[92px] w-full shrink-0 items-end gap-[22px] overflow-hidden">
        <span className="doc-numeral mb-[2px] flex size-[72px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-doc-accent text-[28px] text-doc-accent">
          {no}
        </span>
        <div className="flex min-w-px flex-1 flex-col gap-[6px] overflow-hidden">
          <p className="doc-display truncate text-[38px] leading-[1.25]">{title}</p>
          <p className="doc-body truncate text-[14px] text-doc-muted">{subtitle}</p>
        </div>
        <p className="doc-latin text-[11px] tracking-[0.22em] text-doc-accent">{tag}</p>
      </div>
    )
  }
  return (
    <div className="flex h-[92px] w-full shrink-0 items-end gap-[24px] overflow-hidden">
      <p className="doc-numeral text-[88px] leading-[0.85] text-doc-accent">{no}</p>
      <div className="flex min-w-px flex-1 flex-col gap-[6px] overflow-hidden">
        <p className="doc-display truncate text-[38px] leading-[1.25]">{title}</p>
        <p className="doc-body truncate text-[14px] text-doc-muted">{subtitle}</p>
      </div>
      <p className="doc-latin text-[11px] tracking-[0.18em] text-doc-muted">{tag}</p>
    </div>
  )
}

function CoverSlide({
  company,
  theme,
  place,
  customer,
  layoutText,
  pointCount,
  roomCount,
  totalAmount,
  tagline,
  pageNo,
  pageTotal,
}: {
  company: CompanyInfo
  theme: DeckTheme
  place: string
  customer: string
  layoutText: string
  pointCount: number
  roomCount: number
  totalAmount: number
  tagline: string
  pageNo: string
  pageTotal: string
}) {
  const tags = ['生活场景', `${pointCount}点位设计`, '透明报价', '安心交付']
  if (theme.cover === 'immersive') {
    return (
      <div className="relative size-full overflow-hidden">
        <img src={theme.coverPhoto} alt="" className="absolute inset-0 size-full object-cover" />
        <div aria-hidden className="absolute inset-0 bg-linear-to-r from-doc-paper via-doc-paper/80 to-doc-paper/10" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[420px] bg-linear-to-t from-doc-paper via-doc-paper/85 to-transparent" />
        <div className="absolute inset-x-[56px] top-[36px] flex h-[34px] items-center justify-between">
          <SlideBrand company={company} theme={theme} large />
          <p className="doc-latin text-[11px] tracking-[0.28em] text-doc-accent">{theme.coverTagline}</p>
        </div>
        <div className="absolute top-[250px] left-[56px] w-[760px]">
          <p className="doc-latin text-[12px] tracking-[0.36em] text-doc-accent">SMART LIVING PROPOSAL</p>
          <h1 className="doc-display mt-[24px] text-[64px] leading-[1.2]">{theme.headline}</h1>
          <span aria-hidden className="mt-[28px] block h-px w-[120px] bg-doc-accent" />
          <p className="doc-body mt-[24px] text-[22px]">全屋智能 · 点位设计与服务报价</p>
          <p className="doc-body mt-[10px] text-[14px] text-doc-muted">{tags.join('　·　')}</p>
        </div>
        <div className="absolute inset-x-[56px] top-[748px] grid grid-cols-4 gap-[32px] border-t border-doc-accent/40 pt-[22px]">
          {[
            ['PROJECT', place],
            ['CLIENT', `${customer} / ${layoutText}`],
            ['SCALE', `${roomCount}个空间 · ${pointCount}个点位`],
            ['INVESTMENT', money(totalAmount)],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="doc-latin text-[10.5px] tracking-[0.3em] text-doc-accent">{k}</p>
              <p className={k === 'INVESTMENT' ? 'doc-numeral mt-[8px] text-[24px] text-doc-accent' : 'doc-body mt-[10px] text-[16px]'}>{v}</p>
            </div>
          ))}
        </div>
        <div className="absolute inset-x-[56px] top-[906px] flex justify-between text-[11px] text-doc-muted">
          <p className="doc-latin">{tagline}</p>
          <p className="doc-latin text-[12px] text-doc-ink">{`${pageNo} / ${pageTotal}`}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative size-full overflow-hidden">
      <div className="absolute inset-x-[56px] top-[28px] flex h-[34px] items-center justify-between">
        <SlideBrand company={company} theme={theme} large />
        <p className="doc-latin text-[12px] text-doc-muted">{theme.coverTagline}</p>
      </div>
      <div className="absolute inset-x-0 top-[90px] h-[520px] overflow-hidden">
        <img src={theme.coverPhoto} alt="" className="size-full object-cover" />
        <span className="doc-body absolute bottom-[26px] left-[56px] bg-white px-[12px] py-[5px] text-[11px] text-[#252523]">{theme.photoNote}</span>
      </div>
      <div className="absolute top-[648px] left-[56px] w-[830px]">
        <h1 className="doc-display text-[56px] leading-[1.25]">{theme.headline}</h1>
        <p className="doc-body mt-[14px] text-[24px]">全屋智能 · 点位设计与服务报价</p>
        <div className="mt-[16px] flex items-center gap-[20px]">
          <span aria-hidden className="h-[3px] w-[100px] bg-linear-to-r from-doc-soft to-doc-soft-to" />
          <p className="doc-body text-[14px] text-doc-muted">{tags.join('　 /　 ')}</p>
        </div>
      </div>
      <div className="absolute top-[650px] left-[930px] flex w-[454px] flex-col gap-[6px] border-l border-doc-rule pl-[28px]">
        <p className="doc-strong truncate text-[24px]">{place}</p>
        <p className="doc-body truncate text-[17px] text-doc-muted">{`${customer}　/　${layoutText}`}</p>
        <p className="doc-latin text-[13px] text-doc-muted">{`QX-DEMO · V1.0 · 预算 ${money(totalAmount)}`}</p>
        <p className="doc-body truncate text-[13px] text-doc-accent">{`${pointCount} 个智能点位 · 全屋智能设计方案`}</p>
      </div>
      <div className="absolute inset-x-[56px] top-[906px] flex justify-between">
        <p className="doc-latin text-[11px] text-doc-muted">{tagline}</p>
        <p className="doc-latin text-[12px] text-doc-ink">{`${pageNo} / ${pageTotal}`}</p>
      </div>
    </div>
  )
}

function PlanSlide({ data, theme, no }: { data: LandingShowcase; theme: DeckTheme; no: string }) {
  const sheet = data.sheets[0]
  const roomSummary = useMemo(() => {
    if (!sheet) return []
    const map = new Map<string, { name: string; codes: string[]; types: Set<string>; count: number }>()
    for (const p of sheet.points) {
      const r = p.room || '公共区域'
      const cur = map.get(r) ?? { name: r, codes: [], types: new Set<string>(), count: 0 }
      cur.count += 1
      if (p.code) cur.codes.push(p.code)
      cur.types.add(deviceTypeOf(p.type)?.name ?? '设备')
      map.set(r, cur)
    }
    return [...map.values()].slice(0, 8)
  }, [sheet])

  if (!sheet) return null
  return (
    <>
      <SlideChapter
        theme={theme}
        no={no}
        title={`${sheet.floor} · 住宅平面与点位索引`}
        subtitle={`${sheet.name} / 本层共 ${sheet.points.length} 个点位，图面代号与设备清单、报价单一一对应`}
        tag="RESIDENTIAL PLAN"
      />
      <div className="grid h-[74px] w-full shrink-0 grid-cols-4 overflow-hidden rounded-(--deck-radius-sm) border border-(--deck-panel-border) bg-linear-to-r from-doc-soft to-doc-soft-to">
        {[
          ['生活需求', '回家有光，离家少牵挂'],
          ['休息需求', '多层卧室一键关灯入睡'],
          ['网络底座', 'AC 核心管控 + 全屋 AP 漫游'],
          ['配置原则', '够用、可维护、边界清楚'],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col justify-center gap-[4px] px-[22px]">
            <p className="doc-body text-[12px] text-doc-muted">{k}</p>
            <p className="doc-strong truncate text-[17px]">{v}</p>
          </div>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 items-stretch gap-[28px] overflow-hidden">
        <div className="relative flex-1 overflow-hidden rounded-(--deck-radius) border border-(--deck-card-border) bg-white p-4">
          <img src={sheet.url} alt={sheet.name} className="size-full object-contain opacity-75" />
          <svg viewBox="0 0 1200 800" className="absolute inset-0 size-full">
            {sheet.points.map((p, idx) => (
              <g key={p.id} transform={`translate(${p.rx * 1200}, ${p.ry * 800})`}>
                <circle r={12} fill="var(--deck-marker)" stroke="var(--deck-marker-ring)" strokeWidth={2} />
                <text textAnchor="middle" dy="3.5" fontSize={9.5} fontWeight={600} fill="var(--deck-marker-fg)">
                  {String(idx + 1).padStart(2, '0')}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <div className="flex w-[520px] shrink-0 flex-col gap-[12px]">
          <div className="flex items-baseline justify-between">
            <p className="doc-display text-[19px]">分房间点位索引</p>
            <p className="doc-body text-[12.5px] text-doc-accent">{roomSummary.length} 个主要空间</p>
          </div>
          <div className="overflow-hidden rounded-(--deck-radius-sm) border border-doc-rule">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-doc-head text-left text-doc-head-fg">
                  <th className="w-[96px] px-3 py-2 font-medium">空间</th>
                  <th className="w-[120px] px-3 py-2 font-medium">点位代号</th>
                  <th className="px-3 py-2 font-medium">包含设备</th>
                  <th className="w-[64px] px-3 py-2 text-right font-medium">数量</th>
                </tr>
              </thead>
              <tbody>
                {roomSummary.map((r, i) => (
                  <tr key={r.name} className={cn('h-[38px] border-b border-doc-rule', i % 2 === 1 && 'bg-(--deck-box)/50')}>
                    <td className="doc-strong px-3">{r.name}</td>
                    <td className="doc-latin truncate px-3 text-doc-accent">{codeRange(r.codes)}</td>
                    <td className="doc-body truncate px-3 text-doc-muted">{[...r.types].slice(0, 3).join('、')}</td>
                    <td className="doc-latin px-3 text-right tabular-nums">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}

function ZoneSlide({ data, theme, no }: { data: LandingShowcase; theme: DeckTheme; no: string }) {
  return (
    <>
      <SlideChapter
        theme={theme}
        no={no}
        title="进门的那一刻，生活开始切换。"
        subtitle="以明确的触发方式，连接玄关、客厅与餐厅的照明、窗帘与全屋网络"
        tag="ARRIVE & LIVING"
      />
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-[28px] overflow-hidden">
        <div className="col-span-7 flex flex-col gap-[16px]">
          <div className="relative h-[380px] overflow-hidden rounded-(--deck-radius)">
            <img src="/proposal/photos/living.jpg" alt="" className="size-full object-cover" />
            <span className="doc-body absolute bottom-4 left-4 bg-white/90 px-3 py-1 text-[11px] text-[#252523]">
              氛围意向图 · 客餐厅与玄关场景示意
            </span>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-[16px]">
            {['客厅', '餐厅'].map((roomName) => {
              const pts = data.sheets[0]?.points.filter((p) => p.room === roomName) ?? []
              return (
                <div key={roomName} className="flex flex-col justify-between rounded-(--deck-radius-sm) border border-doc-rule bg-(--deck-card) p-[18px]">
                  <div className="flex items-baseline justify-between border-b border-doc-rule pb-2">
                    <span className="doc-strong text-[16px]">1F · {roomName}</span>
                    <span className="doc-latin text-[12px] text-doc-accent">{pts.length} 个点位</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[12px] text-doc-muted">
                    {pts.slice(0, 6).map((p) => (
                      <span key={p.id} className="inline-flex items-center gap-1 rounded bg-(--deck-box) px-2 py-0.5">
                        <PointMarker type={p.type} className="size-3.5" />
                        <span>{deviceTypeOf(p.type)?.name}</span>
                        <span className="doc-latin text-doc-accent">{p.code}</span>
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-doc-muted">点位代号：{codeRange(pts.map((p) => p.code))}</p>
                </div>
              )
            })}
          </div>
        </div>
        <div className="col-span-5 flex flex-col gap-[16px]">
          <p className="doc-display text-[20px]">本空间预设联动场景</p>
          {[
            ['回家迎宾模式', '玄关智能门锁验证通过或轻触玄关四键场景开关 → 玄关筒灯与客厅灯带渐亮至 80%、电动窗帘缓缓开启、背景音乐轻柔播放。'],
            ['会客明亮模式', '中控屏一键触发或语音指令 → 客厅磁吸轨道灯、筒灯与餐厅吊灯全开，空调自动调节至舒适温度。'],
            ['观影沉浸模式', '关闭客餐厅主灯与射灯，仅保留 20% 柔光灯带，电动窗帘自动闭合，减少屏幕反光。'],
            ['安心离家模式', '一键关闭全屋照明、空调与非必要插座电源，门窗传感器与烟雾/水浸守护自动进入布防状态。'],
          ].map(([name, desc], idx) => (
            <div key={name} className="flex flex-col gap-[6px] rounded-(--deck-radius-sm) border border-(--deck-panel-border) bg-(--deck-panel) p-[18px]">
              <div className="flex items-center justify-between">
                <span className="doc-strong text-[15px]">{name}</span>
                <span className="doc-latin text-[11px] text-doc-accent">SCENE 0{idx + 1}</span>
              </div>
              <p className="doc-body text-[12.5px] leading-[1.6] text-doc-muted">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function ServiceSlide({
  data,
  company,
  theme,
  totalAmount,
  no,
}: {
  data: LandingShowcase
  company: CompanyInfo
  theme: DeckTheme
  totalAmount: number
  no: string
}) {
  const amounts = paymentAmounts(totalAmount, DEFAULT_PAYMENTS)
  return (
    <>
      <SlideChapter
        theme={theme}
        no={no}
        title="交付有标准，验收有记录。"
        subtitle="四步标准服务流程 / 现场逐项打勾验收 / 合同付款节点清晰透明"
        tag="SERVICE & DELIVERY"
      />
      <div className="grid grid-cols-4 gap-[16px]">
        {[
          ['01', '现场勘测', '复核户型、零火线供电、弱电箱六类网线与安装条件'],
          ['02', '方案确认', `核对 ${data.pointCount} 个点位、网络拓扑、产品型号及报价边界`],
          ['03', '安装联调', '设备到场开箱核验，按图逐点安装、配网与场景联调'],
          ['04', '验收培训', '双方现场逐项打勾测试，移交账号、点位图与质保凭证'],
        ].map(([no, title, sub]) => (
          <div key={no} className="rounded-(--deck-radius-sm) border border-doc-rule bg-(--deck-card) p-[18px]">
            <p className="doc-latin text-[12px] text-doc-accent">STEP {no}</p>
            <p className="doc-strong mt-1 text-[17px]">{title}</p>
            <p className="doc-body mt-1.5 text-[12.5px] leading-relaxed text-doc-muted">{sub}</p>
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-[28px]">
        <div className="col-span-6 flex flex-col gap-[12px]">
          <p className="doc-display text-[19px]">共同验收清单（现场逐项打勾）</p>
          <div className="flex flex-1 flex-col justify-between rounded-(--deck-radius-sm) border border-doc-rule bg-(--deck-card) p-[20px] text-[13px]">
            {[
              `核对全屋 ${data.pointCount} 台/只智能设备的编号、型号、安装位置与数量。`,
              '测试全部智能开关面板、调光灯具与电动窗帘开合行程。',
              '实测 AC 控制器与各房间 AP 节点漫游切换、中控网关信号覆盖。',
              '演示回家、离家、观影、睡眠等预设联动场景及手动应急操作。',
              '测试水浸、烟感、人体与门磁传感器触发告警及手机 App 推送。',
              '主账号移交业主绑定，交付竣工点位图、设备清单与售后服务卡。',
            ].map((line) => (
              <div key={line} className="flex items-center gap-3">
                <DocCheckbox className="text-doc-accent" />
                <span>{line}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="col-span-6 flex flex-col justify-between">
          <div className="space-y-[12px]">
            <div className="flex items-baseline justify-between">
              <p className="doc-display text-[19px]">付款节点</p>
              <p className="doc-body text-[13px] text-doc-accent">方案总计 {yuan(totalAmount)}</p>
            </div>
            <div className="overflow-hidden rounded-(--deck-radius-sm) border border-doc-rule">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-doc-head text-left text-doc-head-fg">
                    <th className="px-3 py-2 font-medium">阶段</th>
                    <th className="w-[80px] px-3 py-2 text-right font-medium">比例</th>
                    <th className="w-[140px] px-3 py-2 text-right font-medium">应付金额</th>
                  </tr>
                </thead>
                <tbody>
                  {DEFAULT_PAYMENTS.map((p, i) => (
                    <tr key={p.name} className="h-[42px] border-b border-doc-rule">
                      <td className="px-3">{p.name}</td>
                      <td className="doc-latin px-3 text-right tabular-nums">{p.percent}%</td>
                      <td className="doc-latin px-3 text-right font-medium tabular-nums text-doc-accent">{yuan(amounts[i] ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="rounded-(--deck-radius-sm) bg-linear-to-r from-doc-soft to-doc-soft-to p-[20px]">
            <p className="doc-strong text-[15px]">{company.name} · 交付服务承诺</p>
            <p className="doc-body mt-1 text-[12.5px] text-doc-muted">
              报价单确认后一键生成正式合同，全屋智能硬件享受原厂标准质保与现场安装调试保障。
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
