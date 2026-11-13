import { relId } from '@/lib/access'
import {
  WARRANTY_STATUS_LABEL,
  isServiceBilling,
  isServiceRecordStatus,
  toShanghaiDay,
} from '@/lib/after-sales'
import { getBrands } from '@/lib/cached-data'
import { getPayloadClient } from '@/lib/payload'
import { readableError } from '@/lib/project-guards'
import { getPluginFlags } from '@/plugins/state'
import type { User } from '@/payload-types'

import { deleteContractById } from '@/lib/services/contract-service'
import { saveDeliverables } from '@/lib/services/deliverables-service'
import { deleteQuoteById } from '@/lib/services/quote-service'
import {
  deleteServiceRecord,
  loadAfterSales,
  normalizeServiceInput,
  saveServiceRecord,
  setServiceRecordStatus,
  type ServiceRecordInput,
} from '@/lib/services/after-sales-service'
import { saveShareSettings } from '@/lib/services/share-settings-service'

import {
  contractDeleteBlock,
  normalizeArchiveSettings,
  normalizeCompanySettings,
  normalizeCreateProduct,
  normalizeUpdateProduct,
  projectDeleteBlock,
  type AdminFieldErrors,
  type Normalized,
} from './admin-ai'
import type { AiToolHandler, ToolContext } from './context'

/**
 * 「日常管理」工具的 handler。
 *
 * 约束：
 * - 所有写入都带 `user` 且 `overrideAccess: false`，权限与业务规则由集合 access / hook 再兜底；
 * - 危险操作（删项目、删已签合同）在 handler 里先按网页规则预检，给出可读的中文原因；
 * - 校验失败返回 `{ error, fieldErrors }`，不静默吞掉。
 */

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

const failure = (error: string, fieldErrors?: AdminFieldErrors) => ({
  result: fieldErrors ? { error, fieldErrors } : { error },
  summary: error,
})

/* ------------------------------ 产品库 ------------------------------ */

/** 品牌只接受产品库已有的品牌（名称 / slug / ID），不会顺手新建品牌。 */
async function resolveBrandId(ref: string): Promise<string | null> {
  const brands = await getBrands()
  const needle = ref.trim().toLowerCase()
  return (
    brands.find((b) => b.id === ref)?.id ??
    brands.find((b) => b.name.trim().toLowerCase() === needle)?.id ??
    brands.find((b) => b.slug.trim().toLowerCase() === needle)?.id ??
    null
  )
}

/* ------------------------------ 售后维保 ------------------------------ */

/** 与网页售后页一致：插件未启用 / 项目无权访问时不允许登记。 */
async function afterSalesGate(user: User, projectId: string): Promise<string | null> {
  const payload = await getPayloadClient()
  const project = await payload
    .findByID({
      collection: 'projects',
      id: projectId,
      depth: 0,
      user,
      overrideAccess: false,
      select: { owner: true },
    })
    .catch(() => null)
  if (!project) return '项目不存在或无权访问'
  const flags = await getPluginFlags(relId(project.owner) ?? user.id)
  if (!flags['after-sales']) return '「售后维保记录」插件未启用或当前账号不可用'
  return null
}

export type AfterSalesToolData = { input: ServiceRecordInput; recordId: string | null }

/**
 * 把工具参数归一化成售后表单输入，并复用 after-sales-service 的纯校验函数。
 * 不传日期默认今天（与网页表单一致），不传类型默认「上门检修」。
 */
export function normalizeAfterSalesToolInput(
  args: Record<string, unknown>,
  today: string = toShanghaiDay(new Date()) ?? '',
): Normalized<AfterSalesToolData> {
  // normalizeServiceInput 对非法 status / billing 会静默回落到默认值；
  // 工具参数必须显式报错，不能把模型传错的值悄悄改掉。
  const explicitStatus = text(args.status, 20)
  const explicitBilling = text(args.billing, 20)
  const fieldErrors: AdminFieldErrors = {}
  if (explicitStatus && !isServiceRecordStatus(explicitStatus))
    fieldErrors.status = '状态只能是 open / scheduled / done'
  if (explicitBilling && !isServiceBilling(explicitBilling))
    fieldErrors.billing = '收费方式只能是 warranty / paid / free'
  if (Object.keys(fieldErrors).length)
    return {
      ok: false,
      error: Object.values(fieldErrors)[0] ?? '请检查维保记录内容',
      fieldErrors,
    }

  const input: ServiceRecordInput = {
    type: text(args.type, 30) || 'repair',
    title: text(args.title, 120),
    serviceDate: text(args.serviceDate, 10) || today,
    status: text(args.status, 20) || 'done',
    detail: text(args.detail, 2000),
    devices: text(args.devices, 500),
    billing: text(args.billing, 20) || 'warranty',
    fee:
      typeof args.fee === 'number' || typeof args.fee === 'string' || args.fee == null
        ? (args.fee as number | string | null)
        : null,
    technician: text(args.technician, 40),
    nextVisitAt: text(args.nextVisitAt, 10) || null,
  }
  const normalized = normalizeServiceInput(input)
  if (!normalized.ok) {
    return {
      ok: false,
      error: Object.values(normalized.fieldErrors)[0] ?? '请检查维保记录内容',
      fieldErrors: normalized.fieldErrors,
    }
  }
  return { ok: true, data: { input, recordId: text(args.recordId, 64) || null } }
}

/** 读取记录并确认它属于当前项目，避免用当前项目的权限误改别的项目记录。 */
async function findOwnedServiceRecord(user: User, projectId: string, recordId: string) {
  const payload = await getPayloadClient()
  const record = await payload
    .findByID({
      collection: 'service-records',
      id: recordId,
      depth: 0,
      user,
      overrideAccess: false,
      select: { project: true, title: true },
    })
    .catch(() => null)
  if (!record) return { ok: false as const, error: '记录不存在或已被删除' }
  if (relId(record.project) !== projectId)
    return { ok: false as const, error: '这条维保记录不属于当前项目' }
  return { ok: true as const, record }
}

/* ------------------------------ Handlers ------------------------------ */

const COMPANY_FIELD_LABELS: Record<string, string> = {
  name: '公司名称',
  slogan: '口号',
  phone: '电话',
  email: '邮箱',
  address: '地址',
  quoteNotes: '报价备注',
  contractTerms: '合同条款',
  printProductImages: '打印产品图开关',
}

export const adminToolHandlers: Record<string, AiToolHandler> = {
  async delete_project(args, ctx) {
    const projectId = text(args.projectId, 64) || text(ctx.projectId, 64)
    if (!projectId) return failure('没有指定要删除的项目')

    const payload = await getPayloadClient()
    const project = await payload
      .findByID({
        collection: 'projects',
        id: projectId,
        depth: 0,
        user: ctx.user,
        overrideAccess: false,
        select: { name: true, owner: true, status: true },
      })
      .catch(() => null)
    if (!project) return failure('项目不存在或无权访问')

    const isOwner = relId(project.owner) === String(ctx.user.id)
    let signedContracts = 0
    try {
      const signed = await payload.count({
        collection: 'contracts',
        where: {
          and: [{ project: { equals: projectId } }, { status: { equals: 'signed' } }],
        },
        user: ctx.user,
        overrideAccess: false,
      })
      signedContracts = signed.totalDocs
    } catch (error) {
      console.error('[ai] count signed contracts failed', error)
      return failure('检查项目合同时失败，请稍后重试')
    }

    const blocked = projectDeleteBlock({ isOwner, signedContracts })
    if (blocked) return failure(blocked)

    const byProject = { project: { equals: projectId } }
    try {
      // owner 校验在前，级联清理与 web action（projects/actions.ts::deleteProject）保持一致：
      // 合同/报价/对话清理使用 overrideAccess:true，最后删除项目仍按当前成员权限执行。
      // 这样既能把其他协作成员的 AI 对话解除关联，也能删除已归档项目（集合 beforeDelete 会按归档拦截成员）。
      await payload.delete({ collection: 'contracts', where: byProject, overrideAccess: true })
      await payload.delete({ collection: 'quotes', where: byProject, overrideAccess: true })
      // 对话保留，只解除项目关联。
      await payload.update({
        collection: 'ai-conversations',
        where: byProject,
        data: { project: null } as never,
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'projects',
        id: projectId,
        user: ctx.user,
        overrideAccess: false,
      })
    } catch (error) {
      console.error('[ai] delete project failed', error)
      return failure(readableError(error, '删除失败，请稍后再试'))
    }

    ctx.mutated = true
    // 删掉的正是当前对话关联的项目时，解除上下文，避免后续工具继续指向已删除 ID。
    if (ctx.projectId === projectId) {
      ctx.projectId = null
      ctx.project = null
    }
    return {
      result: { deleted: true, projectId, name: project.name },
      summary: `已删除项目「${project.name}」，并清理了报价与未签合同`,
      href: '/projects',
      hrefLabel: '返回项目列表',
    }
  },

  async delete_quote(args, ctx) {
    const quoteId = text(args.quoteId, 64) || text(args.id, 64)
    if (!quoteId) return failure('请提供要删除的报价单 ID')

    const payload = await getPayloadClient()
    const quote = await payload
      .findByID({
        collection: 'quotes',
        id: quoteId,
        depth: 0,
        user: ctx.user,
        overrideAccess: false,
        select: { title: true, project: true },
      })
      .catch(() => null)
    if (!quote) return failure('报价不存在或无权访问')

    const result = await deleteQuoteById(ctx.user, quoteId)
    if (!result.ok) return failure(result.error)

    ctx.mutated = true
    const projectId = relId(quote.project)
    return {
      result: { deleted: true, quoteId, title: quote.title },
      summary: `已删除报价「${quote.title}」`,
      ...(projectId ? { href: `/projects/${projectId}/quotes`, hrefLabel: '查看项目报价' } : {}),
    }
  },

  async delete_contract(args, ctx) {
    const contractId = text(args.contractId, 64) || text(args.id, 64)
    if (!contractId) return failure('请提供要删除的合同 ID')

    const payload = await getPayloadClient()
    const contract = await payload
      .findByID({
        collection: 'contracts',
        id: contractId,
        depth: 0,
        user: ctx.user,
        overrideAccess: false,
        select: { number: true, status: true, project: true },
      })
      .catch(() => null)
    if (!contract) return failure('合同不存在或无权访问')

    // 与 Contracts 集合 beforeDelete 相同的危险操作拦截，先给出明确提示。
    const blocked = contractDeleteBlock(contract.status)
    if (blocked) return failure(blocked)

    const result = await deleteContractById(ctx.user, contractId)
    if (!result.ok) return failure(result.error)

    ctx.mutated = true
    const projectId = relId(contract.project)
    return {
      result: { deleted: true, contractId, number: contract.number },
      summary: `已删除合同「${contract.number}」`,
      ...(projectId ? { href: `/projects/${projectId}/contract`, hrefLabel: '查看项目合同' } : {}),
    }
  },

  async create_product(args, ctx) {
    // 新增/改价已放开给所有 active 成员（2026-11-13 owner 批准），
    // 真正的权限由 Products 集合 access + user + overrideAccess:false 裁决。
    const normalized = normalizeCreateProduct(args)
    if (!normalized.ok) return failure(normalized.error, normalized.fieldErrors)

    const brandId = await resolveBrandId(normalized.data.brandRef)
    if (!brandId)
      return failure(`未找到品牌「${normalized.data.brandRef}」，请先在后台品牌库创建该品牌`, {
        brand: '品牌不存在',
      })

    const payload = await getPayloadClient()
    const duplicate = await payload
      .find({
        collection: 'products',
        where: { sku: { equals: normalized.data.sku } },
        limit: 1,
        depth: 0,
        user: ctx.user,
        overrideAccess: false,
        select: { sku: true },
      })
      .catch(() => null)
    if (duplicate?.totalDocs)
      return failure(`型号 / SKU「${normalized.data.sku}」已存在`, { sku: 'SKU 已存在' })

    const { brandRef: _brandRef, ...product } = normalized.data
    try {
      const doc = await payload.create({
        collection: 'products',
        data: {
          ...product,
          brand: brandId,
          ...(product.image ? { image: product.image } : {}),
        } as never,
        user: ctx.user as never,
        overrideAccess: false,
        depth: 0,
      })
      ctx.mutated = true
      return {
        result: {
          productId: String(doc.id),
          name: doc.name,
          sku: doc.sku,
          price: doc.price,
          status: doc.status,
        },
        summary: `已新增产品「${doc.name}」（¥${doc.price}）`,
        href: '/products',
        hrefLabel: '打开产品库',
      }
    } catch (error) {
      console.error('[ai] create product failed', error)
      return failure(readableError(error, '新增产品失败：请确认账号已启用且有产品库写入权限'))
    }
  },

  async update_product(args, ctx) {
    // 与 create_product 相同：成员可改，权限交给集合 access 裁决。
    const normalized = normalizeUpdateProduct(args)
    if (!normalized.ok) return failure(normalized.error, normalized.fieldErrors)

    const payload = await getPayloadClient()
    let product: { id: string | number; name: string; sku: string; price: number } | null
    try {
      product = (await payload.findByID({
        collection: 'products',
        id: normalized.data.productId,
        depth: 0,
        user: ctx.user,
        overrideAccess: false,
        select: { name: true, sku: true, price: true },
      })) as typeof product
    } catch {
      product = null
    }
    if (!product) return failure('产品不存在或无权访问')

    const patch: Record<string, unknown> = { ...normalized.data.patch }
    if (normalized.data.brandRef) {
      const brandId = await resolveBrandId(normalized.data.brandRef)
      if (!brandId)
        return failure(`未找到品牌「${normalized.data.brandRef}」`, { brand: '品牌不存在' })
      patch.brand = brandId
    }

    try {
      const doc = await payload.update({
        collection: 'products',
        id: normalized.data.productId,
        data: patch as never,
        user: ctx.user as never,
        overrideAccess: false,
        depth: 0,
      })
      ctx.mutated = true
      const priceChanged = typeof patch.price === 'number' && patch.price !== product.price
      return {
        result: {
          productId: String(doc.id),
          name: doc.name,
          sku: doc.sku,
          oldPrice: product.price,
          price: doc.price,
          changed: Object.keys(patch),
        },
        summary: priceChanged
          ? `已把「${doc.name}」售价从 ¥${product.price} 调整为 ¥${doc.price}`
          : `已更新产品「${doc.name}」`,
        href: '/products',
        hrefLabel: '打开产品库',
      }
    } catch (error) {
      console.error('[ai] update product failed', error)
      return failure(readableError(error, '修改产品失败：请确认账号已启用且有产品库写入权限'))
    }
  },

  async update_project_archive_settings(args, ctx) {
    const normalized = normalizeArchiveSettings(args, ctx.projectId)
    if (!normalized.ok) return failure(normalized.error, normalized.fieldErrors)
    const { projectId, deliverables, share, changed } = normalized.data

    const errors: string[] = []
    let deliverablesSaved = false
    let shareSaved = false

    if (deliverables) {
      const result = await saveDeliverables(ctx.user, projectId, deliverables)
      if (result.ok) deliverablesSaved = true
      else errors.push(`交付资料：${result.error}`)
    }
    if (share) {
      try {
        const result = await saveShareSettings(ctx.user, projectId, share)
        if (result.ok) shareSaved = true
        else errors.push(`分享设置：${result.error}`)
      } catch (error) {
        console.error('[ai] share settings failed', error)
        errors.push('分享设置：保存失败，请稍后重试')
      }
    }

    if (deliverablesSaved || shareSaved) {
      ctx.mutated = true
    }
    if (errors.length) {
      return {
        result: {
          error: errors.join('；'),
          deliverablesSaved,
          shareSaved,
        },
        summary: deliverablesSaved || shareSaved ? '部分设置已保存' : '设置保存失败',
        href: `/projects/${projectId}/archive`,
        hrefLabel: '打开归档与交付',
      }
    }

    return {
      result: {
        projectId,
        deliverablesSaved,
        shareSaved,
        changed,
      },
      summary: `已保存${changed.join('、')}`,
      href: `/projects/${projectId}/archive`,
      hrefLabel: '打开归档与交付',
    }
  },

  async list_after_sales(args, ctx) {
    const projectId = text(args.projectId, 64) || text(ctx.projectId, 64)
    if (!projectId) return failure('没有指定或关联项目')

    const gate = await afterSalesGate(ctx.user, projectId)
    if (gate) return failure(gate)

    try {
      const data = await loadAfterSales(ctx.user, projectId)
      const records = data.records.slice(0, 100).map(({ snapshot, ...record }) => ({
        ...record,
        hasSnapshot: Boolean(snapshot),
      }))
      return {
        result: {
          projectId,
          warranty: data.warranty,
          contract: data.contract,
          nextVisit: data.nextVisit,
          stats: data.stats,
          records,
        },
        summary: `共 ${data.records.length} 条维保记录，质保状态：${WARRANTY_STATUS_LABEL[data.warranty.status]}`,
        href: `/projects/${projectId}/after-sales`,
        hrefLabel: '打开售后维保',
      }
    } catch (error) {
      console.error('[ai] list after-sales failed', error)
      return failure(readableError(error, '读取售后记录失败，请稍后重试'))
    }
  },

  async save_after_sales_record(args, ctx) {
    const projectId = text(args.projectId, 64) || text(ctx.projectId, 64)
    if (!projectId) return failure('没有指定或关联项目')

    const normalized = normalizeAfterSalesToolInput(args)
    if (!normalized.ok) return failure(normalized.error, normalized.fieldErrors)

    const gate = await afterSalesGate(ctx.user, projectId)
    if (gate) return failure(gate)

    const result = await saveServiceRecord(
      ctx.user,
      projectId,
      normalized.data.input,
      normalized.data.recordId,
    )
    if (!result.ok) return failure(result.error, result.fieldErrors)

    ctx.mutated = true
    return {
      result: { projectId, recordId: result.id, updated: Boolean(normalized.data.recordId) },
      summary: normalized.data.recordId ? '已更新售后维保记录' : '已新增售后维保记录',
      href: `/projects/${projectId}/after-sales`,
      hrefLabel: '打开售后维保',
    }
  },

  async set_after_sales_status(args, ctx) {
    const projectId = text(args.projectId, 64) || text(ctx.projectId, 64)
    const recordId = text(args.recordId, 64)
    const status = text(args.status, 20)
    if (!projectId) return failure('没有指定或关联项目')
    if (!recordId) return failure('请提供售后记录 ID')
    if (!['open', 'scheduled', 'done'].includes(status))
      return failure('状态无效，只能是 open（待处理）/ scheduled（已预约）/ done（已完成）', {
        status: '状态无效',
      })

    const gate = await afterSalesGate(ctx.user, projectId)
    if (gate) return failure(gate)

    const found = await findOwnedServiceRecord(ctx.user, projectId, recordId)
    if (!found.ok) return failure(found.error)

    const result = await setServiceRecordStatus(ctx.user, recordId, status)
    if (!result.ok) return failure(result.error)

    ctx.mutated = true
    return {
      result: { projectId, recordId, status },
      summary: `已把售后记录「${found.record.title}」标记为 ${status}`,
      href: `/projects/${projectId}/after-sales`,
      hrefLabel: '打开售后维保',
    }
  },

  async delete_after_sales_record(args, ctx) {
    const projectId = text(args.projectId, 64) || text(ctx.projectId, 64)
    const recordId = text(args.recordId, 64)
    if (!projectId) return failure('没有指定或关联项目')
    if (!recordId) return failure('请提供要删除的售后记录 ID')

    const gate = await afterSalesGate(ctx.user, projectId)
    if (gate) return failure(gate)

    const found = await findOwnedServiceRecord(ctx.user, projectId, recordId)
    if (!found.ok) return failure(found.error)

    const result = await deleteServiceRecord(ctx.user, recordId)
    if (!result.ok) return failure(result.error)

    ctx.mutated = true
    return {
      result: { deleted: true, projectId, recordId },
      summary: `已删除售后记录「${found.record.title}」`,
      href: `/projects/${projectId}/after-sales`,
      hrefLabel: '打开售后维保',
    }
  },

  async update_company_settings(args, ctx) {
    const normalized = normalizeCompanySettings(args)
    if (!normalized.ok) return failure(normalized.error, normalized.fieldErrors)

    const payload = await getPayloadClient()
    const current = await payload
      .findByID({
        collection: 'users',
        id: ctx.user.id,
        depth: 0,
        user: ctx.user,
        overrideAccess: false,
        select: { companyProfile: true } as never,
      })
      .catch(() => null)
    if (!current) return failure('账号不存在或登录已过期')

    const prev = ((current as unknown as { companyProfile?: Record<string, unknown> | null })
      .companyProfile ?? {}) as Record<string, unknown>
    const next = { ...prev, ...normalized.data }

    try {
      await payload.update({
        collection: 'users',
        id: ctx.user.id,
        data: { companyProfile: next } as never,
        user: ctx.user,
        overrideAccess: false,
        depth: 0,
      })
      ctx.mutated = true
      const changed = Object.keys(normalized.data)
      return {
        result: {
          changed,
          name: typeof next.name === 'string' ? next.name : null,
          printProductImages: next.printProductImages !== false,
        },
        summary: `已更新公司设置：${changed.map((k) => COMPANY_FIELD_LABELS[k] ?? k).join('、')}`,
        href: '/settings/company',
        hrefLabel: '打开公司设置',
      }
    } catch (error) {
      console.error('[ai] update company settings failed', error)
      return failure(readableError(error, '保存公司设置失败，请稍后重试'))
    }
  },
}

// 让 ToolContext 的类型参与编译检查（handler 签名由 Record 统一约束）。
export type AdminToolContext = ToolContext
