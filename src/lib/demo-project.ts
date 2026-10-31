import { DEFAULT_CONTRACT_TERMS, DEFAULT_DURATION_DAYS, DEFAULT_PAYMENTS, DEFAULT_WARRANTY_MONTHS } from '@/lib/contracts'
import { relId } from '@/lib/access'
import { getPayloadClient } from '@/lib/payload'
import type { Project, Quote } from '@/payload-types'

/**
 * 为新注册/新建的成员账号自动发放一份独立的示例项目副本（含三层点位图、默认选型与示例报价单）。
 * 副本的 owner 为该新用户自己，用户可以自由编辑点位、改报价、打印导出或直接删除，互不影响。
 */
export async function cloneDemoProjectForUser(userId: string | number): Promise<string | null> {
  const uid = String(userId).trim()
  if (!uid) return null

  try {
    const payload = await getPayloadClient()
    // 查找标记为 isDemoTemplate 的母版项目；若尚未标记则兜底查找 owner 为空的示例项目
    let template: Project | null = null
    const byFlag = await payload
      .find({
        collection: 'projects',
        where: { isDemoTemplate: { equals: true } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      .catch(() => null)
    template = (byFlag?.docs?.[0] as Project | undefined) ?? null

    if (!template) {
      const byOwnerless = await payload
        .find({
          collection: 'projects',
          where: { owner: { exists: false } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        .catch(() => null)
      template = (byOwnerless?.docs?.[0] as Project | undefined) ?? null
    }
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
