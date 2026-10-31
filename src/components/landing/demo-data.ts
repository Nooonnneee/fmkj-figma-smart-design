/**
 * 首页插画用的示意数据：一套户型的房间与点位、一份示例报价。
 * 只用于营销页展示，不读写数据库。服务端与客户端组件共用，所以不能放进 'use client' 文件。
 */
import { categoryOfType, DEVICE_CATEGORIES } from '@/lib/device-types'

/** 户型图画布尺寸（SVG viewBox） */
export const PLAN_W = 800
export const PLAN_H = 500

/** 房间矩形与标注位置（lx / ly 为房间名所在位置） */
export type PlanRoom = { name: string; area?: string; x: number; y: number; w: number; h: number; lx: number; ly: number; accent?: boolean }

export const PLAN_ROOMS: PlanRoom[] = [
  { name: '主卧', area: '16.8㎡', x: 20, y: 20, w: 250, h: 200, lx: 130, ly: 192 },
  { name: '主卫', x: 270, y: 20, w: 100, h: 110, lx: 305, ly: 104 },
  { name: '衣帽间', x: 270, y: 130, w: 100, h: 90, lx: 320, ly: 196 },
  { name: '次卧', area: '12.6㎡', x: 370, y: 20, w: 190, h: 200, lx: 470, ly: 192 },
  { name: '书房', area: '13.2㎡', x: 560, y: 20, w: 220, h: 200, lx: 670, ly: 192 },
  { name: '厨房', x: 20, y: 220, w: 180, h: 150, lx: 150, ly: 356 },
  { name: '卫生间', x: 20, y: 370, w: 180, h: 110, lx: 64, ly: 404 },
  { name: '餐厅', x: 200, y: 220, w: 200, h: 160, lx: 300, ly: 366 },
  { name: '玄关', x: 200, y: 380, w: 200, h: 100, lx: 300, ly: 432 },
  { name: '客厅', area: '32.5㎡', x: 400, y: 220, w: 380, h: 190, lx: 448, ly: 332, accent: true },
  { name: '阳台', x: 400, y: 410, w: 380, h: 70, lx: 610, ly: 452 },
]

/** [设备类型, x, y]，坐标与户型图画布一致 */
const RAW_POINTS: [string, number, number][] = [
  // 主卧
  ['ceiling-light', 130, 120],
  ['downlight', 56, 56],
  ['downlight', 214, 56],
  ['curtain-track', 130, 34],
  ['switch-2', 256, 196],
  ['socket-double', 34, 150],
  ['temp-sensor', 252, 120],
  // 主卫、衣帽间
  ['downlight', 345, 48],
  ['water-sensor', 350, 112],
  ['light-strip', 320, 150],
  // 次卧
  ['ceiling-light', 470, 125],
  ['curtain-track', 470, 34],
  ['switch-1', 436, 204],
  ['socket', 546, 150],
  // 书房
  ['curtain-track', 670, 32],
  ['spotlight', 610, 120],
  ['spotlight', 730, 120],
  ['ap-node', 764, 64],
  ['switch-2', 626, 204],
  ['light-strip', 670, 160],
  // 厨房、卫生间
  ['smoke-sensor', 120, 272],
  ['downlight', 110, 318],
  ['socket-usb', 184, 262],
  ['water-sensor', 64, 352],
  ['motion-sensor', 120, 400],
  ['water-sensor', 176, 462],
  // 餐厅、玄关
  ['pendant-light', 300, 300],
  ['spotlight', 230, 245],
  ['spotlight', 370, 245],
  ['switch-3', 386, 300],
  ['camera', 214, 394],
  ['switch-4', 236, 450],
  ['smart-lock', 322, 466],
  // 客厅、阳台
  ['gateway', 585, 307],
  ['touch-panel', 414, 300],
  ['downlight', 450, 250],
  ['downlight', 735, 250],
  ['downlight', 450, 392],
  ['downlight', 735, 392],
  ['light-strip', 590, 236],
  ['speaker', 500, 300],
  ['speaker', 680, 300],
  ['vrf-controller', 764, 236],
  ['ap-node', 764, 330],
  ['curtain-track', 590, 404],
  ['wall-light', 520, 445],
  ['camera', 700, 445],
]

export type PlanPoint = { id: string; type: string; x: number; y: number; code: string; category: string }

/** 点位：代号按「类别代码 + 序号」自动编号，与点位图画布的规则一致 */
export const PLAN_POINTS: PlanPoint[] = (() => {
  const seq = new Map<string, number>()
  return RAW_POINTS.map(([type, x, y], i) => {
    const category = categoryOfType(type)
    const prefix = category?.code ?? 'Q'
    const n = (seq.get(prefix) ?? 0) + 1
    seq.set(prefix, n)
    return { id: `pt-${i}`, type, x, y, code: `${prefix}${String(n).padStart(2, '0')}`, category: category?.slug ?? 'other' }
  })
})()

export type PlanCategory = { slug: string; name: string; count: number; sampleType: string }

/** 按设备类别汇总点位（顺序与设备类别一致），图例和设备面板共用 */
export function planCategories(points: PlanPoint[] = PLAN_POINTS): PlanCategory[] {
  return DEVICE_CATEGORIES.flatMap((c) => {
    const list = points.filter((p) => p.category === c.slug)
    return list.length ? [{ slug: c.slug, name: c.name, count: list.length, sampleType: list[0]?.type ?? 'other' }] : []
  })
}

export type DemoQuoteItem = { type: string; name: string; sku: string; unit: string; price: number; qty: number }

/** 示例报价：首页的报价单样张、浮动卡片和选型示意共用，金额由明细自动汇总 */
export const DEMO_QUOTE = {
  number: 'BJ20261031-01',
  title: '湖山赋 全屋智能整装报价',
  subtitle: 'A区 12栋 · 三层联排别墅 · 米家生态',
  customer: '林先生',
  project: '湖山赋 A区 12栋',
  platform: '米家',
  items: [
    { type: 'switch-3', name: '智能开关 三键 · 零火版', sku: 'K3-ZF', unit: '个', price: 149, qty: 9 },
    { type: 'downlight', name: '自然光筒灯 · 调光调色', sku: 'DL-08', unit: '盏', price: 199, qty: 24 },
    { type: 'curtain-track', name: '智能开合帘电机 + 轨道', sku: 'CT-L3', unit: '套', price: 399, qty: 4 },
    { type: 'motion-sensor', name: '人在传感器 · 毫米波', sku: 'MS-ES3', unit: '个', price: 90, qty: 6 },
    { type: 'touch-panel', name: '智能中控屏', sku: 'TP-08', unit: '台', price: 438, qty: 1 },
    { type: 'gateway', name: '多模中枢网关', sku: 'GW-M2', unit: '台', price: 314, qty: 1 },
    { type: 'ap-node', name: 'Wi-Fi 7 面板 AP', sku: 'AP-172', unit: '台', price: 675, qty: 6 },
    { type: 'smart-lock', name: '人脸识别智能门锁', sku: 'LK-F1', unit: '把', price: 1999, qty: 1 },
  ] satisfies DemoQuoteItem[],
  fees: [{ name: '安装调试费', amount: 1200 }],
  discount: 254,
}

const productTotal = DEMO_QUOTE.items.reduce((sum, item) => sum + item.price * item.qty, 0)
const feeTotal = DEMO_QUOTE.fees.reduce((sum, fee) => sum + fee.amount, 0)

export const DEMO_QUOTE_TOTALS = {
  productTotal,
  feeTotal,
  discount: DEMO_QUOTE.discount,
  total: productTotal + feeTotal - DEMO_QUOTE.discount,
}
