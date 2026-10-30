const { yuan, relTime, quoteBadge } = require('./format')

/** 把接口数据加工成 WXML 直接可用的字段（WXML 里不能调用函数）。 */
const STEP_KEYS = [0, 1, 2, 3, 4]

function project(p) {
  return Object.assign({}, p, {
    steps: STEP_KEYS.map((i) => i <= p.progress.index),
    place: [p.community, p.address].filter(Boolean).join(' '),
    metaLine: [p.customerName || '未填写客户', p.platform || '待定', p.pointCount + ' 个点位'].join(' · '),
    time: relTime(p.updatedAt),
    budgetText: p.budget ? yuan(p.budget) : '',
  })
}

function quote(q) {
  return Object.assign({}, q, { totalText: yuan(q.total), time: relTime(q.updatedAt), badge: quoteBadge(q.status) })
}

module.exports = { project, quote }
