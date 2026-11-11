/**
 * CI 重置专用库 —— 用 `drop database` + `create database` 从零重建。
 *
 * 为什么必须重建（不是清表）：
 *   如果这个库曾经被 `next dev` 的 push 模式建过表，Payload 启动时会认为
 *   「你跑过 dev 模式」，在生产服务起来之前弹一个交互式提问：
 *     ? It looks like you've run Payload in dev mode...
 *       If you'd like to run migrations, data loss will occur. Would you like to proceed? (y/N)
 *   生产服务没有 stdin → 永远等输入 → 冒烟测试挂死到超时（实测踩过）。
 *   从零 create database + 只用 `payload migrate` 建表就没有这个问题。
 *
 * 只碰 fmkj_ci，绝不碰开发用的 fmkj。
 *
 * 用法：
 *   FMKJ_PG_PORT=55432 node scripts/ci-reset-db.mjs
 */
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'

const PORT = Number(process.env.FMKJ_PG_PORT || 55432)
const TARGET = process.env.CI_DB_NAME || 'fmkj_ci'

if (TARGET === 'fmkj' || TARGET === 'postgres') {
  console.error(`拒绝操作数据库 ${TARGET}（只允许重建 CI 专用库）`)
  process.exit(1)
}

// pg 是 CJS，走 createRequire 加载（pnpm 会把它放在嵌套目录里）
const require = createRequire(import.meta.url)
let pg
try {
  pg = require('pg')
} catch {
  const dir = execSync('ls -d node_modules/.pnpm/pg@*/node_modules/pg | head -1', {
    encoding: 'utf8',
  }).trim()
  if (!dir) {
    console.error('找不到 pg 模块，先跑 pnpm install')
    process.exit(1)
  }
  pg = require(path.resolve(dir))
}
const { Client } = pg

const client = new Client({ host: '127.0.0.1', port: PORT, user: 'fmkj', database: 'postgres' })
try {
  await client.connect()
  await client.query(`drop database if exists ${TARGET}`)
  await client.query(`create database ${TARGET}`)
  console.log(`  ${TARGET} 已重建（全新，无 dev 模式残留）`)
} catch (error) {
  console.error('重建失败：', error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}
