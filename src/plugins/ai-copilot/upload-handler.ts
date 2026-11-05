import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { detectCadSymbolsFromPixels, type DetectedCadArea, type DetectedCadSummary } from '@/lib/cad-point-detector'
import { getCompanyInfo } from '@/lib/cached-data'
import { normalizeFloorPlan } from '@/lib/floor-plan-normalize'
import { getPayloadClient } from '@/lib/payload'
import { SHEET } from '@/lib/sheet-spec'
import { resolveModelApiKey } from './server'
import { enabledAiModels, type AiModelConfig } from './templates'

const fail = (status: number, error: string) => Response.json({ ok: false, error }, { status })

const VISION_MODEL_RE = /vl|vision|glm-4v|qvq|omni|doubao.*vision/i

export type DetectedPointItem = { type: string; x: number; y: number }
export type CachedDetectedBundle = {
  points: DetectedPointItem[]
  switchPoints: DetectedPointItem[]
  lightPoints: DetectedPointItem[]
  areas: DetectedCadArea[]
  summary?: DetectedCadSummary
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
    if (mediaId) existing[mediaId] = bundle
    if (url) existing[url] = bundle
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
 * 当后台启用了支持视觉（Vision）的国产多模态模型（如 qwen-vl-max、glm-4v-plus、doubao-1-5-vision-pro），
 * 且本地像素检测未检出足够点位时，自动调用多模态视觉模型识图提取真实点位坐标。
 */
async function detectPointsViaVisionModel(pngBuffer: Buffer): Promise<{ type: string; x: number; y: number }[]> {
  try {
    const company = await getCompanyInfo().catch(() => null)
    const models = enabledAiModels(company?.aiModels ?? [])
    const visionModel: AiModelConfig | undefined = models.find(
      (m) => VISION_MODEL_RE.test(m.apiModel) && Boolean(resolveModelApiKey(m)),
    )
    if (!visionModel) return []
    const apiKey = resolveModelApiKey(visionModel)
    if (!apiKey || !visionModel.baseUrl.startsWith('https://')) return []

    const dataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`
    const res = await fetch(`${visionModel.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: visionModel.apiModel,
        temperature: 0.1,
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: '请识别这张户型/电气点位图中明确绘制的开关、灯具、插座、AP、网关或传感器符号位置。如果图中没有绘制点位符号，返回 {"points":[]}；如果有，严格只返回 JSON：{"points":[{"type":"switch-2|switch-3|downlight|spotlight|ceiling-light|socket|ap-node|gateway","x":0.0~1.0,"y":0.0~1.0}]}，不要输出任何解释文字。',
              },
              {
                type: 'image_url',
                image_url: { url: dataUrl },
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return []
    const json = (await res.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: string } }>
    } | null
    const text = json?.choices?.[0]?.message?.content ?? ''
    const match = /\{[\s\S]*\}/.exec(text)
    if (!match) return []
    const parsed = JSON.parse(match[0]) as { points?: Array<{ type?: unknown; x?: unknown; y?: unknown }> }
    if (!Array.isArray(parsed.points)) return []
    return parsed.points
      .map((p) => ({
        type: typeof p.type === 'string' ? p.type : 'switch-2',
        x: Math.round(Number(p.x) * 1000) / 1000,
        y: Math.round(Number(p.y) * 1000) / 1000,
      }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x > 0.02 && p.x < 0.98 && p.y > 0.02 && p.y < 0.98)
      .slice(0, 200)
  } catch {
    return []
  }
}

/**
 * 上传户型图（AI 对话框、微信小程序共用）：自动去掉图框和标题栏，放进 3:2 标准图纸后存入媒体库。
 * 同时尝试识别 CAD 开关符号；识别不到就返回空数组，绝不生成默认点位。
 * 不按 file.type 判断格式（小程序上传的文件类型常是 octet-stream），由 sharp 读取图片头。
 */
export async function prepareFloorPlanUpload(request: Request) {
  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: fail(400, '请选择要上传的图片') }
  if (file.size > SHEET.maxUploadBytes) return { error: fail(413, `图片超过 ${Math.round(SHEET.maxUploadBytes / 1024 / 1024)}MB 限制`) }
  const nameField = form?.get('name')
  const baseName = (typeof nameField === 'string' && nameField.trim() ? nameField : file.name).replace(/\.[^.]+$/, '').trim().slice(0, 40) || '户型图'
  let normalized: Awaited<ReturnType<typeof normalizeFloorPlan>>
  try {
    normalized = await normalizeFloorPlan(Buffer.from(await file.arrayBuffer()), { crop: form?.get('crop') !== '0' })
  } catch {
    return { error: fail(400, '图片无法读取，只支持 PNG、JPG、WebP 格式') }
  }
  const detected = detectCadSymbolsFromPixels(normalized.pixels, { sheetName: baseName })
  let finalPoints = detected.points
  let switchPoints = detected.switchPoints
  let lightPoints = detected.lightPoints
  if (finalPoints.length === 0) {
    finalPoints = await detectPointsViaVisionModel(normalized.png)
    switchPoints = finalPoints.filter((p) => p.type.startsWith('switch-'))
    lightPoints = finalPoints.filter((p) => !p.type.startsWith('switch-'))
  }
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
