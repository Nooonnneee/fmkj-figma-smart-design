import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * 单元测试覆盖 src/lib 的纯函数，以及 src/plugins 下的处理器 / 策略模块。
 * 需要 Payload 运行时的回归由 `pnpm run knowledge:check` 与构建门禁负责。
 *
 * 覆盖率统计 `src/lib` 与 `src/plugins`（含 .tsx）：这是测试实际覆盖的边界。
 * `src/app`、`src/collections` 等目录没有对应用例，不纳入统计 —— 那里的
 * 回归由类型检查、knowledge:check、生产构建与冒烟测试负责。
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
      include: ['src/{lib,plugins}/**/*.{ts,tsx}'],
      exclude: ['src/{lib,plugins}/**/*.test.ts'],
      // 门槛防的是「一次性拆掉现有回归网」（例如删掉几个测试文件、
      // 连带把被测代码一起移出覆盖），拿实测基线向下取整再留 1~2 个点。
      // 它不防「缩小统计范围」或「新增无测试的代码」——百分比门槛的固有
      // 局限，增量覆盖率门槛另立项。
      // 实测基线（含 tsx）：stmt 18.15 / branch 14.47 / func 16.18 / line 18.96
      thresholds: {
        lines: 17,
        statements: 17,
        functions: 15,
        branches: 13,
      },
    },
  },
})
