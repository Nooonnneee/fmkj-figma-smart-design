import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import {
  detectCadSymbolsFromPixels,
  snapVisionPointsToCadInk,
  type DetectedCadArea,
  type DetectedCadSummary,
} from '@/lib/cad-point-detector'
import { getCompanyInfo } from '@/lib/cached-data'
import { parseDxfAndRenderFloorPlan } from '@/lib/dxf-point-extractor'
import { normalizeFloorPlan } from '@/lib/floor-plan-normalize'
import { getPayloadClient } from '@/lib/payload'
import { SHEET } from '@/lib/sheet-spec'
import { resolveAutoRouteModel, resolveModelEndpoint } from './server'
import { isVisionCapableModel } from './templates'

const fail = (status: number, error: string) => Response.json({ ok: false, error }, { status })

export type DetectedPointItem = { type: string; x: number; y: number }
export type CachedDetectedBundle = {
  points: DetectedPointItem[]
  switchPoints: DetectedPointItem[]
  lightPoints: DetectedPointItem[]
  areas: DetectedCadArea[]
  summary?: DetectedCadSummary
  /** 缓存的标准图纸 base64 DataURL，供多模态对话模型在聊天中直接「亲眼看图」 */
  imageDataUrl?: string
}

const DETECTED_CACHE_FILE = '/tmp/fmkj-ai-detected-points.json'
const detectedMemoryCache = new Map<string, CachedDetectedBundle>()

function toBundle(raw: unknown): CachedDetectedBundle | null {
  if (!raw) return null
  if (Array.isArray(raw)) {
    const pts = raw as DetectedPointItem[]
    const sw = pts.filter((p) => String(p.type).startsWith('switch-'))
    const lt = pts.filter((p) => !String(p.type).startsWith('switch-'))
    return { points: pts, switchPoints: sw, lightPoints: lt, areas: [] }
  }
  if (typeof raw === 'object' && Array.isArray((raw as CachedDetectedBundle).points)) {
    const b = raw as CachedDetectedBundle
    return {
      points: b.points,
      switchPoints: Array.isArray(b.switchPoints) ? b.switchPoints : b.points.filter((p) => String(p.type).startsWith('switch-')),
      lightPoints: Array.isArray(b.lightPoints) ? b.lightPoints : b.points.filter((p) => !String(p.type).startsWith('switch-')),
      areas: Array.isArray(b.areas) ? b.areas : [],
      summary: b.summary,
      imageDataUrl: typeof b.imageDataUrl === 'string' ? b.imageDataUrl : undefined,
    }
  }
  return null
}

function saveDetectedBundle(mediaId: string, url: string, bundle: CachedDetectedBundle) {
  if (mediaId) detectedMemoryCache.set(mediaId, bundle)
  if (url) detectedMemoryCache.set(url, bundle)
  try {
    mkdirSync(path.dirname(DETECTED_CACHE_FILE), { recursive: true })
    const existing = existsSync(DETECTED_CACHE_FILE)
      ? (JSON.parse(readFileSync(DETECTED_CACHE_FILE, 'utf8')) as Record<string, unknown>)
      : {}
    // 磁盘缓存不落盘大体积 base64 DataURL，避免 JSON 文件膨胀；内存缓存保留完整 imageDataUrl
    const diskBundle: CachedDetectedBundle = {
      points: bundle.points,
      switchPoints: bundle.switchPoints,
      lightPoints: bundle.lightPoints,
      areas: bundle.areas,
      summary: bundle.summary,
    }
    if (mediaId) existing[mediaId] = diskBundle
    if (url) existing[url] = diskBundle
    // 只保留最近 100 条记录，避免临时文件无限增长
    const keys = Object.keys(existing)
    if (keys.length > 200) {
      for (const k of keys.slice(0, keys.length - 200)) delete existing[k]
    }
    writeFileSync(DETECTED_CACHE_FILE, JSON.stringify(existing))
  } catch {
    // ignore disk cache write errors
  }
}

export function getCachedDetectedBundle(mediaId?: string | null, url?: string | null): CachedDetectedBundle | null {
  if (mediaId && detectedMemoryCache.has(mediaId)) return detectedMemoryCache.get(mediaId)!
  if (url && detectedMemoryCache.has(url)) return detectedMemoryCache.get(url)!
  try {
    if (existsSync(DETECTED_CACHE_FILE)) {
      const stored = JSON.parse(readFileSync(DETECTED_CACHE_FILE, 'utf8')) as Record<string, unknown>
      if (mediaId && stored[mediaId]) {
        const b = toBundle(stored[mediaId])
        if (b) {
          detectedMemoryCache.set(mediaId, b)
          return b
        }
      }
      if (url && stored[url]) {
        const b = toBundle(stored[url])
        if (b) {
          detectedMemoryCache.set(url, b)
          return b
        }
      }
    }
  } catch {
    // ignore disk cache read errors
  }
  return null
}

/** 根据上传返回的 mediaId 或图片 url 读取已识别出的点位（无需客户端和大模型在消息与工具参数中搬运完整坐标数组） */
export function getCachedDetectedPoints(mediaId?: string | null, url?: string | null): DetectedPointItem[] | null {
  return getCachedDetectedBundle(mediaId, url)?.points ?? null
}

/**
 * 当后台启用了支持视觉（Vision）的多模态模型（如 qwen-3.6/3.7/3.8、glm-5.3/5.3-flash、qwen-vl-max 等），
 * 且图纸为非标纯黑白图纸或本地像素检测未检出足够彩色点位时，自动调用视觉模型识图提取真实点位坐标与房间结构。
 */
async function detectPointsViaVisionModel(
  pngBuffer: Buffer,
): Promise<{ points: { type: string; x: number; y: number; room?: string }[]; areas: DetectedCadArea[] }> {
  try {
    const company = await getCompanyInfo().catch(() => null)
    const picked = resolveAutoRouteModel(company?.aiModels ?? [], { hasImage: true })
    const visionModel = picked.model
    if (!visionModel || !isVisionCapableModel(`${visionModel.id} ${visionModel.apiModel} ${visionModel.name}`)) {
      return { points: [], areas: [] }
    }
    const { url, apiKey } = resolveModelEndpoint(visionModel)
    if (!apiKey || !url) return { points: [], areas: [] }

    const dataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: visionModel.apiModel,
        temperature: 0.1,
        max_tokens: 2800,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: [
                  '你是资深建筑电气与全屋智能CAD审图专家。请仔细查看这张户型/开关/灯具布置图：',
                  '1. 先看左下角或角落的《图例》表（若有），认清图中单极(switch-1)、双极(switch-2)、三极(switch-3)、四极(switch-4)开关以及筒灯(downlight)、主灯(ceiling-light)的画法（注意：开关通常紧贴门边或床头墙体，且连着黑色控制回路折线的端点；千万不要把图例表内部、尺寸标注、盆栽植物、燃气灶、家具当成开关点位！）。',
                  '2. 识别图中所有真实的开关与主灯/筒灯位置坐标（x, y 为整张图片左上角为 (0,0)、右下角为 (1,1) 的归一化小数，精确到小数点后3位），以及主要房间区域（areas）。',
                  '3. 严格只返回如下 JSON 格式，不要输出任何额外解释：',
                  '{"points":[{"type":"switch-1|switch-2|switch-3|switch-4|downlight|spotlight|ceiling-light","x":0.435,"y":0.242,"room":"主卧"}],"areas":[{"name":"主卧","type":"master-bedroom|bedroom|living-room|dining-room|kitchen|bathroom|balcony|hallway|study","rect":[x,y,w,h]}]}',
                ].join('\n'),
              },
              {
                type: 'image_url',
                image_url: { url: dataUrl },
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(28000),
    })
    if (!res.ok) return { points: [], areas: [] }
    const json = (await res.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: string } }>
    } | null
    const text = json?.choices?.[0]?.message?.content ?? ''
    const match = /\{[\s\S]*\}/.exec(text)
    if (!match) return { points: [], areas: [] }
    const parsed = JSON.parse(match[0]) as {
      points?: Array<{ type?: unknown; x?: unknown; y?: unknown; room?: unknown }>
      areas?: Array<{ name?: unknown; type?: unknown; rect?: unknown }>
    }
    const pts = Array.isArray(parsed.points)
      ? parsed.points
          .map((p) => ({
            type: typeof p.type === 'string' ? p.type : 'switch-2',
            x: Math.round(Number(p.x) * 1000) / 1000,
            y: Math.round(Number(p.y) * 1000) / 1000,
            room: typeof p.room === 'string' ? p.room.trim().slice(0, 24) : undefined,
          }))
          .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x > 0.04 && p.x < 0.96 && p.y > 0.04 && p.y < 0.94)
          .slice(0, 200)
      : []
    const areas: DetectedCadArea[] = Array.isArray(parsed.areas)
      ? parsed.areas
          .map((a) => {
            const r = Array.isArray(a.rect) ? a.rect.map(Number) : []
            return {
              name: typeof a.name === 'string' && a.name.trim() ? a.name.trim().slice(0, 24) : '房间',
              type: typeof a.type === 'string' && a.type.trim() ? a.type.trim() : 'living-room',
              rect: [
                Math.round((r[0] ?? 0) * 1000) / 1000,
                Math.round((r[1] ?? 0) * 1000) / 1000,
                Math.round((r[2] ?? 0) * 1000) / 1000,
                Math.round((r[3] ?? 0) * 1000) / 1000,
              ] as [number, number, number, number],
            }
          })
          .filter((a) => a.rect[2] > 0.04 && a.rect[3] > 0.04 && a.rect[0] >= 0 && a.rect[1] >= 0 && a.rect[0] + a.rect[2] <= 1 && a.rect[1] + a.rect[3] <= 1)
          .slice(0, 20)
      : []
    return { points: pts, areas }
  } catch {
    return { points: [], areas: [] }
  }
}

/**
 * 对已经在项目或媒体库中的图纸 URL 重新执行一次完整识别（像素检测 + 视觉大模型磁吸对齐），
 * 解决用户说「重新生成 / 重新识别点位」时无需再次上传图片的问题。
 */
export async function redetectFloorPlanFromUrl(opts: {
  mediaId?: string | null
  url: string
  sheetName?: string
}): Promise<CachedDetectedBundle | null> {
  try {
    let rawBuf: Buffer | null = null
    const cleanUrl = opts.url.trim()
    const cached = getCachedDetectedBundle(opts.mediaId ?? null, cleanUrl)
    if (cached?.imageDataUrl?.startsWith('data:image/')) {
      const b64 = cached.imageDataUrl.split(',')[1]
      if (b64) rawBuf = Buffer.from(b64, 'base64')
    }
    if (cleanUrl.startsWith('data:image/')) {
      const base64 = cleanUrl.split(',')[1]
      if (base64) rawBuf = Buffer.from(base64, 'base64')
    } else if (!rawBuf) {
      const port = process.env.PORT || '3000'
      const fetchUrl = cleanUrl.startsWith('http') ? cleanUrl : `http://127.0.0.1:${port}${cleanUrl.startsWith('/') ? '' : '/'}${cleanUrl}`
      const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(10000) }).catch(() => null)
      if (res?.ok) rawBuf = Buffer.from(await res.arrayBuffer())
    }
    if (!rawBuf || rawBuf.length === 0) return null

    const normalized = await normalizeFloorPlan(rawBuf, { crop: false })
    let detected = detectCadSymbolsFromPixels(normalized.pixels, { sheetName: opts.sheetName })
    if (!detected.hasColorSymbols || detected.points.length === 0) {
      const visionRes = await detectPointsViaVisionModel(normalized.png)
      if (visionRes.points.length > 0) {
        const mergedAreas = visionRes.areas.length > 0 ? visionRes.areas : detected.areas
        detected = snapVisionPointsToCadInk(normalized.pixels, visionRes.points, mergedAreas, { sheetName: opts.sheetName })
      }
    }
    const bundle: CachedDetectedBundle = {
      points: detected.points,
      switchPoints: detected.switchPoints,
      lightPoints: detected.lightPoints,
      areas: detected.areas,
      summary: detected.summary,
      imageDataUrl: `data:image/png;base64,${normalized.png.toString('base64')}`,
    }
    saveDetectedBundle(opts.mediaId ?? '', cleanUrl, bundle)
    return bundle
  } catch {
    return null
  }
}

/**
 * 上传户型图（AI 对话框、微信小程序共用）：自动去掉图框和标题栏，放进 3:2 标准图纸后存入媒体库。
 * 同时支持直接上传 CAD .dxf 矢量文件（100% 精确提取图块坐标并渲染标准底图）。
 * 不按 file.type 判断格式（小程序上传的文件类型常是 octet-stream），由 sharp 读取图片头。
 */
export async function prepareFloorPlanUpload(request: Request) {
  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: fail(400, '请选择要上传的图片') }
  if (file.size > SHEET.maxUploadBytes) return { error: fail(413, `图片超过 ${Math.round(SHEET.maxUploadBytes / 1024 / 1024)}MB 限制`) }
  const nameField = form?.get('name')
  const baseName = (typeof nameField === 'string' && nameField.trim() ? nameField : file.name).replace(/\.[^.]+$/, '').trim().slice(0, 40) || '户型图'
  const rawBuffer = Buffer.from(await file.arrayBuffer())

  // 支持直接上传 .dxf CAD 矢量图纸文件：直接提取 INSERT 图块坐标、房间文字并渲染为标准 PNG 底图
  const isDxfFile = /\.dxf$/i.test(file.name) || (rawBuffer.length > 32 && rawBuffer.subarray(0, 256).toString('utf8').includes('SECTION'))
  if (isDxfFile) {
    const dxfParsed = await parseDxfAndRenderFloorPlan(rawBuffer.toString('utf8'), { sheetName: baseName }).catch(() => null)
    if (dxfParsed) {
      const payload = await getPayloadClient()
      const media = await payload.create({
        collection: 'media',
        data: { alt: `CAD图纸 · ${baseName}` },
        file: { data: dxfParsed.png, mimetype: 'image/png', name: `dxf-${Date.now().toString(36)}.png`, size: dxfParsed.png.length },
        overrideAccess: true,
        depth: 0,
      })
      if (!media.url) return { error: fail(500, 'CAD 图纸保存失败，请稍后重试') }
      const det = dxfParsed.detection
      saveDetectedBundle(String(media.id), media.url, {
        points: det.points,
        switchPoints: det.switchPoints,
        lightPoints: det.lightPoints,
        areas: det.areas,
        summary: det.summary,
        imageDataUrl: `data:image/png;base64,${dxfParsed.png.toString('base64')}`,
      })
      return {
        upload: {
          mediaId: String(media.id),
          url: media.url,
          name: baseName,
          width: SHEET.pixelWidth,
          height: SHEET.pixelHeight,
          cropped: false,
          detectedPointCount: det.points.length,
          detectedPoints: det.points,
          detectedSwitchCount: det.switchPoints.length,
          detectedLightCount: det.lightPoints.length,
          detectedAreaCount: det.areas.length,
          detectedAreas: det.areas,
          detectedSummary: det.summary,
        },
      }
    }
  }

  let normalized: Awaited<ReturnType<typeof normalizeFloorPlan>>
  try {
    normalized = await normalizeFloorPlan(rawBuffer, { crop: form?.get('crop') !== '0' })
  } catch {
    return { error: fail(400, '图纸无法读取，支持 PNG、JPG、WebP 或 CAD .dxf 格式') }
  }
  let detected = detectCadSymbolsFromPixels(normalized.pixels, { sheetName: baseName })
  // 当图纸是无彩色图层的纯黑白非标图纸（!detected.hasColorSymbols）或本地未检出点位时，优先调用多模态视觉模型识图 + 本地像素磁吸对齐
  if (!detected.hasColorSymbols || detected.points.length === 0) {
    const visionRes = await detectPointsViaVisionModel(normalized.png)
    if (visionRes.points.length > 0) {
      const mergedAreas = visionRes.areas.length > 0 ? visionRes.areas : detected.areas
      detected = snapVisionPointsToCadInk(normalized.pixels, visionRes.points, mergedAreas, { sheetName: baseName })
    }
  }
  let finalPoints = detected.points
  let switchPoints = detected.switchPoints
  let lightPoints = detected.lightPoints
  const payload = await getPayloadClient()
  const media = await payload.create({
    collection: 'media',
    data: { alt: `户型图 · ${baseName}` },
    file: { data: normalized.png, mimetype: 'image/png', name: `sheet-${Date.now().toString(36)}.png`, size: normalized.png.length },
    overrideAccess: true,
    depth: 0,
  })
  if (!media.url) return { error: fail(500, '图片保存失败，请稍后重试') }
  saveDetectedBundle(String(media.id), media.url, {
    points: finalPoints,
    switchPoints,
    lightPoints,
    areas: detected.areas,
    summary: detected.summary,
    imageDataUrl: `data:image/png;base64,${normalized.png.toString('base64')}`,
  })
  return {
    upload: {
      mediaId: String(media.id),
      url: media.url,
      name: baseName,
      width: SHEET.pixelWidth,
      height: SHEET.pixelHeight,
      cropped: normalized.cropped,
      detectedPointCount: finalPoints.length,
      detectedPoints: finalPoints,
      detectedSwitchCount: switchPoints.length,
      detectedLightCount: lightPoints.length,
      detectedAreaCount: detected.areas.length,
      detectedAreas: detected.areas,
      detectedSummary: detected.summary,
    },
  }
}

export async function handleAiUpload(request: Request): Promise<Response> {
  try {
    const result = await prepareFloorPlanUpload(request)
    if (result.error) return result.error
    return Response.json({ ok: true, ...result.upload })
  } catch (error) {
    console.error('[ai-upload] failed', error)
    return fail(500, '图片保存失败，请稍后重试')
  }
}
