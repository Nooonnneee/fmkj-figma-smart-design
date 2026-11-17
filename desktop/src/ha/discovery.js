'use strict'

// 局域网 mDNS 发现 Home Assistant（_home-assistant._tcp.local）。
//
// 仓库里没有 multicast-dns / bonjour，第一期不新增依赖，这里用 Node 自带的
// node:dgram + 手写 DNS 报文解析完成发现。只做发现需要的最小集合：
// PTR（服务实例）、SRV（端口 + 主机名）、TXT（location_name）、A/AAAA（地址）。
//
// 边界：不做 DNS 缓存、不处理 EDNS(OPT)、不做 DNS-SD 服务的完整枚举；
// 报文格式不合法或网络不可用时静默返回空数组，不向调用方抛错。

const dgram = require('node:dgram')

const SERVICE_NAME = '_home-assistant._tcp.local'
const MDNS_ADDRESS = '224.0.0.251'
const MDNS_PORT = 5353
const DEFAULT_TIMEOUT_MS = 3000

const TYPE_A = 1
const TYPE_PTR = 12
const TYPE_TXT = 16
const TYPE_AAAA = 28
const TYPE_SRV = 33

const SERVICE_SUFFIX = SERVICE_NAME.toLowerCase()

function normalizeName(name) {
  return String(name || '')
    .replace(/\.+$/, '')
    .toLowerCase()
}

/** 把域名编码成 DNS label 序列（不做压缩）。 */
function encodeName(name) {
  const labels = String(name || '')
    .replace(/\.+$/, '')
    .split('.')
    .filter(Boolean)
  const parts = []
  for (const label of labels) {
    const bytes = Buffer.from(label, 'utf8')
    if (bytes.length === 0 || bytes.length > 63) throw new Error('INVALID_DNS_NAME')
    parts.push(Buffer.from([bytes.length]), bytes)
  }
  parts.push(Buffer.from([0]))
  return Buffer.concat(parts)
}

/** 构造一个 PTR 查询报文。 */
function buildQuery(name = SERVICE_NAME, id = 0) {
  const header = Buffer.alloc(12)
  header.writeUInt16BE(id & 0xffff, 0)
  header.writeUInt16BE(0x0000, 2) // 标准查询
  header.writeUInt16BE(1, 4) // QDCOUNT
  const question = Buffer.concat([encodeName(name), Buffer.from([0, TYPE_PTR, 0, 1])])
  return Buffer.concat([header, question])
}

/** 读取（可能带压缩指针的）域名，返回 { name, offset }，offset 指向名字之后。 */
function readName(buffer, start) {
  let offset = start
  let next = start
  let jumped = false
  let jumps = 0
  const labels = []

  for (;;) {
    if (offset >= buffer.length) throw new Error('DNS_NAME_OUT_OF_BOUNDS')
    const length = buffer[offset]

    if (length === 0) {
      offset += 1
      if (!jumped) next = offset
      break
    }

    if ((length & 0xc0) === 0xc0) {
      if (offset + 1 >= buffer.length) throw new Error('DNS_POINTER_OUT_OF_BOUNDS')
      const pointer = ((length & 0x3f) << 8) | buffer[offset + 1]
      if (!jumped) next = offset + 2
      jumped = true
      jumps += 1
      if (jumps > 32) throw new Error('DNS_POINTER_LOOP')
      offset = pointer
      continue
    }

    if (length > 63) throw new Error('DNS_LABEL_TOO_LONG')
    const end = offset + 1 + length
    if (end > buffer.length) throw new Error('DNS_LABEL_OUT_OF_BOUNDS')
    labels.push(buffer.toString('utf8', offset + 1, end))
    offset = end
    if (!jumped) next = offset
  }

  return { name: labels.join('.'), offset: next }
}

function parseTxt(buffer, offset, length) {
  const end = offset + length
  const entries = []
  let cursor = offset
  while (cursor < end) {
    const size = buffer[cursor]
    cursor += 1
    if (size === 0) continue
    if (cursor + size > end) break
    entries.push(buffer.toString('utf8', cursor, cursor + size))
    cursor += size
  }
  return entries
}

function parseRecordData(buffer, type, offset, length) {
  switch (type) {
    case TYPE_PTR:
      return readName(buffer, offset).name
    case TYPE_SRV: {
      if (length < 7) return null
      const target = readName(buffer, offset + 6)
      return {
        priority: buffer.readUInt16BE(offset),
        weight: buffer.readUInt16BE(offset + 2),
        port: buffer.readUInt16BE(offset + 4),
        target: target.name,
      }
    }
    case TYPE_TXT:
      return parseTxt(buffer, offset, length)
    case TYPE_A:
      if (length !== 4) return null
      return `${buffer[offset]}.${buffer[offset + 1]}.${buffer[offset + 2]}.${buffer[offset + 3]}`
    case TYPE_AAAA: {
      if (length !== 16) return null
      const groups = []
      for (let index = 0; index < 16; index += 2) groups.push(buffer.readUInt16BE(offset + index).toString(16))
      return groups.join(':')
    }
    default:
      return null
  }
}

/** 解析 DNS/mDNS 报文；格式错误时抛错（discover 内部会吞掉）。 */
function parseDnsMessage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) throw new Error('DNS_MESSAGE_TOO_SHORT')

  const header = {
    id: buffer.readUInt16BE(0),
    flags: buffer.readUInt16BE(2),
    qdcount: buffer.readUInt16BE(4),
    ancount: buffer.readUInt16BE(6),
    nscount: buffer.readUInt16BE(8),
    arcount: buffer.readUInt16BE(10),
  }

  let offset = 12
  const questions = []
  for (let index = 0; index < header.qdcount; index += 1) {
    const name = readName(buffer, offset)
    offset = name.offset
    if (offset + 4 > buffer.length) throw new Error('DNS_QUESTION_OUT_OF_BOUNDS')
    questions.push({
      name: name.name,
      type: buffer.readUInt16BE(offset),
      class: buffer.readUInt16BE(offset + 2),
    })
    offset += 4
  }

  const records = []
  const total = header.ancount + header.nscount + header.arcount
  for (let index = 0; index < total; index += 1) {
    const name = readName(buffer, offset)
    offset = name.offset
    if (offset + 10 > buffer.length) throw new Error('DNS_RECORD_OUT_OF_BOUNDS')

    const type = buffer.readUInt16BE(offset)
    const recordClass = buffer.readUInt16BE(offset + 2)
    const ttl = buffer.readUInt32BE(offset + 4)
    const length = buffer.readUInt16BE(offset + 8)
    const dataOffset = offset + 10
    if (dataOffset + length > buffer.length) throw new Error('DNS_RDATA_OUT_OF_BOUNDS')

    records.push({
      name: name.name,
      type,
      class: recordClass,
      ttl,
      data: parseRecordData(buffer, type, dataOffset, length),
    })
    offset = dataOffset + length
  }

  return { header, questions, records }
}

function txtValue(entries, key) {
  const prefix = `${key.toLowerCase()}=`
  for (const entry of entries || []) {
    if (String(entry).toLowerCase().startsWith(prefix)) return String(entry).slice(prefix.length)
  }
  return ''
}

/**
 * 把一批解析后的报文拼成 [{ name, baseUrl }]。
 * 主机优先用 A 记录（IPv4），其次 AAAA，最后退回 SRV 的 target 主机名。
 */
function resolveInstances(messages) {
  const instances = new Map() // normalized -> 原始实例名
  const srv = new Map()
  const txt = new Map()
  const addresses = new Map() // normalized host -> { v4: [], v6: [] }

  const addAddress = (host, family, address) => {
    const key = normalizeName(host)
    if (!key || !address) return
    const entry = addresses.get(key) || { v4: [], v6: [] }
    if (family === 4) entry.v4.push(address)
    else entry.v6.push(address)
    addresses.set(key, entry)
  }

  for (const message of [].concat(messages || [])) {
    for (const record of (message && message.records) || []) {
      const key = normalizeName(record.name)
      if (record.type === TYPE_PTR && typeof record.data === 'string') {
        const service = key
        if (service === SERVICE_SUFFIX || service.endsWith(`.${SERVICE_SUFFIX}`)) {
          instances.set(normalizeName(record.data), record.data)
        }
      } else if (record.type === TYPE_SRV && record.data) {
        srv.set(key, record.data)
      } else if (record.type === TYPE_TXT && Array.isArray(record.data)) {
        txt.set(key, record.data)
      } else if (record.type === TYPE_A) {
        addAddress(record.name, 4, record.data)
      } else if (record.type === TYPE_AAAA) {
        addAddress(record.name, 6, record.data)
      }
    }
  }

  // 有些实现只回 SRV 不回 PTR（例如缓存里的应答），也一并收下。
  for (const key of srv.keys()) {
    if (key.endsWith(`.${SERVICE_SUFFIX}`) && !instances.has(key)) instances.set(key, key)
  }

  const results = []
  const seen = new Set()
  for (const [key, original] of instances) {
    const service = srv.get(key)
    if (!service || !Number.isInteger(service.port) || service.port <= 0 || service.port > 65535) continue

    const target = normalizeName(service.target)
    if (!target) continue
    const found = addresses.get(target)
    const ipv4 = found && found.v4[0]
    const ipv6 = found && found.v6[0]
    let host = ipv4 || ipv6 || service.target.replace(/\.+$/, '')
    if (!host) continue
    if (host === ipv6 && ipv6.includes(':') && !ipv6.startsWith('[')) host = `[${ipv6}]`

    const baseUrl = `http://${host}:${service.port}`
    if (seen.has(baseUrl)) continue
    seen.add(baseUrl)

    const readable = txtValue(txt.get(key), 'location_name') || String(original).split('.')[0] || target
    results.push({ name: readable, baseUrl })
  }

  return results
}

/**
 * 发现局域网内的 Home Assistant。
 * 无响应、网络不可用、报文异常时返回 []，不会抛错。
 *
 * @param {object} [options]
 * @param {number} [options.timeoutMs=3000]
 * @param {object} [options.dgramModule] 测试时可注入假的 dgram
 */
function discover({ timeoutMs = DEFAULT_TIMEOUT_MS, dgramModule = dgram } = {}) {
  const timeout = Number.isFinite(timeoutMs) ? Math.min(Math.max(timeoutMs, 250), 15000) : DEFAULT_TIMEOUT_MS

  return new Promise((resolve) => {
    const messages = []
    let socket = null
    let timer = null
    let resendTimer = null
    let done = false

    const finish = () => {
      if (done) return
      done = true
      if (timer) clearTimeout(timer)
      if (resendTimer) clearTimeout(resendTimer)
      if (socket) {
        try {
          socket.close()
        } catch {
          // 已经关闭/未绑定，忽略
        }
      }
      let results = []
      try {
        results = resolveInstances(messages)
      } catch {
        results = []
      }
      resolve(results)
    }

    try {
      socket = dgramModule.createSocket({ type: 'udp4', reuseAddr: true })
    } catch {
      resolve([])
      return
    }

    socket.on('error', finish)
    socket.on('message', (message) => {
      try {
        messages.push(parseDnsMessage(message))
      } catch {
        // 单个坏报文不影响其它应答
      }
    })

    const sendQuery = () => {
      if (done) return
      try {
        const query = buildQuery(SERVICE_NAME)
        socket.send(query, MDNS_PORT, MDNS_ADDRESS, () => {})
        // 本机运行的 HA（比如 Docker）未必回多播，单独问一次回环地址。
        socket.send(query, MDNS_PORT, '127.0.0.1', () => {})
      } catch {
        // 发送失败通常是网络权限/接口问题，等超时统一返回空数组
      }
    }

    socket.on('listening', () => {
      try {
        socket.addMembership(MDNS_ADDRESS)
      } catch {
        // 没有多播权限时仍可尝试回环地址
      }
      sendQuery()
      // mDNS 是 UDP，丢一个包很常见，超时前再补发一次。
      resendTimer = setTimeout(sendQuery, Math.min(1200, Math.floor(timeout / 2)))
    })

    timer = setTimeout(finish, timeout)

    try {
      socket.bind(0)
    } catch {
      finish()
    }
  })
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  MDNS_ADDRESS,
  MDNS_PORT,
  SERVICE_NAME,
  buildQuery,
  discover,
  encodeName,
  parseDnsMessage,
  readName,
  resolveInstances,
}
