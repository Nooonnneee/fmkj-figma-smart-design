/**
 * Figma 方案模板 · 06 投资预算汇总
 * 左侧展示按智能子系统分类汇总与按楼层汇总；右侧展示与正式报价单完全一致的总价构成。
 */
import { yuan } from '@/lib/quotes'

import { FigmaChapter, FigmaSectionTitle, FigmaSlidePage, FigmaTable, money, type FigmaTemplateCtx } from './shared'

export function FigmaBudgetPage({ ctx, no, total }: { ctx: FigmaTemplateCtx; no: number; total: number }) {
  const { d } = ctx
  const fees = d.quote?.fees ?? []
  const discount = d.quote?.discount ?? 0
  const feeTotal = d.quote?.feeTotal ?? 0

  return (
    <FigmaSlidePage ctx={ctx} no={no} total={total} frameName="06 预算汇总 · 分类与总价构成">
      <FigmaChapter
        no={no}
        title="预算清楚，再开始施工。"
        subtitle="投资预算汇总 / 按子系统、楼层与服务项透明核算每一笔费用"
        tag="BUDGET SUMMARY"
      />
      <div className="flex min-h-0 w-full flex-1 items-start gap-[40px] overflow-hidden">
        <div className="flex w-[688px] shrink-0 flex-col gap-[16px] overflow-hidden">
          <FigmaSectionTitle title="按智能子系统汇总" note={`${d.categories.length} 大子系统 / ${d.points.length} 个点位`} />
          <FigmaTable
            rowClassName="min-h-[44px] text-[13.5px]"
            columns={[
              { label: '子系统类别', className: 'w-[280px]' },
              { label: '点位数量', className: 'w-[140px]' },
              { label: '预算占比', className: 'w-[120px]' },
              { label: '金额 / 元', className: 'w-[148px]' },
            ]}
            rows={[
              ...d.categories.map((c) => [
                <span key="n" className="doc-body flex items-center gap-[8px] text-doc-ink">
                  <span className="size-[8px] rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </span>,
                <span key="c" className="doc-strong text-doc-accent">{c.count}</span>,
                <span key="p" className="doc-latin text-doc-muted">
                  {d.total > 0 ? `${Math.round((c.amount / d.total) * 100)}%` : '0%'}
                </span>,
                <span key="a" className="doc-latin text-doc-ink">{money(c.amount)}</span>,
              ]),
              [
                <span key="n" className="doc-strong text-doc-ink">设备合计</span>,
                <span key="c" className="doc-strong text-doc-accent">{d.points.length}</span>,
                <span key="p" className="doc-latin text-doc-muted">100%</span>,
                <span key="a" className="doc-strong doc-latin text-doc-ink">{money(d.total)}</span>,
              ],
            ]}
          />
        </div>

        <div className="flex w-[600px] shrink-0 flex-col gap-[16px] overflow-hidden">
          <FigmaSectionTitle
            title={d.quote ? '方案总预算（含服务与优惠）' : '方案设备总预算'}
            note={d.quote ? d.quote.title : '按当前选型产品售价计算'}
          />
          <div className="flex flex-col gap-[12px] border border-doc-rule bg-white p-[24px]">
            <div className="flex items-baseline justify-between">
              <span className="doc-body text-[14px] text-doc-muted">方案应付总额</span>
              <span className="doc-numeral text-[56px] leading-none text-doc-accent">{yuan(ctx.finalAmount)}</span>
            </div>
            <div className="h-px w-full bg-doc-rule" />
            <div className="flex flex-col gap-[8px] text-[14px]">
              <div className="flex items-center justify-between">
                <span className="doc-body text-doc-muted">智能硬件设备合计（{d.points.length} 个点位）</span>
                <span className="doc-latin text-doc-ink">{yuan(d.total)}</span>
              </div>
              {fees.map((f, i) => (
                <div key={f.id ?? i} className="flex items-center justify-between">
                  <span className="doc-body text-doc-muted">{f.name}</span>
                  <span className="doc-latin text-doc-ink">+{yuan(f.amount)}</span>
                </div>
              ))}
              {!fees.length && feeTotal > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="doc-body text-doc-muted">安装调试与技术服务费</span>
                  <span className="doc-latin text-doc-ink">+{yuan(feeTotal)}</span>
                </div>
              ) : null}
              {discount > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="doc-body text-doc-muted">方案专享优惠减免</span>
                  <span className="doc-latin text-doc-accent">-{yuan(discount)}</span>
                </div>
              ) : null}
            </div>
            <p className="doc-body mt-[2px] text-[12.5px] leading-[1.6] text-doc-muted">
              {d.quote?.notes ||
                '以上费用包含全屋智能设备供货、点位深化交底、现场安装联调、全屋自动化场景编程及业主使用培训。'}
            </p>
          </div>

          {d.floors.length > 1 ? (
            <div className="flex flex-col gap-[10px]">
              <FigmaSectionTitle title="按楼层投资概览" note={`共 ${d.floors.length} 层`} />
              <div className="grid grid-cols-3 gap-[12px]">
                {d.floors.map((f) => (
                  <div key={f.sheetId} className="border-t-2 border-doc-accent bg-white p-[14px]">
                    <div className="flex items-baseline justify-between">
                      <span className="doc-strong text-[15px] text-doc-ink">{f.floorName}</span>
                      <span className="doc-latin text-[12px] text-doc-accent">{f.pointCount} 点</span>
                    </div>
                    <p className="doc-body mt-[2px] text-[12px] text-doc-muted">{f.roomCount} 个配置区域</p>
                    <p className="doc-latin doc-strong mt-[8px] text-[16px] text-doc-ink">{yuan(f.subtotal)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </FigmaSlidePage>
  )
}
