# 规划图（agent 可读摘要）

> 由 plan-tool 生成。**不要手改这份文件**——它每次从 JSON 重新生成。
> 要给图里加东西，写一份 add-only 补丁（格式见文末），交给 `node scripts/apply-patch.mjs`。

- 节点 26 个（AI 新增 0 个）
- 连线 6 条
- 生成于 2026-11-14 11:25:20

## 结构

- [业务域] 业务主线 `n-mwgbir9b-1`
  - [模块] 项目 `n-mwgbir9b-2`
  - [模块] 点位图 `n-mwgbir9b-3`
  - [模块] 报价 `n-mwgbir9b-4`
  - [模块] 合同 `n-mwgbir9b-5`
  - [模块] 归档 `n-mwgbir9b-6`
- [业务域] 产品与数据 `n-mwgbir9b-7`
  - [模块] 产品库 `n-mwgbir9b-8`
  - [模块] 设备类型字典 `n-mwgbir9b-9`
  - [模块] 品牌 / 品类 `n-mwgbir9b-a`
- [业务域] 账号与积分 `n-mwgbir9b-b`
  - [模块] 成员账号 `n-mwgbir9b-c`
  - [模块] 项目协作 / 分享 `n-mwgbir9b-d`
  - [模块] 积分与账单 `n-mwgbir9b-e`
- [业务域] 展示与输出 `n-mwgbir9b-f`
  - [模块] 方案模板 `n-mwgbir9b-g`
  - [模块] 打印文档 `n-mwgbir9b-h`
  - [模块] 公开站点 `n-mwgbir9b-i`
- [业务域] AI 能力 `n-mwgbir9b-j`
  - [模块] AI 对话 / 识图 `n-mwgbir9b-k`
  - [模块] 户型图风格化 `n-mwgbir9b-l`
  - [模块] AI 渠道配置 `n-mwgbir9b-m`
- [业务域] 平台与运维 `n-mwgbir9b-n`
  - [模块] 权限与角色 `n-mwgbir9b-o`
  - [模块] 插件注册 `n-mwgbir9b-p`
  - [模块] 部署 / 备份 `n-mwgbir9b-q`

## 连线

- [流程] 项目 `n-mwgbir9b-2` → 点位图 `n-mwgbir9b-3`
- [流程] 点位图 `n-mwgbir9b-3` → 报价 `n-mwgbir9b-4`
- [流程] 报价 `n-mwgbir9b-4` → 合同 `n-mwgbir9b-5`
- [流程] 合同 `n-mwgbir9b-5` → 归档 `n-mwgbir9b-6`
- [数据] 点位图 `n-mwgbir9b-3` → 设备类型字典 `n-mwgbir9b-9`：查类型
- [数据] 报价 `n-mwgbir9b-4` → 设备类型字典 `n-mwgbir9b-9`：同一字典

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

