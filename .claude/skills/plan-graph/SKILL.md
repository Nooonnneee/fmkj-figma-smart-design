---
name: plan-graph
description: '读写 noone 的规划图（PLAN-GRAPH.json）。当 noone 说「在规划图上加个模块」「看看图上现在有什么」「把这块补进图里」「按规划图排开发」，或需要知道系统由哪些业务域/模块组成、它们怎么连时使用。只允许追加，绝不修改或删除已有节点。'
---

# 读写规划图

## 这是什么

`PLAN-GRAPH.json` 是 noone 用本地规划工具（`../output/plan-tool/`）手画的图，是他对系统的理解与规划。
`PLAN-GRAPH.md` 是它的只读摘要，**每次从 JSON 重新生成**。

三份东西的关系：

| 文件 | 谁写 | 内容 |
| --- | --- | --- |
| `PLAN-GRAPH.json` | 工具 / 本 skill 的补丁 | 真源。节点树 + 连线 |
| `PLAN-GRAPH.md` | 脚本自动生成 | 给人也给 agent 读的摘要 |
| `PLAN.md` | noone 和 agent 都写 | 任务队列（一行一条待办） |

图是**意图和结构**，`PLAN.md` 是**队列**。图变了，队列跟着变；但不要反过来为了对齐队列去改图。

## 读

读 `PLAN-GRAPH.md` 就够了，里面有完整树、连线、以及所有节点 id。
需要原始坐标或完整字段再读 `PLAN-GRAPH.json`。

节点类型：`domain` 业务域 / `module` 模块 / `feature` 功能 / `page` 页面 / `device` 设备 / `template` 模板 / `note` 便签。

连线类型：

| 类型 | 含义 | 什么时候用 |
| --- | --- | --- |
| `route` | 流程 | A 之后做 B，或操作 A 产出 B |
| `call` | 调用 | 代码上一个模块调另一个模块 |
| `data` | 数据 | 共享同一份数据（同字典、同表） |
| `dep` | 依赖 | 软依赖，不是主链路 |

## 写：只允许追加

**这是硬约束，不是建议。** noone 明确要求：AI 补充可以，动他已经画好的部分不行。

流程：

1. 读 `PLAN-GRAPH.md`，找到要挂靠的父节点 id。
2. 写一份补丁到临时文件（**不要**直接编辑 `PLAN-GRAPH.json`）：

   ```json
   {
     "add": {
       "nodes": [
         { "id": "a-<短名>-1", "type": "module", "title": "模块名", "parentId": "n-xxx", "note": "一句话说明" }
       ],
       "edges": [
         { "id": "a-e-<短名>-1", "type": "data", "from": "a-<短名>-1", "to": "n-yyy", "label": "为什么连" }
       ]
     }
   }
   ```

3. 先干跑（**默认不写盘**）：

   ```bash
   node ../output/plan-tool/scripts/apply-patch.mjs PLAN-GRAPH.json /tmp/patch.json
   ```

   退出码 0 = 合法，1 = 被拒。被拒时看错误码，改补丁，别改规划图。

4. 给 noone 看补丁内容，等他确认再落盘：

   ```bash
   node ../output/plan-tool/scripts/apply-patch.mjs PLAN-GRAPH.json /tmp/patch.json --write
   ```

   落盘会自动备份原文件，并同时刷新 `PLAN-GRAPH.md`。

## 会被拒绝的写法（不要试）

- 顶层出现 `update` / `remove` / `delete` / `rename` → `NOT_ADD_ONLY`
- 想改已有节点的标题、父亲、坐标 → 没有这条路径，**必须问 noone 在工具里改**
- id 与已有节点冲突 → `DUPLICATE_ID`
- 父节点不存在 → `PARENT_MISSING`
- 连线指向不存在的节点 → `DANGLING_EDGE`
- 父子成环 → `CYCLE`
- 补丁里写 `origin: "user"`（冒充人类） → `FORCE_ORIGIN`

一份补丁里只要有一条不合法，**整份被拒**，文件一个字节都不动。

## 补图的判断标准

加之前先问自己三件事，答不上就别加：

1. **它属于哪个已有业务域？** 挂不上任何域，说明这是新领域，先问 noone 要不要开新域 —— 不要自己开。
2. **它是模块、功能，还是页面？** 域下面挂模块，模块下面才是功能/页面。别把功能挂到域上。
3. **有没有连线？** 孤零零一个节点没有价值。至少说明它跟谁有 `data` 或 `call` 关系。

加的时候：

- 标题用系统里的真实名词（`设备类型字典` 而不是「类型表」）。
- `note` 一句话说清「谁用、解决什么」，不要抄标题。
- 不确定的加 `note` 里写「待确认」，不要编造已有实现细节。

## 补完之后

- 告诉 noone 加了什么、挂在哪、连了谁。
- 如果这次补充改变了模块边界 / 数据模型 / 权限 / 插件归属 —— 按 `AGENTS.md` 红线，那属于**架构变更**，需要先写提案等 noone 批，不能只补图了事。
- 把可执行的部分写进 `PLAN.md` 待办，格式见该文件顶部。

## 工具在哪

`../output/plan-tool/`（本地，不入库）。起法见该目录 `README.md`。
不变量检查：`node ../output/plan-tool/scripts/verify.mjs`（26 项，几毫秒）。
