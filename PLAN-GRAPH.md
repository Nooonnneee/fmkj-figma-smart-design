# 规划图（agent 可读摘要）

> 由 plan-tool 生成。**不要手改这份文件**——它每次从 JSON 重新生成。
> 要给图里加东西，写一份 add-only 补丁（格式见文末），交给 `node scripts/apply-patch.mjs`。

- 节点 206 个（AI 新增 180 个）
- 连线 182 条
- 生成于 2026-11-14 18:05:49

## 结构

- [业务域] 业务主线 `n-mwgbir9b-1`
  - [模块] 项目 `n-mwgbir9b-2`
    - [页面] 项目列表 `a-proj-list`〔AI 补〕 — (workspace)/projects/page.tsx
    - [页面] 新建项目 `a-proj-new`〔AI 补〕 — projects/new；名称留空按小区+房号生成
    - [页面] 项目详情 `a-proj-detail`〔AI 补〕 — projects/[id]；五步入口都在这一页
    - [功能] 进度自动推导 `a-proj-stage`〔AI 补〕 — 没有手动阶段，由点位/报价/合同/归档数据推出
    - [功能] 状态：进行中 / 已归档 `a2-main-proj-status-1`〔AI 补〕 — 项目只有 active 进行中 / archived 已归档 两个状态，成员归档后只能改状态本身；归档时间随状态自动写入、恢复时清空。src/lib/projects.ts:22-25；src/collections/Projects.ts:57-64,151-153
    - [功能] 编辑信息 `a2-main-proj-edit-1`〔AI 补〕 — 项目信息页默认是只读档案 + 交付进度，点「编辑信息」才出表单，保存或取消回到展示视图。src/app/(frontend)/(workspace)/projects/[id]/project-overview.tsx:60-61,115；page.tsx:13
    - [功能] 转让负责人 `a2-main-proj-owner-1`〔AI 补〕 — 只有项目负责人能改 owner，且只能转给已加入的协作者；转让后原负责人自动留为「可编辑」协作者，不会失去访问权。src/collections/Projects.ts:105-130；src/lib/services/project-service.ts:80-97
    - [功能] 删除项目 `a2-main-proj-delete-1`〔AI 补〕 — 仅项目负责人可删；有已签订合同的项目禁止删除（提示改为归档），删除时连带删报价与未签合同、AI 对话只解绑。src/app/(frontend)/(workspace)/projects/actions.ts:45-85；delete-project.tsx:60,72-73
    - [功能] 示例项目（isDemoTemplate） `a2-main-proj-demo-1`〔AI 补〕 — CMS 勾选 isDemoTemplate 的母版项目在成员账号创建时自动克隆一份到其名下，项目列表也可手动「领取示例项目」。src/collections/Projects.ts:234-244；src/collections/Users.ts:44；src/lib/demo-project.ts:297；projects/page.tsx:195
    - [功能] 进行中 / 已归档筛选 `a2-main-proj-filter-1`〔AI 补〕 — 项目列表按 view=archived 切换两组，两个计数来自 status 查询；旧项目缺 pointCount 时列表一次查询补算，不读整张点位图。projects/page.tsx:50-72,111-123,251-264；project-data.ts:75-87
  - [模块] 点位图 `n-mwgbir9b-3`
    - [页面] 点位图编辑器 `a-pm-editor`〔AI 补〕 — projects/[id]/point-map；src/board/
    - [功能] AI 识别导入 `a-pm-ai-import`〔AI 补〕 — 插件 ai-import，stage=design；只信 drawing 不信 design
    - [功能] DWG 导入 `a-pm-dwg`〔AI 补〕 — 插件 dwg-import，stage=design
    - [功能] 房间智能分析 `a-pm-rooms`〔AI 补〕 — 插件 room-insights，stage=design
    - [功能] 智能选型 `a-pm-select`〔AI 补〕 — 插件 smart-select；按平台+预算档位选默认型号
    - [功能] 标定图纸比例 `a2-main-pm-calib-1`〔AI 补〕 — 画布工具「标定比例（C）」沿已知墙段拖线并输入实际米数得到 mmPerUnit；未标定时网格是中性网格、符号按固定尺寸落图。board-toolbar.tsx:53；src/board/core/paper.ts:20-36；src/board/core/types.ts:75
    - [功能] 智能生成点位 `a2-main-pm-gen-1`〔AI 补〕 — 按房间区域一键排布全屋智能与照明点位，会覆盖当前图纸已有点位并自动补齐房间区域，推入历史栈可撤销。point-map-editor.tsx:818；board-toolbar.tsx:425-426；src/board/packs/smart-home/ops.ts:352-355
    - [功能] 图纸裁切上传 `a2-main-pm-sheet-1`〔AI 补〕 — 上传户型图后在 SheetCropper 里裁掉图框和标题栏，等比放进 3:2 白底标准图纸（2400×1600）再存媒体库，场景只记图片地址。sheet-cropper.tsx:65；src/lib/sheet-spec.ts:5-10；point-map/sheets/route.ts:13-15,66
    - [功能] 显示方案（施工图 / 业主展示 / 技术交底 / 汇报演示） `a2-main-pm-display-1`〔AI 补〕 — 随项目保存的交付形态，决定方案模板里点位图有没有网格、覆盖圈和光晕；不要和只存浏览器的临时「显示设置」混用。display-profile-picker.tsx:25；src/lib/display-profile.ts:32-45；src/collections/Projects.ts:328-340
    - [功能] 项目默认型号 `a2-main-pm-default-1`〔AI 补〕 — 按设备类型给项目设默认产品，点位未指定产品时报价按它取型号；服务端校验类型在字典内、产品在售且类型一致。editor-panels.tsx:485；src/lib/project-defaults.ts:16-31；point-map/defaults/route.ts:6-17
    - [功能] 导出当前图纸 PNG / 画板 JSON `a2-main-pm-export-1`〔AI 补〕 — 画布工具栏两条前端导出：PNG 带图例与设备图标（含纸张尺寸），JSON 是整张画板数据；都不走后端打印路由。board-toolbar.tsx:365,375；point-map-editor.tsx:1057,1084
    - [功能] 点位图保存上限（190KB） `a2-main-pm-savecap-1`〔AI 补〕 — 保存时后端再压缩一次场景；内嵌 data: 图片超过 24KB 直接拒绝（要求先上传媒体库），整张点位图超过 190KB 也拒绝并提示拆楼层到新项目。point-map/data/route.ts:10-12,42,54-58
    - [功能] 本地草稿恢复 `a2-main-pm-draft-1`〔AI 补〕 — 有未保存修改时停手 1 秒把场景写进 localStorage（fmkj:pointmap:draft:<项目id>），重开发现同版本草稿时提示恢复，保存成功后清掉。point-map-editor.tsx:224,601-633,2082-2098
  - [模块] 报价 `n-mwgbir9b-4`
    - [页面] 报价列表 / 详情 `a-quote-list`〔AI 补〕 — (workspace)/quotes 与 quotes/[id]
    - [功能] 四个打印模板 `a-quote-4tpl`〔AI 补〕 — 标准 / 图文 / 精简 / 分区，见 print/quotes/[id]
    - [功能] 报价状态：草稿 / 已发送 / 已确认 `a2-main-quote-status-1`〔AI 补〕 — 状态只有 draft 草稿 / sent 已发送 / accepted 已确认，保存时服务端按白名单校验；「已确认」才在报价台出现「生成合同」入口。src/lib/quotes.ts:3-7；src/lib/services/quote-service.ts:282-285；quote-editor.tsx:804-812
    - [功能] 从点位图生成报价 `a2-main-quote-gen-1`〔AI 补〕 — 按统计范围（全部 / 不含灯具 / 仅开关…）把点位汇总成草稿报价：点位指定产品优先、其次项目默认型号，未匹配的记 pending 不计价。quote-controls.tsx:28,43-57；src/lib/services/quote-service.ts:75-146
    - [功能] 从点位图同步 `a2-main-quote-sync-1`〔AI 补〕 — 把点位图最新数量同步进已有报价，保留临时改价、换过的同类型号、附加费用、优惠与备注；范围默认从标题推断。quote-editor.tsx:576,1011；src/lib/services/quote-service.ts:156-251
    - [功能] 逐行更换型号 `a2-main-quote-swap-1`〔AI 补〕 — 报价行换型号只列同设备类型的在售产品（可按品牌/平台筛），可整类一起换，还能顺手设为项目默认型号；服务端拒绝跨类型和下架产品。swap-product-dialog.tsx:29,54-60；quote-service.ts:326-333；quote-editor.tsx:328
    - [功能] 设为定稿报价 `a2-main-quote-final-1`〔AI 补〕 — 把项目里某份报价标成定稿，交付资料包与方案默认用它；定稿取值顺序是 合同依据 → 手动定稿 → 已接受 → 最新。set-final-button.tsx:13,31-39；src/lib/deliverables.ts:19-31；deliverables-service.ts:14-36
    - [功能] 业主意向反馈处理 `a2-main-quote-feedback-1`〔AI 补〕 — 业主在免登录分享页勾「暂缓」并签名提交的意向反馈显示在报价页顶部，可标记已处理或「按意向生成调整版」（复制原报价、去掉暂缓项，原报价不动）。client-feedback-list.tsx:33,50-53,151-160；client-feedback-service.ts:227,251
    - [功能] 已签合同引用的报价锁定 `a2-main-quote-lock-1`〔AI 补〕 — 报价被已签订合同引用时禁止修改（提示先撤销签订），被任何合同引用时禁止删除；归档项目上的报价也由同一守卫拦下。src/collections/Quotes.ts:62-72,86-102；src/lib/project-guards.ts:6-29
    - [页面] /print/quotes/[id] 报价单打印 `a2-main-quote-print-1`〔AI 补〕 — 给客户的 A4 纵向报价单，一条路由承载 6 种版式（分区 / 标准 / 图文 / 精简 / 按系统 / 预算概览）× 风格，可导出 PDF 与图片。src/app/(frontend)/print/quotes/[id]/page.tsx:46；src/documents/registry.ts:13-31
  - [模块] 合同 `n-mwgbir9b-5`
    - [页面] 合同页 `a-contract-page`〔AI 补〕 — projects/[id]/contract
    - [功能] 签订后锁定 `a-contract-lock`〔AI 补〕 — 合同与依据报价只读，只留收款登记
    - [功能] 合同状态：待签订 / 已签订 `a2-main-contract-status-1`〔AI 补〕 — 两档状态 draft 待签订 / signed 已签订；签订日期跟随状态自动写（签订时默认当天，撤销签订清空），也可在签订弹窗填实际日期。src/lib/contracts.ts:3-6；src/collections/Contracts.ts:142-144；contract-service.ts:198-224
    - [功能] 从报价生成合同 `a2-main-contract-create-1`〔AI 补〕 — 每个项目只能有一份合同，选本项目一份报价生成，带入金额、甲方资料、地址、默认付款方式/工期/质保/条款；编号留空按 HT+日期-序号 自动生成。contract-editor.tsx:23-75；contract-service.ts:30-101；src/collections/Contracts.ts:26-42,97-104
    - [功能] 标记为已签订 / 撤销签订 `a2-main-contract-sign-1`〔AI 补〕 — 合同顶部的签订操作，可先选签订日期再确认；签订后合同与依据报价都锁，撤销签订后才恢复可编辑，已签订合同不能删除。contract-preview.tsx:477,531-586；src/collections/Contracts.ts:163
    - [功能] 登记收款 `a2-main-contract-pay-1`〔AI 补〕 — 签订后唯一还能改的是各期「已收款」勾选，期数、名称、比例随合同一起锁定。contract-preview.tsx:99-100,322,431；contract-service.ts:135-144；src/collections/Contracts.ts:129-140
    - [功能] 付款比例合计 100%（最多 6 期） `a2-main-contract-ratio-1`〔AI 补〕 — 付款方式最多 6 期，比例合计必须 100%，集合 hook 与服务层各校验一次；各期金额按比例算、最后一期补齐分位误差。src/collections/Contracts.ts:122-125,238；contract-service.ts:165-167；src/lib/contracts.ts:40-47
    - [功能] 合同约束：一份 / 不可换项目 / 已签不可删 `a2-main-contract-guard-1`〔AI 补〕 — 合同与项目一对一（project unique）、生成后不能改挂到别的项目、报价必须属于同项目、已签订禁止删除，都在集合 hook 里，后台也绕不过。src/collections/Contracts.ts:93-104,163
    - [页面] /print/contracts/[id] 合同打印 `a2-main-contract-print-1`〔AI 补〕 — 带报价附件的合同打印页，4 种版式（含报价附件 / 仅正文 / 正式版 / 订单确认书），附件另起一页。print/contracts/[id]/page.tsx:13-17；src/documents/registry.ts:42-58
    - [功能] 合同分区编辑 `a2-main-contract-edit-1`〔AI 补〕 — 合同页显示与导出完全一致的预览，鼠标移到某一段点「编辑」只改那一段（编号 / 甲方 / 金额工期质保 / 付款方式 / 其他约定）。contract-preview.tsx:49-61,82,100；contract/page.tsx:25-26
  - [模块] 归档 `n-mwgbir9b-6`
    - [页面] 归档页 `a-archive-page`〔AI 补〕 — projects/[id]/archive；归档后全链只读
    - [功能] 归档 / 恢复项目 `a2-main-archive-toggle-1`〔AI 补〕 — 归档把项目 status 改为 archived 并自动记归档时间，恢复为 active 时清空；成员在归档态只能改状态字段，其余一律拒绝。archive-button.tsx:12,38；archive/actions.ts:15-32；src/collections/Projects.ts:57-64,133-153
    - [功能] 归档前资料核对 `a2-main-archive-ready-1`〔AI 补〕 — 归档页四项检查：有点位、有定稿报价（合同依据/手动定稿/已确认）、合同已签订、各期收款已收齐；四项齐了归档按钮才转成主操作。archive/page.tsx:189-228,383-389
    - [功能] 交付资料包（ZIP / 合并 PDF） `a2-main-archive-package-1`〔AI 补〕 — 勾选单据后用隐藏框架逐份打开打印页收集 PDF 页，再下载 ZIP 或合成一份 PDF；路线有点位图、交底清单、定稿报价、方案、合同，插件开启时加施工交底/售后维保卡。archive/page.tsx:239-303,335；delivery-package.tsx:87,133,217；src/lib/doc-collect.ts:1-10
    - [功能] 业主分享链接设置（有效期 / 访问密码） `a2-main-archive-share-1`〔AI 补〕 — 归档页可改链接开关、有效期与访问密码；密码只存 sha256 摘要不回显，有效期已过期时开启链接直接拒绝。share-settings.tsx:27,32,87,102；share-settings-service.ts:40-107
    - [功能] 复制业主预览链接 /share/[token] `a2-main-archive-link-1`〔AI 补〕 — 链接开启后一键复制 /share/<token> 发给客户，客户免登录就能对比方案、勾暂缓设备并签名提交意向。copy-client-link.tsx:43；archive/page.tsx:330-332；share/[token]/page.tsx:272
    - [功能] 案例晒单海报（3:4 图组） `a2-main-archive-poster-1`〔AI 补〕 — 用点位图与定稿报价生成小红书/朋友圈 3:4 多图晒单，只用小区名或项目简称，自动隐藏业主姓名电话门牌。social-poster-dialog.tsx:55,162,182；archive/page.tsx:330,135-176
    - [功能] 选定交付资料（定稿报价 / 交付方案模板） `a2-main-archive-deliver-1`〔AI 补〕 — 归档页的交付资料选择：定稿报价被合同依据时锁定不可改，方案模板只能选业主方案（施工交底单独生成）。archive/page.tsx:344-360；template-picker-field.tsx:12；deliverables-service.ts:14-36
    - [功能] 归档后全链只读 `a2-main-archive-readonly-1`〔AI 补〕 — 项目归档后点位图只读（readOnly 由 getProject 推出），报价与合同保存前都要过 assertProjectEditable，抛「项目已归档，恢复项目后才能修改」。project-data.ts:88-97；src/lib/project-guards.ts:6-29；src/collections/Quotes.ts:64；src/collections/Contracts.ts:95
- [业务域] 产品与数据 `n-mwgbir9b-7`
  - [模块] 产品库 `n-mwgbir9b-8`
    - [页面] 产品库页 `a-prod-list`〔AI 补〕 — (workspace)/products；728 产品
    - [功能] 产品库筛选维度 `a2-data-prod-filter-1`〔AI 补〕 — 列表按 q/cat/type/brand/platform/min/max/status/img/sort/page 共 10 个查询参数过滤，品牌可多选、支持价格区间与有无图。src/app/(frontend)/(workspace)/products/page.tsx:68,106-122
    - [功能] 品牌筛选计数与折叠 `a2-data-prod-counts-2`〔AI 补〕 — 侧栏按当前筛选条件给每个品牌算命中数，只显示有货品牌，前 10 个常驻、其余折叠；页头同时显示在售产品数与品牌总数。src/app/(frontend)/(workspace)/products/page.tsx:135-142,210-214,241-244
    - [功能] 产品库整库导出 / 导入 `a2-data-prod-dump-3`〔AI 补〕 — products 与 media、brands、categories 等一起按依赖顺序整库 dump/灌入，是当前唯一的产品批量搬运手段（无 CSV 导入页）。scripts/data-export.ts:18,28；scripts/data-import.ts:26
    - [功能] 产品图片托管 `a2-data-prod-image-4`〔AI 补〕 — 产品图片是 media 上传关系，自托管下按 S3 或本地 media 目录二选一存储，超大图带 width 参数由 sharp 转 WebP。src/collections/Products.ts:99；src/collections/Media.ts:9-15；src/payload.selfhost.config.ts:21,33-39,78-86
    - [功能] 产品编辑权限 `a2-data-prod-access-5`〔AI 补〕 — 成员可新增、改价、改产品（2026-11-13 owner 批准），删除只允许 CMS 管理员；空态文案也写明这一口径。src/collections/Products.ts:28-35；src/app/(frontend)/(workspace)/products/page.tsx:363
  - [模块] 设备类型字典 `n-mwgbir9b-9`
    - [功能] 设备类型 / 类别（11 个） `a-dt-categories`〔AI 补〕 — 11 个类别各带点位代号前缀（K/Z/L/S/D/V/C/G/N/AC/Q）；固定 11 类、系统维护不可增删改，保存产品时按设备类型自动带出。src/lib/device-types.ts:4,50-62；src/collections/Categories.ts:8,14,17-23；src/collections/Products.ts:37-53,84-88；代号复用见 src/board/packs/smart-home/ops.ts:51。
    - [功能] 按名称推断设备类型（点位导入 / 竞品报价） `a-dt-infer`〔AI 补〕 — inferDeviceType 按关键词匹配字典，用在点位导入和竞品报价文本解析，不参与 Products 创建。src/lib/device-types.ts:334；src/plugins/ai-import/point-import.ts:92；src/plugins/ai-copilot/tools/competitor-quote.ts:80。
    - [功能] 设备类型清单（34 项） `a2-data-dt-types-1`〔AI 补〕 — 11 个类别下共 34 个设备类型，产品 deviceType 下拉与校验都取自这份常量。src/lib/device-types.ts:77-290,297-298,328-331
    - [功能] 点位图标（30 个 SVG） `a2-data-dt-symbols-2`〔AI 补〕 — 每个设备类型带一个 SymbolKey，图标是 public/point-symbols/<key>.svg，点位列与产品卡片共用。src/lib/device-types.ts:9-40,343,344-345；src/components/device-symbol.tsx:2,21
    - [功能] 字典顺序与类别分组 `a2-data-dt-order-3`〔AI 补〕 — 展示面板、下拉、统计统一按类别 sortOrder 再按开关键数排序，DEVICE_GROUPS 是产品库侧栏的类别数据源。src/lib/device-types.ts:307-326
  - [模块] 品牌 / 品类 `n-mwgbir9b-a`
    - [功能] 品牌库（brands） `a-brand-brands`〔AI 补〕 — 产品必填品牌；产品库品牌筛选的数据来源是 getBrands()，页面据此计数过滤。src/collections/Brands.ts:8-16；src/collections/Products.ts:76-81；src/lib/cached-data.ts:138；src/app/(frontend)/(workspace)/products/page.tsx:95,141。
    - [功能] 品牌 Logo（brands.logo） `a2-data-brand-logo-1`〔AI 补〕 — 品牌可挂一张 media Logo，采购与备货核验单按品牌分组时直接打印它。src/collections/Brands.ts:24；src/app/(frontend)/print/projects/[id]/procurement/page.tsx:68-74,192
    - [功能] 品牌维护权限 `a2-data-brand-access-2`〔AI 补〕 — 成员只读品牌，新增/改/删品牌都只允许 CMS 管理员，产品库只能选现有品牌。src/collections/Brands.ts:11-16
    - [功能] 公开页品牌墙 `a2-data-brand-landing-3`〔AI 补〕 — 首页品牌墙用 public/brands/<slug>.webp 原色版与 <slug>-mono.webp 单色版两套图，数量文案取产品库统计。src/components/landing/brand-logos.ts:3,8,37-38；src/components/landing/library-section.tsx:38,46,57
- [业务域] 账号与积分 `n-mwgbir9b-b`
  - [模块] 成员账号 `n-mwgbir9b-c`
    - [功能] 品牌拿货折扣（按账号） `a-brand-cost`〔AI 补〕 — 按品牌设置，但存在每个成员自己的账号设置里，不是品牌属性；只用于本人报价台的内部成本与毛利，不打印。src/collections/Users.ts:137-142；src/lib/services/cost-settings-service.ts:98-102；src/app/(frontend)/(workspace)/settings/cost-settings.tsx:26,135；src/lib/quote-costs.ts:83。
    - [功能] 成员账号（users） `a-user-members`〔AI 补〕 — 后台由 CMS 管理员开通、停用即无法登录；Web 端开放自助注册（src/app/(frontend)/auth/register/route.ts:26、src/lib/app-auth.ts:241）；owner 2026-11-14 选定保留注册入口、改文档口径，决策记录将由 docs/plan-cleanup 分支并入 memory/learnings.jsonl:79，当前尚未进 main。现文档仍写「不开放」，待统一。src/collections/Users.ts:32-37,60-71（16-17 行注释仍写不开放，是待改的旧口径）；会话恢复见 src/lib/app-auth.ts:149，登录拦截见 src/lib/app-auth.ts:204-205。
    - [页面] 登录 / 注册页 `a-user-login`〔AI 补〕 — /login 与 /auth/*，走 app-session Cookie，与 Payload 后台 admins 登录完全分开。src/app/(frontend)/login/page.tsx:26,36；src/app/(frontend)/auth/login/route.ts:3；src/app/(frontend)/auth/register/route.ts:26；src/lib/app-auth.ts:121-149。
    - [功能] 个人抬头与默认设置 `a-user-profile`〔AI 补〕 — users.companyProfile 存每人独立的报价/合同抬头、Logo、二维码、文档模板，并内含「报价成本与毛利设置」costSettings；未填回退系统默认。src/collections/Users.ts:87-95,139-140；写入 src/app/(frontend)/(workspace)/settings/company/route.ts:104-126；被报价/合同读取 src/lib/services/quote-service.ts:122、src/lib/services/contract-service.ts:63,70。
    - [功能] 账号状态（启用 / 停用） `a2-data-user-status-1`〔AI 补〕 — status 只有 active/disabled 两值，仅 CMS 管理员可改；停用后登录直接被拒、已有项目保留。src/collections/Users.ts:59-71；src/lib/app-auth.ts:204-205
    - [功能] users 与 admins 账号隔离 `a2-data-user-isolation-2`〔AI 补〕 — 成员不能进 /admin（access.admin=false），CMS 管理员只存在于 admins 集合且不可新建，后台登录用户固定为 admins。src/collections/Users.ts:15-19,32-38；src/collections/Admins.ts:5-12；src/payload.shared.ts:41-42
    - [功能] 成员资料只能读改自己 `a2-data-user-selfread-3`〔AI 补〕 — users 的 read/update 收窄为本人 id，防止 /api/users 遍历他人邮箱手机号，管理员除外。src/collections/Users.ts:8-13,35-37
    - [功能] 新成员自动克隆示例项目 `a2-data-user-demo-4`〔AI 补〕 — 账号创建后钩子复制一份示例母版项目给该成员（owner 是本人，可改可删），项目列表立即可用。src/collections/Users.ts:39-47；src/lib/demo-project.ts:293-300
    - [功能] 成员会话有效期 `a2-data-user-session-5`〔AI 补〕 — 成员登录令牌 7 天过期、登录尝试次数不锁定，与 admins 的后台会话各走各的。src/collections/Users.ts:28-31；src/lib/app-auth.ts:149
  - [模块] 项目协作 / 分享 `n-mwgbir9b-d`
    - [功能] 协作者 / 分享链接 `a-collab-share`〔AI 补〕 — 项目 owner/edit/read；join/[id] 加入
    - [功能] 协作者 read / edit 两级 `a2-data-collab-role-1`〔AI 补〕 — collaborators 数组每人只有 read 或 edit，edit 才能改项目（403 拦截），owner 才能改负责人字段。src/lib/project-access.ts:6-7,141-147；src/collections/Projects.ts:99-104,297-323
    - [功能] 分享链接有效期 `a2-data-collab-expiry-2`〔AI 补〕 — shareConfig.expiresAt 为空即永不过期，过期后客户看到「这个链接已经过期」而不是 404；开着过期链接会被保存接口直接拒绝。src/lib/project-access.ts:51-56；src/lib/services/share-settings-service.ts:66-73,89-91；src/app/(frontend)/share/[token]/share-gate.tsx:5-9
    - [功能] 分享访问密码 `a2-data-collab-password-3`〔AI 补〕 — 密码只存 sha256 摘要，校验通过后写一条用 PAYLOAD_SECRET 签名的 per-token cookie，改密码即需重新输入。src/lib/project-access.ts:58-70；src/app/(frontend)/share/[token]/actions.ts:24,35,49,68,95
    - [页面] 加入协作页 /join/[id] `a2-data-collab-join-4`〔AI 补〕 — 带 token 的邀请页校验链接后让已有成员登录并把自己写进 collaborators，不开放陌生访客注册；edit 链接可把已有 read 升级为 edit。src/app/(frontend)/join/[id]/page.tsx:42-46；src/app/(frontend)/join/[id]/accept/route.ts:8-12,56-78
    - [功能] 协作链接 token 与重置 `a2-data-collab-token-5`〔AI 补〕 — token 存在 projects.shareConfig 里且字段级仅 CMS 管理员可读，分享对话框可复制或重置（旧链接立即失效）。src/collections/Projects.ts:342-353；src/app/(frontend)/(workspace)/projects/[id]/project-share-dialog.tsx:80-81,300-302
  - [模块] 积分与账单 `n-mwgbir9b-e`
    - [功能] 积分流水 `a-credit-ledger`〔AI 补〕 — 集合 ai-credit-ledger；余额 = 期初 + 流水，见 verify-credit-ledger skill
    - [功能] 兑换码 `a-credit-redeem`〔AI 补〕 — 集合 redemption-codes
    - [功能] 余额计算与行锁 `a2-data-credit-balance-1`〔AI 补〕 — 余额只能由新增流水改变：beforeChange 加 SELECT FOR UPDATE 算 balanceAfter（不足抛 402），afterChange 回写 users.aiCredits。src/collections/AiCreditLedger.ts:16-30,55-83
    - [功能] 兑换码核销流程 `a2-data-credit-redeemflow-2`〔AI 补〕 — 读码、改 usedCount/redeemedBy、写积分流水在同一事务并锁码行；支持一码多用但每账号限兑一次、可设截止时间，用完自动置 disabled。src/lib/services/membership-service.ts:41,59-60,67-99,126-140；src/collections/RedemptionCodes.ts:85-121
    - [功能] 积分任务（5 项） `a2-data-credit-tasks-3`〔AI 补〕 — 绑定邮箱/绑定微信各 10 分，关注公众号、完善抬头、首份报价各 5 分；按 user+reason 查重保证终生一次，奖励同样落到积分流水。src/lib/credit-tasks.ts:22-63,72-85,158-167
    - [功能] AI 对话计费链路 `a2-data-credit-chatbill-4`〔AI 补〕 — 按峰谷价 × 倍率折算（1 积分=0.1 元，最少 1 分）+ 工具调用费，回复先以 cost=0 落库、扣费成功再回写，记账基础设施失败不扣费。src/plugins/ai-copilot/billing.ts:1-20,38-42,54,104-107；src/plugins/ai-copilot/reply-billing.ts:30-37；src/globals/AiSettings.ts:128,135-175
    - [功能] AI 生图 / 风格化计费 `a2-data-credit-imagebill-5`〔AI 补〕 — 生图按模型 cost（千问图像 3.0 Pro 5 分）扣，户型图风格化固定 8 分，先查余额不足直接拦回。src/plugins/ai-copilot/image-generation.ts:13-17；src/plugins/ai-copilot/style-transfer.ts:17；src/app/api/ai/images/route.ts:76-84；src/app/api/ai/images/style/route.ts:63-83
    - [页面] 会员与积分页 /membership `a2-data-credit-page-6`〔AI 补〕 — 登录后展示余额、最近 30 条流水、可领任务与兑换码输入框，充值说明来自后台会员设置（已取消会员分级）。src/app/(frontend)/(workspace)/membership/page.tsx:10-49；src/app/(frontend)/(workspace)/membership/redeem/route.ts:6-13；src/lib/membership-policy.ts:9-18
- [业务域] 展示与输出 `n-mwgbir9b-f`
  - [模块] 方案模板 `n-mwgbir9b-g`
    - [功能] 方案演示 `a-tpl-proposal`〔AI 补〕 — 插件 proposal；三个模板 A4 横版
    - [页面] 模板站 `a-tpl-page`〔AI 补〕 — templates/[slug] 与 slides，公开可看
    - [功能] 版式框架（4 种） `a2-data-tpl-frameworks-1`〔AI 补〕 — 模板=版式框架×视觉主题：完整提案 8 章、场景故事 7 章、预算速览 4 章、施工交底（无价格），章节顺序由框架固定。src/plugins/proposal/framework.ts:97-129
    - [功能] DECK_THEMES 视觉主题（10 套） `a2-data-tpl-themes-2`〔AI 补〕 — 栖序雅致/墨金臻选/原木自然/晨岚现代/赤陶中古/素白极简/晨曦暖调/东方雅韵/海盐柔雅/岩灰建筑，后台模板的下拉即这份清单。src/plugins/proposal/deck/themes.ts:224-235,269；src/collections/ProposalTemplates.ts:11-21
    - [功能] 内置模板（12 套） `a2-data-tpl-builtin-3`〔AI 补〕 — 11 套业主方案 + 1 套施工交底作为兜底，后台无启用模板时直接用；后台同标识记录会覆盖内置文案。src/plugins/proposal/templates.ts:68-141,144-146；src/plugins/proposal/registry.ts:25-40
    - [功能] 模板如何应用到项目 `a2-data-tpl-apply-4`〔AI 补〕 — 选定模板写进 projects.proposalTemplate，打印页优先取 ?template= 再取项目保存值，都没有才回落默认 qixu。src/collections/Projects.ts:264-270；src/app/(frontend)/print/projects/[id]/proposal/page.tsx:92-95；src/app/(frontend)/(workspace)/projects/[id]/archive/page.tsx:180-184
    - [功能] 缩略图与样张生成 `a2-data-tpl-thumb-5`〔AI 补〕 — 缩略图与样张是模板定义实时渲染（后台编辑页顶部预览、选择器、/templates 共用），只有 OG 分享卡才跑脚本截图到 public/proposal-templates。src/plugins/proposal/preview.tsx:94-120；src/components/admin/template-preview-field.tsx:8-15；scripts/generate-template-thumbnails.mjs:9-20；src/app/(frontend)/templates/[slug]/page.tsx:27-31
    - [功能] 方案页画布 1440×960 与 A4 横版换算 `a2-data-tpl-canvas-6`〔AI 补〕 — 业主方案按 1440×960 设计稿排版、打印时 zoom 0.7795 落到横版纸面，只有施工交底直接按 297×210mm 排。src/plugins/proposal/deck/parts.tsx:33,54；src/plugins/proposal/preview.tsx:26-30；src/plugins/proposal/construction-deck.tsx:38
  - [模块] 打印文档 `n-mwgbir9b-h`
    - [功能] 打印路由（10 条） `a-print-center`〔AI 补〕 — survey/wiring/plans/proposal/procurement/checklist/handover/after-sales + 报价 + 合同
    - [功能] 文档风格包 `a-print-tpl`〔AI 补〕 — 插件 doc-styles，stage=quote
    - [页面] 现场勘测确认单 `a2-data-print-survey-1`〔AI 补〕 — 给客户与勘测工程师现场核查全屋强弱电、网络、窗帘盒与安装条件，成员登录后打开 /print/projects/[id]/survey。src/app/(frontend)/print/projects/[id]/survey/page.tsx:22,115,137,164,67
    - [页面] 强弱电布线与水电交底单 `a2-data-print-wiring-2`〔AI 补〕 — 给水电施工与现场复核使用，按房间列布线与预留规范并留施工负责人签字位。src/app/(frontend)/print/projects/[id]/wiring/page.tsx:25,245,284,447
    - [页面] 点位图打印页 `a2-data-print-plans-3`〔AI 补〕 — 给安装与交底看：每张图纸一页带点位与图例，末页附点位统计；点位为空时不出图。src/app/(frontend)/print/projects/[id]/plans/page.tsx:29,136-137,237-238
    - [页面] 智能家居方案 `a2-data-print-proposal-4`〔AI 补〕 — 给业主的横版方案演示，按模板（章节+主题）渲染，受 proposal 插件开关控制，未开启直接 404。src/app/(frontend)/print/projects/[id]/proposal/page.tsx:30,33,72
    - [页面] 采购与备货核验单 `a2-data-print-procurement-5`〔AI 补〕 — 给内部采购与到场开箱核验：按品牌分组列设备与库存，可用 ?cost= 切换「含内部成本 / 隐藏成本（到场核验）」两种版本。src/app/(frontend)/print/projects/[id]/procurement/page.tsx:28,49,104-106,136
    - [页面] 点位交底清单 `a2-data-print-checklist-6`〔AI 补〕 — 给安装团队逐点打勾，可按房间/设备/图纸三种排法，支持点位范围 scope 过滤。src/app/(frontend)/print/projects/[id]/checklist/page.tsx:35,64-66,108,156-157
    - [页面] 场景与账号交付移交单 `a2-data-print-handover-7`〔AI 补〕 — 给业主的交付件：账号与全屋网络交接、主控节点位置、联动场景卡与现场验收确认；没有点位值时给空态。src/app/(frontend)/print/projects/[id]/handover/page.tsx:26,96-99,108-109,130,263
    - [页面] 售后维保卡与配置备份单 `a2-data-print-aftersales-8`〔AI 补〕 — 给业主与售后看：质保权益、全屋设备台账与维保记录，受 after-sales 插件开关控制。src/app/(frontend)/print/projects/[id]/after-sales/page.tsx:30,58,122-123,173,219
    - [页面] 报价单打印页 `a2-data-print-quote-9`〔AI 补〕 — 给客户的 A4 纵向报价单，6 种版式（分区/标准/图文/精简/按系统/预算概览）×风格，产品图是否显示取决于本人 companyProfile.printProductImages。src/app/(frontend)/print/quotes/[id]/page.tsx:35,43,138-142
    - [页面] 合同打印页 `a2-data-print-contract-10`〔AI 补〕 — 给客户签字的 A4 纵向合同，4 种版式（含报价附件/仅正文/正式版/订单确认书）。src/app/(frontend)/print/contracts/[id]/page.tsx:11,14,59
    - [功能] 打印工具条（导出 PDF / 图片） `a2-data-print-toolbar-11`〔AI 补〕 — 每个打印页顶部工具条切版式与风格、按 data-export-page 节点导出 PDF 或图片，支持 auto=pdf 自动导出和 auto=collect 回传资料包。src/components/print-toolbar.tsx:48-52,117-127
    - [功能] 文档版式与风格包 `a2-data-print-layouts-12`〔AI 补〕 — DOC_KINDS 定义报价/点位图/合同/交底清单的版式集合，风格由 doc-styles 插件提供的 6 套样式叠加，默认值取本人 documentDefaults。src/documents/registry.ts:9-69,95-113；src/plugins/doc-styles/styles.ts:179-186；src/lib/cached-data.ts:345-346
  - [模块] 公开站点 `n-mwgbir9b-i`
    - [页面] 公开页（6 个） `a-site-pages`〔AI 补〕 — 首页 / 产品目录 / 品牌页 / 文档 / 下载 / 登录
    - [页面] 分享页 `a-site-share`〔AI 补〕 — share/[token]；客户免登录查看
    - [页面] 首页 / `a2-data-site-home-1`〔AI 补〕 — 免登录可见，用示例母版项目实时演示点位图、方案、报价与交付文档，带 canonical 与站点级 OG 图。src/app/(frontend)/page.tsx:24-37；src/app/(frontend)/layout.tsx:34-68
    - [页面] 图例与产品库 /catalog `a2-data-site-catalog-2`〔AI 补〕 — 免登录看 11 大系统图例与各系统代表在售型号，明确不显示内部成本，完整产品库需登录。src/app/(frontend)/catalog/page.tsx:30-35,129,136
    - [页面] 品牌标识 /brand `a2-data-site-brand-3`〔AI 补〕 — 免登录的品牌资源页：标识、应用图标、品牌色与规范，提供 SVG/PNG 下载。src/app/(frontend)/brand/page.tsx:12-16,58-59
    - [页面] 文档中心 /docs `a2-data-site-docs-4`〔AI 补〕 — 免登录的用户文档，覆盖五步工作流、点位画板、报价联动与 AI 计费规则，模型清单按当前启用的 AI 模型生成。src/app/(frontend)/docs/page.tsx:10-24
    - [页面] 下载桌面客户端 /download `a2-data-site-download-5`〔AI 补〕 — 免登录下载 Windows / macOS 客户端，固定地址 /downloads/desktop/latest/{windows|mac-arm64|mac-x64} 跳当前版本。src/app/(frontend)/download/page.tsx:21-25,92-165；src/app/(frontend)/downloads/desktop/latest/[target]/route.ts:10-20
    - [功能] 站点级 SEO / OG `a2-data-site-seo-6`〔AI 补〕 — 全站 metadata 走 siteUrl() 生成 metadataBase，默认分享图 /brand/fmkj-og.png，另有无 cookie 的 robots.ts 与 sitemap.ts 只列 6 个公开页。src/app/(frontend)/layout.tsx:26-68；src/lib/site-url.ts:21-28；src/app/robots.ts:11-30；src/app/sitemap.ts:5-42
    - [功能] 免登录边界 `a2-data-site-boundary-7`〔AI 补〕 — 免登录只有首页/catalog/brand/docs/download 与客户分享页；工作台整层由 layout 拦登录，打印页各自 redirect /login，robots 对 /projects /products /print /share /join 等一律 disallow。src/app/(frontend)/(workspace)/layout.tsx:13-17；src/app/robots.ts:11-27；src/app/(frontend)/print/quotes/[id]/page.tsx:56；src/app/(frontend)/share/[token]/page.tsx:271-285
- [业务域] AI 能力 `n-mwgbir9b-j`
  - [模块] AI 对话 / 识图 `n-mwgbir9b-k`
    - [功能] AI 侧栏对话 `a-ai-chat`〔AI 补〕 — 插件 ai-copilot；集合 ai-conversations / ai-messages
    - [页面] AI 工作台 `a-ai-page`〔AI 补〕 — (workspace)/ai 与 ai/image/style
    - [功能] AI 工具注册表 `a2-ai-tools`〔AI 补〕 — 核心工具与插件工具共一份注册表，缺 handler 的工具会被静默丢弃。src/plugins/ai-copilot/registry.ts:34-61；src/plugins/ai-copilot/core-ai.ts:13,649-650；src/plugins/ai-copilot/tools/admin-ai.ts:537
    - [功能] AI 工具权限白名单 `a2-ai-perms`〔AI 补〕 — 每个工具声明权限，注册时校验其全部落在所属插件的 permissions 白名单内，权限取值固定 17 项。src/plugins/ai-types.ts:12-32；src/plugins/ai-catalog.ts:54-67；src/plugins/ai-copilot/registry.ts:104-113
    - [功能] AI 工具执行守卫 `a2-ai-guards`〔AI 补〕 — 写操作工具执行前查项目三级角色，归档项目一律拦截并提示先恢复。src/plugins/ai-copilot/registry.ts:130-164；src/lib/project-guards.ts:6,13-29
    - [功能] AI 会话与消息存储 `a2-ai-history`〔AI 补〕 — 会话按用户隔离，最多列 30 条会话、单会话 200 条消息，历史只带最近 24 条且含工具摘要。src/collections/AiConversations.ts:14-27；src/plugins/ai-copilot/conversations.ts:5-30；src/plugins/ai-copilot/chat-handler.ts:40-41,211-255
    - [功能] 识图与视觉模型排序 `a2-ai-vision`〔AI 补〕 — 视觉模型按 visionScore 排序挑首选，识图结果与 CAD 检测融合后落成点位。src/plugins/ai-copilot/vision.ts:32-91；src/plugins/ai-copilot/upload-handler.ts:394,788
    - [功能] AI 生图 `a2-ai-imagegen`〔AI 补〕 — 生图按模型单价扣积分，ai-copilot 关闭时路由直接 404。src/plugins/ai-copilot/image-generation.ts:11-27；src/app/api/ai/images/route.ts:34-35,56
    - [功能] 对话逐轮计费 `a2-ai-billing`〔AI 补〕 — 每轮先以 cost=0 落消息，调用成功后按模型峰谷价加工具费回填扣分，最少 1 分。src/plugins/ai-copilot/billing.ts:18,42,101-106；src/plugins/ai-copilot/reply-billing.ts:39-52；src/plugins/ai-copilot/chat-handler.ts:641-651
    - [功能] 对话技能模板 `a2-ai-skills`〔AI 补〕 — 技能模板由插件注册的技能清单生成，分类固定为点位审查/选型报价/图纸识图/交付话术/自定义。src/plugins/ai-copilot/templates.ts:772；src/plugins/ai-types.ts:64-67
  - [模块] 户型图风格化 `n-mwgbir9b-l`
    - [页面] 风格化页 /ai/image/style `a-style-page`〔AI 补〕 — 上传户型图选风格模板，保留墙体布局生成家具彩平图，需开启 ai-copilot 插件。src/app/(frontend)/(workspace)/ai/image/style/page.tsx:17-21,61；src/app/api/ai/images/style/route.ts:17,31。
    - [功能] 风格模板（10 套） `a-style-templates`〔AI 补〕 — 模板只是风格参考、不改变源户型布局；「不要改变墙线」的要求写在上游 prompt。src/lib/style-templates.ts:1,10；src/plugins/ai-copilot/style-transfer.ts:86-91。
    - [功能] 点位图 AI 精装彩平 `a-style-pointmap`〔AI 补〕 — 点位图顶栏就地开弹窗，带入当前楼层底图生成；结果只能下载、不回填画布，弹窗关闭即丢弃。src/app/(frontend)/(workspace)/projects/[id]/point-map/point-map-editor.tsx:1369,2698-2701；ai-style-dialog.tsx:101-107；src/app/(frontend)/(workspace)/ai/image/style/style-transfer.tsx:325-333。
    - [功能] 墙线 mask 保布局 `a2-ai-style-wallmask`〔AI 补〕 — 每套风格共用同一套墙线 mask 与「不要改变墙线」提示词，源图限 12MB。src/plugins/ai-copilot/style-transfer.ts:23-33,86-95,113-119
    - [功能] 风格化固定扣 8 积分 `a2-ai-style-cost`〔AI 补〕 — 每次生成固定扣 8 积分，余额不足返回 402 且不发起生成。src/plugins/ai-copilot/style-transfer.ts:17；src/app/api/ai/images/style/route.ts:63-68
    - [功能] 风格化结果只下载不回填 `a2-ai-style-media`〔AI 补〕 — 结果写入 Media 集合但只回下载链接，不回填点位图画布、弹窗关闭即丢弃。src/plugins/ai-copilot/style-transfer.ts:146-168；src/app/(frontend)/(workspace)/ai/image/style/style-transfer.tsx:320-333；src/app/(frontend)/(workspace)/projects/[id]/point-map/point-map-editor.tsx:2698-2701
    - [功能] 点位图显示方案 `a2-ai-displayprofile`〔AI 补〕 — 4 套显示方案只有方案模板的平面图页消费，grid 参数传入后从未使用。src/lib/display-profile.ts:21-72；src/plugins/proposal/deck/pages/plan.tsx:54-55,102；src/app/(frontend)/(workspace)/projects/[id]/point-map/display-profile-action.ts:15-31
    - [功能] 风格化独立网关 `a2-ai-style-config`〔AI 补〕 — 风格化走独立网关与 AI_APIKEY_FAN_KEY，不在 AI 渠道配置的模型列表里。src/plugins/ai-copilot/style-transfer.ts:13-19；src/app/api/ai/images/style/route.ts:37-41
  - [模块] AI 渠道配置 `n-mwgbir9b-m`
    - [功能] 内置渠道白名单（9 个） `a-channel-providers`〔AI 补〕 — DeepSeek / NewAPI / 硅基流动 / 百炼两档 / 方舟 / Kimi / 智谱 / OpenRouter，域名与密钥环境变量在服务端一对一绑定。src/plugins/ai-copilot/templates.ts:6-70。
    - [功能] 自定义渠道（OpenAI 兼容） `a-channel-custom`〔AI 补〕 — 只收公网 HTTPS 地址与 AI_ 前缀的密钥变量名，密钥本身不入库。字段定义 src/globals/AiSettings.ts:189-200；校验：key 仅字母数字-_ src/globals/AiSettings.ts:211-212，密钥变量名必须 AI_ 开头 src/globals/AiSettings.ts:228-230，地址必须公网 HTTPS（排除私网） src/globals/AiSettings.ts:235-245 与 src/plugins/ai-copilot/templates.ts:80,86。
    - [页面] AI 设置（/admin/globals/ai-settings） `a-channel-models`〔AI 补〕 — 仅 CMS 管理员可见可改：模型列表、峰谷价目与倍率、渠道测试与拉取模型。src/globals/AiSettings.ts:252-272；端点 /status /presets /test /models /models/add 见 src/globals/ai-settings-endpoints.ts:306,424,481,529,568。
    - [功能] 密钥只存环境变量名 `a2-ai-keyenv`〔AI 补〕 — 渠道只存密钥的环境变量名，密钥本身不入库，自定义渠道变量名必须以 AI_ 开头。src/globals/AiSettings.ts:190-235；src/plugins/ai-copilot/templates.ts:13-70；src/plugins/ai-copilot/server.ts:58-114
    - [功能] 峰谷价目与计费倍率 `a2-ai-pricing`〔AI 补〕 — 峰谷价按北京时间工作日 9-12、14-18 分档，积分=倍率×人民币成本÷0.1 元。src/globals/AiSettings.ts:79-186；src/plugins/ai-copilot/billing.ts:18,54-60
    - [功能] 渠道测试与拉取模型 `a2-ai-channeltest`〔AI 补〕 — 渠道测试发一次最小对话、15 秒超时，拉取模型走 OpenAI 兼容 /models，两个端点都限 CMS 管理员。src/globals/ai-settings-endpoints.ts:481-560
    - [功能] 预设模型一键导入 `a2-ai-presets`〔AI 补〕 — 预设模型清单可一键导入 aiModels，端点同样限 CMS 管理员。src/globals/ai-settings-endpoints.ts:424-477
    - [功能] Auto 智能路由 `a2-ai-auto`〔AI 补〕 — Auto 模式先按场景排序可用模型再路由，对话中还会按已调用的工具重新选模型。src/plugins/ai-copilot/server.ts:224-285；src/plugins/ai-copilot/chat-handler.ts:200,565-577
- [业务域] 平台与运维 `n-mwgbir9b-n`
  - [模块] 权限与角色 `n-mwgbir9b-o`
    - [功能] 项目三级角色 `a-perm-roles`〔AI 补〕 — owner / edit / read；成员只有一种角色
    - [功能] 后台管理员 `a-perm-admin`〔AI 补〕 — 集合 admins，与员工 users 完全分开
    - [功能] 三级角色边界 `a2-ops-role-boundary`〔AI 补〕 — 项目只有 owner/edit/read 三级，角色每次由 owner 与 collaborators 现算，不落库。src/lib/project-access.ts:6,121-160
    - [功能] 归档只读白名单 `a2-ops-archive-whitelist`〔AI 补〕 — 归档后仅白名单字段可改，其余字段逐个比对后拒绝。src/collections/Projects.ts:57-64,133-143；src/lib/project-guards.ts:13-29
    - [功能] 分享链接权限 `a2-ops-share-perm`〔AI 补〕 — 分享用 token 加可选过期与 sha256 密码，非 owner 读不到 token 也改不了配置。src/lib/project-access.ts:9-112；src/app/(frontend)/(workspace)/projects/[id]/share/route.ts:66,72-100,141-147
    - [功能] CMS 与员工账号隔离 `a2-ops-admin-isolation`〔AI 补〕 — 后台管理员与员工是两个集合，员工不能进 /admin，管理员账号只能后台创建。src/lib/access.ts:6,14-19；src/collections/Users.ts:33-37；src/collections/Admins.ts:7-16
    - [功能] 邀请链接加入协作 `a2-ops-join`〔AI 补〕 — 邀请加入只允许已有成员账号，mode=login 验邮箱密码，edit 链接可把 read 协作者升级。src/app/(frontend)/join/[id]/accept/route.ts:10-11,47,68-70
    - [功能] 平台运营身份 `a2-ops-operator`〔AI 补〕 — 运营身份来自环境变量邮箱、admins 邮箱或 demo 账号，只有它能看客户使用报告。src/lib/platform-operator.ts:13-29；src/app/(frontend)/(workspace)/settings/reports/page.tsx:16,30
    - [功能] 客户使用与诊断报告 `a2-ops-reports`〔AI 补〕 — 报告只有 /settings/reports 一处入口并按运营身份门禁，但能力中心的工具入口被挂在了 room-insights 插件下。src/app/(frontend)/(workspace)/settings/reports/page.tsx:10-30；src/lib/usage-diagnostics.ts:178；src/lib/plugin-tools.ts:56-62
    - [功能] 积分账单双入口 `a2-ops-credit-entry`〔AI 补〕 — 同一份 ai-credit-ledger 有两个视图：成员在 /membership 看自己最近 30 条，超管在 /admin 看全集。src/collections/AiCreditLedger.ts:39-52；src/app/(frontend)/(workspace)/membership/page.tsx:24-27
  - [模块] 插件注册 `n-mwgbir9b-p`
    - [功能] 插件清单（10 个） `a-plugin-registry`〔AI 补〕 — src/plugins/index.ts；按 category × stage 注册
    - [功能] 名片插件 `a-plugin-card`〔AI 补〕 — 插件 business-card；四套版式、300dpi 导出
    - [功能] 现场设备对接（HA-MCP） `a-plugin-ha`〔AI 补〕 — 插件 ha-mcp；AI 直连客户现场的智能家居
    - [页面] 能力中心 `a-cap-center`〔AI 补〕 — (workspace)/capabilities 与 [id]、tools、templates
    - [功能] AI 对话插件 ai-copilot `a2-ops-plugin-ai-copilot`〔AI 补〕 — category=ai、stage=global 的常驻对话插件，关掉后对话、生图、风格化三处路由都 404。src/plugins/index.ts:29-38；src/plugins/ai-copilot/chat-handler.ts:179；src/app/api/ai/images/route.ts:34-35
    - [功能] 文档风格插件 doc-styles `a2-ops-plugin-doc-styles`〔AI 补〕 — category=template、stage=quote，提供扩展打印风格包，availableStyles 按开关过滤。src/plugins/index.ts:41-51；src/plugins/doc-styles/styles.ts:179；src/documents/registry.ts:75
    - [功能] 方案模板插件 proposal `a2-ops-plugin-proposal`〔AI 补〕 — category=template、stage=quote，打印方案前检查 flags.proposal，否则 notFound。src/plugins/index.ts:54-63；src/app/(frontend)/print/projects/[id]/proposal/page.tsx:72
    - [功能] 房间分析插件 room-insights `a2-ops-plugin-room-insights`〔AI 补〕 — category=tool、stage=design，点位图页与方案画廊按开关决定是否显示房间完整度。src/plugins/index.ts:66-75；src/app/(frontend)/(workspace)/projects/[id]/point-map/page.tsx:104；src/plugins/room-insights/ai.ts:26-30
    - [功能] 智能选型插件 smart-select `a2-ops-plugin-smart-select`〔AI 补〕 — category=tool、stage=design，按平台与预算档位一键配单，AI 工具费 2 积分。src/plugins/index.ts:78-87；src/plugins/smart-select/ai.ts:24-28；src/app/(frontend)/(workspace)/projects/[id]/point-map/page.tsx:102
    - [功能] 识图导入插件 ai-import `a2-ops-plugin-ai-import`〔AI 补〕 — category=ai、stage=design，插件自身 tools 为空只有识图技能，真正的识图实现在 ai-copilot 的 upload-handler，归属待确认。src/plugins/index.ts:90-97；src/plugins/ai-import/ai.ts:32-33；src/plugins/ai-copilot/upload-handler.ts:788
    - [功能] DWG 导入插件 dwg-import `a2-ops-plugin-dwg-import`〔AI 补〕 — category=tool、stage=design，通过 DWG_CONVERTER_URL 与 TOKEN 接外部转换服务，点位图页还会额外检查转换配置。src/plugins/index.ts:102-115；src/app/(frontend)/(workspace)/projects/[id]/point-map/page.tsx:103
    - [功能] 售后维保插件 after-sales `a2-ops-plugin-after-sales`〔AI 补〕 — category=tool、stage=after，项目归档后仍继续加载维保记录。src/plugins/index.ts:117-127；src/app/(frontend)/(workspace)/projects/[id]/archive/page.tsx:91；src/app/(frontend)/(workspace)/projects/[id]/after-sales/page.tsx:25
    - [功能] 插件开关落库与合并 `a2-ops-plugin-toggle`〔AI 补〕 — 开关按插件 id 写进个人 companyProfile.disabledPlugins，getPluginFlags 再与公司级合并成最终布尔表。src/plugins/state.ts:12-23；src/collections/Users.ts:133；src/globals/CompanySettings.ts:95；src/lib/cached-data.ts:347-349；src/app/(frontend)/(workspace)/settings/company/route.ts:92-96
    - [功能] 插件向 AI 注册元数据 `a2-ops-plugin-ai-meta`〔AI 补〕 — 插件把 tools/skills/knowledge/guidance/permissions 注册进 AI，缺 handler 的工具会被静默丢弃。src/plugins/ai-catalog.ts:14-67；src/plugins/ai-copilot/registry.ts:46-61
  - [模块] 部署 / 备份 `n-mwgbir9b-q`
    - [功能] 客户反馈 `a-ops-feedback`〔AI 补〕 — 集合 client-feedback
    - [功能] 售后维保记录 `a-ops-service`〔AI 补〕 — 插件 after-sales；集合 service-records
    - [功能] 影子部署建容器 `a2-ops-shadow-deploy`〔AI 补〕 — 发布先备份库，再建新目录复用旧 .env（绝不重生成 PAYLOAD_SECRET），用 override 在端口/网络/卷三处 !override 起影子容器。deploy/shadow-release.sh:111-204
    - [功能] 接线验证与冒烟闸门 `a2-ops-shadow-verify`〔AI 补〕 — 影子起来后必须验证接上生产网络、素材卷至少 10 个文件、/login 200，再跑冒烟，任一失败都不切流量。deploy/shadow-release.sh:205-267
    - [功能] Caddy 切流与回滚 `a2-ops-traffic-cut`〔AI 补〕 — 切流只改 Caddy 的 reverse_proxy 端口、validate 后重启，回滚前先确认目标端口真在监听。deploy/shadow-release.sh:46-90,272-289
    - [功能] 部署时必跑迁移 `a2-ops-migrate`〔AI 补〕 — 新版本带 schema 变更时必须跑 payload migrate，否则字段不存在会让功能静默失效。deploy/shadow-release.sh:150-169；.github/workflows/ci.yml:127
    - [功能] 每日备份与校验 `a2-ops-backup`〔AI 补〕 — 每日 pg_dump -Fc 并用 pg_restore --list 校验可解析，数据库留 14 天、素材每 7 天留 2 份，磁盘不足 3G 跳过。deploy/backup.sh:13-25,44-46,62-70；deploy/DEPLOY.md:158-187
    - [功能] 六道构建门禁 `a2-ops-ci-gates`〔AI 补〕 — 构建前依次跑切换自托管配置、oxfmt、eslint、tsc、knowledge:check、单测，最后跑生产构建并校验 BUILD_ID。.github/workflows/ci.yml:48-72；.github/workflows/ci-selfhosted.yml:74-100
    - [功能] CI 真库冒烟 `a2-ops-ci-smoke`〔AI 补〕 — 冒烟用真实 Postgres 建库、migrate、seed 后跑 e2e/smoke.mjs，失败上传截图与 failures.json。.github/workflows/ci.yml:78-171；.github/workflows/ci-selfhosted.yml:158-176；e2e/smoke.mjs:34-60,147,553

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
- [数据] 状态：进行中 / 已归档 `a2-main-proj-status-1` → 进度自动推导 `a-proj-stage`：进度自动推导按 status 判定是否已归档
- [依赖] 编辑信息 `a2-main-proj-edit-1` → 项目详情 `a-proj-detail`：编辑视图在项目详情页内切换
- [数据] 转让负责人 `a2-main-proj-owner-1` → 项目三级角色 `a-perm-roles`：转让与协作者角色判定共用 canManageProject / getProjectRole
- [依赖] 删除项目 `a2-main-proj-delete-1` → 合同 `n-mwgbir9b-5`：有已签订合同时禁止删除项目
- [依赖] 示例项目（isDemoTemplate） `a2-main-proj-demo-1` → 成员账号（users） `a-user-members`：新成员账号创建时自动克隆示例项目
- [数据] 进行中 / 已归档筛选 `a2-main-proj-filter-1` → 归档 `n-mwgbir9b-6`：归档后项目从进行中列表移到已归档
- [调用] 标定图纸比例 `a2-main-pm-calib-1` → 点位图编辑器 `a-pm-editor`：标定是画布工具，结果写进图纸 mmPerUnit
- [调用] 智能生成点位 `a2-main-pm-gen-1` → 房间智能分析 `a-pm-rooms`：智能生成按房间区域排点位，无区域时自动补齐
- [数据] 图纸裁切上传 `a2-main-pm-sheet-1` → 点位图编辑器 `a-pm-editor`：裁切后的标准图纸作为点位图底图
- [数据] 显示方案（施工图 / 业主展示 / 技术交底 / 汇报演示） `a2-main-pm-display-1` → 方案模板 `n-mwgbir9b-g`：显示方案决定方案模板里点位图怎么渲染
- [数据] 项目默认型号 `a2-main-pm-default-1` → 产品库 `n-mwgbir9b-8`：默认型号从产品库选，校验在售与设备类型
- [依赖] 导出当前图纸 PNG / 画板 JSON `a2-main-pm-export-1` → 点位图编辑器 `a-pm-editor`：导出是画布工具栏的前端动作，复用当前场景
- [数据] 点位图保存上限（190KB） `a2-main-pm-savecap-1` → 项目 `n-mwgbir9b-2`：保存写的是项目的 pointMap JSON 字段
- [依赖] 本地草稿恢复 `a2-main-pm-draft-1` → 点位图编辑器 `a-pm-editor`：草稿只在编辑器里产生与恢复
- [流程] 报价状态：草稿 / 已发送 / 已确认 `a2-main-quote-status-1` → 合同 `n-mwgbir9b-5`：报价已确认后报价台提示生成合同
- [数据] 从点位图生成报价 `a2-main-quote-gen-1` → 点位图 `n-mwgbir9b-3`：设备清单与数量从点位图统计
- [数据] 从点位图同步 `a2-main-quote-sync-1` → 点位图 `n-mwgbir9b-3`：同步再读点位图最新点位
- [数据] 逐行更换型号 `a2-main-quote-swap-1` → 产品库 `n-mwgbir9b-8`：候选型号来自产品库同设备类型在售产品
- [数据] 设为定稿报价 `a2-main-quote-final-1` → 归档 `n-mwgbir9b-6`：定稿报价供交付资料包与方案使用
- [调用] 业主意向反馈处理 `a2-main-quote-feedback-1` → 分享页 `a-site-share`：反馈来源是分享页提交的意向
- [依赖] 已签合同引用的报价锁定 `a2-main-quote-lock-1` → 合同 `n-mwgbir9b-5`：锁定条件看合同是否已签订并引用这份报价
- [调用] /print/quotes/[id] 报价单打印 `a2-main-quote-print-1` → 打印路由（10 条） `a-print-center`：报价打印路由归打印文档中心
- [数据] 合同状态：待签订 / 已签订 `a2-main-contract-status-1` → 进度自动推导 `a-proj-stage`：项目进度用 contractStatus 判断合同待签/已签
- [数据] 从报价生成合同 `a2-main-contract-create-1` → 报价 `n-mwgbir9b-4`：金额与明细来自依据报价
- [依赖] 标记为已签订 / 撤销签订 `a2-main-contract-sign-1` → 签订后锁定 `a-contract-lock`：签订触发合同与依据报价锁定
- [依赖] 登记收款 `a2-main-contract-pay-1` → 签订后锁定 `a-contract-lock`：锁定后只放开收款登记
- [依赖] 付款比例合计 100%（最多 6 期） `a2-main-contract-ratio-1` → 合同页 `a-contract-page`：保存合同页时校验比例合计 100%
- [数据] 合同约束：一份 / 不可换项目 / 已签不可删 `a2-main-contract-guard-1` → 项目 `n-mwgbir9b-2`：合同与项目一对一，已签合同也影响项目删除
- [调用] /print/contracts/[id] 合同打印 `a2-main-contract-print-1` → 打印路由（10 条） `a-print-center`：合同打印路由归打印文档中心
- [依赖] 合同分区编辑 `a2-main-contract-edit-1` → 合同页 `a-contract-page`：分区编辑是合同页的编辑入口
- [数据] 归档 / 恢复项目 `a2-main-archive-toggle-1` → 项目 `n-mwgbir9b-2`：归档/恢复写项目的 status 与 archivedAt
- [数据] 归档前资料核对 `a2-main-archive-ready-1` → 合同 `n-mwgbir9b-5`：合同与收款数据决定资料是否齐备
- [调用] 交付资料包（ZIP / 合并 PDF） `a2-main-archive-package-1` → 打印路由（10 条） `a-print-center`：资料包逐份调用打印路由收集 PDF
- [数据] 业主分享链接设置（有效期 / 访问密码） `a2-main-archive-share-1` → 分享页 `a-site-share`：链接设置控制 share/[token] 能否打开
- [依赖] 复制业主预览链接 /share/[token] `a2-main-archive-link-1` → 分享页 `a-site-share`：复制的是分享页地址
- [数据] 案例晒单海报（3:4 图组） `a2-main-archive-poster-1` → 点位图 `n-mwgbir9b-3`：海报楼层图与设备统计来自点位图
- [数据] 选定交付资料（定稿报价 / 交付方案模板） `a2-main-archive-deliver-1` → 报价 `n-mwgbir9b-4`：定稿报价必须是本项目报价之一
- [依赖] 归档后全链只读 `a2-main-archive-readonly-1` → 报价 `n-mwgbir9b-4`：只读守卫拦在报价与合同保存前
- [数据] 产品库筛选维度 `a2-data-prod-filter-1` → 设备类型字典 `n-mwgbir9b-9`：type/cat 筛选值直接来自设备类型字典
- [数据] 品牌筛选计数与折叠 `a2-data-prod-counts-2` → 品牌库（brands） `a-brand-brands`：品牌侧栏读 brands 自行计数
- [数据] 产品库整库导出 / 导入 `a2-data-prod-dump-3` → 产品库 `n-mwgbir9b-8`：整库 dump 里的 products 就是本模块数据
- [数据] 产品图片托管 `a2-data-prod-image-4` → 产品库页 `a-prod-list`：产品库页用 media.url 渲染产品图
- [依赖] 产品编辑权限 `a2-data-prod-access-5` → 后台管理员 `a-perm-admin`：删除产品仍只允许后台 CMS 管理员
- [数据] 设备类型清单（34 项） `a2-data-dt-types-1` → 产品库 `n-mwgbir9b-8`：产品 deviceType 必填项取自这份清单
- [数据] 点位图标（30 个 SVG） `a2-data-dt-symbols-2` → 点位图编辑器 `a-pm-editor`：点位图与打印点位图用同一套符号
- [数据] 字典顺序与类别分组 `a2-data-dt-order-3` → 产品库页 `a-prod-list`：产品库侧栏类别顺序按字典排序
- [数据] 品牌 Logo（brands.logo） `a2-data-brand-logo-1` → 品牌库（brands） `a-brand-brands`：Logo 是品牌库的字段
- [依赖] 品牌维护权限 `a2-data-brand-access-2` → 后台管理员 `a-perm-admin`：品牌增删改只允许 CMS 管理员
- [数据] 公开页品牌墙 `a2-data-brand-landing-3` → 公开页（6 个） `a-site-pages`：首页品牌墙是公开页的一部分
- [调用] 账号状态（启用 / 停用） `a2-data-user-status-1` → 登录 / 注册页 `a-user-login`：登录校验 status=active，停用即拒
- [依赖] users 与 admins 账号隔离 `a2-data-user-isolation-2` → 后台管理员 `a-perm-admin`：admins 是另一套账号，users 不能进后台
- [数据] 成员资料只能读改自己 `a2-data-user-selfread-3` → 成员账号（users） `a-user-members`：同一条 users 集合的读取规则
- [数据] 新成员自动克隆示例项目 `a2-data-user-demo-4` → 项目列表 `a-proj-list`：新建账号后项目列表多出一份示例项目
- [数据] 成员会话有效期 `a2-data-user-session-5` → 登录 / 注册页 `a-user-login`：登录后写入的会话有效期
- [数据] 协作者 read / edit 两级 `a2-data-collab-role-1` → 项目三级角色 `a-perm-roles`：协作者 read/edit 即项目三级角色里的两级
- [数据] 分享链接有效期 `a2-data-collab-expiry-2` → 协作者 / 分享链接 `a-collab-share`：expiresAt 存在 shareConfig 里
- [数据] 分享访问密码 `a2-data-collab-password-3` → 协作者 / 分享链接 `a-collab-share`：passwordHash 与解锁 cookie 属同一分享配置
- [调用] 加入协作页 /join/[id] `a2-data-collab-join-4` → 成员账号（users） `a-user-members`：加入协作要求已有成员账号登录
- [数据] 协作链接 token 与重置 `a2-data-collab-token-5` → 协作者 / 分享链接 `a-collab-share`：token 是分享链接的凭证主体
- [数据] 余额计算与行锁 `a2-data-credit-balance-1` → 积分流水 `a-credit-ledger`：余额由流水集合的钩子算出并回写
- [数据] 兑换码核销流程 `a2-data-credit-redeemflow-2` → 兑换码 `a-credit-redeem`：核销的是 redemption-codes 集合
- [数据] 积分任务（5 项） `a2-data-credit-tasks-3` → 积分流水 `a-credit-ledger`：任务奖励以流水形式入账
- [调用] AI 对话计费链路 `a2-data-credit-chatbill-4` → AI 侧栏对话 `a-ai-chat`：每轮对话结束后按用量扣费
- [调用] AI 生图 / 风格化计费 `a2-data-credit-imagebill-5` → 风格化页 /ai/image/style `a-style-page`：风格化页每次生成扣 8 积分
- [调用] 会员与积分页 /membership `a2-data-credit-page-6` → 兑换码 `a-credit-redeem`：会员与积分页提交兑换码核销
- [数据] 版式框架（4 种） `a2-data-tpl-frameworks-1` → 方案演示 `a-tpl-proposal`：方案演示按框架决定章节
- [数据] DECK_THEMES 视觉主题（10 套） `a2-data-tpl-themes-2` → 方案演示 `a-tpl-proposal`：方案演示的配色与版式来自主题
- [数据] 内置模板（12 套） `a2-data-tpl-builtin-3` → 模板站 `a-tpl-page`：模板站展示后台模板或内置兜底
- [数据] 模板如何应用到项目 `a2-data-tpl-apply-4` → 归档页 `a-archive-page`：归档页选交付方案模板并写回项目
- [数据] 缩略图与样张生成 `a2-data-tpl-thumb-5` → 模板站 `a-tpl-page`：模板站的卡片缩略图由同一套渲染产出
- [数据] 方案页画布 1440×960 与 A4 横版换算 `a2-data-tpl-canvas-6` → 方案演示 `a-tpl-proposal`：方案页画布尺寸决定打印缩放
- [流程] 打印路由（10 条） `a-print-center` → 现场勘测确认单 `a2-data-print-survey-1`：打印中心第 1 条：给客户与勘测工程师
- [流程] 打印路由（10 条） `a-print-center` → 强弱电布线与水电交底单 `a2-data-print-wiring-2`：打印中心第 2 条：给水电施工
- [流程] 打印路由（10 条） `a-print-center` → 点位图打印页 `a2-data-print-plans-3`：打印中心第 3 条：给安装交底
- [流程] 打印路由（10 条） `a-print-center` → 智能家居方案 `a2-data-print-proposal-4`：打印中心第 4 条：给业主
- [流程] 打印路由（10 条） `a-print-center` → 采购与备货核验单 `a2-data-print-procurement-5`：打印中心第 5 条：给内部采购
- [流程] 打印路由（10 条） `a-print-center` → 点位交底清单 `a2-data-print-checklist-6`：打印中心第 6 条：给安装团队
- [流程] 打印路由（10 条） `a-print-center` → 场景与账号交付移交单 `a2-data-print-handover-7`：打印中心第 7 条：给业主交付
- [流程] 打印路由（10 条） `a-print-center` → 售后维保卡与配置备份单 `a2-data-print-aftersales-8`：打印中心第 8 条：给业主与售后
- [流程] 打印路由（10 条） `a-print-center` → 报价单打印页 `a2-data-print-quote-9`：打印中心第 9 条：给客户
- [流程] 打印路由（10 条） `a-print-center` → 合同打印页 `a2-data-print-contract-10`：打印中心第 10 条：给客户签字
- [数据] 打印工具条（导出 PDF / 图片） `a2-data-print-toolbar-11` → 打印路由（10 条） `a-print-center`：所有打印页共用这条工具条导出
- [数据] 文档版式与风格包 `a2-data-print-layouts-12` → 文档风格包 `a-print-tpl`：版式与风格包共同决定打印外观
- [流程] 公开页（6 个） `a-site-pages` → 首页 / `a2-data-site-home-1`：6 个公开页之一
- [流程] 公开页（6 个） `a-site-pages` → 图例与产品库 /catalog `a2-data-site-catalog-2`：6 个公开页之一
- [流程] 公开页（6 个） `a-site-pages` → 品牌标识 /brand `a2-data-site-brand-3`：6 个公开页之一
- [流程] 公开页（6 个） `a-site-pages` → 文档中心 /docs `a2-data-site-docs-4`：6 个公开页之一
- [流程] 公开页（6 个） `a-site-pages` → 下载桌面客户端 /download `a2-data-site-download-5`：6 个公开页之一
- [数据] 站点级 SEO / OG `a2-data-site-seo-6` → 公开页（6 个） `a-site-pages`：站点级 metadata 与 sitemap 覆盖这 6 页
- [依赖] 免登录边界 `a2-data-site-boundary-7` → 公开页（6 个） `a-site-pages`：免登录范围就是这 6 个公开页加分享页
- [调用] AI 工具注册表 `a2-ai-tools` → 插件清单（10 个） `a-plugin-registry`：工具来自插件注册的 10 个插件加核心工具
- [依赖] AI 工具权限白名单 `a2-ai-perms` → AI 工具注册表 `a2-ai-tools`：工具声明的权限必须在所属插件白名单内
- [依赖] AI 工具执行守卫 `a2-ai-guards` → 权限与角色 `n-mwgbir9b-o`：工具写操作复用项目三级角色与归档只读校验
- [数据] AI 会话与消息存储 `a2-ai-history` → AI 侧栏对话 `a-ai-chat`：对话读写 ai-conversations 与 ai-messages
- [调用] 识图与视觉模型排序 `a2-ai-vision` → AI 工具注册表 `a2-ai-tools`：点位规划与识图工具调用视觉模型
- [数据] 识图与视觉模型排序 `a2-ai-vision` → AI 渠道配置 `n-mwgbir9b-m`：视觉模型从 ai-settings 的模型列表里排序挑选
- [数据] AI 生图 `a2-ai-imagegen` → 积分流水 `a-credit-ledger`：生成前预检积分、按模型单价写流水
- [数据] 对话逐轮计费 `a2-ai-billing` → 积分与账单 `n-mwgbir9b-e`：每轮调用写 ai-credit-ledger 并回填用户余额
- [数据] 对话逐轮计费 `a2-ai-billing` → AI 工具注册表 `a2-ai-tools`：积分里的工具费取自各工具注册的 cost
- [依赖] 对话技能模板 `a2-ai-skills` → AI 工具注册表 `a2-ai-tools`：技能模板与工具同源注册
- [数据] 对话技能模板 `a2-ai-skills` → AI 工作台 `a-ai-page`：AI 工作台读取技能模板清单
- [调用] 识图与视觉模型排序 `a2-ai-vision` → AI 识别导入 `a-pm-ai-import`：识图导入入口用的是这套视觉能力，归属待确认
- [依赖] 墙线 mask 保布局 `a2-ai-style-wallmask` → 风格模板（10 套） `a-style-templates`：每套风格模板都走同一套墙线 mask 流程
- [数据] 风格化固定扣 8 积分 `a2-ai-style-cost` → 积分与账单 `n-mwgbir9b-e`：每次生成扣 8 积分并记流水
- [依赖] 风格化固定扣 8 积分 `a2-ai-style-cost` → 风格化独立网关 `a2-ai-style-config`：未配风格化密钥时先返回 503，谈不到扣分
- [数据] 风格化结果只下载不回填 `a2-ai-style-media` → 点位图 AI 精装彩平 `a-style-pointmap`：点位图弹窗结果只回下载链接，不回填画布
- [数据] 风格化结果只下载不回填 `a2-ai-style-media` → 风格化页 /ai/image/style `a-style-page`：风格化页同样是下载结果而非保存
- [数据] 点位图显示方案 `a2-ai-displayprofile` → 方案演示 `a-tpl-proposal`：显示方案唯一消费点是方案模板平面图页
- [数据] 点位图显示方案 `a2-ai-displayprofile` → 点位图编辑器 `a-pm-editor`：点位图页选择显示方案并写 projects.displayProfile
- [依赖] 风格化独立网关 `a2-ai-style-config` → AI 渠道配置 `n-mwgbir9b-m`：风格化用独立密钥，不在 AI 渠道配置里，边界待确认
- [数据] 密钥只存环境变量名 `a2-ai-keyenv` → 自定义渠道（OpenAI 兼容） `a-channel-custom`：自定义渠道只存 AI_ 前缀的变量名
- [数据] 密钥只存环境变量名 `a2-ai-keyenv` → 内置渠道白名单（9 个） `a-channel-providers`：内置渠道的密钥环境变量与服务端一对一绑定
- [数据] 峰谷价目与计费倍率 `a2-ai-pricing` → AI 设置（/admin/globals/ai-settings） `a-channel-models`：峰谷价目与倍率写在模型配置里
- [数据] 峰谷价目与计费倍率 `a2-ai-pricing` → 对话逐轮计费 `a2-ai-billing`：价目决定每轮对话扣多少积分
- [调用] 渠道测试与拉取模型 `a2-ai-channeltest` → AI 设置（/admin/globals/ai-settings） `a-channel-models`：测试与拉取模型都直接调渠道接口
- [数据] 预设模型一键导入 `a2-ai-presets` → AI 设置（/admin/globals/ai-settings） `a-channel-models`：预设清单导入后成为模型列表的一行
- [调用] Auto 智能路由 `a2-ai-auto` → AI 侧栏对话 `a-ai-chat`：Auto 模式在对话里挑模型并失败切换
- [数据] Auto 智能路由 `a2-ai-auto` → AI 设置（/admin/globals/ai-settings） `a-channel-models`：路由只在有密钥的启用模型里选
- [依赖] 三级角色边界 `a2-ops-role-boundary` → 协作者 / 分享链接 `a-collab-share`：协作者与分享角色都落到同一套三级角色
- [数据] 归档只读白名单 `a2-ops-archive-whitelist` → 归档页 `a-archive-page`：归档页按白名单呈现可改与只读
- [依赖] 归档只读白名单 `a2-ops-archive-whitelist` → AI 工具执行守卫 `a2-ai-guards`：AI 写操作复用同一归档拦截
- [依赖] 分享链接权限 `a2-ops-share-perm` → 分享页 `a-site-share`：分享页遵循分享 token、过期与密码规则
- [数据] 分享链接权限 `a2-ops-share-perm` → 协作者 / 分享链接 `a-collab-share`：分享配置与协作者列表同一份数据
- [依赖] CMS 与员工账号隔离 `a2-ops-admin-isolation` → 后台管理员 `a-perm-admin`：后台管理员集合与员工集合互不通用
- [依赖] CMS 与员工账号隔离 `a2-ops-admin-isolation` → 成员账号（users） `a-user-members`：员工账号 admin 入口直接关闭
- [流程] 邀请链接加入协作 `a2-ops-join` → 协作者 / 分享链接 `a-collab-share`：邀请链接接受后写入协作者列表
- [调用] 平台运营身份 `a2-ops-operator` → 客户使用与诊断报告 `a2-ops-reports`：只有运营身份能打开客户使用报告
- [数据] 积分账单双入口 `a2-ops-credit-entry` → 积分流水 `a-credit-ledger`：两个入口读同一份积分流水
- [依赖] 积分账单双入口 `a2-ops-credit-entry` → 成员账号（users） `a-user-members`：账单余额取自 users.aiCredits
- [调用] AI 对话插件 ai-copilot `a2-ops-plugin-ai-copilot` → AI 侧栏对话 `a-ai-chat`：插件提供侧栏常驻对话
- [调用] AI 对话插件 ai-copilot `a2-ops-plugin-ai-copilot` → AI 工作台 `a-ai-page`：插件提供 AI 工作台与风格化页
- [数据] 文档风格插件 doc-styles `a2-ops-plugin-doc-styles` → 文档风格包 `a-print-tpl`：插件提供扩展打印风格包
- [数据] 方案模板插件 proposal `a2-ops-plugin-proposal` → 方案演示 `a-tpl-proposal`：插件提供三个方案模板
- [调用] 方案模板插件 proposal `a2-ops-plugin-proposal` → 打印路由（10 条） `a-print-center`：打印路由里的 proposal 由插件供数据
- [调用] 房间分析插件 room-insights `a2-ops-plugin-room-insights` → 房间智能分析 `a-pm-rooms`：点位图与方案画廊调用房间完整度分析
- [调用] 智能选型插件 smart-select `a2-ops-plugin-smart-select` → 智能选型 `a-pm-select`：点位图页调用智能选型
- [调用] 识图导入插件 ai-import `a2-ops-plugin-ai-import` → AI 识别导入 `a-pm-ai-import`：点位图页的 AI 识别导入入口
- [调用] DWG 导入插件 dwg-import `a2-ops-plugin-dwg-import` → DWG 导入 `a-pm-dwg`：点位图页的 DWG 导入入口
- [数据] 售后维保插件 after-sales `a2-ops-plugin-after-sales` → 售后维保记录 `a-ops-service`：插件读写 service-records 维保记录
- [依赖] 插件开关落库与合并 `a2-ops-plugin-toggle` → 插件清单（10 个） `a-plugin-registry`：开关按插件 id 与 ready 状态算最终可用性
- [数据] 插件开关落库与合并 `a2-ops-plugin-toggle` → 成员账号 `n-mwgbir9b-c`：个人开关存在成员账号的 companyProfile 里
- [调用] 插件向 AI 注册元数据 `a2-ops-plugin-ai-meta` → AI 工具注册表 `a2-ai-tools`：插件把工具、技能与权限注册给 AI
- [依赖] 插件向 AI 注册元数据 `a2-ops-plugin-ai-meta` → 插件清单（10 个） `a-plugin-registry`：元数据按插件 id 聚合
- [流程] 影子部署建容器 `a2-ops-shadow-deploy` → 部署时必跑迁移 `a2-ops-migrate`：发布第 2.5 步在新库连生产网后跑迁移
- [流程] 接线验证与冒烟闸门 `a2-ops-shadow-verify` → 影子部署建容器 `a2-ops-shadow-deploy`：影子容器起来后逐项验证接线与健康
- [流程] Caddy 切流与回滚 `a2-ops-traffic-cut` → 接线验证与冒烟闸门 `a2-ops-shadow-verify`：冒烟通过才允许切流量
- [依赖] 每日备份与校验 `a2-ops-backup` → 影子部署建容器 `a2-ops-shadow-deploy`：发布第 0 步先备份数据库
- [流程] 六道构建门禁 `a2-ops-ci-gates` → CI 真库冒烟 `a2-ops-ci-smoke`：六道门禁过后单独跑冒烟 job
- [依赖] CI 真库冒烟 `a2-ops-ci-smoke` → 接线验证与冒烟闸门 `a2-ops-shadow-verify`：CI 与发布前跑的是同一份 smoke.mjs
- [数据] 六道构建门禁 `a2-ops-ci-gates` → 部署时必跑迁移 `a2-ops-migrate`：CI 建库后同样用 payload migrate 建表

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
