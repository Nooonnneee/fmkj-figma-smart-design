/** 点位图的业务操作（代号、设备类型、灯光款式、图纸、区域）。都是纯函数，返回新文档。 */
import { removeObjects, sheetsOf, updateObject, withPoly } from '@/board/core/ops'
import type { AreaObj, BoardDoc, BoardObj, Box, SheetObj, SymbolObj, SymbolTemplate, Vec } from '@/board/core/types'
import { areaTypeLabel, inferAreaType, isAreaType } from '@/lib/area-types'
import { categoryOfType } from '@/lib/device-types'
import { nextPointCode, randomId } from '@/lib/point-scene'
import { SHEET } from '@/lib/sheet-spec'

import { lightingVariant, type LightingVariant } from './look'

export const codesOf = (doc: BoardDoc) => doc.objects.flatMap((o) => (o.kind === 'symbol' ? [o.code] : []))

export function createPoint(doc: BoardDoc, tpl: SymbolTemplate, at: Vec): { doc: BoardDoc; obj: SymbolObj } {
  const deviceType = String(tpl.data.deviceType ?? 'other')
  const obj: SymbolObj = {
    kind: 'symbol',
    id: randomId(),
    symbolId: tpl.symbolId,
    x: at.x,
    y: at.y,
    angle: tpl.angle ?? 0,
    code: nextPointCode(deviceType, codesOf(doc)),
    sizeCm: tpl.sizeCm,
    real: tpl.real,
    data: { ...tpl.data },
    meta: { group: randomId('pt-'), labelId: randomId() },
  }
  return { doc: { objects: [...doc.objects, obj] }, obj }
}

/** 换设备类型：同大类保留代号，跨大类重新编号；灯光款式只在同类型下保留 */
export function changePointType(doc: BoardDoc, id: string, newType: string) {
  return updateObject<SymbolObj>(doc, id, (o) => {
    const oldType = String(o.data.deviceType ?? 'other')
    if (oldType === newType) return null
    const code = categoryOfType(oldType)?.code === categoryOfType(newType)?.code && o.code ? o.code : nextPointCode(newType, codesOf(doc))
    const { productId: _p, ...rest } = o.data
    const keep = lightingVariant(o.symbolId)?.family.deviceType === newType
    return { ...o, code, data: { ...rest, deviceType: newType }, symbolId: keep ? o.symbolId : newType, sizeCm: keep ? o.sizeCm : null, real: keep ? o.real : false }
  })
}

/** 换灯光款式 / 尺寸档（设备类型跟随款式） */
export function setPointVariant(doc: BoardDoc, id: string, v: LightingVariant, real: boolean) {
  const o = doc.objects.find((x) => x.id === id)
  if (!o || o.kind !== 'symbol') return doc
  const typed = changePointType(doc, id, v.family.deviceType)
  return updateObject<SymbolObj>(typed, id, (p) => ({ ...p, symbolId: v.id, sizeCm: v.sizeCm, real }))
}

export function setPointReal(doc: BoardDoc, ids: string[], real: boolean) {
  let d = doc
  for (const id of ids) d = updateObject<SymbolObj>(d, id, (o) => (o.kind === 'symbol' && o.real !== real ? { ...o, real } : null))
  return d
}

/** 复制 / 粘贴：新 ID，点位重新编号 */
export function cloneObjects(doc: BoardDoc, src: BoardObj[], offset: Vec): { doc: BoardDoc; ids: string[] } {
  const objects = [...doc.objects]
  const ids: string[] = []
  for (const o of src) {
    const id = randomId()
    let n: BoardObj | null = null
    if (o.kind === 'symbol') {
      const codes = objects.flatMap((x) => (x.kind === 'symbol' ? [x.code] : []))
      n = { ...o, id, x: o.x + offset.x, y: o.y + offset.y, code: nextPointCode(String(o.data.deviceType ?? 'other'), codes), meta: { group: randomId('pt-'), labelId: randomId() } }
    } else if (o.kind === 'area')
      n = { ...o, id, x: o.x + offset.x, y: o.y + offset.y, ...(o.poly ? { poly: o.poly.map((q) => ({ x: q.x + offset.x, y: q.y + offset.y })) } : {}), meta: { group: randomId('ar-'), labelId: randomId() } }
    else if (o.kind === 'raw') n = { kind: 'raw', id, el: { ...o.el, id, x: o.el.x + offset.x, y: o.el.y + offset.y, groupIds: [] } }
    if (n) {
      objects.push(n)
      ids.push(id)
    }
  }
  return { doc: { objects }, ids }
}

/** 新建区域：传 poly 时是多边形（外接框按顶点算），否则是 box 这个矩形 */
export function createArea(doc: BoardDoc, box: Box, areaType = 'living', name?: string, poly?: Vec[]): { doc: BoardDoc; obj: AreaObj } {
  const t = isAreaType(areaType) ? areaType : 'living'
  const base: AreaObj = { kind: 'area', id: randomId(), x: box.x, y: box.y, w: box.w, h: box.h, name: name ?? areaTypeLabel(t), areaType: t, meta: { group: randomId('ar-'), labelId: randomId() } }
  const obj = (poly ? withPoly(base, poly) : null) ?? base
  // 区域放在其他区域之上、点位之下（绘制按图层，数组里放最后即可）
  return { doc: { objects: [...doc.objects, obj] }, obj }
}

export function updateArea(doc: BoardDoc, id: string, patch: { name?: string; areaType?: string }) {
  return updateObject<AreaObj>(doc, id, (a) => {
    const name = patch.name?.trim() || a.name
    const areaType = patch.areaType && isAreaType(patch.areaType) ? patch.areaType : patch.name ? inferAreaType(name) || a.areaType : a.areaType
    return name === a.name && areaType === a.areaType ? null : { ...a, name, areaType }
  })
}

/** 新图纸放在最右侧图纸的右边 */
export function createSheet(doc: BoardDoc, opts: { name: string; fileId: string; mediaId?: string | null }): { doc: BoardDoc; obj: SheetObj } {
  const sheets = sheetsOf(doc)
  const x = sheets.length ? Math.max(...sheets.map((s) => s.x + s.w)) + SHEET.gap : 0
  const obj: SheetObj = { kind: 'sheet', id: randomId(), sheetId: randomId('sh-'), name: opts.name, x, y: 0, w: SHEET.width, h: SHEET.height, fileId: opts.fileId, mediaId: opts.mediaId ?? null, mmPerUnit: null }
  return { doc: { objects: [obj, ...doc.objects] }, obj }
}

export const updateSheet = (doc: BoardDoc, sheetId: string, patch: Partial<Pick<SheetObj, 'name' | 'mmPerUnit'>>) => {
  const s = sheetsOf(doc).find((x) => x.sheetId === sheetId)
  return s ? updateObject<SheetObj>(doc, s.id, (o) => ({ ...o, ...patch })) : doc
}

const centerOf = (o: BoardObj): Vec | null => {
  if (o.kind === 'symbol') return { x: o.x, y: o.y }
  if (o.kind === 'area') return { x: o.x + o.w / 2, y: o.y + o.h / 2 }
  if (o.kind === 'raw') return { x: o.el.x + (o.el.width || 0) / 2, y: o.el.y + (o.el.height || 0) / 2 }
  return null
}

/** 删除图纸及图纸范围内的所有内容 */
export function removeSheet(doc: BoardDoc, sheet: SheetObj) {
  const ids = new Set<string>([sheet.id])
  for (const o of doc.objects) {
    const c = centerOf(o)
    if (c && c.x >= sheet.x && c.x <= sheet.x + sheet.w && c.y >= sheet.y && c.y <= sheet.y + sheet.h) ids.add(o.id)
  }
  return removeObjects(doc, ids)
}
