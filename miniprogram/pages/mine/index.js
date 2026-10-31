const { api, toast } = require('../../utils/request')
const { requireLogin, logout } = require('../../utils/auth')
const { getMeta } = require('../../utils/meta')
const config = require('../../config')

Page({
  data: { me: {}, initial: '', companyName: '', pluginCount: 0, host: '', version: config.VERSION, editing: false, redeeming: false, redeemCode: '', form: { name: '', phone: '' }, saving: false },

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
  openRedeem() {
    this.setData({ redeeming: true, redeemCode: '' })
  },
  closeRedeem() {
    this.setData({ redeeming: false })
  },
  onRedeemInput(e) {
    this.setData({ redeemCode: (e.detail.value || '').toUpperCase() })
  },
  async submitRedeem() {
    const code = (this.data.redeemCode || '').trim()
    if (!code) return toast('请输入兑换码')
    this.setData({ saving: true })
    try {
      const res = await api.post('/me/redeem', { code })
      toast(res.message || '兑换成功')
      this.setData({ redeeming: false, redeemCode: '' })
      this.load()
    } finally {
      this.setData({ saving: false })
    }
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
      onlyFromCamera: true,
      success: (r) => {
        const raw = (r && (r.result || r.path)) || ''
        if (!raw) return toast('未识别到二维码内容')
        this.confirmWebLogin(raw)
      },
    })
  },
  async confirmWebLogin(ticket) {
    let timeHint = ''
    try {
      const info = await api.get('/auth/qr-confirm?ticket=' + encodeURIComponent(ticket))
      if (info && info.issuedAt) {
        const d = new Date(info.issuedAt)
        const hh = String(d.getHours()).padStart(2, '0')
        const mm = String(d.getMinutes()).padStart(2, '0')
        const ss = String(d.getSeconds()).padStart(2, '0')
        timeHint = `\n发起时间：${hh}:${mm}:${ss}`
      }
    } catch {
      return
    }
    wx.showModal({
      title: '登录电脑端工作台',
      content: '请确认是本人正在电脑浏览器前操作（切勿扫他人发来的二维码截图）。' + timeHint,
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
  privacy() {
    if (wx.openPrivacyContract) {
      wx.openPrivacyContract({ fail: () => toast('当前微信版本暂不支持打开隐私协议') })
      return
    }
    toast('请在微信公众平台查看《用户隐私保护指引》')
  },
  plugins() {
    const list = (this.meta && this.meta.plugins) || []
    wx.showModal({ title: '已启用插件', content: list.map((p) => p.name).join('\n') || '没有启用的插件', showCancel: false })
  },
  logout() {
    wx.showModal({ title: '退出登录', content: '确定退出当前账号？', success: (r) => r.confirm && logout() })
  },
})
