---
name: FMKJ 项目管理
description: 全屋智能家居公司的内部项目运营后台：点位图、产品库、报价
colors:
  ink: "oklch(0.145 0 0)"
  ink-primary: "oklch(0.205 0 0)"
  paper: "oklch(1 0 0)"
  paper-muted: "oklch(0.97 0 0)"
  pencil: "oklch(0.53 0 0)"
  rule-line: "oklch(0.922 0 0)"
  focus-ring: "oklch(0.708 0 0)"
  sidebar-paper: "oklch(0.985 0 0)"
  alert-red: "oklch(0.577 0.245 27.325)"
  alert-red-strong: "oklch(0.47 0.2 27.325)"
  confirmed-green: "oklch(0.49 0.12 155)"
  pending-amber: "oklch(0.52 0.11 75)"
  cat-switch: "#2563eb"
  cat-socket: "#0d9488"
  cat-lighting: "#d97706"
  cat-sensor: "#059669"
  cat-lock: "#475569"
  cat-security: "#dc2626"
  cat-curtain: "#db2777"
  cat-gateway: "#7c3aed"
  cat-network: "#0891b2"
  cat-vrf: "#ea580c"
  cat-other: "#525252"
  accent: "oklch(0.51 0.22 279)"
typography:
  headline:
    fontFamily: "Inter, PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans SC, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans SC, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
  body:
    fontFamily: "Inter, PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans SC, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans SC, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
  data:
    fontFamily: "Inter, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    fontFeature: "tnum"
  public-display:
    fontFamily: "Inter (opsz), PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans SC, sans-serif"
    fontSize: "clamp(2.5rem, 1.25rem + 4.2vw, 4.5rem)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.022em"
  public-headline:
    fontFamily: "Inter (opsz), PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans SC, sans-serif"
    fontSize: "clamp(1.875rem, 1.2rem + 2vw, 3rem)"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.018em"
  public-lead:
    fontFamily: "Inter, PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans SC, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.75
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  window: "18px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink-primary}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    height: "32px"
    padding: "0 12px"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "32px"
  input:
    backgroundColor: "{colors.paper-muted}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "32px"
  card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.xl}"
    padding: "20px"
  filter-tabs:
    backgroundColor: "{colors.paper-muted}"
    rounded: "{rounded.lg}"
    height: "36px"
  filter-tab-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  badge-success:
    textColor: "{colors.confirmed-green}"
    rounded: "{rounded.full}"
  badge-warning:
    textColor: "{colors.pending-amber}"
    rounded: "{rounded.full}"
  button-public-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.full}"
    height: "44px"
    padding: "0 24px"
  button-public-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    height: "44px"
    padding: "0 24px"
  product-window:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.window}"
---

# Design System: FMKJ 项目管理

## Overview

**Creative North Star: "施工图纸"**

整个界面像一张干净的施工图纸：黑、白、灰是纸和墨，只有两类颜色承载信息。一是**设备类别色**，每一类设备有一个固定颜色，和点位图画布上的符号颜色一致；二是**状态色**，表示确认、待处理、警示。除此之外不用颜色装饰。

这是员工每天干活的工具，不是展示页面。可扫读、一致、可信，比表现力更重要。熟悉的后台模式（侧边导航、表格、标签页式筛选）是优点，不要为了“设计感”去改造标准控件。品牌感体现在精确的细节上：对齐的数字、统一的控件、克制的层级。

支持浅色和深色两套主题，两套用同一组语义变量（见 `src/app/(frontend)/styles.css`）。

**Key Characteristics:**
- 中性色为底，颜色只用来表达类别和状态
- 一个字族（Inter 加中文字体链），靠字号和字重分层级
- 平面为主，卡片只用很轻的阴影加 1px 描边
- 表格和金额一律使用等宽数字
- 中等信息密度，桌面优先，移动端可用

## Colors

中性灰阶为主体，设备类别色和状态色是唯一的彩色。

### Primary
- **墨黑 Ink Primary** (oklch(0.205 0 0))：主按钮、当前选中项、进度条已完成段。深色主题下反转为浅色。

### 主题强调色
- **繁梦紫 Accent** (oklch(0.51 0.22 279))：默认主题风格（`data-accent="fanmeng"`，另有青碧、经典可选）的主色。工作台里是主按钮与当前项；公开页只用于选中态（清单固定行、付款节点进度），不用于大面积底色。

### Neutral
- **正文墨 Ink** (oklch(0.145 0 0))：正文和标题。
- **铅笔灰 Pencil** (oklch(0.53 0 0))：次要文字、说明、占位符。这是对比度下限：在白底上 5.25:1，在浅灰底上 4.82:1，不要再调浅。
- **图纸白 Paper** (oklch(1 0 0))：页面和卡片底色。
- **浅灰底 Paper Muted** (oklch(0.97 0 0))：输入框底、筛选条底、悬停底。
- **侧栏底 Sidebar Paper** (oklch(0.985 0 0))：侧边栏，比内容区略深一点，作为第二层中性面。
- **格线 Rule Line** (oklch(0.922 0 0))：描边、分隔线、表格线。

### 状态色
- **确认绿 Confirmed Green** (oklch(0.49 0.12 155))：已确认的报价，以及其他成功状态。
- **待办琥珀 Pending Amber** (oklch(0.52 0.11 75))：已发送、等客户回复，以及其他需要关注的状态。
- **警示红 Alert Red** (oklch(0.577 0.245 27.325))：错误和破坏性操作。浅红底上的文字改用 **Alert Red Strong** (oklch(0.47 0.2 27.325))，保证对比度不低于 4.5:1。

### 设备类别色
定义在 `src/lib/device-types.ts`，是点位图符号、产品库类别圆点、设备类型标签共用的颜色：开关 #2563eb、插座 #0d9488、灯具 #d97706、传感器 #059669、门锁 #475569、监控 #dc2626、窗帘 #db2777、网关中控 #7c3aed、全屋 WiFi #0891b2、VRF #ea580c、其他 #525252。

### Named Rules
**颜色即信息。** 彩色只出现在设备类别和业务状态上。按钮、标题、背景、装饰都不用彩色。

**未激活不着色。** 无库存、草稿、未选中等常态或空状态用灰色文字，不用红色或高饱和底色。红色只留给真正的错误和破坏性操作。

**类别色只有一份。** 设备类别色只从 `device-types.ts` 读取，不在组件里另写一份。

## Typography

**字体：** Inter 可变字体负责拉丁字符和数字（`src/lib/fonts.ts` 自托管 Google Fonts v20 拉丁子集，约 73 KB，带 opsz 光学尺寸轴：小字用 Text 字形，大标题自动切到 Display 字形，Linear 同款），中文依次回落到 PingFang SC、Hiragino Sans GB、Microsoft YaHei、Noto Sans SC。字体链写在 `styles.css` 的 `--font-sans`，保证换一台电脑界面也一样。字体变量名不能叫 `inter`：next/font 用变量名当字族名，会和文档模板引用的远程 "Inter" 撞名（字族名不区分大小写），导致两份一起下载。

**风格：** 全站只用一个字族，相邻层级的字号比约 1.125–1.2，用固定的 rem 字号，不用随视口缩放的字号。

### Hierarchy
- **页面标题 Headline**（600，1.5rem，字距 -0.025em）：每页一个 h1（`PageHeader`）。
- **区块标题 Title**（600，1rem）：卡片标题、分组标题。
- **正文 Body**（400，0.875rem，行高 1.5）：表格、表单、说明文字。
- **标签 Label**（500，0.75rem）：表单标签、徽章、计数、侧栏分组名。
- **数据 Data**（600，等宽数字）：金额、数量、日期，右对齐。

### Named Rules
**数字对齐。** 金额、数量、日期一律使用 `tabular-nums`；表格默认已开启。

**标题上方不加小标签。** 页面标题本身就够了，不要在它上面再加一行小号的分类说明（kicker / eyebrow）。

## Layout

- **整体框架**：左侧可折叠侧边栏，加 48px 高的顶栏（只放侧栏开关和主题切换），内容区边距 16px（手机）/ 32px（桌面）。
- **页面头部**：左侧是 h1 和一行计数或说明，右侧是主操作或搜索。
- **列表页**：搜索框、筛选条（FilterTabs）、表格或网格，筛选状态记录在网址参数里。
- **表单和详情页**：最大宽度 3xl（768px），居中。
- **产品库**：240px 的左侧筛选栏（桌面端随页面固定）加产品网格（2 / 3 / 4 / 5 列）；窄屏下筛选栏收进“筛选”按钮。
- **间距**：组内 4–8px，组间 16–24px；标题上方的留白大于下方。
- **响应式**：靠结构变化适配（侧栏折叠、隐藏次要列、筛选条横向滚动），不靠缩放字号。

## Elevation & Depth

以平面为主，靠颜色深浅分层：页面白、侧栏浅灰、输入框浅灰。卡片用 `shadow-sm` 加一圈 5% 不透明度的描边；产品卡悬停时上浮 2px 并加深阴影。阴影必须有偏移和柔和的模糊，不用硬边的偏移阴影，也不用无偏移的彩色光晕。顶栏是实色底加底部分隔线，不用毛玻璃。

## Shapes

基础圆角 10px（`--radius`）。按钮、输入框、筛选项用 8px；卡片用 14px；徽章和计数用全圆角。描边统一 1px，不在卡片或列表项侧边加粗彩色边线。

## Components

- **按钮**：默认高 32px。主按钮墨黑底，次按钮白底描边，幽灵按钮无底色。键盘聚焦时显示 3px 的环形焦点框，按下时下沉 1px，禁用时 50% 不透明度。
- **筛选条 FilterTabs**（`src/components/filter-tabs.tsx`）：单选筛选（阶段、状态、排序）统一用它。外层是浅灰底的分段容器，选中项是白底加轻阴影，基于链接实现，窄屏下可横向滚动。多选筛选（品牌）用侧栏复选列表。
- **输入框**：高 32px，浅灰填充底，聚焦时显示环形焦点框，出错时红色描边。文件上传隐藏原生控件，用中文按钮加文件名代替。
- **徽章 Badge**：报价状态统一用 `quoteStatusVariant()`：草稿 outline、已发送 warning、已确认 success。
- **表格**：卡片包裹，首列左内边距 16px（手机）/ 24px（桌面），整行可点击，次要列在窄屏隐藏。
- **设备符号 DeviceSymbol**：384×384 画布的单色 SVG（`public/point-symbols`），用 CSS mask 按类别色着色；新增符号保持同样的风格：浅色填充（约 19% 不透明度）加实心描边和细节。
- **点位图标 PointMarker**：设备图标用 `scripts/point-icons/mapping.json` 选定的原图，由 `scripts/build-point-icons.mjs` 在原图基础上优化（不改图形）：灰色图标按类别色上色、线条加深加粗（细长灯具加粗更多）、外圈白边，输出高清图（`public/point-icons`）。没有选定图标的类型回退到 `scripts/build-point-markers.mjs` 生成的实心标记（`public/point-markers`）。改了素材或参数后把对应脚本里的版本号加一。
- **标准图纸**（`src/lib/sheet-spec.ts`）：户型图裁掉图框、标题栏和图名后，放进 3:2 白底画布，存储 2400×1600 PNG，在点位图里占 1200×800；打开或切换图纸时铺满画布即为 100%。点位标记直径 24、代号字号 9（相对 1200 宽）。底图 60% 不透明度，让彩色点位更醒目。
- **产品图 ProductThumb**：正方形白底、细描边、图片占 84% 等比居中，任何原图比例看起来都一样大。上传规范：800×800 白底方图，产品主体约占 80%。方案图里的产品点位为浅灰底圆框 + 类别色描边。
- **空状态**：虚线框内放图标、一句说明和下一步操作，告诉用户怎么开始，不只写“暂无数据”。
- **加载**：用骨架屏（`page-skeletons.tsx`），不在内容中间放转圈；链接跳转时显示 `LinkPending` 小指示。

## Do's and Don'ts

**Do**
- 颜色只用于设备类别和业务状态。
- 新的单选筛选复用 FilterTabs，新的状态徽章复用语义变体。
- 金额和数量使用等宽数字并右对齐。
- 滚动条、焦点框、选中文字使用主题色（已在 `styles.css` 中设置）。
- 每个控件都要处理默认、悬停、聚焦、禁用、加载、出错这几种状态。

**Don't**
- 不用渐变文字、装饰性毛玻璃、硬边偏移阴影。
- 不在页面标题上方加小号分类标签。
- 不用红色表示常态或空状态（例如无库存、草稿）。
- 不用 emoji 或 Unicode 符号代替图标，统一用 lucide 图标或自绘 SVG。
- 不为单个产品新增设备类型或符号。
- 能在页面内完成的任务不用弹窗。

## 公开页：产品即展示（首页、品牌页、下载页、登录页）

公开页是 Persuade 页面，按用户指定的 Linear / OpenAI 式产品官网执行：一张安静的画布（浅色白底，深色主题近黑，跟随用户主题），让示例项目的真实数据自己说话。方向记录在 `.impeccable/surfaces/src-app-frontend-page-tsx.md`。公用外框在 `src/components/landing/`：`landing-chrome.tsx`（导航、页脚、横版标识）、`section.tsx`（分区与分区标题）。

- **颜色**：只用全站语义变量（`background` / `foreground` / `muted-foreground` / `border` / `card`），没有专用的公开页色板。主按钮是墨色胶囊（浅色主题黑底白字，深色主题反转）；主题强调色只给选中态；设备类别色只出现在点位与图例上；「已确认」用成功徽章。
- **字体**：大标题 `text-display`、分区标题 `text-headline`、导语 `text-lead`（定义在 `styles.css` 的 `@theme`），标题一律 500 字重（Linear / OpenAI 的 Medium）加负字距；中文字形自带字面留白，字距只收一点。
- **产品窗口**（`plan-demo.tsx`）：白色面板 + 浅灰抬头条 + 1px 描边 + 一道带偏移的柔和投影（`shadow-window`），圆角 18px。抬头放项目名、「示例项目」标记、楼层分段控件、报价状态与合计；窗口内是「图例 | 户型图与点位 | 实时清单」。户型图在深色主题下也保持白纸。
- **分区**：左对齐大标题 + 一段导语，下面放真实部件（报价单样张、付款节点、交付文档目录、品牌墙）。容器 1152px（`max-w-6xl`），产品窗口 1280px；分区上下留白 80px / 112px（手机 / 桌面）。面板用 1px 描边 + 16px 圆角，不叠阴影；并列信息用发丝线网格（`gap-px` + 描边底）而不是一排浮起的卡片。
- **首屏**：居中大标题「画完点位，报价就好了」、两行导语、主按钮「进入工作台」与次按钮「看报价单样张」，下方紧接产品窗口，首屏露出窗口上半部分。
- **动效**：只有一处——设备从左到右落位、清单逐行出现（指数缓出）；系统开启「减少动态效果」时不播放。
- **性能**：首页报价单样张默认「简约」风格（走自托管字体链）；栖序雅致、东方雅韵等风格引用的思源黑体 / 宋体可变字体有十几 MB，只在访客点选时才加载。
- **不要**：渐变文字、毛玻璃、发光光晕、眉标小标签、彩色大底；不要编造客户、案例或业绩，演示数据只用示例项目里的真实内容并标明「示例项目」。
