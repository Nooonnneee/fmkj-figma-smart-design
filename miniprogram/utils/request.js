const config = require('../config')

/**
 * 接口请求：自动带登录令牌；401 回到登录页；失败时默认弹出服务端返回的中文提示。
 * 服务端统一返回 { ok, data } / { ok: false, error }。注意 wx.request 不支持 PATCH，修改用 PUT。
 */
const TOKEN_KEY = 'fmkj_mp_token'

class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.status = status
    this.code = code
  }
}

const getToken = () => wx.getStorageSync(TOKEN_KEY) || ''
const setToken = (t) => wx.setStorageSync(TOKEN_KEY, t)
const clearToken = () => wx.removeStorageSync(TOKEN_KEY)
const apiUrl = (path) => config.BASE_URL + config.API_PREFIX + path
/** 服务端返回的图片、图标多为站内相对地址，这里拼上域名 */
const absUrl = (u) => (!u ? '' : /^https?:\/\//.test(u) ? u : config.BASE_URL + (u.charAt(0) === '/' ? u : '/' + u))
const authHeader = () => {
  const t = getToken()
  return t ? { Authorization: 'Bearer ' + t } : {}
}

function toast(title) {
  wx.showToast({ title: String(title || '操作失败').slice(0, 40), icon: 'none', duration: 2500 })
}

let redirecting = false
function toLogin() {
  if (redirecting) return
  redirecting = true
  clearToken()
  wx.reLaunch({ url: '/pages/login/index', complete: () => setTimeout(() => (redirecting = false), 1000) })
}

function request(path, opts) {
  const { method = 'GET', data, auth = true, silent = false } = opts || {}
  return new Promise((resolve, reject) => {
    wx.request({
      url: apiUrl(path),
      method,
      data,
      timeout: 30000,
      header: Object.assign({ 'Content-Type': 'application/json' }, auth ? authHeader() : {}),
      success(res) {
        const body = res.data && typeof res.data === 'object' ? res.data : {}
        if (res.statusCode === 401 && auth) {
          toLogin()
          reject(new ApiError(body.error || '登录已过期', 401, 'UNAUTHORIZED'))
          return
        }
        if (res.statusCode >= 200 && res.statusCode < 300 && body.ok !== false) {
          resolve(body.data !== undefined ? body.data : body)
          return
        }
        const err = new ApiError(body.error || '请求失败（' + res.statusCode + '）', res.statusCode, body.code)
        err.fieldErrors = body.fieldErrors || null
        if (!silent) toast(err.message)
        reject(err)
      },
      fail() {
        const err = new ApiError('网络连接失败，请检查网络或服务器地址', 0, 'NETWORK')
        if (!silent) toast(err.message)
        reject(err)
      },
    })
  })
}

const api = {
  get: (p, data, o) => request(p, Object.assign({}, o, { method: 'GET', data })),
  post: (p, data, o) => request(p, Object.assign({}, o, { method: 'POST', data: data || {} })),
  put: (p, data, o) => request(p, Object.assign({}, o, { method: 'PUT', data: data || {} })),
  del: (p, data, o) => request(p, Object.assign({}, o, { method: 'DELETE', data })),
}

/** 上传文件（wx.uploadFile，字段名 file） */
function upload(path, filePath, formData) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: apiUrl(path),
      filePath,
      name: 'file',
      formData: formData || {},
      header: authHeader(),
      timeout: 120000,
      success(res) {
        let body = {}
        try {
          body = JSON.parse(res.data)
        } catch (e) {
          body = {}
        }
        if (res.statusCode === 401) {
          toLogin()
          reject(new ApiError('登录已过期', 401))
          return
        }
        if (res.statusCode >= 200 && res.statusCode < 300 && body.ok !== false) {
          resolve(body.data !== undefined ? body.data : body)
          return
        }
        const err = new ApiError(body.error || '上传失败（' + res.statusCode + '）', res.statusCode)
        toast(err.message)
        reject(err)
      },
      fail() {
        const err = new ApiError('上传失败，请检查网络', 0)
        toast(err.message)
        reject(err)
      },
    })
  })
}

module.exports = { api, upload, request, ApiError, getToken, setToken, clearToken, absUrl, apiUrl, authHeader, toast, toLogin }
