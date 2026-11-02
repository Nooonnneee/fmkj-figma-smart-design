const { toast } = require('../../utils/request')

/**
 * 隐私授权弹窗。
 * 微信在调用 wx.chooseMedia / wx.chooseMessageFile 等隐私接口前会触发
 * wx.onNeedPrivacyAuthorization，由 app.js 找到当前页面的本组件并 request(resolve)。
 * 用户点击带 open-type="agreePrivacyAuthorization" 的按钮后，
 * 用 resolve({ event: 'agree', buttonId: 'agree-btn' }) 放行；拒绝则返回 disagree。
 */
Component({
  data: {
    show: false,
  },

  methods: {
    request(resolve) {
      this._resolve = resolve
      this.setData({ show: true })
    },

    openContract() {
      if (wx.openPrivacyContract) {
        wx.openPrivacyContract({ fail: () => toast('当前微信版本暂不支持打开隐私协议') })
        return
      }
      toast('请在微信公众平台查看《用户隐私保护指引》')
    },

    handleAgree() {
      const resolve = this._resolve
      this._resolve = null
      this.setData({ show: false })
      if (resolve) resolve({ event: 'agree', buttonId: 'agree-btn' })
    },

    handleDisagree() {
      const resolve = this._resolve
      this._resolve = null
      this.setData({ show: false })
      if (resolve) resolve({ event: 'disagree' })
      toast('未同意隐私协议，上传与选择图片功能暂不可用')
    },
  },
})
