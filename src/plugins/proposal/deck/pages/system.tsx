/**
 * 03 系统与设备：左侧按实际设备生成网络与中控拓扑，右侧本次设备清单（型号多时按类别汇总）与实施前确认事项。
 */
import { categoryOfType } from '@/lib/device-types'
import { cn } from '@/lib/utils'

import { type TopoApRoom, type TopoBox } from '../model'
import { Chapter, DeckTable, Panel, SectionTitle, Slide, type DeckCtx } from '../parts'

const CARD_W = 604
const CARD_H = 428

function NodeCard({
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

function ApRoomCard({ item, x, y, w, h }: { item: TopoApRoom; x: number; y: number; w: number; h: number }) {
  return (
    <div
      className="absolute flex flex-col justify-center gap-[2px] overflow-hidden rounded-[calc(var(--deck-radius-sm)/2)] border border-doc-accent/75 bg-(--deck-panel) px-[10px]"
      style={{ left: x, top: y, width: w, height: h }}
    >
      <div className="flex items-center justify-between gap-[4px]">
        <p className="doc-strong min-w-0 truncate text-[12.5px] leading-tight">{item.room}</p>
        {item.codes ? (
          <span className="doc-latin shrink-0 rounded bg-(--deck-badge) px-[5px] py-[1px] text-[10px] leading-tight text-doc-accent">
            {item.codes}
          </span>
        ) : null}
      </div>
      <p className="doc-body truncate text-[10px] leading-tight text-doc-muted">{item.sub}</p>
    </div>
  )
}

function Topology({ ctx }: { ctx: DeckCtx }) {
  const { ac, apRooms, apLink, hubs, leaves, link } = ctx.m.topology

  // 顶层：AC 控制器 / PoE 核心交换机
  const coreX = 28
  const coreY = 12
  const coreW = CARD_W - 56
  const coreH = 52
  const coreBottom = coreY + coreH
  const pillTop = 74
  const pillBottom = 94

  // 左支路：AC 控制 -> 每个拥有 AP 设备的房间拓扑（x: 16..316, 宽 300）
  const leftBusX = 166
  const maxRooms = 8
  const shownRooms: TopoApRoom[] =
    apRooms.length > maxRooms
      ? [
          ...apRooms.slice(0, maxRooms - 1),
          {
            room: `其余 ${apRooms.length - (maxRooms - 1)} 个房间`,
            codes: `${apRooms.slice(maxRooms - 1).reduce((s, r) => s + r.count, 0)}台AP`,
            sub: apRooms.slice(maxRooms - 1).map((r) => r.room).join('、'),
            count: apRooms.slice(maxRooms - 1).reduce((s, r) => s + r.count, 0),
          },
        ]
      : apRooms
  const twoColAp = shownRooms.length >= 4
  const apRows = twoColAp ? Math.ceil(shownRooms.length / 2) : Math.max(1, shownRooms.length)
  const apStartY = 104
  const apAvailH = CARD_H - apStartY - 14
  const apGapY = apRows >= 4 ? 10 : 12
  const apCardH = Math.min(62, Math.max(46, Math.floor((apAvailH - (apRows - 1) * apGapY) / apRows)))
  const singleSpineX = 26

  const apPlacements = shownRooms.map((item, idx) => {
    if (!twoColAp) {
      const y = apStartY + idx * (apCardH + apGapY)
      return { item, x: 40, y, w: 274, h: apCardH, cy: y + apCardH / 2, side: 'right' as const }
    }
    const row = Math.floor(idx / 2)
    const col = idx % 2
    const y = apStartY + row * (apCardH + apGapY)
    const w = 138
    const x = col === 0 ? 16 : 178
    return { item, x, y, w, h: apCardH, cy: y + apCardH / 2, side: col === 0 ? ('left' as const) : ('right' as const) }
  })
  const apLastCy = apPlacements.length ? apPlacements[apPlacements.length - 1]!.cy : apStartY + 32

  // 右支路：智能中控网关 -> 各子设备系统拓扑（x: 332..588, 宽 256）
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
          {/* 核心交换机 -> 左支路（AC+PoE）与右支路（LAN 中控） */}
          <path d={`M${leftBusX} ${coreBottom} V${pillTop}`} />
          <path d={`M${rightTrunkX} ${coreBottom} V${pillTop}`} />
          {twoColAp ? (
            <>
              <path d={`M${leftBusX} ${pillBottom} V${apLastCy}`} />
              {apPlacements.map((p, i) => (
                <path key={i} d={p.side === 'left' ? `M${p.x + p.w} ${p.cy} H${leftBusX}` : `M${leftBusX} ${p.cy} H${p.x}`} />
              ))}
            </>
          ) : (
            <>
              <path d={`M${leftBusX} ${pillBottom} V99 H${singleSpineX} V${apLastCy}`} />
              {apPlacements.map((p, i) => (
                <path key={i} d={`M${singleSpineX} ${p.cy} H${p.x}`} />
              ))}
            </>
          )}

          {/* 右支路：核心交换机 -> 中控网关 -> 协议总线 -> 子系统终端 */}
          <path d={`M${rightTrunkX} ${pillBottom} V${hubStartY}`} />
          {hubPlacements.length > 1 ? (
            <path d={`M${rightTrunkX} ${hubPlacements[0]!.y + hubH} V${hubPlacements[1]!.y}`} />
          ) : null}
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
            <circle key={`ap-dot-${i}`} cx={twoColAp ? leftBusX : singleSpineX} cy={p.cy} r={2.5} />
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

      {/* 第一层：AC 控制器 / PoE 核心交换机 */}
      <NodeCard box={{ title: ac.title, sub: ac.sub, badge: ac.badge }} x={coreX} y={coreY} w={coreW} h={coreH} tone="core" />

      {/* 分支总线标签 */}
      <div className="doc-body absolute top-[74px] left-[16px] flex h-[20px] w-[298px] items-center justify-center rounded-full border border-doc-rule bg-(--deck-box) px-[10px] text-[10.5px] leading-none text-doc-accent">
        <span className="truncate">{apLink}</span>
      </div>
      <div className="doc-body absolute top-[74px] left-[332px] flex h-[20px] w-[256px] items-center justify-center rounded-full border border-doc-rule bg-(--deck-box) px-[10px] text-[10.5px] leading-none text-doc-accent">
        <span className="truncate">LAN 局域网 · 中控网关接入</span>
      </div>

      {/* 左支路：每个拥有 AP 设备的房间拓扑 */}
      {apPlacements.length ? (
        apPlacements.map((p, i) => (
          <ApRoomCard key={`${p.item.room}-${i}`} item={p.item} x={p.x} y={p.y} w={p.w} h={p.h} />
        ))
      ) : (
        <NodeCard
          box={{
            title: '暂未布置房间 AP 节点',
            badge: '待配 AP',
            sub: '建议在客餐厅、主卧及各楼层布置面板/吸顶 AP，由 AC 统一管控漫游',
          }}
          x={40}
          y={apStartY}
          w={274}
          h={62}
          tone="leaf"
        />
      )}

      {/* 右支路：中控网关层 + 协议子设备终端层 */}
      {hubPlacements.map((p) => (
        <NodeCard key={p.box.title} box={p.box} x={p.x} y={p.y} w={p.w} h={p.h} tone="hub" />
      ))}
      {leafPlacements.length ? (
        <p className="doc-body absolute truncate text-[10.5px] leading-none text-doc-accent" style={{ left: leafSpineX + 8, top: lastHubBottom + 9, width: 236 }}>
          {link}
        </p>
      ) : null}
      {leafPlacements.map((p, i) => (
        <NodeCard key={`${p.box.title}-${i}`} box={p.box} x={p.x} y={p.y} w={p.w} h={p.h} tone="leaf" />
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
          <SectionTitle
            title="网络与中控拓扑"
            note={m.topology.apRooms.length ? `AC 控制 + ${m.topology.apRooms.length} 间 AP 房间拓扑 / 中控架构` : 'AC 核心路由 / 中控网关连接拓扑'}
          />
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
              { label: '条目', className: 'w-[84px]' },
              { label: '设备 / 数量', className: 'w-[150px]' },
              { label: '产品', className: 'w-[306px]' },
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
