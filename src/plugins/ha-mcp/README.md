# ha-mcp 插件运维说明

本插件通过 MCP 协议连接客户现场的 Home Assistant，读取设备、区域与系统健康，并在需要时调用服务控制设备。

## 连接配置

连接信息只放在服务端环境变量里，不下发给浏览器，也不出现在用户界面文案中：

- `HA_MCP_ENDPOINT`：MCP webhook 地址，形如
  `https://<你的 HA 域名>/api/webhook/<webhook-id>` 或
  `http://<ha-ip>:9584/private_xxx`。
- `HA_MCP_TOKEN`：可选。配置后放在请求的 `Authorization` 头里。

两项都缺省时，插件按「未配置」处理：不发起网络请求、不返回 500，页面与助手统一提示
「当前还没有连接 Home Assistant。请联系管理员完成连接配置后再查看。」

## 代码位置

- `mcp-client.ts`：MCP `tools/call` 协议翻译与请求发送。
- `ai-handlers.ts`：AI 工具调用入口；读环境变量、未配置时的提示。
- `overview-loader.ts`：智能家居页面（`/smart-home`）的只读数据加载。
- `overview.ts`：页面数据装配的纯函数与类型。

## 用户可见文案

面向普通成员的文案不得包含环境变量名、URL 形态或 token 字样。排障与部署信息只保留在
本文件和服务端日志/报错里。
