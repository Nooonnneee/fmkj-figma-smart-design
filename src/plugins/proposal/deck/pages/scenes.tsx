/**
 * 场景页：场景库里与本项目匹配的场景（每页两个）。
 * 图片、标题、联动步骤来自后台「场景库」；房间与设备只列出本项目真实存在的。
 */
import type { ManagedScene } from '@/lib/scenes'

import type { DeckItem, DeckModel } from '../model'
import { Chapter, imgLoading, Slide, type DeckCtx } from '../parts'

export type DeckScene = { scene: ManagedScene; rooms: string[]; items: DeckItem[] }

const CHAPTER_PHOTO: Record<string, string> = { arrive: 'entrance', rest: 'bedroom', care: 'kitchen', focus: 'living', network: 'study' }

export function deckScenes(m: DeckModel): DeckScene[] {
  const d = m.d
  const out: DeckScene[] = []
  for (const scene of d.sceneLibrary) {
    const line = `${scene.name}：${scene.summary}`
    const rooms = d.rooms.filter((r) => r.scenes.includes(line))
    if (!rooms.length) continue
    const related = new Set([...scene.requiredDevices, ...scene.anyDevices])
    const names = new Set(rooms.map((r) => r.displayName).concat(rooms.map((r) => r.name)))
    const items = m.items.filter((i) => (related.size ? related.has(i.deviceType) : true) && (scene.scope === 'house' || i.rooms.some((r) => names.has(r))))
    out.push({ scene, rooms: scene.scope === 'house' ? [] : rooms.map((r) => r.displayName), items })
  }
  return out
}

export function ScenesPage({ ctx, no, total, scenes, part }: { ctx: DeckCtx; no: number; total: number; scenes: DeckScene[]; part: string }) {
  return (
    <Slide ctx={ctx} no={no} total={total} name={`生活场景${part}`}>
      <Chapter ctx={ctx} no={no} title="每一个场景，都由真实的设备支撑。" subtitle={`本方案匹配 ${deckScenes(ctx.m).length} 个场景${part} / 只列出本项目实际配置的设备`} tag="SCENES" />
      <div className="grid min-h-0 w-full flex-1 grid-cols-2 gap-[28px] overflow-hidden">
        {scenes.map(({ scene, rooms, items }) => (
          <div key={scene.id} className="flex min-h-0 flex-col overflow-hidden rounded-(--deck-radius) border border-doc-rule bg-(--deck-diagram)">
            <div className="relative min-h-[260px] flex-1 overflow-hidden bg-doc-stripe">
              <img src={scene.image?.url ?? `/proposal/photos/${CHAPTER_PHOTO[scene.chapter] ?? 'home'}.jpg`} alt={scene.image?.alt ?? scene.name} {...imgLoading(ctx)} className="absolute inset-0 size-full object-cover" />
              {scene.tagline ? (
                <span className="doc-latin absolute top-[16px] left-[16px] rounded-[calc(var(--deck-radius-sm)/2)] bg-(--deck-chip) px-[10px] py-[4px] text-[11px] tracking-[0.2em] text-(--deck-chip-ink)">{scene.tagline}</span>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col gap-[10px] px-[24px] py-[18px]">
              <div className="flex items-baseline justify-between gap-3">
                <p className="doc-display truncate text-[24px] leading-tight">{scene.name}</p>
                <p className="doc-body shrink-0 truncate text-[12px] text-doc-accent">{rooms.length ? rooms.slice(0, 3).join('、') + (rooms.length > 3 ? ' 等' : '') : '全屋'}</p>
              </div>
              <p className="doc-body text-[14px] leading-normal text-doc-muted">{scene.headline || scene.summary}</p>
              {scene.steps.length ? (
                <ol className="flex flex-col gap-[6px] border-t border-doc-rule pt-[10px]">
                  {scene.steps.slice(0, 3).map((s, i) => (
                    <li key={i} className="doc-body flex gap-[10px] text-[13px] leading-[1.5]">
                      <span className="doc-numeral w-[18px] shrink-0 text-doc-accent">{i + 1}</span>
                      <span className="min-w-0">{s}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
              <div className="flex flex-wrap gap-[6px] border-t border-doc-rule pt-[10px]">
                {items.slice(0, 5).map((i) => (
                  <span key={i.ref} className="doc-body rounded-[calc(var(--deck-radius-sm)/2)] bg-doc-stripe px-[8px] py-[3px] text-[12px]">
                    {i.pending ? i.typeName : i.name}
                  </span>
                ))}
                {items.length > 5 ? <span className="doc-body px-[4px] py-[3px] text-[12px] text-doc-muted">另 {items.length - 5} 项</span> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Slide>
  )
}
