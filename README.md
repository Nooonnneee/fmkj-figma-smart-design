# 繁梦空间 / DreamStars

全屋智能设计的**点位图 → 报价 → 合同 → 交付**一体化工具。设计师在户型图上摆设备符号，系统自动统计数量、匹配型号、生成可打印给客户的报价单。

Next.js App Router + React 19 + Payload CMS（自托管 Postgres）+ Tailwind v4 + Astryx 设计系统。

## 这是什么

一个面向智能家居设计师（个人或小团队）的业务工具，核心是一条链路：

```
项目 → 点位图 → 报价 → 合同 → 归档
```

一条铁律：**点位图是唯一数据源头**，报价从点位派生，绝不在两处录同一件事。

除了主链路，还有产品库、方案模板、文档打印（报价单 / 交底清单 / 采购单 / 合同 / 方案演示）、AI 助手与插件体系。

## 跑起来

需要 Node 24+ 和 pnpm 10+（见 `.mise.toml`），以及一个 Postgres。

```bash
pnpm install

# 最少要两个环境变量
export DATABASE_URI='postgres://user:pass@127.0.0.1:5432/fmkj'
export PAYLOAD_SECRET="$(openssl rand -hex 32)"

# 建表（迁移是幂等的，可以重复跑）
pnpm exec payload migrate

pnpm dev        # → http://localhost:3000
```

完整的部署变量见 `deploy/selfhost.env.example`。生产构建走自托管配置：

```bash
PAYLOAD_CONFIG_PATH=src/payload.selfhost.config.ts pnpm build
```

> 注意：`src/payload.config.ts` 默认指向 Figma Make 版配置，本地和 CI 要走
> `payload.selfhost.config.ts`。仓库根目录的 `AGENTS.md` 里有完整的构建与校验说明。

## 代码地图

```
src/app/(frontend)/     前台页面（项目、点位、报价、合同、打印、设置）
src/app/(payload)/      Payload 管理端与 API（不要手改）
src/collections/        21 个集合定义
src/globals/            全局配置（公司信息、AI 设置等）
src/board/              点位图核心：符号、画布、导出、显示方案
src/plugins/            插件体系（AI 副驾、方案演示、名片等）
src/documents/          文档版式与打印组件
desktop/                Electron 桌面客户端（独立打包的子项目）
miniprogram/            微信小程序
output/plan-tool/       规划图工具（零依赖单页 SVG，不参与主站构建）
```

## 提交前必须全过

```bash
pnpm exec tsc --noEmit
pnpm exec oxfmt --check
pnpm exec eslint . --max-warnings 0
pnpm test
pnpm run knowledge:check
```

CI 用同一套（`.github/workflows/ci-selfhosted.yml`）。

## 协议

[MIT](./LICENSE) © 2026 繁梦空间智能信息技术。

第三方组件与素材可能有各自的授权，见 [NOTICE](./NOTICE)。仓库里部分 UI 参考了
[Meta Astryx](https://github.com/meta/astryx)（MIT）的官方模板，保留其原始版权头。
