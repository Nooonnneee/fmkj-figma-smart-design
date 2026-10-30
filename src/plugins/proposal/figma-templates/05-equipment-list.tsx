/**
 * Figma 方案模板 · 05 设备与选型清单
 * 完整列出产品图、名称、设备类别、品牌、型号 SKU、应用空间分布、数量、单价与小计。
 */
import { ProductThumb } from '@/components/product-thumb'
import { categoryOfType, deviceTypeOf } from '@/lib/device-types'
import type { ProjectDocsData } from '@/lib/project-docs'
import { yuan } from '@/lib/quotes'

import { FigmaChapter, FigmaSlidePage, FigmaTable, money, type FigmaTemplateCtx } from './shared'

export function FigmaEquipmentPage({
  ctx,
  no,
  total,
  rows,
  part,
  isLast,
}: {
  ctx: FigmaTemplateCtx
  no: number
  total: number
  rows: ProjectDocsData['products']
  part: string
  isLast: boolean
}) {
  const { d } = ctx
  const pageSubtotal = rows.reduce((s, r) => s + r.subtotal, 0)
  const pageCount = rows.reduce((s, r) => s + r.count, 0)

  return (
    <FigmaSlidePage ctx={ctx} no={no} total={total} frameName={`05 设备清单${part}`}>
      <FigmaChapter
        no={no}
        title={`设备与选型清单${part}`}
        subtitle={
          d.quote
            ? `型号、应用空间、数量与单价已与「${d.quote.title}」同步 / 全屋共 ${d.products.length} 款设备、${d.points.length} 个点位`
            : `型号、应用空间、数量与金额 / 全屋共 ${d.products.length} 款设备、${d.points.length} 个点位`
        }
        tag="EQUIPMENT SCHEDULE"
      />
      <div className="flex w-full flex-1 flex-col justify-between overflow-hidden">
        <FigmaTable
          rowClassName="min-h-[48px] text-[13.5px]"
          columns={[
            { label: '产品名称 / 类别与品牌', className: 'w-[410px]' },
            { label: '型号 / SKU', className: 'w-[200px]' },
            { label: '安装区域分布', className: 'w-[348px]' },
            { label: '数量', className: 'w-[90px]' },
            { label: '单价 / 元', className: 'w-[130px]' },
            { label: '小计 / 元', className: 'w-[150px]' },
          ]}
          rows={rows.map((r) => [
            <span key="p" className="flex items-center gap-[10px]">
              <ProductThumb src={r.product.image?.url} alt={r.product.name} className="size-[32px]" />
              <span className="min-w-0 flex-1">
                <span className="doc-strong block truncate text-doc-ink">{r.product.name}</span>
                <span className="doc-body flex items-center gap-[6px] text-[11px] text-doc-muted">
                  <span
                    className="size-[6px] shrink-0 rounded-full"
                    style={{ backgroundColor: categoryOfType(r.deviceType)?.color }}
                  />
                  {deviceTypeOf(r.deviceType)?.name}
                  {r.product.brand ? ` · ${r.product.brand.name}` : ''}
                </span>
              </span>
            </span>,
            <span key="s" className="doc-latin block truncate text-[12px] text-doc-muted">
              {r.product.sku || '—'}
            </span>,
            <span key="r" className="doc-body block truncate text-[12px] text-doc-muted" title={r.rooms.join('、')}>
              {r.rooms.slice(0, 5).join('、')}
              {r.rooms.length > 5 ? ` 等 ${r.rooms.length} 处` : ''}
            </span>,
            <span key="c" className="doc-strong text-doc-accent">
              {r.count} {r.product.unit || '个'}
            </span>,
            <span key="u" className="doc-latin text-doc-ink">
              {money(r.product.price)}
            </span>,
            <span key="t" className="doc-latin doc-strong text-doc-ink">
              {money(r.subtotal)}
            </span>,
          ])}
        />

        <div className="flex h-[46px] w-full shrink-0 items-center justify-between border border-doc-rule bg-white px-[18px] text-[14px]">
          <span className="doc-body text-doc-muted">
            本页小计：{rows.length} 款产品 · {pageCount} 台/只设备（¥{money(pageSubtotal)}）
          </span>
          {isLast ? (
            <span className="doc-strong text-doc-ink">
              全屋设备总计：<span className="text-doc-accent">{d.points.length} 个点位</span> ·{' '}
              <span className="doc-latin text-[16px]">{yuan(d.total)}</span>
            </span>
          ) : (
            <span className="doc-body text-doc-accent">下页接续设备清单 →</span>
          )}
        </div>
      </div>
    </FigmaSlidePage>
  )
}
