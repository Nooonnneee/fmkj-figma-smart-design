const { api, absUrl, upload, toast } = require('../../utils/request')
const { yuan } = require('../../utils/format')
const { getMeta, typeGroups } = require('../../utils/meta')
const { pickImage } = require('../../utils/pick')

/**
 * 点位图：查看图纸和点位、缩放；放置 / 移动 / 换类型 / 删除点位；指定型号、默认型号、智能选型；上传户型图。
 * 图纸是 3:2 标准图纸，点位坐标是相对图纸的 0–1 比例，和网页版共用同一份数据。
 */
const ZOOMS = [1, 1.5, 2, 3]

Page({
  data: {
    id: '',
    loading: true,
    readOnly: false,
    smartSelect: false,
    sheets: [],
    sheetIndex: 0,
    sheetUrl: '',
    areasOnSheet: [],
    pointsOnSheet: [],
    legend: [],
    rooms: [],
    summary: null,
    totalText: '',
    quoteTitle: '',
    scope: 'all',
    scopes: [],
    scopeIndex: 0,
    zoomIndex: 0,
    sheetW: 300,
    sheetH: 200,
    viewH: 200,
    markerSize: 24,
    showLabels: true,
    tab: 'legend',
    mode: 'view',
    placeType: null,
    selectedId: '',
    typeSheet: false,
    typeSheetFor: 'place',
    groups: [],
  },
  map: null,

  onLoad(query) {
    const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    this.baseW = win.windowWidth - Math.round((win.windowWidth / 750) * 56) - 2
    this.setData({ id: query.id, viewH: Math.round((this.baseW * 2) / 3) })
    this.applyZoom(0)
    getMeta()
      .then((m) =>
        this.setData({
          scopes: m.pointScopes,
          groups: typeGroups(m).map((g) => Object.assign({}, g, { types: g.types.map((t) => Object.assign({}, t, { icon: absUrl(t.marker) })) })),
        }),
      )
      .catch(() => null)
    this.load()
  },

  async load() {
    try {
      const d = await api.get('/projects/' + this.data.id + '/point-map', { scope: this.data.scope })
      this.map = d
      wx.setNavigationBarTitle({ title: d.project.name })
      this.setData({
        loading: false,
        readOnly: d.readOnly,
        smartSelect: d.smartSelect,
        sheets: d.sheets,
        legend: d.legend.map((l) => Object.assign({}, l, { icon: absUrl(l.marker), subtotalText: yuan(l.subtotal) })),
        rooms: d.rooms.map((r) => Object.assign({}, r, { subtotalText: yuan(r.subtotal), linesText: r.lines.map((l) => l.type.name + '×' + l.count).join('  ') })),
        summary: d.summary,
        totalText: yuan(d.summary.total),
        quoteTitle: d.quote ? d.quote.title : '',
      })
      this.showSheet(Math.min(this.data.sheetIndex, Math.max(0, d.sheets.length - 1)))
    } catch (e) {
      this.setData({ loading: false })
    }
  },

  showSheet(i) {
    const s = this.map && this.map.sheets[i]
    if (!s) {
      this.setData({ sheetIndex: 0, sheetUrl: '', areasOnSheet: [], pointsOnSheet: [] })
      return
    }
    this.setData({
      sheetIndex: i,
      sheetUrl: absUrl(s.url),
      areasOnSheet: this.map.areas
        .filter((a) => a.sheetId === s.id)
        .map((a) => ({ id: a.id, name: a.name, left: a.x0 * 100, top: a.y0 * 100, width: (a.x1 - a.x0) * 100, height: (a.y1 - a.y0) * 100 })),
      pointsOnSheet: this.map.points
        .filter((p) => p.sheetId === s.id && p.rx !== null && p.ry !== null)
        .map((p) => ({ id: p.id, left: p.rx * 100, top: p.ry * 100, color: p.type.color, name: p.type.name, icon: absUrl(p.type.marker) })),
    })
  },

  applyZoom(i) {
    const z = ZOOMS[i]
    const w = Math.round(this.baseW * z)
    this.setData({ zoomIndex: i, sheetW: w, sheetH: Math.round((w * 2) / 3), markerSize: Math.round(16 + 6 * z) })
  },
  zoomIn() {
    this.applyZoom(Math.min(ZOOMS.length - 1, this.data.zoomIndex + 1))
  },
  zoomOut() {
    this.applyZoom(Math.max(0, this.data.zoomIndex - 1))
  },
  zoomFit() {
    this.applyZoom(0)
  },
  toggleLabels() {
    this.setData({ showLabels: !this.data.showLabels })
  },
  onSheetTab(e) {
    this.showSheet(Number(e.currentTarget.dataset.index))
  },
  onScope(e) {
    const i = Number(e.detail.value)
    this.setData({ scopeIndex: i, scope: this.data.scopes[i].value })
    this.load()
  },
  onTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab })
  },

  /* ---------- 放置 / 移动 ---------- */

  openTypeSheet() {
    if (!this.data.sheets.length) return toast('请先上传户型图')
    this.setData({ typeSheet: true, typeSheetFor: 'place' })
  },
  closeTypeSheet() {
    this.setData({ typeSheet: false })
  },
  onPickType(e) {
    const t = e.currentTarget.dataset.type
    if (this.data.typeSheetFor === 'place') this.setData({ typeSheet: false, mode: 'place', placeType: t, selectedId: '' })
    else this.changeType(t)
  },
  exitMode() {
    this.setData({ mode: 'view', placeType: null, selectedId: '' })
  },

  onCanvasTap(e) {
    if (this.data.mode === 'view') {
      if (this.data.selectedId) this.setData({ selectedId: '' })
      return
    }
    const t = (e.changedTouches && e.changedTouches[0]) || {}
    const x = t.clientX !== undefined ? t.clientX : e.detail.x
    const y = t.clientY !== undefined ? t.clientY : e.detail.y
    wx.createSelectorQuery()
      .in(this)
      .select('#sheet')
      .boundingClientRect((rect) => {
        if (!rect) return
        const rx = (x - rect.left) / rect.width
        const ry = (y - rect.top) / rect.height
        if (rx < 0 || rx > 1 || ry < 0 || ry > 1) return
        if (this.data.mode === 'place') this.placeAt(rx, ry)
        else this.moveTo(rx, ry)
      })
      .exec()
  },

  async placeAt(rx, ry) {
    const t = this.data.placeType
    const sheet = this.map.sheets[this.data.sheetIndex]
    const temp = { id: 'tmp-' + Date.now(), left: rx * 100, top: ry * 100, color: t.color, name: t.name, icon: t.icon || absUrl(t.marker), pending: true }
    this.setData({ pointsOnSheet: this.data.pointsOnSheet.concat(temp) })
    try {
      await api.post('/projects/' + this.data.id + '/points', { sheetId: sheet.id, rx, ry, deviceType: t.value })
      getApp().touchData()
      this.reloadSoon()
    } catch (e) {
      this.setData({ pointsOnSheet: this.data.pointsOnSheet.filter((p) => p.id !== temp.id) })
    }
  },
  async moveTo(rx, ry) {
    const id = this.data.selectedId
    this.setData({ mode: 'view', pointsOnSheet: this.data.pointsOnSheet.map((p) => (p.id === id ? Object.assign({}, p, { left: rx * 100, top: ry * 100 }) : p)) })
    await api.put('/projects/' + this.data.id + '/points/' + id, { rx, ry }).catch(() => null)
    getApp().touchData()
    this.load()
  },
  /** 连续放置时合并刷新 */
  reloadSoon() {
    clearTimeout(this.reloadTimer)
    this.reloadTimer = setTimeout(() => this.load(), 700)
  },

  /* ---------- 点位操作 ---------- */

  onMarkerTap(e) {
    const id = e.currentTarget.dataset.id
    if (id.indexOf('tmp-') === 0 || this.data.mode !== 'view') return
    const p = this.map.points.find((x) => x.id === id)
    if (!p) return
    this.setData({ selectedId: id })
    const title = (p.code ? p.code + ' ' : '') + p.type.name
    if (this.data.readOnly) {
      wx.showModal({ title, content: p.type.categoryName || p.type.name, showCancel: false })
      return
    }
    wx.showActionSheet({
      alertText: title,
      itemList: ['更换设备类型', '移动位置', '删除点位'],
      success: (r) => {
        if (r.tapIndex === 0) this.setData({ typeSheet: true, typeSheetFor: 'change' })
        else if (r.tapIndex === 1) {
          this.setData({ mode: 'move' })
          toast('点击图纸上的新位置')
        }
        else this.deletePoint(p)
      },
      fail: () => this.setData({ selectedId: '' }),
    })
  },
  async changeType(t) {
    this.setData({ typeSheet: false })
    await api.put('/projects/' + this.data.id + '/points/' + this.data.selectedId, { deviceType: t.value })
    toast('已更换为' + t.name)
    getApp().touchData()
    this.setData({ selectedId: '' })
    this.load()
  },
  pickProductForPoint(p) {
    wx.navigateTo({
      url: '/pages/picker/index?deviceType=' + p.type.value + '&title=' + encodeURIComponent('为 ' + (p.code || p.type.name) + ' 选择型号'),
      events: {
        picked: async (prod) => {
          await api.put('/projects/' + this.data.id + '/points/' + p.id, { productId: prod.id })
          toast('已指定型号')
          getApp().touchData()
          this.load()
        },
      },
    })
  },
  deletePoint(p) {
    wx.showModal({
      title: '删除点位',
      content: '删除「' + (p.code ? p.code + ' ' : '') + p.type.name + '」？',
      confirmColor: '#a51d24',
      success: async (r) => {
        if (!r.confirm) return this.setData({ selectedId: '' })
        await api.del('/projects/' + this.data.id + '/points/' + p.id)
        getApp().touchData()
        this.setData({ selectedId: '' })
        this.load()
      },
    })
  },

  /** 图例：点击直接开始在图纸上放置这类设备 */
  onLegendTap(e) {
    if (this.data.readOnly) return
    const item = this.data.legend[Number(e.currentTarget.dataset.index)]
    if (!item) return
    this.setData({ mode: 'place', placeType: item })
    toast('点击图纸放置' + item.name)
  },

  /* ---------- 图纸、选型、报价 ---------- */

  async onUpload() {
    const img = await pickImage()
    if (!img) return
    const name = await new Promise((resolve) =>
      wx.showModal({ title: '图纸名称', editable: true, placeholderText: '例如：一层开关布置图', success: (r) => resolve(r.confirm ? (r.content || '').trim() : null) }),
    )
    if (name === null) return
    const recognize = await new Promise((resolve) =>
      wx.showModal({
        title: '识别开关符号',
        content: '是否尝试识别图上的 CAD 开关符号并生成点位？识别不到时不会生成任何点位。',
        confirmText: '识别',
        cancelText: '不识别',
        success: (r) => resolve(Boolean(r.confirm)),
      }),
    )
    wx.showLoading({ title: '正在处理图纸', mask: true })
    try {
      const r = await upload('/projects/' + this.data.id + '/sheets' + (recognize ? '?recognize=1' : ''), img.path, { name })
      wx.hideLoading()
      toast('已添加「' + r.sheetName + '」' + (r.recognizedPoints ? '，识别 ' + r.recognizedPoints + ' 个点位' : ''))
      getApp().touchData()
      this.setData({ sheetIndex: 999 })
      this.load()
    } catch (e) {
      wx.hideLoading()
    }
  },

  async onSmartSelect() {
    const m = await getMeta()
    wx.showActionSheet({
      itemList: m.selectionTiers.map((t) => t.label + '档'),
      success: async (r) => {
        wx.showLoading({ title: '正在选型', mask: true })
        try {
          const d = await api.post('/projects/' + this.data.id + '/smart-select', { tier: m.selectionTiers[r.tapIndex].value })
          wx.hideLoading()
          wx.showModal({
            title: '智能选型完成',
            content: '已为 ' + d.applied + ' 类设备设置默认型号' + (d.noCandidate.length ? '；' + d.noCandidate.join('、') + ' 没有合适的产品' : ''),
            showCancel: false,
          })
          getApp().touchData()
          this.load()
        } catch (e) {
          wx.hideLoading()
        }
      },
    })
  },

  async generateQuote() {
    wx.showLoading({ title: '正在生成', mask: true })
    try {
      const d = await api.post('/projects/' + this.data.id + '/quotes', { scope: this.data.scope })
      wx.hideLoading()
      getApp().touchData()
      wx.navigateTo({ url: '/pages/quote/index?id=' + d.quoteId })
      if (d.pending) toast(d.pending + ' 个点位待选型，未计入报价')
    } catch (e) {
      wx.hideLoading()
    }
  },
})
