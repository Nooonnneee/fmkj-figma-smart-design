import type { GlobalConfig } from 'payload'

import { CACHE_TAGS, expireGlobalOnChange } from '@/lib/cache-tags'
import { isCmsAdmin, isMember } from '@/lib/access'
import { DEFAULT_CONTRACT_TERMS } from '@/lib/contracts'

/** 抬头与默认内容：报价单、合同上的名称、联系方式、Logo、二维码，以及新报价备注和合同条款的默认值。 */
export const CompanySettings: GlobalConfig = {
  slug: 'company-settings',
  label: '抬头与默认内容',
  admin: { group: '设置' },
  access: {
    read: ({ req }) => isCmsAdmin(req) || isMember(req),
    update: ({ req }) => isCmsAdmin(req) || isMember(req),
  },
  hooks: { afterChange: [expireGlobalOnChange(CACHE_TAGS.company)] },
  fields: [
    {
      name: 'name',
      label: '名称',
      type: 'text',
      required: true,
      defaultValue: 'FMKJ 智能家居',
      maxLength: 60,
      admin: { description: '公司、工作室或个人名称，显示在报价单和合同上' },
    },
    { name: 'slogan', label: '副标题', type: 'text', defaultValue: '全屋智能方案 · 设计 · 安装 · 售后', maxLength: 80 },
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
    { name: 'qrCaption', label: '二维码说明', type: 'text', defaultValue: '扫码添加微信', maxLength: 40 },
    { name: 'quoteNotes', label: '新报价默认备注', type: 'textarea', maxLength: 2000 },
    { name: 'contractTerms', label: '合同默认条款', type: 'textarea', maxLength: 5000, defaultValue: DEFAULT_CONTRACT_TERMS },
    { name: 'printProductImages', label: '打印报价单时显示产品图片', type: 'checkbox', defaultValue: true },
  ],
}
