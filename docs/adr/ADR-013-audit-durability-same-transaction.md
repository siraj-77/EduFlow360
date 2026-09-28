# ADR-013 — Audit Durability: Same-Transaction Write for Sensitive Actions

**Status:** 🟡 Proposed — needs sign-off
**Date:** 2026-09-28
**Deciders:** *unrecorded* (decision supplied by Prompt Pack §2.1 D-G)
**Affects:** `PLT-401`, `PLT-402`, every `@Audited` route · `AGENTS.md` §2.3, §2.7
**Source:** Prompt Pack §2.1 (D-G) · **overrides** `EduFlow_Jira_Epics_PlatformCore_RBAC_v1.md` `PLT-402`

> ## ⚠️ This ADR resolves a live contradiction between two governing documents
>
> `EduFlow_Jira_Epics_PlatformCore_RBAC_v1.md` `PLT-402` states the audit record is written
> *"**asynchronously (non-blocking, via queue)** after the action completes successfully."*
>
> Prompt Pack §2.1 **D-G** states sensitive-action audit rows are written
> *"**in the same DB transaction** as the business change (no lost audit on a queue failure);
> async queue only for non-critical, high-volume events."*
>
> These cannot both be true. This ADR decides in favour of **D-G** and records the deviation.

---

## Context

`AGENTS.md` §2.7 requires audit records to be **append-only**, and §2.3 requires `@Audited` on every sensitive action: finance, grades, permissions, attendance overrides, leave approvals, document issuance, GL postings, hall-booking overrides, wallet movements.

The consequence of each of those is that **the record is the evidence.** If an administrator, an auditor or a court asks "who reversed this fee, and when", the answer is the audit row. That makes the durability of the audit write a **correctness property of the feature**, not an operational nicety.

Queuing the write creates a failure mode where the business transaction **succeeds** and the audit record **does not exist** — because the queue was unavailable, the worker crashed, or the process died between commit and enqueue. The result is a financial or disciplinary action that demonstrably happened and provably left no trace. The failure is silent, and it surfaces months later during an audit, when it is no longer fixable.

The Jira document's phrasing also inverts the ordering: *"after the action completes successfully"* means the action is committed before the record is even queued.

## Decision

**Sensitive-action audit rows are written in the same database transaction as the business change.**

- One transaction covers both the domain write and the audit insert. Either both commit or neither does.
- Queuing remains available, and remains correct, for **non-critical, high-volume events** — those where losing the record is acceptable and the volume makes a transaction per event undesirable.
- `PLT-402`'s interceptor captures actor, role, IP, device, before/after snapshots and reason, then writes within the caller's transaction rather than after it.
- `reasonRequired` actions are rejected with 400 when `reason` is absent — the rejection happens **before** the transaction opens.

### The one place this changes

`PLT-401`'s repository exposes only `create()` and `query()`. A same-transaction write means the audit insert must accept the caller's transaction handle. That is a **signature change to the port**, not a new method:

```ts
// The port takes a transaction context so the insert joins the caller's transaction.
// It is still create-only. There is still no update() and no delete().
create(record: AuditRecord, tx: TransactionContext): Promise<void>
```

This is recorded now because it changes the shape of `PLT-401` and `PLT-402`, and both will be written against this ADR.

## Consequences

### Positive
- **A committed business change always has its audit row.** The invariant is structural, not probabilistic.
- The audit trail and the business data are **consistent at every instant** — no window in which a query sees a reversed fee with no corresponding record.
- Reordering is impossible. There is no "business change visible, audit row pending" state to reason about.
- Simpler failure semantics: a failed transaction produces neither, which is what an auditor expects.

### Negative / accepted costs
- **Audit write latency is on the request path.** An insert per sensitive action. Acceptable — these are low-frequency, human-initiated actions, not the high-volume events the queue exists for.
- **Longer transactions.** Where a business write and its audit insert are in one transaction, locks are held slightly longer. Mitigated by keeping the audit insert small and by not sending mail or calling vendors inside the transaction.
- **The infrastructure module becomes transaction-aware.** Acceptable, and it is where it belongs — that is its job.
- `PLT-402`'s "non-blocking" framing must be dropped from any implementation that followed the Jira text literally. Hence this ADR.

### Neutral
- Manual journal entries still require a mandatory `reason` and produce an audit record (`AGENTS.md` §2.6) — unchanged.
- The `audit_records` table's `REVOKE UPDATE, DELETE` protection is unaffected.

## Rejected alternatives

**❌ Asynchronous via queue, as `PLT-402` says.** Rejected: allows a committed business change with no audit record when the queue is unavailable. For a record that exists to answer "did this happen, and who did it", a probabilistic write is not a guarantee. The Jira text predates this reasoning and is superseded here.

**❌ Synchronous write, separate transaction, immediately after the business commit.** Rejected: has the same failure window as queueing, with none of the throughput benefit. It is strictly worse than either alternative considered here.

**❌ Write the audit row first, then the business change, in separate transactions.** Rejected: inverts the failure mode into a phantom audit record for an action that never committed — arguably worse, because it pollutes the evidence trail with entries for events that did not occur.

**❌ Two-phase commit across the queue.** Rejected: operational complexity and a coordinator dependency, to solve a problem that the single-transaction approach does not have.

**❌ Queue, with the queue itself treated as the durable record.** Rejected: an audit trail a school cannot query, export or hand to an auditor fails `PLT-403`'s acceptance criteria ("find all fee reversals by User X in 30 days") regardless of where the row physically lives.

## Links

- `AGENTS.md` §2.3 (audit guard), §2.7 (append-only), §2.15 (dual error logging)
- `PLT-401`, `PLT-402`, `PLT-403` · `SRS` §11 · Master Plan §6
- Prompt Pack §2.1 (D-G), §6 P7, §7 per-story row for `PLT-402` ("Same-transaction write (D-G)")
- `docs/core/SSOT.md` D18

## Revisit when
Never for sensitive actions. The queue path remains for non-critical high-volume events, so this decision governs *which* events take which path — not whether queueing exists.
