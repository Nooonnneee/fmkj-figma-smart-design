/**
 * 把成员自填 AI 渠道的密钥密文，重加密到当前钥匙代次。
 *
 * 用法（**先备份数据库**）：
 *
 *   # 0. 备份
 *   pg_dump "$DATABASE_URI" > backup-before-rotate-$(date +%Y%m%d%H%M).sql
 *
 *   # 1. 新 secret 换成当前的 PAYLOAD_SECRET，旧 secret 放进旧钥匙环，
 *   #    并把 key id 改成新代次（例如 k2）；k1 保持旧值
 *   export PAYLOAD_SECRET='<新的 JWT + 数据密钥材料>'
 *   export AI_CHANNELS_KEY_ID='k2'
 *   export AI_CHANNELS_OLD_KEYS='{"k1":"<旧的 PAYLOAD_SECRET>"}'
 *
 *   # 2. 先空跑看统计
 *   pnpm exec payload run scripts/rotate-ai-channels-key.ts --dry-run
 *
 *   # 3. 真跑
 *   pnpm exec payload run scripts/rotate-ai-channels-key.ts
 *
 *   # 4. 确认 upgraded=0 / failed=0 之后，删掉 AI_CHANNELS_OLD_KEYS
 *
 * 幂等：已经处于当前代次的密文会被跳过（`already-current`），中途失败可以重跑。
 * 脚本的安全性建立在「旧钥匙还在环境变量里」——**在确认全部升级完成前不要删
 * `AI_CHANNELS_OLD_KEYS`**，否则解不开的密文只能让用户重新填。
 *
 * 执行方式是**顶层语句**（与 `scripts/set-password.ts` 等一致）：`payload run` 只会
 * `import()` 这个模块，不会调用 default export。文件末尾的守卫让测试可以安全 import
 * 而不触发真实写库。
 */
import path from 'node:path'
import { getPayload, type Payload } from 'payload'

import { reencryptAllChannels } from '@/lib/ai-channels-rotate'

export type RotateOptions = { dryRun: boolean }

export function parseRotateArgs(argv: string[]): RotateOptions {
  return { dryRun: argv.includes('--dry-run') }
}

export async function run(payload: Payload, opts: RotateOptions) {
  const { dryRun } = opts
  const keyId = process.env.AI_CHANNELS_KEY_ID || 'k1'
  const info = (msg: string) => payload.logger.info(`[rotate-ai-channels] ${msg}`)

  info(`开始${dryRun ? '（空跑，不写库）' : ''}：当前 key id=${keyId}`)
  if (!process.env.PAYLOAD_SECRET) {
    throw new Error('缺少 PAYLOAD_SECRET：请先把新 secret 设进去')
  }
  if (dryRun) {
    info('提示：空跑只统计，不会写库；确认统计无误后再去掉 --dry-run 真跑。')
  }

  const summary = await reencryptAllChannels(payload, {
    dryRun,
    log: (line) => payload.logger.info(`[rotate-ai-channels]${line}`),
  })

  info(
    [
      '完成',
      `用户${dryRun ? '待更新' : '已更新'}=${summary.usersUpdated}`,
      `升级=${summary.upgraded}`,
      `已是当前代次=${summary.alreadyCurrent}`,
      `空密钥=${summary.skippedEmpty}`,
      `失败=${summary.failed}`,
    ].join(' '),
  )
  if (summary.failed > 0) {
    payload.logger.error(
      '[rotate-ai-channels] 有失败条目：通常是 AI_CHANNELS_OLD_KEYS 缺了对应代次，补齐后重跑本脚本。',
    )
    throw new Error(`有 ${summary.failed} 条密文无法重加密，未完成`)
  }
  return summary
}

/** 只在被 `payload run` 直接执行时跑；被测试 import 时不跑。 */
async function main() {
  const configPath = path.resolve(
    process.env.PAYLOAD_CONFIG_PATH || 'src/payload.selfhost.config.ts',
  )
  const payload = await getPayload({ config: (await import(configPath)).default })
  if (payload.db.name !== 'postgres') {
    console.error(`当前连的是 ${payload.db.name}，不是 PostgreSQL，已停止。`)
    process.exit(1)
  }
  await run(payload, parseRotateArgs(process.argv.slice(2)))
  process.exit(0)
}

const invokedDirectly = /rotate-ai-channels-key\.(ts|js)$/.test(process.argv[1] ?? '')
if (invokedDirectly) {
  await main()
}
