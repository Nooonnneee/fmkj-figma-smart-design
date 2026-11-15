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

/**
 * 宽高比明显不是方形的灯具（192×48 的弧形落地灯、13×28 的细杆壁灯、8.7×28 的轨道射灯头）
 * 的 CAD 画法：按「目标画幅」另画一套，不把 32×32 的方图例拉伸。
 *
 * 画布落图用 preserveAspectRatio="none"，把方图例塞进 4:1 的框会把圆形灯罩压成飞碟、
 * 把半圆压成蛋形。真实 CAD 图例是按设备实际形状画的：矩形就画矩形、圆就画圆 ——
 * 所以这里按形状族生成图形，模板坐标系宽度固定 100、高度 = 100 × (gh / gw)，
 * 即「画幅本身就已经是目标比例」，拉伸时形状不变形。
 *
 * 按形状族登记，而不是逐个 variant：同一形状族的多个尺寸共用一套画法。
 */
type CadShapeFamily = 'round-head' | 'wall-slim' | 'spot-head' | 'semi-wall' | 'spot'

/**
 * 登记门槛（全量 157 个 variant + 34 个设备类型逐一扫过）：
 *
 * 1. 图例里有圆弧 —— 看该设备类型**实际渲染用的**图元（`LINEAR_CAD` / `CAD`）：
 *    只有 `circle` 和 `A rx ry` 两种；画成矩形 / 直线的图例拉长后仍是矩形 / 直线，
 *    语义没丢，不登记（面板灯、灯带、线性吊灯等）。
 *    不能只看 `CAD[SymbolKey]`：`CAD['track-light']` / `CAD['other-light']` 本身有 circle，
 *    但 track / magnetic-track / magnetic-light / t5 实际走 `LINEAR_CAD`（纯直线，无圆弧）。
 * 2. 落图框偏离画幅超过 10%：`|boxW/boxH ÷ viewBoxW/viewBoxH − 1| > 0.10`。
 *    低于 10% 的椭圆看不出区别，不值得为它另画一套（筒灯 1.2%–1.9%、吊灯 0.5%）。
 *
 * 按这两个门槛，未登记的共 18 个族：
 * - 11 个无圆弧：ceiling-panel、linear-pendant、multi-pendant-linear、pendant、
 *   chandelier、multi-pendant-round、track、magnetic-track、magnetic-light、t5、led-strip；
 * - 7 个有圆弧但偏离 < 10%：downlight-recessed 1.93%、downlight-recessed-square 0%、
 *   downlight-surface 1.23%、downlight-surface-square 0%、ceiling-round 0.82%、
 *   ceiling-square 0%、floor-lamp 0%。
 *
 * 方形筒灯（downlight-recessed-square / downlight-surface-square）用的是
 * `CAD['downlight']` 的「圆 + 十字」，不是矩形 / 直线图例；它们不登记是因为目标框
 * 1×1、偏离 0%，而不是「矩形拉长语义不变」。
 *
 * 已登记的族里有 6 个是补登记的漏网（椭圆化 = 落图框 w/h ÷ 画幅 w/h − 1）：
 *   spot-recessed(-17.3%)、spot-recessed-square(-24.1%)、spot-surface(-16.1%)、
 *   spot-surface-square(-16.1%)、wall-round(-15.9%)、recessed-wall(+16.4% ~ +55.5%)。
 * 其中 recessed-wall 用的是墙上半圆图例（不是矩形），所以按圆弧族处理。
 */
const SHAPE_FAMILY: Record<string, CadShapeFamily> = {
  // 弧形落地灯 4:1：圆形灯罩，拉长会变成飞碟
  'floor-arc-lamp': 'round-head',
  // 竖长壁灯：灯罩是半圆，拉长会变成蛋形
  'wall-slim': 'wall-slim',
  'swing-arm': 'wall-slim',
  vanity: 'wall-slim',
  // 横向壁灯：同样是半圆灯罩
  'wall-half': 'semi-wall',
  picture: 'semi-wall',
  // 圆壁灯 / 嵌入式壁灯：CAD 图例都是「墙面竖线 + 半圆灯罩」，同上
  'wall-round': 'semi-wall',
  'recessed-wall': 'semi-wall',
  // 轨道射灯头 ~1:3.2：圆射灯头，拉长会变成竖向椭圆
  'track-head': 'spot-head',
  // 嵌入式 / 明装射灯（圆形和方形款）：CAD 图例都是「正圆灯头 + 斜向光束」
  'spot-recessed': 'spot',
  'spot-recessed-square': 'spot',
  'spot-surface': 'spot',
  'spot-surface-square': 'spot',
}

const TABLE = CAD as Record<string, CadShape[]>

/** 取一个符号的 CAD 矢量定义；未知键返回 null（调用方退回默认图标） */
export function cadSymbol(key: SymbolKey | string): CadShape[] | null {
  return TABLE[key] ?? null
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

const attrs = (fill?: string, stroke: number = CAD_STROKE_WIDTH) =>
  `fill="${fill ?? 'none'}" stroke="${CAD_STROKE}" stroke-width="${+stroke.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"`

const renderShapes = (shapes: CadShape[], stroke: number = CAD_STROKE_WIDTH) =>
  shapes
    .map((shape) => {
      switch (shape.t) {
        case 'path':
          return `<path d="${esc(shape.d)}" ${attrs(shape.fill, stroke)}/>`
        case 'circle':
          return `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}" ${attrs(shape.fill, stroke)}/>`
        case 'line':
          return `<line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}" ${attrs(undefined, stroke)}/>`
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
 * 按目标画幅比例画一个形状正确的 CAD 图例（template 坐标 100 宽 × (100×gh/gw) 高）。
 * 返回 null 表示这个族没有专用画法，调用方回退方形图例。
 *
 * 画法要点：所有曲线在模板坐标里就是正圆 / 正圆弧（`circle` 或 rx === ry 的 `A`），
 * 而模板画幅本身已经是目标比例，所以落到目标框（等比缩放）后圆仍然是圆。
 * 唯一会被拉长的是直线 —— 那是灯体该有的长度。
 */
function proportionedBody(
  family: CadShapeFamily,
  gw: number,
  gh: number,
): { shapes: CadShape[]; W: number; H: number } | null {
  const W = 100
  const H = (W * gh) / gw
  // 圆半径按短边算，保证整圆不会超出画幅
  const r = Math.min(W, H) * 0.26
  switch (family) {
    case 'round-head': {
      // 弧形落地灯：圆形灯罩 + 落地支杆 + 底座横线。
      // 底座固定在 H 的 90%，支杆从圆底连到座线：H 很小（宽画幅）时也不会出现
      // 零长度支杆或画到画幅外的底座（旧写法 H-6 在 H≤6 时 y 为负）。
      const cx = W / 2
      const cy = Math.min(H * 0.5, W * 0.5)
      const baseY = H * 0.9
      return {
        W,
        H,
        shapes: [
          circle(cx, cy, r),
          line(cx, cy + r, cx, baseY),
          line(W * 0.2, baseY, W * 0.8, baseY),
        ],
      }
    }
    case 'wall-slim': {
      // 细杆壁灯：贴墙竖线 + 半圆灯罩（半径横竖一致，落图后仍是半圆）
      const R = Math.min(W * 0.3, H * 0.12)
      const wallX = W * 0.16
      const top = H * 0.16
      return {
        W,
        H,
        shapes: [
          line(wallX, H * 0.04, wallX, H * 0.96),
          // 以墙上 (wallX, top+R) 为圆心、R 为半径的右半圆：从顶点画弧到低点再闭合
          path(`M${wallX} ${top} A${R} ${R} 0 0 1 ${wallX} ${top + 2 * R} Z`),
          line(wallX + R, top + R, W * 0.92, top + R),
          line(W * 0.92, top + R, W * 0.92, H * 0.9),
        ],
      }
    }
    case 'spot-head': {
      // 轨道射灯头：正圆射灯头 + 上方短轨道
      const cx = W / 2
      const cy = H * 0.62
      return {
        W,
        H,
        shapes: [
          circle(cx, cy, r),
          line(cx, H * 0.16, cx, cy - r),
          line(W * 0.2, H * 0.16, W * 0.8, H * 0.16),
        ],
      }
    }
    case 'semi-wall': {
      // 半圆壁灯：贴墙竖线 + 右半圆灯罩（半径横竖一致）
      const R = Math.min(W, H) * 0.46
      const wallX = W * 0.1
      const cy = H / 2
      return {
        W,
        H,
        shapes: [
          line(wallX, H * 0.04, wallX, H * 0.96),
          path(`M${wallX} ${cy - R} A${R} ${R} 0 0 1 ${wallX} ${cy + R} Z`),
        ],
      }
    }
    case 'spot': {
      // 嵌入式 / 明装射灯：沿用 CAD['spotlight'] 的「正圆灯头 + 斜向光束」，
      // 只按画幅缩放坐标；圆的半径按短边取，落图后仍是正圆。
      //
      // 半径必须用原图例的比例 6/32 = 0.1875（不能用通用的 0.26）：
      // 原图里圆心到光束起点 (17,17)-(12,12) 的距离是 7.07/32 = 0.221 短边，
      // 大于半径 0.1875，所以两束线都从圆外开始。画幅按真实比例拉高（H/W 1.19–1.32）后，
      // 起点距离变成 0.243–0.258 短边；若半径仍取 0.26，第一束线就从圆内穿出，10x 下像放大镜。
      const cx = W * 0.375
      const cy = H * 0.375
      return {
        W,
        H,
        shapes: [
          circle(cx, cy, Math.min(W, H) * 0.1875),
          line(W * 0.531, H * 0.531, W * 0.844, H * 0.844),
          line(W * 0.656, H * 0.469, W * 0.844, H * 0.656),
        ],
      }
    }
    default:
      return null
  }
}

/**
 * 模板坐标里的描边宽度：让「落图后的视觉线宽」与 32×32 图例一致，而不是与模板宽度挂钩。
 *
 * 推导（symbolSize = 28，模板长边落图 28px）：
 * - 32×32 图例的描边 2 落图后 = 2 × 28/32 = 1.75px；
 * - 任意模板的缩放 s = 28 / max(W,H)。要落图 1.75px：stroke × s = 1.75
 *   → stroke = 1.75 × max(W,H) / 28 = max(W,H) / 16。
 *   模板 100 宽、高度 ≤ 100（横向族）时 = 6.25，正是「100 宽对应 28px」的换算。
 * - 极端比例把线宽夹在短边的 40%（= 短边/2.5）：
 *   · gh/gw=0.05（100×5）：目标 6.25 会让线宽超过画幅，夹到 2（落图 0.56px，占 H 的 40%），
 *     与修复前 CAD_STROKE_WIDTH=2 的落图宽度完全相同；
 *   · gh/gw=20（100×2000）：旧上界短边/2 落 0.7px，新上界 40 落 0.56px；仍高于旧下界
 *     max/64 单独作用时的 0.44px，不会消失。
 *   这条上界只在短边 < 长边 × 5/32（0.15625）时生效；已登记族最扁的是画灯 90×16
 *   （0.1778），所以全部仍按 max/16 落 1.75px，不受影响。
 *   旧写法还有一条下界 max/64，但它恒小于目标值 max/16（目标 = 4 × 下界），
 *   从来没有生效过，删除不改变任何输出。
 *   注意：短边/长边 < 1/22.4 时，40% 上界的落图线宽会低于 0.5px（100:1 时 0.11px）——
 *   28px 长的框此时不到 1.25px 高，无法同时满足「≤ 短边 40%」和「≥ 0.5px」。
 *   已登记族的实际比例最大 5.625:1（画灯 90×16），离这个区间很远。
 */
function strokeFor(W: number, H: number) {
  return Math.min(Math.max(W, H) / 16, Math.min(W, H) / 2.5)
}

/**
 * 由宽高比找形状族。`family` 是灯光款式所属的 family.id（look.ts 传下来），
 * 只有登记过的族才会出按比例画的图例。
 */
export function cadProportionedBody(
  familyId: string,
  gw: number,
  gh: number,
): { body: string; viewBox: string } | null {
  const family = SHAPE_FAMILY[familyId]
  if (!family) return null
  const art = proportionedBody(family, gw, gh)
  if (!art) return null
  const fmt = (n: number) => +n.toFixed(3)
  return {
    body: renderShapes(art.shapes, strokeFor(art.W, art.H)),
    viewBox: `0 0 ${fmt(art.W)} ${fmt(art.H)}`,
  }
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
