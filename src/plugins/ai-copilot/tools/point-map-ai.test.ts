import { describe, expect, it } from 'vitest'

import {
  applyPointEdits,
  MAX_POINT_EDITS,
  summarizePointMap,
} from '@/lib/point-map-edit'
import {
  analyzeScene,
  buildAreaElements,
  buildPointElements,
  buildSheetElements,
  type SceneEl,
  type StoredScene,
} from '@/lib/point-scene'

/**
 * 纯函数回归：不连数据库、不启动 Payload。
 * 场景 = 一张标准图纸 + 客厅区域 + 插座 Z1 + 人体传感器 S1。
 */
function baseScene() {
  const sheet = buildSheetElements({
    index: 0,
    name: '一层平面图',
    fileId: 'sheet-file-1',
    sheetId: 'sh-1',
  })
  const area = buildAreaElements({
    name: '客厅',
    areaType: 'living',
    x: 100,
    y: 100,
    width: 300,
    height: 200,
  })
  const point = buildPointElements({ deviceType: 'socket', cx: 200, cy: 200, code: 'Z1' })
  const sensor = buildPointElements({
    deviceType: 'motion-sensor',
    cx: 300,
    cy: 250,
    code: 'S1',
  })
  const elements: SceneEl[] = [...sheet, ...area, ...point, ...sensor]
  const files = {
    'sheet-file-1': {
      id: 'sheet-file-1',
      dataURL: '/demo-plans/gy-1f-light.png',
      mimeType: 'image/png',
    },
  }
  const scene: StoredScene = { elements, files }
  return {
    scene,
    sheetId: 'sh-1',
    areaId: area[0].id,
    pointId: point[0].id,
    pointLabelId: point[1].id,
    sensorId: sensor[0].id,
  }
}

const pointsOf = (scene: StoredScene) => analyzeScene(scene).points
const areasOf = (scene: StoredScene) => analyzeScene(scene).areas
const labelsOf = (scene: StoredScene, code: string) =>
  scene.elements.filter((e) => e.customData?.kind === 'label' && e.customData?.pointCode === code)

describe('applyPointEdits · move', () => {
  it('按绝对坐标移动点位，代号文字一起移动，其他点位不动', () => {
    const { scene, pointId, sensorId } = baseScene()
    const before = pointsOf(scene).find((p) => p.id === pointId)!
    const labelBefore = labelsOf(scene, 'Z1')[0]
    const sensorBefore = pointsOf(scene).find((p) => p.id === sensorId)!

    const r = applyPointEdits(scene, { move: [{ id: pointId, x: 500, y: 400 }] })

    expect(r.changed).toBe(true)
    expect(r.results).toHaveLength(1)
    expect(r.results[0]).toMatchObject({ action: 'move', status: 'ok', id: pointId })

    const after = pointsOf(r.scene).find((p) => p.id === pointId)!
    expect(after.cx).toBeCloseTo(500)
    expect(after.cy).toBeCloseTo(400)
    expect(after.sheetId).toBe('sh-1')
    expect(after.areaId).toBeNull()

    const labelAfter = labelsOf(r.scene, 'Z1')[0]
    expect(labelAfter.x - labelBefore.x).toBeCloseTo(300)
    expect(labelAfter.y - labelBefore.y).toBeCloseTo(200)

    const sensorAfter = pointsOf(r.scene).find((p) => p.id === sensorId)!
    expect(sensorAfter.cx).toBeCloseTo(sensorBefore.cx)
    expect(sensorAfter.cy).toBeCloseTo(sensorBefore.cy)
  })

  it('支持 dx / dy 相对偏移', () => {
    const { scene, pointId } = baseScene()
    const r = applyPointEdits(scene, { move: [{ id: pointId, dx: 20, dy: -10 }] })
    const after = pointsOf(r.scene).find((p) => p.id === pointId)!
    expect(after.cx).toBeCloseTo(220)
    expect(after.cy).toBeCloseTo(190)
  })

  it('也接受代号文字的 id', () => {
    const { scene, pointLabelId, pointId } = baseScene()
    const r = applyPointEdits(scene, { move: [{ id: pointLabelId, x: 150, y: 150 }] })
    expect(r.results[0]).toMatchObject({ status: 'ok', id: pointId })
    expect(pointsOf(r.scene).find((p) => p.id === pointId)!.cx).toBeCloseTo(150)
  })
})

describe('applyPointEdits · remove', () => {
  it('删除点位时同时删掉它的代号文字，房间保留', () => {
    const { scene, pointId, areaId } = baseScene()
    const r = applyPointEdits(scene, { remove: [{ id: pointId }] })

    expect(r.changed).toBe(true)
    expect(r.results[0]).toMatchObject({ action: 'remove', status: 'ok', kind: 'point' })
    expect(pointsOf(r.scene).map((p) => p.id)).not.toContain(pointId)
    expect(labelsOf(r.scene, 'Z1')).toHaveLength(0)
    expect(areasOf(r.scene).map((a) => a.id)).toContain(areaId)
    expect(pointsOf(r.scene)).toHaveLength(1)
  })

  it('删除房间时删除区域框与区域名，房间里的点位保留', () => {
    const { scene, areaId } = baseScene()
    const r = applyPointEdits(scene, { remove: [{ id: areaId }] })

    expect(r.changed).toBe(true)
    expect(r.results[0]).toMatchObject({ action: 'remove', status: 'ok', kind: 'area' })
    expect(areasOf(r.scene)).toHaveLength(0)
    expect(pointsOf(r.scene)).toHaveLength(2)
    expect(r.scene.elements.some((e) => e.customData?.kind === 'area-label')).toBe(false)
    for (const p of pointsOf(r.scene)) expect(p.areaId).toBeNull()
  })
})

describe('applyPointEdits · add', () => {
  it('按 type / label / x / y 新增点位，并补齐标记图片文件', () => {
    const { scene } = baseScene()
    const r = applyPointEdits(scene, {
      add: [{ type: 'downlight', label: 'L9', x: 500, y: 400 }],
    })

    expect(r.changed).toBe(true)
    expect(r.results[0]).toMatchObject({ action: 'add', status: 'ok', kind: 'point' })
    const point = pointsOf(r.scene).find((p) => p.code === 'L9')!
    expect(point.deviceType).toBe('downlight')
    expect(point.cx).toBeCloseTo(500)
    expect(point.cy).toBeCloseTo(400)
    expect(point.sheetId).toBe('sh-1')
    expect(r.scene.files['mk2-downlight']).toBeTruthy()
    expect(labelsOf(r.scene, 'L9')).toHaveLength(1)
  })

  it('只给 roomId 时落在房间中心', () => {
    const { scene, areaId } = baseScene()
    const r = applyPointEdits(scene, { add: [{ type: 'socket', roomId: areaId }] })

    expect(r.results[0].status).toBe('ok')
    const added = pointsOf(r.scene).find((p) => p.id === r.results[0].id)!
    expect(added.cx).toBeCloseTo(250)
    expect(added.cy).toBeCloseTo(200)
    expect(added.areaId).toBe(areaId)
  })

  it('中文设备类型也能识别', () => {
    const { scene } = baseScene()
    const r = applyPointEdits(scene, { add: [{ type: '双开', x: 600, y: 300 }] })
    expect(r.results[0].status).toBe('ok')
    expect(pointsOf(r.scene).find((p) => p.id === r.results[0].id)!.deviceType).toBe('switch-2')
  })

  it('未知设备类型逐条跳过并给出原因', () => {
    const { scene } = baseScene()
    const r = applyPointEdits(scene, { add: [{ type: '不存在的设备', x: 10, y: 10 }] })
    expect(r.changed).toBe(false)
    expect(r.results[0]).toMatchObject({ action: 'add', status: 'skipped' })
    expect(r.results[0].reason).toContain('未知设备类型')
  })
})

describe('applyPointEdits · update', () => {
  it('修改点位代号、设备类型与型号', () => {
    const { scene, pointId } = baseScene()
    const r = applyPointEdits(scene, {
      update: [{ id: pointId, name: 'Z9', type: 'socket-double', productId: 'p-1' }],
    })

    expect(r.results[0]).toMatchObject({ action: 'update', status: 'ok', kind: 'point' })
    const point = pointsOf(r.scene).find((p) => p.id === pointId)!
    expect(point.code).toBe('Z9')
    expect(point.deviceType).toBe('socket-double')
    expect(point.productId).toBe('p-1')
    expect(labelsOf(r.scene, 'Z1')).toHaveLength(0)
    expect(labelsOf(r.scene, 'Z9')).toHaveLength(1)
  })

  it('只改类型时清掉与旧类型绑定的 productId', () => {
    const { scene, pointId } = baseScene()
    const withProduct = applyPointEdits(scene, {
      update: [{ id: pointId, productId: 'p-old' }],
    })
    expect(pointsOf(withProduct.scene).find((p) => p.id === pointId)!.productId).toBe('p-old')

    const changed = applyPointEdits(withProduct.scene, {
      update: [{ id: pointId, type: 'socket-double' }],
    })
    const point = pointsOf(changed.scene).find((p) => p.id === pointId)!
    expect(point.deviceType).toBe('socket-double')
    expect(point.productId).toBeNull()
  })

  it('重复代号会被跳过', () => {
    const { scene, pointId } = baseScene()
    const r = applyPointEdits(scene, { update: [{ id: pointId, name: 'S1' }] })
    expect(r.changed).toBe(false)
    expect(r.results[0].status).toBe('skipped')
    expect(r.results[0].reason).toContain('已被其他点位使用')
  })

  it('修改房间名称与多边形（输入场景坐标，落库为相对坐标）', () => {
    const { scene, areaId } = baseScene()
    const polygon: [number, number][] = [
      [100, 100],
      [400, 100],
      [400, 300],
      [150, 300],
    ]
    const r = applyPointEdits(scene, {
      update: [{ id: areaId, name: '客厅改造', polygon }],
    })

    expect(r.results[0]).toMatchObject({ action: 'update', status: 'ok', kind: 'area' })
    const area = areasOf(r.scene).find((a) => a.id === areaId)!
    expect(area.name).toBe('客厅改造')
    expect(area.sheetId).toBe('sh-1')
    expect(area.poly).toEqual(polygon)
    expect(r.scene.elements.find((e) => e.customData?.kind === 'area-label')?.text).toBe(
      '客厅改造',
    )
  })

  it('polygon 传 null 恢复矩形范围', () => {
    const { scene, areaId } = baseScene()
    const withPoly = applyPointEdits(scene, {
      update: [{ id: areaId, polygon: [[100, 100], [300, 100], [300, 200], [100, 200]] }],
    })
    expect(areasOf(withPoly.scene).find((a) => a.id === areaId)!.poly).not.toBeNull()

    const rect = applyPointEdits(withPoly.scene, { update: [{ id: areaId, polygon: null }] })
    expect(areasOf(rect.scene).find((a) => a.id === areaId)!.poly).toBeNull()
  })

  it('无效多边形逐条跳过', () => {
    const { scene, areaId } = baseScene()
    const r = applyPointEdits(scene, {
      update: [{ id: areaId, polygon: [[0, 0], [10, 10]] as [number, number][] }],
    })
    expect(r.changed).toBe(false)
    expect(r.results[0].status).toBe('skipped')
    expect(r.results[0].reason).toContain('至少需要 3 个顶点')
  })
})

describe('applyPointEdits · 安全边界', () => {
  it('未知 id 不会被静默忽略', () => {
    const { scene } = baseScene()
    const r = applyPointEdits(scene, {
      move: [{ id: 'missing-id', x: 1, y: 2 }],
      remove: [{ id: 'also-missing' }],
    })
    expect(r.changed).toBe(false)
    expect(r.results).toHaveLength(2)
    for (const result of r.results) {
      expect(result.status).toBe('skipped')
      expect(result.reason).toContain('missing')
    }
  })

  it('空编辑返回明确原因且不改动场景', () => {
    const { scene } = baseScene()
    const r = applyPointEdits(scene, {})
    expect(r.changed).toBe(false)
    expect(r.results).toHaveLength(1)
    expect(r.results[0]).toMatchObject({ action: 'noop', status: 'skipped' })
    expect(pointsOf(r.scene)).toHaveLength(2)
  })

  it('超过单次上限时整批不执行', () => {
    const { scene, pointId } = baseScene()
    const moves = Array.from({ length: MAX_POINT_EDITS + 1 }, () => ({
      id: pointId,
      x: 1,
      y: 1,
    }))
    const r = applyPointEdits(scene, { move: moves })
    expect(r.changed).toBe(false)
    expect(r.results).toHaveLength(1)
    expect(r.results[0].action).toBe('limit')
    expect(r.results[0].reason).toContain(`最多 ${MAX_POINT_EDITS} 条`)
    expect(pointsOf(r.scene).find((p) => p.id === pointId)!.cx).toBeCloseTo(200)
  })

  it('一次调用可组合 update / move / remove / add', () => {
    const { scene, pointId, sensorId, areaId } = baseScene()
    const r = applyPointEdits(scene, {
      update: [{ id: areaId, name: '起居室' }],
      move: [{ id: pointId, dx: 10 }],
      remove: [{ id: sensorId }],
      add: [{ type: 'camera', x: 700, y: 300 }],
    })
    expect(r.changed).toBe(true)
    expect(r.results.filter((x) => x.status === 'ok')).toHaveLength(4)
    expect(areasOf(r.scene)[0].name).toBe('起居室')
    expect(pointsOf(r.scene).map((p) => p.code)).toContain('V1')
    expect(pointsOf(r.scene).map((p) => p.id)).not.toContain(sensorId)
  })
})

describe('summarizePointMap', () => {
  it('返回图纸、房间与点位的可操作 id 和坐标', () => {
    const { scene, sheetId, areaId, pointId } = baseScene()
    const s = summarizePointMap(scene)

    expect(s.counts).toEqual({ sheets: 1, areas: 1, points: 2 })
    expect(s.sheets[0]).toMatchObject({ id: sheetId, name: '一层平面图' })
    expect(s.areas[0]).toMatchObject({
      id: areaId,
      name: '客厅',
      areaType: 'living',
      sheetId,
      polygon: null,
      pointCount: 2,
    })
    const point = s.points.find((p) => p.id === pointId)!
    expect(point).toMatchObject({ code: 'Z1', type: 'socket', x: 200, y: 200, sheetId, roomId: areaId })
    expect(point.name).toContain('Z1')
    expect(s.truncated).toBe(false)
  })

  it('点位超过 maxPoints 时截断并标记', () => {
    const { scene } = baseScene()
    const s = summarizePointMap(scene, { maxPoints: 1 })
    expect(s.points).toHaveLength(1)
    expect(s.truncated).toBe(true)
    expect(s.counts.points).toBe(2)
  })
})
