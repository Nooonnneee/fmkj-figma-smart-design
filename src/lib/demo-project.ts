import { DEFAULT_CONTRACT_TERMS, DEFAULT_DURATION_DAYS, DEFAULT_PAYMENTS, DEFAULT_WARRANTY_MONTHS } from '@/lib/contracts'
import { relId } from '@/lib/access'
import { PLAN_H, PLAN_POINTS, PLAN_ROOMS, PLAN_W } from '@/components/landing/demo-data'
import { DEVICE_TYPE_ORDER } from '@/lib/device-types'
import { getPayloadClient } from '@/lib/payload'
import { buildAreaElements, buildPointElements, buildSheetElements, compactScene, markerFile, type SceneEl, type SceneFile } from '@/lib/point-scene'
import { inPointScope } from '@/lib/point-scopes'
import { SHEET, sheetOrigin } from '@/lib/sheet-spec'
import type { Product, Project, Quote } from '@/payload-types'

const DEMO_TEMPLATE_NAME = '【示例】湖山赋别墅全屋智能'

/**
 * 构造内置的「湖山赋别墅全屋智能」点位图场景（含 1F/2F/3F 三张标准图纸、房间分区与点位），
 * 当自托管数据库尚未创建 `isDemoTemplate: true` 的母版项目时自动初始化。
 */
function buildBuiltinDemoScene(defaultProducts: Record<string, string>) {
  const elements: SceneEl[] = []
  const files: Record<string, SceneFile> = {}
  const sheetDefs = [
    { index: 0, id: 'sh-demo-1f', name: '1F 一层平面图' },
    { index: 1, id: 'sh-demo-2f', name: '2F 二层卧室区' },
    { index: 2, id: 'sh-demo-3f', name: '3F 三层主卧套房' },
  ]

  for (const s of sheetDefs) {
    const fileId = `sheet-file-${s.id}`
    files[fileId] = { id: fileId, dataURL: '/blank-sheet.svg', mimeType: 'image/svg+xml' }
    elements.push(...buildSheetElements({ index: s.index, name: s.name, fileId, sheetId: s.id }))
  }

  // 将示例房间与点位按比例映射到标准图纸尺寸上
  const scaleX = SHEET.width / PLAN_W
  const scaleY = SHEET.height / PLAN_H
  const origin1F = sheetOrigin(0)
  for (const r of PLAN_ROOMS) {
    elements.push(
      ...buildAreaElements({
        name: r.name,
        x: origin1F.x + Math.round(r.x * scaleX),
        y: origin1F.y + Math.round(r.y * scaleY),
        width: Math.round(r.w * scaleX),
        height: Math.round(r.h * scaleY),
      }),
    )
  }

  for (const p of PLAN_POINTS) {
    files[`mk2-${p.type}`] = markerFile(p.type)
    elements.push(
      ...buildPointElements({
        deviceType: p.type,
        cx: origin1F.x + Math.round(p.x * scaleX),
        cy: origin1F.y + Math.round(p.y * scaleY),
        code: p.code,
        productId: defaultProducts[p.type] ?? null,
      }),
    )
  }

  return compactScene(elements, files)
}

/**
 * 确保数据库中存在一份 `isDemoTemplate: true` 的「【示例】湖山赋别墅全屋智能」母版项目及其 2 份示例报价单。
 * 若自托管环境首次运行尚未创建母版，自动结合当前产品库初始化一份。
 */
export async function ensureDemoTemplateProject(): Promise<Project | null> {
  const payload = await getPayloadClient()
  const byFlag = await payload
    .find({
      collection: 'projects',
      where: { isDemoTemplate: { equals: true } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)
  if (byFlag?.docs?.[0]) return byFlag.docs[0] as Project

  const byOwnerless = await payload
    .find({
      collection: 'projects',
      where: { owner: { exists: false } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)
  if (byOwnerless?.docs?.[0]) {
    const updated = await payload
      .update({
        collection: 'projects',
        id: byOwnerless.docs[0].id,
        data: { isDemoTemplate: true, name: DEMO_TEMPLATE_NAME, community: '湖山赋' } as never,
        overrideAccess: true,
        depth: 0,
      })
      .catch(() => byOwnerless.docs[0])
    return updated as Project
  }

  // 数据库中没有任何母版项目时，根据当前产品库自动初始化母版项目与两份示例报价单
  const productsRes = await payload
    .find({
      collection: 'products',
      where: { status: { equals: 'active' } },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)
  const allProducts = (productsRes?.docs ?? []) as Product[]
  const byType = new Map<string, Product>()
  for (const prod of allProducts) {
    if (!prod.deviceType) continue
    const existing = byType.get(prod.deviceType)
    const prefersMijia = Array.isArray(prod.platforms) && prod.platforms.includes('米家')
    if (!existing || prefersMijia) {
      byType.set(prod.deviceType, prod)
    }
  }

  const defaultProducts: Record<string, string> = {}
  for (const [dtype, prod] of byType.entries()) {
    defaultProducts[dtype] = String(prod.id)
  }

  const pointMap = buildBuiltinDemoScene(defaultProducts)
  const template = (await payload.create({
    collection: 'projects',
    data: {
      name: DEMO_TEMPLATE_NAME,
      customerName: '林先生',
      customerPhone: '13800008888',
      community: '湖山赋',
      address: 'A区 12栋（三层联排别墅）',
      platform: '米家',
      budget: 55000,
      status: 'active',
      owner: null,
      isDemoTemplate: true,
      notes: '系统内置的全屋智能演示项目（含点位图、智能选型、报价单与合同），你可以自由修改点位、导出打印或直接删除。',
      pointMap,
      defaultProducts,
    } as never,
    overrideAccess: true,
    depth: 0,
  })) as Project

  // 按点位统计各设备类型数量，生成「含灯具」和「不含灯具」两份母版报价单
  const counts = new Map<string, number>()
  for (const pt of PLAN_POINTS) {
    counts.set(pt.type, (counts.get(pt.type) ?? 0) + 1)
  }
  const buildItems = (scope: 'all' | 'no-light') => {
    const rows: Array<Record<string, unknown>> = []
    const types = DEVICE_TYPE_ORDER.filter((t) => counts.has(t) && inPointScope(t, scope))
    for (const dtype of types) {
      const prod = byType.get(dtype)
      const qty = counts.get(dtype) ?? 1
      rows.push({
        product: prod ? String(prod.id) : null,
        deviceType: dtype,
        image: prod ? relId(prod.image) || null : null,
        name: prod?.name ?? `智能${dtype}设备`,
        sku: prod?.sku ?? `DEMO-${dtype.toUpperCase()}`,
        unit: prod?.unit ?? '个',
        price: typeof prod?.price === 'number' ? prod.price : 199,
        quantity: qty,
      })
    }
    return rows
  }

  const fullItems = buildItems('all')
  const noLightItems = buildItems('no-light')

  await payload
    .create({
      collection: 'quotes',
      data: {
        title: '湖山赋 全屋智能整装报价（含灯具）',
        project: String(template.id),
        status: 'accepted',
        items: fullItems,
        fees: [{ name: '安装调试费', amount: 1800 }],
        discount: 0,
        notes: '含全屋智能开关、调光灯具、电动窗帘、传感器及全屋 Wi-Fi 7 组网。',
      } as never,
      overrideAccess: true,
      depth: 0,
    })
    .catch(() => null)

  await payload
    .create({
      collection: 'quotes',
      data: {
        title: '湖山赋 全屋智能报价（不含灯具）',
        project: String(template.id),
        status: 'draft',
        items: noLightItems,
        fees: [],
        discount: 0,
        notes: '不含照明灯具，仅含智能控制、传感、窗帘与全屋网络。',
      } as never,
      overrideAccess: true,
      depth: 0,
    })
    .catch(() => null)

  return template
}

/**
 * 为新注册/新建的成员账号自动发放一份独立的示例项目副本（含三层点位图、默认选型与示例报价单）。
 * 副本的 owner 为该新用户自己，用户可以自由编辑点位、改报价、打印导出或直接删除，互不影响。
 */
export async function cloneDemoProjectForUser(userId: string | number): Promise<string | null> {
  const uid = String(userId).trim()
  if (!uid) return null

  try {
    const payload = await getPayloadClient()
    const template = await ensureDemoTemplateProject()
    if (!template) return null

    // 避免同一用户重复发放示例项目
    const existing = await payload.count({
      collection: 'projects',
      where: {
        and: [{ owner: { equals: uid } }, { name: { equals: template.name } }],
      },
      overrideAccess: true,
    })
    if (existing.totalDocs > 0) return null

    const createdProject = await payload.create({
      collection: 'projects',
      data: {
        name: template.name,
        customerName: template.customerName ?? '林先生',
        customerPhone: template.customerPhone ?? '13800008888',
        community: template.community ?? '湖山赋',
        address: template.address ?? 'A区 12栋（三层联排别墅）',
        platform: template.platform ?? '米家',
        budget: template.budget ?? 55000,
        status: 'active',
        owner: uid,
        isDemoTemplate: false,
        notes:
          template.notes ??
          '系统为你准备的全屋智能示例项目（含一层/二层/三层点位图、智能选型与示例报价单），你可以自由修改点位、导出打印或直接删除。',
        pointMap: template.pointMap ?? null,
        defaultProducts: template.defaultProducts ?? null,
      } as never,
      overrideAccess: true,
      depth: 0,
    })

    const newProjectId = String(createdProject.id)

    // 同步克隆母版项目下的示例报价单
    const templateQuotes = await payload
      .find({
        collection: 'quotes',
        where: { project: { equals: template.id } },
        sort: 'createdAt',
        limit: 5,
        depth: 0,
        overrideAccess: true,
      })
      .catch(() => null)

    for (const q of (templateQuotes?.docs ?? []) as Quote[]) {
      const cleanItems = (q.items ?? []).map((item) => ({
        product: relId(item.product) || null,
        deviceType: item.deviceType ?? null,
        image: relId(item.image) || null,
        name: item.name,
        sku: item.sku ?? null,
        unit: item.unit ?? '个',
        price: item.price,
        quantity: item.quantity,
      }))
      const cleanFees = (q.fees ?? []).map((fee) => ({
        name: fee.name,
        amount: fee.amount,
      }))
      const clonedQuote = await payload
        .create({
          collection: 'quotes',
          data: {
            title: q.title,
            project: newProjectId,
            status: q.status ?? 'draft',
            items: cleanItems,
            fees: cleanFees,
            discount: q.discount ?? 0,
            notes: q.notes ?? null,
          } as never,
          overrideAccess: true,
          depth: 0,
        })
        .catch((err) => {
          console.error('[demo-project] clone quote failed', err)
          return null
        })
      if (clonedQuote && q.status === 'accepted') {
        await payload
          .create({
            collection: 'contracts',
            data: {
              project: newProjectId,
              quote: String(clonedQuote.id),
              status: 'draft',
              amount: q.total ?? 51820,
              customerName: template.customerName ?? '林先生',
              customerPhone: template.customerPhone ?? '13800008888',
              address: [template.community ?? '湖山赋', template.address ?? 'A区 12栋（三层联排别墅）'].filter(Boolean).join(' '),
              durationDays: DEFAULT_DURATION_DAYS,
              warrantyMonths: DEFAULT_WARRANTY_MONTHS,
              payments: DEFAULT_PAYMENTS.map((p) => ({ name: p.name, percent: p.percent, received: false })),
              terms: DEFAULT_CONTRACT_TERMS,
            } as never,
            overrideAccess: true,
            depth: 0,
          })
          .catch(() => null)
      }
    }

    return newProjectId
  } catch (err) {
    console.error('[demo-project] cloneDemoProjectForUser failed', err)
    return null
  }
}
