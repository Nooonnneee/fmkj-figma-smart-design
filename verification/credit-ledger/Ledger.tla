---- MODULE Ledger ----
\* Model of the AI credit ledger in src/collections/AiCreditLedger.ts.
\*
\* A ledger row is created by:
\*   beforeChange:  read users.aiCredits -> balanceAfter = balance + delta
\*                  reject with 402 when balanceAfter < 0
\*   (insert row)
\*   afterChange:   users.aiCredits = row.balanceAfter
\*
\* Begin(o)  = the read + the 402 check inside beforeChange.
\* Commit(o) = the insert of the row and the users.aiCredits write, which
\*             Payload runs in one transaction.
\*
\* Mode:
\*   Atomic = FALSE -> today's code: Commit writes the balanceAfter computed
\*                     from the stale read in Begin.
\*   Atomic = TRUE  -> proposed fix: Commit re-reads and writes the balance
\*                     atomically (row lock / serializable retry / atomic
\*                     UPDATE ... WHERE ai_credits + delta >= 0).
\*   Guard  = FALSE -> the "积分不足" 402 check has been removed.
EXTENDS Integers, TLC

CONSTANTS
  \* users.aiCredits when the run starts
  InitialBalance,
  \* concurrent requests against the same account
  Ops,
  \* FALSE = the code at the sync commit, TRUE = the proposed fix
  Atomic,
  \* FALSE = drop the "balanceAfter < 0 -> 402" check, to show the rule bites
  Guard

ASSUME InitialBalance >= 0
ASSUME Atomic \in BOOLEAN
ASSUME Guard \in BOOLEAN

\* Each request's delta: negative = AI charge, positive = grant/redeem.
\* The bounds are small on purpose: two concurrent requests are enough to
\* show the lost update, and a third request adds states without a new bug.
Deltas == {-5, -4, 3}

VARIABLES
  balance,    \* users.aiCredits
  ledgerSum,  \* sum of deltas of the rows that committed
  delta,      \* delta chosen by each request (0 before Begin)
  seen,       \* balance each request read in beforeChange
  phase       \* idle -> checked -> committed, or rejected

vars == <<balance, ledgerSum, delta, seen, phase>>

TypeOK ==
  /\ balance \in Int
  /\ ledgerSum \in Int
  /\ delta \in [Ops -> Deltas \cup {0}]
  /\ seen \in [Ops -> Int]
  /\ phase \in [Ops -> {"idle", "checked", "rejected", "committed"}]

Init ==
  /\ balance = InitialBalance
  /\ ledgerSum = 0
  /\ delta = [o \in Ops |-> 0]
  /\ seen = [o \in Ops |-> 0]
  /\ phase = [o \in Ops |-> "idle"]

\* beforeChange: read the balance, compute balanceAfter, reject when it is negative.
Begin(o) ==
  /\ phase[o] = "idle"
  /\ \E d \in Deltas:
       /\ delta' = [delta EXCEPT ![o] = d]
       /\ seen' = [seen EXCEPT ![o] = balance]
       /\ phase' = [phase EXCEPT ![o] =
            IF Guard /\ balance + d < 0 THEN "rejected" ELSE "checked"]
       /\ UNCHANGED <<balance, ledgerSum>>

\* The row insert and the users.aiCredits write commit together.
Commit(o) ==
  IF Atomic
  THEN
    \* Proposed fix: the balance is read and written under the same lock.
    \/ /\ phase[o] = "checked"
       /\ Guard
       /\ balance + delta[o] < 0
       /\ phase' = [phase EXCEPT ![o] = "rejected"]
       /\ UNCHANGED <<balance, ledgerSum, delta, seen>>
    \/ /\ phase[o] = "checked"
       /\ (~Guard \/ balance + delta[o] >= 0)
       /\ ledgerSum' = ledgerSum + delta[o]
       /\ balance' = balance + delta[o]
       /\ phase' = [phase EXCEPT ![o] = "committed"]
       /\ UNCHANGED <<delta, seen>>
  ELSE
    \* Today: write the balanceAfter computed from the stale read.
    /\ phase[o] = "checked"
    /\ ledgerSum' = ledgerSum + delta[o]
    /\ balance' = seen[o] + delta[o]
    /\ phase' = [phase EXCEPT ![o] = "committed"]
    /\ UNCHANGED <<delta, seen>>

\* Keep a terminal state so TLC does not report a deadlock at the end.
Done ==
  /\ \A o \in Ops: phase[o] \in {"committed", "rejected"}
  /\ UNCHANGED vars

Next == (\E o \in Ops: Begin(o) \/ Commit(o)) \/ Done

Spec == Init /\ [][Next]_vars

\* Rule 1: the balance is exactly the opening balance plus every committed row.
\* In the reader's words: 充值不会凭空消失，扣费也不会凭空多扣。
BalanceMatchesLedger == balance = InitialBalance + ledgerSum

\* Rule 2: committed rows never spend more than the opening balance.
\* In the reader's words: 积分不足时，扣费必须被拒绝，不会把积分花超。
NoOverdraft == InitialBalance + ledgerSum >= 0

====
