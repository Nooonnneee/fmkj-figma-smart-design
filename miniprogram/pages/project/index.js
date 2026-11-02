const { api, upload, toast } = require('../../utils/request')
const { yuan, quoteBadge, contractBadge } = require('../../utils/format')
const { openDocument } = require('../../utils/route')
const { pickImage } = require('../../utils/pick')
const { getMeta } = require('../../utils/meta')
const decorate = require('../../utils/decorate')

Page({
  data: { id: '', loading: true, p: null, owner: null, summary: null, quotes: [], contract: null, documents: [], archived: false, stepLabels: ['信息', '点位', '报价', '合同', '归档'] },
  version: -1,

  onLoad(query) {
    this.setData({ id: query.id })
  },
  onShow() {
    const v = getApp().globalData.dataVersion
    if (v !== this.version) {
      this.version = v
      this.load()
    }
  },
  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh())
  },

  async load() {
    try {
      const d = await api.get('/projects/' + this.data.id)
      wx.setNavigationBarTitle({ title: d.project.name })
      const c = d.contract
      this.setData({
        loading: false,
        p: decorate.project(d.project),
        owner: d.owner,
        archived: d.project.status === 'archived',
        summary: Object.assign({}, d.summary, { totalText: yuan(d.summary.total) }),
        quotes: d.quotes.map((q) => Object.assign({}, q, { totalText: yuan(q.total), badge: quoteBadge(q.status) })),
        contract: c ? Object.assign({}, c, { amountText: yuan(c.amount), badge: contractBadge(c.status), received: c.payments.filter((x) => x.received).length }) : null,
        documents: d.documents,
      })
    } catch (e) {
      this.setData({ loading: false })
    }
  },

  call() {
    wx.makePhoneCall({ phoneNumber: this.data.p.customerPhone })
  },
  edit() {
    wx.navigateTo({ url: '/pages/project-edit/index?id=' + this.data.id })
  },
  openPointMap() {
    wx.navigateTo({ url: '/pages/pointmap/index?id=' + this.data.id })
  },
  openQuote(e) {
    wx.navigateTo({ url: '/pages/quote/index?id=' + e.currentTarget.dataset.id })
  },
  openContract() {
    wx.navigateTo({ url: '/pages/contract/index?projectId=' + this.data.id })
  },
  openDoc(e) {
    openDocument(e.currentTarget.dataset.path, e.currentTarget.dataset.title)
  },

  nextStep() {
    const section = this.data.p.progress.next.section
    if (section === 'points') this.openPointMap()
    else if (section === 'quotes') this.generateQuote()
    else if (section === 'contract') this.openContract()
    else if (section === 'archive') this.toggleArchive()
  },

  /** 上传户型图：自动裁掉图框和标题栏，不会生成任何默认点位。 */
  async uploadSheet() {
    const img = await pickImage()
    if (!img) return
    const name = await new Promise((resolve) =>
      wx.showModal({ title: '图纸名称', editable: true, placeholderText: '例如：一层平面图', success: (r) => resolve(r.confirm ? (r.content || '').trim() : null) }),
    )
    if (name === null) return
    wx.showLoading({ title: '正在处理图纸', mask: true })
    try {
      const r = await upload('/projects/' + this.data.id + '/sheets', img.path, { name })
      wx.hideLoading()
      toast('已添加图纸「' + r.sheetName + '」')
      getApp().touchData()
      this.openPointMap()
    } catch (e) {
      wx.hideLoading()
    }
  },

  async generateQuote() {
    const m = await getMeta()
    wx.showActionSheet({
      itemList: m.pointScopes.map((s) => s.fullLabel),
      success: async (r) => {
        wx.showLoading({ title: '正在生成', mask: true })
        try {
          const d = await api.post('/projects/' + this.data.id + '/quotes', { scope: m.pointScopes[r.tapIndex].value })
          wx.hideLoading()
          getApp().touchData()
          wx.navigateTo({ url: '/pages/quote/index?id=' + d.quoteId })
          if (d.pending) toast(d.pending + ' 个点位待选型，未计入报价')
        } catch (e) {
          wx.hideLoading()
        }
      },
    })
  },

  toggleArchive() {
    const archived = this.data.archived
    wx.showModal({
      title: archived ? '恢复项目' : '归档项目',
      content: archived ? '恢复后项目回到「进行中」，可以继续修改。' : '归档后点位、报价、合同都转为只读，之后可以随时恢复。',
      success: async (r) => {
        if (!r.confirm) return
        await api.put('/projects/' + this.data.id, { status: archived ? 'active' : 'archived' })
        getApp().touchData()
        toast(archived ? '已恢复' : '已归档')
        this.load()
      },
    })
  },
})
