const { api, toast } = require('../../utils/request')
const { requireLogin, logout } = require('../../utils/auth')
const { getMeta } = require('../../utils/meta')
const config = require('../../config')

Page({
  data: { me: {}, initial: '', companyName: '', pluginCount: 0, host: '', version: config.VERSION, editing: false, form: { name: '', phone: '' }, saving: false },

  onLoad(options) {
    if (options && options.scene) {
      this.pendingScene = decodeURIComponent(options.scene)
    }
  },

  onShow() {
    if (!requireLogin()) return
    this.setData({ host: config.BASE_URL.replace(/^https?:\/\//, '') })
    this.load()
    if (this.pendingScene) {
      const ticket = this.pendingScene
      this.pendingScene = ''
      this.confirmWebLogin(ticket)
    }
  },

  async load() {
    const me = await api.get('/me')
    getApp().globalData.me = me
    this.setData({ me, initial: (me.name || '?').slice(0, 1) })
    getMeta()
      .then((m) => {
        this.meta = m
        this.setData({ companyName: m.company.name, pluginCount: m.plugins.length })
      })
      .catch(() => null)
  },

  openEdit() {
    this.setData({ editing: true, form: { name: this.data.me.name || '', phone: this.data.me.phone || '' } })
  },
  closeEdit() {
    this.setData({ editing: false })
  },
  onInput(e) {
    this.setData({ ['form.' + e.currentTarget.dataset.key]: e.detail.value })
  },
  async saveProfile() {
    this.setData({ saving: true })
    try {
      const me = await api.put('/me', this.data.form)
      this.setData({ me, initial: me.name.slice(0, 1), editing: false })
      toast('已保存')
    } finally {
      this.setData({ saving: false })
    }
  },

  wechat() {
    if (!this.data.me.wechatBound) return toast('退出后用「微信一键登录」即可绑定')
    wx.showModal({
      title: '解除微信绑定',
      content: '解除后需要重新用账号密码绑定，其他用微信登录的设备会退出登录。',
      confirmColor: '#a51d24',
      success: async (r) => {
        if (!r.confirm) return
        await api.del('/me/wechat')
        toast('已解除绑定')
        this.load()
      },
    })
  },
  scanWebLogin() {
    wx.scanCode({
      onlyFromCamera: false,
      success: (r) => {
        const raw = (r && (r.result || r.path)) || ''
        if (!raw) return toast('未识别到二维码内容')
        this.confirmWebLogin(raw)
      },
    })
  },
  confirmWebLogin(ticket) {
    wx.showModal({
      title: '登录电脑端工作台',
      content: '确认在电脑网页端登录当前账号？',
      confirmText: '确认登录',
      success: async (r) => {
        if (!r.confirm) return
        await api.post('/auth/qr-confirm', { ticket })
        toast('电脑端已登录')
      },
    })
  },
  company() {
    const c = this.meta && this.meta.company
    if (!c) return
    wx.showModal({
      title: c.name,
      content: [c.slogan, c.phone && '电话：' + c.phone, c.email && '邮箱：' + c.email, c.address && '地址：' + c.address].filter(Boolean).join('\n') || '在网页版「设置」里填写公司抬头和联系方式',
      showCancel: false,
    })
  },
  plugins() {
    const list = (this.meta && this.meta.plugins) || []
    wx.showModal({ title: '已启用插件', content: list.map((p) => p.name).join('\n') || '没有启用的插件', showCancel: false })
  },
  logout() {
    wx.showModal({ title: '退出登录', content: '确定退出当前账号？', success: (r) => r.confirm && logout() })
  },
})
