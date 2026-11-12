# P5 · 剩余 15 个小适配层档批量评估（2026-11-19）

> **A 档 = 0 处，本批不改代码。**
> 依据：`@astryxdesign/core@0.7.11` dist 的 `.d.ts` + `.js` 实现逐一核对，
> 加上**真实浏览器实测**（本地 dev :3000 + Playwright）拿到的两条决定性证据。

## 一、结论先行

和 Input / DropdownMenu / textarea / select 四档同一个结论：

**适配层存在的意义，就是承接官方组件不收的东西。**
引用数越少，这条越明显 —— 因为「少」本身往往是同一个成因：**剩下的少量调用点，
正好是那些官方表达不了的**。能直接换 import 的调用点在早几批就已经转完了。

## 二、评估表（15 档 / 30 处）

| 组件          | 引用 | A   | B   | C   | 主要原因                                                                                                                                                                                                                                                                                                       |
| ------------- | ---- | --- | --- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tooltip`     | 4    | 0   | 0   | 4   | 适配层是**三段式 → 官方单体**的运行时解析器（`splitParts`）。官方没有 `TooltipTrigger` / `TooltipContent` / `TooltipProvider` / `hidden`。4 处调用点全是 `<TooltipTrigger asChild><X/></TooltipTrigger>` + `side`/`align`，每处都得改写结构                                                                    |
| `separator`   | 3    | 0   | 3   | 0   | A 的唯一前提（`data-vertical:*` 类名能否穿透到官方组件）**已实测成立**，但 3 处没有一处只需换 import：2 处真实渲染点都要 `cn()` 合并 `shrink-0`、`orientation` 类型收窄、`decorative` 语义需改写                                                                                                               |
| `table`       | 3    | 0   | 0   | 3   | 官方 `Table` 是**数据驱动**（`data` + `columns`）。children 模式下 `<TableHeader>` / `<TableBody>` / `<TableFooter>` **`props` 不收 `className`**（只 `BaseProps<HTMLTableSectionElement>`，传了不渲染到 `<thead>` 上）；本仓导出 `TableHead`，官方只有 `TableHeaderCell`。3 个文件全是手写 `<tr>/<td>` 富内容 |
| `button`      | 2    | 0   | 0   | 2   | 引用数 2 里有 1 个是**幽灵**：`ai-panel.tsx` 全仓零引用（死代码，P4 已核定）。剩 `board-toolbar` 1 处 13 个调用点，全是自由 children + `size="xs"`（官方只有 sm/md/lg），官方要 `label` 必填                                                                                                                   |
| `kbd`         | 2    | 0   | 2   | 0   | 官方 `Kbd` 是 **`keys="mod+k"` 合一渲染器**（自动按平台把 `mod` 换成 ⌘/Ctrl、`role="img"` + 拼出来 `aria-label`）。本仓是自由 children（`<Kbd>{t.key}</Kbd>`）+ `KbdGroup`。语义、结构、DOM 都不同                                                                                                             |
| `progress`    | 2    | 0   | 2   | 0   | 签名几乎同构，唯一的坎是 `editor-panels.tsx:852` 的 `className="h-1.5"` 要落到**官方内部的 bar** 上（不是外层容器）。且官方强制 `hasValueLabel` 显示数值，`delivery-package` 已在旁边自己画了 `done/total` → 会出现两处重复数字                                                                                |
| `radio-group` | 2    | 0   | 0   | 2   | 官方 `RadioList` 要 `label` 必填 + **整行模型**（圆点+标签+描述一体）。`appearance-settings` 是**圆点绝对定位脱离标签**的选择卡片（`RadioGroupItem` 自带 `id` 被外层 `Label htmlFor` 引用），官方表达不了                                                                                                      |
| `scroll-area` | 2    | 0   | 0   | 2   | 官方 `ScrollableArea` **不渲染滚动条**（内部收拢）。2 处里 `ai-panel` 是死代码；`swap-product-dialog` 靠 `flex-1 basis-80` 撑高，官方 `axis`/`role` 是收窄枚举                                                                                                                                                 |
| `badge`       | 1    | 0   | —   | —   | 唯一引用点 `delivery-package.tsx:9` **只 import 从不渲染** —— 是死导入，不是调用点                                                                                                                                                                                                                             |
| `command`     | 1    | 0   | 0   | 1   | 唯一引用点 `quote-editor.tsx` 用的是一整套适配器（`Command`/`CommandInput`/`CommandList`/`CommandEmpty`/`CommandGroup`/`CommandItem`）；官方 `CommandPalette` 是 `searchSource` 数据驱动                                                                                                                       |
| `dialog`      | 1    | 0   | 0   | 1   | 唯一引用者是**适配器内部**（`command.tsx` 的 `CommandDialog`），而 `CommandDialog` 本身全仓零食用 —— 两层都是死代码。官方无 `Trigger`/`Close`/`Content` 复合 API                                                                                                                                               |
| `input-group` | 1    | 0   | 0   | 1   | 唯一引用者也是 `command.tsx`（`CommandInput` 的搜索框）。官方 `InputGroup` 要 `label` 必填                                                                                                                                                                                                                     |
| `sheet`       | 1    | 0   | 0   | 1   | 唯一引用者是 `sidebar.tsx` 的移动端抽屉。官方没有 Sheet（最接近的 `Drawer`/`BottomSheet` 不是同一模型）                                                                                                                                                                                                        |
| `sonner`      | 1    | 0   | 0   | 1   | 官方**没有 Toaster 容器**，只有 `Toast` 单条基础件；`sonner` 的命令式 `toast()` API 无对应物                                                                                                                                                                                                                   |
| `switch`      | 1    | 0   | 0   | 1   | `company-form.tsx:328` 用 **`defaultChecked` + `name`（非受控，走 FormData）**。官方 `Switch` 只有 `value`（必填、受控）、没有 `defaultChecked` —— 与 Textarea 档被否决的是同一条死路                                                                                                                          |

**统计：A = 0 / B = 5 / C = 9 / 无效引用 1。**

## 三、两条实测证据（本批新增，不是推理）

前几批都是「读类型定义 + 读调用点」下的结论。本批有 2 处**只看代码判不出来**，
所以起了本地 dev + Playwright 真机量。这两条值得记下来，以后不用重测。

### 证据 1：Tailwind 类名**确实**会穿透到官方组件（`separator` 档）

担心的问题是「官方组件内部是 StyleX，`data-vertical:h-4` 这种类名挂在外层 div 上，
能不能定位到官方内部那条线」。实测结论：**能**。

`project-header.tsx` 传的 `data-vertical:h-5`（官方默认 16px，这个要 20px），量到：

```
外层 div  astryx-divider … data-vertical:h-5 data-vertical:self-center
          rect 1 × 20      align-self: center        ← 类名生效
内层线    rect 1 × 20      bg rgb(226,226,232)        ← 同步了
```

换成官方默认的 `h-4` 场景（`site-header`）量到 `1 × 16` —— 两个值不同，
所以「生效」不是巧合，是真被应用了。（**注意**：`h-4` 恰好等于官方默认值，
用它验证会假阳性 —— 这正是「看着转了、其实静默没生效」那类坑。）

**但 A 仍然是 0**：能力成立 ≠ 调用点能只换 import。3 处分别是
`cn('shrink-0', className)` 合并、`decorative` → `aria-hidden`/`role` 语义翻译、
以及 `React.ComponentProps<typeof Separator>` 的类型收窄，都要改调用点。

### 证据 2：`SidebarSeparator` 的 `w-auto` 在官方横向 Divider 上**毫无作用**

`sidebar.tsx:449` 的 `SidebarSeparator` 传 `mx-2 w-auto bg-sidebar-border`，
是 radix 时代的写法。官方横向 Divider 的 DOM 是
`div[role=separator] > div`（**竖线横放**：1px 宽、高度撑满），
`w-auto` 与官方 1px 宽度一拍即合，量到的结果和不传 `w-auto` **完全一样**：

| 变体                                    | outer         | inner    |
| --------------------------------------- | ------------- | -------- |
| `mx-2 w-auto bg-sidebar-border`（原样） | 1 × 16        | 1 × 0    |
| `mx-2 bg-sidebar-border`（去掉 w-auto） | 1 × 16        | 1 × 0    |
| `mx-2 h-px w-full bg-sidebar-border`    | **1144** × 16 | 1144 × 0 |

即：**这个组件启用后会渲染成一条 1px 宽的小竖线，不是分隔线。**

不过 —— 全仓 `SidebarSeparator` **零渲染点**（只在 `sidebar.tsx` 内定义 + 导出，
无任何消费者；三个页面实测都只有 1 条 separator，且都是 `site-header` 那条竖线）。
所以这是一处**死代码 + 潜在样式 bug**，不是现网问题。归 P5 清理，不进本批。

## 四、死代码清单（本批扫出，建议 P5 清理时一并删）

| 位置                                                 | 情况                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| `src/plugins/ai-import/ai-panel.tsx`                 | 全仓零引用（P4 已核定）                                      |
| `src/components/ui/command.tsx` → `CommandDialog`    | 定义了但零食用；它还拖着 `dialog` + `input-group` 两个适配层 |
| `src/components/ui/sidebar.tsx` → `SidebarSeparator` | 零渲染 + 横向样式已失效（证据 2）                            |
| `delivery-package.tsx:9` → `import { Badge }`        | 死导入，只 import 不渲染                                     |

这四项合起来说明一件事：**`dialog` / `input-group` / `badge` / `table` 的低引用数
有相当一部分是「引用方自己也是死的」，不是「调用点简单到能直接换」。**

## 五、结论

**本批不转换，`src/components/ui/` 下这 15 个文件全部保留。**

若要推进，建议顺序（都是从 B 档里挑最干净的）：

1. `progress` 的 1 处（`delivery-package`）—— 前提是先确认 `hasValueLabel` 与调用点
   自己画的 `done/total` 不重复，属于**产品决策**，不是迁移。
2. `separator` 的 2 处 —— 能力已验证成立，纯机械改写 + 一次冒烟。
3. 其余不进「迁移」批次：`table`（数据驱动改造）、`radio-group`（选择卡片）、
   `tooltip`（三段式）、`sheet`/`sonner`（官方无对应物）都是**独立工程**。

前置硬条件同 DropdownMenu：官方先给出 `asChild` 或自由 children 的等价物，
否则**每一处都必然改调用点，A 档在结构上不可能存在**。
