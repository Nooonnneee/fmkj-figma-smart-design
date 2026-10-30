/**
 * Figma 方案模板 · 01 项目封面与方案总览
 */
import { PlanFigure } from '@/components/plan-figure'
import { pointScopeLabel } from '@/lib/point-scopes'
import { yuan } from '@/lib/quotes'

import { FigmaChapter, FigmaSectionTitle, FigmaSlidePage, FigmaStepCard, type FigmaTemplateCtx } from './shared'

export function FigmaCoverPage({ ctx, no, total }: { ctx: FigmaTemplateCtx; no: number; total: number }) {
  const { d } = ctx
  const brands = [...new Set(d.products.map((r) => r.product.brand?.name).filter((v): v is string => !!v))]
  const main = d.sheets
    .slice()
    .sort((a, b) => d.points.filter((p) => p.sheetId === b.id).length - d.points.filter((p) => p.sheetId === a.id).length)[0]

  const address = [d.project.community, d.project.address].filter(Boolean).join(' ')
  const advisor = [d.owner?.name, d.owner?.phone || d.company.phone].filter(Boolean).join(' · ')
  const scopeDesc = d.scope === 'all' ? '全屋智能设计方案' : `全屋智能设计方案（${pointScopeLabel(d.scope)}）`

  const facts: [string, string][] = [
    ['业主姓名', [d.project.customerName, d.project.customerPhone].filter(Boolean).join(' · ') || '—'],
    ['项目地址', address || d.project.name],
    ['智能生态', d.project.platform ?? '待定'],
    ['空间规模', `${d.sheets.length} 层图纸 · ${d.rooms.length} 个功能区域 · ${d.points.length} 个智能点位`],
    ['关联报价', d.quote ? `${d.quote.title}（${yuan(d.quote.total)}）` : `按选型设备合计 ${yuan(d.total)}`],
    ['项目顾问', advisor || d.company.name],
  ]

  return (
    <FigmaSlidePage ctx={ctx} no={no} total={total} frameName="01 项目封面 · 全屋智能方案">
      <FigmaChapter
        no={no}
        title={d.project.name}
        subtitle={`${scopeDesc} / 覆盖 ${d.sheets.length} 层空间、${d.rooms.length} 个房间、${d.points.length} 个智能点位`}
        tag="SMART HOME PROPOSAL"
      />
      <div className="flex h-[106px] w-full shrink-0 items-start gap-[28px] overflow-hidden" data-name="核心指标">
        <FigmaStepCard
          no={String(d.points.length)}
          title="智能点位"
          note={`分布于 ${d.sheets.length} 张标准图纸、${d.rooms.length} 个独立功能区`}
        />
        <FigmaStepCard
          no={String(d.products.length)}
          title="严选设备型号"
          note={brands.length ? `精选 ${brands.slice(0, 4).join('、')}${brands.length > 4 ? `等 ${brands.length} 大品牌` : ''}` : '按项目点位严选匹配型号'}
        />
        <FigmaStepCard
          no={String(d.categories.length)}
          title="智能子系统"
          note={d.categories.slice(0, 5).map((c) => `${c.name}(${c.count})`).join(' · ') || '—'}
        />
        <FigmaStepCard
          no={yuan(ctx.finalAmount).replace('.00', '')}
          title={d.quote ? '方案总预算' : '设备总预算'}
          note={
            d.quote
              ? `含设备 ${yuan(d.total).replace('.00', '')}${d.quote.feeTotal ? ` · 施工服务 ${yuan(d.quote.feeTotal).replace('.00', '')}` : ''}${d.quote.discount ? ` · 优惠 -${yuan(d.quote.discount).replace('.00', '')}` : ''}`
              : d.pending
                ? `另有 ${d.pending} 个点位待选型`
                : '按当前选型产品售价核算'
          }
        />
      </div>

      <div className="flex min-h-0 w-full flex-1 items-stretch gap-[40px] overflow-hidden">
        <div className="flex w-[600px] shrink-0 flex-col justify-between gap-[14px] overflow-hidden">
          <div className="flex flex-col gap-[12px]">
            <FigmaSectionTitle title="项目档案" note={`文档编号 ${ctx.docNo}`} />
            <dl className="flex flex-col">
              {facts.map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-baseline gap-[24px] border-b border-doc-rule py-[9.5px] text-[14px] leading-[1.6]"
                >
                  <dt className="doc-body w-[84px] shrink-0 text-[13px] text-doc-muted">{k}</dt>
                  <dd className="doc-body min-w-0 flex-1 truncate text-doc-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {d.floors.length > 1 ? (
            <div className="grid grid-cols-3 gap-[12px]">
              {d.floors.slice(0, 3).map((f) => (
                <div key={f.sheetId} className="border border-doc-rule bg-white px-[14px] py-[10px]">
                  <div className="flex items-baseline justify-between">
                    <span className="doc-strong text-[14px] text-doc-ink">{f.floorName}</span>
                    <span className="doc-latin text-[12px] text-doc-accent">{f.pointCount} 点位</span>
                  </div>
                  <div className="mt-[2px] flex items-baseline justify-between text-[12px] text-doc-muted">
                    <span>{f.roomCount} 个区域</span>
                    <span className="doc-latin text-doc-ink">{yuan(f.subtotal).replace('.00', '')}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-[6px] overflow-hidden bg-linear-to-r from-doc-soft to-doc-soft-to p-[18px] text-doc-ink">
            <div className="flex items-baseline justify-between">
              <p className="doc-strong text-[16px] leading-[1.6]">{d.company.name}</p>
              <span className="doc-latin text-[11px] text-doc-muted">{ctx.date}</span>
            </div>
            <p className="doc-body text-[13px] leading-[1.6] whitespace-pre-wrap">
              {[
                d.company.slogan,
                [
                  (d.owner?.phone || d.company.phone) && `联系电话：${d.owner?.phone || d.company.phone}`,
                  d.company.address && `地址：${d.company.address}`,
                ]
                  .filter(Boolean)
                  .join('　 '),
              ]
                .filter(Boolean)
                .join('\n') || '全屋智能方案 · 深化设计 · 标准施工 · 联调交付'}
            </p>
          </div>
        </div>

        <div className="flex h-full w-[688px] shrink-0 flex-col gap-[15px] overflow-hidden">
          <FigmaSectionTitle
            title={main ? `${main.name}（主视图预览）` : '户型点位总览'}
            note={
              main
                ? `本层 ${d.points.filter((p) => p.sheetId === main.id).length} 个点位 · 全屋共 ${d.sheets.length} 张图纸`
                : '尚未上传图纸'
            }
          />
          <div className="flex min-h-0 flex-1 items-center justify-center border border-doc-rule bg-white p-[16px]">
            {main ? (
              <PlanFigure
                sheetUrl={main.url}
                points={d.points
                  .filter((p) => p.sheetId === main.id)
                  .map((p) => ({ ...p, image: p.productId ? d.productById.get(p.productId)?.image?.url : null }))}
                areas={d.areas
                  .filter((a) => a.sheetId === main.id)
                  .map((a) => ({
                    id: a.id,
                    name: a.name,
                    x0: (a.x - main.x) / main.width,
                    y0: (a.y - main.y) / main.height,
                    x1: (a.x + a.width - main.x) / main.width,
                    y1: (a.y + a.height - main.y) / main.height,
                  }))}
                mode={ctx.markers}
                showCodes={false}
                showAreas={true}
                className="max-h-full w-full"
              />
            ) : (
              <p className="doc-body text-[13px] text-doc-muted">在点位图里上传户型图后，这里显示主楼层的点位布置。</p>
            )}
          </div>
        </div>
      </div>
    </FigmaSlidePage>
  )
}
