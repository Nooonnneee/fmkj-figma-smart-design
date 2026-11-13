/**
 * 点位图「逐点位编辑」纯函数（AI 工具、脚本、测试共用）。
 *
 * 场景格式见 `point-scene.ts`：
 * - 点位 = 一张标记 image（自定义数据 deviceType / pointCode / productId）+ 一个代号 text（同一 group）
 * - 房间 = 一个 rectangle（kind=area，带 name / areaType / polygon）+ 一个区域名 text（同一 group）
 *
 * 这里不碰数据库，只负责把编辑意图应用到场景并逐条返回结果；
 * 保存（payload.update + files 置 null）由 `point-map-handlers.ts` 负责。
 */
import { inferAreaType, isAreaType } from '@/lib/area-types'
import {
  categoryOfType,
  DEVICE_CATEGORIES,
  DEVICE_TYPES,
  isDeviceType,
} from '@/lib/device-types'
import { markerFileId } from '@/lib/point-markers'
import {
  analyzeScene,
  buildPointElements,
  compactScene,
  isPointElement,
  markerFile,
  nextPointCode,
  pointTitle,
  type AreaInfo,
  type SceneEl,
  type SceneFile,
  type StoredScene,
} from '@/lib/point-scene'

/** 单次 edit_point_map 最多处理的编辑条数（防止一个提示词改动整张图）。 */
export const MAX_POINT_EDITS = 50

export type PointMapAddEdit = {
  /** 设备类型（字典值或中文名，如 socket / 插座 / 双开） */
  type: string
  /** 点位代号（画布上显示的名称/编号）；不传时按设备类型自动生成 */
  label?: string
  /** 点位中心 x（场景坐标）；与 y 一起省略时落在 roomId/sheetId 中心 */
  x?: number | string
  y?: number | string
  sheetId?: string
  roomId?: string
  productId?: string | null
}

export type PointMapMoveEdit = {
  /** 点位 id（list_point_map 返回的 id） */
  id: string
  /** 绝对中心坐标（场景坐标） */
  x?: number | string
  y?: number | string
  /** 相对偏移（与 x / y 二选一） */
  dx?: number | string
  dy?: number | string
}

export type PointMapRemoveEdit = { id: string }

export type PointMapUpdateEdit = {
  id: string
  /** 点位：代号/名称；房间：房间名 */
  name?: string
  /** 仅点位：等价于 name */
  label?: string
  /** 仅点位：设备类型 */
  type?: string
  /** 仅点位：指定产品型号 id；传 null 清除 */
  productId?: string | null
  /** 仅房间：房间类型 */
  areaType?: string
  /** 仅房间：场景坐标多边形 [[x,y],…]，至少 3 个点；传 null / [] 恢复矩形 */
  polygon?: Array<[number, number]> | null
}

export type PointMapEdits = {
  add?: PointMapAddEdit[]
  move?: PointMapMoveEdit[]
  remove?: PointMapRemoveEdit[]
  update?: PointMapUpdateEdit[]
}

export type PointMapEditAction = 'add' | 'move' | 'remove' | 'update'

export type PointMapEditResult = {
  action: PointMapEditAction | 'noop' | 'limit'
  status: 'ok' | 'skipped'
  /** 受影响的元素 id（add 返回新点位 id） */
  id?: string
  /** 操作对象：point / area */
  kind?: 'point' | 'area'
  reason?: string
  /** 操作后的点位所属图纸/房间（便于模型复述） */
  sheetId?: string | null
  roomId?: string | null
  detail?: Record<string, unknown>
}

export type ApplyPointEditsResult = {
  /** 压缩后的新场景（可直接保存；没有成功编辑时与原场景语义一致） */
  scene: StoredScene
  /** 逐条结果，成功/跳过都带原因 */
  results: PointMapEditResult[]
  /** 是否真的改动了场景；false 时调用方不要写库 */
  changed: boolean
}

const kindOf = (el: SceneEl) =>
  typeof el.customData?.kind === 'string' ? (el.customData.kind as string) : null
const str = (v: unknown, max: number) =>
  typeof v === 'string' ? v.trim().slice(0, max) : ''
const num = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/* ---------------- 设备类型 / 房间类型 ---------------- */

const typeByName = new Map<string, string>()
for (const t of DEVICE_TYPES) {
  typeByName.set(t.name, t.value)
  typeByName.set(`${DEVICE_CATEGORIES.find((c) => c.slug === t.category)?.name ?? ''}${t.name}`, t.value)
}

/** 设备类型：字典值、中文名（插座/双开）都能识别；无法识别返回 null。 */
export function normalizeDeviceType(raw: unknown): string | null {
  const s = str(raw, 40)
  if (!s) return null
  if (isDeviceType(s)) return s
  const lower = s.toLowerCase().replace(/\s+/g, '-')
  if (isDeviceType(lower)) return lower
  return typeByName.get(s.replace(/\s+/g, '')) ?? null
}

const pointCenter = (el: SceneEl) => ({
  cx: el.x + (Number(el.width) || 0) / 2,
  cy: el.y + (Number(el.height) || 0) / 2,
})

/** 与点位/房间同一 group 的配套元素（代号文字、区域名文字）。 */
function pairedElements(
  elements: readonly SceneEl[],
  source: SceneEl,
  kind: string,
): SceneEl[] {
  const groups = new Set(source.groupIds ?? [])
  if (groups.size) {
    return elements.filter(
      (e) =>
        e.id !== source.id &&
        kindOf(e) === kind &&
        (e.groupIds ?? []).some((g) => groups.has(g)),
    )
  }
  // 老场景可能没有 group：点位按代号兜底，区域名不猜（避免误改同名房间）
  if (kind === 'label') {
    const code = source.customData?.pointCode
    if (typeof code !== 'string' || !code) return []
    return elements.filter(
      (e) => e.id !== source.id && kindOf(e) === 'label' && e.customData?.pointCode === code,
    )
  }
  return []
}

/** 按 id 找点位；也接受代号文字的 id（模型偶尔会返回 label 的 id）。 */
function findPoint(elements: readonly SceneEl[], id: string): SceneEl | null {
  const direct = elements.find((e) => e.id === id && isPointElement(e))
  if (direct) return direct
  const label = elements.find((e) => e.id === id && kindOf(e) === 'label')
  if (!label) return null
  const groups = new Set(label.groupIds ?? [])
  if (!groups.size) return null
  return (
    elements.find((e) => isPointElement(e) && (e.groupIds ?? []).some((g) => groups.has(g))) ??
    null
  )
}

function findArea(elements: readonly SceneEl[], id: string): SceneEl | null {
  return elements.find((e) => e.id === id && kindOf(e) === 'area') ?? null
}

const cloneElement = (el: SceneEl): SceneEl => ({
  ...el,
  ...(el.groupIds ? { groupIds: [...el.groupIds] } : {}),
  ...(el.customData ? { customData: { ...el.customData } } : {}),
})

/* ---------------- 单条编辑 ---------------- */

function applyUpdate(
  elements: SceneEl[],
  files: Record<string, SceneFile>,
  edit: Record<string, unknown>,
): PointMapEditResult {
  const id = str(edit.id, 64)
  if (!id) return { action: 'update', status: 'skipped', reason: 'update 缺少 id' }

  const point = findPoint(elements, id)
  if (point) {
    const nameRaw = edit.name !== undefined ? edit.name : edit.label
    const name = nameRaw === undefined ? null : str(nameRaw, 60)
    const typeRaw = edit.type === undefined ? null : normalizeDeviceType(edit.type)
    const hasProduct = Object.prototype.hasOwnProperty.call(edit, 'productId')
    const productId =
      hasProduct && edit.productId !== null && edit.productId !== undefined
        ? str(edit.productId, 64) || null
        : null

    if (nameRaw !== undefined && !name)
      return { action: 'update', status: 'skipped', id, kind: 'point', reason: '点位名称不能为空' }
    if (edit.type !== undefined && !typeRaw)
      return {
        action: 'update',
        status: 'skipped',
        id,
        kind: 'point',
        reason: `未知设备类型「${String(edit.type)}」`,
      }
    if (nameRaw === undefined && edit.type === undefined && !hasProduct)
      return { action: 'update', status: 'skipped', id, kind: 'point', reason: '没有可修改的字段' }

    const before = {
      code: typeof point.customData?.pointCode === 'string' ? point.customData.pointCode : '',
      type: typeof point.customData?.deviceType === 'string' ? point.customData.deviceType : '',
      productId:
        typeof point.customData?.productId === 'string' ? point.customData.productId : null,
    }

    if (name) {
      const used = new Set(
        elements
          .filter((e) => isPointElement(e) && e.id !== point.id)
          .map((e) => (typeof e.customData?.pointCode === 'string' ? e.customData.pointCode : ''))
          .filter(Boolean),
      )
      if (used.has(name))
        return {
          action: 'update',
          status: 'skipped',
          id,
          kind: 'point',
          reason: `点位代号「${name}」已被其他点位使用`,
        }
    }

    const cd = { ...(point.customData ?? {}) }
    if (name) cd.pointCode = name
    if (typeRaw) {
      cd.deviceType = typeRaw
      // 设备类型变了但没重新指定型号时，清掉旧 productId，避免型号与类型不一致
      if (!hasProduct) delete cd.productId
      const fileId = markerFileId(typeRaw)
      point.fileId = fileId
      if (!files[fileId]) files[fileId] = markerFile(typeRaw)
    }
    if (hasProduct) {
      if (productId) cd.productId = productId
      else delete cd.productId
    }
    point.customData = cd

    for (const label of pairedElements(elements, point, 'label')) {
      if (name) {
        label.text = name
        label.customData = { ...(label.customData ?? {}), pointCode: name }
      }
      if (typeRaw) {
        const color = categoryOfType(typeRaw)?.color
        if (color) label.strokeColor = color
      }
    }

    return {
      action: 'update',
      status: 'ok',
      id: point.id,
      kind: 'point',
      detail: {
        before,
        after: {
          code: typeof point.customData?.pointCode === 'string' ? point.customData.pointCode : '',
          type:
            typeof point.customData?.deviceType === 'string' ? point.customData.deviceType : '',
          productId:
            typeof point.customData?.productId === 'string' ? point.customData.productId : null,
        },
      },
    }
  }

  const area = findArea(elements, id)
  if (!area) {
    return {
      action: 'update',
      status: 'skipped',
      id,
      reason: `场景里没有 id 为「${id}」的点位或房间`,
    }
  }

  const hasName = edit.name !== undefined
  const name = hasName ? str(edit.name, 30) : ''
  const hasAreaType = edit.areaType !== undefined
  const hasPolygon = Object.prototype.hasOwnProperty.call(edit, 'polygon')
  if (!hasName && !hasAreaType && !hasPolygon)
    return { action: 'update', status: 'skipped', id, kind: 'area', reason: '没有可修改的字段' }
  if (hasName && !name)
    return { action: 'update', status: 'skipped', id, kind: 'area', reason: '房间名称不能为空' }
  if (hasAreaType && !isAreaType(edit.areaType))
    return {
      action: 'update',
      status: 'skipped',
      id,
      kind: 'area',
      reason: `未知房间类型「${String(edit.areaType)}」`,
    }

  let polygon: [number, number][] | null | undefined
  if (hasPolygon) {
    const raw = edit.polygon
    if (raw === null || (Array.isArray(raw) && raw.length === 0)) {
      polygon = null
    } else if (!Array.isArray(raw) || raw.length < 3) {
      return {
        action: 'update',
        status: 'skipped',
        id,
        kind: 'area',
        reason: 'polygon 至少需要 3 个顶点',
      }
    } else {
      const pts: [number, number][] = []
      for (const q of raw) {
        if (!Array.isArray(q) || q.length < 2) {
          pts.length = 0
          break
        }
        const x = num(q[0])
        const y = num(q[1])
        if (x === null || y === null) {
          pts.length = 0
          break
        }
        pts.push([x, y])
      }
      if (pts.length < 3)
        return {
          action: 'update',
          status: 'skipped',
          id,
          kind: 'area',
          reason: 'polygon 顶点必须是 [x, y] 数字对，且至少 3 个',
        }
      const xs = pts.map((p) => p[0])
      const ys = pts.map((p) => p[1])
      const minX = Math.min(...xs)
      const minY = Math.min(...ys)
      const width = Math.max(...xs) - minX
      const height = Math.max(...ys) - minY
      if (width <= 0 || height <= 0)
        return { action: 'update', status: 'skipped', id, kind: 'area', reason: 'polygon 面积无效' }
      area.x = minX
      area.y = minY
      area.width = width
      area.height = height
      polygon = pts.map(([x, y]) => [x - minX, y - minY] as [number, number])
    }
  }

  const cd = { ...(area.customData ?? {}) }
  if (hasName) cd.name = name
  if (hasAreaType) cd.areaType = edit.areaType as string
  if (hasPolygon) {
    if (polygon) cd.polygon = polygon
    else delete cd.polygon
  }
  if (hasName && !hasAreaType) {
    // 改名后房间类型仍由名称推断（与场景读取规则一致），但只在没有显式类型时兜底
    const current = cd.areaType
    if (!isAreaType(current)) cd.areaType = inferAreaType(name)
  }
  area.customData = cd

  for (const label of pairedElements(elements, area, 'area-label')) {
    if (hasName) label.text = name
  }

  return {
    action: 'update',
    status: 'ok',
    id: area.id,
    kind: 'area',
    detail: {
      name: typeof cd.name === 'string' ? cd.name : '',
      polygon: polygon ?? null,
    },
  }
}

function applyMove(elements: SceneEl[], edit: Record<string, unknown>): PointMapEditResult {
  const id = str(edit.id, 64)
  if (!id) return { action: 'move', status: 'skipped', reason: 'move 缺少 id' }
  const point = findPoint(elements, id)
  if (!point) {
    const area = findArea(elements, id)
    if (area)
      return {
        action: 'move',
        status: 'skipped',
        id,
        kind: 'area',
        reason: 'move 只支持点位；房间请用 update 的 polygon 调整范围',
      }
    return {
      action: 'move',
      status: 'skipped',
      id,
      reason: `场景里没有 id 为「${id}」的点位`,
    }
  }

  const { cx, cy } = pointCenter(point)
  const absX = edit.x !== undefined ? num(edit.x) : null
  const absY = edit.y !== undefined ? num(edit.y) : null
  const dx = edit.dx !== undefined ? num(edit.dx) : null
  const dy = edit.dy !== undefined ? num(edit.dy) : null
  if (edit.x !== undefined && absX === null)
    return { action: 'move', status: 'skipped', id, kind: 'point', reason: 'x 不是有效数字' }
  if (edit.y !== undefined && absY === null)
    return { action: 'move', status: 'skipped', id, kind: 'point', reason: 'y 不是有效数字' }
  if (edit.dx !== undefined && dx === null)
    return { action: 'move', status: 'skipped', id, kind: 'point', reason: 'dx 不是有效数字' }
  if (edit.dy !== undefined && dy === null)
    return { action: 'move', status: 'skipped', id, kind: 'point', reason: 'dy 不是有效数字' }
  if (absX === null && absY === null && dx === null && dy === null)
    return {
      action: 'move',
      status: 'skipped',
      id,
      kind: 'point',
      reason: '需要 x / y（绝对坐标）或 dx / dy（相对偏移）',
    }

  const nextCx = absX ?? cx + (dx ?? 0)
  const nextCy = absY ?? cy + (dy ?? 0)
  const deltaX = nextCx - cx
  const deltaY = nextCy - cy
  point.x = nextCx - (Number(point.width) || 0) / 2
  point.y = nextCy - (Number(point.height) || 0) / 2
  for (const label of pairedElements(elements, point, 'label')) {
    label.x = (Number(label.x) || 0) + deltaX
    label.y = (Number(label.y) || 0) + deltaY
  }

  return {
    action: 'move',
    status: 'ok',
    id: point.id,
    kind: 'point',
    detail: { from: { x: cx, y: cy }, to: { x: nextCx, y: nextCy } },
  }
}

function applyRemove(elements: SceneEl[], edit: Record<string, unknown>): PointMapEditResult {
  const id = str(edit.id, 64)
  if (!id) return { action: 'remove', status: 'skipped', reason: 'remove 缺少 id' }

  const point = findPoint(elements, id)
  if (point) {
    const removeIds = new Set([point.id])
    for (const label of pairedElements(elements, point, 'label')) removeIds.add(label.id)
    for (let i = elements.length - 1; i >= 0; i--)
      if (removeIds.has(elements[i].id)) elements.splice(i, 1)
    return {
      action: 'remove',
      status: 'ok',
      id: point.id,
      kind: 'point',
      detail: { removedElements: removeIds.size },
    }
  }

  const area = findArea(elements, id)
  if (area) {
    const removeIds = new Set([area.id])
    for (const label of pairedElements(elements, area, 'area-label')) removeIds.add(label.id)
    for (let i = elements.length - 1; i >= 0; i--)
      if (removeIds.has(elements[i].id)) elements.splice(i, 1)
    // 房间里的点位保留，只是不再归属该房间（不破坏未涉及的元素）
    return {
      action: 'remove',
      status: 'ok',
      id: area.id,
      kind: 'area',
      detail: { removedElements: removeIds.size },
    }
  }

  return {
    action: 'remove',
    status: 'skipped',
    id,
    reason: `场景里没有 id 为「${id}」的点位或房间`,
  }
}

function applyAdd(
  elements: SceneEl[],
  files: Record<string, SceneFile>,
  edit: Record<string, unknown>,
): PointMapEditResult {
  const type = normalizeDeviceType(edit.type)
  if (!type)
    return {
      action: 'add',
      status: 'skipped',
      reason: `未知设备类型「${String(edit.type ?? '')}」`,
    }

  const sheetId = str(edit.sheetId, 64)
  const roomId = str(edit.roomId, 64)
  const analyzed = analyzeScene({ elements, files })
  const sheet = sheetId ? analyzed.sheets.find((s) => s.id === sheetId) : null
  if (sheetId && !sheet)
    return { action: 'add', status: 'skipped', reason: `图纸「${sheetId}」不存在` }
  const room = roomId ? analyzed.areas.find((a) => a.id === roomId) : null
  if (roomId && !room)
    return { action: 'add', status: 'skipped', reason: `房间「${roomId}」不存在` }
  if (sheet && room && room.sheetId && room.sheetId !== sheet.id)
    return {
      action: 'add',
      status: 'skipped',
      reason: `房间「${room.name}」不在图纸「${sheet.name}」上`,
    }

  const xProvided = edit.x !== undefined
  const yProvided = edit.y !== undefined
  if (xProvided !== yProvided)
    return { action: 'add', status: 'skipped', reason: 'x 和 y 必须同时提供' }
  const x = xProvided ? num(edit.x) : null
  const y = yProvided ? num(edit.y) : null
  if ((xProvided && x === null) || (yProvided && y === null))
    return { action: 'add', status: 'skipped', reason: 'x / y 不是有效数字' }

  let cx: number
  let cy: number
  if (x !== null && y !== null) {
    cx = x
    cy = y
  } else if (room) {
    if (room.poly) {
      cx = room.poly.reduce((s, p) => s + p[0], 0) / room.poly.length
      cy = room.poly.reduce((s, p) => s + p[1], 0) / room.poly.length
    } else {
      cx = room.x + room.width / 2
      cy = room.y + room.height / 2
    }
  } else if (sheet) {
    cx = sheet.x + sheet.width / 2
    cy = sheet.y + sheet.height / 2
  } else {
    return {
      action: 'add',
      status: 'skipped',
      reason: '需要 x / y，或提供 sheetId / roomId 以确定落点',
    }
  }

  const usedCodes = new Set(
    analyzed.points.map((p) => p.code).filter((c): c is string => Boolean(c)),
  )
  const requestedCode = str(edit.label, 60)
  if (requestedCode && usedCodes.has(requestedCode))
    return {
      action: 'add',
      status: 'skipped',
      reason: `点位代号「${requestedCode}」已被其他点位使用`,
    }
  const code = requestedCode || nextPointCode(type, usedCodes)
  const productId = edit.productId === null ? null : str(edit.productId, 64) || null

  const built = buildPointElements({
    deviceType: type,
    cx,
    cy,
    code,
    productId,
  })
  elements.push(...built)
  const fileId = markerFileId(type)
  if (!files[fileId]) files[fileId] = markerFile(type)

  const pointId = built[0]?.id ?? ''
  return {
    action: 'add',
    status: 'ok',
    id: pointId,
    kind: 'point',
    detail: {
      code,
      type,
      x: cx,
      y: cy,
      sheetId: room?.sheetId ?? sheet?.id ?? null,
      roomId: room?.id ?? null,
    },
  }
}

/* ---------------- 批量应用 ---------------- */

const arr = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v)
    ? v.map((x) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {}))
    : []

/**
 * 把一组编辑应用到场景（纯函数）。
 *
 * 顺序：update → move → remove → add。所有条目都会产生结果（成功或带原因的跳过），
 * 未知 id / 无效坐标 / 重复代号不会被静默丢弃；单次超过 MAX_POINT_EDITS 时整批不执行。
 */
export function applyPointEdits(
  scene: Partial<StoredScene> | null | undefined,
  edits: PointMapEdits | null | undefined,
): ApplyPointEditsResult {
  const sourceElements = ((scene?.elements ?? []) as SceneEl[]).filter(
    (e) => !!e && typeof e === 'object' && !e.isDeleted,
  )
  const elements = sourceElements.map(cloneElement)
  const files: Record<string, SceneFile> = Object.fromEntries(
    Object.entries((scene?.files ?? {}) as Record<string, SceneFile | null>).filter(
      (entry): entry is [string, SceneFile] =>
        !!entry[1] && typeof entry[1].dataURL === 'string',
    ),
  )

  const updates = arr(edits?.update)
  const moves = arr(edits?.move)
  const removes = arr(edits?.remove)
  const adds = arr(edits?.add)
  const total = updates.length + moves.length + removes.length + adds.length

  const compact = (els: SceneEl[]) => {
    const used = new Set(
      els.map((e) => e.fileId).filter((v): v is string => typeof v === 'string'),
    )
    for (const key of Object.keys(files)) if (!used.has(key)) delete files[key]
    return compactScene(els, files, scene?.appState)
  }

  if (total === 0) {
    return {
      scene: compact(elements),
      results: [{ action: 'noop', status: 'skipped', reason: '没有提供任何编辑操作' }],
      changed: false,
    }
  }
  if (total > MAX_POINT_EDITS) {
    return {
      scene: compact(elements),
      results: [
        {
          action: 'limit',
          status: 'skipped',
          reason: `单次最多 ${MAX_POINT_EDITS} 条编辑，本次 ${total} 条，未做任何修改；请分批调用`,
        },
      ],
      changed: false,
    }
  }

  const results: PointMapEditResult[] = []
  let changed = false

  for (const edit of updates) {
    const r = applyUpdate(elements, files, edit)
    if (r.status === 'ok') changed = true
    results.push(r)
  }
  for (const edit of moves) {
    const r = applyMove(elements, edit)
    if (r.status === 'ok') changed = true
    results.push(r)
  }
  for (const edit of removes) {
    const r = applyRemove(elements, edit)
    if (r.status === 'ok') changed = true
    results.push(r)
  }
  for (const edit of adds) {
    const r = applyAdd(elements, files, edit)
    if (r.status === 'ok') changed = true
    results.push(r)
  }

  const compacted = compact(elements)
  if (changed) {
    // 回填点位最终的所属图纸/房间，模型复述时不用再查一次
    const final = analyzeScene(compacted)
    const info = new Map(final.points.map((p) => [p.id, p]))
    for (const r of results) {
      const p = r.id ? info.get(r.id) : undefined
      if (p) {
        r.sheetId = p.sheetId
        r.roomId = p.areaId
      }
    }
  }
  return { scene: compacted, results, changed }
}

/* ---------------- 读取摘要 ---------------- */

export const MAX_LIST_POINTS = 300

export type PointMapSummary = {
  counts: { sheets: number; areas: number; points: number }
  sheets: Array<{
    id: string
    name: string
    x: number
    y: number
    width: number
    height: number
  }>
  areas: Array<{
    id: string
    name: string
    areaType: string
    sheetId: string | null
    x: number
    y: number
    width: number
    height: number
    /** 场景坐标多边形；null = 矩形范围 */
    polygon: [number, number][] | null
    pointCount: number
  }>
  points: Array<{
    id: string
    code: string
    name: string
    type: string
    x: number
    y: number
    sheetId: string | null
    roomId: string | null
    productId: string | null
  }>
  truncated: boolean
}

/** 供模型拿可操作 id 的紧凑摘要（不读数据库，可直接测试）。 */
export function summarizePointMap(
  scene: Partial<StoredScene> | null | undefined,
  options: { maxPoints?: number } = {},
): PointMapSummary {
  const analyzed = analyzeScene(scene)
  const maxPoints = Math.max(0, options.maxPoints ?? MAX_LIST_POINTS)
  const perArea = new Map<string, number>()
  for (const p of analyzed.points)
    if (p.areaId) perArea.set(p.areaId, (perArea.get(p.areaId) ?? 0) + 1)

  const areas: PointMapSummary['areas'] = analyzed.areas.map((a: AreaInfo) => ({
    id: a.id,
    name: a.name,
    areaType: a.areaType,
    sheetId: a.sheetId,
    x: a.x,
    y: a.y,
    width: a.width,
    height: a.height,
    polygon: a.poly,
    pointCount: perArea.get(a.id) ?? 0,
  }))

  return {
    counts: {
      sheets: analyzed.sheets.length,
      areas: analyzed.areas.length,
      points: analyzed.points.length,
    },
    sheets: analyzed.sheets.map((s) => ({
      id: s.id,
      name: s.name,
      x: s.x,
      y: s.y,
      width: s.width,
      height: s.height,
    })),
    areas,
    points: analyzed.points.slice(0, maxPoints).map((p) => ({
      id: p.id,
      code: p.code,
      name: pointTitle(p),
      type: p.deviceType,
      x: p.cx,
      y: p.cy,
      sheetId: p.sheetId,
      roomId: p.areaId,
      productId: p.productId,
    })),
    truncated: analyzed.points.length > maxPoints,
  }
}
