/**
 * Figma 方案模板 · 04 房间配置明细
 * 按楼层与房间逐间列出具体设备类别、选定型号、数量、金额与联动场景，解决原模板卡片内容空洞的问题。
 */
import { PointMarker } from '@/components/point-marker'
import type { ProjectDocsData } from '@/lib/project-docs'
import { yuan } from '@/lib/quotes'

import { FigmaChapter, FigmaSlidePage, FigmaStepCard, money, type FigmaTemplateCtx } from './shared'

export function FigmaRoomsPage({
  ctx,
  no,
  total,
  rooms,
  part,
}: {
  ctx: FigmaTemplateCtx
  no: number
  total: number
  rooms: ProjectDocsData['rooms']
  part: string
}) {
  const pageSubtotal = rooms.reduce((s, r) => s + r.subtotal, 0)
  const pagePoints = rooms.reduce((s, r) => s + r.total, 0)

  return (
    <FigmaSlidePage ctx={ctx} no={no} total={total} frameName={`04 房间配置${part}`}>
      <FigmaChapter
        no={no}
        title={`房间配置明细${part}`}
        subtitle={`按楼层房间核对设备选型、数量、小计与场景联动 / 本页 ${rooms.length} 个房间，共 ${pagePoints} 个点位（${yuan(pageSubtotal)}）`}
        tag="ROOM CONFIGURATION"
      />
      <div className="grid w-full flex-1 grid-cols-3 grid-rows-2 gap-x-[28px] gap-y-[22px] overflow-hidden">
        {rooms.map((r) => {
          const sceneText = r.scenes[0]
          return (
            <FigmaStepCard
              key={r.areaId}
              title={r.displayName}
              badge={
                <span className="doc-latin bg-doc-soft px-[8px] py-[2px] text-[12px] text-doc-ink">
                  {r.total} 点位 · {yuan(r.subtotal).replace('.00', '')}
                </span>
              }
              note={`${r.typeLabel} · 配置完整度 ${r.score}%${sceneText ? ` · ${sceneText.split('：')[0]}` : ''}`}
              className="h-[332px] flex-none justify-between bg-white/60 px-[14px] pb-[12px]"
            >
              <div className="flex min-h-0 flex-1 flex-col divide-y divide-doc-rule/70 overflow-hidden border-y border-doc-rule">
                {r.lines.slice(0, 5).map((l) => (
                  <div
                    key={`${l.deviceType}-${l.product?.id ?? 'none'}`}
                    className="flex items-center justify-between gap-[8px] py-[5.5px] text-[12.5px] leading-[1.3]"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-[7px]">
                      <PointMarker type={l.deviceType} className="size-[16px] shrink-0" />
                      <span className="doc-strong shrink-0 text-doc-ink">{l.typeName}</span>
                      <span className="doc-body truncate text-[11.5px] text-doc-muted">
                        {l.product ? l.product.name : '待选型'}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-baseline gap-[10px]">
                      <span className="doc-strong text-doc-accent">×{l.count}</span>
                      <span className="doc-latin w-[58px] text-right text-[12px] text-doc-ink">
                        {money(l.subtotal)}
                      </span>
                    </div>
                  </div>
                ))}
                {r.lines.length > 5 ? (
                  <div className="py-[4px] text-[11px] text-doc-muted">
                    另有 {r.lines.slice(5).map((l) => `${l.typeName}×${l.count}`).join('、')}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-[8px] pt-[2px] text-[11.5px]">
                <span className="doc-body truncate text-doc-muted">
                  {sceneText || (r.met[0] ? `${r.met[0].label}：${r.met[0].reason}` : '标准智能照明与控制配置')}
                </span>
                <span className="doc-strong shrink-0 text-doc-ink">小计 {yuan(r.subtotal)}</span>
              </div>
            </FigmaStepCard>
          )
        })}
      </div>
    </FigmaSlidePage>
  )
}
