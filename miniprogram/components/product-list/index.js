const { api, absUrl } = require('../../utils/request')
const { yuan } = require('../../utils/format')
const { getMeta } = require('../../utils/meta')

/** 产品列表（产品库标签页和「选择产品」页共用）：搜索、类别筛选、分页；点选时触发 select 事件。 */
const SORTS = [
  { value: '', label: '名称' },
  { value: 'price-asc', label: '价格↑' },
  { value: 'price-desc', label: '价格↓' },
  { value: 'updated', label: '最新' },
]

Component({
  properties: {
    deviceType: { type: String, value: '' },
  },
  data: { q: '', category: '', sort: '', sorts: SORTS, categories: [], typeName: '', items: [], page: 1, hasMore: false, total: 0, loading: false },
  lifetimes: {
    attached() {
      getMeta()
        .then((m) => {
          const t = m.deviceTypes.find((x) => x.value === this.properties.deviceType)
          this.setData({ categories: m.categories, typeName: t ? t.name : '' })
        })
        .catch(() => null)
      this.load(1)
    },
  },
  methods: {
    async load(page) {
      this.setData({ loading: true })
      try {
        const d = await api.get('/products', { q: this.data.q, category: this.data.category, deviceType: this.properties.deviceType, sort: this.data.sort, page, limit: 20 })
        const items = d.items.map((p) => Object.assign({}, p, { imageUrl: absUrl(p.image), priceText: yuan(p.price) }))
        this.setData({ items: page === 1 ? items : this.data.items.concat(items), page, hasMore: d.hasMore, total: d.total })
      } finally {
        this.setData({ loading: false })
      }
    },
    loadMore() {
      if (this.data.hasMore && !this.data.loading) this.load(this.data.page + 1)
    },
    reload() {
      return this.load(1)
    },
    onQuery(e) {
      this.setData({ q: e.detail.value })
      clearTimeout(this.timer)
      this.timer = setTimeout(() => this.load(1), 350)
    },
    clearQuery() {
      this.setData({ q: '' })
      this.load(1)
    },
    onCategory(e) {
      this.setData({ category: e.currentTarget.dataset.slug })
      this.load(1)
    },
    onSort(e) {
      const sort = e.currentTarget.dataset.value
      if (sort === this.data.sort) return
      this.setData({ sort })
      this.load(1)
    },
    onTap(e) {
      this.triggerEvent('select', this.data.items[e.currentTarget.dataset.index])
    },
  },
})
