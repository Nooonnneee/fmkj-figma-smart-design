import { categoryOfType, deviceTypeOf } from '@/lib/device-types'
import { markerSrc } from '@/lib/point-marker-data'
import type { PlanAreaShape } from '@/lib/point-scene'
import { SHEET } from '@/lib/sheet-spec'
import { cn } from '@/lib/utils'

export type PlanPoint = { id: string; deviceType: string; code: string; rx: number | null; ry: number | null; image?: string | null }
/** 区域：比例坐标的外接框，多边形区域带 poly 轮廓（用 planAreaOf 生成） */
export type PlanArea = PlanAreaShape

/** 区域轮廓（比例坐标）与区域名位置：最上方（同高取最左）的顶点 */
export function planAreaOutline(a: PlanArea): [number, number][] {
  return (
    a.poly ?? [
      [a.x0, a.y0],
      [a.x1, a.y0],
      [a.x1, a.y1],
      [a.x0, a.y1],
    ]
  )
}
export const planAreaLabelAt = (a: PlanArea): [number, number] =>
  planAreaOutline(a).reduce((best, q) => (q[1] < best[1] - 1e-4 || (Math.abs(q[1] - best[1]) <= 1e-4 && q[0] < best[0]) ? q : best))

/**
 * 方案图：标准图纸 + 点位（矢量，打印清晰）。
 * - symbol：平台设备图标；
 * - product：产品图（统一规格：白底圆框、类别色描边、图片等比居中），没有产品图时回退到图标。
 * 导出与展示时图标下方显示设备类别名称（如「单开」「双开」「中控屏」「摄像头」），不显示内部编号。
 * 图标使用内嵌 SVG DataURL，导出 PDF / PNG 时不会因外链子资源被浏览器拦截而漏图。
 */
export function PlanFigure({
  sheetUrl,
  points,
  areas = [],
  mode = 'symbol',
  showCodes = true,
  showAreas = true,
  dim = 0.55,
  className,
}: {
  sheetUrl: string | null
  points: PlanPoint[]
  areas?: PlanArea[]
  mode?: 'symbol' | 'product'
  showCodes?: boolean
  showAreas?: boolean
  dim?: number
  className?: string
}) {
  const W = SHEET.pixelWidth
  const H = SHEET.pixelHeight
  const S = mode === 'product' ? 78 : 64
  const placed = points.filter((p) => p.rx !== null && p.ry !== null)
  return (
    <div className={cn('relative aspect-[3/2] overflow-hidden bg-white', className)}>
      {sheetUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sheetUrl}
          alt=""
          loading="eager"
          decoding="sync"
          className="block size-full object-contain select-none"
          style={{ opacity: dim }}
        />
      ) : null}
      <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 size-full" role="img" aria-label="点位方案图">
        {showAreas
          ? areas.map((a) => {
              const [lx, ly] = planAreaLabelAt(a)
              return (
                <g key={a.id}>
                  <polygon
                    points={planAreaOutline(a)
                      .map(([x, y]) => `${x * W},${y * H}`)
                      .join(' ')}
                    fill="#0f172a"
                    fillOpacity={0.025}
                    stroke="#64748b"
                    strokeWidth={2.4}
                    strokeLinejoin="round"
                  />
                  <text x={lx * W + 12} y={ly * H + 34} fontSize={26} fontWeight={600} fill="#475569" stroke="#fff" strokeWidth={6} paintOrder="stroke">
                    {a.name}
                  </text>
                </g>
              )
            })
          : null}
        {placed.map((p) => {
          const cx = p.rx! * W
          const cy = p.ry! * H
          const color = categoryOfType(p.deviceType)?.color ?? '#525252'
          const isProd = mode === 'product' && Boolean(p.image)
          const typeLabel = deviceTypeOf(p.deviceType)?.name ?? '设备'
          return (
            <g key={p.id}>
              {isProd ? (
                <circle cx={cx} cy={cy} r={S / 2} fill="#f1f1f1" stroke={color} strokeWidth={5} />
              ) : (
                <image href={markerSrc(p.deviceType)} x={cx - S / 2} y={cy - S / 2} width={S} height={S} />
              )}
              {showCodes && typeLabel ? (
                <text x={cx} y={cy + S / 2 + 24} textAnchor="middle" fontSize={22} fontWeight={700} fill={color} stroke="#fff" strokeWidth={6} paintOrder="stroke">
                  {typeLabel}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>
      {mode === 'product'
        ? placed
            .filter((p) => p.image)
            .map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`img-${p.id}`}
                src={p.image!}
                alt=""
                loading="eager"
                decoding="sync"
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full object-contain select-none"
                style={{
                  left: `${p.rx! * 100}%`,
                  top: `${p.ry! * 100}%`,
                  width: `${((S - 14) / W) * 100}%`,
                  height: `${((S - 14) / H) * 100}%`,
                }}
              />
            ))
        : null}
    </div>
  )
}
