'use client'

import { useRef, useState } from 'react'
import { Check, Copy, ImageDown, Loader2, Share2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { PlanFigure, type PlanArea, type PlanPoint } from '@/components/plan-figure'
import { PointMarker } from '@/components/point-marker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export type SocialPosterData = {
  title: string
  platform: string
  pointCount: number
  roomCount: number
  floorCount: number
  totalAmount: number | null
  companyName: string
  qrCodeUrl: string | null
  sheet: {
    name: string
    url: string
    points: PlanPoint[]
    areas: PlanArea[]
  } | null
  topTypes: { type: string; name: string; count: number }[]
}

function budgetBand(amount: number | null, hideExact: boolean): string {
  if (!amount || amount <= 0) return '按需定制'
  if (!hideExact) return `¥${amount.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
  if (amount < 10000) return '1W 以内'
  const w = Math.floor(amount / 5000) * 0.5
  return `${w}W+ 整装方案`
}

export function SocialPosterDialog({ data }: { data: SocialPosterData }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<'qixu' | 'noir'>('qixu')
  const [hideExactPrice, setHideExactPrice] = useState(true)
  const [showQr, setShowQr] = useState(true)
  const [busy, setBusy] = useState(false)
  const [generatedPng, setGeneratedPng] = useState<string | null>(null)
  const [copiedText, setCopiedText] = useState(false)

  const priceDisplay = budgetBand(data.totalAmount, hideExactPrice)
  const isDark = theme === 'noir'

  const socialCaption = [
    `【全屋智能落地案例】${data.title}`,
    `生态平台：${data.platform || '全屋智能'} · 共 ${data.pointCount} 个智能点位（覆盖 ${data.roomCount || 1} 个空间）`,
    data.topTypes.length
      ? `核心配置：${data.topTypes.slice(0, 5).map((t) => `${t.name}×${t.count}`).join('、')}`
      : '',
    `预算参考：${priceDisplay}`,
    `从户型图点位落位、全屋 Wi-Fi/中控组网到水电交底清单一次配齐。需要同款全屋智能方案或点位图设计的业主/设计师欢迎交流！`,
    `#全屋智能 #智能家居设计 #${(data.platform || '米家').replace(/\s+/g, '')}全屋智能 #全屋智能点位图 #智能家居报价 #繁梦空间`,
  ]
    .filter(Boolean)
    .join('\n')

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(socialCaption)
      setCopiedText(true)
      toast.success('已复制小红书 / 朋友圈晒单文案')
      setTimeout(() => setCopiedText(false), 2000)
    } catch {
      toast.error('复制失败，请手动选中复制')
    }
  }

  const handleDownloadPoster = async () => {
    if (!cardRef.current || busy) return
    setBusy(true)
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 3,
        cacheBust: false,
      })
      setGeneratedPng(dataUrl)
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${data.title}-小红书晒单海报.png`
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      a.remove()
      toast.success('已生成 3:4 高清晒单海报（手机端可直接长按下方预览图保存）')
    } catch {
      toast.error('生成海报失败，请稍后重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="size-4" />
          生成小红书 / 朋友圈晒单图
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-4xl gap-5 overflow-y-auto p-5 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="size-4 text-primary" />
            小红书 / 朋友圈 3:4 案例晒单生成器
          </DialogTitle>
          <DialogDescription className="text-xs">
            自动隐藏业主真实姓名与门牌号，一键生成 3:4 黄金比例高清案例图与种草文案，适合发小红书、朋友圈与业主群。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* 左侧：3:4 竖版海报画布（360×480 预览，3倍导出为 1080×1440） */}
          <div className="flex flex-col items-center gap-3">
            <div
              ref={cardRef}
              style={{ width: 360, height: 480 }}
              className={cn(
                'relative flex shrink-0 flex-col justify-between overflow-hidden rounded-xl p-5 shadow-md select-none',
                isDark ? 'bg-[#141413] text-[#F5F2EB]' : 'bg-[#FAF8F5] text-[#1C1B18]',
              )}
            >
              {/* 顶部项目抬头 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className={cn('text-[10px] font-semibold tracking-[0.22em]', isDark ? 'text-[#D4AF37]' : 'text-[#6E5D4F]')}>
                    SMART HOME CASE STUDY
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-medium',
                      isDark ? 'bg-[#262522] text-[#D4AF37]' : 'bg-[#EDE8E0] text-[#57493E]',
                    )}
                  >
                    {data.platform || '全屋智能'}
                  </span>
                </div>
                <h3 className="truncate text-lg font-semibold tracking-tight">{data.title} · 全屋智能方案</h3>
              </div>

              {/* 中间户型点位图（直接显示高清设备图标） */}
              <div className="my-2.5 flex flex-1 flex-col justify-center overflow-hidden rounded-xl border border-black/10 bg-white p-2 shadow-2xs">
                {data.sheet ? (
                  <>
                    <PlanFigure
                      sheetUrl={data.sheet.url}
                      points={data.sheet.points}
                      areas={data.sheet.areas}
                      mode="symbol"
                      showCodes={false}
                      className="w-full rounded-lg"
                    />
                    <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-neutral-500">
                      <span className="truncate font-medium text-neutral-700">{data.sheet.name}</span>
                      <span>设备图标点位实景落位</span>
                    </div>
                  </>
                ) : (
                  <div className="flex h-40 items-center justify-center text-xs text-neutral-400">暂无户型点位图</div>
                )}
              </div>

              {/* 核心指标三宫格 + 代表设备图标 */}
              <div className="space-y-2.5">
                <div
                  className={cn(
                    'grid grid-cols-3 divide-x rounded-xl border py-2 text-center',
                    isDark ? 'divide-white/10 border-white/10 bg-[#1E1D1B]' : 'divide-black/8 border-black/8 bg-white/80',
                  )}
                >
                  <div>
                    <p className={cn('text-[10px]', isDark ? 'text-neutral-400' : 'text-neutral-500')}>智能点位</p>
                    <p className="mt-0.5 text-sm font-bold tabular-nums">{data.pointCount} 点</p>
                  </div>
                  <div>
                    <p className={cn('text-[10px]', isDark ? 'text-neutral-400' : 'text-neutral-500')}>覆盖空间</p>
                    <p className="mt-0.5 text-sm font-bold tabular-nums">
                      {data.floorCount > 1 ? `${data.floorCount}层 · ` : ''}
                      {Math.max(1, data.roomCount)} 间
                    </p>
                  </div>
                  <div>
                    <p className={cn('text-[10px]', isDark ? 'text-neutral-400' : 'text-neutral-500')}>方案预算</p>
                    <p className={cn('mt-0.5 text-sm font-bold tabular-nums', isDark ? 'text-[#D4AF37]' : 'text-[#7C5836]')}>{priceDisplay}</p>
                  </div>
                </div>

                {data.topTypes.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {data.topTypes.slice(0, 5).map((t) => (
                      <span
                        key={t.type}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px]',
                          isDark ? 'bg-white/8 text-neutral-200' : 'bg-black/5 text-neutral-700',
                        )}
                      >
                        <PointMarker type={t.type} className="size-3.5" />
                        {t.name} ×{t.count}
                      </span>
                    ))}
                  </div>
                ) : null}

                {/* 底部署名与微信二维码 */}
                <div
                  className={cn(
                    'flex items-center justify-between border-t pt-2.5',
                    isDark ? 'border-white/10' : 'border-black/10',
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{data.companyName}</p>
                    <p className={cn('text-[10px]', isDark ? 'text-neutral-400' : 'text-neutral-500')}>
                      繁梦空间 FMKJ · 全屋智能方案工作台
                    </p>
                  </div>
                  {showQr && data.qrCodeUrl ? (
                    <div className="shrink-0 overflow-hidden rounded-md bg-white p-0.5 shadow-2xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={data.qrCodeUrl} alt="微信二维码" className="size-9 object-contain" />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* 右侧：海报设置、爆款文案复制与导出 */}
          <div className="flex flex-col justify-between gap-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">海报视觉主题</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={theme === 'qixu' ? 'default' : 'outline'}
                    onClick={() => setTheme('qixu')}
                  >
                    栖序雅致（暖白高定）
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={theme === 'noir' ? 'default' : 'outline'}
                    onClick={() => setTheme('noir')}
                  >
                    墨金臻选（黑金大宅）
                  </Button>
                </div>
              </div>

              <div className="space-y-2.5 rounded-xl border bg-muted/25 p-3.5 text-xs">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <span>隐藏具体成交金额（仅显示「1.5W+ 整装方案」脱敏区间）</span>
                  <Switch checked={hideExactPrice} onCheckedChange={setHideExactPrice} />
                </label>
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <span>在海报右下角附带微信联系二维码</span>
                  <Switch checked={showQr} onCheckedChange={setShowQr} />
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">自动生成的小红书 / 朋友圈文案</p>
                  <Button type="button" variant="ghost" size="xs" onClick={() => void handleCopyCaption()}>
                    {copiedText ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copiedText ? '已复制文案' : '复制文案'}
                  </Button>
                </div>
                <pre className="whitespace-pre-wrap rounded-xl border bg-muted/30 p-3 font-sans text-xs leading-relaxed text-foreground">
                  {socialCaption}
                </pre>
              </div>

              {generatedPng ? (
                <div className="space-y-1.5 rounded-xl border bg-muted/20 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">已生成高清图（手机端可直接长按图片保存相册）：</span>
                    <Badge variant="secondary">1080 × 1440</Badge>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={generatedPng} alt="生成的小红书晒单海报" className="mx-auto max-h-44 w-auto rounded-lg border shadow-2xs" />
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2.5 border-t pt-3">
              <Button type="button" onClick={() => void handleDownloadPoster()} disabled={busy} className="flex-1">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <ImageDown className="size-4" />}
                {busy ? '正在渲染高清海报…' : '下载 3:4 高清晒单海报 (PNG)'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => void handleCopyCaption()}>
                {copiedText ? <Check className="size-4" /> : <Copy className="size-4" />}
                一键复制配套文案
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
