# P5 · DropdownMenu 迁移评估（2026-11-13）

> 只读侦察结论。**A 档 = 0 处，本批不改代码。**
> 判定依据：`@astryxdesign/core@0.7.11` dist 类型定义 + 全仓 11 文件 45 处调用点逐一核对。

## 一、API 差异

### 本仓 `src/components/ui/dropdown-menu.tsx`（Radix 薄封装，15 个导出）

```
DropdownMenu / DropdownMenuPortal / DropdownMenuTrigger / DropdownMenuContent
DropdownMenuGroup / DropdownMenuLabel / DropdownMenuItem / DropdownMenuCheckboxItem
DropdownMenuRadioGroup / DropdownMenuRadioItem / DropdownMenuSeparator
DropdownMenuShortcut / DropdownMenuSub / DropdownMenuSubTrigger / DropdownMenuSubContent
```

触发模型：`<DropdownMenuTrigger asChild><Button/></DropdownMenuTrigger>` —— **一次性传入任意节点**。

### 官方 `@astryxdesign/core/DropdownMenu`（13 个导出）

```
DropdownMenu / DropdownMenuItem / DropdownMenuDivider / DropdownMenuGroup
DropdownMenuCheckboxItem / DropdownMenuRadioGroup / DropdownMenuRadioItem
DropdownMenuSubMenu / DropdownMenuContext / useDropdownMenuContext
（+ 类型 DropdownMenuProps / DropdownMenuItemData / DropdownMenuSection / …）
```

### 关键差异（四条，逐条实测）

| #   | 本仓                                                                                                 | 官方                                                                                          | 影响                                                                                |
| --- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | **触发物任意**：`DropdownMenuTrigger asChild` 包住调用方自己的节点                                   | **`button={…}` 或 `renderTrigger={props => …}`，二选一**；没有 `asChild`                      | 调用点必须改成 `renderTrigger` 并**把 `DropdownMenuTriggerProps` 散布到内部控件上** |
| 2   | **内容任意**：`DropdownMenuItem` 的 children 是自由 JSX（多 span / 徽标 / 内嵌 `<button>` / 富排版） | **`label` 是 prop，不收自由 children**；富内容只能走 `description` / `endContent`（各一个槽） | 多 span 排版、内嵌交互元素**无法表达**                                              |
| 3   | **`Sub` / `SubTrigger` / `SubContent` 三段式**                                                       | **`DropdownMenuSubMenu` 单体**（行本身 + `label`/`icon`/`items`/children）                    | 子菜单必须重写                                                                      |
| 4   | `RadioGroup` 用 `onValueChange`                                                                      | `RadioGroup` 用 **`value` + `onChange` + `label`（必填）**                                    | 签名不同                                                                            |

补充实测：

- `BaseProps`（官方所有组件的基类）**确实收 `className`** —— 所以「官方不收 className」不成立，`className` 不是差距点。
- 官方 `DropdownMenuGroup` 有 `title` 槽，可承接 `DropdownMenuLabel` 的分组标题。
- 官方 `DropdownMenu` 有 `header` / `footer` 槽，可承接菜单内的说明文字。
- **官方没有 `Shortcut` / `Portal` 的对应物**（`SubMenu` 自带浮层，不需要手工 Portal）。

## 二、评估表（11 文件 / 45 处）

| 文件                    | 处数 | 档    | 依据                                                                                                                                                                                                                             |
| ----------------------- | ---- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contract-preview.tsx`  | 1    | **B** | `DropdownMenuItem variant="destructive"` + `<Trash2/>` 图标 + 自由 children；触发物是 `<IconButton>`（走 `renderTrigger`）。改法机械：`icon={<Trash2/>} label="删除合同" variant="destructive"`                                  |
| `after-sales-board.tsx` | 1    | **B** | 3 项 + `Separator`；`onEdit/onDone/onDelete` 是 `onSelect` → `onClick`；`disabled={busy}` → `isDisabled`                                                                                                                         |
| `quote-editor.tsx`      | 3    | **B** | ①切换报价/③同步范围：item 内**两个 span + 当前项 `font-semibold`**，官方只能塞 `endContent`；②批量折扣：4 条纯文本，最干净的一处                                                                                                 |
| `point-map-editor.tsx`  | 4    | **B** | 楼层菜单 11 个 item、`Label` 带计数、楼层徽标 + `AlertTriangle`/`Ruler` 双图标并行；触发物外面还包着 `Tooltip`；`dwgEnabled` 分支动态渲染                                                                                        |
| `board-toolbar.tsx`     | 1    | **B** | 2~3 个 item，但末尾 `<p>` 说明文字是**非 item 的自由节点** → 必须搬到官方的 `footer` 槽                                                                                                                                          |
| `docs-client.tsx`       | 1    | **B** | 内容只有一项：**无 props 的组件** `<AppearanceMenuItems />` —— 官方 `children: ReactNode` 理论可放，但该组件内部是 3 组 `RadioGroup` + 3 个 `Label` + 2 个 `Separator`，整体要重写成官方 `RadioGroup`（签名不同）+ `Group title` |
| `print-toolbar.tsx`     | 1    | **B** | 2 个纯文本 item + 图标，机械可转 —— **但同文件内另有一段已迁移的 Astryx 分支**（`isDisabled/onClick/icon/endContent/label` 形态），必须一起改，否则两种 API 并存                                                                 |
| `appearance-menu.tsx`   | 1    | **C** | 3 组 `RadioGroup`（14 个 `RadioItem`）；`ACCENT_SWATCH` / `ASTRYX_SWATCH` 是**色板圆点 JSX**，官方 `RadioItem.icon` 只给一个图标槽。且 `AppearanceMenuItems` 被 `docs-client` 复用                                               |
| `app-sidebar.tsx`       | 2    | **C** | ①账户菜单的 `DropdownMenuLabel` 是**头像 + 姓名 + 邮箱三行复合块**，官方 `label: ReactNode` 收不下；②设置菜单 `DropdownMenuItem asChild` + `GuardedLink`（守卫跳转）+ 活动态高亮，官方 `href` 直链**绕不过守卫**                 |
| `ai-elements.tsx`       | 2    | **C** | **6 个 `DropdownMenuSub`**（三段式→单体）+ `CheckboxItem onSelect preventDefault` + `asChild` 内嵌 `Link` + 模板/项目/插件三组动态 `map`                                                                                         |
| `ai-sidebar-dock.tsx`   | 2    | **C** | `DropdownMenuItem` 内**嵌了一个删除 `<button>`**（`e.stopPropagation()`）—— 菜单行内的交互元素，官方 `label`/`endContent` 无法承载（官方自己的 `onClick` 也在行上，会和行内按钮冲突）                                            |

**统计：A = 0 / B = 7 / C = 4。**

## 三、为什么 A 档是 0

「A 档」的判据是**结构能一一对应、只换 import 就能编译且不丢功能**。这批 45 处无一满足：

1. **触发物全部是自定义控件**（`<Button>` / `<IconButton>` / 原生 `<button>` / `Tooltip` 包一层），
   而官方没有 `asChild`，只有 `button` / `renderTrigger` —— **每一处都得改触发物写法**，这已经是 B 的判据。
2. **`onSelect` → `onClick`、`disabled` → `isDisabled`、`onValueChange` → `onChange`**
   签名全面不同，`asChild` → `renderTrigger` 也要改。**没有一处能只换 import。**
3. **自由 children 是这个适配层的核心价值**：
   菜单行里的徽标、双图标、内嵌删除按钮、富文本排版，官方 `label: ReactNode` + `description` + `endContent`
   三个槽表达不了。这和小结里 Input 档的结论同构 ——
   **适配层存在的意义就是承接官方不收的东西**。

## 四、结论

**本批不转换。** `src/components/ui/dropdown-menu.tsx` 保留。

若将来要推进，建议顺序（性价比从高到低）：

1. `print-toolbar` + `quote-editor` 批量折扣 + `contract-preview` + `after-sales-board`
   —— 共 4 处纯文本/单图标菜单，可一次做完、单独验收。
2. `board-toolbar` + `point-map-editor` 导出菜单 —— 需处理 `footer` 槽。
3. `appearance-menu` / `ai-elements` / `ai-sidebar-dock` / `app-sidebar`
   —— 涉及 RadioGroup 改造、SubMenu 单体化、行内交互元素，属于独立工程，不建议并入「迁移」批次。

前置硬条件：官方先支持 `onSelect` 或 `asChild`，否则**每一处都必然改调用点，A 档在结构上不可能存在**。
