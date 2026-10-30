/**
 * Figma 方案模板 · 03 楼层点位布置图
 * 点位图仅显示放大图标（或产品图）与设备类别名称，不显示内部点位代号；右侧完整列出本层图例与选型。
 */
import { PlanFigure } from '@/components/plan-figure'
import { PointMarker } from '@/components/point-marker'
import { ProductThumb } from '@/components/product-thumb'
import { deviceTypeOf, DEVICE_TYPE_ORDER } from '@/lib/device-types'
import { yuan } from '@/lib/quotes'
import { cn } from '@/lib/utils'

import { FigmaChapter, FigmaSectionTitle, FigmaSlidePage, money, type FigmaTemplateCtx } from './shared'

export function FigmaFloorPlanPage({
  ctx,
  no,
  total,
  sheetId,
}: {
  ctx: FigmaTemplateCtx
  no: number
  total: number
  sheetId: string
}) {
  const { d, markers } = ctx
  const sheet = d.sheets.find((s) => s.id === sheetId)!
  const pts = d.points.filter((p) => p.sheetId === sheetId)
  const areas = d.areas
    .filter((a) => a.sheetId === sheetId)
    .map((a) => ({
      id: a.id,
      name: a.name,
      x0: (a.x - sheet.x) / sheet.width,
      y0: (a.y - sheet.y) / sheet.height,
      x1: (a.x + a.width - sheet.x) / sheet.width,
      y1: (a.y + a.height - sheet.y) / sheet.height,
    }))
  const types = DEVICE_TYPE_ORDER.filter((t) => pts.some((p) => p.deviceType === t))
  const floorSubtotal = pts.reduce((s, p) => s + (p.productId ? (d.productById.get(p.productId)?.price ?? 0) : 0), 0)
  const roomCount = areas.length || new Set(pts.map((p) => p.areaId).filter(Boolean)).size

  // 根据本层设备种类数量自适应图例行高，保证 16 类以内一页完整呈现不截断
  const compactLegend = types.length > 10

  return (
    <FigmaSlidePage ctx={ctx} no={no} total={total} frameName={`03 点位布置 · ${sheet.name}`}>
      <FigmaChapter
        no={no}
        title={sheet.name}
        subtitle={`本层共 ${pts.length} 个智能点位 · 覆盖 ${roomCount} 个区域 · ${types.length} 类设备 · 本层设备预算 ${yuan(floorSubtotal)}`}
        tag="FLOOR PLAN & LEGEND"
      />
      <div className="flex min-h-0 w-full flex-1 items-stretch gap-[32px] overflow-hidden">
        <div className="flex min-w-0 flex-1 items-center justify-center border border-doc-rule bg-white p-[14px]">
          <PlanFigure
            sheetUrl={sheet.url}
            points={pts.map((p) => ({
              ...p,
              image: p.productId ? d.productById.get(p.productId)?.image?.url : null,
            }))}
            areas={areas}
            mode={markers}
            showCodes={true}
            showAreas={true}
            className="max-h-full w-full"
          />
        </div>

        <div className="flex w-[420px] shrink-0 flex-col gap-[12px] overflow-hidden">
          <FigmaSectionTitle title="本层设备图例与选型" note={`${types.length} 类设备 / ${pts.length} 个点位`} />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-doc-rule">
            <div className="doc-strong flex h-[36px] w-full shrink-0 items-center bg-doc-head text-[12px] text-doc-head-fg">
              <p className="w-[244px] shrink-0 pl-[12px]">设备类别 / 选用型号</p>
              <p className="w-[68px] shrink-0 text-right">数量</p>
              <p className="w-[96px] shrink-0 pr-[12px] text-right">小计 / 元</p>
            </div>
            <div className="flex flex-1 flex-col justify-between overflow-hidden">
              <div className="flex flex-col overflow-hidden">
                {types.slice(0, 15).map((t, i) => {
                  const list = pts.filter((p) => p.deviceType === t)
                  const product = list[0]?.productId ? d.productById.get(list[0].productId) : null
                  const sub = list.reduce((s, p) => s + (p.productId ? (d.productById.get(p.productId)?.price ?? 0) : 0), 0)
                  return (
                    <div
                      key={t}
                      className={cn(
                        'flex w-full items-center border-b border-doc-rule',
                        compactLegend ? 'h-[37px] text-[12.5px]' : 'h-[46px] text-[13.5px]',
                        i % 2 ? 'bg-doc-stripe' : 'bg-doc-paper',
                      )}
                    >
                      <div className="flex w-[244px] shrink-0 items-center gap-[8px] overflow-hidden pl-[10px]">
                        {markers === 'product' && product?.image ? (
                          <ProductThumb
                            src={product.image.url}
                            alt={product.name}
                            className={cn('rounded-full', compactLegend ? 'size-[22px]' : 'size-[26px]')}
                          />
                        ) : (
                          <PointMarker type={t} className={compactLegend ? 'size-[20px]' : 'size-[24px]'} />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-[6px]">
                            <span className="doc-strong shrink-0 text-doc-ink">{deviceTypeOf(t)?.name}</span>
                            {product?.brand ? (
                              <span className="doc-body truncate text-[10.5px] text-doc-muted">{product.brand.name}</span>
                            ) : null}
                          </div>
                          <span className="doc-body block truncate text-[11px] leading-tight text-doc-muted">
                            {product ? product.name : '待选型'}
                          </span>
                        </div>
                      </div>
                      <div className="doc-strong w-[68px] shrink-0 text-right text-doc-accent">
                        × {list.length}
                      </div>
                      <div className="doc-latin w-[96px] shrink-0 pr-[12px] text-right text-[12.5px] text-doc-ink">
                        {money(sub)}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex h-[40px] w-full shrink-0 items-center justify-between border-t border-doc-ink/20 bg-white px-[12px] text-[13px]">
                <span className="doc-strong text-doc-ink">{sheet.name} 合计</span>
                <span className="doc-strong text-doc-accent">{pts.length} 个点位</span>
                <span className="doc-strong doc-latin text-doc-ink">{yuan(floorSubtotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </FigmaSlidePage>
  )
}
