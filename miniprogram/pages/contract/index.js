const { api, toast } = require('../../utils/request')
const { yuan, date, quoteBadge } = require('../../utils/format')
const { openDocument } = require('../../utils/route')

/** 合同：每个项目一份，由报价生成；签订后合同和依据的报价锁定，只能登记收款。 */
let seq = 0
const key = () => 'p' + ++seq
const today = () => {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

Page({
  data: {
    projectId: '',
    loading: true,
    archived: false,
    readOnly: false,
    contract: null,
    quotes: [],
    selectedQuote: '',
    form: null,
    signed: false,
    signedText: '',
    amountText: '',
    percentTotal: 0,
    percentOk: true,
    showTerms: false,
    saving: false,
  },

  onLoad(query) {
    this.setData({ projectId: query.projectId })
    this.load()
  },

  async load() {
    const d = await api.get('/projects/' + this.data.projectId + '/contract')
    const c = d.contract
    wx.setNavigationBarTitle({ title: c ? '合同 ' + c.number : '生成合同' })
    const quotes = d.quotes.map((q) => Object.assign({}, q, { totalText: yuan(q.total), badge: quoteBadge(q.status) }))
    const accepted = quotes.find((q) => q.status === 'accepted')
    this.setData({
      loading: false,
      archived: d.project.archived,
      readOnly: d.project.archived,
      contract: c,
      quotes,
      selectedQuote: this.data.selectedQuote || (accepted ? accepted.id : quotes[0] ? quotes[0].id : ''),
      signed: Boolean(c && c.status === 'signed'),
      signedText: c && c.signedAt ? date(c.signedAt) : '',
      form: c
        ? {
            number: c.number,
            quoteId: c.quoteId,
            amountText: String(c.amount),
            customerName: c.customerName,
            customerPhone: c.customerPhone,
            address: c.address,
            durationText: c.durationDays === null ? '' : String(c.durationDays),
            warrantyText: c.warrantyMonths === null ? '' : String(c.warrantyMonths),
            terms: c.terms,
            payments: c.payments.map((p) => ({ key: key(), name: p.name, percent: p.percent, percentText: String(p.percent), received: p.received })),
          }
        : null,
    })
    if (c) this.recompute()
  },

  recompute() {
    const amount = parseFloat(this.data.form.amountText) || 0
    const total = Math.round(this.data.form.payments.reduce((s, p) => s + (Number(p.percent) || 0), 0) * 100) / 100
    this.setData({
      amountText: yuan(amount),
      percentTotal: total,
      percentOk: !this.data.form.payments.length || Math.abs(total - 100) < 0.001,
      'form.payments': this.data.form.payments.map((p) => Object.assign({}, p, { amountText: yuan(Math.round(amount * (Number(p.percent) || 0)) / 100) })),
    })
  },

  selectQuote(e) {
    this.setData({ selectedQuote: e.currentTarget.dataset.id })
  },
  async create() {
    this.setData({ saving: true })
    try {
      await api.post('/projects/' + this.data.projectId + '/contract', { quoteId: this.data.selectedQuote })
      getApp().touchData()
      toast('已生成合同，请核对内容')
      this.load()
    } finally {
      this.setData({ saving: false })
    }
  },

  onInput(e) {
    this.setData({ ['form.' + e.currentTarget.dataset.key]: e.detail.value })
    if (e.currentTarget.dataset.key === 'amountText') this.recompute()
  },
  onPayment(e) {
    const i = Number(e.currentTarget.dataset.index)
    const p = Object.assign({}, this.data.form.payments[i])
    if (e.currentTarget.dataset.key === 'name') p.name = e.detail.value
    else {
      p.percentText = e.detail.value
      p.percent = parseFloat(e.detail.value) || 0
    }
    this.setData({ ['form.payments[' + i + ']']: p })
    this.recompute()
  },
  onReceived(e) {
    const i = Number(e.currentTarget.dataset.index)
    this.setData({ ['form.payments[' + i + '].received']: e.detail.value })
    if (this.data.signed) this.save()
  },
  addPayment() {
    this.setData({ 'form.payments': this.data.form.payments.concat({ key: key(), name: '', percent: 0, percentText: '', received: false }) })
    this.recompute()
  },
  removePayment(e) {
    const i = Number(e.currentTarget.dataset.index)
    this.setData({ 'form.payments': this.data.form.payments.filter((_, k) => k !== i) })
    this.recompute()
  },
  toggleTerms() {
    this.setData({ showTerms: !this.data.showTerms })
  },

  async save() {
    const f = this.data.form
    const int = (v) => (v === '' ? null : parseInt(v, 10))
    const body = {
      number: f.number,
      quoteId: f.quoteId,
      amount: parseFloat(f.amountText) || 0,
      customerName: f.customerName,
      customerPhone: f.customerPhone,
      address: f.address,
      durationDays: int(f.durationText),
      warrantyMonths: int(f.warrantyText),
      terms: f.terms,
      payments: f.payments.map((p) => ({ name: p.name, percent: Number(p.percent) || 0, received: Boolean(p.received) })),
    }
    this.setData({ saving: true })
    try {
      await api.put('/contracts/' + this.data.contract.id, body)
      getApp().touchData()
      wx.showToast({ title: '已保存', icon: 'success' })
      this.load()
    } finally {
      this.setData({ saving: false })
    }
  },

  toggleSign() {
    const signed = this.data.signed
    wx.showModal({
      title: signed ? '撤销签订' : '标记为已签订',
      content: signed ? '撤销后合同和报价可以重新修改。' : '签订日期记为今天（' + today() + '）。签订后合同和依据的报价锁定，只能登记收款。',
      success: async (r) => {
        if (!r.confirm) return
        await api.post('/contracts/' + this.data.contract.id + '/status', { status: signed ? 'draft' : 'signed', signedAt: today() })
        getApp().touchData()
        toast(signed ? '已撤销签订' : '已标记签订')
        this.load()
      },
    })
  },

  more() {
    const c = this.data.contract
    const actions = []
    if (c.quoteId) actions.push({ label: '查看依据的报价', run: () => wx.navigateTo({ url: '/pages/quote/index?id=' + c.quoteId }) })
    if (!this.data.signed && !this.data.readOnly) actions.push({ label: '删除合同', run: () => this.remove() })
    if (!actions.length) return
    wx.showActionSheet({ itemList: actions.map((a) => a.label), success: (r) => actions[r.tapIndex].run() })
  },
  remove() {
    wx.showModal({
      title: '删除合同',
      content: '删除合同 ' + this.data.contract.number + '？删除后可以重新用报价生成。',
      confirmColor: '#a51d24',
      success: async (r) => {
        if (!r.confirm) return
        await api.del('/contracts/' + this.data.contract.id)
        getApp().touchData()
        this.setData({ contract: null, form: null })
        this.load()
      },
    })
  },
})
