import { NextResponse } from 'next/server'

import { appAuth } from '@/lib/app-auth'
import { chargeAiCredits } from '@/lib/credit-charge'
import { getPayloadClient } from '@/lib/payload'
import { STYLE_TEMPLATES } from '@/lib/style-templates'
import { getPluginFlags } from '@/plugins/state'
import {
  STYLE_TRANSFER_COST,
  StyleTransferError,
  generateStyledFloorPlan,
  styleTransferConfigured,
} from '@/plugins/ai-copilot/style-transfer'

export const maxDuration = 300

export async function GET() {
  return NextResponse.json({
    ok: true,
    configured: styleTransferConfigured(),
    cost: STYLE_TRANSFER_COST,
    templates: STYLE_TEMPLATES.map(({ id, name, description, file }) => ({
      id,
      name,
      description,
      file,
    })),
  })
}

export async function POST(request: Request) {
  const user = await appAuth.getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: '请先登录' }, { status: 401 })
  const flags = await getPluginFlags(user.id)
  if (!flags['ai-copilot'])
    return NextResponse.json({ ok: false, error: 'AI 插件已关闭' }, { status: 404 })
  if (!styleTransferConfigured()) {
    return NextResponse.json(
      { ok: false, error: '服务器尚未配置 AI_APIKEY_FAN_KEY' },
      { status: 503 },
    )
  }

  const body = (await request.json().catch(() => null)) as {
    sourceImage?: unknown
    styleId?: unknown
    note?: unknown
  } | null
  const sourceImage = typeof body?.sourceImage === 'string' ? body.sourceImage : ''
  const styleId = typeof body?.styleId === 'string' ? body.styleId : ''
  const note = typeof body?.note === 'string' ? body.note : ''
  if (!sourceImage) return NextResponse.json({ ok: false, error: '请上传户型图' }, { status: 400 })
  if (!styleId) return NextResponse.json({ ok: false, error: '请选择风格模板' }, { status: 400 })

  const payload = await getPayloadClient()
  const fresh = await payload.findByID({
    collection: 'users',
    id: user.id,
    depth: 0,
    overrideAccess: true,
    select: { aiCredits: true },
  })
  if ((fresh.aiCredits ?? 0) < STYLE_TRANSFER_COST) {
    return NextResponse.json(
      { ok: false, error: `积分不足，户型风格化需要 ${STYLE_TRANSFER_COST} 积分` },
      { status: 402 },
    )
  }

  try {
    const image = await generateStyledFloorPlan({
      sourceImage,
      styleId,
      note,
      userId: user.id,
    })
    // 记账失败不让风格化失败；重试一次并留下结构化记录（见 chargeAiCredits）。
    const balance = await chargeAiCredits(payload, {
      user: user.id,
      delta: -STYLE_TRANSFER_COST,
      reason: 'AI 户型图风格化 · 风格模板',
    })
    return NextResponse.json({ ok: true, ...image, cost: STYLE_TRANSFER_COST, balance })
  } catch (error) {
    const status = error instanceof StyleTransferError ? 400 : 500
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '风格化失败' },
      { status },
    )
  }
}
