/** 打开网页打印页（报价单、合同、点位图、方案）。地址带 2 分钟有效的一次性票据，需在小程序后台配置业务域名。 */
const WEBVIEW_TIMEOUT = 20000

Page({
  data: { src: '', failed: false },

  onLoad(query) {
    if (query.title) wx.setNavigationBarTitle({ title: decodeURIComponent(query.title) })
    const src = decodeURIComponent(query.src || '')
    this.setData({ src, failed: false })
    if (!src) {
      this.setData({ failed: true })
      return
    }
    wx.showLoading({ title: '加载中', mask: true })
    this.timer = setTimeout(() => {
      this.timer = null
      if (this.data.failed) return
      wx.hideLoading()
      this.setData({ failed: true })
      wx.showModal({
        title: '页面加载超时',
        content: '请检查网络，或确认已在微信公众平台配置业务域名后重试。',
        showCancel: false,
        confirmText: '知道了',
      })
    }, WEBVIEW_TIMEOUT)
  },

  onUnload() {
    this.clearTimer()
  },

  onWebLoad() {
    this.clearTimer()
    wx.hideLoading()
  },

  onWebError(e) {
    this.clearTimer()
    wx.hideLoading()
    console.error('[webview] load error', e && e.detail)
    this.setData({ failed: true })
    wx.showModal({
      title: '页面打不开',
      content: '请检查网络，或确认已在微信公众平台配置业务域名「https://fmkj.top」。',
      showCancel: false,
      confirmText: '知道了',
    })
  },

  clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  },

  retry() {
    if (!this.data.src) return
    this.setData({ failed: false })
    wx.showLoading({ title: '加载中', mask: true })
    this.timer = setTimeout(() => {
      this.timer = null
      wx.hideLoading()
      this.setData({ failed: true })
    }, WEBVIEW_TIMEOUT)
  },

  copyLink() {
    if (!this.data.src) return
    wx.setClipboardData({
      data: this.data.src,
      success: () => wx.showToast({ title: '链接已复制', icon: 'none' }),
    })
  },
})
