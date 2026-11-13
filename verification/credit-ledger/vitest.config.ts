import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * 只跑本目录下的复算用例。根 vitest.config.ts 的 include 是 `src/**\/*.test.ts`，
 * 这里不改主测试套件，单独给验证目录一份配置。
 */
const dir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: dir,
  resolve: {
    alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['replay.test.ts'],
  },
})
