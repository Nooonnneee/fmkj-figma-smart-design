import type { GlobalConfig } from 'payload'

import { CACHE_TAGS, expireGlobalOnChange } from '@/lib/cache-tags'
import { fieldCmsAdminOnly, isCmsAdmin, isMember } from '@/lib/access'
import { DEFAULT_CONTRACT_TERMS } from '@/lib/contracts'
import { AI_PROVIDER_CHANNEL_LIST } from '@/plugins/ai-copilot/templates'

/** 抬头与默认内容：报价单、合同上的名称、联系方式、Logo、二维码，以及新报价备注和合同条款的默认值。 */
export const CompanySettings: GlobalConfig = {
  slug: 'company-settings',
  label: '抬头与默认内容',
  admin: { group: '设置' },
  access: {
    read: ({ req }) => isCmsAdmin(req) || isMember(req),
    update: ({ req }) => isCmsAdmin(req),
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
    {
      // 各类文档的默认风格和版式：{ quote: { style, layout }, plans: …, contract: …, checklist: … }，在「设置」页修改
      name: 'documentDefaults',
      label: '文档默认模板',
      type: 'json',
      jsonSchema: {
        uri: 'a://fmkj/document-defaults.json',
        fileMatch: ['a://fmkj/document-defaults.json'],
        schema: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: { style: { type: 'string', maxLength: 40 }, layout: { type: 'string', maxLength: 40 } },
            additionalProperties: false,
          },
        },
      },
      admin: { description: '在系统「设置 → 文档模板」里修改' },
    },
    {
      // 已关闭的插件 ID 列表；新安装的插件默认开启
      name: 'disabledPlugins',
      label: '已关闭的插件',
      type: 'json',
      jsonSchema: {
        uri: 'a://fmkj/disabled-plugins.json',
        fileMatch: ['a://fmkj/disabled-plugins.json'],
        schema: { type: 'array', maxItems: 50, items: { type: 'string', minLength: 1, maxLength: 40 } },
      },
      admin: { description: '在系统「设置 → 插件」里修改' },
    },
    {
      // 全局 AI 模型与网关配置（仅限 /admin 超级管理员查看与修改，前台普通用户无权读取或修改）
      name: 'aiModels',
      label: '全局 AI 模型与接口配置（仅管理员）',
      type: 'array',
      labels: { singular: 'AI 模型', plural: 'AI 模型' },
      access: {
        read: fieldCmsAdminOnly,
        update: fieldCmsAdminOnly,
      },
      admin: {
        description:
          '仅超级管理员在 /admin 后台配置，对全局所有网页与小程序用户生效。留空时默认使用内置 DeepSeek 模型。使用 NewAPI 聚合网关时请在环境变量配置 NEWAPI_BASE_URL 与 NEWAPI_API_KEY。',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'name',
              label: '显示名称（展示给用户）',
              type: 'text',
              required: true,
              maxLength: 80,
              admin: { placeholder: '如：DeepSeek V3 / GPT-4o / 通义千问 Max' },
            },
            {
              name: 'channelId',
              label: '接口渠道',
              type: 'select',
              required: true,
              defaultValue: 'deepseek',
              options: AI_PROVIDER_CHANNEL_LIST.map((ch) => ({
                label: `${ch.label}（${ch.apiKeyEnv}）`,
                value: ch.id,
              })),
            },
            {
              name: 'apiModel',
              label: '接口模型名（model 参数）',
              type: 'text',
              required: true,
              maxLength: 120,
              admin: { placeholder: '如：deepseek-chat / gpt-4o-mini / qwen-plus' },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'cost',
              label: '计费倍率',
              type: 'number',
              required: true,
              defaultValue: 1,
              min: 0,
              max: 100,
              admin: {
                description: '按用量计费：每次对话积分 = 倍率 ×（每 1K 输入 tokens 0.1 + 每 1K 输出 tokens 0.5）+ 工具调用费用，向上取整、最少 1。贵的模型可设 2、3。',
              },
            },
            {
              name: 'tag',
              label: '展示标签',
              type: 'text',
              defaultValue: '工具调用',
              maxLength: 40,
            },
            {
              name: 'description',
              label: '模型简介',
              type: 'text',
              maxLength: 200,
            },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'enabled', label: '启用该模型', type: 'checkbox', defaultValue: true },
            { name: 'isDefault', label: '设为默认模型', type: 'checkbox', defaultValue: false },
            { name: 'reasoning', label: '支持深度思考过程（如 R1）', type: 'checkbox', defaultValue: false },
          ],
        },
      ],
    },
  ],
}
