---
version: 1
slug: "src-app-frontend-page-tsx"
primary_target: "src/app/(frontend)/page.tsx"
related_targets: []
---

# 首页（公开落地页）

Scope: `/` 首页。Visitor mode: Persuade。
Audience: 全屋智能设计师、小团队集成商；办公室电脑上首次了解，也会在客户现场用手机打开。
Job / action: 看懂「点位图直接出报价」，然后进入工作台（已登录）或登录。
Proof / content: 系统内置示例项目「湖山赋别墅全屋智能」的真实数据——3 层图纸、137 个点位、16 行报价、¥51,820、合同付款节点、可打印文档。不得编造客户、案例、评价或业绩。
Constraints: 静态页（ISR），读取示例母版项目；进入工作台需登录；界面语言简体中文。用户指定字体走 Linear / OpenAI 风格（2026-11 改版，替换「项目公示牌」方向）。

## Direction contract

THESIS: 首页就是产品本身，用 Linear / OpenAI 的克制来呈现：一张安静的浅色画布，让示例别墅「湖山赋」的真实数据自己说话——一扇能操作的点位图窗口、一份一键换装的报价单、一张自己算好付款节点的合同。拒绝：带色带抬头的公示牌堆叠、超粗黑体、深色 SaaS 首屏 + 发光截图 + 等宽功能卡。

OWN-WORLD: 白底（深色主题为近黑），墨色文字，冷灰次要文字，1px 发丝线分隔；产品窗口是白色面板 + 浅灰抬头条 + 细描边 + 一道带偏移的柔和投影，圆角 16px。字体：Inter 可变字体（大字号自动切到 Display 光学尺寸）+ 苹方 / 思源黑体，标题 500 字重（Linear / OpenAI 的 Medium）、负字距，正文 16–18px。颜色只承载信息：设备类别色只在点位与图例上，主题强调色（繁梦紫）只给选中态；主按钮是墨色胶囊。

STORY: 设计师看到一句「画完点位，报价就好了」，下面就是能动的点位图：悬停设备看价签，点清单行高亮同类设备，切楼层即时重算；往下看到同一份报价换 7 套风格、合同付款节点自动算好、产品库覆盖 27 个品牌；相信画完点位报价就好了，点击进入工作台。

FIRST VIEWPORT: 白底。顶栏：左侧横版标识，中间 4 个锚点，右侧「登录」与墨色「进入工作台」。居中大标题（约 72px，两行内），一句说明，主按钮「进入工作台」+ 次按钮「看报价单样张」（跳到报价单分区）。下方紧接通栏产品窗口（约 1200px 宽）：窗口抬头是项目名、「示例项目」标记、楼层分段控件和「已确认 ¥51,820」；窗口内左侧图例、中间真实户型图与设备图标、右侧实时清单，首屏露出窗口上半部分。

FORM: Linear / OpenAI 产品官网（用户指定的标准范式，按其完成度执行，不加私货），自拟清单第 1 / 1 项；seed: none (user-pinned；用户指定方向优先于抽签，未采用抽签结果)。

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved
- 构建路径：代码驱动（未调用付费图像生成）。
