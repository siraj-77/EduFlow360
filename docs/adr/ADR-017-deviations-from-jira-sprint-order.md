# ADR-017 — Documented Deviations From the Jira Sprint Order

**Status:** ✅ **Accepted 2026-09-30 (owner)**
**Date:** 2026-09-28
**Deciders:** *unrecorded* (deviations supplied by Prompt Pack §2.2)
**Affects:** `PLT-501`, `PLT-502`, `PLT-702` (email half), `PLT-901` (liveness), `PLT-401`, `PLT-402`
**Source:** Prompt Pack §2.2, §5, §6 P4/P5/P7/P12

> **Purpose of this ADR.** `EduFlow_Jira_Epics_PlatformCore_RBAC_v1.md` contains a sprint table. The Prompt Pack departs from it in four places. Every departure exists because a later story has a **hard dependency on an earlier story's output**, and the Jira order does not express cross-story dependencies that originate in acceptance criteria. This ADR records all four in one place, so a reader comparing the two documents finds the differences explained rather than discovered.
>
> **Story IDs, priorities and acceptance criteria are unchanged.** Only the ordering moves.

---

## The four deviations

### ① `PLT-501` + `PLT-502` pulled forward into P4 — structured logging and redaction

**Jira position:** Sprint 3.
**Actual:** P4, the API kernel.
**Reason:** `PLT-101`'s own acceptance criteria require it — *"Password is never returned in any API response **or logged in plaintext** (verify against §6 Logging Rules — password redaction)"*. A redaction guarantee cannot be asserted by a story that runs two epics after the logger exists. Building `PLT-101` without it and retrofitting later means the redaction requirement was met by assertion rather than by test, on the single most sensitive surface in the system.
**Mitigation:** only the *minimal* logger and redaction land in P4. Rotation (`PLT-503`) and the diagnostics viewer (`PLT-504`) stay in Sprint 3. P4 delivers the correlation-ID middleware and a table-driven redaction suite.
**Cost:** the API kernel is larger than the Jira plan implies.

### ② `PLT-901` liveness pulled forward into P4 — health endpoints (partial)

**Jira position:** Sprint 4.
**Actual:** P4, **liveness only**.
**Reason:** a boot that cannot be health-checked cannot be verified in CI or in a container orchestration check. `OPS-06`'s per-school provisioning needs something to poll.
**Mitigation:** `/health/liveness` only. `/health/readiness` needs DB, Redis and licence state, all of which arrive later, so readiness stays in P13 with the rest of `PLT-901`.
**Cost:** a partially-complete story mid-milestone, which is a small tracking annoyance and an honest one.

### ③ Email adapter (half of `PLT-702`) pulled forward into P5

**Jira position:** Sprint 4.
**Actual:** P5, during Epic 01.
**Reason:** `PLT-105` (password reset, P0) must send a reset mail, and the notification router (`PLT-701`) is Sprint 4. Without this deviation, password reset is either blocked or calls an email library directly — the latter violating `AGENTS.md` §2.2.
**Mitigation:** the adapter is built **behind `INotificationChannelAdapter`**, production-quality from the start, and **reused unchanged** by P12. Only the *dispatch* is interim. See ADR-014.
**Cost:** an interim dispatch path exists between P5 and P12. The rule that keeps it small: it must not grow features.

### ④ `IAuditRecorder` port with an interim adapter, retrofitted in P7

**Jira position:** Audit (`PLT-401`/`PLT-402`) lands in Sprint 2, in parallel with RBAC — i.e. *after* Auth.
**Actual:** Epic 01 defines the `IAuditRecorder` **port** with an interim adapter; **P7 retrofits and tests real auditing for every auth event.**
**Reason:** Epic 01 must be able to call "record this" for login success, login failure, lockout, logout, session revoke, refresh-reuse detection, password reset and role change — but the durable audit store lands in a later epic.
**Mitigation:** P7's auth retrofit is **mandatory** and each event's test is written **first**. P7's human gate is the owner connecting as the application role and trying to `UPDATE` an audit row.
**Cost:** Epic 01 ships with an interim adapter. If P7's retrofit is skipped, auth events are unaudited — so P7's retrofit is a named deliverable, not a nice-to-have.

## Consequences

### Positive
- Every hard dependency implied by an acceptance criterion is satisfied **before** the story that needs it.
- The redaction requirement is met by test, not assertion, on the auth surface.
- No story calls a vendor SDK directly from a use-case, from the first commit.
- All differences are recorded here rather than discovered by diffing two documents.

### Negative / accepted costs
- **The Jira sprint table no longer describes the real order.** Anyone planning from it alone will build `PLT-101` before the logger exists, and `PLT-105` before email does. This ADR, plus the Prompt Pack §5 map, is the authority on order.
- P4 is heavier than planned; two stories appear partially complete mid-milestone (② and ④).
- One interim adapter (④) ships inside a milestone. The mitigation is that P7 is a named deliverable with its own gate.

### Neutral
- **No acceptance criterion is weakened.** Every one of the four changes *strengthens* conformance to an existing criterion.
- Point estimates are unchanged; only sequencing moves. If the extra P4 work proves material, re-estimate then — do not silently absorb it.

## Rejected alternatives

**❌ Follow the Jira sprint table literally.** Rejected: it would require `PLT-101` to be built before the redaction it must satisfy, and `PLT-105` before any email channel exists. The first is a security assertion without a test; the second is a layering violation. Both are cheaper to fix now than later.

**❌ Reorder silently.** Rejected: two documents would disagree with no explanation, and the next reader would pick one at random. This ADR is the explanation.

**❌ Merge the logger into `PLT-101`.** Rejected: `PLT-501`/`PLT-502` have their own acceptance criteria, their own points, and their own tests. Folding them in loses the traceability between requirement, story and test that `AGENTS.md` §9 depends on.

## Links
- `EduFlow_Jira_Epics_PlatformCore_RBAC_v1.md` (the sprint table this departs from) · `PLT-401`…`PLT-503`, `PLT-702`, `PLT-901`
- Prompt Pack §2.2, §5, §6 P4/P5/P7/P12 · `AGENTS.md` §2.2, §9
- `docs/adr/ADR-013-audit-durability-same-transaction.md` (④ depends on it), `ADR-014-email-adapter-smtp.md` (③)
- `docs/work/PLATFORM_CORE_PLAN.md` §3 (resequenced to P0–P14)

## Revisit when
Any of the four lands differently in practice — particularly if P7's auth retrofit proves larger than expected, which would justify a fifth deviation.
