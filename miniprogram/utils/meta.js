const { api } = require('./request')

/** 字典与配置（设备类型、平台、状态、AI 模型…）只取一次，全局缓存。 */
let cache = null
let pending = null

function getMeta(force) {
  if (cache && !force) return Promise.resolve(cache)
  if (pending) return pending
  pending = api
    .get('/meta', null, { silent: true })
    .then((m) => {
      cache = m
      pending = null
      return m
    })
    .catch((e) => {
      pending = null
      throw e
    })
  return pending
}

/** 设备类型按类别分组（放置设备、换类型的选择面板用） */
function typeGroups(meta) {
  return meta.categories
    .map((c) => Object.assign({}, c, { types: meta.deviceTypes.filter((t) => t.category === c.name) }))
    .filter((g) => g.types.length)
}

module.exports = { getMeta, typeGroups }
