/**
 * Figma 方案模板 · 02 方案概览 · 设备构成与全屋场景联动
 */
import { AlertTriangle, Check, Sparkles } from 'lucide-react'

import { categoryOfType, deviceTypeOf } from '@/lib/device-types'
import { yuan } from '@/lib/quotes'

import { FigmaChapter, FigmaSectionTitle, FigmaSlidePage, FigmaTable, money, type FigmaTemplateCtx } from './shared'

export function FigmaOverviewPage({ ctx, no, total }: { ctx: FigmaTemplateCtx; no: number; total: number }) {
  const { d } = ctx
  const max = Math.max(...d.categories.map((c) => c.count), 1)

  // 提取项目中各房间的真实联动场景（按场景名去重，附上适用空间）
  const sceneMap = new Map<string, { name: string; desc: string; rooms: string[] }>()
  for (const r of d.rooms) {
    for (const s of r.scenes) {
      const [name, desc] = s.split('：')
      if (!name || !desc) continue
      const existing = sceneMap.get(name) ?? { name, desc, rooms: [] }
      if (!existing.rooms.includes(r.displayName)) existing.rooms.push(r.displayName)
      sceneMap.set(name, existing)
    }
  }
  const scenes = [...sceneMap.values()].slice(0, 6)

  return (
    <FigmaSlidePage ctx={ctx} no={no} total={total} frameName="02 方案概览 · 设备构成与全屋场景">
      <FigmaChapter
        no={no}
        title="每一个点位，都有明确的用途。"
        subtitle="子系统构成、楼层分布与全屋自动化场景 / 按真实户型点位规划"
        tag="SYSTEM OVERVIEW"
      />
      <div className="flex min-h-0 w-full flex-1 items-start gap-[40px] overflow-hidden">
        {/* 左侧：按智能子系统构成 + 楼层统计 */}
        <div className="flex w-[600px] shrink-0 flex-col gap-[18px] overflow-hidden">
          <div className="flex flex-col gap-[12px]">
            <FigmaSectionTitle title="子系统构成" note={`共 ${d.categories.length} 大类 · ${d.points.length} 个点位 · ${yuan(d.total)}`} />
            <div className="flex flex-col">
              {d.categories.map((c) => {
                const subTypes = d.products
                  .filter((p) => categoryOfType(p.deviceType)?.slug === c.slug)
                  .map((p) => `${deviceTypeOf(p.deviceType)?.name}×${p.count}`)
                  .join('、')
                return (
                  <div
                    key={c.slug}
                    className="flex flex-col gap-[4px] border-b border-doc-rule py-[10px]"
                  >
                    <div className="grid grid-cols-[110px_1fr_54px_110px] items-center gap-[14px] text-[14px] leading-[1.35]">
                      <span className="doc-strong flex items-center gap-[8px] text-doc-ink">
                        <span className="size-[8px] shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </span>
                      <span className="h-[6px] bg-doc-stripe">
                        <span
                          className="block h-full"
                          style={{ width: `${(c.count / max) * 100}%`, backgroundColor: c.color }}
                        />
                      </span>
                      <span className="doc-latin text-right text-doc-accent">{c.count} 点</span>
                      <span className="doc-latin text-right text-[13px] text-doc-ink">¥{money(c.amount)}</span>
                    </div>
                    {subTypes ? (
                      <p className="doc-body truncate pl-[16px] text-[11.5px] text-doc-muted">{subTypes}</p>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>

          {d.floors.length > 0 ? (
            <div className="flex flex-col gap-[10px]">
              <FigmaSectionTitle title="各楼层点位与预算分布" note={`${d.floors.length} 张图纸 · ${d.rooms.length} 个功能区域`} />
              <FigmaTable
                rowClassName="min-h-[42px] text-[13px]"
                columns={[
                  { label: '楼层 / 图纸', className: 'w-[240px]' },
                  { label: '覆盖房间', className: 'w-[110px]' },
                  { label: '点位数量', className: 'w-[110px]' },
                  { label: '设备预算 / 元', className: 'w-[140px]' },
                ]}
                rows={d.floors.map((f) => [
                  <span key="n" className="doc-strong text-doc-ink">
                    {f.floorName} <span className="doc-body text-[12px] text-doc-muted">（{f.sheetName}）</span>
                  </span>,
                  <span key="r" className="doc-body text-doc-ink">{f.roomCount} 个区域</span>,
                  <span key="p" className="doc-strong text-doc-accent">{f.pointCount} 点</span>,
                  <span key="a" className="doc-latin text-doc-ink">{money(f.subtotal)}</span>,
                ])}
              />
            </div>
          ) : null}
        </div>

        {/* 右侧：方案设计亮点 + 全屋核心联动场景 */}
        <div className="flex w-[688px] shrink-0 flex-col gap-[18px] overflow-hidden">
          <div className="flex flex-col gap-[12px]">
            <FigmaSectionTitle title="方案设计亮点" note={`基于「${d.project.platform ?? '全屋智能'}」生态定制`} />
            <div className="grid grid-cols-1 gap-[9px] border border-doc-rule bg-white p-[18px] text-[14px] leading-[1.6] text-doc-ink">
              {d.analysis.highlights.slice(0, 5).map((h) => (
                <p key={h} className="doc-body flex items-start gap-[10px]">
                  <Check className="mt-[4px] size-[16px] shrink-0 text-doc-accent" />
                  <span>{h}</span>
                </p>
              ))}
              {d.pending || d.analysis.warnings.length ? (
                <div className="mt-[4px] border-t border-doc-rule pt-[8px] text-[12.5px] text-doc-muted">
                  {d.pending ? (
                    <p className="doc-body flex items-center gap-[8px]">
                      <AlertTriangle className="size-[14px] shrink-0 text-warning" />
                      <span>有 {d.pending} 个点位暂未指定型号，未计入当前设备预算</span>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-[12px]">
            <FigmaSectionTitle title="全屋智能场景联动" note="交付时逐项写入网关与中控，支持本地执行" />
            <div className="grid grid-cols-2 gap-[12px]">
              {scenes.map((sc, i) => (
                <div
                  key={sc.name}
                  className="flex flex-col justify-between gap-[6px] border-t-2 border-doc-accent bg-white p-[14px] shadow-[0_1px_0_0_var(--doc-rule)]"
                >
                  <div className="flex items-center justify-between gap-[8px]">
                    <span className="doc-strong flex items-center gap-[6px] text-[15px] text-doc-ink">
                      <Sparkles className="size-[14px] text-doc-accent" />
                      {sc.name}
                    </span>
                    <span className="doc-latin text-[11px] text-doc-accent">SCENE 0{i + 1}</span>
                  </div>
                  <p className="doc-body text-[12.5px] leading-[1.55] text-doc-muted">{sc.desc}</p>
                  <p className="doc-body truncate text-[11px] text-doc-ink/75">
                    覆盖：{sc.rooms.slice(0, 4).join('、')}{sc.rooms.length > 4 ? `等 ${sc.rooms.length} 处` : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </FigmaSlidePage>
  )
}
