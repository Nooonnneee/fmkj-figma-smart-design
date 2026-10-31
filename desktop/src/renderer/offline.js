'use strict'

;(() => {
  const params = new URLSearchParams(location.search)
  const code = params.get('code') || ''
  const host = params.get('host') || ''
  const retryIn = Math.max(5, Math.min(Number(params.get('retryIn')) || 15, 300))
  const desktop = window.fanmengDesktop
  const $ = (id) => document.getElementById(id)

  const num = Number(code)
  let title = '暂时无法连接到繁梦空间'
  let detail = '服务器暂时无法访问，请稍后重试。'
  let autoRetry = true
  if (code === 'crashed') {
    title = '页面意外退出'
    detail = '页面进程意外结束，重新连接即可继续使用。'
  } else if (num === -106) {
    title = '网络已断开'
    detail = '请检查网络连接，网络恢复后会自动重新连接。'
  } else if (num === -105 || num === -137) {
    detail = '无法解析服务器地址，请检查网络或「服务器设置」里的地址。'
  } else if (num <= -200 && num > -300) {
    title = '连接不安全'
    detail = '服务器证书无效或已过期。为保护你的数据，客户端已停止连接，请联系管理员处理。'
    autoRetry = false
  } else if (num === 502 || num === 503 || num === 504) {
    title = '服务器正在维护'
    detail = '服务器正在升级或暂时繁忙，请稍后再试。'
  }

  $('title').textContent = title
  $('detail').textContent = detail
  $('meta').textContent = [host && `服务器 ${host}`, code && `错误代码 ${code}`].filter(Boolean).join(' · ')
  document.title = `${title} · 繁梦空间`

  let retrying = false
  const retry = () => {
    if (retrying || !desktop) return
    retrying = true
    $('retry').disabled = true
    $('retry').textContent = '正在连接…'
    $('countdown').textContent = ''
    desktop.retry().catch(() => {
      retrying = false
      $('retry').disabled = false
      $('retry').textContent = '重新连接'
    })
  }

  $('retry').addEventListener('click', retry)
  $('settings').addEventListener('click', () => desktop && desktop.openSettings())
  window.addEventListener('online', retry)

  if (autoRetry) {
    let left = retryIn
    const tick = () => {
      if (retrying) return
      if (left <= 0) {
        retry()
        return
      }
      $('countdown').textContent = `${left} 秒后自动重试`
      left -= 1
      setTimeout(tick, 1000)
    }
    tick()
  }
})()
