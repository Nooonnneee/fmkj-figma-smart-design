// Reader-facing words for the credit-ledger model, for /statechart --view.
// Every label here describes what the account holder or the operator sees;
// no TLA+ variable names appear in the chart.

type Phase = 'idle' | 'checked' | 'rejected' | 'committed'

type Vars = {
  balance: number
  ledgerSum: number
  delta: { [op: string]: number }
  seen: { [op: string]: number }
  phase: { [op: string]: Phase }
}

const ops = (v: Vars) => Object.keys(v.phase).sort()

const n = (d: number) => Math.abs(d)

const verb = (d: number) => (d > 0 ? '充值' : '扣费')

const opWord = (v: Vars, o: string) => {
  const d = v.delta[o] ?? 0
  switch (v.phase[o]) {
    case 'idle':
      return `${o} 号还没开始`
    case 'checked':
      return `${o} 号读了余额 ${v.seen[o]}，等入账`
    case 'rejected':
      return `${o} 号余额不够，被拒绝`
    case 'committed':
      return `${o} 号已${verb(d)} ${n(d)}`
    default:
      return `${o} 号状态异常`
  }
}

export const state = (v: Vars) =>
  `余额 ${v.balance} · 流水合计 ${v.ledgerSum} ｜ ` +
  ops(v)
    .map((o) => opWord(v, o))
    .join(' ｜ ')

export const step = (action: string, from: Vars, to: Vars) => {
  if (action === 'Done') return null
  const o = ops(to).find((k) => from.phase[k] !== to.phase[k])
  if (!o) return null
  const d = to.delta[o] ?? 0
  switch (to.phase[o]) {
    case 'checked':
      return `${o} 号读到余额 ${to.seen[o]}：${verb(d)} ${n(d)}，先记下来`
    case 'rejected':
      return `${o} 号余额不够，被拒绝`
    case 'committed':
      return `${o} 号把流水和余额一起写下去`
    default:
      return null
  }
}

export const title = '积分流水 - 两笔请求同时到账'
