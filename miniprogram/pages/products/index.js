const { requireLogin } = require('../../utils/auth')

Page({
  onShow() {
    requireLogin()
  },
  onReachBottom() {
    this.selectComponent('#list').loadMore()
  },
  onPullDownRefresh() {
    this.selectComponent('#list')
      .reload()
      .finally(() => wx.stopPullDownRefresh())
  },
  open(e) {
    wx.navigateTo({ url: '/pages/product/index?id=' + e.detail.id })
  },
})
