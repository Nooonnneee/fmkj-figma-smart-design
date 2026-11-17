// mDNS 发现解析测试：用合成 DNS 报文覆盖压缩指针、SRV/TXT/A 组合与坏数据。
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const { buildQuery, discover, encodeName, parseDnsMessage, resolveInstances } = require('../src/ha/discovery.js')

const SERVICE_OFFSET = 12 // 没有 question 时，第一条记录的名字从 12 开始

function u16(value) {
  const buffer = Buffer.alloc(2)
  buffer.writeUInt16BE(value)
  return buffer
}

function u32(value) {
  const buffer = Buffer.alloc(4)
  buffer.writeUInt32BE(value)
  return buffer
}

function record(name, type, rdata, ttl = 120) {
  return Buffer.concat([name, u16(type), u16(1), u32(ttl), u16(rdata.length), rdata])
}

function label(text) {
  const bytes = Buffer.from(text, 'utf8')
  return Buffer.concat([Buffer.from([bytes.length]), bytes])
}

function header(answers) {
  const buffer = Buffer.alloc(12)
  buffer.writeUInt16BE(0, 0) // id
  buffer.writeUInt16BE(0x8400, 2) // response + authoritative
  buffer.writeUInt16BE(0, 4) // qdcount
  buffer.writeUInt16BE(answers, 6) // ancount
  return buffer
}

function syntheticResponse({ includeTxt = true, includeA = true } = {}) {
  const serviceName = encodeName('_home-assistant._tcp.local')
  // "Home." + 指向 serviceName 起始位置的压缩指针
  const instanceName = Buffer.concat([label('Home'), Buffer.from([0xc0, SERVICE_OFFSET])])
  const hostName = encodeName('ha.local')

  const ptr = record(serviceName, 12, instanceName)
  const srv = record(instanceName, 33, Buffer.concat([u16(0), u16(0), u16(8123), hostName]))
  const txtEntry = Buffer.from('location_name=客厅', 'utf8')
  const txt = record(instanceName, 16, Buffer.concat([Buffer.from([txtEntry.length]), txtEntry]))
  const a = record(hostName, 1, Buffer.from([192, 168, 1, 50]))

  const records = [ptr, srv]
  if (includeTxt) records.push(txt)
  if (includeA) records.push(a)
  return Buffer.concat([header(records.length), ...records])
}

test('encodeName / buildQuery：生成合法的 DNS 查询', () => {
  const encoded = encodeName('_home-assistant._tcp.local')
  assert.equal(encoded[0], 15) // "_home-assistant"
  assert.equal(encoded[encoded.length - 1], 0)

  const query = buildQuery('_home-assistant._tcp.local', 42)
  assert.equal(query.readUInt16BE(0), 42)
  assert.equal(query.readUInt16BE(4), 1) // QDCOUNT
  assert.equal(query.readUInt16BE(query.length - 4), 12) // PTR
  assert.equal(query.readUInt16BE(query.length - 2), 1) // IN
})

test('parseDnsMessage：解出压缩实例名、SRV、TXT、A', () => {
  const parsed = parseDnsMessage(syntheticResponse())
  assert.equal(parsed.records.length, 4)

  assert.equal(parsed.records[0].type, 12)
  assert.equal(parsed.records[0].data, 'Home._home-assistant._tcp.local')

  assert.equal(parsed.records[1].type, 33)
  assert.deepEqual(parsed.records[1].data, { priority: 0, weight: 0, port: 8123, target: 'ha.local' })

  assert.equal(parsed.records[2].type, 16)
  assert.ok(parsed.records[2].data.includes('location_name=客厅'))

  assert.equal(parsed.records[3].type, 1)
  assert.equal(parsed.records[3].data, '192.168.1.50')
})

test('resolveInstances：PTR + SRV + TXT + A 拼出名称与地址', () => {
  const parsed = parseDnsMessage(syntheticResponse())
  assert.deepEqual(resolveInstances([parsed]), [{ name: '客厅', baseUrl: 'http://192.168.1.50:8123' }])
})

test('resolveInstances：没有 A 记录时退回 SRV 主机名', () => {
  const parsed = parseDnsMessage(syntheticResponse({ includeA: false }))
  assert.deepEqual(resolveInstances([parsed]), [{ name: '客厅', baseUrl: 'http://ha.local:8123' }])
})

test('resolveInstances：没有 TXT 时用实例名做显示名', () => {
  const parsed = parseDnsMessage(syntheticResponse({ includeTxt: false }))
  assert.deepEqual(resolveInstances([parsed]), [{ name: 'Home', baseUrl: 'http://192.168.1.50:8123' }])
})

test('resolveInstances：同一地址去重，空输入返回空数组', () => {
  const parsed = parseDnsMessage(syntheticResponse())
  assert.equal(resolveInstances([parsed, parsed]).length, 1)
  assert.deepEqual(resolveInstances([]), [])
})

test('parseDnsMessage：截断/垃圾报文抛错，但 discover 不把错误抛给调用方', async () => {
  assert.throws(() => parseDnsMessage(Buffer.from([1, 2, 3])))

  const fakeDgram = {
    createSocket() {
      const socket = new EventEmitter()
      socket.bind = () => {}
      socket.close = () => {}
      socket.send = () => {}
      socket.addMembership = () => {}
      return socket
    },
  }
  const result = await discover({ timeoutMs: 25, dgramModule: fakeDgram })
  assert.deepEqual(result, [])
})
