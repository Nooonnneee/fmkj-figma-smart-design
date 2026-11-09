# e2e —— 页面冒烟测试

## 为什么有它

CI 原有六道门禁（`oxfmt` / `eslint` / `tsc` / `knowledge:check` / `vitest` / 生产构建）
**全部只看代码，看不到页面**。2026-11-08 那批 bug 就是活例子：

> 类型过了、84 个单测过了、生产构建过了 —— 但页面照样把内部枚举名
> `智能switch-2设备` 印到客户合同上；侧边栏也看不出当前在哪一页。

这七类问题**没有一类能被当时那六道门禁发现**。所以加了这一层：
起真实 PostgreSQL + 真服务 + 真浏览器（Playwright），断言用户能感知的东西。

## 断言什么

| #   | 断言                                | 拦住的真实事故                            |
| --- | ----------------------------------- | ----------------------------------------- |
| 1   | 没有 console 错误 / 页面异常        | 组件抛错、水合失败                        |
| 2   | 没有卡在骨架屏                      | 2026-11-08「所有工作台页面卡在骨架屏」    |
| 3   | 页面真的渲染出内容（文字 ≥ 150 字） | 页面空白                                  |
| 4   | 没有横向滚动条                      | 窄屏溢出                                  |
| 5   | 没有加载失败的图片                  | 图片 404                                  |
| 6   | 关键文案存在                        | 页面渲染错页                              |
| 7   | **客户可见处不出现内部枚举名**      | `智能switch-2设备` / `DEMO-SWITCH-2` 泄漏 |

第 7 条是业务红线：这些字符串一旦出现在客户看的合同、方案、首页上，
专业度直接崩掉，而类型系统和单测都看不见它。

## 怎么跑

```bash
# 1. 起库并迁移（本地开发库在 55432）
PG=/Users/noonebook/.paperclip/cli/installs/npm/2026.916.1/node_modules/@embedded-postgres/darwin-arm64/native/bin
$PG/pg_ctl -D ~/.fmkj-dev-db -o "-p 55432 -k /tmp" -l /tmp/pg-fmkj.log start
pnpm exec payload migrate

# 2. 造种子数据（幂等，重复跑不炸）
pnpm exec payload run --input '{"scriptPath":"scripts/seed-smoke.ts"}'

# 3. 起服务（用项目提供的脚本，它会把环境变量配齐）
bash scripts/dev-local.sh

# 4. 跑冒烟
SMOKE_PROJECT_ID=<种子脚本输出的 ID> pnpm smoke

# 只跑部分页面
pnpm smoke 项目 模板
```

## 环境变量

| 变量                         | 默认                            | 说明                                  |
| ---------------------------- | ------------------------------- | ------------------------------------- |
| `SMOKE_BASE`                 | `http://localhost:3000`         | 目标地址                              |
| `SMOKE_EMAIL` / `SMOKE_PASS` | `demo@fmkj.local` / `demo12345` | 测试账号                              |
| `SMOKE_PROJECT_ID`           | 空                              | 项目子页用的项目 ID；不传则跳过这些页 |
| `SMOKE_OUT`                  | `/tmp/fmkj-smoke`               | 失败截图与明细的输出目录              |

## CI 里怎么接

`.github/workflows/ci.yml` 的 `smoke` job：起 `postgres:18` service →
`payload migrate` → `seed-smoke.ts` → 装 Chromium → 起 dev server 等就绪 →
`node e2e/smoke.mjs`。失败时把截图与 dev 日志作为 artifact 上传。

## 两个曾经踩过的坑

1. **`fullPage: true` 截图对 lazy-load 图片不可靠。**
   即使图片在浏览器里已解码完（`complete: true`, `naturalWidth > 0`），
   整页截图仍可能把它们画成空白框。所以本脚本只用视口截图，
   需要图片证据时用 `elementHandle.screenshot()` 单独截元素。

2. **未登录上下文必须新建 `browser.newContext()`。**
   同一个 context 里的 page 共享 cookie，用它开的新页仍是登录态，
   测不出「未登录访问 `/login`」的真实行为。
