import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { after } from 'next/server'
import sharp from 'sharp'

import {
  detectCadSymbolsFromPixels,
  snapPointToInk,
  type CadDetectionResult,
  type DetectedCadArea,
  type DetectedCadSummary,
} from '@/lib/cad-point-detector'
import {
  collectLocalCandidates,
  fuseDetections,
  isSwitchFamily,
  normalizeVisionAnalysis,
  type FusionStats,
} from '@/lib/cad-point-fusion'
import { parseDxfAndRenderFloorPlan } from '@/lib/dxf-point-extractor'
import type { Pixels } from '@/lib/floor-plan-crop'
import { normalizeFloorPlan } from '@/lib/floor-plan-normalize'
import { getPayloadClient } from '@/lib/payload'
import { SHEET } from '@/lib/sheet-spec'
import { recordUploadDiagnostic } from '@/lib/usage-diagnostics'

import type { AiModelConfig } from './templates'
import {
  callVision,
  encodeImageForVision,
  extractJson,
  getVisionModels,
  isReasoningOnlyModel,
  loadImageBuffer,
  rememberImageBuffer,
} from './vision'

const fail = (status: number, error: string) => Response.json({ ok: false, error }, { status })

export type UploadImageKind = 'floor-plan' | 'quote-document' | 'photo' | 'rendering' | 'other'
export const IMAGE_KIND_LABEL: Record<UploadImageKind, string> = {
  'floor-plan': '户型/点位图纸',
  'quote-document': '报价单/清单截图',
  photo: '实景照片',
  rendering: '效果图',
  other: '其他图片',
}

export type VisionRecognitionMeta = {
  status: 'pending' | 'done' | 'failed' | 'unavailable' | 'skipped'
  model?: string
  drawingType?: string
  legend?: string[]
  annotatedCounts?: Record<string, number>
  socketCount?: number
  summary?: string
  issues?: string[]
  caption?: string
  stats?: FusionStats
  durationMs?: number
  profile?: RecognitionProfile
}

export type DetectedPointItem = { type: string; x: number; y: number; room?: string }
export type CachedDetectedBundle = {
  points: DetectedPointItem[]
  switchPoints: DetectedPointItem[]
  lightPoints: DetectedPointItem[]
  areas: DetectedCadArea[]
  summary?: DetectedCadSummary
  imageKind?: UploadImageKind
  vision?: VisionRecognitionMeta
  /** 本地几何识别（视觉复核前）的数量，便于对比与排障 */
  local?: { total: number; switches: number; lights: number }
  profile?: RecognitionProfile
}

const DETECTED_CACHE_FILE = '/tmp/fmkj-ai-detected-points.json'
const detectedMemoryCache = new Map<string, CachedDetectedBundle>()
const visionJobs = new Map<string, Promise<CachedDetectedBundle | null>>()

function toBundle(raw: unknown): CachedDetectedBundle | null {
  if (!raw) return null
  if (Array.isArray(raw)) {
    const pts = raw as DetectedPointItem[]
    return {
      points: pts,
      switchPoints: pts.filter((p) => isSwitchFamily(String(p.type))),
      lightPoints: pts.filter((p) => !isSwitchFamily(String(p.type))),
      areas: [],
    }
  }
  if (typeof raw === 'object' && Array.isArray((raw as CachedDetectedBundle).points)) {
    const b = raw as CachedDetectedBundle
    return {
      points: b.points,
      switchPoints: Array.isArray(b.switchPoints)
        ? b.switchPoints
        : b.points.filter((p) => isSwitchFamily(String(p.type))),
      lightPoints: Array.isArray(b.lightPoints)
        ? b.lightPoints
        : b.points.filter((p) => !isSwitchFamily(String(p.type))),
      areas: Array.isArray(b.areas) ? b.areas : [],
      summary: b.summary,
      imageKind: b.imageKind,
      vision: b.vision,
      local: b.local,
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
    const keys = Object.keys(existing)
    if (keys.length > 300) {
      for (const k of keys.slice(0, keys.length - 300)) delete existing[k]
    }
    writeFileSync(DETECTED_CACHE_FILE, JSON.stringify(existing))
  } catch {
    // ignore disk cache write errors
  }
}

export function getCachedDetectedBundle(
  mediaId?: string | null,
  url?: string | null,
): CachedDetectedBundle | null {
  if (mediaId && detectedMemoryCache.has(mediaId)) return detectedMemoryCache.get(mediaId)!
  if (url && detectedMemoryCache.has(url)) return detectedMemoryCache.get(url)!
  try {
    if (existsSync(DETECTED_CACHE_FILE)) {
      const stored = JSON.parse(readFileSync(DETECTED_CACHE_FILE, 'utf8')) as Record<
        string,
        unknown
      >
      for (const key of [mediaId, url]) {
        if (!key || !stored[key]) continue
        const b = toBundle(stored[key])
        if (b) {
          detectedMemoryCache.set(key, b)
          return b
        }
      }
    }
  } catch {
    // ignore disk cache read errors
  }
  return null
}

/** 根据上传返回的 mediaId 或图片 url 读取已识别出的点位 */
export function getCachedDetectedPoints(
  mediaId?: string | null,
  url?: string | null,
): DetectedPointItem[] | null {
  return getCachedDetectedBundle(mediaId, url)?.points ?? null
}

/** 识别进度：视觉复核任务进行中返回 pending */
export function getRecognitionStatus(mediaId?: string | null, url?: string | null) {
  const bundle = getCachedDetectedBundle(mediaId, url)
  const pending = Boolean((mediaId && visionJobs.has(mediaId)) || (url && visionJobs.has(url)))
  return {
    status: pending ? 'pending' : (bundle?.vision?.status ?? (bundle ? 'done' : 'unknown')),
    bundle,
  }
}

/** 等待视觉复核完成（最多 timeoutMs），返回最新识别结果 */
export async function awaitRecognition(
  mediaId?: string | null,
  url?: string | null,
  timeoutMs = 55_000,
): Promise<CachedDetectedBundle | null> {
  const job = (mediaId && visionJobs.get(mediaId)) || (url && visionJobs.get(url)) || null
  if (job) await Promise.race([job, new Promise((resolve) => setTimeout(resolve, timeoutMs))])
  return getCachedDetectedBundle(mediaId, url)
}

/* ---------------- 图片分类（带图任务第一步就交给视觉模型判断） ---------------- */

const KIND_VALUES: UploadImageKind[] = [
  'floor-plan',
  'quote-document',
  'photo',
  'rendering',
  'other',
]

function normalizeKind(raw: unknown): UploadImageKind | null {
  if (typeof raw !== 'string') return null
  const s = raw.toLowerCase()
  for (const k of KIND_VALUES) if (s.includes(k)) return k
  if (/户型|平面|cad|图纸|点位|水电|彩平/.test(s)) return 'floor-plan'
  if (/报价|清单|表格|合同|quote|document/.test(s)) return 'quote-document'
  if (/效果图|渲染|render/.test(s)) return 'rendering'
  if (/照片|实景|实拍|photo/.test(s)) return 'photo'
  return null
}

/** 视觉模型不可用时的兜底：白底占比高按图纸处理（与旧行为一致），否则视为照片 */
async function heuristicKind(buf: Buffer): Promise<UploadImageKind> {
  const { data, info } = await sharp(buf, { failOn: 'none' })
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize(160, 160, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let white = 0
  const total = info.width * info.height
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i] > 232 && data[i + 1] > 232 && data[i + 2] > 232) white++
  }
  return white / Math.max(1, total) >= 0.45 ? 'floor-plan' : 'photo'
}

const CLASSIFY_PROMPT =
  '判断这张图片属于哪一类，只返回 JSON：{"kind":"floor-plan|quote-document|photo|rendering|other","caption":"20字以内的中文描述"}。' +
  'floor-plan=户型图/平面图/CAD图纸/开关灯具点位图/水电图/彩平图；quote-document=报价单/设备清单/表格/合同截图；photo=实拍照片；rendering=效果图/渲染图；other=其他。'

async function classifyUploadImage(
  buf: Buffer,
  models: AiModelConfig[],
): Promise<{ kind: UploadImageKind; caption?: string; by: 'vision' | 'heuristic' }> {
  const heuristic = await heuristicKind(buf).catch(() => 'floor-plan' as UploadImageKind)
  if (!models.length) return { kind: heuristic, by: 'heuristic' }
  // 分类要快：优先 flash 轻量视觉模型，其次非推理型视觉模型
  const isFlash = (m: AiModelConfig) => /flash/i.test(`${m.id} ${m.apiModel} ${m.name}`)
  const quick = [
    ...models.filter((m) => !isReasoningOnlyModel(m) && isFlash(m)),
    ...models.filter((m) => !isReasoningOnlyModel(m) && !isFlash(m)),
    ...models.filter((m) => isReasoningOnlyModel(m)),
  ]
  const small = await encodeImageForVision(buf, { maxSide: 768, quality: 80 }).catch(() => null)
  if (!small) return { kind: heuristic, by: 'heuristic' }
  const res = await callVision({
    images: [small],
    prompt: CLASSIFY_PROMPT,
    models: quick,
    maxTokens: 160,
    timeoutMs: 20_000,
    maxAttempts: 1,
    thinking: false,
    highResolution: false,
  })
  const parsed = extractJson<{ kind?: string; caption?: string }>(res?.text)
  const kind = normalizeKind(parsed?.kind) ?? normalizeKind(res?.text)
  if (!kind) return { kind: heuristic, by: 'heuristic' }
  return {
    kind,
    caption: typeof parsed?.caption === 'string' ? parsed.caption.trim().slice(0, 40) : undefined,
    by: 'vision',
  }
}

/* ---------------- 视觉复核：整图理解 + 候选点放大拼图逐格核对 ---------------- */

const FLOORPLAN_SYSTEM =
  '你是资深的全屋智能与建筑电气审图工程师，只陈述图中能确认的内容，看不清的不要编造。严格按要求只输出 JSON。'

export type RecognitionProfile = 'devices' | 'smart'

/** 识别提示词按需求分档：提示词就是 skill 的可执行版本。 */
const PROFILE_EXTRA: Record<RecognitionProfile, string[]> = {
  devices: [],
  smart: [
    '6. 智能设备布点：图中已画的按图识别；图中没有的按全屋智能常规规范补充建议点位——AP ap-node（客厅/过道吸顶 1~2 个）、摄像头 camera（入户/客厅/庭院墙角）、智能屏 touch-panel（玄关/客厅）、人体传感器 motion-sensor（过道/卫生间）、门磁 contact-sensor（入户门/窗）、水浸 water-sensor（厨房/卫生间）、烟感 smoke-sensor（厨房/卧室）、窗帘 curtain-track（有窗帘的窗）、网关 gateway（弱电箱/客厅）、风管机温控 vrf-controller（空调位）。',
    '补充的建议点位也要给 room 与坐标，并在 issues 里说明哪些是图纸原有、哪些是按规范补充。',
  ],
}

const recognitionPrompt = (profile: RecognitionProfile) =>
  [
    '这是一张住宅户型/电气图纸，房间名可能是中文或英文。请先按房间逐个扫描，再列出所有真实点位；坐标用 0~1 归一化（左上角 (0,0)，右下角 (1,1)，保留 3 位小数）。',
    '1. drawingType：switch-layout / lighting-layout / socket-layout / combined-electrical / floor-plan / colored-plan / other。',
    '2. legend：逐条写出图例与颜色约定；没有图例返回 []。',
    '3. annotatedCounts：图中若有文字汇总，按设备类型合计，例如 {"switch-3":5,"switch-2":12,"switch-1":3,"touch-panel":1}；没有返回 {}。',
    '4. points：逐个列出图中真实点位——switch-1/2/3/4（开关面板）、touch-panel（智能屏）、downlight（筒灯）、spotlight（射灯）、ceiling-light（吸顶灯）、pendant-light（吊灯）、light-strip（灯带）、wall-light（壁灯）、curtain-track（窗帘）、motion-sensor、contact-sensor、water-sensor、smoke-sensor、smart-lock、camera、ap-node、gateway、vrf-controller。插座只统计数量写进 socketCount，不要列点。家具、文字、尺寸、图框、连线、图例不是点位。',
    '5. areas：房间名称 + 外接框 rect=[x,y,w,h] + type(entrance/living/dining/kitchen/bedroom/kids/study/bathroom/balcony/corridor/stairs/closet/utility/other)。',
    ...PROFILE_EXTRA[profile],
    '只返回 JSON：{"drawingType":"","legend":[],"annotatedCounts":{},"socketCount":0,"points":[{"type":"downlight","x":0.512,"y":0.341,"room":"Kitchen"}],"areas":[{"name":"Kitchen","type":"kitchen","rect":[0.6,0.1,0.3,0.3]}],"summary":"50字内概括","issues":["存疑之处"]}',
  ].join('\n')

const shortModelName = (m: AiModelConfig) =>
  m.name.replace(/（[^）]*）|\([^)]*\)/g, '').trim() || m.name

async function runVisionFusion(args: {
  png: Buffer
  pixels: Pixels
  local: CadDetectionResult
  sheetName?: string
  models: AiModelConfig[]
  profile: RecognitionProfile
}): Promise<CachedDetectedBundle> {
  const t0 = Date.now()
  const localCounts = {
    total: collectLocalCandidates(args.local).length,
    switches: args.local.switchPoints.length,
    lights: args.local.lightPoints.length,
  }
  // 本地识别只作模型失败时的兜底，不再参与主识别
  const base: CachedDetectedBundle = {
    points: args.local.points,
    switchPoints: args.local.switchPoints,
    lightPoints: args.local.lightPoints,
    areas: args.local.areas,
    summary: args.local.summary,
    imageKind: 'floor-plan',
    local: localCounts,
    profile: args.profile,
  }
  if (!args.models.length)
    return { ...base, vision: { status: 'unavailable', profile: args.profile } }

  // 直接走模型：原图 2400 + 逐房间提示词，不跑本地候选、不跑拼图
  const fullImage = await encodeImageForVision(args.png, { maxSide: 2400, quality: 88 })
  const full = await callVision({
    images: [fullImage],
    system: FLOORPLAN_SYSTEM,
    prompt: recognitionPrompt(args.profile),
    models: args.models,
    maxTokens: 6000,
    timeoutMs: 150_000,
    thinking: true,
    highResolution: true,
  })
  const vision = normalizeVisionAnalysis(extractJson(full?.text))
  if (!full?.model || !vision || vision.points.length === 0) {
    return {
      ...base,
      vision: {
        status: 'failed',
        ...(full?.model ? { model: shortModelName(full.model) } : {}),
        profile: args.profile,
        durationMs: Date.now() - t0,
      },
    }
  }
  const modelLabel = shortModelName(full.model)
  const fused = fuseDetections({
    local: args.local,
    candidates: [],
    verdicts: new Map(),
    vision,
    strategy: 'vision-first',
    snap: (p) => snapPointToInk(args.pixels, p.x, p.y, isSwitchFamily(p.type)),
    sheetName: args.sheetName,
    modelLabel,
  })
  return {
    points: fused.result.points,
    switchPoints: fused.result.switchPoints,
    lightPoints: fused.result.lightPoints,
    areas: fused.result.areas,
    summary: fused.result.summary,
    imageKind: 'floor-plan',
    local: localCounts,
    profile: args.profile,
    vision: {
      status: 'done',
      model: modelLabel,
      profile: args.profile,
      drawingType: vision.drawingType,
      legend: vision.legend,
      annotatedCounts: vision.annotatedCounts,
      socketCount: vision.socketCount,
      summary: vision.summary,
      issues: vision.issues,
      stats: fused.stats,
      durationMs: Date.now() - t0,
    },
  }
}

function startVisionFusionJob(args: {
  mediaId: string
  url: string
  fileName: string
  png: Buffer
  pixels: Pixels
  local: CadDetectionResult
  sheetName?: string
  models: AiModelConfig[]
  profile: RecognitionProfile
}) {
  const job = runVisionFusion(args)
    .then((bundle) => {
      saveDetectedBundle(args.mediaId, args.url, bundle)
      if (bundle.vision?.status === 'done') {
        recordUploadDiagnostic({
          fileName: args.fileName,
          mediaId: args.mediaId,
          url: args.url,
          method: 'vision-fusion',
          totalPoints: bundle.points.length,
          switches: bundle.switchPoints.length,
          lights: bundle.lightPoints.length,
          areas: bundle.areas.length,
          durationMs: bundle.vision.durationMs ?? 0,
        })
      }
      return bundle
    })
    .catch((error) => {
      console.error('[vision-fusion] failed', error)
      const current = getCachedDetectedBundle(args.mediaId, args.url)
      if (current)
        saveDetectedBundle(args.mediaId, args.url, { ...current, vision: { status: 'failed' } })
      return current
    })
    .finally(() => {
      visionJobs.delete(args.mediaId)
      visionJobs.delete(args.url)
    })
  visionJobs.set(args.mediaId, job)
  visionJobs.set(args.url, job)
  return job
}

/** 让平台在响应返回后继续完成视觉复核（自托管 Node 服务直接后台执行） */
function keepAlive(job: Promise<unknown>) {
  try {
    after(job)
  } catch {
    // 不在请求上下文中时，Promise 仍会在后台继续执行
  }
}

/**
 * 对已经在项目或媒体库中的图纸重新执行一次完整识别（本地几何识别 + 视觉复核），
 * 用户说「重新生成 / 重新识别点位」时无需再次上传图片。
 */
export async function redetectFloorPlanFromUrl(opts: {
  mediaId?: string | null
  url: string
  sheetName?: string
  userId?: string | number | null
  profile?: RecognitionProfile
}): Promise<CachedDetectedBundle | null> {
  try {
    const cleanUrl = opts.url.trim()
    const rawBuf = await loadImageBuffer({ mediaId: opts.mediaId, url: cleanUrl })
    if (!rawBuf?.length) return null
    const normalized = await normalizeFloorPlan(rawBuf, { crop: false })
    const local = detectCadSymbolsFromPixels(normalized.pixels, { sheetName: opts.sheetName })
    const models = await getVisionModels({ userId: opts.userId })
    const bundle = await runVisionFusion({
      png: normalized.png,
      pixels: normalized.pixels,
      local,
      sheetName: opts.sheetName,
      models,
      profile: opts.profile ?? 'devices',
    })
    saveDetectedBundle(opts.mediaId ?? '', cleanUrl, bundle)
    return bundle
  } catch (error) {
    console.error('[redetect] failed', error)
    return null
  }
}

function uploadFields(bundle: CachedDetectedBundle) {
  return {
    profile: bundle.profile,
    detectedPointCount: bundle.points.length,
    detectedPoints: bundle.points,
    detectedSwitchCount: bundle.switchPoints.length,
    detectedLightCount: bundle.lightPoints.length,
    detectedAreaCount: bundle.areas.length,
    detectedAreas: bundle.areas,
    detectedSummary: bundle.summary,
  }
}

/**
 * 上传图片（AI 对话框、微信小程序共用）：
 * - 先由视觉模型判断图片类型（户型/点位图纸、报价单截图、实景照片、效果图）；
 * - 户型图纸：去掉图框标题栏放进 3:2 标准图纸 → 本地几何识别（秒出）→ 后台视觉复核（整图理解 + 逐点放大核对，工具调用前自动等待完成）；
 * - 其他图片：原图等比压缩后存入媒体库，供对话中的视觉模型看图，不进入点位识别；
 * - 支持 CAD .dxf 矢量文件（图块坐标 100% 精确）。
 */
export async function prepareFloorPlanUpload(
  request: Request,
  opts: { awaitVision?: boolean; forceKind?: UploadImageKind; profile?: RecognitionProfile } = {},
) {
  const t0 = Date.now()
  const form = await request.formData().catch(() => null)
  const profileField = form?.get('profile')
  const profile: RecognitionProfile =
    opts.profile ?? (profileField === 'smart' ? 'smart' : 'devices')
  const file = form?.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: fail(400, '请选择要上传的图片') }
  if (file.size > SHEET.maxUploadBytes)
    return { error: fail(413, `图片超过 ${Math.round(SHEET.maxUploadBytes / 1024 / 1024)}MB 限制`) }
  const nameField = form?.get('name')
  const baseName =
    (typeof nameField === 'string' && nameField.trim() ? nameField : file.name)
      .replace(/\.[^.]+$/, '')
      .trim()
      .slice(0, 40) || '户型图'
  const rawBuffer = Buffer.from(await file.arrayBuffer())
  const payload = await getPayloadClient()

  // CAD .dxf 矢量图纸：直接提取 INSERT 图块坐标与房间文字（精确，无需视觉复核）
  const isDxfFile =
    /\.dxf$/i.test(file.name) ||
    (rawBuffer.length > 32 && rawBuffer.subarray(0, 256).toString('utf8').includes('SECTION'))
  if (isDxfFile) {
    const dxfParsed = await parseDxfAndRenderFloorPlan(rawBuffer.toString('utf8'), {
      sheetName: baseName,
    }).catch(() => null)
    if (!dxfParsed)
      return { error: fail(400, 'CAD 文件无法解析，请另存为 DXF（R2013 及以下）或导出图片后上传') }
    const media = await payload.create({
      collection: 'media',
      data: { alt: `CAD图纸 · ${baseName}` },
      file: {
        data: dxfParsed.png,
        mimetype: 'image/png',
        name: `dxf-${Date.now().toString(36)}.png`,
        size: dxfParsed.png.length,
      },
      overrideAccess: true,
      depth: 0,
    })
    if (!media.url) return { error: fail(500, 'CAD 图纸保存失败，请稍后重试') }
    const det = dxfParsed.detection
    const bundle: CachedDetectedBundle = {
      points: det.points,
      switchPoints: det.switchPoints,
      lightPoints: det.lightPoints,
      areas: det.areas,
      summary: det.summary,
      imageKind: 'floor-plan',
      vision: { status: 'skipped', summary: 'DXF 矢量图块精确提取' },
    }
    rememberImageBuffer([String(media.id), media.url], dxfParsed.png)
    saveDetectedBundle(String(media.id), media.url, bundle)
    recordUploadDiagnostic({
      fileName: file.name,
      mediaId: String(media.id),
      url: media.url,
      method: 'dxf-vector',
      totalPoints: det.points.length,
      switches: det.switchPoints.length,
      lights: det.lightPoints.length,
      areas: det.areas.length,
      durationMs: Date.now() - t0,
    })
    return {
      upload: {
        mediaId: String(media.id),
        url: media.url,
        name: baseName,
        width: SHEET.pixelWidth,
        height: SHEET.pixelHeight,
        cropped: false,
        imageKind: 'floor-plan' as UploadImageKind,
        visionStatus: 'skipped',
        ...uploadFields(bundle),
      },
    }
  }

  try {
    const meta = await sharp(rawBuffer, { failOn: 'none' }).metadata()
    if (
      !meta.format ||
      !['png', 'jpeg', 'jpg', 'webp', 'gif', 'heif', 'tiff'].includes(meta.format)
    )
      throw new Error('UNSUPPORTED')
  } catch {
    return { error: fail(400, '图片无法读取，支持 PNG、JPG、WebP 或 CAD .dxf 格式') }
  }

  const models = await getVisionModels()
  const formKind = normalizeKind(form?.get('kind'))
  const classified = opts.forceKind
    ? { kind: opts.forceKind, by: 'heuristic' as const }
    : formKind && formKind !== 'other'
      ? { kind: formKind, by: 'heuristic' as const }
      : await classifyUploadImage(rawBuffer, models)

  // 非图纸图片：保留原图（等比压缩），只做视觉看图，不进入点位识别
  if (classified.kind !== 'floor-plan') {
    const isPhotoLike = classified.kind === 'photo' || classified.kind === 'rendering'
    const pipeline = sharp(rawBuffer, { failOn: 'none' })
      .rotate()
      .flatten({ background: '#ffffff' })
      .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
    const out = isPhotoLike
      ? await pipeline.jpeg({ quality: 86, mozjpeg: true }).toBuffer()
      : await pipeline.png({ compressionLevel: 9 }).toBuffer()
    const dims = await sharp(out).metadata()
    const media = await payload.create({
      collection: 'media',
      data: { alt: `${IMAGE_KIND_LABEL[classified.kind]} · ${baseName}` },
      file: {
        data: out,
        mimetype: isPhotoLike ? 'image/jpeg' : 'image/png',
        name: `upload-${Date.now().toString(36)}.${isPhotoLike ? 'jpg' : 'png'}`,
        size: out.length,
      },
      overrideAccess: true,
      depth: 0,
    })
    if (!media.url) return { error: fail(500, '图片保存失败，请稍后重试') }
    const bundle: CachedDetectedBundle = {
      points: [],
      switchPoints: [],
      lightPoints: [],
      areas: [],
      imageKind: classified.kind,
      vision: { status: 'skipped', caption: classified.caption },
    }
    rememberImageBuffer([String(media.id), media.url], out)
    saveDetectedBundle(String(media.id), media.url, bundle)
    recordUploadDiagnostic({
      fileName: file.name,
      mediaId: String(media.id),
      url: media.url,
      method: 'non-plan',
      totalPoints: 0,
      switches: 0,
      lights: 0,
      areas: 0,
      durationMs: Date.now() - t0,
    })
    return {
      upload: {
        mediaId: String(media.id),
        url: media.url,
        name: baseName,
        width: dims.width ?? 0,
        height: dims.height ?? 0,
        cropped: false,
        imageKind: classified.kind,
        caption: classified.caption,
        visionStatus: 'skipped',
        ...uploadFields(bundle),
      },
    }
  }

  let normalized: Awaited<ReturnType<typeof normalizeFloorPlan>>
  try {
    normalized = await normalizeFloorPlan(rawBuffer, { crop: form?.get('crop') !== '0' })
  } catch {
    return { error: fail(400, '图纸无法读取，支持 PNG、JPG、WebP 或 CAD .dxf 格式') }
  }
  const local = detectCadSymbolsFromPixels(normalized.pixels, { sheetName: baseName })
  const media = await payload.create({
    collection: 'media',
    data: { alt: `户型图 · ${baseName}` },
    file: {
      data: normalized.png,
      mimetype: 'image/png',
      name: `sheet-${Date.now().toString(36)}.png`,
      size: normalized.png.length,
    },
    overrideAccess: true,
    depth: 0,
  })
  if (!media.url) return { error: fail(500, '图片保存失败，请稍后重试') }
  const mediaId = String(media.id)
  rememberImageBuffer([mediaId, media.url], normalized.png)
  const localCounts = {
    total: collectLocalCandidates(local).length,
    switches: local.switchPoints.length,
    lights: local.lightPoints.length,
  }
  let bundle: CachedDetectedBundle = {
    points: local.points,
    switchPoints: local.switchPoints,
    lightPoints: local.lightPoints,
    areas: local.areas,
    summary: local.summary,
    imageKind: 'floor-plan',
    local: localCounts,
    vision: { status: models.length ? 'pending' : 'unavailable', caption: classified.caption },
  }
  saveDetectedBundle(mediaId, media.url, bundle)
  recordUploadDiagnostic({
    fileName: file.name,
    mediaId,
    url: media.url,
    method: local.points.length === 0 ? 'empty' : local.hasColorSymbols ? 'cad-color' : 'cad-bw',
    totalPoints: local.points.length,
    switches: local.switchPoints.length,
    lights: local.lightPoints.length,
    areas: local.areas.length,
    durationMs: Date.now() - t0,
  })

  if (models.length) {
    const job = startVisionFusionJob({
      mediaId,
      url: media.url,
      fileName: file.name,
      png: normalized.png,
      pixels: normalized.pixels,
      local,
      sheetName: baseName,
      models,
      profile,
    })
    if (opts.awaitVision) {
      bundle = (await awaitRecognition(mediaId, media.url, 55_000)) ?? bundle
    } else {
      keepAlive(job)
    }
  }

  const status = getRecognitionStatus(mediaId, media.url).status
  return {
    upload: {
      mediaId,
      url: media.url,
      name: baseName,
      width: SHEET.pixelWidth,
      height: SHEET.pixelHeight,
      cropped: normalized.cropped,
      imageKind: 'floor-plan' as UploadImageKind,
      caption: classified.caption,
      visionStatus: status,
      ...uploadFields(bundle),
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

/** 查询识别进度（前端轮询视觉复核结果）：GET ?mediaId=&url= */
export function recognitionStatusPayload(request: Request) {
  const sp = new URL(request.url).searchParams
  const mediaId = sp.get('mediaId')?.slice(0, 80) || null
  const url = sp.get('url')?.slice(0, 300) || null
  const { status, bundle } = getRecognitionStatus(mediaId, url)
  return {
    status,
    imageKind: bundle?.imageKind ?? null,
    detectedPointCount: bundle?.points.length ?? 0,
    detectedSwitchCount: bundle?.switchPoints.length ?? 0,
    detectedLightCount: bundle?.lightPoints.length ?? 0,
    detectedAreaCount: bundle?.areas.length ?? 0,
    confirmText: bundle?.summary?.confirmText ?? null,
    profile: bundle?.profile ?? null,
    vision: bundle?.vision ?? null,
  }
}
