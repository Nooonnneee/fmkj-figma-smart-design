const { api, getToken, toast } = require('./request')

let confirmingTicket = ''

function cleanTicket(raw) {
  if (!raw || typeof raw !== 'string') return ''
  let s = raw.trim()
  try {
    s = decodeURIComponent(s).trim()
  } catch (e) {
    // ignore decode error
  }
  if (s.indexOf('fmkj-login:') === 0) return s.slice('fmkj-login:'.length).trim()
  const qIdx = s.indexOf('?')
  if (qIdx >= 0) {
    const qs = s.slice(qIdx + 1)
    const pairs = qs.split('&')
    for (let i = 0; i < pairs.length; i++) {
      const kv = pairs[i].split('=')
      const k = kv[0]
      const v = kv.slice(1).join('=')
      if ((k === 'scene' || k === 'ticket') && v) {
        try {
          return decodeURIComponent(v).trim()
        } catch (e) {
          return v.trim()
        }
      }
    }
  }
  return s
}

/** 从 App.onLaunch / App.onShow / Page.onLoad 的参数中提取电脑端扫码登录票据 */
function extractTicketFromOptions(options) {
  if (!options || typeof options !== 'object') return ''
  const q = options.query || options
  const raw = q.scene || q.ticket || q.q || options.scene || options.ticket || ''
  const ticket = cleanTicket(String(raw || ''))
  // 过滤无效短字符串（如普通数字场景值），正常登录票据为 24 位
  if (ticket.length >= 16 && ticket.length <= 80) return ticket
  return ''
}

/** 记录扫码进入小程序时携带的登录票据（冷启动、热启动、未登录先跳登录页均可保留） */
function captureLaunchTicket(options, appInstance) {
  const ticket = extractTicketFromOptions(options)
  if (!ticket) return ''
  const app = appInstance || (typeof getApp === 'function' ? getApp() : null)
  if (app && app.globalData) {
    app.globalData.pendingLoginTicket = ticket
  }
  try {
    wx.setStorageSync('fmkj_pending_web_ticket', ticket)
  } catch (e) {
    // ignore storage error
  }
  return ticket
}

/** 弹出电脑端登录确认框并完成授权 */
async function confirmWebLogin(rawTicket) {
  const ticket = cleanTicket(rawTicket)
  if (!ticket || ticket.length < 16) {
    toast('未识别到有效的电脑端登录二维码')
    return
  }
  if (confirmingTicket === ticket) return
  confirmingTicket = ticket

  try {
    let timeHint = ''
    try {
      const info = await api.get('/auth/qr-confirm?ticket=' + encodeURIComponent(ticket), null, { silent: true })
      if (info && info.issuedAt) {
        const d = new Date(info.issuedAt)
        const hh = String(d.getHours()).padStart(2, '0')
        const mm = String(d.getMinutes()).padStart(2, '0')
        const ss = String(d.getSeconds()).padStart(2, '0')
        timeHint = '\n发起时间：' + hh + ':' + mm + ':' + ss
      }
    } catch (err) {
      wx.showModal({
        title: '无法确认电脑端登录',
        content: (err && err.message) || '二维码已过期或小程序服务器地址与电脑端不一致，请在电脑上刷新二维码后重试。',
        showCancel: false,
      })
      return
    }

    await new Promise((resolve) => {
      wx.showModal({
        title: '登录电脑端工作台',
        content: '确认在电脑浏览器登录当前账号？\n请确认是本人正在电脑前操作（切勿扫他人发来的二维码截图）。' + timeHint,
        confirmText: '确认登录',
        cancelText: '取消',
        success: async (r) => {
          if (!r.confirm) {
            resolve()
            return
          }
          wx.showLoading({ title: '正在登录电脑端', mask: true })
          try {
            await api.post('/auth/qr-confirm', { ticket })
            wx.hideLoading()
            wx.showToast({ title: '电脑端已登录', icon: 'success', duration: 2000 })
          } catch (e) {
            wx.hideLoading()
          }
          resolve()
        },
        fail: () => resolve(),
      })
    })
  } finally {
    setTimeout(() => {
      if (confirmingTicket === ticket) confirmingTicket = ''
    }, 1500)
  }
}

/** 如果全局存有待确认的扫码票据且当前已登录，立即消费并弹出确认弹窗 */
function consumePendingWebLogin() {
  if (!getToken()) return false
  const app = typeof getApp === 'function' ? getApp() : null
  let ticket = (app && app.globalData && app.globalData.pendingLoginTicket) || ''
  if (!ticket) {
    try {
      ticket = wx.getStorageSync('fmkj_pending_web_ticket') || ''
    } catch (e) {
      ticket = ''
    }
  }
  if (!ticket) return false
  if (app && app.globalData) app.globalData.pendingLoginTicket = ''
  try {
    wx.removeStorageSync('fmkj_pending_web_ticket')
  } catch (e) {
    // ignore
  }
  confirmWebLogin(ticket)
  return true
}

/** 主动调起相机扫描电脑端二维码（支持小程序码与标准二维码） */
function scanAndConfirmWebLogin() {
  wx.scanCode({
    onlyFromCamera: false,
    success: (r) => {
      const raw = (r && (r.result || r.path)) || ''
      if (!raw) return toast('未识别到二维码内容')
      confirmWebLogin(raw)
    },
  })
}

module.exports = {
  cleanTicket,
  extractTicketFromOptions,
  captureLaunchTicket,
  confirmWebLogin,
  consumePendingWebLogin,
  scanAndConfirmWebLogin,
}
