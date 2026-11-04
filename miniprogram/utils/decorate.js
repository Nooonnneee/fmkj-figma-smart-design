const { yuan, relTime, quoteBadge } = require('./format')

/** 把接口数据加工成 WXML 直接可用的字段（WXML 里不能调用函数）。 */
const STEP_KEYS = [0, 1, 2, 3, 4]
const DEMO_RE = /^\[示例\]\s*/

function project(p) {
  const rawName = p.name || '未命名项目'
  const isDemo = DEMO_RE.test(rawName)
  const displayName = rawName.replace(DEMO_RE, '').trim() || rawName
  const idx = p.progress ? p.progress.index : 0
  const archived = p.status === 'archived'
  const stageLabel = archived ? '已归档' : idx >= 3 ? '已签约' : idx === 2 ? '报价中' : idx === 1 ? '布点中' : '新建'
  const stageBadge = archived ? '' : idx >= 3 ? 'badge-success' : idx === 2 ? 'badge-brand' : ''
  return Object.assign({}, p, {
    displayName,
    isDemo,
    stageLabel,
    stageBadge,
    steps: STEP_KEYS.map((i) => i <= idx),
    place: [p.community, p.address].filter(Boolean).join(' '),
    metaLine: [p.customerName || '未填写客户', p.community || p.platform || '待定', (p.pointCount || 0) + ' 个点位'].join(' · '),
    time: relTime(p.updatedAt),
    budgetText: p.budget ? yuan(p.budget) : '',
  })
}

function quote(q) {
  const projectName = q.projectName ? q.projectName.replace(DEMO_RE, '').trim() : null
  return Object.assign({}, q, { projectName, totalText: yuan(q.total), time: relTime(q.updatedAt), badge: quoteBadge(q.status) })
}

module.exports = { project, quote }
