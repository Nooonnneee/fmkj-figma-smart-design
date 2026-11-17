const { api, absUrl, toast } = require('../../utils/request')
const { yuan } = require('../../utils/format')
const { getMeta } = require('../../utils/meta')
const { openDocument } = require('../../utils/route')

/**
 * 报价单：逐行改单价和数量、换同类型号、添加产品、附加费用、优惠、状态；
 * 从点位图同步数量（保留改价和换过的型号）；打印预览；客户确认后生成合同。合计由服务端重新计算。
 */
let seq = 0
const key = () => 'k' + ++seq
const num = (v) => {
  const n = parseFloat(v)
  return isFinite(n) && n >= 0 ? n : 0
}

Page({
  data: {
    id: '',
    loading: true,
    title: '',
    status: 'draft',
    statuses: [
      { value: 'draft', label: '草稿' },
      { value: 'sent', label: '已发送' },
      { value: 'accepted', label: '已确认' },
    ],
    items: [],
    fees: [],
    discountText: '0',
    notes: '',
    totals: {},
    project: null,
    contract: null,
    readOnly: false,
    lockReason: '',
    printPath: '',
    canContract: false,
    dirty: false,
    saving: false,
  },

  onLoad(query) {
    this.setData({ id: query.id })
    getMeta()
      .then((m) => this.setData({ statuses: m.quoteStatuses }))
      .catch(() => null)
    this.load()
  },

  async load() {
    const d = await api.get('/quotes/' + this.data.id)
    const q = d.quote
    wx.setNavigationBarTitle({ title: q.title })
    this.setData({
      loading: false,
      title: q.title,
      status: q.status,
      items: q.items.map((i) => this.decorateItem(Object.assign({ key: key() }, i))),
      fees: q.fees.map((f) => ({ key: key(), name: f.name, amount: f.amount, amountText: String(f.amount) })),
      discountText: String(q.discount || 0),
      notes: q.notes || '',
      project: d.project,
      contract: d.contract,
      readOnly: d.readOnly,
      lockReason: d.lockReason || '',
      printPath: d.printPath,
    })
    this.markDirty(false)
  },

  decorateItem(i) {
    return Object.assign(i, {
      imageUrl: absUrl(i.image),
      priceText: i.priceText !== undefined ? i.priceText : String(i.price),
      qtyText: i.qtyText !== undefined ? i.qtyText : String(i.quantity),
      subtotalText: yuan(i.price * i.quantity),
    })
  },

  recompute() {
    const product = this.data.items.reduce((s, i) => s + i.price * i.quantity, 0)
    const fee = this.data.fees.reduce((s, f) => s + (Number(f.amount) || 0), 0)
    const discount = num(this.data.discountText)
    this.setData({
      totals: { product: yuan(product), fee: yuan(fee), discount: yuan(discount), total: yuan(Math.max(0, product + fee - discount)) },
      canContract: !this.data.readOnly && this.data.status === 'accepted' && !this.data.contract,
    })
  },
  markDirty(dirty) {
    this.setData({ dirty })
    this.recompute()
    if (dirty && wx.enableAlertBeforeUnload) wx.enableAlertBeforeUnload({ message: '报价有未保存的修改，确定离开吗？' })
    if (!dirty && wx.disableAlertBeforeUnload) wx.disableAlertBeforeUnload()
  },

  /* ---------- 编辑 ---------- */

  onTitle(e) {
    this.setData({ title: e.detail.value })
    this.markDirty(true)
  },
  onStatus(e) {
    if (this.data.readOnly) return
    this.setData({ status: e.currentTarget.dataset.value })
    this.markDirty(true)
  },
  onPrice(e) {
    const i = Number(e.currentTarget.dataset.index)
    const item = Object.assign({}, this.data.items[i], { priceText: e.detail.value, price: num(e.detail.value) })
    this.setData({ ['items[' + i + ']']: this.decorateItem(item) })
    this.markDirty(true)
  },
  onQty(e) {
    const i = Number(e.currentTarget.dataset.index)
    const item = Object.assign({}, this.data.items[i], { qtyText: e.detail.value, quantity: Math.round(num(e.detail.value)) })
    this.setData({ ['items[' + i + ']']: this.decorateItem(item) })
    this.markDirty(true)
  },
  onStep(e) {
    if (this.data.readOnly) return
    const i = Number(e.currentTarget.dataset.index)
    const q = Math.max(0, this.data.items[i].quantity + Number(e.currentTarget.dataset.delta))
    const item = Object.assign({}, this.data.items[i], { quantity: q, qtyText: String(q) })
    this.setData({ ['items[' + i + ']']: this.decorateItem(item) })
    this.markDirty(true)
  },
  removeItem(e) {
    const i = Number(e.currentTarget.dataset.index)
    wx.showModal({
      title: '删除这一行',
      content: this.data.items[i].name,
      confirmColor: '#a51d24',
      success: (r) => {
        if (!r.confirm) return
        this.setData({ items: this.data.items.filter((_, k) => k !== i) })
        this.markDirty(true)
      },
    })
  },
  /** 换型号：只能换成同一设备类型的在售产品，数量不变，单价改为新产品售价 */
  swapProduct(e) {
    const i = Number(e.currentTarget.dataset.index)
    const line = this.data.items[i]
    wx.navigateTo({
      url: '/pages/picker/index?deviceType=' + line.type.value + '&title=' + encodeURIComponent('更换型号'),
      events: {
        picked: (p) => {
          const item = Object.assign({}, line, { product: p.id, name: p.name, shortName: p.shortName || '', sku: p.sku, unit: p.unit, price: p.price, priceText: String(p.price), image: p.image, type: p.type })
          this.setData({ ['items[' + i + ']']: this.decorateItem(item) })
          this.markDirty(true)
          toast('已更换，记得保存')
        },
      },
    })
  },
  addProduct() {
    wx.navigateTo({
      url: '/pages/picker/index?title=' + encodeURIComponent('添加产品'),
      events: {
        picked: (p) => {
          const idx = this.data.items.findIndex((x) => x.product === p.id)
          if (idx >= 0) {
            const q = this.data.items[idx].quantity + 1
            this.setData({ ['items[' + idx + ']']: this.decorateItem(Object.assign({}, this.data.items[idx], { quantity: q, qtyText: String(q) })) })
          } else {
            const item = { key: key(), id: null, product: p.id, type: p.type, image: p.image, name: p.name, shortName: p.shortName || '', sku: p.sku, unit: p.unit, price: p.price, quantity: 1 }
            this.setData({ items: this.data.items.concat(this.decorateItem(item)) })
          }
          this.markDirty(true)
        },
      },
    })
  },
  addFee() {
    this.setData({ fees: this.data.fees.concat({ key: key(), name: '安装调试费', amount: 0, amountText: '' }) })
    this.markDirty(true)
  },
  onFee(e) {
    const i = Number(e.currentTarget.dataset.index)
    const k = e.currentTarget.dataset.key
    const fee = Object.assign({}, this.data.fees[i])
    if (k === 'name') fee.name = e.detail.value
    else {
      fee.amountText = e.detail.value
      fee.amount = parseFloat(e.detail.value) || 0
    }
    this.setData({ ['fees[' + i + ']']: fee })
    this.markDirty(true)
  },
  removeFee(e) {
    const i = Number(e.currentTarget.dataset.index)
    this.setData({ fees: this.data.fees.filter((_, k) => k !== i) })
    this.markDirty(true)
  },
  onDiscount(e) {
    this.setData({ discountText: e.detail.value })
    this.markDirty(true)
  },
  onNotes(e) {
    this.setData({ notes: e.detail.value })
    this.markDirty(true)
  },

  /* ---------- 保存与操作 ---------- */

  async persist() {
    const body = {
      title: this.data.title,
      status: this.data.status,
      discount: num(this.data.discountText),
      notes: this.data.notes,
      items: this.data.items.map((i) => ({ id: i.id, product: i.product, name: i.name, shortName: i.shortName || null, sku: i.sku, unit: i.unit, price: i.price, quantity: i.quantity })),
      fees: this.data.fees.map((f) => ({ name: f.name, amount: Number(f.amount) || 0 })),
    }
    this.setData({ saving: true })
    try {
      await api.put('/quotes/' + this.data.id, body)
      getApp().touchData()
      return true
    } catch (e) {
      return false
    } finally {
      this.setData({ saving: false })
    }
  },
  async save() {
    if (await this.persist()) {
      wx.showToast({ title: '已保存', icon: 'success' })
      this.load()
    }
  },
  async ensureSaved() {
    return !this.data.dirty || this.data.readOnly || (await this.persist())
  },
  async print() {
    if (await this.ensureSaved()) openDocument(this.data.printPath, '报价单')
  },
  openProject() {
    if (this.data.project) wx.navigateTo({ url: '/pages/project/index?id=' + this.data.project.id })
  },
  more() {
    const actions = []
    if (this.data.printPath) actions.push({ label: '预览 / 导出报价单 PDF', run: () => this.print() })
    if (this.data.project) actions.push({ label: '查看点位图', run: () => wx.navigateTo({ url: '/pages/pointmap/index?id=' + this.data.project.id }) })
    if (!this.data.readOnly && this.data.project) actions.push({ label: '从点位图同步数量', run: () => this.sync() })
    if (!this.data.readOnly && !(this.data.contract && this.data.contract.usesThisQuote)) actions.push({ label: '删除这份报价', run: () => this.remove() })
    if (!actions.length) return
    wx.showActionSheet({ itemList: actions.map((a) => a.label), success: (r) => actions[r.tapIndex].run() })
  },
  async sync() {
    if (!(await this.ensureSaved())) return
    wx.showLoading({ title: '正在同步', mask: true })
    try {
      const d = await api.post('/quotes/' + this.data.id + '/sync', {})
      wx.hideLoading()
      toast('已同步' + (d.pending ? '，' + d.pending + ' 个点位待选型' : ''))
      getApp().touchData()
      this.load()
    } catch (e) {
      wx.hideLoading()
    }
  },
  remove() {
    wx.showModal({
      title: '删除报价',
      content: '删除「' + this.data.title + '」？删除后无法恢复。',
      confirmColor: '#a51d24',
      success: async (r) => {
        if (!r.confirm) return
        await api.del('/quotes/' + this.data.id)
        getApp().touchData()
        if (wx.disableAlertBeforeUnload) wx.disableAlertBeforeUnload()
        wx.navigateBack()
      },
    })
  },
  async createContract() {
    if (!(await this.ensureSaved())) return
    wx.showLoading({ title: '正在生成', mask: true })
    try {
      await api.post('/projects/' + this.data.project.id + '/contract', { quoteId: this.data.id })
      wx.hideLoading()
      getApp().touchData()
      wx.redirectTo({ url: '/pages/contract/index?projectId=' + this.data.project.id })
    } catch (e) {
      wx.hideLoading()
    }
  },
})
