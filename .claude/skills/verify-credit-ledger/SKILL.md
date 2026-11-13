---
name: verify-credit-ledger
description: 'Formally verify the AI credit ledger: a charge or grant must leave users.aiCredits equal to the opening balance plus every committed ai-credit-ledger row, and a charge must never spend more than the balance. Use when changing src/collections/AiCreditLedger.ts, or anything that creates rows in ai-credit-ledger (AI 对话计费、AI 生图、户型图风格化、兑换码、积分任务).'
---

# Verify the AI credit ledger

## What this guards

Every AI charge and every grant writes one row into `ai-credit-ledger`; the
collection's hooks then write `users.aiCredits`. Two promises come out of that:

> **1. 账户余额 = 期初余额 + 所有已入账流水之和。**
> **2. 积分不足时，扣费必须被拒绝——流水合计永远不会被花成负数。**

Both are easy to keep on paper and easy to break in practice, because they
depend on the **order** of two concurrent requests' reads and writes, which no
unit test naturally covers.

## The rules the model checks

| Rule                   | In the reader's words                            | If it breaks                                                                                        |
| ---------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `BalanceMatchesLedger` | 充值不会凭空消失，扣费也不会凭空多扣             | 两笔扣费都记了流水，余额只减了一次 → 用户白嫖 AI；两笔发放都记了流水，到账只加一次 → 用户充的钱少了 |
| `NoOverdraft`          | 余额不够的那一笔必须被拒，流水合计不会被花成负数 | 用户以一份积分的价钱跑了两份 AI                                                                     |

## Coverage record

| Covered by the model                                                               | File                                                         | Symbol / line                                                                                              |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| 加锁读余额（`SELECT ai_credits ... FOR UPDATE`），算 `balanceAfter`，负数时 402    | `src/collections/AiCreditLedger.ts`                          | `lockUserBalance`（第 22 行起，锁在第 26）＋ `beforeChange`（第 55 行起，`balanceAfter` 在 66、守卫在 67） |
| writes `users.aiCredits = doc.balanceAfter`（在锁内、同一个事务）                  | same                                                         | `afterChange`（第 73 行起，写入在 79）                                                                     |
| 扣费调用点                                                                         | `src/plugins/ai-copilot/chat-handler.ts`                     | `chargeAiCredits`（写 `ai-credit-ledger`），第 665 行                                                      |
| 扣费调用点                                                                         | `src/app/api/ai/images/route.ts`                             | 第 79 行（前置检查在第 69 行）                                                                             |
| 扣费调用点                                                                         | `src/app/api/ai/images/style/route.ts`                       | 第 78 行（前置检查在第 63 行）                                                                             |
| 扣费调用点                                                                         | `src/plugins/ai-copilot/tools/core-handlers.ts`              | 第 1277 行                                                                                                 |
| 发放调用点（兑换码，同一事务内、兑换码行加锁）                                     | `src/lib/services/membership-service.ts`                     | 第 129 行 create（加锁在第 72 行）                                                                         |
| 发放调用点（任务奖励）                                                             | `src/lib/credit-tasks.ts`                                    | 第 159 行                                                                                                  |
| 模型依赖的事实 1：hooks 与插入在同一个事务                                         | `node_modules/payload/dist/collections/operations/create.js` | 第 46 行 `initTransaction`                                                                                 |
| 模型依赖的事实 2：跑在默认隔离级别（READ COMMITTED）                               | `src/payload.selfhost.config.ts`                             | 第 158 行 `postgresAdapter({...})`，没有 `transactionOptions`                                              |
| 模型依赖的事实 3：`beforeChange` 在同一个事务里对 user 行加锁（对应 `Locked.cfg`） | `src/collections/AiCreditLedger.ts`                          | `lockUserBalance` 第 26 行 `FOR UPDATE`，走 `req.transactionID` 的事务                                     |

**Sync commit:** `681acf3`（2026-11-13，`fix/ai-billing-integrity`）

Move this commit forward **only** after confirming the model still describes the
code at the new commit — walk the table above and re-read each symbol. If a call
site moved or a new one appeared, update the model and the table first.
This is the commit where the row-lock fix (`f1dd4e8`), the membership fix
(`9900545`), the `chargeAiCredits` call-site move (`dc93aae`) and the tool-registry
changes were all last re-read against the table.

## Run it

```sh
bash verification/credit-ledger/verify.sh
```

It checks each rule against each of the three configs and prints a verdict per
rule. After the row-lock fix landed it must print:

```
▸ Current
  BalanceMatchesLedger   ✅ 成立
  NoOverdraft            ✅ 成立
▸ Locked
  BalanceMatchesLedger   ✅ 成立
  NoOverdraft            ✅ 成立
▸ NoGuard
  BalanceMatchesLedger   ✅ 成立
  NoOverdraft            ❌ 违反

违反次数：1（应为 1：只有 NoGuard 的 NoOverdraft）
```

`Current.cfg` and `Locked.cfg` now describe the same code (the fix landed), so
both hold. `NoGuard.cfg` is that same fix with the 402 check deleted: it exists to
show that `NoOverdraft` is testing the check itself, not just the lost update — a
rule that never fails proves nothing. The lost-update counterexample is no longer
reproduced by a config; it lives in git history and in the "Known result" section
below.

The real hooks are also replayed, without a database:

```sh
pnpm exec vitest run -c verification/credit-ledger/vitest.config.ts
```

`verification/credit-ledger/replay.test.ts` drives the **real** `beforeChange` /
`afterChange` from `AiCreditLedger.ts` through a two-phase in-memory store that
mimics two overlapping transactions (reads see committed data only) and models the
row lock as a promise the second transaction waits on. Both cases now assert the
fixed behaviour: two concurrent charges serialize, and the second is refused with 402. The store's lock is our own emulation, not Postgres's — see the first bullet
under "What this does NOT cover".

### Toolchain notes for this machine

- **No `mise`**, so the statechart skill's auto-install path cannot run.
  `verify.sh` calls TLC directly and only needs `TLA2TOOLS` and `JAVA`; both
  default to `~/.cache/fv-tla/` and both live **outside the repo** — never commit
  tool binaries.
- `tla2tools.jar` is the official v1.7.4 release, sha256
  `936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88`. Any JRE 11+
  works; 21 is what is installed here.
- A TLA+ module name must match its file name (`Ledger.tla` → `MODULE Ledger`).
- TLC config files do **not** accept a unary minus in a set constant, which is
  why `Deltas` is defined in `Ledger.tla` and not in the `.cfg`.

## Reading a result

Read every counterexample with the pstack **`/statechart`** skill: it turns each
violation into the shortest path in plain words（「1 号读到余额 5 → 2 号也读到
余额 5 → 2 号写回去 → 1 号把旧的余额盖回去」）and, when nothing breaks, draws how
the account moves between states. `verification/credit-ledger/report.md` and
`chart.mmd` are that reading at the sync commit.
`verification/credit-ledger/view.ts` holds the Chinese labels for the chart;
pass it along with the model.

Raw TLC output (what `verify.sh` writes) is a variable dump; the same run through
`/statechart` is what you show a person.

### Opening the diagram

Two committed files next to the model, both rendered from the same run:

- `chart.svg` — 双击用浏览器打开；拖进微信 / 飞书 / Slack；GitHub 的文件页也会
  直接渲染它。带主题色，明暗都能看。
- `chart.mmd` — 纯文本 Mermaid。贴到 <https://mermaid.live>，或在 VS Code 装
  Mermaid 插件预览，或放进 Markdown 的 ```mermaid 代码块（GitHub / Obsidian 会渲染）。

要 PNG（贴进 PPT / 文档）：`qlmanage -t -s 7405 -o /tmp/out verification/credit-ledger/chart.svg`，
产物在 `/tmp/out/chart.svg.png`。这个 PNG 别提交，1.6 MB。

`chart.svg` 是 `chart.mmd` 用 pele 渲染的派生文件，模型或 `view.ts` 改了要重新生成再
一起提交；`verify.sh` 不重新生成它。

## Known result

**Before the row-lock fix, both rules broke on the code. That is the finding this
model was built to make, not a modeling error.** The fix (`lockUserBalance` in
`AiCreditLedger.ts`) is `Locked.cfg`; now that it has landed, `Current.cfg` sets
`Atomic = TRUE` as well, so both rules hold for both.

| Config                                         | `Atomic` | `Guard` | Result                                                      |
| ---------------------------------------------- | -------- | ------- | ----------------------------------------------------------- |
| `Current.cfg` / `Locked.cfg` (the fix, landed) | TRUE     | TRUE    | rules hold                                                  |
| (the code before the fix, for reference)       | FALSE    | TRUE    | `BalanceMatchesLedger` **breaks**, `NoOverdraft` **breaks** |
| `NoGuard.cfg` (fix minus the check)            | TRUE     | FALSE   | `NoOverdraft` **breaks**                                    |

### The counterexample, in the code's words

（修复前的反例，保留作为「模型确实能抓到这个 bug」的证据。修复后 `Current.cfg`
不再复现它。）

```
1. 用户余额 5，两笔扣 5 分的 AI 请求同时到账
2. 请求① 进 beforeChange：读到 users.aiCredits = 5，算出 balanceAfter = 0，不是负数，放行
3. 请求② 进 beforeChange：请求① 还没提交，也读到 5，算出 0，放行
   ← 两条事务的「读」都发生在对方提交之前（READ COMMITTED 下各自看到已提交的旧值）
4. 请求① 插入 -5 流水，afterChange 写 users.aiCredits = 0，提交
5. 请求② 插入 -5 流水，afterChange 写 users.aiCredits = 0，提交
```

After step 5 the ledger holds two `-5` rows but the account lost only 5. Expected
balance `5 + (-10) = -5`, stored balance `0`. **Correct behaviour: only one of the
two may succeed** — each `-5` is affordable on its own, so the fault is not that
request ② was individually unreasonable; it is that the two were not serialized,
and the second should have re-read 0 and been refused with 402. It was not.

The other direction is just as real: two overlapping **grants** both read the old
balance and both write the same `balanceAfter`, so the account receives one grant
while the ledger records two.

Grants were only partly protected. `src/lib/credit-tasks.ts:82` wraps task
rewards in an **in-process** mutex keyed `bind_wechat` or `${taskId}:${userId}`.
So the same task for the same user in one process cannot race — but two _different_
tasks for the same user (different keys; `loadAndSyncUserCreditTasks` fires
`bind_email` and `bind_wechat` at `credit-tasks.ts:239`) and two server processes
are still exposed. 兑换码核销 (`membership-service.ts`) used to have the same
read-modify-write shape on `usedCount` and on the per-user `redeemedBy` check with
no lock at all; it now runs the whole redemption in one transaction behind a
`SELECT ... FOR UPDATE` on the code row, so two concurrent redemptions cannot both
pass. It is still not modelled in `Ledger.tla`.

### Why the model matches the code

- `payload.create` opens a transaction and its hooks run inside it
  (`initTransaction`, `node_modules/payload/dist/collections/operations/create.js:46`),
  so the ledger row and the `users.aiCredits` write do commit together — one
  indivisible step, as modelled.
- That adapter is configured without `transactionOptions`
  (`src/payload.selfhost.config.ts:158`), so the isolation level is Postgres's
  default **READ COMMITTED**.
- Before the fix nothing locked the user row: the `beforeChange` read saw the last
  committed value, and the `afterChange` write was a blind
  `UPDATE users SET ai_credits = $1` (a literal, not `ai_credits + $1`), so the
  later commit overwrote the earlier one. There is no `version` / optimistic lock
  on `users` or `ai-credit-ledger`, and no unique constraint on the ledger table.
- The fix keeps that literal write but now holds the user row
  (`lockUserBalance`, `SELECT ... FOR UPDATE`) from `beforeChange` until the
  transaction commits, so the read-modify-write is serialized and the second
  request re-reads the committed balance.
- The deployed config is this one: `src/payload.config.ts` is
  `export { default } from './payload.selfhost.config'` and the Dockerfile forces
  `PAYLOAD_CONFIG_PATH=src/payload.selfhost.config.ts`. `AGENTS.md` / `CLAUDE.md`
  describe a Figma-managed platform database; for this question the code is ahead
  of those docs, and the Postgres reasoning above is the correct one.

### The fix (landed)

The row-lock form was chosen: 在 `beforeChange` 里先对这条 user 加行锁
（`SELECT ... FOR UPDATE`，走 `req` 同一个事务），afterChange 照旧写回
`doc.balanceAfter`。它等价于 `Locked.cfg`，也保住了 402 守卫。
另一条等价路线是把余额更新改成
`UPDATE users SET ai_credits = ai_credits + $delta WHERE id = $id AND ai_credits + $delta >= 0`
并用 `RETURNING` 的余额回填 `balanceAfter`；数据库隔离级别调成可串行化也能挡住，
但要配重试，否则并发时会直接报错。

This verification does not pick the fix for you, and never edits product code.
（行锁那次修复由 owner 批准，改动见 git 历史。）

## What this does NOT cover

- The real width of the window. The model says two requests' reads overlap; it
  has no clock. In the 对话 path the billing read sits right before the ledger
  create (narrow); in 生图 / 风格化 a **pre-check read happens before a
  multi-second generation**, so the two are easier to overlap than the
  millisecond-scale window suggests.
- **Real row-lock blocking.** `replay.test.ts` models the lock with a promise in
  its in-memory store; it does not prove that real Postgres blocks the second
  transaction on `SELECT ... FOR UPDATE`, re-reads the committed balance after
  the first commits, and routes the second into the 402 branch. That behaviour is
  standard READ COMMITTED / `FOR UPDATE` semantics, but it has **not** been
  exercised against a database here. Running this against the real Postgres on
  this machine is forbidden (it may be production).
- `chat-handler.ts:640` clamps the charge with
  `Math.min(ledger.credits(), fresh.aiCredits)` against a read taken before the
  ledger create. The model charges a fixed delta; the clamp only makes the loss
  smaller, it does not remove it.
- A 扣费 that throws used to be swallowed (a bare `console.error`, and an **empty
  catch** at `core-handlers.ts`). All four call sites now go through
  `chargeAiCredits` (`src/lib/credit-charge.ts`): the request still succeeds but
  the failure is retried once and logged as one structured `[ai-billing]` line
  (userId / delta / reason / model / messageId / attempt / error). Nothing is
  written to the database (a billing-failure collection would be a schema change),
  so "usage that is never billed" is still a separate property, not verified here.
- 兑换码核销 (`membership-service.ts`) now takes a `SELECT ... FOR UPDATE` on the
  code row inside one transaction, so two concurrent redemptions no longer both
  pass. That lock, like the ledger one, is **not modelled in `Ledger.tla`** and is
  only covered by `src/lib/services/membership-service.test.ts` (which mocks the
  store, so it proves the shape — one transaction, lock first, no ledger row on
  rejection — not real Postgres behaviour).
- The `balanceAfter` / `balance` semantics for accounts whose opening balance was
  never backed by ledger rows. The model assumes the opening balance is the
  baseline.
- Anything about AI pricing maths (`src/plugins/ai-copilot/billing.ts`) — that is
  deterministic and is now covered by `src/plugins/ai-copilot/billing.test.ts`
  (basic formula, minimum 1 credit, peak/off-peak and weekend rates, cache-hit
  price, and the old-formula fallback when a model has no pricing).

## When the covered code changes

1. Run `bash verification/credit-ledger/verify.sh`.
2. If `Current.cfg` no longer breaks the rules, the bug was fixed. Confirm the
   fix in `src/collections/AiCreditLedger.ts`, then flip `replay.test.ts` from
   `it.fails(...)` to `it(...)` with the fixed behaviour, refresh
   `report.md` / `chart.mmd` from a `Locked.cfg` run, and move the sync commit in
   this file forward with the change that fixed it.
3. If a new call site creates `ai-credit-ledger` rows, add it to the coverage
   table before moving the sync commit.
4. If the change was not intended to touch billing, the verification needs
   another look — `/maintain-formal-verification-skill` is the skill for bringing
   it back in line.
