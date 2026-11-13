import { PRODUCT_PLATFORMS } from '@/collections/Products'
import { DEVICE_TYPE_OPTIONS, isDeviceType } from '@/lib/device-types'
import type { AiToolSpec } from '@/plugins/ai-types'

/**
 * AI 助手的「日常管理」工具规格与纯校验函数。
 *
 * 这个文件只放纯数据与纯函数，不导入 Payload / 服务端运行时，
 * 因此可以安全地被 ai-catalog、计费模块和客户端能力页引用。
 * 真正的数据库写入与权限校验在 admin-handlers.ts，全部以登录成员身份
 * （overrideAccess: false）调用 Local API。
 */

export type AdminFieldErrors = Record<string, string>

export type Normalized<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: AdminFieldErrors }

/* ------------------------------ 通用归一化 ------------------------------ */

const trimText = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** 接受数字或数字字符串（模型经常把「399」当字符串传），无限时返回 null。 */
export function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v.trim())
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** 接受布尔值以及模型常见的 'true' / 'false' / 'on' / 'off'。 */
export function toBoolean(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (['true', '1', 'on', 'yes', '是'].includes(s)) return true
    if (['false', '0', 'off', 'no', '否'].includes(s)) return false
  }
  return null
}

const optionalText = (v: unknown, max: number): string | null =>
  typeof v === 'string' ? v.trim().slice(0, max) || null : null

const stringArray = (v: unknown, maxItem: number): string[] | null => {
  if (!Array.isArray(v)) return null
  return [
    ...new Set(
      v
        .map((item) => (typeof item === 'string' ? item.trim().slice(0, maxItem) : ''))
        .filter(Boolean),
    ),
  ]
}

/* ------------------------------ 产品库 ------------------------------ */

export type CreateProductData = {
  name: string
  sku: string
  deviceType: string
  /** 品牌名称或 ID，handler 负责解析成 brands 关系 ID */
  brandRef: string
  price: number
  cost: number | null
  unit: string
  stock: number | null
  platforms: string[]
  description: string | null
  tags: string[]
  status: 'active' | 'inactive'
  image: string | null
}

const PRODUCT_STATUSES = ['active', 'inactive'] as const

function normalizeProductPlatforms(
  raw: unknown,
  fieldErrors: AdminFieldErrors,
): string[] | undefined {
  if (raw === undefined || raw === null) return undefined
  if (!Array.isArray(raw)) {
    fieldErrors.platforms = 'platforms 需要是字符串数组'
    return undefined
  }
  const allowed = new Set<string>(PRODUCT_PLATFORMS)
  const values: string[] = []
  for (const item of raw) {
    const value = typeof item === 'string' ? item.trim() : ''
    if (!value) continue
    if (!allowed.has(value)) {
      fieldErrors.platforms = `不支持的平台「${value}」，可选：${PRODUCT_PLATFORMS.join('、')}`
      return undefined
    }
    if (!values.includes(value)) values.push(value)
  }
  return values
}

/** 新增产品的字段白名单与校验（与 Products 集合字段一致；品牌只接受已有品牌）。 */
export function normalizeCreateProduct(
  args: Record<string, unknown>,
): Normalized<CreateProductData> {
  const fieldErrors: AdminFieldErrors = {}
  const name = trimText(args.name, 120)
  if (!name) fieldErrors.name = '请填写产品名称'
  const sku = trimText(args.sku, 100)
  if (!sku) fieldErrors.sku = '请填写型号 / SKU'

  const deviceType = trimText(args.deviceType, 40)
  if (!deviceType) fieldErrors.deviceType = '请选择设备类型'
  else if (!isDeviceType(deviceType))
    fieldErrors.deviceType = `设备类型无效，可选：${DEVICE_TYPE_OPTIONS.map((o) => o.value).join(', ')}`

  const brandRef = trimText(args.brand, 100)
  if (!brandRef) fieldErrors.brand = '请填写品牌名称或品牌 ID'

  const price = args.price === undefined ? null : toNumber(args.price)
  if (price === null || price < 0) fieldErrors.price = '售价需为非负数字'

  let cost: number | null = null
  if (args.cost !== undefined && args.cost !== null && args.cost !== '') {
    const n = toNumber(args.cost)
    if (n === null || n < 0) fieldErrors.cost = '成本需为非负数字'
    else cost = Math.round(n * 100) / 100
  }

  const unit = trimText(args.unit, 10) || '个'

  let stock: number | null = null
  if (args.stock !== undefined && args.stock !== null && args.stock !== '') {
    const n = toNumber(args.stock)
    if (n === null || n < 0 || !Number.isInteger(n)) fieldErrors.stock = '库存需为非负整数'
    else stock = n
  }

  const platforms = normalizeProductPlatforms(args.platforms, fieldErrors)

  let tags: string[] = []
  if (args.tags !== undefined && args.tags !== null) {
    const parsed = stringArray(args.tags, 40)
    if (parsed === null) fieldErrors.tags = 'tags 需要是字符串数组'
    else tags = parsed
  }

  const statusRaw = trimText(args.status, 20) || 'active'
  const status = PRODUCT_STATUSES.includes(statusRaw as 'active')
    ? (statusRaw as 'active' | 'inactive')
    : null
  if (!status) fieldErrors.status = '状态只能是 active（在售）或 inactive（下架）'

  const description = optionalText(args.description, 2000)
  const image = trimText(args.image, 64) || null

  if (Object.keys(fieldErrors).length) {
    return {
      ok: false,
      error: Object.values(fieldErrors)[0] ?? '请检查产品信息',
      fieldErrors,
    }
  }

  return {
    ok: true,
    data: {
      name,
      sku,
      deviceType,
      brandRef,
      price: Math.round(price! * 100) / 100,
      cost,
      unit,
      stock,
      platforms: platforms ?? [],
      description,
      tags,
      status: status!,
      image,
    },
  }
}

export type UpdateProductData = {
  productId: string
  /** 只包含本次明确提交的白名单字段 */
  patch: Record<string, unknown>
  /** 需要 handler 解析成 brands 关系 ID */
  brandRef?: string
}

/** 修改产品的字段白名单；改价必须显式传 price，不会根据名称/描述猜测价格。 */
export function normalizeUpdateProduct(
  args: Record<string, unknown>,
): Normalized<UpdateProductData> {
  const fieldErrors: AdminFieldErrors = {}
  const productId = trimText(args.productId, 64)
  if (!productId) fieldErrors.productId = '请提供产品 ID（可先用 search_products 查询）'

  const patch: Record<string, unknown> = {}
  let brandRef: string | undefined

  if (args.name !== undefined) {
    const name = trimText(args.name, 120)
    if (!name) fieldErrors.name = '产品名称不能为空'
    else patch.name = name
  }
  if (args.sku !== undefined) {
    const sku = trimText(args.sku, 100)
    if (!sku) fieldErrors.sku = '型号 / SKU 不能为空'
    else patch.sku = sku
  }
  if (args.deviceType !== undefined) {
    const deviceType = trimText(args.deviceType, 40)
    if (!isDeviceType(deviceType)) fieldErrors.deviceType = '设备类型无效'
    else patch.deviceType = deviceType
  }
  if (args.brand !== undefined) {
    const ref = trimText(args.brand, 100)
    if (!ref) fieldErrors.brand = '品牌不能为空'
    else brandRef = ref
  }
  if (args.price !== undefined) {
    const price = toNumber(args.price)
    if (price === null || price < 0) fieldErrors.price = '新售价需为非负数字'
    else patch.price = Math.round(price * 100) / 100
  }
  if (args.cost !== undefined) {
    if (args.cost === null || args.cost === '') patch.cost = null
    else {
      const cost = toNumber(args.cost)
      if (cost === null || cost < 0) fieldErrors.cost = '成本需为非负数字'
      else patch.cost = Math.round(cost * 100) / 100
    }
  }
  if (args.unit !== undefined) {
    const unit = trimText(args.unit, 10)
    if (!unit) fieldErrors.unit = '单位不能为空'
    else patch.unit = unit
  }
  if (args.stock !== undefined) {
    if (args.stock === null || args.stock === '') patch.stock = null
    else {
      const stock = toNumber(args.stock)
      if (stock === null || stock < 0 || !Number.isInteger(stock))
        fieldErrors.stock = '库存需为非负整数'
      else patch.stock = stock
    }
  }
  if (args.platforms !== undefined) {
    const platforms = normalizeProductPlatforms(args.platforms, fieldErrors)
    if (platforms !== undefined) patch.platforms = platforms
  }
  if (args.description !== undefined) patch.description = optionalText(args.description, 2000)
  if (args.tags !== undefined) {
    const tags = stringArray(args.tags, 40)
    if (tags === null) fieldErrors.tags = 'tags 需要是字符串数组'
    else patch.tags = tags
  }
  if (args.status !== undefined) {
    const status = trimText(args.status, 20) as 'active' | 'inactive'
    if (!PRODUCT_STATUSES.includes(status)) fieldErrors.status = '状态无效'
    else patch.status = status
  }
  if (args.image !== undefined) patch.image = trimText(args.image, 64) || null

  if (Object.keys(fieldErrors).length) {
    return {
      ok: false,
      error: Object.values(fieldErrors)[0] ?? '请检查产品信息',
      fieldErrors,
    }
  }
  if (!Object.keys(patch).length && !brandRef) {
    return { ok: false, error: '没有要修改的产品字段' }
  }
  return { ok: true, data: { productId, patch, brandRef } }
}

/* ------------------------------ 公司设置 ------------------------------ */

export type CompanySettingsPatch = {
  name?: string
  slogan?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  quoteNotes?: string | null
  contractTerms?: string | null
  printProductImages?: boolean
}

/** 只允许展示类安全字段；插件开关、文档模板、Logo/二维码、成本设置等一律拒绝。 */
export const COMPANY_SETTINGS_FIELDS = [
  'name',
  'slogan',
  'phone',
  'email',
  'address',
  'quoteNotes',
  'contractTerms',
  'printProductImages',
] as const

const COMPANY_SETTINGS_LIMITS: Record<string, number> = {
  name: 60,
  slogan: 80,
  phone: 30,
  email: 80,
  address: 200,
  quoteNotes: 2000,
  contractTerms: 5000,
}

export function normalizeCompanySettings(
  args: Record<string, unknown>,
): Normalized<CompanySettingsPatch> {
  const unknownKeys = Object.keys(args).filter(
    (key) => !(COMPANY_SETTINGS_FIELDS as readonly string[]).includes(key),
  )
  if (unknownKeys.length) {
    return {
      ok: false,
      error: `不支持通过 AI 修改这些设置：${unknownKeys.join('、')}。只允许修改：${COMPANY_SETTINGS_FIELDS.join('、')}`,
      fieldErrors: Object.fromEntries(unknownKeys.map((key) => [key, '不允许修改'])),
    }
  }

  const patch: CompanySettingsPatch = {}
  if (args.name !== undefined) {
    const name = trimText(args.name, 60)
    if (!name)
      return { ok: false, error: '请填写公司名称', fieldErrors: { name: '请填写公司名称' } }
    patch.name = name
  }
  for (const key of [
    'slogan',
    'phone',
    'email',
    'address',
    'quoteNotes',
    'contractTerms',
  ] as const) {
    if (args[key] === undefined) continue
    if (args[key] !== null && typeof args[key] !== 'string')
      return { ok: false, error: `${key} 需要是字符串`, fieldErrors: { [key]: '需要是字符串' } }
    patch[key] = optionalText(args[key], COMPANY_SETTINGS_LIMITS[key])
  }
  if (args.printProductImages !== undefined) {
    const value = toBoolean(args.printProductImages)
    if (value === null)
      return {
        ok: false,
        error: 'printProductImages 需要是布尔值',
        fieldErrors: { printProductImages: '需要是布尔值' },
      }
    patch.printProductImages = value
  }
  if (!Object.keys(patch).length) return { ok: false, error: '没有要保存的设置' }
  return { ok: true, data: patch }
}

/* ------------------------------ 交付物与分享设置 ------------------------------ */

export type ArchiveSettingsData = {
  projectId: string
  deliverables?: { finalQuote?: string | null; proposalTemplate?: string | null }
  share?: {
    enabled?: boolean
    role?: 'edit' | 'read'
    expiresAt?: string | null
    password?: string | null
  }
  changed: string[]
}

const ARCHIVE_SETTING_KEYS = [
  'projectId',
  'finalQuoteId',
  'finalQuote',
  'proposalTemplate',
  'shareEnabled',
  'shareRole',
  'shareExpiresAt',
  'sharePassword',
] as const

export function normalizeArchiveSettings(
  args: Record<string, unknown>,
  fallbackProjectId?: string | null,
): Normalized<ArchiveSettingsData> {
  const unknownKeys = Object.keys(args).filter(
    (key) => !(ARCHIVE_SETTING_KEYS as readonly string[]).includes(key),
  )
  if (unknownKeys.length)
    return {
      ok: false,
      error: `不支持的设置项：${unknownKeys.join('、')}`,
      fieldErrors: Object.fromEntries(unknownKeys.map((key) => [key, '不支持'])),
    }

  const projectId = trimText(args.projectId, 64) || trimText(fallbackProjectId, 64)
  if (!projectId) return { ok: false, error: '没有指定或关联项目' }

  const deliverables: NonNullable<ArchiveSettingsData['deliverables']> = {}
  const share: NonNullable<ArchiveSettingsData['share']> = {}
  const changed: string[] = []

  const finalQuoteRaw = args.finalQuoteId !== undefined ? args.finalQuoteId : args.finalQuote
  if (finalQuoteRaw !== undefined) {
    if (finalQuoteRaw !== null && typeof finalQuoteRaw !== 'string')
      return {
        ok: false,
        error: 'finalQuoteId 需要是字符串',
        fieldErrors: { finalQuoteId: '需要是字符串' },
      }
    deliverables.finalQuote = trimText(finalQuoteRaw, 64) || null
    changed.push('交付定稿报价')
  }
  if (args.proposalTemplate !== undefined) {
    if (args.proposalTemplate !== null && typeof args.proposalTemplate !== 'string')
      return {
        ok: false,
        error: 'proposalTemplate 需要是字符串',
        fieldErrors: { proposalTemplate: '需要是字符串' },
      }
    deliverables.proposalTemplate = trimText(args.proposalTemplate, 60) || null
    changed.push('交付方案模板')
  }

  if (args.shareEnabled !== undefined) {
    const enabled = toBoolean(args.shareEnabled)
    if (enabled === null)
      return {
        ok: false,
        error: 'shareEnabled 需要是布尔值',
        fieldErrors: { shareEnabled: '需要是布尔值' },
      }
    share.enabled = enabled
    changed.push(enabled ? '开启分享链接' : '关闭分享链接')
  }
  if (args.shareRole !== undefined) {
    if (args.shareRole !== 'read' && args.shareRole !== 'edit')
      return {
        ok: false,
        error: 'shareRole 只能是 read 或 edit',
        fieldErrors: { shareRole: '取值无效' },
      }
    share.role = args.shareRole
    changed.push(args.shareRole === 'edit' ? '分享权限设为可编辑' : '分享权限设为仅查看')
  }
  if (args.shareExpiresAt !== undefined) {
    if (args.shareExpiresAt === null || args.shareExpiresAt === '') {
      share.expiresAt = null
      changed.push('分享链接改为永不过期')
    } else if (
      typeof args.shareExpiresAt !== 'string' ||
      !Number.isFinite(Date.parse(args.shareExpiresAt))
    ) {
      return {
        ok: false,
        error: 'shareExpiresAt 不是有效的日期时间',
        fieldErrors: { shareExpiresAt: '日期格式不正确' },
      }
    } else {
      share.expiresAt = new Date(Date.parse(args.shareExpiresAt)).toISOString()
      changed.push(`分享链接有效期至 ${share.expiresAt.slice(0, 10)}`)
    }
  }
  if (args.sharePassword !== undefined) {
    if (args.sharePassword !== null && typeof args.sharePassword !== 'string')
      return {
        ok: false,
        error: 'sharePassword 需要是字符串',
        fieldErrors: { sharePassword: '需要是字符串' },
      }
    const password = typeof args.sharePassword === 'string' ? args.sharePassword : ''
    if (password && password.length < 4)
      return { ok: false, error: '访问密码至少 4 位', fieldErrors: { sharePassword: '至少 4 位' } }
    if (password.length > 64)
      return {
        ok: false,
        error: '访问密码不超过 64 位',
        fieldErrors: { sharePassword: '不超过 64 位' },
      }
    // 空字符串表示清除密码（与归档页及小程序的三态语义一致）
    share.password = password || null
    changed.push(password ? '设置分享访问密码' : '清除分享访问密码')
  }

  if (!Object.keys(deliverables).length && !Object.keys(share).length)
    return { ok: false, error: '没有要保存的交付物或分享设置' }

  return {
    ok: true,
    data: {
      projectId,
      ...(Object.keys(deliverables).length ? { deliverables } : {}),
      ...(Object.keys(share).length ? { share } : {}),
      changed,
    },
  }
}

/* ------------------------------ 危险操作拦截 ------------------------------ */

/** 删除项目的前置规则（与 projects/actions.ts 的 deleteProject 一致）。 */
export function projectDeleteBlock(input: {
  isOwner: boolean
  signedContracts: number
}): string | null {
  if (!input.isOwner) return '只有项目负责人可以删除项目'
  if (input.signedContracts > 0) return '项目已有签订的合同，不能删除。可以在「归档」中归档项目。'
  return null
}

/** 已签订的合同不能删除（与 Contracts 集合的 beforeDelete 一致）。 */
export function contractDeleteBlock(status: string | null | undefined): string | null {
  if (status === 'signed') return '已签订的合同不能删除，请先撤销签订（改为草稿）后再删除。'
  return null
}

/* ------------------------------ 工具规格 ------------------------------ */

export type AdminToolSpec = AiToolSpec & {
  /** 核心工具：null（随 ai-copilot 始终启用） */
  pluginId: null
}

const projectIdParam = {
  type: 'string',
  description: '项目 ID（可选，不传则使用当前对话关联的项目）',
}

export const adminToolSpecs: AdminToolSpec[] = [
  {
    pluginId: null,
    name: 'delete_project',
    title: '删除项目',
    description:
      '永久删除一个项目。当用户明确说「把这个项目删了」「这个项目不要了」「删掉项目 XX」时调用。只有项目负责人（owner）可以删除；项目下已有已签订的合同时会被拒绝，此时应提示用户改用「归档」。删除时会级联删除项目下的报价单和未签合同，AI 对话保留但解除项目关联，操作不可撤销。',
    cost: 1,
    permissions: ['projects:write'],
    scope: 'project',
    mutates: true,
    projectArg: 'projectId',
    // 归档后的项目仍然允许负责人删除（与网页删除入口一致）
    allowArchived: true,
    parameters: {
      type: 'object',
      properties: {
        projectId: projectIdParam,
      },
    },
  },
  {
    pluginId: null,
    name: 'delete_quote',
    title: '删除报价单',
    description:
      '永久删除一份报价单。当用户说「这份报价删掉」「第二版报价不要了」「把旧报价清掉」时调用。只能删除自己有权访问的项目里的报价；已用于任何合同（尤其是已签订合同）的报价不能删除，此时应提示用户先删除/撤销合同。操作不可撤销。',
    cost: 0.5,
    permissions: ['quotes:write'],
    scope: 'workspace',
    mutates: true,
    parameters: {
      type: 'object',
      properties: {
        quoteId: {
          type: 'string',
          description: '要删除的报价单 ID（可通过 get_project_details 查询）',
        },
      },
      required: ['quoteId'],
    },
  },
  {
    pluginId: null,
    name: 'delete_contract',
    title: '删除合同',
    description:
      '永久删除一份施工合同。当用户说「合同删了重做」「这份合同不要了」时调用。只能删除自己有权访问的项目里的合同；已签订的合同严禁删除，必须先撤销签订（改回草稿）才能删除。操作不可撤销。',
    cost: 0.5,
    permissions: ['contracts:write'],
    scope: 'workspace',
    mutates: true,
    parameters: {
      type: 'object',
      properties: {
        contractId: {
          type: 'string',
          description: '要删除的合同 ID（可通过 get_project_details 查询）',
        },
      },
      required: ['contractId'],
    },
  },
  {
    pluginId: null,
    name: 'create_product',
    title: '新增产品',
    description:
      '在产品库新增一款产品。当用户说「产品库里新增一款 Aqara 面板」「把这款新品加进产品库」时调用。成员可以新增/修改产品与售价；删除产品仍只允许后台管理员。必须提供产品名称、型号/SKU、设备类型、品牌（已有品牌名称或 ID）和售价。品牌不会自动新建，找不到时应提示用户先在后台品牌库创建。',
    cost: 1,
    // 工具能力声明；真正的写权限由 Products 集合的 cmsAdminOrMember 裁决。
    permissions: ['catalog:write'],
    scope: 'workspace',
    mutates: true,
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '产品名称（如 智能开关三键）' },
        sku: { type: 'string', description: '型号 / SKU（产品库内唯一）' },
        deviceType: {
          type: 'string',
          enum: DEVICE_TYPE_OPTIONS.map((o) => o.value),
          description: '设备类型代号（如 switch-3、curtain-track、motion-sensor）',
        },
        brand: { type: 'string', description: '品牌名称或品牌 ID（如 Aqara）' },
        price: { type: 'number', description: '售价（元）' },
        cost: { type: 'number', description: '成本（元，可选）' },
        unit: { type: 'string', description: '单位（默认「个」）' },
        stock: { type: 'number', description: '库存（可选，非负整数）' },
        platforms: {
          type: 'array',
          items: { type: 'string', enum: [...PRODUCT_PLATFORMS] },
          description: '适用平台（可选）',
        },
        description: { type: 'string', description: '产品说明（可选）' },
        tags: { type: 'array', items: { type: 'string' }, description: '标签（可选）' },
        status: {
          type: 'string',
          enum: ['active', 'inactive'],
          description: '状态：active 在售（默认）/ inactive 下架',
        },
        image: { type: 'string', description: '产品图片的 media ID（可选）' },
      },
      required: ['name', 'sku', 'deviceType', 'brand', 'price'],
    },
  },
  {
    pluginId: null,
    name: 'update_product',
    title: '修改产品与改价',
    description:
      '修改产品库中已有产品的资料或售价。当用户说「Aqara 那款面板涨到 399」「把这个产品调到 299」「产品改名为…」时调用。先用 search_products 按品牌/型号/关键词找到 productId，再传入要改的字段；改价必须显式传 price（元），不会根据文字猜测。成员可以新增/修改产品与售价；删除产品仍只允许后台管理员。',
    cost: 0.5,
    permissions: ['catalog:write'],
    scope: 'workspace',
    mutates: true,
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: '要修改的产品 ID（先用 search_products 获取）',
        },
        price: { type: 'number', description: '新售价（元，显式传入才会改价）' },
        cost: { type: 'number', description: '新成本（元，可选）' },
        name: { type: 'string', description: '产品名称（可选）' },
        sku: { type: 'string', description: '型号 / SKU（可选）' },
        deviceType: {
          type: 'string',
          enum: DEVICE_TYPE_OPTIONS.map((o) => o.value),
          description: '设备类型（可选）',
        },
        brand: { type: 'string', description: '品牌名称或品牌 ID（可选）' },
        unit: { type: 'string', description: '单位（可选）' },
        stock: { type: 'number', description: '库存（可选）' },
        platforms: {
          type: 'array',
          items: { type: 'string', enum: [...PRODUCT_PLATFORMS] },
          description: '适用平台（可选，传空数组表示清空）',
        },
        description: { type: 'string', description: '产品说明（可选，传空字符串清空）' },
        tags: { type: 'array', items: { type: 'string' }, description: '标签（可选）' },
        status: {
          type: 'string',
          enum: ['active', 'inactive'],
          description: '状态：在售 / 下架',
        },
        image: { type: 'string', description: '产品图片 media ID（可选，传空字符串清空）' },
      },
      required: ['productId'],
    },
  },
  {
    pluginId: null,
    name: 'update_project_archive_settings',
    title: '交付物与分享设置',
    description:
      '设置项目的交付资料和业主分享链接。当用户说「交付资料用这份报价」「方案模板换成 XX」「把业主分享链接关掉」「分享链接加个密码/设个有效期」时调用。finalQuoteId 必须是本项目里的报价；proposalTemplate 必须是可用的业主方案模板标识；分享密码传空字符串表示清除，shareExpiresAt 传 null 表示永不过期。',
    cost: 0.5,
    permissions: ['projects:write'],
    scope: 'project',
    mutates: true,
    projectArg: 'projectId',
    // 归档页本身就是在已归档项目上配置交付资料与分享链接
    allowArchived: true,
    parameters: {
      type: 'object',
      properties: {
        projectId: projectIdParam,
        finalQuoteId: {
          type: 'string',
          description: '定稿报价 ID（必须是本项目的报价；传空字符串表示不指定，自动选择）',
        },
        proposalTemplate: {
          type: 'string',
          description: '交付方案模板标识（如 qixu、noir；传空字符串恢复默认）',
        },
        shareEnabled: { type: 'boolean', description: '是否开启业主分享链接' },
        shareRole: {
          type: 'string',
          enum: ['read', 'edit'],
          description: '分享权限：read 仅查看（默认）/ edit 可编辑',
        },
        shareExpiresAt: {
          type: 'string',
          description: '分享链接过期时间（ISO 时间或 YYYY-MM-DD；传 null 或空字符串表示永不过期）',
        },
        sharePassword: {
          type: 'string',
          description: '访问密码（至少 4 位；传空字符串表示清除密码）',
        },
      },
    },
  },
  {
    pluginId: null,
    name: 'list_after_sales',
    title: '查看售后维保记录',
    description:
      '读取项目的售后维保台账：全部维保记录、合同质保期、下次回访日期与统计。当用户问「这个项目质保到什么时候」「售后记录有哪些」「上次检修是什么时候」「下次回访是哪天」时调用。',
    cost: 0.3,
    permissions: ['projects:read', 'contracts:read'],
    scope: 'project',
    mutates: false,
    projectArg: 'projectId',
    parameters: {
      type: 'object',
      properties: { projectId: projectIdParam },
    },
  },
  {
    pluginId: null,
    name: 'save_after_sales_record',
    title: '登记售后维保记录',
    description:
      '新增或修改一条售后维保记录。当用户说「售后记录里加一条」「登记一次上门检修」「记录设备更换」「把这次远程调试记下来」时调用。type 可选 acceptance 交付验收 / inspection 定期巡检 / repair 上门检修 / replacement 设备更换 / remote 远程调试 / backup 配置备份（配置备份只能由系统生成，不要手动登记）。serviceDate 用 YYYY-MM-DD；billing=paid 时必须填 fee。传 recordId 表示修改已有记录。',
    cost: 0.5,
    permissions: ['projects:write'],
    scope: 'project',
    mutates: true,
    projectArg: 'projectId',
    // 售后发生在交付之后，已归档项目仍允许登记维保记录
    allowArchived: true,
    parameters: {
      type: 'object',
      properties: {
        projectId: projectIdParam,
        recordId: { type: 'string', description: '要修改的已有记录 ID（不传则新增）' },
        type: {
          type: 'string',
          enum: ['acceptance', 'inspection', 'repair', 'replacement', 'remote'],
          description: '记录类型（默认 repair 上门检修）',
        },
        title: { type: 'string', description: '摘要（如 更换主卧窗帘电机）' },
        serviceDate: {
          type: 'string',
          description: '服务日期 YYYY-MM-DD（默认今天）',
        },
        status: {
          type: 'string',
          enum: ['open', 'scheduled', 'done'],
          description: '状态：待处理 / 已预约 / 已完成（默认 done）',
        },
        detail: { type: 'string', description: '处理过程与结果（可选）' },
        devices: { type: 'string', description: '涉及设备 / 更换明细（可选）' },
        billing: {
          type: 'string',
          enum: ['warranty', 'paid', 'free'],
          description: '收费方式：质保内免费（默认）/ 保外收费 / 赠送服务',
        },
        fee: { type: 'number', description: '收费金额（元，billing=paid 时必填）' },
        technician: { type: 'string', description: '服务人员（可选）' },
        nextVisitAt: { type: 'string', description: '下次回访日期 YYYY-MM-DD（可选）' },
      },
      required: ['title'],
    },
  },
  {
    pluginId: null,
    name: 'set_after_sales_status',
    title: '更新售后记录状态',
    description:
      '修改一条售后维保记录的处理状态。当用户说「那条检修标记完成」「把售后记录改成已预约」「这条先设为待处理」时调用。需要 recordId；可先用 list_after_sales 找到记录 ID。',
    cost: 0.3,
    permissions: ['projects:write'],
    scope: 'project',
    mutates: true,
    projectArg: 'projectId',
    allowArchived: true,
    parameters: {
      type: 'object',
      properties: {
        projectId: projectIdParam,
        recordId: { type: 'string', description: '售后记录 ID' },
        status: {
          type: 'string',
          enum: ['open', 'scheduled', 'done'],
          description: '新状态：待处理 / 已预约 / 已完成',
        },
      },
      required: ['recordId', 'status'],
    },
  },
  {
    pluginId: null,
    name: 'delete_after_sales_record',
    title: '删除售后维保记录',
    description:
      '永久删除一条售后维保记录。当用户明确说「删掉那条售后记录」「这条巡检记录不要了」时调用。需要 recordId；可先用 list_after_sales 找到记录 ID。操作不可撤销。',
    cost: 0.5,
    permissions: ['projects:write'],
    scope: 'project',
    mutates: true,
    projectArg: 'projectId',
    allowArchived: true,
    parameters: {
      type: 'object',
      properties: {
        projectId: projectIdParam,
        recordId: { type: 'string', description: '要删除的售后记录 ID' },
      },
      required: ['recordId'],
    },
  },
  {
    pluginId: null,
    name: 'update_company_settings',
    title: '修改公司设置',
    description:
      '修改当前账号的公司抬头与默认展示内容。当用户说「公司名改成…」「口号换成…」「报价单上的电话改成…」「报价备注/合同条款加上…」「打印报价单不要显示产品图」时调用。只允许名称、口号、电话、邮箱、地址、报价备注、合同条款、是否打印产品图；不能通过 AI 修改插件开关、文档模板、Logo/二维码、成本设置或任何密钥。',
    cost: 0.5,
    permissions: ['settings:write'],
    scope: 'workspace',
    mutates: true,
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '公司 / 抬头名称（最多 60 字）' },
        slogan: { type: 'string', description: '副标题 / 口号（最多 80 字）' },
        phone: { type: 'string', description: '联系电话（最多 30 字）' },
        email: { type: 'string', description: '邮箱（最多 80 字）' },
        address: { type: 'string', description: '地址（最多 200 字）' },
        quoteNotes: { type: 'string', description: '新报价的默认备注（最多 2000 字）' },
        contractTerms: { type: 'string', description: '合同默认条款（最多 5000 字）' },
        printProductImages: {
          type: 'boolean',
          description: '打印报价单时是否显示产品图片',
        },
      },
    },
  },
]
