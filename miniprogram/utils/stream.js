const { apiUrl, authHeader, toLogin } = require('./request')

/**
 * 读取服务端 NDJSON 流（AI 对话）。基础库 2.20.1+ 支持 enableChunked 逐段接收；
 * 不支持时在请求结束后一次性解析。小程序没有 TextDecoder，这里自带 UTF-8 增量解码（处理被切断的多字节字符）。
 */
function utf8Decoder() {
  let rest = []
  return function decode(buffer) {
    const incoming = new Uint8Array(buffer)
    const bytes = rest.length ? new Uint8Array(rest.length + incoming.length) : incoming
    if (rest.length) {
      bytes.set(rest, 0)
      bytes.set(incoming, rest.length)
    }
    let end = bytes.length
    let i = bytes.length - 1
    let cont = 0
    while (i >= 0 && cont < 3 && (bytes[i] & 0xc0) === 0x80) {
      i--
      cont++
    }
    if (i >= 0) {
      const lead = bytes[i]
      const need = lead >= 0xf0 ? 4 : lead >= 0xe0 ? 3 : lead >= 0xc0 ? 2 : 1
      if (need > cont + 1) end = i
    }
    rest = Array.prototype.slice.call(bytes, end)
    let out = ''
    for (let k = 0; k < end; ) {
      const b = bytes[k]
      let cp
      if (b < 0x80) {
        cp = b
        k += 1
      } else if (b < 0xe0) {
        cp = ((b & 0x1f) << 6) | (bytes[k + 1] & 0x3f)
        k += 2
      } else if (b < 0xf0) {
        cp = ((b & 0x0f) << 12) | ((bytes[k + 1] & 0x3f) << 6) | (bytes[k + 2] & 0x3f)
        k += 3
      } else {
        cp = ((b & 0x07) << 18) | ((bytes[k + 1] & 0x3f) << 12) | ((bytes[k + 2] & 0x3f) << 6) | (bytes[k + 3] & 0x3f)
        k += 4
      }
      if (cp > 0xffff) {
        cp -= 0x10000
        out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff))
      } else out += String.fromCharCode(cp)
    }
    return out
  }
}

/** 发送并逐条回调事件：onEvent({ type: 'meta'|'tool'|'project'|'delta'|'reasoning'|'done'|'error', ... }) */
function streamNdjson(path, data, onEvent) {
  const decode = utf8Decoder()
  let buffer = ''
  let gotChunk = false
  let finished = false
  const emitLines = (text, flush) => {
    buffer += text
    const lines = buffer.split('\n')
    buffer = flush ? '' : lines.pop()
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const ev = JSON.parse(line)
        if (!ev || ev.type === 'ping') continue
        if (ev.ok === false && !ev.type) {
          finished = true
          onEvent({ type: 'error', error: ev.error || '请求失败' })
        } else {
          if (ev.type === 'done' || ev.type === 'error') finished = true
          onEvent(ev)
        }
      } catch (e) {
        // 忽略不完整的行
      }
    }
  }
  const task = wx.request({
    url: apiUrl(path),
    method: 'POST',
    data,
    enableChunked: true,
    responseType: 'arraybuffer',
    timeout: 180000,
    header: Object.assign({ 'Content-Type': 'application/json' }, authHeader()),
    success(res) {
      if (res.statusCode === 401) {
        toLogin()
        return
      }
      if (!gotChunk && res.data) {
        const text = typeof res.data === 'string' ? res.data : decode(res.data)
        emitLines(text + '\n', true)
      } else if (buffer) emitLines('\n', true)
      finished = true
      onEvent({ type: 'closed' })
    },
    fail(e) {
      if (!finished) {
        const msg = (e && e.errMsg) || ''
        const isAbort = /abort/i.test(msg)
        const isTimeout = /timeout|time out/i.test(msg)
        onEvent({
          type: isAbort ? 'aborted' : 'error',
          error: isTimeout ? 'AI 思考或执行耗时较长，连接超时，请重试' : '网络连接中断，请重试',
        })
      }
    },
  })
  if (task && task.onChunkReceived) {
    task.onChunkReceived((res) => {
      gotChunk = true
      emitLines(decode(res.data), false)
    })
  }
  return task
}

module.exports = { streamNdjson }
