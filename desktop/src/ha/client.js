'use strict'

// Home Assistant REST 客户端（只在主进程里用）。
//
// 设计要点：
// - 任何网络/HTTP 错误都映射成 { ok: false, error }，不把异常抛到 IPC 外面；
// - 令牌只放在 Authorization 头里，本文件不打印任何日志，避免令牌进日志文件；
// - 超时默认 5 秒；所有请求都带 AbortController，避免卡片一多把主进程挂住。

const DEFAULT_TIMEOUT_MS = 5000
const NAME_PATTERN = /^[a-z0-9_]+$/

/**
 * 规范化 Home Assistant 地址：只接受 http/https，去掉路径和账号信息，返回 origin。
 * 省略协议时按 http 处理（局域网 HA 默认就是 http://host:8123）。
 * 无效时返回 null。
 */
function normalizeHaBaseUrl(input) {
  if (typeof input !== 'string') return null
  let value = input.trim()
  if (!value) return null
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = `http://${value}`
  let url
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (url.username || url.password || !url.hostname) return null
  return url.origin
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/**
 * 创建 HA 客户端。
 * @param {object} options
 * @param {string} options.baseUrl  例如 http://homeassistant.local:8123
 * @param {string} options.token    Home Assistant 长期访问令牌
 * @param {number} [options.timeoutMs]
 * @param {Function} [options.fetchImpl] 测试时注入
 */
function createHaClient({ baseUrl, token, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = globalThis.fetch } = {}) {
  const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS

  async function request(pathname, { method = 'GET', body } = {}) {
    const base = normalizeHaBaseUrl(baseUrl)
    if (!base) return { ok: false, error: 'Home Assistant 地址无效' }
    if (typeof fetchImpl !== 'function') return { ok: false, error: '当前环境不支持网络请求' }

    let url
    try {
      url = new URL(pathname, base)
    } catch {
      return { ok: false, error: 'Home Assistant 地址无效' }
    }

    let payload
    if (body !== undefined) {
      try {
        payload = JSON.stringify(body)
      } catch {
        return { ok: false, error: '请求数据无法序列化' }
      }
    }

    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeout)

    try {
      const response = await fetchImpl(url.href, {
        method,
        headers: {
          Authorization: `Bearer ${String(token || '')}`,
          ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: payload,
        signal: controller.signal,
        cache: 'no-store',
        // 不跟随重定向，避免 HA（或中间设备）把主进程带向任意内网地址。
        redirect: 'manual',
      })

      if (!response || typeof response.ok !== 'boolean') {
        return { ok: false, error: 'Home Assistant 返回了无法识别的响应' }
      }
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return { ok: false, error: '令牌无效或已过期，请重新生成长期访问令牌' }
        }
        return { ok: false, error: `Home Assistant 返回 HTTP ${response.status}` }
      }
      if (response.status === 204) return { ok: true, data: null }

      let data
      try {
        data = await response.json()
      } catch {
        return { ok: false, error: 'Home Assistant 返回的数据无法解析' }
      }
      return { ok: true, data }
    } catch (error) {
      if (timedOut || (error && (error.name === 'TimeoutError' || error.name === 'AbortError'))) {
        return { ok: false, error: '连接超时，请检查地址和网络' }
      }
      return { ok: false, error: '无法连接到 Home Assistant，请检查地址和网络' }
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    /** GET /api/ —— 连通性与版本 */
    getApi: () => request('/api/'),

    /** GET /api/states —— 全部实体状态 */
    async getStates() {
      const result = await request('/api/states')
      if (!result.ok) return result
      if (!Array.isArray(result.data)) return { ok: false, error: 'Home Assistant 返回的实体列表格式不正确' }
      return result
    },

    /** POST /api/services/{domain}/{service} */
    async callService({ domain, service, entityId, data } = {}) {
      if (typeof domain !== 'string' || !NAME_PATTERN.test(domain)) return { ok: false, error: '服务域无效' }
      if (typeof service !== 'string' || !NAME_PATTERN.test(service)) return { ok: false, error: '服务名称无效' }
      if (typeof entityId !== 'string' || !entityId.trim()) return { ok: false, error: '实体 ID 无效' }
      const payload = { ...(isPlainObject(data) ? data : {}), entity_id: entityId }
      return request(`/api/services/${encodeURIComponent(domain)}/${encodeURIComponent(service)}`, {
        method: 'POST',
        body: payload,
      })
    },
  }
}

module.exports = { DEFAULT_TIMEOUT_MS, createHaClient, normalizeHaBaseUrl }
