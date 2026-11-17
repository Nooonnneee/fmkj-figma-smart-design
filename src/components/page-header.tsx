import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Heading, Text } from '@astryxdesign/core/Text'

import { cn } from '@/lib/utils'

/**
 * 工作台页面标题规格（全站统一，2026-11-15 视觉统一第一步）
 *
 * 实测基线（1440 宽，左侧导航 256）：
 * - 一级标题：Astryx `Heading level={1}` → 27px / 600 / 行高 36px（繁梦紫主题 `--text-heading-1-*`）
 * - 说明文字：14px / 400，与标题间距 4px
 * - 标题区与下方内容：外框 `gap-5`（20px），并有一条 `border-b` + 16px 内距把标题和内容分开
 *
 * **标题左边缘靠统一的内容栏对齐，不靠 `PageHeader` 自己加内边距。**
 * 所有工作台页面都用 `WORKBENCH_PAGE_CLASS`（`max-w-5xl` = 1024px，水平居中），
 * 页面标题是这一栏的第一个子元素。实测标题 x 坐标：
 *   1440 → 336（内容盒 1120 宽，1024 居中后两侧各留 48）
 *   1024 → 288（内容盒 768 宽，不足 1024，直接贴左）
 *   390  → 16
 * 改之前四个不同的左边缘是：/projects 288、/capabilities 336、/projects/[id] 400、
 * /settings 464 —— 各页自己的 `max-w-*` 把标题一起缩进了。
 *
 * 页面若确需更窄的阅读宽度，只收窄**内容**（例如表单卡片自身 `max-w-*`），
 * 不要把 `max-w-*` 加在含标题的外层容器上 —— 那会让这条竖线重新错位。
 *
 * 营销页（`/templates` 的 72px 主视觉、首页）不在本规格内。
 * （点位图编辑器页 `/projects/[id]/point-map` 是全宽画布工作区，无页面标题，属编辑器例外，不在本竖线规格内——见 point-map-editor.tsx 的 full-bleed 布局。）
 */
export const WORKBENCH_HEADING_LEVEL = 1

/**
 * 二级标题（项目内页「信息 / 报价 / 合同 / 归档 / 售后维保」这类板块标题）规格：
 * 与一级标题同一字号 token，只是语义降一级。
 *
 * 项目详情页没有 `<PageHeader>`：顶部项目条（项目名 14px + 板块切换）承担全局顶栏的
 * 角色，板块标题才是这页真正的页面标题。两者统一成 27px / 600 / 行高 1.3333，
 * 和 `Heading level={1}` 渲染出来的一致，锚点也落在同一条竖线上。
 */
export const WORKBENCH_SECTION_HEADING_CLASS =
  'text-[length:var(--text-heading-1-size)] leading-[1.3333] font-semibold text-foreground'

/**
 * 工作台页面统一外框：1024px 内容栏 + 纵向 20px 间距。
 * 直接加在各页最外层元素上；不要在调用处再写 `mx-auto max-w-*`。
 */
export const WORKBENCH_PAGE_CLASS = 'mx-auto flex w-full max-w-5xl flex-col gap-5'

/** 统一外框的组件写法（与 WORKBENCH_PAGE_CLASS 等价）。 */
export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <section className={cn(WORKBENCH_PAGE_CLASS, className)}>{children}</section>
}

/**
 * 页面标题区：标题 + 一句说明 + 右侧操作。各列表页、设置页统一使用。
 *
 * 视觉上改用 Astryx 的 Heading / Text 排版（语义层级、字号、行高都走设计系统 token），
 * 但 **对外 props 签名保持不变**，调用方（10 个页面）无需改动。
 * 分隔线仍用本仓 Tailwind 工具类，保持与既有页面间距一致。
 */
export function PageHeader({
  title,
  description,
  actions,
  badge,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  /** 标题右侧的状态标签（如 Beta）。不传时标题渲染与原来完全一致。 */
  badge?: React.ReactNode
  className?: string
}) {
  const heading = (
    <Heading level={WORKBENCH_HEADING_LEVEL} maxLines={2}>
      {title}
    </Heading>
  )

  return (
    <header
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-border pb-4',
        className,
      )}
    >
      <VStack gap={1} className="min-w-0">
        {badge ? (
          <HStack gap={2} vAlign="center" className="min-w-0">
            {heading}
            {badge}
          </HStack>
        ) : (
          heading
        )}
        {description ? (
          <Text type="supporting" maxLines={3} className="max-w-2xl text-pretty text-sm">
            {description}
          </Text>
        ) : null}
      </VStack>
      {actions ? (
        <HStack gap={2} wrap="wrap" vAlign="center" className="min-w-0 max-w-full">
          {actions}
        </HStack>
      ) : null}
    </header>
  )
}
