/**
 * 视觉能力中枢：所有带图片的任务（识图判断、点位识别复核、点位规划、生图参考与质检、对话看图）统一从这里调用视觉大模型。
 *
 * - rankVisionModels：按能力排序后台已启用且配置了密钥的多模态模型（会员档位内优先，没有时由平台默认视觉模型代为看图）；
 * - callVision：OpenAI 兼容接口流式调用（兼容只支持流式输出的 QVQ 等模型），失败自动换下一个视觉模型；
 * - loadImageBuffer / encodeImageForVision：从缓存、媒体库地址读取图片并压成适合视觉模型的 JPEG；
 * - buildPatchSheets：把候选点位周围的局部放大拼成带编号的拼图，让视觉模型逐格复核小符号（不依赖系统字体）。
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import sharp from 'sharp'

import { getCompanyInfo } from '@/lib/cached-data'
import type { Pixels } from '@/lib/floor-plan-crop'
import { getPayloadClient } from '@/lib/payload'

import type { TokenUsage } from './billing'
import { resolveModelEndpoint } from './server'
import { enabledAiModels, isVisionCapableModel, type AiModelConfig } from './templates'

export type VisionCallResult = {
  text: string
  usage: TokenUsage | null
  model: AiModelConfig
  durationMs: number
}

const modelText = (m: AiModelConfig) => `${m.id} ${m.apiModel} ${m.name}`.toLowerCase()

/** 视觉能力评分（与 Auto 路由的视觉档一致） */
export function visionScore(m: AiModelConfig): number {
  const s = modelText(m)
  if (!isVisionCapableModel(s)) return -1
  if (/qwen-?3\.7-plus/.test(s)) return 300
  if (/qwen-?3\.8(?!.*flash)/.test(s)) return 100
  if (/qwen-?3\.8.*flash/.test(s)) return 98
  if (/glm-?5\.3(?!.*flash)/.test(s)) return 96
  if (/qwen-?3\.7/.test(s)) return 94
  if (/qwen-?3\.6/.test(s)) return 92
  if (/qwen-vl-max/.test(s)) return 90
  if (/qvq/.test(s)) return 88
  if (/glm-?5\.3.*flash/.test(s)) return 86
  if (/glm-4v|doubao.*vision|vl|vision/.test(s)) return 80
  return 70
}

export const isReasoningOnlyModel = (m: AiModelConfig) =>
  Boolean(m.reasoning) || /reasoner|deepseek-r1|\br1\b|qwq|qvq|thinking/.test(modelText(m))

/**
 * 可用的视觉模型（已启用、可识图、已配置密钥），按能力从高到低。
 * 带图片的任务必须走视觉模型：会员档位允许的优先；档位内没有时仍由平台最强的视觉模型代为看图。
 */
export function rankVisionModels(
  models: AiModelConfig[],
  opts: { canAccessModel?: (m: AiModelConfig) => boolean } = {},
): AiModelConfig[] {
  const usable = enabledAiModels(models, { includeAuto: false }).filter(
    (m) => visionScore(m) > 0 && Boolean(resolveModelEndpoint(m).apiKey),
  )
  const sorted = [...usable].sort((a, b) => visionScore(b) - visionScore(a))
  if (!opts.canAccessModel) return sorted
  const accessible = sorted.filter(opts.canAccessModel)
  return [...accessible, ...sorted.filter((m) => !accessible.includes(m))]
}

export async function getVisionModels(
  opts: { userId?: string | number | null; canAccessModel?: (m: AiModelConfig) => boolean } = {},
) {
  const company = await getCompanyInfo(opts.userId ?? null).catch(() => null)
  return rankVisionModels(company?.aiModels ?? [], { canAccessModel: opts.canAccessModel })
}

/** 不同渠道的图片字段格式：智谱要求裸 base64，其余 OpenAI 兼容渠道使用 data URL。 */
export function providerImageUrl(model: AiModelConfig, image: string) {
  if (model.channelId === 'zhipu' && image.startsWith('data:'))
    return image.slice(image.indexOf(',') + 1)
  return image
}

function messageText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((p) =>
        p && typeof p === 'object' && typeof (p as { text?: unknown }).text === 'string'
          ? (p as { text: string }).text
          : '',
      )
      .join('')
  }
  return ''
}

/**
 * 调用视觉模型（流式聚合，兼容只支持流式输出的视觉推理模型）。
 * 依次尝试候选模型，任何一个成功即返回；全部失败返回 null，由调用方降级处理。
 */
export async function callVision(opts: {
  images: string[]
  prompt: string
  system?: string
  models: AiModelConfig[]
  maxTokens?: number
  temperature?: number
  timeoutMs?: number
  maxAttempts?: number
  signal?: AbortSignal
  /** 是否允许混合推理模型输出长思考链；结构化 JSON 识图默认关闭以大幅降低首包与总耗时 */
  thinking?: boolean
  /** 是否开启百炼 vl_high_resolution_images；放大局部拼图等无需重复开启 */
  highResolution?: boolean
}): Promise<VisionCallResult | null> {
  const attempts = opts.models.slice(0, Math.max(1, opts.maxAttempts ?? 3))
  for (const model of attempts) {
    const { url, apiKey } = resolveModelEndpoint(model)
    if (!url || !apiKey) continue
    const t0 = Date.now()
    const content = [
      ...opts.images.map((img) => ({
        type: 'image_url',
        image_url: { url: providerImageUrl(model, img) },
      })),
      { type: 'text', text: opts.prompt },
    ]
    const body: Record<string, unknown> = {
      model: model.apiModel || model.id,
      messages: [
        ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
        { role: 'user', content },
      ],
      max_tokens: opts.maxTokens ?? 2000,
      stream: true,
      stream_options: { include_usage: true },
    }
    const mText = modelText(model)
    if (!isReasoningOnlyModel(model)) {
      body.temperature = opts.temperature ?? 0.1
      // Qwen 3.x 等混合推理模型在百炼/兼容网关默认开启思考链，结构化识图显式关闭可提速 2~4 倍
      if (!opts.thinking && (model.channelId === 'dashscope' || /qwen-?3/.test(mText))) {
        body.enable_thinking = false
      }
    }
    // 百炼视觉模型：开启高分辨率，看清图纸里的小字与小符号
    if (model.channelId === 'dashscope' && opts.highResolution !== false)
      body.vl_high_resolution_images = true

    // 首包等待 + 流式分片空闲续期：只要模型仍在持续吐字，就不会因为总时长满 60s 被强制掐断
    const firstByteMs = opts.timeoutMs ?? 60_000
    const idleMs = Math.min(Math.max(Math.round(firstByteMs * 0.6), 20_000), 45_000)
    const hardCapMs = Math.max(firstByteMs * 3, 180_000)
    const abortCtrl = new AbortController()
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(
      () =>
        abortCtrl.abort(
          new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
        ),
      firstByteMs,
    )
    const hardTimer = setTimeout(
      () =>
        abortCtrl.abort(
          new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
        ),
      hardCapMs,
    )
    const touchTimer = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(
        () =>
          abortCtrl.abort(
            new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
          ),
        idleMs,
      )
    }
    const clearTimers = () => {
      if (timer) clearTimeout(timer)
      timer = null
      clearTimeout(hardTimer)
    }
    const signal = opts.signal ? AbortSignal.any([abortCtrl.signal, opts.signal]) : abortCtrl.signal
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      })
      touchTimer()
      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => '')
        console.warn('[vision] provider status', model.id, res.status, detail.slice(0, 200))
        continue
      }
      const ctype = res.headers.get('content-type') ?? ''
      let text = ''
      let usage: TokenUsage | null = null
      if (ctype.includes('application/json')) {
        // 个别网关忽略 stream 参数直接返回整段 JSON
        const json = (await res.json().catch(() => null)) as {
          choices?: { message?: { content?: unknown } }[]
          usage?: TokenUsage
        } | null
        text = messageText(json?.choices?.[0]?.message?.content)
        usage = json?.usage ?? null
      } else {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        const handleLine = (line: string) => {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) return
          const data = trimmed.replace(/^data:\s*/, '')
          if (!data || data === '[DONE]') return
          try {
            const chunk = JSON.parse(data) as {
              choices?: { delta?: { content?: unknown } }[]
              usage?: TokenUsage | null
            }
            if (chunk.usage) usage = chunk.usage
            const piece = messageText(chunk.choices?.[0]?.delta?.content)
            if (piece) text += piece
          } catch {
            // 忽略不完整的行
          }
        }
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          touchTimer()
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) handleLine(line)
        }
        // 最后一个分片（常是 usage）可能不带换行
        buffer += decoder.decode()
        if (buffer.trim()) handleLine(buffer)
      }
      if (!text.trim()) {
        console.warn('[vision] empty response', model.id)
        continue
      }
      return { text: text.trim(), usage, model, durationMs: Date.now() - t0 }
    } catch (error) {
      if (opts.signal?.aborted) return null
      console.warn('[vision] call failed', model.id, (error as Error)?.message)
    } finally {
      clearTimers()
    }
  }
  return null
}

/** 从模型输出中稳健地提取 JSON（兼容 ```json 代码块、前后解释文字与尾逗号）。 */
export function extractJson<T = unknown>(text: string | null | undefined): T | null {
  if (!text) return null
  let s = text.trim()
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(s)
  if (fence) s = fence[1].trim()
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  const body = s.slice(start, end + 1)
  try {
    return JSON.parse(body) as T
  } catch {
    try {
      return JSON.parse(body.replace(/,\s*([}\]])/g, '$1')) as T
    } catch {
      return null
    }
  }
}

/** 压成视觉模型友好的 JPEG data URL（自动旋正、透明底转白、等比限制最长边）。 */
export async function encodeImageForVision(
  input: Buffer,
  opts: { maxSide?: number; quality?: number } = {},
): Promise<string> {
  const maxSide = opts.maxSide ?? 2400
  const out = await sharp(input, { failOn: 'none' })
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: opts.quality ?? 86, mozjpeg: true })
    .toBuffer()
  return `data:image/jpeg;base64,${out.toString('base64')}`
}

/* ---------------- 图片读取（内存缓存 + 媒体库地址） ---------------- */

const IMAGE_CACHE_LIMIT = 40
const imageBufferCache = new Map<string, Buffer>()

export function rememberImageBuffer(keys: (string | null | undefined)[], buf: Buffer) {
  for (const key of keys) {
    if (!key) continue
    imageBufferCache.delete(key)
    imageBufferCache.set(key, buf)
  }
  while (imageBufferCache.size > IMAGE_CACHE_LIMIT) {
    const oldest = imageBufferCache.keys().next().value
    if (oldest === undefined) break
    imageBufferCache.delete(oldest)
  }
}

const SAFE_RELATIVE = /^\/(api\/media\/file|demo-plans|proposal|board)\//

function siteOrigins(): string[] {
  const out: string[] = [`http://127.0.0.1:${process.env.PORT || '3000'}`]
  for (const raw of [
    process.env.PUBLIC_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.FIGMA_PUBLIC_URL,
  ]) {
    if (!raw) continue
    try {
      out.push(new URL(raw).origin)
    } catch {
      // ignore invalid env value
    }
  }
  return [...new Set(out)]
}

/** 自托管媒体库原图直读：/api/media/file 会按需转 WebP 缩图，识别必须用原始文件。 */
function localMediaFile(url: string): string | null {
  try {
    const pathname = url.startsWith('/') ? url.split('?')[0] : new URL(url).pathname
    const match = /^\/api\/media\/file\/([^/]+)$/.exec(pathname)
    if (!match) return null
    const name = decodeURIComponent(match[1])
    if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\\'))
      return null
    const file = path.join(process.env.MEDIA_DIR || '/data/media', name)
    return existsSync(file) ? file : null
  } catch {
    return null
  }
}
/**
 * 读取图片原始字节：内存缓存 → data URL → 自托管媒体库原图 → 本站媒体库地址（只允许站内路径，杜绝 SSRF）→ 按 mediaId 查媒体库地址。
 */
export async function loadImageBuffer(ref: {
  mediaId?: string | null
  url?: string | null
}): Promise<Buffer | null> {
  const keys = [ref.mediaId, ref.url].filter((k): k is string => Boolean(k))
  for (const key of keys) {
    const hit = imageBufferCache.get(key)
    if (hit) return hit
  }
  let url = ref.url?.trim() || ''
  if (url.startsWith('data:image/')) {
    const b64 = url.slice(url.indexOf(',') + 1)
    const buf = b64 ? Buffer.from(b64, 'base64') : null
    if (buf?.length) rememberImageBuffer(keys, buf)
    return buf?.length ? buf : null
  }
  if (!url && ref.mediaId) {
    const payload = await getPayloadClient()
    const media = await payload
      .findByID({ collection: 'media', id: ref.mediaId, depth: 0, overrideAccess: true })
      .catch(() => null)
    url =
      (media?.url as string | undefined) ||
      (media?.filename ? `/api/media/file/${media.filename}` : '')
  }
  if (!url) return null
  const localFile = localMediaFile(url)
  if (localFile) {
    const buf = readFileSync(localFile)
    if (buf.length) {
      rememberImageBuffer(keys, buf)
      return buf
    }
  }
  const origins = siteOrigins()
  let targets: string[] = []
  if (url.startsWith('/')) {
    if (!SAFE_RELATIVE.test(url)) return null
    targets = origins.map((o) => `${o}${url}`)
  } else {
    try {
      const parsed = new URL(url)
      if (!origins.includes(parsed.origin) || !SAFE_RELATIVE.test(parsed.pathname)) return null
      targets = [`${origins[0]}${parsed.pathname}${parsed.search}`, url]
    } catch {
      return null
    }
  }
  for (const target of targets) {
    try {
      const res = await fetch(target, { signal: AbortSignal.timeout(12_000) })
      if (!res.ok) continue
      const buf = Buffer.from(await res.arrayBuffer())
      if (!buf.length) continue
      rememberImageBuffer(keys, buf)
      return buf
    } catch {
      // 尝试下一个地址
    }
  }
  return null
}

export async function loadImageDataUrlForVision(
  ref: { mediaId?: string | null; url?: string | null },
  maxSide = 2048,
): Promise<string | null> {
  const buf = await loadImageBuffer(ref)
  if (!buf) return null
  try {
    return await encodeImageForVision(buf, { maxSide })
  } catch {
    return null
  }
}

/* ---------------- 候选点位局部放大拼图（逐格复核） ---------------- */

// 5×7 点阵数字，拼图编号不依赖服务器字体（Docker 精简镜像通常没有中文/拉丁字体）
const DIGITS: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
}

export type PatchSheet = { dataUrl: string; indices: number[] }

/**
 * 把候选点（归一化坐标）周围 crop×crop 像素放大 scale 倍拼成网格，格子中心画红色准星、左上角画编号。
 * 每张拼图最多 perSheet 格，总数最多 maxTotal 格。
 */
export async function buildPatchSheets(
  pixels: Pixels,
  points: { x: number; y: number }[],
  opts: { crop?: number; scale?: number; cols?: number; perSheet?: number; maxTotal?: number } = {},
): Promise<PatchSheet[]> {
  const { data: src, width: W, height: H } = pixels
  const ch = pixels.channels ?? 4
  const crop = opts.crop ?? 72
  const scale = opts.scale ?? 3
  const cols = opts.cols ?? 6
  const perSheet = opts.perSheet ?? 36
  const maxTotal = opts.maxTotal ?? 108
  const cell = crop * scale
  const gap = 6
  const list = points.slice(0, maxTotal)
  const sheets: PatchSheet[] = []

  for (let start = 0; start < list.length; start += perSheet) {
    const chunk = list.slice(start, start + perSheet)
    const rows = Math.ceil(chunk.length / cols)
    const usedCols = Math.min(cols, chunk.length)
    const CW = usedCols * cell + (usedCols + 1) * gap
    const CH = rows * cell + (rows + 1) * gap
    const canvas = Buffer.alloc(CW * CH * 3, 0xe5)
    const put = (x: number, y: number, r: number, g: number, b: number) => {
      if (x < 0 || y < 0 || x >= CW || y >= CH) return
      const i = (y * CW + x) * 3
      canvas[i] = r
      canvas[i + 1] = g
      canvas[i + 2] = b
    }
    chunk.forEach((p, k) => {
      const col = k % cols
      const row = Math.floor(k / cols)
      const ox = gap + col * (cell + gap)
      const oy = gap + row * (cell + gap)
      const cx = Math.round(p.x * W)
      const cy = Math.round(p.y * H)
      const x0 = cx - crop / 2
      const y0 = cy - crop / 2
      // 最近邻放大：图纸小字与色块边缘保持清晰
      for (let yy = 0; yy < cell; yy++) {
        const sy = Math.floor(y0 + yy / scale)
        for (let xx = 0; xx < cell; xx++) {
          const sx = Math.floor(x0 + xx / scale)
          if (sx < 0 || sy < 0 || sx >= W || sy >= H) {
            put(ox + xx, oy + yy, 255, 255, 255)
            continue
          }
          const si = (sy * W + sx) * ch
          const a = ch === 4 ? src[si + 3] / 255 : 1
          put(
            ox + xx,
            oy + yy,
            Math.round(src[si] * a + 255 * (1 - a)),
            Math.round(src[si + 1] * a + 255 * (1 - a)),
            Math.round(src[si + 2] * a + 255 * (1 - a)),
          )
        }
      }
      // 红色准星：中心留空，只画外圈与四个方向的短刻度，不遮挡符号本身
      const mx = ox + cell / 2
      const my = oy + cell / 2
      const ring = Math.round(cell * 0.11)
      for (let t = 0; t < 360; t += 2) {
        const rad = (t * Math.PI) / 180
        for (const rr of [ring, ring + 1])
          put(Math.round(mx + rr * Math.cos(rad)), Math.round(my + rr * Math.sin(rad)), 239, 68, 68)
      }
      for (let d = ring + 4; d <= ring + 14; d++) {
        for (const w of [0, 1]) {
          put(mx + d, my + w, 239, 68, 68)
          put(mx - d, my + w, 239, 68, 68)
          put(mx + w, my + d, 239, 68, 68)
          put(mx + w, my - d, 239, 68, 68)
        }
      }
      // 编号：白底黑字点阵
      const label = String(k + 1)
      const dot = 3
      const boxW = label.length * 6 * dot + dot * 2
      const boxH = 7 * dot + dot * 2
      for (let yy = 0; yy < boxH; yy++)
        for (let xx = 0; xx < boxW; xx++) put(ox + 2 + xx, oy + 2 + yy, 255, 255, 255)
      ;[...label].forEach((digit, di) => {
        const glyph = DIGITS[digit]
        if (!glyph) return
        glyph.forEach((rowBits, gy) => {
          for (let gx = 0; gx < 5; gx++) {
            if (rowBits[gx] !== '1') continue
            for (let py = 0; py < dot; py++)
              for (let px = 0; px < dot; px++)
                put(
                  ox + 2 + dot + di * 6 * dot + gx * dot + px,
                  oy + 2 + dot + gy * dot + py,
                  17,
                  24,
                  39,
                )
          }
        })
      })
    })
    const jpg = await sharp(canvas, { raw: { width: CW, height: CH, channels: 3 } })
      .jpeg({ quality: 90 })
      .toBuffer()
    sheets.push({
      dataUrl: `data:image/jpeg;base64,${jpg.toString('base64')}`,
      indices: chunk.map((_, k) => start + k),
    })
  }
  return sheets
}
