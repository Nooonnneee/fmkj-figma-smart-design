const { getToken } = require('./utils/request')

App({
  globalData: {
    me: null,
    /** AI 或其他页面修改了数据后加一，列表页 onShow 时据此刷新 */
    dataVersion: 0,
    /** 跨页面传递的一次性参数（例如工作台点「上传户型图」后跳到项目页） */
    pending: null,
  },
  onLaunch() {
    if (!getToken()) wx.reLaunch({ url: '/pages/login/index' })
    const update = wx.getUpdateManager && wx.getUpdateManager()
    if (update) {
      update.onUpdateReady(() => {
        wx.showModal({ title: '发现新版本', content: '新版本已准备好，是否重启使用？', success: (r) => r.confirm && update.applyUpdate() })
      })
    }
  },
  touchData() {
    this.globalData.dataVersion += 1
  },
})
