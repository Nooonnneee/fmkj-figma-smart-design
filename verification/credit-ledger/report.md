# Ledger

TLC reached 83 states and 127 steps. The chart draws 46 states and 54 arrows.
The view hides 33 steps, so the chart does not draw them.

## BalanceMatchesLedger breaks
The shortest path has 4 steps:
0. 余额 5 · 流水合计 0 ｜ 1 号还没开始 ｜ 2 号还没开始
1. 1 号读到余额 5：扣费 5，先记下来: 余额 5 · 流水合计 0 ｜ 1 号读了余额 5，等入账 ｜ 2 号还没开始
2. 2 号读到余额 5：扣费 5，先记下来: 余额 5 · 流水合计 0 ｜ 1 号读了余额 5，等入账 ｜ 2 号读了余额 5，等入账
3. 2 号把流水和余额一起写下去: 余额 0 · 流水合计 -5 ｜ 1 号读了余额 5，等入账 ｜ 2 号已扣费 5
4. 1 号把流水和余额一起写下去: 余额 0 · 流水合计 -10 ｜ 1 号已扣费 5 ｜ 2 号已扣费 5

## NoOverdraft breaks
The shortest path has 4 steps:
0. 余额 5 · 流水合计 0 ｜ 1 号还没开始 ｜ 2 号还没开始
1. 1 号读到余额 5：扣费 5，先记下来: 余额 5 · 流水合计 0 ｜ 1 号读了余额 5，等入账 ｜ 2 号还没开始
2. 2 号读到余额 5：扣费 5，先记下来: 余额 5 · 流水合计 0 ｜ 1 号读了余额 5，等入账 ｜ 2 号读了余额 5，等入账
3. 2 号把流水和余额一起写下去: 余额 0 · 流水合计 -5 ｜ 1 号读了余额 5，等入账 ｜ 2 号已扣费 5
4. 1 号把流水和余额一起写下去: 余额 0 · 流水合计 -10 ｜ 1 号已扣费 5 ｜ 2 号已扣费 5

## Rules that hold
TypeOK, NoDeadlock
