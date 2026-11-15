# verification/ai-channels

成员自填 AI 渠道（自带 key）的**真实环境证据**。这些不是单元测试 ——
需要真的 Postgres + 真的 Payload，因为要证的性质（字段级 access、迁移回滚、
密钥轮换）在纯函数层面证明不了。

## verify-field-access.ts

证明「成员通过集合层 `/api/users` 改不动服务端字段」，且服务层仍然能写。

跑法（只碰演练库，别指生产）：

```bash
DATABASE_URI=postgres://fmkj@127.0.0.1:55432/fmkj_rehearse \
PAYLOAD_SECRET=rehearse-secret-0123456789abcdefghij \
PUBLIC_URL=http://localhost:3000 NODE_ENV=production \
  pnpm exec payload run verification/ai-channels/verify-field-access.ts
```

检查项：

1. 成员 `overrideAccess: false` PATCH 时，`apiKeyCipher` / `apiKeyHint` /
   `lastCheckedAt` / `lastCheckOk` / `lastCheckError` 的原值一个都没被改掉；
2. 成员连 `label` / `enabled` 也改不动（渠道只走 `/api/ai/channels`）；
3. 服务层 `overrideAccess: true` 仍然能写检查结果；
4. 成员读自己的文档时拿不到 `apiKeyCipher`，JSON 里没有密文。

失败时退出码非 0。

## 2026-11-15 的实测结论（值得记一笔）

最初只给子字段加 `update: () => false`，**实测不够**：Payload 处理 array 字段是
整段替换行数据，被拒绝写入的子字段会变成 `null`，而不是保留库里的原值。也就是
成员一次 PATCH 就能把自己的密文抹成 `null`（key 丢失，必须重填）。

修法是在 `aiChannels` 这一层写 `access.update`（只允许 CMS 超管）。成员维护渠道
一律走 `/api/ai/channels`，那条路径是服务层 `overrideAccess: true`，字段级 access
对它不生效。

## GraphQL 写 `aiChannels` 会被静默忽略（已知，不报错）

成员用 GraphQL `updateUser` 带上 `aiChannels` 时，返回 `200` 且 `errors` 为空，但字段
实际被集合层的 `access.update = false` 丢弃。**安全上成立**（写不进、伪造不了），只是
客户端会误以为成功。成员渠道的唯一受支持入口是 REST `/api/ai/channels`。

没有改成硬报错：正常「公司抬头」保存会把整个 `companyProfile`（含 `aiChannels`）读出来
再写回，硬报错会误伤；要区分「没改」和「想改」又依赖 Payload access 过滤与钩子的执行顺序。
判断依据与取舍写在 `src/collections/Users.ts` 的 `aiChannels` 注释里。

## 迁移回滚

`src/migrations/20261115_094654_ai_member_channels.ts` 的 `down` 曾在
`CREATE TYPE ... AS ENUM(...)` 里漏掉 `dashscope-token-plan`，导致带该值的生产行
回滚直接报 `invalid input value for enum ...`。演练方式与现场输出见 PR 说明；
关键前提是**回滚前库里真的有一行 `channel_id = 'dashscope-token-plan'`**，否则
测不出这个问题。
