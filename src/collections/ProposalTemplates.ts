import type { CollectionConfig } from 'payload'

import { cmsAdminOnly, cmsAdminOrMember } from '@/lib/access'
import { MEMBERSHIP_TIERS } from '@/lib/membership'
import { DECK_SECTIONS, PROPOSAL_FRAMEWORKS } from '@/plugins/proposal/framework'

const THEMES = [
  { label: '栖序雅致（暖白 · 灰紫 · 色带封面）', value: 'qixu' },
  { label: '墨金臻选（深色 · 香槟金 · 整幅封面）', value: 'noir' },
  { label: '原木自然（燕麦 · 橄榄绿 · 分栏封面）', value: 'grove' },
  { label: '晨岚现代（冷白 · 深海蓝 · 细线卡片）', value: 'azure' },
  { label: '陶土暖阳（米杏 · 陶土橙 · 圆角）', value: 'terra' },
  { label: '素白极简（纯白 · 纯文字大字封面）', value: 'mono' },
  { label: '晨曦暖调（奶油 · 陶土橙 · 竖幅照片）', value: 'dawn' },
  { label: '东方雅韵（宣纸 · 青瓷绿 · 衬线）', value: 'jade' },
]

/**
 * 方案模板 = 版式框架（推荐章节顺序）× 视觉主题，可以再调整章节、换强调色、封面图和文案，并设置导出所需的会员等级。
 * 方案页的模板选择以这里为准；一个模板都没有时使用内置模板。
 */
export const ProposalTemplates: CollectionConfig = {
  slug: 'proposal-templates',
  labels: { singular: '方案模板', plural: '方案模板' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'framework', 'theme', 'tier', 'enabled', 'sortOrder'],
    group: '方案',
    description: '模板 = 版式框架（有哪些章节）+ 视觉主题（配色与版式），再换上自己的强调色、封面图和标语。',
  },
  defaultSort: 'sortOrder',
  access: { read: cmsAdminOrMember, create: cmsAdminOnly, update: cmsAdminOnly, delete: cmsAdminOnly },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'name', label: '模板名称', type: 'text', required: true },
        { name: 'slug', label: '标识', type: 'text', required: true, unique: true, index: true, admin: { description: '只用英文、数字和短横线' } },
      ],
    },
    { name: 'description', label: '说明', type: 'text', admin: { description: '模板选择器里显示' } },
    {
      type: 'row',
      fields: [
        { name: 'framework', label: '版式框架', type: 'select', required: true, defaultValue: 'full', options: PROPOSAL_FRAMEWORKS.map((f) => ({ label: f.label, value: f.value })) },
        { name: 'theme', label: '视觉主题', type: 'select', defaultValue: 'qixu', options: THEMES, admin: { description: '施工交底不使用' } },
      ],
    },
    {
      name: 'sections',
      label: '章节（按顺序）',
      type: 'select',
      hasMany: true,
      options: DECK_SECTIONS.map((s) => ({ label: s.label, value: s.value })),
      admin: { description: '留空使用版式框架的推荐章节；选择的顺序就是方案里的顺序' },
    },
    {
      type: 'row',
      fields: [
        { name: 'markers', label: '点位显示', type: 'select', defaultValue: 'number', options: [{ label: '编号', value: 'number' }, { label: '设备图标', value: 'symbol' }] },
        { name: 'tier', label: '导出所需会员', type: 'select', defaultValue: 'free', options: MEMBERSHIP_TIERS.map((t) => ({ label: t.label, value: t.value })) },
      ],
    },
    { name: 'accent', label: '强调色', type: 'text', admin: { description: '十六进制颜色，如 #7a5c22；留空沿用主题配色' }, validate: (v: unknown) => !v || /^#[0-9a-f]{6}$/i.test(String(v)) || '请填写 #RRGGBB 格式的颜色' },
    { name: 'headline', label: '封面主标语', type: 'text', admin: { description: '留空沿用主题标语' } },
    { name: 'tagline', label: '封面英文标语', type: 'text' },
    { name: 'coverImage', label: '封面图片', type: 'upload', relationTo: 'media', admin: { description: '请使用自有或已获授权的图片；留空沿用主题封面' } },
    {
      type: 'row',
      fields: [
        { name: 'enabled', label: '启用', type: 'checkbox', defaultValue: true },
        { name: 'sortOrder', label: '排序', type: 'number', defaultValue: 0 },
      ],
    },
  ],
}
