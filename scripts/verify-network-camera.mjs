/** Run with Node 24: node scripts/verify-network-camera.mjs. No backend reads or writes. */
import nodeAssert from 'node:assert/strict'

import { buildNetworkCamera } from '../src/plugins/proposal/deck/network-camera.ts'

let checks = 0
const assert = new Proxy(nodeAssert, {
  get(target, key) {
    const value = target[key]
    return typeof value === 'function' ? (...args) => { checks++; return Reflect.apply(value, target, args) } : value
  },
})

const sheets = [
  { sheet: { id: 'f1', name: '一层平面' }, floorName: '一层' },
  { sheet: { id: 'f2', name: '二层平面' }, floorName: '二层' },
]
const areas = [
  { id: 'r1', name: '客厅', sheetId: 'f1' },
  { id: 'r2', name: '客厅', sheetId: 'f2' },
]
const point = (id, deviceType, patch = {}) => ({
  id, deviceType, sheetId: 'f1', areaId: 'r1', code: id, productId: null, source: 'pending',
  cx: 100, cy: 100, rx: 0.1, ry: 0.1, ref: null, ...patch,
})
const item = (ref, deviceType, patch = {}) => ({ ref, deviceType, name: ref, count: 1, price: 100, ...patch })
const model = (points, items = []) => ({
  d: { points, areas }, sheets, items,
  deckPoint: (p) => ({ ...p, no: 1, room: '客厅', typeName: p.deviceType }),
})
const freeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) freeze(child)
  }
  return value
}

assert.equal(buildNetworkCamera(model([])), null)
assert.equal(buildNetworkCamera(model([point('N1', 'ap-node')])), null)
assert.equal(buildNetworkCamera(model([point('V1', 'camera')])), null)
assert.equal(buildNetworkCamera(model([point('N1', 'ap-node'), point('B1', 'doorbell')])), null)
assert.equal(buildNetworkCamera(model([point('G1', 'gateway'), point('V1', 'camera')])), null)
assert.equal(buildNetworkCamera(model([point('N1', 'ap-node')], [item('Q1', 'camera')])), null)

const allTypes = [point('N1', 'ac-router'), point('N2', 'ap-node'), point('N3', 'ceiling-ap'), point('N4', 'network-panel'), point('V1', 'camera'), point('B1', 'doorbell'), point('G1', 'gateway')]
const all = buildNetworkCamera(model(allTypes))
assert.equal(all.networkPoints.length, 4)
assert.equal(all.cameraPoints.length, 1)
assert.deepEqual(all.apPoints.map((p) => p.code), ['N2', 'N3'])
assert.deepEqual(all.corePoints.map((p) => p.code), ['N1', 'N4'])
assert.deepEqual(all.rooms.flatMap((r) => r.points).map((p) => p.code), ['N1', 'N2', 'N3', 'N4', 'V1'])

// Same room names on different floors must not merge. Unassigned and unmapped points stay visible.
const points = [
  point('V2', 'camera', { sheetId: 'f2', areaId: 'r2', ref: 'Q2' }),
  point('N1', 'ap-node', { ref: 'Q1' }),
  point('V1', 'camera', { ref: 'Q2' }),
  point('N2', 'ceiling-ap', { sheetId: 'f2', areaId: 'r2', ref: 'Q1' }),
  point('N3', 'network-panel', { areaId: null }),
  point('V3', 'camera', { sheetId: null, areaId: null }),
  point('N4', 'ac-router', { sheetId: 'missing-sheet', areaId: null }),
]
const items = [item('Q1', 'ap-node', { name: '报价快照 AP', sku: 'SNAPSHOT-AP', price: 675 }), item('Q2', 'camera', { name: '报价快照摄像头', sku: 'SNAPSHOT-CAMERA' }), item('Q3', 'camera'), item('Q4', 'downlight')]
const input = freeze(model(points, items))
const before = JSON.stringify(input)
const result = buildNetworkCamera(input)
assert.equal(result.rooms.length, 5)
assert.equal(new Set(result.rooms.map((r) => r.key)).size, 5)
assert.deepEqual(result.rooms.filter((r) => r.name === '客厅').map((r) => [r.floorName, r.networkPoints.length, r.cameraPoints.length]), [['一层', 1, 1], ['二层', 1, 1]])
assert.equal(result.rooms.find((r) => r.sheetId === 'f1' && r.areaId === null).name, '未分区')
assert.equal(result.rooms.find((r) => r.sheetId === null).floorName, '未上图')
assert.equal(result.rooms.find((r) => r.sheetId === 'missing-sheet').floorName, '未上图')
assert.deepEqual(result.unmappedPoints.map((p) => p.code), ['V3', 'N4'])
assert.deepEqual(result.sheets.map((s) => [s.floorName, s.points.length]), [['一层', 3], ['二层', 2]])
assert.equal(result.networkPoints.length + result.cameraPoints.length, points.length)
assert.equal(result.rooms.flatMap((r) => r.points).length, points.length)
assert.equal(new Set(result.rooms.flatMap((r) => r.points.map((p) => p.id))).size, points.length)
assert.deepEqual(result.items.map((i) => i.ref), ['Q1', 'Q2'])
assert.equal(result.items[0].name, '报价快照 AP')
assert.equal(result.items[0].price, 675)
assert.equal(JSON.stringify(input), before)

const wrongArea = buildNetworkCamera(model([point('N1', 'ap-node', { areaId: 'r2' }), point('V1', 'camera', { areaId: 'r2' })]))
assert.equal(wrongArea.rooms[0].name, '未分区')
const wrongItem = buildNetworkCamera(model([point('N1', 'ap-node', { ref: 'Q4' }), point('V1', 'camera')], items))
assert.deepEqual(wrongItem.items, [])
assert.equal(wrongItem.networkPoints[0].productId, null)
assert.equal(wrongItem.cameraPoints[0].ref, null)

console.log(`PASS ${checks} assertions: network+camera matching, excluded device types, floor/area identity, unmapped points, complete counts/codes, quote-only product references and immutable inputs`)
