/**
 * 方案演示插件：「栖序提案」——对应 Figma 设计稿（FGGahF8jZGnRLwcgZfJloK）的整套横版方案。
 * 每一类页面拆分为独立 Figma 画布模板文件（见 ./figma-templates/），按 1440×1018 标准画布排版并接入真实项目与报价数据。
 */
import { docNumber, type ProjectDocsData } from '@/lib/project-docs'

import { Fragment } from 'react'

import { FigmaCoverPage } from './figma-templates/01-cover'
import { FigmaOverviewPage } from './figma-templates/02-overview'
import { FigmaFloorPlanPage } from './figma-templates/03-floor-plan'
import { FigmaRoomsPage } from './figma-templates/04-room-config'
import { FigmaEquipmentPage } from './figma-templates/05-equipment-list'
import { FigmaBudgetPage } from './figma-templates/06-budget-summary'
import { FigmaServicePage } from './figma-templates/08-service-handover'
import { chunk, type FigmaTemplateCtx } from './figma-templates/shared'

/** 生成「栖序提案」的全部页面。roomInsights 关闭时不出房间配置页。 */
export function qixuDeckPages(d: ProjectDocsData, markers: 'symbol' | 'product', roomInsights: boolean) {
  const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }).replaceAll('-', '.')
  const docNo = docNumber(d, 'QX')
  // 最终金额：若当前匹配的报价单范围一致，则包含附加费与优惠减免；否则取当前范围的设备合计
  const finalAmount = d.quote ? Math.max(0, d.total + (d.quote.feeTotal ?? 0) - (d.quote.discount ?? 0)) : d.total
  const ctx: FigmaTemplateCtx = { d, markers, date, docNo, finalAmount }
  const all = d.scope === 'all'
  const pages: ((no: number, total: number) => React.ReactNode)[] = []
  pages.push((no, total) => <FigmaCoverPage ctx={ctx} no={no} total={total} />)
  if (d.categories.length) pages.push((no, total) => <FigmaOverviewPage ctx={ctx} no={no} total={total} />)
  for (const s of d.sheets)
    if (all || d.points.some((p) => p.sheetId === s.id))
      pages.push((no, total) => <FigmaFloorPlanPage ctx={ctx} no={no} total={total} sheetId={s.id} />)
  const roomPages = roomInsights ? chunk(d.rooms.filter((r) => r.total > 0), 6) : []
  for (const [i, rooms] of roomPages.entries())
    pages.push((no, total) => (
      <FigmaRoomsPage ctx={ctx} no={no} total={total} rooms={rooms} part={roomPages.length > 1 ? `（${i + 1}/${roomPages.length}）` : ''} />
    ))
  const productPages = chunk(d.products, 11)
  for (const [i, rows] of productPages.entries())
    pages.push((no, total) => (
      <FigmaEquipmentPage
        ctx={ctx}
        no={no}
        total={total}
        rows={rows}
        part={productPages.length > 1 ? `（${i + 1}/${productPages.length}）` : ''}
        isLast={i === productPages.length - 1}
      />
    ))
  if (d.categories.length) pages.push((no, total) => <FigmaBudgetPage ctx={ctx} no={no} total={total} />)
  pages.push((no, total) => <FigmaServicePage ctx={ctx} no={no} total={total} />)
  return pages.map((render, i) => <Fragment key={i}>{render(i + 1, pages.length)}</Fragment>)
}
