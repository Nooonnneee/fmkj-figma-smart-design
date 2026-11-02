/**
 * 03 系统与设备：左侧按实际设备生成网络与中控拓扑，右侧本次设备清单（型号多时按类别汇总）与实施前确认事项。
 */
import { categoryOfType } from '@/lib/device-types'
import { cn } from '@/lib/utils'

import { type TopoBox } from '../model'
import { Chapter, DeckTable, Panel, SectionTitle, Slide, type DeckCtx } from '../parts'

const CARD_W = 604
const CARD_H = 418
const BOX_H = 72

function Box({ box, x, y, w, tone }: { box: TopoBox; x: number; y: number; w: number; tone: 'base' | 'hub' | 'leaf' }) {
  return (
    <div
      className={cn(
        'absolute flex flex-col justify-center gap-[4px] overflow-hidden rounded-[calc(var(--deck-radius-sm)/2)] border px-[14px]',
        tone === 'base' ? 'border-doc-rule bg-(--deck-box)' : 'bg-(--deck-panel)',
        tone === 'hub' && 'border-doc-accent',
        tone === 'leaf' && 'border-doc-accent/70',
      )}
      style={{ left: x, top: y, width: w, height: BOX_H }}
    >
      <p className="doc-strong truncate text-[16px] leading-normal">{box.title}</p>
      <p className="doc-body truncate text-[11px] leading-normal text-doc-muted">{box.sub}</p>
    </div>
  )
}

function Topology({ ctx }: { ctx: DeckCtx }) {
  const { top, hubs, leaves, link } = ctx.m.topology
  const topW = 344
  const topX = (CARD_W - topW) / 2
  const hubW = 228
  const hubX = hubs.length > 1 ? [52, 324] : [(CARD_W - hubW) / 2]
  const leafW = 172
  const leafX = leaves.length >= 3 ? [20, 216, 412] : leaves.length === 2 ? [98, 334] : [(CARD_W - leafW) / 2]
  const hubC = hubX.map((x) => x + hubW / 2)
  const leafC = leafX.slice(0, leaves.length).map((x) => x + leafW / 2)
  const cx = CARD_W / 2
  const busY = 126
  const leafBus = 280
  const fromHub = hubC[0]
  const lo = Math.min(fromHub, ...leafC)
  const hi = Math.max(fromHub, ...leafC)
  return (
    <div className="relative shrink-0 overflow-hidden rounded-(--deck-radius) border border-(--deck-card-border) bg-(--deck-diagram)" style={{ width: CARD_W, height: CARD_H }}>
      <svg className="absolute inset-0" width={CARD_W} height={CARD_H} aria-hidden>
        <g fill="none" strokeWidth={1.5} style={{ stroke: 'var(--deck-marker)' }}>
          <path d={`M${cx} ${30 + BOX_H} V${busY}`} />
          {hubC.length > 1 ? <path d={`M${hubC[0]} ${busY} H${hubC[hubC.length - 1]}`} /> : null}
          {hubC.map((c) => (
            <path key={c} d={`M${c} ${busY} V150`} />
          ))}
          {leaves.length ? <path d={`M${fromHub} ${150 + BOX_H} V${leafBus}`} /> : null}
          {leaves.length ? <path d={`M${lo} ${leafBus} H${hi}`} /> : null}
          {leafC.map((c) => (
            <path key={c} d={`M${c} ${leafBus} V306`} />
          ))}
        </g>
      </svg>
      <Box box={top} x={topX} y={30} w={topW} tone="base" />
      {hubs.map((h, i) => (
        <Box key={h.title} box={h} x={hubX[i]} y={150} w={hubW} tone="hub" />
      ))}
      {leaves.length ? (
        <p className="doc-body absolute text-[12px] text-doc-accent" style={{ left: fromHub + 12, top: 244 }}>
          {link}
        </p>
      ) : null}
      {leaves.map((l, i) => (
        <Box key={l.title + i} box={l} x={leafX[i]} y={306} w={leafW} tone="leaf" />
      ))}
    </div>
  )
}

export function SystemPage({ ctx, no, total }: { ctx: DeckCtx; no: number; total: number }) {
  const { m } = ctx
  const d = m.d
  const perItem = m.items.length <= 7
  const rows = perItem
    ? m.items.map((i) => [
        <span key="r" className="doc-latin text-doc-accent">{i.ref}</span>,
        <span key="n" className="doc-body">{i.typeName} ×{i.count}{i.unit}</span>,
        <span key="s" className="doc-body text-doc-ink/90">{i.pending ? '待选型' : i.name || i.sku}</span>,
        <span key="l" className="doc-body">{i.rooms.slice(0, 2).join('、')}{i.rooms.length > 2 ? `等${i.rooms.length}处` : ''}</span>,
      ])
    : d.categories.map((c) => {
        const its = m.items.filter((i) => categoryOfType(i.deviceType)?.slug === c.slug)
        const rooms = [...new Set(its.flatMap((i) => i.rooms))]
        const brands = [...new Set(its.map((i) => i.brand).filter((b): b is string => !!b))]
        return [
          <span key="r" className="doc-latin text-doc-accent">{its.length > 1 ? `${its[0].ref}–${its[its.length - 1].ref}` : (its[0]?.ref ?? '—')}</span>,
          <span key="n" className="doc-body">{c.name} ×{c.count}</span>,
          <span key="s" className="doc-body text-doc-ink/90">{its.length}款型号{brands.length ? ` · ${brands.slice(0, 2).join(' / ')}` : ''}</span>,
          <span key="l" className="doc-body">{rooms.slice(0, 2).join('、')}{rooms.length > 2 ? `等${rooms.length}处` : ''}</span>,
        ]
      })
  const rowH = rows.length > 8 ? 'h-[40px] text-[13px]' : 'h-[48px] text-[13.5px]'
  return (
    <Slide ctx={ctx} no={no} total={total} name="03 系统与设备">
      <Chapter ctx={ctx} no={no} title="连接有章法，能力有边界。" subtitle="网络、中控与设备架构 / 先确认兼容，再联调场景" tag="SYSTEM & DEVICES" />
      <div className="flex min-h-0 w-full flex-1 items-start gap-[32px] overflow-hidden">
        <div className="flex w-[604px] shrink-0 flex-col gap-[16px]">
          <SectionTitle title="网络与中控拓扑" note="实线为连接关系示意" />
          <Topology ctx={ctx} />
          <Panel title="本地执行 ≠ 无条件断网可用">
            本地场景能否执行取决于网关、设备及规则支持，须在现场断网实测后写入验收记录。远程访问与推送依赖可用网络；不作绝对离线承诺。
          </Panel>
        </div>
        <div className="flex w-[692px] shrink-0 flex-col gap-[16px] overflow-hidden">
          <SectionTitle title="本次设备清单" note={`${perItem ? '按型号' : '按类别汇总'} / 共${d.points.length}台/只设备`} />
          <DeckTable
            ctx={ctx}
            rowClassName={rowH}
            columns={[
              { label: '条目', className: 'w-[72px]' },
              { label: '设备 / 数量', className: 'w-[150px]' },
              { label: '产品', className: 'w-[318px]' },
              { label: '安装位置', className: 'w-[152px]' },
            ]}
            rows={rows}
          />
          <p className="doc-display mt-[4px] text-[18px] leading-normal">实施前，逐项确认</p>
          <ol className="doc-body flex flex-col gap-[10px] text-[14px] leading-[1.6] text-doc-muted">
            {m.systemNotes.map((n, i) => (
              <li key={n}>
                {'①②③'[i]} {n}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Slide>
  )
}
