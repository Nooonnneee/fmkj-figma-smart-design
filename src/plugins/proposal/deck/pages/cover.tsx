/* eslint-disable @next/next/no-img-element -- 导出 PDF / 图片需要同源普通 <img> */
/**
 * 01 封面：栖序 = 顶部照片色带 + 下方标题（设计稿原样）；墨金 = 整幅照片 + 深色渐变；原木 = 左文右图。
 */
import { pointScopeLabel } from '@/lib/point-scopes'

import { pad, yuanShort } from '../model'
import { Brand, headerTagline, Slide, type DeckCtx } from '../parts'

const SUBTITLE = '全屋智能 · 点位设计与服务报价'

function facts(ctx: DeckCtx) {
  const { m } = ctx
  const d = m.d
  return {
    tags: ['生活场景', `${d.points.length}点位设计`, '透明报价', '安心交付'],
    who: `${m.customer}　/　${m.layoutText}`,
    doc: `${m.docNo} · ${m.version} · ${m.date}`,
    accent: [m.platform ? `${m.platform}生态` : null, d.scope === 'all' ? null : pointScopeLabel(d.scope), m.advisor ? `顾问 ${m.advisor}` : null].filter(Boolean).join(' · ') || '全屋智能设计方案',
    year: m.date.slice(0, 4),
  }
}

export function CoverPage({ ctx, no, total }: { ctx: DeckCtx; no: number; total: number }) {
  const t = ctx.theme
  if (t.cover === 'immersive') return <ImmersiveCover ctx={ctx} no={no} total={total} />
  if (t.cover === 'split') return <SplitCover ctx={ctx} no={no} total={total} />
  const f = facts(ctx)
  return (
    <Slide ctx={ctx} no={no} total={total} name="01 封面" cover>
      <div className="absolute inset-x-[56px] top-[28px] flex h-[34px] items-center justify-between">
        <Brand ctx={ctx} large />
        <p className="doc-latin text-[12px] whitespace-nowrap text-doc-muted">{t.coverTagline}</p>
      </div>
      <div className="absolute inset-x-0 top-[90px] h-[520px] overflow-hidden">
        <img src={t.coverPhoto} alt="" loading="eager" decoding="sync" className="size-full object-cover" />
        <span className="doc-body absolute bottom-[26px] left-[56px] bg-white px-[12px] py-[5px] text-[11px] text-[#252523]">{t.photoNote}</span>
      </div>
      <div className="absolute top-[648px] left-[56px] w-[830px]">
        <h1 className="doc-display text-[56px] leading-[1.25] whitespace-nowrap">{t.headline}</h1>
        <p className="doc-body mt-[14px] text-[24px] leading-normal">{SUBTITLE}</p>
        <div className="mt-[16px] flex items-center gap-[20px]">
          <span aria-hidden className="h-[3px] w-[100px] bg-linear-to-r from-doc-soft to-doc-soft-to" />
          <p className="doc-body text-[14px] whitespace-pre text-doc-muted">{f.tags.join('　 /　 ')}</p>
        </div>
      </div>
      <div className="absolute top-[650px] left-[930px] flex w-[454px] flex-col gap-[6px] border-l border-doc-rule pl-[28px]">
        <p className="doc-strong truncate text-[24px] leading-normal">{ctx.m.place}</p>
        <p className="doc-body truncate text-[17px] leading-normal text-doc-muted">{f.who}</p>
        <p className="doc-latin text-[13px] leading-normal text-doc-muted">{f.doc}</p>
        <p className="doc-body truncate text-[13px] leading-normal text-doc-accent">{f.accent}</p>
      </div>
      <div className="absolute inset-x-[56px] top-[906px] flex justify-between leading-normal">
        <p className="doc-latin text-[11px] whitespace-pre text-doc-muted">{`${headerTagline(ctx)}      ${f.year}`}</p>
        <p className="doc-latin text-[12px] text-doc-ink">{`${pad(no)} / ${pad(total)}`}</p>
      </div>
    </Slide>
  )
}

/** 墨金臻选：整幅照片 + 左侧深色渐变，金色眉标、衬线大标题、底部四栏信息 */
function ImmersiveCover({ ctx, no, total }: { ctx: DeckCtx; no: number; total: number }) {
  const t = ctx.theme
  const f = facts(ctx)
  const d = ctx.m.d
  const cols: [string, string][] = [
    ['PROJECT', ctx.m.place],
    ['CLIENT', f.who],
    ['SCALE', `${d.rooms.length}个空间 · ${d.points.length}个点位`],
    ['INVESTMENT', yuanShort(ctx.m.finalAmount)],
  ]
  return (
    <Slide ctx={ctx} no={no} total={total} name="01 封面" cover>
      <img src={t.coverPhoto} alt="" loading="eager" decoding="sync" className="absolute inset-0 size-full object-cover" />
      <div aria-hidden className="absolute inset-0 bg-linear-to-r from-[#0d0d0f] via-[#0d0d0f]/80 to-[#0d0d0f]/10" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[420px] bg-linear-to-t from-[#0d0d0f] via-[#0d0d0f]/85 to-transparent" />
      <div className="absolute inset-x-[56px] top-[36px] flex h-[34px] items-center justify-between">
        <Brand ctx={ctx} large />
        <p className="doc-latin text-[11px] tracking-[0.28em] whitespace-nowrap text-doc-accent">{t.coverTagline}</p>
      </div>
      <div className="absolute top-[250px] left-[56px] w-[760px]">
        <p className="doc-latin text-[12px] tracking-[0.36em] text-doc-accent">SMART LIVING PROPOSAL · {f.year}</p>
        <h1 className="doc-display mt-[24px] text-[64px] leading-[1.2] whitespace-nowrap">{t.headline}</h1>
        <span aria-hidden className="mt-[28px] block h-px w-[120px] bg-doc-accent" />
        <p className="doc-body mt-[24px] text-[22px] leading-normal">{SUBTITLE}</p>
        <p className="doc-body mt-[10px] text-[14px] whitespace-pre text-doc-muted">{f.tags.join('　·　')}</p>
      </div>
      <div className="absolute inset-x-[56px] top-[748px] grid grid-cols-4 gap-[32px] border-t border-doc-accent/40 pt-[22px]">
        {cols.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <p className="doc-latin text-[10.5px] tracking-[0.3em] text-doc-accent">{k}</p>
            <p className={k === 'INVESTMENT' ? 'doc-numeral mt-[8px] truncate text-[24px] text-doc-accent' : 'doc-body mt-[10px] truncate text-[16px]'}>{v}</p>
          </div>
        ))}
      </div>
      <div className="absolute inset-x-[56px] top-[906px] flex justify-between leading-normal">
        <p className="doc-latin text-[11px] text-doc-muted">{f.doc}　 ·　 {f.accent}</p>
        <p className="doc-latin text-[12px] text-doc-ink">{`${pad(no)} / ${pad(total)}`}</p>
      </div>
      <span className="doc-body absolute right-[56px] bottom-[96px] text-[11px] text-doc-muted">{t.photoNote}</span>
    </Slide>
  )
}

/** 原木自然：左侧文字与项目卡片，右侧圆角竖幅照片 */
function SplitCover({ ctx, no, total }: { ctx: DeckCtx; no: number; total: number }) {
  const t = ctx.theme
  const f = facts(ctx)
  const d = ctx.m.d
  const stats: [string, string][] = [
    ['智能点位', String(d.points.length)],
    ['覆盖空间', String(d.rooms.length)],
    ['方案预算', yuanShort(ctx.m.finalAmount)],
  ]
  return (
    <Slide ctx={ctx} no={no} total={total} name="01 封面" cover>
      <div className="absolute top-[36px] left-[56px] flex h-[34px] items-center">
        <Brand ctx={ctx} large />
      </div>
      <div className="absolute top-[188px] left-[56px] w-[640px]">
        <p className="doc-latin text-[12px] tracking-[0.3em] text-doc-accent">{t.coverTagline} · {f.year}</p>
        <h1 className="doc-display mt-[22px] text-[54px] leading-[1.25]">{t.headline}</h1>
        <p className="doc-body mt-[18px] text-[22px] leading-normal">{SUBTITLE}</p>
        <div className="mt-[22px] flex flex-wrap gap-[10px]">
          {f.tags.map((tag) => (
            <span key={tag} className="doc-body rounded-full border border-doc-accent/50 px-[14px] py-[5px] text-[13px] text-doc-accent">
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div className="absolute top-[560px] left-[56px] w-[640px] rounded-(--deck-radius) bg-(--deck-panel) px-[28px] py-[24px]">
        <p className="doc-display truncate text-[24px] leading-normal">{ctx.m.place}</p>
        <p className="doc-body mt-[6px] truncate text-[16px] text-doc-muted">{f.who}</p>
        <div className="mt-[18px] grid grid-cols-3 gap-[16px] border-t border-doc-rule pt-[16px]">
          {stats.map(([k, v]) => (
            <div key={k}>
              <p className="doc-numeral text-[26px] leading-tight text-doc-accent">{v}</p>
              <p className="doc-body mt-[2px] text-[12px] text-doc-muted">{k}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute top-[36px] right-[56px] h-[888px] w-[636px] overflow-hidden rounded-[28px]">
        <img src={t.coverPhoto} alt="" loading="eager" decoding="sync" className="size-full object-cover" />
        <span className="doc-body absolute bottom-[22px] left-[22px] rounded-full bg-(--deck-chip) px-[12px] py-[5px] text-[11px] text-(--deck-chip-ink)">{t.photoNote}</span>
      </div>
      <div className="absolute top-[906px] left-[56px] flex w-[640px] justify-between leading-normal">
        <p className="doc-latin text-[11px] text-doc-muted">{f.doc}</p>
        <p className="doc-latin text-[12px] text-doc-ink">{`${pad(no)} / ${pad(total)}`}</p>
      </div>
      <p className="doc-body absolute top-[836px] left-[56px] w-[640px] truncate text-[12px] text-doc-accent">{f.accent}</p>
    </Slide>
  )
}
