'use strict'

;(async () => {
  const desktop = window.fanmengDesktop
  const $ = (id) => document.getElementById(id)
  const form = $('form')
  const input = $('server')
  const status = $('status')
  const buttons = [$('reset'), $('test'), $('save')]
  let overridden = false

  const setStatus = (text, tone = '') => {
    status.textContent = text
    status.dataset.tone = tone
  }
  const setBusy = (busy) => {
    for (const button of buttons) button.disabled = busy || overridden
    input.disabled = busy || overridden
  }

  if (!desktop || !desktop.settings) {
    setStatus('当前环境无法修改设置', 'error')
    overridden = true
    setBusy(true)
    return
  }

  const info = await desktop.settings.get()
  overridden = info.overridden
  input.value = info.serverUrl
  $('version').textContent = `Eevee 桌面客户端 v${info.version} · 默认服务器 ${new URL(info.defaultServerUrl).host}`
  setBusy(false)
  if (overridden) setStatus('当前服务器由启动参数指定，这里的设置暂不生效。', 'warn')
  else {
    input.focus()
    input.select()
  }

  const finish = (message) => {
    setStatus(message, 'ok')
    setTimeout(() => desktop.settings.close(), 600)
  }

  $('test').addEventListener('click', async () => {
    setBusy(true)
    setStatus('正在连接…')
    try {
      const result = await desktop.settings.test(input.value)
      setStatus(result.message, result.ok ? 'ok' : 'error')
      if (result.ok && result.origin) input.value = result.origin
    } catch {
      setStatus('测试失败，请重试', 'error')
    } finally {
      setBusy(false)
    }
  })

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    setBusy(true)
    setStatus('正在保存…')
    try {
      const result = await desktop.settings.save(input.value)
      if (result.ok) {
        input.value = result.serverUrl
        finish('已保存，正在连接新服务器…')
        return
      }
      setStatus(result.message, 'error')
    } catch {
      setStatus('保存失败，请重试', 'error')
    }
    setBusy(false)
  })

  $('reset').addEventListener('click', async () => {
    setBusy(true)
    try {
      const result = await desktop.settings.reset()
      if (result.ok) {
        input.value = result.serverUrl
        finish('已恢复默认服务器')
        return
      }
      setStatus(result.message, 'error')
    } catch {
      setStatus('操作失败，请重试', 'error')
    }
    setBusy(false)
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') desktop.settings.close()
  })
})()
