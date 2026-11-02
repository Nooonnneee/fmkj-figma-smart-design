const { api, absUrl } = require('../../utils/request')
const { yuan } = require('../../utils/format')

Page({
  data: { p: null },
  async onLoad(query) {
    const p = await api.get('/products/' + query.id)
    this.setData({ p: Object.assign({}, p, { imageUrl: absUrl(p.image), priceText: yuan(p.price), costText: p.cost === null ? '' : yuan(p.cost) }) })
  },
})
