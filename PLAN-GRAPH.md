# 规划图（agent 可读摘要）

> 由 plan-tool 生成。**不要手改这份文件**——它每次从 JSON 重新生成。
> 要给图里加东西，写一份 add-only 补丁（格式见文末），交给 `node scripts/apply-patch.mjs`。

- 节点 60 个（AI 新增 34 个）
- 连线 14 条
- 生成于 2026-11-14 11:45:13

## 结构

- [业务域] 业务主线 `n-mwgbir9b-1`
  - [模块] 项目 `n-mwgbir9b-2`
    - [页面] 项目列表 `a-proj-list`〔AI 补〕 — (workspace)/projects/page.tsx
    - [页面] 新建项目 `a-proj-new`〔AI 补〕 — projects/new；名称留空按小区+房号生成
    - [页面] 项目详情 `a-proj-detail`〔AI 补〕 — projects/[id]；五步入口都在这一页
    - [功能] 进度自动推导 `a-proj-stage`〔AI 补〕 — 没有手动阶段，由点位/报价/合同/归档数据推出
  - [模块] 点位图 `n-mwgbir9b-3`
    - [页面] 点位图编辑器 `a-pm-editor`〔AI 补〕 — projects/[id]/point-map；src/board/
    - [功能] AI 识别导入 `a-pm-ai-import`〔AI 补〕 — 插件 ai-import，stage=design；只信 drawing 不信 design
    - [功能] DWG 导入 `a-pm-dwg`〔AI 补〕 — 插件 dwg-import，stage=design
    - [功能] 房间智能分析 `a-pm-rooms`〔AI 补〕 — 插件 room-insights，stage=design
    - [功能] 智能选型 `a-pm-select`〔AI 补〕 — 插件 smart-select；按平台+预算档位选默认型号
  - [模块] 报价 `n-mwgbir9b-4`
    - [页面] 报价列表 / 详情 `a-quote-list`〔AI 补〕 — (workspace)/quotes 与 quotes/[id]
    - [功能] 四个打印模板 `a-quote-4tpl`〔AI 补〕 — 标准 / 图文 / 精简 / 分区，见 print/quotes/[id]
  - [模块] 合同 `n-mwgbir9b-5`
    - [页面] 合同页 `a-contract-page`〔AI 补〕 — projects/[id]/contract
    - [功能] 签订后锁定 `a-contract-lock`〔AI 补〕 — 合同与依据报价只读，只留收款登记
  - [模块] 归档 `n-mwgbir9b-6`
    - [页面] 归档页 `a-archive-page`〔AI 补〕 — projects/[id]/archive；归档后全链只读
- [业务域] 产品与数据 `n-mwgbir9b-7`
  - [模块] 产品库 `n-mwgbir9b-8`
    - [页面] 产品库页 `a-prod-list`〔AI 补〕 — (workspace)/products；728 产品
  - [模块] 设备类型字典 `n-mwgbir9b-9`
  - [模块] 品牌 / 品类 `n-mwgbir9b-a`
- [业务域] 账号与积分 `n-mwgbir9b-b`
  - [模块] 成员账号 `n-mwgbir9b-c`
  - [模块] 项目协作 / 分享 `n-mwgbir9b-d`
    - [功能] 协作者 / 分享链接 `a-collab-share`〔AI 补〕 — 项目 owner/edit/read；join/[id] 加入
  - [模块] 积分与账单 `n-mwgbir9b-e`
    - [功能] 积分流水 `a-credit-ledger`〔AI 补〕 — 集合 ai-credit-ledger；余额 = 期初 + 流水，见 verify-credit-ledger skill
    - [功能] 兑换码 `a-credit-redeem`〔AI 补〕 — 集合 redemption-codes
- [业务域] 展示与输出 `n-mwgbir9b-f`
  - [模块] 方案模板 `n-mwgbir9b-g`
    - [功能] 方案演示 `a-tpl-proposal`〔AI 补〕 — 插件 proposal；三个模板 A4 横版
    - [页面] 模板站 `a-tpl-page`〔AI 补〕 — templates/[slug] 与 slides，公开可看
  - [模块] 打印文档 `n-mwgbir9b-h`
    - [功能] 打印路由（10 条） `a-print-center`〔AI 补〕 — survey/wiring/plans/proposal/procurement/checklist/handover/after-sales + 报价 + 合同
    - [功能] 文档风格包 `a-print-tpl`〔AI 补〕 — 插件 doc-styles，stage=quote
  - [模块] 公开站点 `n-mwgbir9b-i`
    - [页面] 公开页（6 个） `a-site-pages`〔AI 补〕 — 首页 / 产品目录 / 品牌页 / 文档 / 下载 / 登录
    - [页面] 分享页 `a-site-share`〔AI 补〕 — share/[token]；客户免登录查看
- [业务域] AI 能力 `n-mwgbir9b-j`
  - [模块] AI 对话 / 识图 `n-mwgbir9b-k`
    - [功能] AI 侧栏对话 `a-ai-chat`〔AI 补〕 — 插件 ai-copilot；集合 ai-conversations / ai-messages
    - [页面] AI 工作台 `a-ai-page`〔AI 补〕 — (workspace)/ai 与 ai/image/style
  - [模块] 户型图风格化 `n-mwgbir9b-l`
  - [模块] AI 渠道配置 `n-mwgbir9b-m`
- [业务域] 平台与运维 `n-mwgbir9b-n`
  - [模块] 权限与角色 `n-mwgbir9b-o`
    - [功能] 项目三级角色 `a-perm-roles`〔AI 补〕 — owner / edit / read；成员只有一种角色
    - [功能] 后台管理员 `a-perm-admin`〔AI 补〕 — 集合 admins，与员工 users 完全分开
  - [模块] 插件注册 `n-mwgbir9b-p`
    - [功能] 插件清单（10 个） `a-plugin-registry`〔AI 补〕 — src/plugins/index.ts；按 category × stage 注册
    - [功能] 名片插件 `a-plugin-card`〔AI 补〕 — 插件 business-card；四套版式、300dpi 导出
    - [功能] 现场设备对接（HA-MCP） `a-plugin-ha`〔AI 补〕 — 插件 ha-mcp；AI 直连客户现场的智能家居
    - [页面] 能力中心 `a-cap-center`〔AI 补〕 — (workspace)/capabilities 与 [id]、tools、templates
  - [模块] 部署 / 备份 `n-mwgbir9b-q`
    - [功能] 客户反馈 `a-ops-feedback`〔AI 补〕 — 集合 client-feedback
    - [功能] 售后维保记录 `a-ops-service`〔AI 补〕 — 插件 after-sales；集合 service-records

## 连线

- [流程] 项目 `n-mwgbir9b-2` → 点位图 `n-mwgbir9b-3`
- [流程] 点位图 `n-mwgbir9b-3` → 报价 `n-mwgbir9b-4`
- [流程] 报价 `n-mwgbir9b-4` → 合同 `n-mwgbir9b-5`
- [流程] 合同 `n-mwgbir9b-5` → 归档 `n-mwgbir9b-6`
- [数据] 点位图 `n-mwgbir9b-3` → 设备类型字典 `n-mwgbir9b-9`：查类型
- [数据] 报价 `n-mwgbir9b-4` → 设备类型字典 `n-mwgbir9b-9`：同一字典
- [数据] 点位图编辑器 `a-pm-editor` → 项目 `n-mwgbir9b-2`：点位挂在项目下
- [数据] 报价 `n-mwgbir9b-4` → 点位图编辑器 `a-pm-editor`：报价从点位派生
- [数据] 合同 `n-mwgbir9b-5` → 报价 `n-mwgbir9b-4`：合同由报价生成
- [数据] 归档 `n-mwgbir9b-6` → 合同 `n-mwgbir9b-5`：归档读合同与报价
- [数据] AI 对话 / 识图 `n-mwgbir9b-k` → 积分与账单 `n-mwgbir9b-e`：每次 AI 调用扣积分
- [调用] 插件注册 `n-mwgbir9b-p` → AI 对话 / 识图 `n-mwgbir9b-k`：插件能力暴露给 AI 调用
- [调用] 打印文档 `n-mwgbir9b-h` → 报价 `n-mwgbir9b-4`：打印读报价数据
- [依赖] 分享页 `a-site-share` → 项目三级角色 `a-perm-roles`：分享遵循项目权限

## 怎么加东西（add-only 补丁）

补丁只允许新增。**修改或删除任何已有记录都会被整份拒绝**。

```json
{
  "add": {
    "nodes": [
      {
        "id": "a-example-1",
        "type": "module",
        "title": "新模块示例",
        "parentId": "n-xxx",
        "note": "一句话说明"
      },
      {
        "id": "a-example-2",
        "type": "feature",
        "title": "子功能示例",
        "parentId": "a-example-1"
      }
    ],
    "edges": [
      {
        "id": "a-edge-1",
        "type": "dep",
        "from": "a-example-1",
        "to": "n-yyy"
      }
    ]
  }
}
```

节点类型：`domain`(业务域)、`module`(模块)、`feature`(功能)、`page`(页面)、`device`(设备)、`template`(模板)、`note`(便签)

连线类型：`route`(流程)、`call`(调用)、`data`(数据)、`dep`(依赖)

规矩：
- `id` 必须带前缀且全局唯一，建议用 `a-` 开头标明是 AI 加的
- `parentId` 必须是已有节点或本补丁里的节点
- `origin` 只能是 `agent`（不写会自动补上）
- 不写 `x`/`y` 时，会自动排在父节点下方

