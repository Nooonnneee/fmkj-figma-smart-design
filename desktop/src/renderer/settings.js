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

  // -------------------------------------------------------------------------
  // 智能家居（Home Assistant 直连）
  // -------------------------------------------------------------------------

  const ha = desktop.ha
  if (ha) {
    const haUrl = $('ha-url')
    const haToken = $('ha-token')
    const haStatus = $('ha-status')
    const discoverStatus = $('ha-discover-status')
    const devices = $('ha-devices')
    const haButtons = [$('ha-discover'), $('ha-test'), $('ha-save'), $('ha-clear')]

    const setHaStatus = (text, tone = '') => {
      haStatus.textContent = text
      haStatus.dataset.tone = tone
    }
    const setDiscoverStatus = (text, tone = '') => {
      discoverStatus.textContent = text
      discoverStatus.dataset.tone = tone
    }
    const setHaBusy = (busy) => {
      for (const button of haButtons) button.disabled = busy
      haUrl.disabled = busy
      haToken.disabled = busy
    }

    const renderStatus = (state) => {
      if (!state || !state.configured) {
        setHaStatus('还没有配置 Home Assistant。可以先发现局域网设备，或手动填写地址和长期访问令牌。')
        return
      }
      if (state.connected) {
        const version = state.version ? ` · Home Assistant ${state.version}` : ''
        setHaStatus(`已连接 ${state.baseUrl}${version}`, 'ok')
      } else {
        setHaStatus(`已配置 ${state.baseUrl}，当前无法连接${state.error ? `：${state.error}` : ''}`, 'error')
      }
    }

    const refreshStatus = async () => {
      try {
        const state = await ha.status()
        if (state && state.baseUrl) haUrl.value = state.baseUrl
        renderStatus(state)
        return state
      } catch {
        setHaStatus('无法读取 Home Assistant 连接状态', 'error')
        return null
      }
    }

    const clearDeviceList = () => {
      devices.replaceChildren()
      devices.hidden = true
    }

    const renderDevices = (list) => {
      clearDeviceList()
      if (!list.length) {
        setDiscoverStatus('没有发现局域网内的 Home Assistant，可以手动填写地址。', 'warn')
        return
      }
      setDiscoverStatus(`发现 ${list.length} 台设备，点选即可填入地址。`, 'ok')
      devices.hidden = false
      for (const item of list) {
        const li = document.createElement('li')
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'device'
        const name = document.createElement('span')
        name.className = 'device-name'
        name.textContent = item.name || 'Home Assistant'
        const url = document.createElement('span')
        url.className = 'device-url'
        url.textContent = item.baseUrl
        button.append(name, url)
        button.addEventListener('click', () => {
          haUrl.value = item.baseUrl
          setHaStatus(`已选择 ${item.name || item.baseUrl}，请填写长期访问令牌后保存。`)
        })
        li.append(button)
        devices.append(li)
      }
    }

    const saveConfig = async () => {
      const result = await ha.configure({ baseUrl: haUrl.value, token: haToken.value })
      if (!result || !result.ok) return result || { ok: false, error: '保存失败' }
      // 令牌只写不读：保存后清空输入框，下次留空表示保持原令牌。
      haToken.value = ''
      haToken.placeholder = '已保存（留空则保持原令牌）'
      return result
    }

    $('ha-discover').addEventListener('click', async () => {
      setHaBusy(true)
      setDiscoverStatus('正在发现局域网设备…')
      try {
        const list = await ha.discover({ timeoutMs: 3000 })
        renderDevices(Array.isArray(list) ? list : [])
      } catch {
        clearDeviceList()
        setDiscoverStatus('发现失败，请检查网络后重试，或手动填写地址。', 'error')
      } finally {
        setHaBusy(false)
      }
    })

    $('ha-save').addEventListener('click', async () => {
      setHaBusy(true)
      setHaStatus('正在保存…')
      try {
        const result = await saveConfig()
        if (!result.ok) {
          setHaStatus(result.error || '保存失败，请重试', 'error')
          return
        }
        clearDeviceList()
        setDiscoverStatus('')
        await refreshStatus()
      } catch {
        setHaStatus('保存失败，请重试', 'error')
      } finally {
        setHaBusy(false)
      }
    })

    $('ha-test').addEventListener('click', async () => {
      setHaBusy(true)
      setHaStatus('正在测试连接…')
      try {
        const current = await ha.status()
        const edited =
          !current ||
          !current.configured ||
          haUrl.value.trim() !== (current.baseUrl || '') ||
          haToken.value.trim() !== ''
        // 有未保存的输入就先保存再测（令牌留空时沿用已保存的令牌）。
        if (edited) {
          const result = await saveConfig()
          if (!result.ok) {
            setHaStatus(result.error || '保存失败，请重试', 'error')
            return
          }
        }
        await refreshStatus()
      } catch {
        setHaStatus('测试连接失败，请重试', 'error')
      } finally {
        setHaBusy(false)
      }
    })

    $('ha-clear').addEventListener('click', async () => {
      setHaBusy(true)
      try {
        const result = await ha.clear()
        if (!result || !result.ok) {
          setHaStatus((result && result.error) || '清除失败，请重试', 'error')
          return
        }
        haUrl.value = ''
        haToken.value = ''
        haToken.placeholder = '在 Home Assistant「个人资料」页创建'
        clearDeviceList()
        setDiscoverStatus('')
        setHaStatus('已清除本机的 Home Assistant 配对信息。', 'ok')
      } catch {
        setHaStatus('清除失败，请重试', 'error')
      } finally {
        setHaBusy(false)
      }
    })

    refreshStatus()
      .then((state) => {
        if (state && state.configured) haToken.placeholder = '已保存（留空则保持原令牌）'
      })
      .catch(() => {})
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') desktop.settings.close()
  })
})()
