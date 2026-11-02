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
    this.setupPrivacyAuthorization()
    if (!getToken()) wx.reLaunch({ url: '/pages/login/index' })
    const update = wx.getUpdateManager && wx.getUpdateManager()
    if (update) {
      update.onUpdateReady(() => {
        wx.showModal({ title: '发现新版本', content: '新版本已准备好，是否重启使用？', success: (r) => r.confirm && update.applyUpdate() })
      })
    }
  },
  /**
   * 微信隐私授权：当 wx.chooseMedia / wx.chooseMessageFile 等隐私接口触发时，
   * 找到当前页面的 <privacy-popup /> 组件展示协议；用户同意后放行。
   */
  setupPrivacyAuthorization() {
    if (!wx.onNeedPrivacyAuthorization) return
    wx.onNeedPrivacyAuthorization((resolve) => {
      const pages = getCurrentPages()
      const page = pages[pages.length - 1]
      const popup = page && page.selectComponent && page.selectComponent('#privacy-popup')
      if (popup && popup.request) {
        popup.request(resolve)
        return
      }
      // 兜底：页面没有挂载组件时走微信原生隐私授权，避免接口被直接拒绝。
      if (wx.requirePrivacyAuthorize) {
        wx.requirePrivacyAuthorize({
          success: () => resolve({ event: 'agree' }),
          fail: () => resolve({ event: 'disagree' }),
        })
        return
      }
      resolve({ event: 'disagree' })
    })
  },
  touchData() {
    this.globalData.dataVersion += 1
  },
})
