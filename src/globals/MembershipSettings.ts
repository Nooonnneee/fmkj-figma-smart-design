import type { GlobalConfig } from 'payload'

import { cmsAdminOnly, cmsAdminOrMember } from '@/lib/access'

/** 会员设置：权益是「只提示」还是「严格限制」，以及前台显示的升级方式说明。 */
export const MembershipSettings: GlobalConfig = {
  slug: 'membership-settings',
  label: '会员设置',
  admin: { group: '账号', description: '会员等级与权益见「会员与积分」页；这里决定低于所需等级时是只提示还是直接限制。' },
  access: { read: cmsAdminOrMember, update: cmsAdminOnly },
  fields: [
    {
      name: 'enforcement',
      label: '权益限制方式',
      type: 'radio',
      defaultValue: 'soft',
      options: [
        { label: '提示模式：显示所需等级与升级入口，不限制使用（适合试运营）', value: 'soft' },
        { label: '严格模式：高级模板不能导出、高级插件不能启用、资料包不能打包、协作成员按等级限制', value: 'strict' },
      ],
    },
    {
      name: 'upgradeHint',
      label: '升级方式说明',
      type: 'textarea',
      defaultValue: '联系服务顾问获取兑换码，在「会员与积分」页输入兑换码即可开通或续期。',
      admin: { description: '显示在会员页和各处「升级」提示里，例如客服微信、购买链接' },
    },
  ],
}
