const { loginWithWechat, bindAccount, loginWithPassword } = require('../../utils/auth')
const { api, getToken, toast } = require('../../utils/request')
const config = require('../../config')

Page({
  data: { mode: 'wechat', wechatReady: true, busy: false, email: '', password: '', ticket: '', serverError: false, host: '', version: config.VERSION },

  onLoad() {
    this.setData({ host: config.BASE_URL.replace(/^https?:\/\//, '') })
    if (getToken()) {
      wx.switchTab({ url: '/pages/home/index' })
      return
    }
    api
      .get('', null, { auth: false, silent: true })
      .then((d) => {
        if (!d.wechatLogin) this.setData({ wechatReady: false, mode: 'password' })
      })
      .catch(() => this.setData({ serverError: true }))
  },

  onEmail(e) {
    this.setData({ email: e.detail.value })
  },
  onPassword(e) {
    this.setData({ password: e.detail.value })
  },
  toPassword() {
    this.setData({ mode: 'password' })
  },
  toWechat() {
    this.setData({ mode: 'wechat', ticket: '' })
  },

  async onWechat() {
    this.setData({ busy: true })
    try {
      const r = await loginWithWechat()
      if (r.needBind) {
        this.setData({ mode: 'bind', ticket: r.ticket })
        toast('请绑定一次成员账号')
      } else this.done()
    } catch (e) {
      if (!e.status) toast(e.message)
    } finally {
      this.setData({ busy: false })
    }
  },

  async onSubmit() {
    const email = this.data.email.trim()
    const password = this.data.password
    if (!email || !password) return toast('请输入邮箱和密码')
    this.setData({ busy: true })
    try {
      if (this.data.mode === 'bind') await bindAccount(this.data.ticket, email, password)
      else await loginWithPassword(email, password)
      this.done()
    } catch (e) {
      if (e.code === 'BIND_EXPIRED') this.setData({ mode: 'wechat', ticket: '' })
    } finally {
      this.setData({ busy: false })
    }
  },

  done() {
    wx.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => wx.switchTab({ url: '/pages/home/index' }), 500)
  },
})
