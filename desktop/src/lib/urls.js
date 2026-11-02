'use strict'

// 纯函数工具：不依赖 Electron，scripts/check.mjs 会直接用 Node 测试。

const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

/**
 * 规范化服务器地址：只接受 http(s)，去掉路径、查询和账号信息，返回 origin。
 * 省略协议时按 https 处理。无效时返回 null。
 */
function normalizeServerUrl(input) {
  if (typeof input !== 'string') return null
  let value = input.trim()
  if (!value) return null
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = `https://${value}`
  let url
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password || !url.hostname) return null
  return url.origin
}

/** url 与 origin 是否同源；blob: 地址按其创建页面的来源判断。 */
function isSameOrigin(url, origin) {
  if (!url || !origin) return false
  try {
    const target = new URL(url).origin
    return target !== 'null' && target === new URL(origin).origin
  } catch {
    return false
  }
}

/** 只允许交给系统打开的外部地址类型 */
function isSafeExternalUrl(url) {
  try {
    return EXTERNAL_PROTOCOLS.has(new URL(url).protocol)
  } catch {
    return false
  }
}

/**
 * 深度链接 → 服务器页面地址，结果一定落在当前服务器上。
 *   fanmeng://open/projects/1  → https://服务器/projects/1
 *   fanmeng://projects/1       → https://服务器/projects/1
 */
function deepLinkToUrl(raw, protocol, serverOrigin) {
  let link
  try {
    link = new URL(raw)
  } catch {
    return null
  }
  if (link.protocol !== `${protocol}:`) return null
  const host = link.hostname === 'open' ? '' : link.hostname
  const segments = `${host}/${link.pathname}`.split('/').filter(Boolean)
  let target
  try {
    target = new URL(`/${segments.join('/')}${link.search}${link.hash}`, serverOrigin)
  } catch {
    return null
  }
  return isSameOrigin(target.href, serverOrigin) ? target.href : null
}

/** 比较版本号：a > b 返回 1，a < b 返回 -1，相等返回 0（忽略预发布后缀）。 */
function compareVersions(a, b) {
  const parse = (v) =>
    String(v ?? '')
      .trim()
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((n) => Number.parseInt(n, 10) || 0)
  const pa = parse(a)
  const pb = parse(b)
  for (let i = 0; i < Math.max(pa.length, pb.length, 3); i += 1) {
    const diff = (pa[i] || 0) - (pb[i] || 0)
    if (diff) return diff > 0 ? 1 : -1
  }
  return 0
}

/** 解析 electron-builder 生成的 latest.yml / latest-mac.yml（只取需要的字段）。 */
function parseUpdateFeed(text) {
  const field = (name) => {
    const match = new RegExp(`^${name}:\\s*['"]?([^'"\\r\\n]+?)['"]?\\s*$`, 'm').exec(String(text))
    return match ? match[1] : null
  }
  const files = []
  for (const line of String(text).split(/\r?\n/)) {
    const url = /^\s*-\s*url:\s*['"]?([^'"]+?)['"]?\s*$/.exec(line)
    if (url) {
      files.push({ url: url[1], size: null })
      continue
    }
    const size = /^\s+size:\s*(\d+)\s*$/.exec(line)
    if (size && files.length) files[files.length - 1].size = Number(size[1])
  }
  return { version: field('version'), path: field('path'), releaseDate: field('releaseDate'), files }
}

module.exports = {
  normalizeServerUrl,
  isSameOrigin,
  isSafeExternalUrl,
  deepLinkToUrl,
  compareVersions,
  parseUpdateFeed,
}
