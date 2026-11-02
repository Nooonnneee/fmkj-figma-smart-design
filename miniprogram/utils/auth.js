const { api, setToken, clearToken, getToken } = require('./request')

/**
 * 登录流程：
 * 1. 微信一键登录：wx.login → /auth/wechat。已绑定直接登录；未绑定返回 bindTicket。
 * 2. 绑定：bindTicket + 账号密码 → /auth/bind（账号由管理员在后台开通，不开放注册）。
 * 3. 账号密码登录：/auth/password（未配置微信登录或调试时使用）。
 */
function wxCode() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (r) => (r.code ? resolve(r.code) : reject(new Error('微信登录失败'))),
      fail: () => reject(new Error('微信登录失败')),
    })
  })
}

function saveSession(data) {
  setToken(data.token)
  getApp().globalData.me = data.user
  return data.user
}

async function loginWithWechat() {
  const code = await wxCode()
  const data = await api.post('/auth/wechat', { code }, { auth: false })
  if (data.token) return { user: saveSession(data) }
  return { needBind: true, ticket: data.bindTicket }
}

async function bindAccount(ticket, email, password) {
  return saveSession(await api.post('/auth/bind', { ticket, email, password }, { auth: false }))
}

async function loginWithPassword(email, password) {
  return saveSession(await api.post('/auth/password', { email, password }, { auth: false }))
}

async function logout() {
  try {
    await api.post('/auth/logout', {}, { silent: true })
  } catch (e) {
    // 令牌已失效也照常退出
  }
  clearToken()
  getApp().globalData.me = null
  wx.reLaunch({ url: '/pages/login/index' })
}

function requireLogin() {
  if (getToken()) return true
  wx.reLaunch({ url: '/pages/login/index' })
  return false
}

module.exports = { loginWithWechat, bindAccount, loginWithPassword, logout, requireLogin }
