# WORKLOG.md — 已完成记录

倒序，最新在上。每条：日期 / 做了什么 / 分支或 PR / 验证方式。

---

## 2026-11-08 · 会员分级移除 + 能力中心（owner 决策后实施）

- **PR #7** 取消会员分级 → 纯积分（Q1=删字段）：删 users.membershipTier/ExpiresAt、兑换码等级、
  模板/插件/模型 tier、membership-settings.enforcement；新增可回滚迁移；重生成类型；约 40 文件清理。
- **PR #8** 能力中心（第二大步）：侧边栏「插件」→「能力中心」（AI 能力/模板/工具）；
  删用户启停（开关 UI + toggle 路由）；插件加 category 分类；全站「插件市场」字样清零。
- 两 PR 均 CI **success**，已 squash 合并进 main。
- 刻意留后续：/plugins/templates 模板中心新页、/plugins URL 改名、点位图显示方案（全新功能）、
  getPluginFlags 的 28 处读取点语义改造。

## 2026-11-08 · 三个 PR 已合并进 main

- 自动化基建 Phase 0 → PR [#3](https://github.com/lynnliuyu/fmkj-figma-smart-design/pull/3)（squash）
- 两份架构提案 → PR [#5](https://github.com/lynnliuyu/fmkj-figma-smart-design/pull/5)（squash）
- Beta 文档回落 + 摘除四个已封存插件 → PR [#6](https://github.com/lynnliuyu/fmkj-figma-smart-design/pull/6)（squash）
- main 合并后 CI 结论：**success**（`39ae177`）
- 注：PR #4 因与已合并的文档提交冲突被替换为从最新 main cherry-pick 的 PR #6

## 2026-11-08 · 自动化基建 Phase 0

- 分支 `chore/automation-phase0`
- 规划文档入库（PROJECT-ARCHITECTURE.md / AUTOMATION-TEAM.md）
- AGENTS.md 追加团队协作与自动化段；新增 HEARTBEAT.md、memory/（learnings.jsonl）
- CI 修复：knowledge:check 在无 Figma 环境时必红（改用自托管配置垫片）；新增生产构建门禁；触发改为所有分支
- 验证：本地 tsc / knowledge:check(16 项) / importmap / build 全绿；GitHub Actions run 42392504736 与后续 run 均 **success**
