import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * 单元测试只覆盖 src/lib 下的纯函数（无 DB / Payload 副作用），
 * 需要 Payload 运行时的回归由 `pnpm run knowledge:check` 与构建门禁负责。
 *
 * 覆盖率只统计 `src/lib/**`：这是测试真正覆盖的边界。`src/plugins/**`、
 * `src/collections/**` 等目录的用例虽然存在，但会牵连 Payload/DB 运行时，
 * 统计进去只会让数字失真（模块加载即失败），所以不纳入门槛。
 */
export default defineConfig({
  resolve: {
    alias: {
      // 与 tsconfig.json 的 paths 保持一致
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // 说明文件：这些用例是源码行为的回归网，覆盖率门槛是附加门禁
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/lib/**/*.{ts,tsx}'],
      exclude: ['src/lib/**/*.test.ts'],
      // 基线见 package.json 的 test:coverage 与 CI「覆盖率与单元测试」步骤。
      // 数字取实测值向下取整再留 1~2 个点余量，只防回退，不做冲刺目标。
      thresholds: {
        lines: 20,
        functions: 20,
        statements: 20,
        branches: 16,
      },
    },
  },
})
