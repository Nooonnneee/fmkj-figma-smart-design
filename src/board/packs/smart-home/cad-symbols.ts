/**
 * CAD 图标风格：按电气图例（国标 GB/T 4728 的常用画法）用矢量画的设备符号。
 *
 * 纯代码、无位图：每个符号是一组 32×32 viewBox 里的 path / circle / line，
 * 由画布、图例和 PNG 导出共用（导出时整段 SVG 内联成 data URL 再交给浏览器栅格化）。
 * 线宽统一 2，深灰描边、透明填充，叠在 CAD 底图上仍清晰。
 *
 * 覆盖 lib/device-types.ts 里的全部 SymbolKey，共 30 个；新增设备类型时在这里补画一个。
 */
import type { SymbolKey } from '@/lib/device-types'

/** CAD 符号的统一画法（画布嵌入与独立 SVG 导出都用这套值） */
export const CAD_VIEW_BOX = '0 0 32 32'
export const CAD_STROKE = '#1f2937'
export const CAD_STROKE_WIDTH = 2

/** 一段图元：path 的 d、圆、或线段 */
type CadShape =
  | { t: 'path'; d: string; fill?: string }
  | { t: 'circle'; cx: number; cy: number; r: number; fill?: string }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number }

/** 绘图用的简写 */
const circle = (cx: number, cy: number, r: number, fill = 'none'): CadShape => ({
  t: 'circle',
  cx,
  cy,
  r,
  fill,
})
const line = (x1: number, y1: number, x2: number, y2: number): CadShape => ({
  t: 'line',
  x1,
  y1,
  x2,
  y2,
})
const path = (d: string, fill = 'none'): CadShape => ({ t: 'path', d, fill })

/** 开关按键：方框里的一根斜杠，键数决定斜杠根数（电气图里的单极 / 多极画法） */
const keyMarks = (n: number): CadShape[] => {
  if (n <= 1) return [path('M9 22 L23 10')]
  const step = 14 / (n - 1)
  return Array.from({ length: n }, (_, i) => {
    const x = 9 + i * step
    return path(`M${x} 22 L${x + 5} 17`)
  })
}

/** 传感器：方框 + 中心的量测记号 */
const sensorBox = (mark: string): CadShape[] => [
  path('M6 6 H26 V26 H6 Z'),
  ...(mark ? [path(mark)] : []),
]

const CAD: Record<SymbolKey, CadShape[]> = {
  // 单极开关：方框 + 一根斜杠（旧版点位图是彩色方块，这里是纯线稿）
  switch: [path('M6 6 H26 V26 H6 Z'), ...keyMarks(1)],

  // 五孔插座：半圆（插孔）+ 中间竖杠（接地）
  socket: [path('M6 22 A10 10 0 0 1 26 22'), line(6, 22, 26, 22), line(16, 8, 16, 22)],
  // 双插：两个并排半圆
  'socket-double': [
    path('M4 22 A6 6 0 0 1 16 22'),
    path('M16 22 A6 6 0 0 1 28 22'),
    line(4, 22, 28, 22),
  ],
  // USB 插座：半圆 + 方头（USB 口）
  'socket-usb': [
    path('M6 24 A10 10 0 0 1 26 24'),
    line(6, 24, 26, 24),
    path('M12 10 H20 V16 H12 Z'),
    line(16, 16, 16, 20),
  ],

  // 筒灯：圆 + 十字（嵌入式灯具的标准画法）
  downlight: [circle(16, 16, 10), line(6, 16, 26, 16), line(16, 6, 16, 26)],
  // 射灯：圆 + 一道斜向光束
  spotlight: [circle(12, 12, 6), line(17, 17, 27, 27), line(21, 15, 27, 21)],
  // 轨道灯：一条长轨 + 两个下垂灯具
  'track-light': [
    line(3, 9, 29, 9),
    line(10, 9, 10, 17),
    circle(10, 22, 4),
    line(22, 9, 22, 17),
    circle(22, 22, 4),
  ],
  // 吸顶灯：圆 + 四向短刻度
  'ceiling-light': [
    circle(16, 16, 9),
    line(16, 3, 16, 7),
    line(16, 25, 16, 29),
    line(3, 16, 7, 16),
    line(25, 16, 29, 16),
  ],
  // 吊灯：细线吊装 + 梯形灯罩
  'pendant-light': [line(16, 3, 16, 14), path('M8 14 H24 L20 25 H12 Z'), line(12, 25, 20, 25)],
  // 壁灯：墙面竖线 + 半圆灯罩（贴着墙安装）
  'wall-light': [line(6, 4, 6, 28), path('M6 10 H22 A8 8 0 0 1 6 26 Z')],
  // 面板灯：矩形 + 对角标识
  'panel-light': [path('M4 9 H28 V23 H4 Z'), line(4, 9, 28, 23)],
  // 灯带：一条长线，两端带端头（线性灯具）
  'light-strip': [line(3, 16, 29, 16), line(3, 12, 3, 20), line(29, 12, 29, 20)],
  // 其他灯具：灯泡（圆 + 灯座）
  'other-light': [circle(16, 13, 8), path('M11 21 H21 V25 H11 Z'), line(13, 27, 19, 27)],

  // 中控屏：矩形屏幕 + 四角括号（触控区）
  'touch-panel': [
    path('M5 6 H27 V26 H5 Z'),
    path('M9 10 H12 M9 10 V13'),
    path('M23 22 H20 M23 22 V19'),
  ],
  // 门磁：两个分离的磁块 + 中间感应弧
  'contact-sensor': [
    path('M4 12 H12 V20 H4 Z'),
    path('M28 12 H20 V20 H28 Z'),
    path('M14 16 A2 2 0 0 1 18 16'),
  ],
  // 人体传感器：PIR 人形标记（头 + 身体）在方框里
  'motion-sensor': [...sensorBox(''), circle(16, 11, 3), path('M16 14 V22 L11 27 M16 22 L21 27')],
  // 烟雾传感器：方框 + 中心圆 + 三条向上散开的烟线
  'smoke-sensor': [...sensorBox(''), circle(16, 18, 4), path('M16 12 V8 M11 13 V10 M21 13 V10')],
  // 水浸传感器：方框 + 波浪线
  'water-sensor': [...sensorBox(''), path('M6 18 Q9 14 12 18 T18 18 T24 18')],
  // 温湿度传感器：方框 + 温度计（竖杆 + 球）
  'temp-sensor': [...sensorBox(''), line(16, 8, 16, 19), circle(16, 22, 3)],
  // 智能门锁：锁体方框 + 锁梁
  lock: [path('M8 16 H24 V27 H8 Z'), path('M12 16 V11 A4 4 0 0 1 20 11 V16'), circle(16, 21, 2)],
  // 门铃：半圆屋顶 + 按键圆
  doorbell: [path('M8 25 V14 A8 8 0 0 1 24 14 V25 Z'), circle(16, 18, 2.5)],
  // 摄像头：机身矩形 + 镜头圆 + 安装支架
  camera: [path('M5 10 H21 V20 H5 Z'), circle(24, 16, 4), line(5, 15, 3, 26)],
  // 窗帘：顶轨 + 两片帘布
  curtain: [line(3, 7, 29, 7), path('M8 7 V26 M24 7 V26'), path('M8 12 H4 M24 12 H28')],
  // 网关：两个互相指向的箭头（数据中继）
  hub: [path('M6 10 H20 M15 5 L20 10 L15 15'), path('M26 22 H12 M17 17 L12 22 L17 27')],
  // 智能音箱：圆柱外形 + 声波弧
  speaker: [path('M10 8 H22 V26 H10 Z'), path('M24 12 A6 6 0 0 1 24 20'), line(13, 20, 19, 20)],
  // 路由器：机身 + 两根天线 + 中间信号杆
  router: [
    path('M5 20 H27 V26 H5 Z'),
    line(9, 20, 6, 8),
    line(23, 20, 26, 8),
    line(16, 20, 16, 11),
  ],
  // AP / mesh：节点 + 三个方向的连线（组网）
  mesh: [circle(16, 16, 4), line(16, 12, 16, 5), line(12, 18, 6, 24), line(20, 18, 26, 24)],
  // 网络面板：方框 + RJ45 口（里宽外窄的梯形）
  data: [path('M5 7 H27 V25 H5 Z'), path('M11 11 H21 L19 16 H13 Z'), line(13, 21, 19, 21)],
  // VRF 控制器：方框 + 风叶（三片）
  'ac-wall': [
    path('M5 8 H27 V24 H5 Z'),
    line(16, 16, 16, 10),
    line(16, 16, 11, 19),
    line(16, 16, 21, 19),
  ],
  // 其他设备：方框 + 问号（未知设备）
  other: [path('M6 6 H26 V26 H6 Z'), path('M13 13 A3 3 0 1 1 19 13 Q19 16 16 17 V19')],
}

/**
 * 线形灯具（灯带 / 轨道灯 / T5 灯管）的 CAD 画法：按细长画面另画一套。
 *
 * 这几类设备在图上本来就是一条线（真实尺寸下 2 米轨道只有几厘米宽），
 * 如果沿用 32×32 的方形图例再塞进细长框，要么缩成一个小徽标、要么被拉成碎片。
 * 这里用 160×6 的 viewBox 画「一条要装满整根灯的线」：两端端头 + 均匀的分段刻度。
 */
const LINEAR_VIEW_BOX = '0 0 160 6'
const LINEAR_CAD: Record<'track-light' | 'light-strip' | 'other-light', CadShape[]> = {
  // 轨道灯：上下两条细轨 + 均匀的灯具刻痕
  'track-light': [
    line(2, 1, 158, 1),
    line(2, 5, 158, 5),
    ...Array.from({ length: 7 }, (_, i) => line(16 + i * 21, 0, 16 + i * 21, 6)),
  ],
  // 灯带：一条线 + 密排短刻度（线性光源）
  'light-strip': [
    line(2, 3, 158, 3),
    ...Array.from({ length: 17 }, (_, i) => line(8 + i * 9, 1.4, 8 + i * 9, 4.6)),
  ],
  // T5 灯管 / 其他线性灯具：灯管两端 + 中间灯丝
  'other-light': [line(2, 2, 158, 2), line(2, 4, 158, 4), line(2, 1, 2, 5), line(158, 1, 158, 5)],
}

const LINEAR_TABLE = LINEAR_CAD as Record<string, CadShape[]>

const TABLE = CAD as Record<string, CadShape[]>

/** 取一个符号的 CAD 矢量定义；未知键返回 null（调用方退回默认图标） */
export function cadSymbol(key: SymbolKey | string): CadShape[] | null {
  return TABLE[key] ?? null
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

const attrs = (fill?: string) =>
  `fill="${fill ?? 'none'}" stroke="${CAD_STROKE}" stroke-width="${CAD_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round"`

const renderShapes = (shapes: CadShape[]) =>
  shapes
    .map((shape) => {
      switch (shape.t) {
        case 'path':
          return `<path d="${esc(shape.d)}" ${attrs(shape.fill)}/>`
        case 'circle':
          return `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}" ${attrs(shape.fill)}/>`
        case 'line':
          return `<line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}" ${attrs()}/>`
      }
    })
    .join('')

/**
 * 只出 SVG 内部图元（画布已经在外层 <svg> 里，省一层嵌套和重复的 xmlns）。
 * 每个图元都带自己的描边属性，插进任何 <g> 都成立。
 */
export function cadSymbolBody(key: SymbolKey | string): string {
  const shapes = cadSymbol(key)
  return shapes ? renderShapes(shapes) : ''
}

/**
 * 按设备类型出图元：开关按「键数」决定斜杠根数（单开 1 根、四开 4 根），其余按符号键。
 * 这样 switch-1 / switch-2 在 CAD 风格下也能分辨。
 */
export function cadSymbolBodyForKey(key: SymbolKey | string, switchKeys?: number): string {
  if (key === 'switch' && switchKeys && switchKeys > 1)
    return renderShapes([path('M6 6 H26 V26 H6 Z'), ...keyMarks(switchKeys)])
  return cadSymbolBody(key)
}

/** 线性灯具的细长矢量图元（没有就返回空串） */
export function cadLinearBody(key: SymbolKey | string): string {
  const shapes = LINEAR_TABLE[key]
  return shapes ? renderShapes(shapes) : ''
}

/**
 * 图元 + 它自己的 viewBox：普通符号 32×32，线性灯具 160×6。
 *
 * `linear` 必须由调用方按「这个点位落图后的比例」决定（look.ts 的 isLineGeom），不能只看
 * 符号键：track-light / light-strip / other-light 三个键同时被真线形灯具和落地灯、弧形落地灯、
 * 轨道射灯头、LED 灯带共用，按键选细长画面会把落地灯画成 26:1 的一条线。
 */
export function cadArtFor(
  key: SymbolKey | string,
  switchKeys?: number,
  linear = false,
): { body: string; viewBox: string } | null {
  const slender = linear ? cadLinearBody(key) : ''
  if (slender) return { body: slender, viewBox: LINEAR_VIEW_BOX }
  const body = cadSymbolBodyForKey(key, switchKeys)
  return body ? { body, viewBox: CAD_VIEW_BOX } : null
}

/**
 * 完整的内联 SVG（导出用）：自带 xmlns 与 viewBox，可直接当 data URL 交给浏览器栅格化。
 * 导出路径不能直接插 <g>，因为 PNG 是通过 <image> 画进主 SVG 的。
 */
export function cadSymbolSvg(key: SymbolKey | string, switchKeys?: number): string | null {
  const art = cadArtFor(key, switchKeys)
  if (!art) return null
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${art.viewBox}">${art.body}</svg>`
}

/** 全部 CAD 符号的键（测试用：必须覆盖 SymbolKey 全集） */
export const CAD_SYMBOL_KEYS = Object.keys(CAD)
