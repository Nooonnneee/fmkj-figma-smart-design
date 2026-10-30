/**
 * 选择产品：报价单换型号 / 添加产品、点位指定型号、设置默认型号。
 * 打开方通过 eventChannel 接收 picked 事件：wx.navigateTo({ url, events: { picked(product) {} } })
 */
Page({
  data: { deviceType: '' },
  onLoad(query) {
    this.setData({ deviceType: query.deviceType || '' })
    if (query.title) wx.setNavigationBarTitle({ title: decodeURIComponent(query.title) })
  },
  onReachBottom() {
    this.selectComponent('#list').loadMore()
  },
  pick(e) {
    const channel = this.getOpenerEventChannel()
    if (channel && channel.emit) channel.emit('picked', e.detail)
    wx.navigateBack()
  },
})
