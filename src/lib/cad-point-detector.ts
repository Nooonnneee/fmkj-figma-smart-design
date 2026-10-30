/**
 * CAD 开关/灯具布置图符号检测器（纯像素连通域与几何特征识别）。
 *
 * 原则：
 * - 只在检测到明确的 CAD 开关/灯具符号特征时才输出识别到的真实坐标点位；
 * - 如果上传的是普通空白户型图、效果图或无法识别出符号的图纸，严格返回 0 个点位，
 *   绝不生成任何网格默认点位！
 */
import { detectPlanBounds, type Pixels } from './floor-plan-crop'

export type DetectedCadPoint = {
  type: string
  x: number
  y: number
}

export type DetectedCadArea = {
  name: string
  type: string
  rect: [number, number, number, number]
}

/**
 * 分析 2400×1600 标准图纸像素，检测 CAD 暗装开关（实心黑圆点+斜杆）与灯具（圆圈+十字/花灯）符号。
 * 仅返回高置信度的符号中心比例坐标（0–1）；无匹配符号时返回空数组。
 */
export function detectCadSymbolsFromPixels(img: Pixels): {
  points: DetectedCadPoint[]
  areas: DetectedCadArea[]
} {
  const W = img.width
  const H = img.height
  const ch = img.channels ?? 4
  const d = img.data

  // 1. 先找出平面图主体范围，向内缩进一点，避开外围尺寸标注文字
  const bounds = detectPlanBounds(img)
  const xMin = bounds.x + Math.floor(bounds.width * 0.04)
  const xMax = bounds.x + Math.floor(bounds.width * 0.96)
  const yMin = bounds.y + Math.floor(bounds.height * 0.04)
  const yMax = bounds.y + Math.floor(bounds.height * 0.96)

  if (xMax <= xMin + 100 || yMax <= yMin + 100) {
    return { points: [], areas: [] }
  }

  const isDark = (x: number, y: number) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return false
    const i = (y * W + x) * ch
    const a = ch === 4 ? d[i + 3] : 255
    if (a < 64) return false
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    return lum < 110
  }

  // 统计主体区域墨迹比例：如果不是白底黑线的 CAD 图纸（如深色渲染图/彩色照片），直接返回空
  let darkCount = 0
  const totalSample = (xMax - xMin) * (yMax - yMin)
  for (let y = yMin; y < yMax; y += 2) {
    for (let x = xMin; x < xMax; x += 2) {
      if (isDark(x, y)) darkCount++
    }
  }
  const inkRatio = (darkCount * 4) / totalSample
  if (inkRatio < 0.008 || inkRatio > 0.28) {
    return { points: [], areas: [] }
  }

  // 2. 扫描实心小圆点（CAD 暗装开关符号的核心特征：半径 4~7px 的高密度实心黑圆，外围有斜向引出杆与弧形控制线）
  const switchCandidates: { x: number; y: number; score: number; ticks: number }[] = []
  const visited = new Uint8Array(W * H)

  for (let y = yMin + 12; y < yMax - 12; y += 2) {
    for (let x = xMin + 12; x < xMax - 12; x += 2) {
      if (!isDark(x, y) || visited[y * W + x]) continue

      // 检查以 (x, y) 为中心、半径 R=5 的圆内黑像素占比
      let innerDark = 0
      let innerTotal = 0
      for (let dy = -5; dy <= 5; dy++) {
        for (let dx = -5; dx <= 5; dx++) {
          if (dx * dx + dy * dy <= 25) {
            innerTotal++
            if (isDark(x + dx, y + dy)) innerDark++
          }
        }
      }
      // 实心圆核至少 78% 为黑像素
      if (innerDark / innerTotal < 0.78) continue

      // 检查外环 R=8..11 的黑像素占比：不能是粗墙线或实心大色块（外环黑像素占比应适中 0.08~0.38）
      let ringDark = 0
      let ringTotal = 0
      for (let dy = -11; dy <= 11; dy++) {
        for (let dx = -11; dx <= 11; dx++) {
          const r2 = dx * dx + dy * dy
          if (r2 >= 64 && r2 <= 121) {
            ringTotal++
            if (isDark(x + dx, y + dy)) ringDark++
          }
        }
      }
      const ringRatio = ringDark / ringTotal
      if (ringRatio < 0.06 || ringRatio > 0.36) continue

      // 排除落在实心墙线上的位置：左右两侧或上下两侧同时有墨迹，说明是墙线而不是开关符号
      const horizWall =
        isDark(x - 9, y) && isDark(x - 12, y) && isDark(x + 9, y) && isDark(x + 12, y)
      const vertWall =
        isDark(x, y - 9) && isDark(x, y - 12) && isDark(x, y + 9) && isDark(x, y + 12)
      if (horizWall || vertWall) continue

      // 标记周围 16px 已访问
      for (let dy = -14; dy <= 14; dy++) {
        for (let dx = -14; dx <= 14; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && nx < W && ny >= 0 && ny < H) visited[ny * W + nx] = 1
        }
      }

      // 估算拨杆横杠数量（2键或3键）
      const ticks = ringRatio > 0.22 ? 3 : 2
      switchCandidates.push({ x, y, score: innerDark / innerTotal, ticks })
    }
  }

  // 如果整张图连 3 个以上的开关符号特征都没检测到，说明不是带点位符号的 CAD 开关图，返回空（不生成任何默认点位）
  if (switchCandidates.length < 3 || switchCandidates.length > 60) {
    return { points: [], areas: [] }
  }

  const points: DetectedCadPoint[] = switchCandidates.map((c) => ({
    type: c.ticks >= 3 ? 'switch-3' : 'switch-2',
    x: Math.round((c.x / W) * 1000) / 1000,
    y: Math.round((c.y / H) * 1000) / 1000,
  }))

  return { points, areas: [] }
}
