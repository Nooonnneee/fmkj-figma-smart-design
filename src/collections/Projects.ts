import { APIError, type Access, type CollectionConfig, type Where } from 'payload'

import { cmsAdminOrMember, fieldCmsAdminOnly, isCmsAdmin, isMember, relId } from '@/lib/access'
import { countScenePoints } from '@/lib/point-count'
import { canEditProject } from '@/lib/project-access'
import { ARCHIVED_MESSAGE } from '@/lib/project-guards'
import { autoProjectName, PROJECT_PLATFORMS, PROJECT_STATUSES } from '@/lib/projects'

const opts = (list: readonly { value: string; label: string }[]) => list.map(({ value, label }) => ({ value, label }))

/** 行级读取控制：成员只能看到自己创建的项目、受邀协作的项目，以及未指定负责人的演示项目。 */
export const readProjectAccess: Access = ({ req }) => {
  if (isCmsAdmin(req)) return true
  if (!isMember(req) || !req.user) return false
  const where: Where = {
    or: [
      { owner: { equals: req.user.id } },
      { owner: { exists: false } },
      { 'collaborators.user': { equals: req.user.id } },
    ],
  }
  return where
}

/** 只有 CMS 管理员或项目创建者可以删除项目。 */
const deleteProjectAccess: Access = ({ req }) => {
  if (isCmsAdmin(req)) return true
  if (!isMember(req) || !req.user) return false
  const where: Where = {
    or: [{ owner: { equals: req.user.id } }, { owner: { exists: false } }],
  }
  return where
}

/** 成员在已归档项目上可以改的字段：只有状态（恢复项目）。 */
const EDITABLE_WHEN_ARCHIVED = new Set(['status', 'archivedAt', 'pointCount', 'updatedAt', 'createdAt', 'id'])
const sameValue = (a: unknown, b: unknown) => {
  const norm = (v: unknown) => (v && typeof v === 'object' && 'id' in (v as object) && !Array.isArray(v) ? relId(v) : (v ?? null))
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b))
}

export const Projects: CollectionConfig = {
  slug: 'projects',
  labels: { singular: '项目', plural: '项目' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'customerName', 'status', 'pointCount', 'updatedAt'],
    group: '项目',
  },
  defaultSort: '-updatedAt',
  access: {
    read: readProjectAccess,
    create: cmsAdminOrMember,
    update: readProjectAccess,
    delete: deleteProjectAccess,
  },
  hooks: {
    beforeValidate: [
      // 项目名称留空时按「小区 + 房号」或客户姓名自动生成
      ({ data }) => {
        if (data && !String(data.name ?? '').trim()) data.name = autoProjectName(data)
        return data
      },
    ],
    beforeChange: [
      ({ data, operation, originalDoc, req }) => {
        // 协作权限检查：仅查看（read）协作者不能修改项目
        if (operation === 'update' && originalDoc && isMember(req) && req.user) {
          // 允许通过协作链接加入时由服务端 overrideAccess 更新 collaborators，普通成员请求需校验编辑权限
          if (!canEditProject(originalDoc as never, req.user.id)) {
            throw new APIError('你对该项目仅有查看权限，无法修改', 403)
          }
        }
        // 已归档的项目只读：成员只能把它恢复为进行中（Payload 会用原值补齐未提交的字段，所以逐个比较值）
        if (operation === 'update' && originalDoc?.status === 'archived' && data.status === 'archived' && isMember(req)) {
          const changed = Object.keys(data).filter((k) => !EDITABLE_WHEN_ARCHIVED.has(k) && !sameValue(data[k], originalDoc[k]))
          if (changed.length) throw new APIError(ARCHIVED_MESSAGE, 403)
        }
        // 新建时未指定负责人，默认由当前成员负责（服务端设置，不信任客户端）
        if (operation === 'create' && !data.owner && req.user?.collection === 'users') data.owner = req.user.id
        // 点位数由点位图自动统计，项目列表和进度不用再读取整张点位图
        data.pointCount = countScenePoints(data.pointMap)
        // 归档时间跟随状态
        if (data.status === 'archived' && originalDoc?.status !== 'archived') data.archivedAt = new Date().toISOString()
        if (data.status !== 'archived') data.archivedAt = null
        return data
      },
    ],
  },
  fields: [
    {
      name: 'name',
      label: '项目名称',
      type: 'text',
      required: true,
      maxLength: 120,
      admin: { description: '留空时按「小区 + 房号」或客户姓名自动生成' },
    },
    {
      type: 'row',
      fields: [
        { name: 'customerName', label: '客户姓名', type: 'text', maxLength: 60 },
        { name: 'customerPhone', label: '客户电话', type: 'text', maxLength: 30 },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'community', label: '小区 / 楼盘', type: 'text', maxLength: 80 },
        { name: 'address', label: '房号 / 详细地址', type: 'text', maxLength: 200 },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'platform', label: '主平台', type: 'select', options: PROJECT_PLATFORMS.map((p) => ({ value: p, label: p })) },
        { name: 'budget', label: '预算（元）', type: 'number', min: 0 },
        { name: 'owner', label: '负责人', type: 'relationship', relationTo: 'users' },
      ],
    },
    {
      name: 'status',
      label: '状态',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: opts(PROJECT_STATUSES),
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'archivedAt',
      label: '归档时间',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true, condition: (data) => data?.status === 'archived' },
    },
    {
      name: 'pointCount',
      label: '点位数',
      type: 'number',
      admin: { position: 'sidebar', readOnly: true, description: '保存点位图时自动统计' },
    },
    { name: 'notes', label: '备注', type: 'textarea', maxLength: 2000 },
    {
      // Excalidraw 场景（elements / appState / files），在前台点位图页面编辑。
      name: 'pointMap',
      label: '点位图',
      type: 'json',
      admin: { hidden: true },
    },
    {
      // 项目默认型号：{ [设备类型]: 产品 ID }。点位未指定产品时，报价按这里取型号。
      name: 'defaultProducts',
      label: '项目默认型号',
      type: 'json',
      admin: { hidden: true },
    },
    {
      name: 'collaborators',
      label: '协作者',
      type: 'array',
      labels: { singular: '协作者', plural: '协作者' },
      admin: { description: '通过项目协作链接加入的成员及其读写权限' },
      access: {
        create: fieldCmsAdminOnly,
        update: fieldCmsAdminOnly,
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'user', label: '成员', type: 'relationship', relationTo: 'users', required: true },
            {
              name: 'role',
              label: '权限',
              type: 'select',
              required: true,
              defaultValue: 'read',
              options: [
                { label: '仅查看', value: 'read' },
                { label: '可编辑', value: 'edit' },
              ],
            },
            { name: 'joinedAt', label: '加入时间', type: 'date' },
          ],
        },
      ],
    },
    {
      // 协作分享链接配置：{ enabled: boolean, token: string, role: 'read' | 'edit' }，严禁向普通成员直接返回 token
      name: 'shareConfig',
      label: '协作链接配置',
      type: 'json',
      admin: { hidden: true },
      access: {
        read: fieldCmsAdminOnly,
        create: fieldCmsAdminOnly,
        update: fieldCmsAdminOnly,
      },
    },
  ],
}
