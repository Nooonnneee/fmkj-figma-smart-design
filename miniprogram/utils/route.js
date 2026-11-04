const { api } = require('./request')
const config = require('../config')

/** 把网页地址（AI 工具结果里的链接、文档链接）映射成小程序页面。 */
function mapHref(href) {
  if (!href) return null
  let m
  if ((m = href.match(/^\/projects\/([^/?#]+)\/point-map/))) return '/pages/pointmap/index?id=' + m[1]
  if ((m = href.match(/^\/projects\/([^/?#]+)\/quotes\/([^/?#]+)/))) return '/pages/quote/index?id=' + m[2]
  if ((m = href.match(/^\/projects\/([^/?#]+)\/contract/))) return '/pages/contract/index?projectId=' + m[1]
  if ((m = href.match(/^\/projects\/([^/?#]+)\/(quotes|archive)/))) return '/pages/project/index?id=' + m[1]
  if ((m = href.match(/^\/projects\/([^/?#]+)$/)) && m[1] !== 'new') return '/pages/project/index?id=' + m[1]
  if (href.indexOf('/products') === 0) return 'tab:/pages/products/index'
  if (href.indexOf('/projects') === 0) return 'tab:/pages/projects/index'
  if (href.indexOf('/print/') === 0) return 'web:' + href
  return null
}

/**
 * 打开打印页：先换一次性票据，在 web-view 里打开（需要在小程序后台配置业务域名）。
 * 票据 2 分钟内可重入，失败时给出明确提示，避免 loading 结束后无反馈。
 */
async function openDocument(path, title) {
  wx.showLoading({ title: '正在打开', mask: true })
  try {
    const data = await api.post('/web-ticket', { path })
    const ticketUrl = data && data.url ? String(data.url) : ''
    if (!ticketUrl) throw new Error('未获取到文档地址')
    const url = '/pages/webview/index?title=' + encodeURIComponent(title || '文档') + '&src=' + encodeURIComponent(config.BASE_URL + ticketUrl)
    await new Promise((resolve, reject) => {
      wx.navigateTo({ url, success: resolve, fail: reject })
    })
  } catch (err) {
    console.error('[openDocument]', path, err)
    wx.showModal({
      title: '打开失败',
      content: '文档暂时打不开，请检查网络后重试。',
      showCancel: false,
      confirmText: '知道了',
    })
  } finally {
    wx.hideLoading()
  }
}

function openHref(href, title) {
  const target = mapHref(href)
  if (!target) return false
  if (target.indexOf('tab:') === 0) wx.switchTab({ url: target.slice(4) })
  else if (target.indexOf('web:') === 0) openDocument(target.slice(4), title)
  else wx.navigateTo({ url: target })
  return true
}

module.exports = { mapHref, openHref, openDocument }
