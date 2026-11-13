import { describe, expect, it, vi } from 'vitest'

/**
 * 这些用例只覆盖纯函数与「进库之前」的权限/危险操作拦截，不连接数据库。
 * @/lib/payload 在 vitest 下无法解析 @payload-config，统一 mock 掉。
 */
const mocks = vi.hoisted(() => ({ getPayloadClient: vi.fn() }))
vi.mock('@/lib/payload', () => ({ getPayloadClient: mocks.getPayloadClient }))

import { coreAiSpec } from '../core-ai'
import {
  contractDeleteBlock,
  normalizeArchiveSettings,
  normalizeCompanySettings,
  normalizeCreateProduct,
  normalizeUpdateProduct,
  projectDeleteBlock,
  toBoolean,
  toNumber,
  type AdminToolSpec,
} from './admin-ai'
import { adminToolHandlers, normalizeAfterSalesToolInput } from './admin-handlers'
import { adminToolSpecs } from './admin-ai'
import type { ToolContext } from './context'

const spec = (name: string) =>
  adminToolSpecs.find((s) => s.name === name) as AdminToolSpec | undefined

const memberCtx = {
  user: { id: 'u1', collection: 'users' },
  projectId: null,
  project: null,
} as unknown as ToolContext

const fail = (result: unknown) => result as { result: { error?: string; fieldErrors?: unknown } }

describe('adminToolSpecs', () => {
  it('导出 11 个日常管理工具，名称唯一且都有 handler', () => {
    const names = adminToolSpecs.map((s) => s.name)
    expect(names.sort()).toEqual(
      [
        'delete_project',
        'delete_quote',
        'delete_contract',
        'create_product',
        'update_product',
        'update_project_archive_settings',
        'list_after_sales',
        'save_after_sales_record',
        'set_after_sales_status',
        'delete_after_sales_record',
        'update_company_settings',
      ].sort(),
    )
    expect(new Set(names).size).toBe(names.length)
    expect(Object.keys(adminToolHandlers).sort()).toEqual(names.sort())
  })

  it('声明的权限都在 ai-copilot 插件权限白名单内', () => {
    const allowed = new Set(coreAiSpec.permissions)
    for (const tool of adminToolSpecs) {
      for (const permission of tool.permissions) {
        expect(allowed.has(permission), `${tool.name} 缺少权限声明 ${permission}`).toBe(true)
      }
    }
  })

  it('危险操作带有正确的守卫元数据', () => {
    expect(spec('delete_project')).toMatchObject({
      mutates: true,
      scope: 'project',
      projectArg: 'projectId',
      allowArchived: true,
    })
    expect(spec('delete_contract')).toMatchObject({ mutates: true })
    expect(spec('delete_quote')).toMatchObject({ mutates: true })
    expect(spec('update_project_archive_settings')).toMatchObject({
      mutates: true,
      scope: 'project',
      allowArchived: true,
    })
    // 售后登记在项目归档后仍需可用
    expect(spec('save_after_sales_record')?.allowArchived).toBe(true)
  })

  it('工具描述包含触发场景，模型能据此直接调用', () => {
    expect(spec('delete_project')?.description).toContain('把这个项目删了')
    expect(spec('update_product')?.description).toContain('涨到 399')
    expect(spec('save_after_sales_record')?.description).toContain('售后记录里加一条')
    expect(spec('update_project_archive_settings')?.description).toContain('分享链接')
  })
})

describe('参数归一化', () => {
  it('toNumber / toBoolean 接受模型常见的字符串写法', () => {
    expect(toNumber('399')).toBe(399)
    expect(toNumber('')).toBeNull()
    expect(toNumber('abc')).toBeNull()
    expect(toBoolean('false')).toBe(false)
    expect(toBoolean('on')).toBe(true)
    expect(toBoolean('maybe')).toBeNull()
  })

  it('新增产品：白名单字段 + 默认值 + 数字字符串转数字', () => {
    const r = normalizeCreateProduct({
      name: '  智能面板  ',
      sku: ' AQ-K1 ',
      deviceType: 'switch-3',
      brand: 'Aqara',
      price: '399',
      cost: '200',
      platforms: ['米家', 'Apple Home', '米家'],
      tags: ['新品'],
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data).toMatchObject({
      name: '智能面板',
      sku: 'AQ-K1',
      deviceType: 'switch-3',
      brandRef: 'Aqara',
      price: 399,
      cost: 200,
      unit: '个',
      status: 'active',
      platforms: ['米家', 'Apple Home'],
      tags: ['新品'],
    })
  })

  it('新增产品：缺字段 / 非法设备类型 / 负价格 / 非法平台都要结构化报错', () => {
    const r = normalizeCreateProduct({ price: -1, deviceType: 'not-a-type', platforms: ['Zigbee'] })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.fieldErrors).toMatchObject({
      name: expect.any(String),
      sku: expect.any(String),
      deviceType: expect.any(String),
      brand: expect.any(String),
      price: expect.any(String),
      platforms: expect.any(String),
    })
  })

  it('修改产品：改价必须显式传 price，只改名称不会带价格', () => {
    const named = normalizeUpdateProduct({ productId: 'p1', name: '新名字' })
    expect(named.ok).toBe(true)
    if (!named.ok) return
    expect(named.data.patch).toEqual({ name: '新名字' })
    expect(named.data.patch).not.toHaveProperty('price')

    const priced = normalizeUpdateProduct({ productId: 'p1', price: '399' })
    expect(priced.ok).toBe(true)
    if (!priced.ok) return
    expect(priced.data.patch.price).toBe(399)
  })

  it('成员输入能通过产品新增与改价的归一化', () => {
    // 2026-11-13 owner 批准：产品库新增/改价放开给所有成员。
    // handler 不再做 isCmsAdminUser 前置拒绝，成员输入直接进入归一化。
    const created = normalizeCreateProduct({
      name: '面板',
      sku: 'X1',
      deviceType: 'switch-3',
      brand: 'Aqara',
      price: 399,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(created.data).toMatchObject({ name: '面板', sku: 'X1', price: 399 })

    const updated = normalizeUpdateProduct({ productId: 'p1', price: 399 })
    expect(updated.ok).toBe(true)
    if (!updated.ok) return
    expect(updated.data.productId).toBe('p1')
    expect(updated.data.patch).toEqual({ price: 399 })
  })

  it('修改产品：空补丁 / 负价格 / 非法状态要报错', () => {
    expect(normalizeUpdateProduct({ productId: 'p1' }).ok).toBe(false)
    const negative = normalizeUpdateProduct({ productId: 'p1', price: -5 })
    expect(negative.ok).toBe(false)
    if (!negative.ok) expect(negative.fieldErrors?.price).toBeTruthy()
    const badStatus = normalizeUpdateProduct({ productId: 'p1', status: 'deleted' })
    expect(badStatus.ok).toBe(false)
    if (!badStatus.ok) expect(badStatus.fieldErrors?.status).toBeTruthy()
  })

  it('公司设置：只接受展示类安全字段，敏感项直接拒绝', () => {
    const ok = normalizeCompanySettings({
      name: ' 新公司 ',
      slogan: ' 口号 ',
      printProductImages: 'false',
      quoteNotes: '',
    })
    expect(ok.ok).toBe(true)
    if (!ok.ok) return
    expect(ok.data).toEqual({
      name: '新公司',
      slogan: '口号',
      quoteNotes: null,
      printProductImages: false,
    })

    const sensitive = normalizeCompanySettings({ name: '公司', disabledPlugins: ['after-sales'] })
    expect(sensitive.ok).toBe(false)
    if (!sensitive.ok) {
      expect(sensitive.error).toContain('disabledPlugins')
      expect(sensitive.error).toContain('不支持')
    }

    expect(normalizeCompanySettings({ contractTerms: '条款' }).ok).toBe(true)
    expect(normalizeCompanySettings({}).ok).toBe(false)
    expect(normalizeCompanySettings({ name: '  ' }).ok).toBe(false)
    expect(normalizeCompanySettings({ name: '公司', printProductImages: 'maybe' }).ok).toBe(false)
    expect(normalizeCompanySettings({ name: '公司', logo: 'media-1' }).ok).toBe(false)
  })

  it('交付物与分享设置：生成两个 service 的 patch 并保持三态密码语义', () => {
    const r = normalizeArchiveSettings(
      {
        finalQuoteId: 'q1',
        proposalTemplate: 'qixu',
        shareEnabled: 'false',
        shareRole: 'edit',
        shareExpiresAt: '2026-12-31',
        sharePassword: '1234',
      },
      'p1',
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.projectId).toBe('p1')
    expect(r.data.deliverables).toEqual({ finalQuote: 'q1', proposalTemplate: 'qixu' })
    expect(r.data.share).toMatchObject({
      enabled: false,
      role: 'edit',
      password: '1234',
    })
    expect(r.data.share?.expiresAt).toMatch(/^2026-12-31T/)

    const cleared = normalizeArchiveSettings({ projectId: 'p1', sharePassword: '' })
    expect(cleared.ok).toBe(true)
    if (cleared.ok) expect(cleared.data.share?.password).toBeNull()

    const neverExpires = normalizeArchiveSettings({ projectId: 'p1', shareExpiresAt: null })
    expect(neverExpires.ok).toBe(true)
    if (neverExpires.ok) expect(neverExpires.data.share?.expiresAt).toBeNull()
  })

  it('交付物与分享设置：空参数 / 非法角色 / 非法日期 / 短密码 / 未知项都报错', () => {
    expect(normalizeArchiveSettings({}, null).ok).toBe(false)
    expect(normalizeArchiveSettings({ projectId: 'p1' }).ok).toBe(false)
    expect(normalizeArchiveSettings({ projectId: 'p1', shareRole: 'owner' }).ok).toBe(false)
    expect(normalizeArchiveSettings({ projectId: 'p1', shareExpiresAt: 'not-a-date' }).ok).toBe(
      false,
    )
    expect(normalizeArchiveSettings({ projectId: 'p1', sharePassword: '123' }).ok).toBe(false)
    expect(normalizeArchiveSettings({ projectId: 'p1', logo: 'm1' }).ok).toBe(false)
  })

  it('售后记录：默认类型/状态/收费方式/服务日期，缺摘要要报错', () => {
    const r = normalizeAfterSalesToolInput({ title: ' 更换主卧窗帘电机 ' }, '2026-11-13')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.input).toMatchObject({
      type: 'repair',
      title: '更换主卧窗帘电机',
      serviceDate: '2026-11-13',
      status: 'done',
      billing: 'warranty',
    })
    expect(r.data.recordId).toBeNull()

    const missingTitle = normalizeAfterSalesToolInput({}, '2026-11-13')
    expect(missingTitle.ok).toBe(false)
    if (!missingTitle.ok) expect(missingTitle.fieldErrors?.title).toBeTruthy()

    const backup = normalizeAfterSalesToolInput({ title: '配置备份', type: 'backup' }, '2026-11-13')
    expect(backup.ok).toBe(false)

    const badDate = normalizeAfterSalesToolInput(
      { title: '检修', serviceDate: '2026/11/13' },
      '2026-11-13',
    )
    expect(badDate.ok).toBe(false)
    if (!badDate.ok) expect(badDate.fieldErrors?.serviceDate).toBeTruthy()

    const paidNoFee = normalizeAfterSalesToolInput(
      { title: '保外检修', billing: 'paid' },
      '2026-11-13',
    )
    expect(paidNoFee.ok).toBe(false)
    if (!paidNoFee.ok) expect(paidNoFee.fieldErrors?.fee).toBeTruthy()

    // 非法状态 / 收费方式不能被静默回落成默认值
    const badStatus = normalizeAfterSalesToolInput(
      { title: '检修', status: 'closed' },
      '2026-11-13',
    )
    expect(badStatus.ok).toBe(false)
    if (!badStatus.ok) expect(badStatus.fieldErrors?.status).toBeTruthy()

    const badBilling = normalizeAfterSalesToolInput(
      { title: '检修', billing: 'cash' },
      '2026-11-13',
    )
    expect(badBilling.ok).toBe(false)
    if (!badBilling.ok) expect(badBilling.fieldErrors?.billing).toBeTruthy()
  })
})

describe('危险操作与权限拦截', () => {
  it('删除项目：只有负责人可删，有已签合同必须改为归档', () => {
    expect(projectDeleteBlock({ isOwner: false, signedContracts: 0 })).toContain('负责人')
    expect(projectDeleteBlock({ isOwner: true, signedContracts: 1 })).toContain('归档')
    expect(projectDeleteBlock({ isOwner: true, signedContracts: 0 })).toBeNull()
  })

  it('删除合同：已签订必须拒绝并提示先撤销签订', () => {
    expect(contractDeleteBlock('signed')).toContain('撤销签订')
    expect(contractDeleteBlock('draft')).toBeNull()
    expect(contractDeleteBlock(undefined)).toBeNull()
  })

  it('公司设置的敏感字段在进库前被拒绝', async () => {
    mocks.getPayloadClient.mockClear()
    const res = await adminToolHandlers.update_company_settings(
      { disabledPlugins: ['after-sales'] },
      memberCtx,
    )
    expect(fail(res).result.error).toContain('不支持')
    expect(mocks.getPayloadClient).not.toHaveBeenCalled()
  })

  it('缺少必要参数时返回结构化错误而不是静默吞掉', async () => {
    const cases = [
      adminToolHandlers.delete_project({}, memberCtx),
      adminToolHandlers.delete_quote({}, memberCtx),
      adminToolHandlers.delete_contract({}, memberCtx),
      adminToolHandlers.update_project_archive_settings({}, memberCtx),
      adminToolHandlers.list_after_sales({}, memberCtx),
      adminToolHandlers.save_after_sales_record({ title: '检修' }, memberCtx),
      adminToolHandlers.delete_after_sales_record({ projectId: 'p1' }, memberCtx),
    ]
    const results = await Promise.all(cases)
    for (const result of results) {
      const output = fail(result).result
      expect(typeof output.error).toBe('string')
      expect(output.error).not.toBe('')
    }
    expect(mocks.getPayloadClient).not.toHaveBeenCalled()
  })

  it('售后状态只接受三个合法值', async () => {
    const res = await adminToolHandlers.set_after_sales_status(
      { projectId: 'p1', recordId: 'r1', status: 'closed' },
      memberCtx,
    )
    expect(fail(res).result.error).toContain('状态无效')
    expect(fail(res).result.fieldErrors).toEqual({ status: '状态无效' })
  })
})
