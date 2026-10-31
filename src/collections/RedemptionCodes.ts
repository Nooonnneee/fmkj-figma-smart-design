import { randomBytes } from 'node:crypto'
import type { CollectionConfig } from 'payload'

import { isCmsAdmin } from '@/lib/access'
import { MEMBERSHIP_TIERS } from '@/lib/membership'

function generateRedemptionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(12)
  const seg = (start: number) =>
    Array.from({ length: 4 }, (_, i) => chars[bytes[start + i]! % chars.length]).join('')
  return `FMKJ-${seg(0)}-${seg(4)}-${seg(8)}`
}

/**
 * 兑换码（方案 A）：
 * 管理员在 /admin 后台生成兑换码（可单独充 AI 积分、单独开通会员时长、或「会员 + 积分」组合包）。
 * 前台成员在「会员与积分」页或小程序输入兑换码即可自动核销入账。
 */
export const RedemptionCodes: CollectionConfig = {
  slug: 'redemption-codes',
  graphQL: false,
  labels: { singular: '兑换码', plural: '兑换码' },
  admin: {
    useAsTitle: 'code',
    defaultColumns: ['code', 'label', 'grantTier', 'durationDays', 'credits', 'usedCount', 'maxUses', 'status'],
    group: '账号',
    description: '新建兑换码发放会员时长或 AI 积分（兑换码留空时自动生成 FMKJ-XXXX-XXXX-XXXX）。',
  },
  access: {
    read: ({ req }) => isCmsAdmin(req),
    create: ({ req }) => isCmsAdmin(req),
    update: ({ req }) => isCmsAdmin(req),
    delete: ({ req }) => isCmsAdmin(req),
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data
        const raw = typeof data.code === 'string' ? data.code.trim().toUpperCase() : ''
        data.code = raw || generateRedemptionCode()
        return data
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'code',
          label: '兑换码',
          type: 'text',
          required: true,
          unique: true,
          index: true,
          maxLength: 40,
          admin: {
            placeholder: '留空自动生成，如 FMKJ-8K3P-9M2X-4Q7W',
          },
        },
        {
          name: 'label',
          label: '套餐 / 备注名称',
          type: 'text',
          maxLength: 80,
          admin: {
            placeholder: '如：专业版年卡 + 500 积分',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'grantTier',
          label: '开通会员等级',
          type: 'select',
          required: true,
          defaultValue: 'none',
          options: [
            { label: '不改变会员等级（仅充积分）', value: 'none' },
            ...MEMBERSHIP_TIERS.filter((t) => t.value !== 'free').map((t) => ({
              label: `${t.label}（${t.badge}）`,
              value: t.value,
            })),
          ],
        },
        {
          name: 'durationDays',
          label: '会员有效天数',
          type: 'number',
          required: true,
          defaultValue: 30,
          min: 0,
          max: 3650,
          admin: {
            description: '如 30（月卡）、365（年卡）；仅充积分时填 0',
          },
        },
        {
          name: 'credits',
          label: '赠送 AI 积分',
          type: 'number',
          required: true,
          defaultValue: 100,
          min: 0,
          max: 1000000,
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'maxUses',
          label: '最大可用次数',
          type: 'number',
          required: true,
          defaultValue: 1,
          min: 1,
          max: 10000,
          admin: { description: '默认 1（一码一用）；活动通用码可设为多人可用，每个账号限兑一次' },
        },
        {
          name: 'usedCount',
          label: '已使用次数',
          type: 'number',
          defaultValue: 0,
          min: 0,
          admin: { readOnly: true },
        },
        {
          name: 'status',
          label: '状态',
          type: 'select',
          required: true,
          defaultValue: 'active',
          options: [
            { label: '有效', value: 'active' },
            { label: '已用完 / 停用', value: 'disabled' },
          ],
        },
      ],
    },
    {
      name: 'expiresAt',
      label: '兑换截止时间（可选）',
      type: 'date',
      admin: { description: '留空表示长期可兑换' },
    },
    {
      name: 'redeemedBy',
      label: '兑换记录',
      type: 'array',
      admin: { readOnly: true },
      fields: [
        { name: 'user', label: '成员', type: 'relationship', relationTo: 'users', required: true },
        { name: 'redeemedAt', label: '兑换时间', type: 'date', required: true },
      ],
    },
  ],
  timestamps: true,
}
