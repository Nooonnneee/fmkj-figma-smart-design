import { detectCadSymbolsFromPixels } from '@/lib/cad-point-detector'
import { normalizeFloorPlan } from '@/lib/floor-plan-normalize'
import { getPayloadClient } from '@/lib/payload'
import { SHEET } from '@/lib/sheet-spec'

const fail = (status: number, error: string) => Response.json({ ok: false, error }, { status })

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
  const detected = detectCadSymbolsFromPixels(normalized.pixels)
  const payload = await getPayloadClient()
  const media = await payload.create({
    collection: 'media',
    data: { alt: `户型图 · ${baseName}` },
    file: { data: normalized.png, mimetype: 'image/png', name: `sheet-${Date.now().toString(36)}.png`, size: normalized.png.length },
    overrideAccess: true,
    depth: 0,
  })
  if (!media.url) return { error: fail(500, '图片保存失败，请稍后重试') }
  return {
    upload: {
      mediaId: String(media.id),
      url: media.url,
      name: baseName,
      width: SHEET.pixelWidth,
      height: SHEET.pixelHeight,
      cropped: normalized.cropped,
      detectedPointCount: detected.points.length,
      detectedPoints: detected.points,
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
