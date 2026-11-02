const { api, toast } = require('../../utils/request')
const { getMeta } = require('../../utils/meta')

Page({
  data: {
    id: '',
    form: { name: '', customerName: '', customerPhone: '', community: '', address: '', platform: '米家', budget: '', notes: '' },
    platforms: ['米家', 'Aqara Home', 'Apple Home', '华为鸿蒙智家', 'KNX', 'Control4', '网络/弱电', '待定'],
    platformIndex: 0,
    errors: {},
    saving: false,
  },

  async onLoad(query) {
    getMeta()
      .then((m) => this.setData({ platforms: m.platforms, platformIndex: Math.max(0, m.platforms.indexOf(this.data.form.platform)) }))
      .catch(() => null)
    if (!query.id) return
    wx.setNavigationBarTitle({ title: '编辑项目' })
    this.setData({ id: query.id })
    const d = await api.get('/projects/' + query.id)
    const p = d.project
    this.setData({
      form: {
        name: p.name || '',
        customerName: p.customerName || '',
        customerPhone: p.customerPhone || '',
        community: p.community || '',
        address: p.address || '',
        platform: p.platform || '待定',
        budget: p.budget === null || p.budget === undefined ? '' : String(p.budget),
        notes: p.notes || '',
      },
      platformIndex: Math.max(0, this.data.platforms.indexOf(p.platform)),
    })
  },

  onInput(e) {
    this.setData({ ['form.' + e.currentTarget.dataset.key]: e.detail.value })
  },
  onPlatform(e) {
    const i = Number(e.detail.value)
    this.setData({ platformIndex: i, 'form.platform': this.data.platforms[i] })
  },

  async save() {
    this.setData({ saving: true, errors: {} })
    try {
      const res = this.data.id ? await api.put('/projects/' + this.data.id, this.data.form) : await api.post('/projects', this.data.form)
      getApp().touchData()
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => {
        if (this.data.id) wx.navigateBack()
        else wx.redirectTo({ url: '/pages/project/index?id=' + res.id })
      }, 500)
    } catch (e) {
      if (e.fieldErrors) this.setData({ errors: e.fieldErrors })
      else if (!e.status) toast(e.message)
    } finally {
      this.setData({ saving: false })
    }
  },
})
