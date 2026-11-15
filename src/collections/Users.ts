import type { Access, CollectionConfig } from 'payload'

import { CACHE_TAGS, expireOnChange, expireOnDelete } from '@/lib/cache-tags'
import { fieldCmsAdminOnly, isCmsAdmin, isMember } from '@/lib/access'
import { DEFAULT_CONTRACT_TERMS } from '@/lib/contracts'
import { cloneDemoProjectForUser } from '@/lib/demo-project'
import { assertChannelBaseUrl } from '@/lib/ai-channels-url-guard'

/** 成员只能读取和修改自己的账号资料，防止通过 /api/users 遍历其他用户的邮箱与手机号。 */
const selfOrCmsAdmin: Access = ({ req }) => {
  if (isCmsAdmin(req)) return true
  if (isMember(req) && req.user) return { id: { equals: req.user.id } }
  return false
}

/**
 * 成员账号（系统登录用）。与 Payload 后台的 admins 账号完全分开：
 * 成员不能登录 /admin；账号由后台创建，不开放自助注册。
 * 系统只有一种成员角色，所有成员权限相同。
 */
export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: '成员', plural: '成员' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'aiCredits', 'status'],
    group: '账号',
  },
  auth: {
    tokenExpiration: 60 * 60 * 24 * 7,
    maxLoginAttempts: 0,
  },
  access: {
    admin: () => false,
    create: ({ req }) => isCmsAdmin(req),
    read: selfOrCmsAdmin,
    update: selfOrCmsAdmin,
    delete: ({ req }) => isCmsAdmin(req),
  },
  hooks: {
    afterChange: [
      expireOnChange(CACHE_TAGS.staff),
      async ({ doc, operation, req }) => {
        if (operation === 'create' && doc?.id) {
          await cloneDemoProjectForUser(doc.id, req)
        }
        return doc
      },
    ],
    afterDelete: [expireOnDelete(CACHE_TAGS.staff)],
  },
  fields: [
    { name: 'name', label: '姓名', type: 'text', required: true },
    {
      name: 'phone',
      label: '手机号',
      type: 'text',
      admin: { description: '会作为联系人显示在报价单上' },
    },
    {
      name: 'status',
      label: '状态',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: '启用', value: 'active' },
        { label: '停用', value: 'disabled' },
      ],
      admin: { description: '停用后无法登录，已有项目保留' },
      access: { create: fieldCmsAdminOnly, update: fieldCmsAdminOnly },
    },
    {
      // 只能通过「积分流水」变动（发放 / 扣减时由服务端写回），任何人都不能直接改
      name: 'aiCredits',
      label: 'AI 积分',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: '在「积分流水」里新建一条记录来发放积分',
      },
      access: { update: () => false, create: () => false },
    },
    {
      name: 'companyProfile',
      label: '个人抬头与默认设置',
      type: 'group',
      admin: {
        description:
          '每个账号独立的报价单/合同抬头、联系方式、Logo、二维码与文档默认模板；未填写时回退使用系统默认抬头。',
      },
      fields: [
        { name: 'name', label: '抬头名称', type: 'text', maxLength: 60 },
        { name: 'slogan', label: '副标题', type: 'text', maxLength: 80 },
        {
          type: 'row',
          fields: [
            { name: 'phone', label: '联系电话', type: 'text', maxLength: 30 },
            { name: 'email', label: '邮箱', type: 'text', maxLength: 80 },
          ],
        },
        { name: 'address', label: '地址', type: 'text', maxLength: 200 },
        {
          type: 'row',
          fields: [
            { name: 'logo', label: 'Logo', type: 'upload', relationTo: 'media' },
            { name: 'qrCode', label: '二维码', type: 'upload', relationTo: 'media' },
          ],
        },
        { name: 'qrCaption', label: '二维码说明', type: 'text', maxLength: 40 },
        { name: 'quoteNotes', label: '新报价默认备注', type: 'textarea', maxLength: 2000 },
        {
          name: 'contractTerms',
          label: '合同默认条款',
          type: 'textarea',
          maxLength: 5000,
          defaultValue: DEFAULT_CONTRACT_TERMS,
        },
        {
          name: 'printProductImages',
          label: '打印报价单时显示产品图片',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'documentDefaults',
          label: '文档默认模板',
          type: 'json',
        },
        {
          name: 'disabledPlugins',
          label: '已关闭的插件',
          type: 'json',
        },
        {
          // { brandRates: [{ brand: 品牌标识, rate: 0.65 }], defaultRate, feeCostPercent, minMarginPercent }，见 src/lib/quote-costs.ts
          name: 'costSettings',
          label: '报价成本与毛利设置',
          type: 'json',
          admin: {
            description:
              '在系统「设置 → 报价成本与毛利」里修改：品牌拿货折扣、附加费用成本占比与毛利率底线，仅本人在报价台可见',
          },
        },
        {
          /**
           * 成员自填的 AI 渠道（客户自带 key）。2026-11-15 提案乙节已批准：只在桌面客户端开放。
           *
           * 安全约定（改这个字段前先读 `src/lib/ai-channels-url-guard.ts`）：
           * - `apiKeyCipher` 是 AES-256-GCM 密文（`src/lib/ai-channels-crypto.ts`），字段级
           *   `read: () => false`，任何 API 响应都不会带出来；服务端内部读库要用
           *   `overrideAccess: true`（字段级 read 权限管不到 overrideAccess）。
           * - 读写走 `/api/users/channels` 端点，**只认 `req.user`**，不接受请求体里的 userId。
           * - `baseUrl` 必须是公网 HTTPS，且比 `normalizeCustomBaseUrl` 更严（拒绝 IP 字面值、
           *   非 443 端口、user:pass@ 形式），发请求前还会做一次 DNS 解析校验。
           */
          name: 'aiChannels',
          label: '我的 AI 渠道（自带 key）',
          type: 'array',
          labels: { singular: 'AI 渠道', plural: 'AI 渠道' },
          /**
           * 数组层写权限 = 只有 CMS 超管（后台里人工维护）。
           *
           * 为什么不是只给子字段加 `update: () => false`（**实测过，不够**）：
           * Payload 处理 array 字段是**整段替换**行数据 —— 子字段被拒绝写入的值会变成
           * `null`，而不是保留库里原来的值。成员一次 PATCH `/api/users` 就能把自己的
           * `apiKeyCipher` / `lastCheckOk` 抹成 null（密文丢失，客户只能重填 key）。
           * 在数组这一层关掉成员写权限后，成员既改不出伪造值，也抹不掉自己的密文。
           *
           * 成员维护渠道只走 `/api/ai/channels`：那条路径是服务层 `overrideAccess: true`，
           * 字段级 access 对它不生效（Payload 的设计），所以白名单、条数上限、baseUrl
           * 校验、加密全部由 `src/lib/ai-channels.ts` 负责。
           */
          access: {
            create: ({ req }) => isCmsAdmin(req),
            update: ({ req }) => isCmsAdmin(req),
          },
          admin: {
            description:
              '客户自带的 AI 渠道，只在桌面客户端「我的 AI 配置」里填写。密钥加密存储，页面与接口都不会显示明文。',
          },
          fields: [
            {
              name: 'key',
              label: '渠道标识',
              type: 'text',
              required: true,
              maxLength: 40,
              validate: (value: unknown) => {
                if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(value)) {
                  return '标识只能用字母、数字、- 和 _，最多 40 字'
                }
                return true
              },
            },
            { name: 'label', label: '显示名', type: 'text', required: true, maxLength: 60 },
            {
              name: 'baseUrl',
              label: '接口根地址',
              type: 'text',
              required: true,
              maxLength: 300,
              validate: (value: unknown) => {
                try {
                  assertChannelBaseUrl(value)
                  return true
                } catch (error) {
                  return (error as Error).message || '接口地址无效'
                }
              },
            },
            {
              // 密文：任何 API 响应都不得出现。服务端内部读库必须 overrideAccess: true。
              // `update: () => false` 挡住集合层 REST/GraphQL：成员不能自己塞一个假密文
              // （字段级 access 对服务端的 overrideAccess: true 不生效，所以 /api/ai/channels 照常写）。
              name: 'apiKeyCipher',
              label: '密钥（加密存储）',
              type: 'text',
              maxLength: 4096,
              access: { read: () => false, create: () => false, update: () => false },
              admin: {
                readOnly: true,
                description: '仅供服务端解密使用，不会出现在任何接口响应里',
              },
            },
            {
              name: 'apiKeyHint',
              label: '密钥提示',
              type: 'text',
              maxLength: 16,
              access: { create: () => false, update: () => false },
              admin: {
                readOnly: true,
                description: '只读展示：例如 ...abcd，让客户确认填的是哪个 key',
              },
            },
            {
              name: 'models',
              label: '模型名',
              type: 'text',
              hasMany: true,
              maxLength: 120,
              admin: { description: '该渠道下可选的模型名（纯文本），可留空' },
            },
            { name: 'enabled', label: '启用', type: 'checkbox', defaultValue: true },
            // 检查结果只能由 /api/ai/channels/:key/test 写：`update: () => false` 挡住
            // 集合层 REST/GraphQL 伪造「已验证」（否则将来按 lastCheckOk 计费/放量会被骗）。
            {
              name: 'lastCheckedAt',
              label: '最近检查时间',
              type: 'date',
              access: { create: () => false, update: () => false },
              admin: { readOnly: true },
            },
            {
              name: 'lastCheckOk',
              label: '最近检查是否通过',
              type: 'checkbox',
              access: { create: () => false, update: () => false },
              admin: { readOnly: true },
            },
            {
              name: 'lastCheckError',
              label: '最近检查错误',
              type: 'text',
              maxLength: 300,
              access: { create: () => false, update: () => false },
              admin: { readOnly: true },
            },
          ],
        },
      ],
    },
  ],
}
