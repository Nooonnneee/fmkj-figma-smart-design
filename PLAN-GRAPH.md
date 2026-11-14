# 规划图（agent 可读摘要）

> 由 plan-tool 生成。**不要手改这份文件**——它每次从 JSON 重新生成。
> 要给图里加东西，写一份 add-only 补丁（格式见文末），交给 `node scripts/apply-patch.mjs`。

- 节点 73 个（AI 新增 47 个）
- 连线 32 条
- 生成于 2026-11-14 15:51:12

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
    - [功能] 设备类型 / 类别（11 个） `a-dt-categories`〔AI 补〕 — 11 个类别各带点位代号前缀（K/Z/L/S/D/V/C/G/N/AC/Q）；固定 11 类、系统维护不可增删改，保存产品时按设备类型自动带出。src/lib/device-types.ts:4,50-62；src/collections/Categories.ts:8,14,17-23；src/collections/Products.ts:37-53,84-88；代号复用见 src/board/packs/smart-home/ops.ts:51。
    - [功能] 按名称推断设备类型（点位导入 / 竞品报价） `a-dt-infer`〔AI 补〕 — inferDeviceType 按关键词匹配字典，用在点位导入和竞品报价文本解析，不参与 Products 创建。src/lib/device-types.ts:334；src/plugins/ai-import/point-import.ts:92；src/plugins/ai-copilot/tools/competitor-quote.ts:80。
  - [模块] 品牌 / 品类 `n-mwgbir9b-a`
    - [功能] 品牌库（brands） `a-brand-brands`〔AI 补〕 — 产品必填品牌；产品库品牌筛选的数据来源是 getBrands()，页面据此计数过滤。src/collections/Brands.ts:8-16；src/collections/Products.ts:76-81；src/lib/cached-data.ts:138；src/app/(frontend)/(workspace)/products/page.tsx:95,141。
- [业务域] 账号与积分 `n-mwgbir9b-b`
  - [模块] 成员账号 `n-mwgbir9b-c`
    - [功能] 品牌拿货折扣（按账号） `a-brand-cost`〔AI 补〕 — 按品牌设置，但存在每个成员自己的账号设置里，不是品牌属性；只用于本人报价台的内部成本与毛利，不打印。src/collections/Users.ts:137-142；src/lib/services/cost-settings-service.ts:98-102；src/app/(frontend)/(workspace)/settings/cost-settings.tsx:26,135；src/lib/quote-costs.ts:83。
    - [功能] 成员账号（users） `a-user-members`〔AI 补〕 — 后台由 CMS 管理员开通、停用即无法登录；Web 端开放自助注册（src/app/(frontend)/auth/register/route.ts:26、src/lib/app-auth.ts:241）；owner 2026-11-14 选定保留注册入口、改文档口径，决策记录将由 docs/plan-cleanup 分支并入 memory/learnings.jsonl:79，当前尚未进 main。现文档仍写「不开放」，待统一。src/collections/Users.ts:32-37,60-71（16-17 行注释仍写不开放，是待改的旧口径）；会话恢复见 src/lib/app-auth.ts:149，登录拦截见 src/lib/app-auth.ts:204-205。
    - [页面] 登录 / 注册页 `a-user-login`〔AI 补〕 — /login 与 /auth/*，走 app-session Cookie，与 Payload 后台 admins 登录完全分开。src/app/(frontend)/login/page.tsx:26,36；src/app/(frontend)/auth/login/route.ts:3；src/app/(frontend)/auth/register/route.ts:26；src/lib/app-auth.ts:121-149。
    - [功能] 个人抬头与默认设置 `a-user-profile`〔AI 补〕 — users.companyProfile 存每人独立的报价/合同抬头、Logo、二维码、文档模板，并内含「报价成本与毛利设置」costSettings；未填回退系统默认。src/collections/Users.ts:87-95,139-140；写入 src/app/(frontend)/(workspace)/settings/company/route.ts:104-126；被报价/合同读取 src/lib/services/quote-service.ts:122、src/lib/services/contract-service.ts:63,70。
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
    - [页面] 风格化页 /ai/image/style `a-style-page`〔AI 补〕 — 上传户型图选风格模板，保留墙体布局生成家具彩平图，需开启 ai-copilot 插件。src/app/(frontend)/(workspace)/ai/image/style/page.tsx:17-21,61；src/app/api/ai/images/style/route.ts:17,31。
    - [功能] 风格模板（10 套） `a-style-templates`〔AI 补〕 — 模板只是风格参考、不改变源户型布局；「不要改变墙线」的要求写在上游 prompt。src/lib/style-templates.ts:1,10；src/plugins/ai-copilot/style-transfer.ts:86-91。
    - [功能] 点位图 AI 精装彩平 `a-style-pointmap`〔AI 补〕 — 点位图顶栏就地开弹窗，带入当前楼层底图生成；结果只能下载、不回填画布，弹窗关闭即丢弃。src/app/(frontend)/(workspace)/projects/[id]/point-map/point-map-editor.tsx:1369,2698-2701；ai-style-dialog.tsx:101-107；src/app/(frontend)/(workspace)/ai/image/style/style-transfer.tsx:325-333。
  - [模块] AI 渠道配置 `n-mwgbir9b-m`
    - [功能] 内置渠道白名单（9 个） `a-channel-providers`〔AI 补〕 — DeepSeek / NewAPI / 硅基流动 / 百炼两档 / 方舟 / Kimi / 智谱 / OpenRouter，域名与密钥环境变量在服务端一对一绑定。src/plugins/ai-copilot/templates.ts:6-70。
    - [功能] 自定义渠道（OpenAI 兼容） `a-channel-custom`〔AI 补〕 — 只收公网 HTTPS 地址与 AI_ 前缀的密钥变量名，密钥本身不入库。字段定义 src/globals/AiSettings.ts:189-200；校验：key 仅字母数字-_ src/globals/AiSettings.ts:211-212，密钥变量名必须 AI_ 开头 src/globals/AiSettings.ts:228-230，地址必须公网 HTTPS（排除私网） src/globals/AiSettings.ts:235-245 与 src/plugins/ai-copilot/templates.ts:80,86。
    - [页面] AI 设置（/admin/globals/ai-settings） `a-channel-models`〔AI 补〕 — 仅 CMS 管理员可见可改：模型列表、峰谷价目与倍率、渠道测试与拉取模型。src/globals/AiSettings.ts:252-272；端点 /status /presets /test /models /models/add 见 src/globals/ai-settings-endpoints.ts:306,424,481,529,568。
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
- [数据] 产品库 `n-mwgbir9b-8` → 设备类型字典 `n-mwgbir9b-9`：产品 deviceType 取自字典，分类自动带出
- [调用] AI 识别导入 `a-pm-ai-import` → 按名称推断设备类型（点位导入 / 竞品报价） `a-dt-infer`：AI 识别按关键词推断设备类型
- [数据] 品牌 / 品类 `n-mwgbir9b-a` → 设备类型 / 类别（11 个） `a-dt-categories`：产品分类与设备类别一一对应且只读
- [数据] 产品库 `n-mwgbir9b-8` → 品牌库（brands） `a-brand-brands`：产品.brand 必填，指向 brands
- [依赖] 品牌拿货折扣（按账号） `a-brand-cost` → 个人抬头与默认设置 `a-user-profile`：品牌折扣按账号存在 users.companyProfile
- [数据] 积分与账单 `n-mwgbir9b-e` → 成员账号（users） `a-user-members`：积分流水回写 users.aiCredits
- [依赖] 成员账号（users） `a-user-members` → 项目协作 / 分享 `n-mwgbir9b-d`：协作者字段指向 users；成员通过分享链接 / 邀请页自行加入
- [调用] 登录 / 注册页 `a-user-login` → 成员账号（users） `a-user-members`：登录校验 users 集合与 status=active
- [数据] 个人抬头与默认设置 `a-user-profile` → 报价 `n-mwgbir9b-4`：报价与合同用项目 owner 的抬头
- [数据] 风格化页 /ai/image/style `a-style-page` → 风格模板（10 套） `a-style-templates`：页面读取模板清单与服务端配置
- [数据] 风格化页 /ai/image/style `a-style-page` → 积分与账单 `n-mwgbir9b-e`：每次生成扣 8 积分并记流水
- [调用] 点位图编辑器 `a-pm-editor` → 点位图 AI 精装彩平 `a-style-pointmap`：点位图顶栏带入当前楼层底图；结果仅可下载，不回填
- [依赖] 风格化页 /ai/image/style `a-style-page` → 插件注册 `n-mwgbir9b-p`：受 ai-copilot 插件开关控制
- [数据] AI 设置（/admin/globals/ai-settings） `a-channel-models` → 内置渠道白名单（9 个） `a-channel-providers`：模型列表的渠道下拉来自白名单
- [数据] AI 设置（/admin/globals/ai-settings） `a-channel-models` → 自定义渠道（OpenAI 兼容） `a-channel-custom`：模型可指向后台已保存的自定义渠道
- [调用] AI 对话 / 识图 `n-mwgbir9b-k` → AI 渠道配置 `n-mwgbir9b-m`：对话按 ai-settings 里的模型选渠道与密钥
- [数据] AI 渠道配置 `n-mwgbir9b-m` → 积分与账单 `n-mwgbir9b-e`：模型峰谷价目与倍率决定扣多少积分
- [依赖] AI 设置（/admin/globals/ai-settings） `a-channel-models` → 后台管理员 `a-perm-admin`：仅后台管理员可读改

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

节点类型：`domain`(业务域)、`module`(模块)、`feature`(功能)、`page`(页面)、`template`(模板)、`device`(设备)、`note`(便签)

连线类型：`route`(流程)、`call`(调用)、`data`(数据)、`dep`(依赖)

规矩：
- `id` 必须带前缀且全局唯一，建议用 `a-` 开头标明是 AI 加的
- `parentId` 必须是已有节点或本补丁里的节点
- `origin` 只能是 `agent`（不写会自动补上）
- 不写 `x`/`y` 时，会自动排在父节点下方

