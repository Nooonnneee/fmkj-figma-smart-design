# harness-mcp：对外暴露站点能力的 MCP 接口层（第一期）

把「站点能力」给外部 DeepSeek harness 走 MCP（Streamable HTTP）调用。
只暴露白名单内的业务工具（改项目 / 布点位 / 改报价 / 改合同），执行落回
`src/plugins/ai-copilot/registry.ts` 的 `runTool()`，不重写任何业务逻辑，
写权限仍走现有 `canEditProject` 守卫。

## 环境变量

| 变量                  | 必填           | 说明                                                                           |
| --------------------- | -------------- | ------------------------------------------------------------------------------ |
| `HARNESS_MCP_ENABLED` | 否             | **默认关闭。** 必须为 `"1"` 才启用端点；其它值 / 缺省 = 关闭（请求直接 404）。 |
| `HARNESS_MCP_KEYS`    | 仅在启用时需要 | 逗号分隔的 `key=userId` 映射，每对把一个 bearer key 绑定到一个受限账号。       |

`HARNESS_MCP_KEYS` 示例：

```
HARNESS_MCP_ENABLED=1
HARNESS_MCP_KEYS=someLongRandomKey1=user_1ab2,anotherLongRandomKey2=user_3cd4
```

- key 与 userId 都**不要写进代码或提交到仓库**，由部署方在环境配置里提供。
- 每个 key 映射到一个「受限账号」：只授予白名单权限（改项目 / 布点位 / 改报价 /
  改合同 + 支撑只读），**绝不给**站点配置 / 兑换码 / 积分系统 / 生图等权限。
  受限账号先在 `users` 集合里建好，把它的 `id` 填进映射。
- key 用随机高熵长串；服务端用恒定时间比较避免时序侧信道。

## 端点

- `POST /api/harness-mcp`（Streamable HTTP，JSON-RPC 2.0，只实现 POST）。
- 请求头必须带 `Authorization: Bearer <key>`。
- 已实现方法：`initialize`、`tools/list`、`tools/call`。其它一律 `-32601`。
- 校验失败 / 未配置 / 未启用 → 401 / 404，不泻细节。

支持的三个方法形如：

```jsonc
// tools/list
{ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }
// tools/call
{
  "jsonrpc": "2.0", "id": 2, "method": "tools/call",
  "params": { "name": "update_project", "arguments": { "projectId": "p1", "name": "新名称" } }
}
```

工具 `arguments` 里的每个键都是该工具真实参数并原样透传；工具未声明的键会被 handler 忽略（见下方保留参数说明）。

### 保留参数 `__projectId`

部分布点位类工具（`add_floor_sheet` / `setup_rooms_and_points` /
`import_points_json`）没有 `projectArg`，靠 `ctx.projectId` 定位目标项目。
外部调用可用保留参数 `__projectId` 指定项目：

```jsonc
{ "name": "setup_rooms_and_points", "arguments": { "__projectId": "p1", ... } }
```

它只用于填充 `ctx.projectId`，会在传给 `runTool()` 前被剥掉，**不会**进入业务参数。

## 工具白名单（第一期，只泻这些）

改项目：`list_projects` `create_project` `update_project` `get_project_details`
布点位：`add_floor_sheet` `import_points_json` `setup_rooms_and_points` `plan_points_with_vision`
改报价：`create_or_update_quote` `create_quote_from_competitor`
改合同：`create_or_update_contract`
支撑只读：`search_products`

判定在 `src/plugins/harness-mcp/config.ts` 的 `isWhitelistedTool`：
**同时**要求「工具名在显式 allowlist」且「所需权限全在权限白名单」。仅靠权限白名单不够，
因为 `projects:write` 也会被 `delete_after_sales_record` 这类破坏性工具共用；破坏性 /
删除 / 站点配置 / 生图 / 积分操作一律不在此期放行。

## 审计

每次 **write 类**（`mutates: true`）调用都会记一条结构化审计：
时间 / 工具 / 受限账号 / 目标项目 / 结果，经 `console.info` 落到 stdout，便于日志采集。
绝不在审计里写 key / token。审计失败不会让业务调用失败。
（本版走 stdout；后续如需落进现有 ledger，在 `src/plugins/harness-mcp/audit.ts` 加一行即可。）

## 后端对接

装好环境变量后，把 MCP server 端点地址告诉 DeepSeek harness 做 `mcpServers` 配置，
bearer key 由外部保管。

## 本期不做（后续待决）

- 不做 AI 生图、不改站内计费 / 积分逻辑。
- 不动 `@payloadcms/plugin-mcp` 全量暴露（保留原样）。
- 不做「改前确认回滚门」（第一版无确认门，靠审计事后盯；删除 / 永久操作未放行作为兜底）。
