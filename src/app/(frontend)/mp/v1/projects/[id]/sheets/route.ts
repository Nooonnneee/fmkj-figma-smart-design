import { fail, mpRoute, ok } from '@/lib/mp/http'
import { addSheetImage } from '@/lib/services/point-map-service'
import { prepareFloorPlanUpload } from '@/plugins/ai-copilot/upload-handler'

/**
 * 上传户型图（wx.uploadFile，字段 file，可带 name、recognize=1）：
 * 自动裁掉图框和标题栏，放进标准图纸；recognize=1 时把识别到的 CAD 开关符号生成点位，识别不到不生成任何点位。
 */
export const POST = mpRoute<{ id: string }>(async ({ request, user, params }) => {
  const recognize = new URL(request.url).searchParams.get('recognize') === '1'
  const prepared = await prepareFloorPlanUpload(request)
  if (prepared.error) return prepared.error
  const up = prepared.upload!
  const r = await addSheetImage(user, params.id, { url: up.url, mediaId: up.mediaId, name: up.name, detectedPoints: recognize ? up.detectedPoints : [] })
  return r.ok ? ok({ sheetId: r.sheetId, sheetName: r.sheetName, recognizedPoints: r.recognizedPoints, cropped: up.cropped, url: up.url }) : fail(r.status, r.error)
})
