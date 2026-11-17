# 客户端直连 Home Assistant（第一期）提案

状态：**已批准**（noone 2026-11-17 口头「批准」；范围与配对方式 2026-11-16 已选定）。
批准范围：只读 + 白名单控制；配对方式为局域网自动发现 + 手填地址。

## 1. 要解决的问题

工作台里的「智能家居」页目前只能由**服务器**按环境变量（HA 地址 + 长期令牌）拉数据。
桌面客户端加载的是 `https://fmkj.top`，网页里不能直接请求用户局域网里的
`http://homeassistant.local:8123`：

- https 页面请求 http 局域网地址会被浏览器按混合内容拦掉；
- 跨源请求还受 CORS 限制，而 HA 默认不放行第三方 Origin；
- 长期令牌如果下发到渲染进程，任何一段被注入的脚本都能读走。

所以直连必须放在 Electron 主进程里做，渲染进程只拿聚合后的结果。

## 2. 架构（第一期）

```
web 页面(/smart-home)
   │  window.fanmengDesktop.ha.*   （仅桌面端存在）
   ▼
preload.js  ── contextBridge ──►  main 进程 ha 桥
                                     │  origin 校验 + 服务白名单
                                     ├─► HA REST/WebSocket（局域网）
                                     └─► safeStorage 里的长期令牌
```

- **令牌只存在主进程**（safeStorage 加密落盘），任何 IPC 都不返回令牌。
- **地址与令牌可修改**：客户端设置页（本地 `file://` 页面）新增「智能家居」区块。
- **自动发现**：主进程用 mDNS（`_home-assistant._tcp`）发现局域网实例，列出「名称 + 地址」；
  用户选中后填入地址，令牌仍需用户粘贴 HA「长期访问令牌」。
- **手填地址**：允许直接输入 `http://host:8123`；只接受 http/https，拒绝其它协议。
- **浏览器/服务器方案不变**：没有桌面桥时，`/smart-home` 继续用服务器 env 数据。

## 3. IPC 契约（渲染进程只读到这些）

```ts
window.fanmengDesktop.ha = {
  available(): Promise<boolean>                 // 桌面端且主进程桥就绪
  status(): Promise<{ configured: boolean; baseUrl: string | null; connected: boolean; version?: string; error?: string }>
  discover(opts?: { timeoutMs?: number }): Promise<Array<{ name: string; baseUrl: string }>>
  configure(input: { baseUrl: string; token: string }): Promise<{ ok: boolean; error?: string }>
  clear(): Promise<{ ok: true }>
  getStates(): Promise<Array<{ entityId: string; state: string; attributes: Record<string, unknown>; lastChanged: string }>>
  callService(input: { domain: string; service: string; entityId: string; data?: Record<string, unknown> }): Promise<{ ok: boolean; error?: string }>
}
```

校验规则：

- 所有 `ha:*` IPC 只接受**受信任来源**（当前配置的工作台 origin；设置页为 `file://`）。
- `callService` 只放行白名单：
  - domain：`light` / `switch` / `cover` / `climate`
  - service：`turn_on` / `turn_off` / `toggle` / `set_cover_position` / `set_temperature` / `set_hvac_mode`
  - `entityId` 必须属于 `getStates()` 返回过的实体，不匹配直接拒绝。
- 不做任意 service 透传；不暴露 WebSocket 原始通道。
- TLS 默认严格校验，不提供「忽略证书错误」开关（第一期）。

## 4. 分期

| 编号 | 内容 | 归属 |
|---|---|---|
| HC-1 | 主进程 HA 客户端、令牌存储、mDNS 发现、IPC 网关与来源校验 | desktop 主进程 |
| HC-2 | 客户端设置页「智能家居」区块：发现列表、手填地址、令牌、连通性测试 | desktop 设置页 |
| HC-3 | `/smart-home` 桌面分支：有桥时改为主进程实时数据，无桥时保持服务器数据 | web |
| HC-4 | 白名单控制按钮（灯/开关/窗帘/空调）+ 行为测试 | web + desktop 联调 |

## 5. 不做（第二期再议）

- AI 对话直接控制设备（需要中转与二次确认）。
- 历史曲线、摄像头、自动化编辑。
- 浏览器网页直连 HA、跨公网访问 HA。
- 任意 service / 任意实体透传。

## 6. 失败与回退

- 桥不可用、HA 不在线、令牌失效：`/smart-home` 显示明确状态与「去设置」入口，
  不回退成假数据，也不阻塞页面其余部分。
- 桌面端随时可在设置里清除配置，清除后行为与浏览器一致（用服务器 env 数据）。
- 服务端方案完全不动，回滚只需回滚客户端版本。
