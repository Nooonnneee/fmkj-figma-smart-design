/**
 * 户型图风格化：原图锁定布局，风格模板只做参考。
 * 使用 api.apikey.fan 的 OpenAI 兼容 images/edits（多图 + mask）。
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

import { getPayloadClient } from '@/lib/payload'
import { styleTemplateById } from '@/lib/style-templates'

const BASE_URL = process.env.AI_APIKEY_FAN_BASE_URL || 'https://api.apikey.fan/v1'
const MODEL = process.env.AI_APIKEY_FAN_IMAGE_MODEL || 'gpt-image-2.5-flare'
const SIZE = '1536*1024'

export const STYLE_TRANSFER_COST = 8

export const styleTransferConfigured = () => Boolean(process.env.AI_APIKEY_FAN_KEY?.trim())

export class StyleTransferError extends Error {}

function decodeDataUrl(image: string): Buffer {
  const match = /^data:image\/(?:png|jpe?g|webp);base64,([\s\S]+)$/i.exec(image.trim())
  if (!match) throw new StyleTransferError('源户型图格式不支持，请上传 PNG/JPG/WebP')
  const buffer = Buffer.from(match[1], 'base64')
  if (buffer.length < 1024) throw new StyleTransferError('源户型图内容为空')
  if (buffer.length > 12 * 1024 * 1024) throw new StyleTransferError('源户型图不能超过 12MB')
  return buffer
}

/** 把墙线做成 mask：墙线不透明（保留），其余透明（可编辑）。 */
async function buildWallMask(source: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(source, { failOn: 'none' })
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const rgba = Buffer.alloc(info.width * info.height * 4)
  for (let i = 0, j = 0; i < data.length; i += info.channels, j += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const dark = (r + g + b) / 3 < 170
    rgba[j] = 255
    rgba[j + 1] = 255
    rgba[j + 2] = 255
    rgba[j + 3] = dark ? 255 : 0
  }
  return sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer()
}

async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new StyleTransferError(`下载生成图失败：HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

export async function generateStyledFloorPlan(opts: {
  sourceImage: string
  styleId: string
  note?: string
  userId: string | number
}): Promise<{
  mediaId: string
  url: string
  width: number
  height: number
  model: string
  usedStyle: string
}> {
  const key = process.env.AI_APIKEY_FAN_KEY?.trim()
  if (!key) throw new StyleTransferError('服务器尚未配置 AI_APIKEY_FAN_KEY')
  const template = styleTemplateById(opts.styleId)
  if (!template) throw new StyleTransferError('风格模板不存在')

  const source = decodeDataUrl(opts.sourceImage)
  const stylePath = path.join(process.cwd(), 'public', template.file.replace(/^\//, ''))
  const style = await readFile(stylePath).catch(() => null)
  if (!style) throw new StyleTransferError('风格模板图片缺失')

  const prompt = [
    '第一张是客户户型平面图，必须严格保持墙体、房间数量、门窗位置和比例不变；',
    `第二张是风格参考：${template.prompt}。`,
    '请把第一张重绘成第二张那种精装修家具彩平图：保留户型结构，去掉电气符号、开关插座、尺寸标注和施工文字；',
    '补齐床、衣柜、沙发、餐桌椅、橱柜、洁具、地毯、绿植；房间名称可保留中英文小字。',
    '不要重新设计户型，不要改变墙线。',
    opts.note?.trim() ? `补充要求：${opts.note.trim().slice(0, 400)}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const form = new FormData()
  form.append('model', MODEL)
  form.append('prompt', prompt)
  form.append('size', SIZE)
  form.append(
    'image[]',
    new Blob([new Uint8Array(source)], { type: 'image/png' }),
    'source-plan.png',
  )
  form.append(
    'image[]',
    new Blob([new Uint8Array(style)], { type: 'image/jpeg' }),
    'style-reference.jpg',
  )
  form.append(
    'mask',
    new Blob([new Uint8Array(await buildWallMask(source))], { type: 'image/png' }),
    'wall-mask.png',
  )

  let res: Response
  try {
    res = await fetch(`${BASE_URL}/images/edits`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(300_000),
    })
  } catch (error) {
    throw new StyleTransferError(`风格化请求失败：${(error as Error).message}`)
  }
  const raw = await res.text()
  if (!res.ok) throw new StyleTransferError(`风格化接口返回 ${res.status}：${raw.slice(0, 300)}`)
  let parsed: { data?: Array<{ b64_json?: string; url?: string }> }
  try {
    parsed = JSON.parse(raw) as { data?: Array<{ b64_json?: string; url?: string }> }
  } catch {
    throw new StyleTransferError('风格化接口返回无法解析')
  }
  const item = parsed.data?.[0]
  const buffer = item?.b64_json
    ? Buffer.from(item.b64_json, 'base64')
    : item?.url
      ? await downloadImage(item.url)
      : null
  if (!buffer?.length) throw new StyleTransferError('风格化接口没有返回图片')

  const meta = await sharp(buffer)
    .metadata()
    .catch(() => null)
  const payload = await getPayloadClient()
  const media = await payload.create({
    collection: 'media',
    data: { alt: `AI 户型风格化 · ${template.name}` },
    file: {
      data: buffer,
      mimetype: 'image/png',
      name: `style-plan-${Date.now().toString(36)}.png`,
      size: buffer.length,
    },
    overrideAccess: true,
    depth: 0,
  })
  return {
    mediaId: String(media.id),
    url: media.url || `/api/media/file/${media.filename}`,
    width: meta?.width ?? 0,
    height: meta?.height ?? 0,
    model: MODEL,
    usedStyle: template.id,
  }
}
