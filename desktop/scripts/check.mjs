// 桌面端自检：语法检查 + 纯函数测试 + 打包配置一致性。不需要启动 Electron，也不需要安装依赖。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
let failures = 0

function check(name, fn) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    failures += 1
    console.error(`✗ ${name}\n  ${String(error.message).split('\n').join('\n  ')}`)
  }
}

// 1. 语法检查
const scripts = []
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) walk(full)
    else if (/\.(c?js|mjs)$/.test(entry)) scripts.push(full)
  }
}
walk(path.join(root, 'src'))
walk(path.join(root, 'scripts'))
for (const file of scripts) {
  check(`语法 ${path.relative(root, file)}`, () => execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }))
}

// 2. 纯函数
const urls = require('../src/lib/urls.js')

check('normalizeServerUrl', () => {
  assert.equal(urls.normalizeServerUrl('fmkj.top'), 'https://fmkj.top')
  assert.equal(urls.normalizeServerUrl(' https://fmkj.top/projects?a=1 '), 'https://fmkj.top')
  assert.equal(urls.normalizeServerUrl('http://192.168.1.10:3000/'), 'http://192.168.1.10:3000')
  assert.equal(urls.normalizeServerUrl('javascript:alert(1)'), null)
  assert.equal(urls.normalizeServerUrl('file:///etc/passwd'), null)
  assert.equal(urls.normalizeServerUrl('https://user:pass@fmkj.top'), null)
  assert.equal(urls.normalizeServerUrl(''), null)
})

check('isSameOrigin', () => {
  assert.ok(urls.isSameOrigin('https://fmkj.top/projects', 'https://fmkj.top'))
  assert.ok(urls.isSameOrigin('blob:https://fmkj.top/123', 'https://fmkj.top'))
  assert.ok(!urls.isSameOrigin('https://fmkj.top.evil.com/', 'https://fmkj.top'))
  assert.ok(!urls.isSameOrigin('http://fmkj.top/', 'https://fmkj.top'))
  assert.ok(!urls.isSameOrigin('about:blank', 'https://fmkj.top'))
  assert.ok(!urls.isSameOrigin('file:///tmp/x.html', 'https://fmkj.top'))
})

check('isSafeExternalUrl', () => {
  assert.ok(urls.isSafeExternalUrl('https://unsplash.com'))
  assert.ok(urls.isSafeExternalUrl('mailto:hi@example.com'))
  assert.ok(!urls.isSafeExternalUrl('file:///C:/Windows/system32/calc.exe'))
  assert.ok(!urls.isSafeExternalUrl('smb://share/x'))
  assert.ok(!urls.isSafeExternalUrl('javascript:alert(1)'))
})

check('deepLinkToUrl', () => {
  const server = 'https://fmkj.top'
  assert.equal(urls.deepLinkToUrl('fanmeng://open/projects/42', 'fanmeng', server), 'https://fmkj.top/projects/42')
  assert.equal(urls.deepLinkToUrl('fanmeng://projects/42?tab=quote', 'fanmeng', server), 'https://fmkj.top/projects/42?tab=quote')
  assert.equal(urls.deepLinkToUrl('fanmeng://open//evil.com/x', 'fanmeng', server), 'https://fmkj.top/evil.com/x')
  assert.ok(urls.deepLinkToUrl('fanmeng://open/../../etc', 'fanmeng', server).startsWith('https://fmkj.top/'))
  assert.equal(urls.deepLinkToUrl('https://evil.com/projects', 'fanmeng', server), null)
  assert.equal(urls.deepLinkToUrl('not a url', 'fanmeng', server), null)
})

check('compareVersions', () => {
  assert.equal(urls.compareVersions('1.0.1', '1.0.0'), 1)
  assert.equal(urls.compareVersions('v1.2.0', '1.10.0'), -1)
  assert.equal(urls.compareVersions('1.0.0', '1.0'), 0)
  assert.equal(urls.compareVersions('2.0.0-beta.1', '1.9.9'), 1)
})

check('parseUpdateFeed', () => {
  const feed = urls.parseUpdateFeed(
    [
      'version: 1.2.3',
      'files:',
      '  - url: FanmengSpace-1.2.3-mac-arm64.zip',
      '    sha512: abc',
      '    size: 123',
      '  - url: FanmengSpace-1.2.3-mac-arm64.dmg',
      '    sha512: def',
      '    size: 456',
      'path: FanmengSpace-1.2.3-mac-arm64.zip',
      'sha512: abc',
      "releaseDate: '2026-10-31T08:00:00.000Z'",
    ].join('\n'),
  )
  assert.equal(feed.version, '1.2.3')
  assert.equal(feed.path, 'FanmengSpace-1.2.3-mac-arm64.zip')
  assert.equal(feed.releaseDate, '2026-10-31T08:00:00.000Z')
  assert.deepEqual(feed.files, [
    { url: 'FanmengSpace-1.2.3-mac-arm64.zip', size: 123 },
    { url: 'FanmengSpace-1.2.3-mac-arm64.dmg', size: 456 },
  ])
})

// 3. 配置与资源
check('app-config.json 与 electron-builder.yml、package.json 一致', () => {
  const cfg = JSON.parse(readFileSync(path.join(root, 'app-config.json'), 'utf8'))
  const yml = readFileSync(path.join(root, 'electron-builder.yml'), 'utf8')
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
  assert.match(yml, new RegExp(`^appId: ${cfg.appId.replace(/\./g, '\\.')}$`, 'm'), 'appId 不一致')
  assert.match(yml, new RegExp(`^\\s+- ${cfg.protocol}$`, 'm'), '协议名不一致')
  assert.ok(urls.normalizeServerUrl(cfg.defaultServerUrl), 'defaultServerUrl 无效')
  assert.ok(cfg.updatePath.startsWith('/'), 'updatePath 必须以 / 开头')
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/, 'version 必须是 x.y.z')
  assert.equal(pkg.main, 'src/main.js')
  assert.ok(existsSync(path.join(root, pkg.main)))
})

check('图标与本地页面资源齐全', () => {
  const png = (file, min) => {
    const buf = readFileSync(path.join(root, file))
    assert.equal(buf.toString('hex', 1, 4), '504e47', `${file} 不是 PNG（如果是 Git LFS 指针，请先 git lfs pull）`)
    const width = buf.readUInt32BE(16)
    const height = buf.readUInt32BE(20)
    assert.ok(width >= min && height >= min, `${file} 尺寸 ${width}×${height} 小于 ${min}`)
  }
  png('resources/icon-win.png', 256)
  png('resources/icon-mac.png', 512)
  for (const page of ['offline.html', 'settings.html']) {
    const html = readFileSync(path.join(root, 'src/renderer', page), 'utf8')
    assert.match(html, /Content-Security-Policy/, `${page} 缺少 CSP`)
    for (const [, ref] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      assert.ok(existsSync(path.join(root, 'src/renderer', ref)), `${page} 引用的 ${ref} 不存在`)
    }
  }
})

check('主进程安全选项', () => {
  const main = readFileSync(path.join(root, 'src/main.js'), 'utf8')
  const required = ['contextIsolation: true', 'nodeIntegration: false', 'sandbox: true', 'app.enableSandbox()', 'setWindowOpenHandler', "'will-navigate'", "'will-redirect'", "'will-attach-webview'", 'requestSingleInstanceLock']
  for (const needle of required) assert.ok(main.includes(needle), `缺少 ${needle}`)
})

if (failures) {
  console.error(`\n${failures} 项检查未通过`)
  process.exit(1)
}
console.log('\n全部检查通过')
