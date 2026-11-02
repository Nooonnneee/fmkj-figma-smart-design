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

  // 判断背景是白底还是深色底（部分 CAD 导出图为黑底白线）
  let lumSum = 0
  let lumSamples = 0
  for (let y = yMin; y < yMax; y += 8) {
    for (let x = xMin; x < xMax; x += 8) {
      const i = (y * W + x) * ch
      if (ch === 4 && d[i + 3] < 64) continue
      lumSum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      lumSamples++
    }
  }
  const avgLum = lumSamples > 0 ? lumSum / lumSamples : 255
  const darkBg = avgLum < 90

  const isDark = (x: number, y: number) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return false
    const i = (y * W + x) * ch
    const a = ch === 4 ? d[i + 3] : 255
    if (a < 64) return false
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    return darkBg ? lum > 145 : lum < 155
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
  if (inkRatio < 0.005 || inkRatio > 0.35) {
    return { points: [], areas: [] }
  }

  const candidates: { x: number; y: number; type: string }[] = []
  const visited = new Uint8Array(W * H)

  const markVisited = (cx: number, cy: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = cx + dx
        const ny = cy + dy
        if (nx >= 0 && nx < W && ny >= 0 && ny < H) visited[ny * W + nx] = 1
      }
    }
  }

  // 2. 先扫描高饱和度彩色点位标记（针对彩色 CAD 电气图或已标色点位图）
  for (let y = yMin + 14; y < yMax - 14; y += 2) {
    for (let x = xMin + 14; x < xMax - 14; x += 2) {
      if (visited[y * W + x]) continue
      const i = (y * W + x) * ch
      if (ch === 4 && d[i + 3] < 128) continue
      const r = d[i]
      const g = d[i + 1]
      const b = d[i + 2]
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      if (max < 85 || max - min < 65) continue
      const sat = (max - min) / max
      if (sat < 0.38) continue

      // 检查 7px 半径内是否构成紧凑彩色圆斑，且外围 16px 不是大面积彩色底块
      let colorInner = 0
      let colorOuter = 0
      for (let dy = -15; dy <= 15; dy += 2) {
        for (let dx = -15; dx <= 15; dx += 2) {
          const idx = ((y + dy) * W + (x + dx)) * ch
          const mx = Math.max(d[idx], d[idx + 1], d[idx + 2])
          const mn = Math.min(d[idx], d[idx + 1], d[idx + 2])
          const isCol = mx >= 80 && mx - mn >= 55
          const r2 = dx * dx + dy * dy
          if (r2 <= 49 && isCol) colorInner++
          else if (r2 >= 144 && r2 <= 225 && isCol) colorOuter++
        }
      }
      if (colorInner >= 10 && colorOuter <= 12) {
        let hue = 0
        const delta = max - min
        if (max === r) hue = ((g - b) / delta) % 6
        else if (max === g) hue = (b - r) / delta + 2
        else hue = (r - g) / delta + 4
        hue = Math.round(hue * 60)
        if (hue < 0) hue += 360

        let dt = 'switch-2'
        if (hue >= 22 && hue <= 58) dt = 'downlight'
        else if (hue >= 115 && hue <= 165) dt = 'motion-sensor'
        else if (hue > 165 && hue <= 198) dt = 'ap-node'
        else if (hue >= 200 && hue <= 250) dt = 'switch-2'
        else if (hue > 250 && hue <= 300) dt = 'gateway'
        else if (hue > 300 && hue <= 345) dt = 'curtain-track'

        candidates.push({ x, y, type: dt })
        markVisited(x, y, 18)
      }
    }
  }

  // 3. 扫描 CAD 黑白/灰度符号：空心圆环灯具（筒灯/射灯 ⊕）与实心圆核暗装开关
  for (let y = yMin + 14; y < yMax - 14; y += 2) {
    for (let x = xMin + 14; x < xMax - 14; x += 2) {
      if (visited[y * W + x]) continue

      // 3a. 空心圆环筒灯/射灯符号：中心 r<=2.2 空心，r=4..6.5 圆环墨迹密集且四向闭合，外围 r=9..12 留白
      let coreInk = 0
      let coreTot = 0
      let ringInk = 0
      let ringTot = 0
      let moatInk = 0
      let moatTot = 0
      for (let dy = -12; dy <= 12; dy++) {
        for (let dx = -12; dx <= 12; dx++) {
          const r2 = dx * dx + dy * dy
          if (r2 <= 5) {
            coreTot++
            if (isDark(x + dx, y + dy)) coreInk++
          } else if (r2 >= 15 && r2 <= 45) {
            ringTot++
            if (isDark(x + dx, y + dy)) ringInk++
          } else if (r2 >= 81 && r2 <= 144) {
            moatTot++
            if (isDark(x + dx, y + dy)) moatInk++
          }
        }
      }
      if (
        coreInk / coreTot <= 0.35 &&
        ringInk / ringTot >= 0.5 &&
        moatInk / moatTot <= 0.2 &&
        (isDark(x - 5, y) || isDark(x - 6, y)) &&
        (isDark(x + 5, y) || isDark(x + 6, y)) &&
        (isDark(x, y - 5) || isDark(x, y - 6)) &&
        (isDark(x, y + 5) || isDark(x, y + 6))
      ) {
        candidates.push({ x, y, type: 'downlight' })
        markVisited(x, y, 16)
        continue
      }

      // 3b. 实心圆核暗装开关符号：中心 r<=4 高密度实心圆，外环 r=7..10 有引出斜杆
      if (!isDark(x, y)) continue
      let sCore = 0
      let sCoreTot = 0
      let sRing = 0
      let sRingTot = 0
      for (let dy = -10; dy <= 10; dy++) {
        for (let dx = -10; dx <= 10; dx++) {
          const r2 = dx * dx + dy * dy
          if (r2 <= 16) {
            sCoreTot++
            if (isDark(x + dx, y + dy)) sCore++
          } else if (r2 >= 49 && r2 <= 100) {
            sRingTot++
            if (isDark(x + dx, y + dy)) sRing++
          }
        }
      }
      const sRingRatio = sRing / sRingTot
      if (sCore / sCoreTot >= 0.75 && sRingRatio >= 0.06 && sRingRatio <= 0.35) {
        const horizWall = isDark(x - 10, y) && isDark(x - 14, y) && isDark(x + 10, y) && isDark(x + 14, y)
        const vertWall = isDark(x, y - 10) && isDark(x, y - 14) && isDark(x, y + 10) && isDark(x, y + 14)
        if (!horizWall && !vertWall) {
          candidates.push({
            x,
            y,
            type: sRingRatio > 0.22 ? 'switch-3' : 'switch-2',
          })
          markVisited(x, y, 16)
        }
      }
    }
  }

  // 少于 2 个或超过 240 个噪点时返回空，绝不生成网格默认点位
  if (candidates.length < 2 || candidates.length > 240) {
    return { points: [], areas: [] }
  }

  const points: DetectedCadPoint[] = candidates.map((c) => ({
    type: c.type,
    x: Math.round((c.x / W) * 1000) / 1000,
    y: Math.round((c.y / H) * 1000) / 1000,
  }))

  return { points, areas: [] }
}
