import type { Access, CollectionConfig } from 'payload'

import { CACHE_TAGS, expireOnChange, expireOnDelete } from '@/lib/cache-tags'
import { fieldCmsAdminOnly, isCmsAdmin, isMember } from '@/lib/access'

/** 成员可以看到团队里的所有成员（负责人下拉、项目列表要显示姓名），只能修改自己的资料。 */
const updateUsers: Access = ({ req }) => {
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
    defaultColumns: ['name', 'email', 'phone', 'status'],
    group: '账号',
  },
  auth: {
    tokenExpiration: 60 * 60 * 24 * 7,
  },
  access: {
    admin: () => false,
    create: ({ req }) => isCmsAdmin(req),
    read: ({ req }) => isCmsAdmin(req) || isMember(req),
    update: updateUsers,
    delete: ({ req }) => isCmsAdmin(req),
  },
  hooks: {
    afterChange: [expireOnChange(CACHE_TAGS.staff)],
    afterDelete: [expireOnDelete(CACHE_TAGS.staff)],
  },
  fields: [
    { name: 'name', label: '姓名', type: 'text', required: true },
    { name: 'phone', label: '手机号', type: 'text', admin: { description: '会作为联系人显示在报价单上' } },
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
      access: { update: fieldCmsAdminOnly },
    },
  ],
}
