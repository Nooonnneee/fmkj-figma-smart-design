/**
 * 其余空间：场景章节没有展开的房间，逐间列出设备与小计，保证每个点位都有着落。
 * 设备类别少的房间用三行紧凑卡片（每页最多 12 间），否则两行（每页 8 间）。
 */
import type { Room } from '@/lib/project-docs'
import { cn } from '@/lib/utils'

import { codeRange, yuanShort } from '../model'
import { amountFont, Chapter, Slide, type DeckCtx } from '../parts'

const COMPACT_LINES = 3
const FULL_LINES = 5

export type RoomPage = { rooms: Room[]; compact: boolean }

export function paginateRooms(rooms: Room[]): RoomPage[] {
  const pages: RoomPage[] = []
  let i = 0
  while (i < rooms.length) {
    let run = 0
    while (run < 12 && i + run < rooms.length && rooms[i + run]!.lines.length <= COMPACT_LINES) run++
    // 紧凑卡片至少能排满两行，或者剩下的房间都适合紧凑排列
    if (run >= 8 || (run > 0 && i + run === rooms.length)) {
      pages.push({ rooms: rooms.slice(i, i + run), compact: true })
      i += run
    } else {
      pages.push({ rooms: rooms.slice(i, i + 8), compact: false })
      i += 8
    }
  }
  return pages
}

export function RoomsPage({ ctx, no, total, page, part }: { ctx: DeckCtx; no: number; total: number; page: RoomPage; part: string }) {
  const { rooms, compact } = page
  const maxLines = compact ? COMPACT_LINES : FULL_LINES
  return (
    <Slide ctx={ctx} no={no} total={total} name={`其余空间${part}`}>
      <Chapter ctx={ctx} no={no} title="其余空间，同样逐一落实。" subtitle={`${ctx.m.otherRooms.length}个空间${part} / 点位、设备与小计一览，编号见平面索引`} tag="OTHER SPACES" />
      <div
        className={cn(
          'grid min-h-0 w-full grid-cols-4 gap-[20px] overflow-hidden',
          compact ? 'auto-rows-[206px]' : rooms.length > 4 ? 'flex-1 grid-rows-2' : 'h-[330px]',
        )}
      >
        {rooms.map((r) => (
          <div
            key={r.areaId}
            className={cn('flex min-h-0 flex-col overflow-hidden rounded-(--deck-radius-sm) border border-doc-rule bg-(--deck-diagram) px-[18px]', compact ? 'py-[14px]' : 'py-[16px]')}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="doc-display truncate text-[18px] leading-normal">{r.displayName}</p>
              <p className="doc-latin shrink-0 text-[12px] text-doc-accent">{r.total}点</p>
            </div>
            <p className="doc-body mt-[2px] truncate text-[12px] text-doc-muted">
              {r.typeLabel} · {codeRange(r.points.map((p) => p.code))}
            </p>
            <div className={cn('flex min-h-0 flex-1 flex-col border-t border-doc-rule', compact ? 'mt-[10px] gap-[4px] pt-[8px]' : 'mt-[12px] gap-[6px] pt-[10px]')}>
              {r.lines.slice(0, maxLines).map((l) => (
                <div key={`${l.deviceType}-${l.product?.id ?? 'p'}`} className="doc-body flex justify-between gap-2 text-[13px] leading-[1.5]">
                  <span className="truncate">
                    {l.typeName} ×{l.count}
                    {l.product?.unit || '个'}
                  </span>
                  <span className="doc-latin shrink-0 text-doc-muted">{l.product ? yuanShort(l.subtotal) : '待选型'}</span>
                </div>
              ))}
              {r.lines.length > maxLines ? <p className="doc-body text-[12px] text-doc-muted">另含 {r.lines.length - maxLines} 类设备</p> : null}
            </div>
            <div className={cn('flex items-end justify-between border-t border-doc-rule', compact ? 'mt-[8px] pt-[8px]' : 'mt-[10px] pt-[10px]')}>
              <p className="doc-body text-[13px] text-doc-muted">设备小计</p>
              <p className={cn(amountFont(ctx), 'leading-none text-doc-accent', compact ? 'text-[20px]' : 'text-[22px]')}>{yuanShort(r.subtotal)}</p>
            </div>
          </div>
        ))}
      </div>
    </Slide>
  )
}
