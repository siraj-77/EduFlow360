# ADR-006 — Licensing Ships in Milestone 1

**Status:** 🟡 Proposed — needs sign-off
**Date:** 2026-09-28
**Deciders:** *unrecorded* (`AGENTS.md` §7 states the decision was taken 2026-09-27, D4)
**Affects:** `AGENTS.md` §7, §2.3 · `PLT-EPIC-03` (`PLT-301`…`PLT-305`) · `PLT-602`, `PLT-901`

---

## Context

EduFlow is sold on **editions** — Basic / Standard / Deluxe / Enterprise — enforced by a digitally signed licence certificate (Master Plan §3, §4). Each edition gates a different set of modules and limits (Master Plan §3's matrix; §4.2's certificate payload).

Three forces made this a milestone-1 decision:

1. **Commercial.** No edition can be sold without licence enforcement. Shipping Platform Core without it means shipping a product that cannot be priced by tier.
2. **Architectural.** `@RequireEntitlement` is one of the three mandatory guards (`AGENTS.md` §2.3). Every route in every module needs it. If licensing lands after Academic or Finance, those modules are built without a guard they must have, and retrofitting a guard across a finished module is exactly the "secure it later" failure `AGENTS.md` §2.3 forbids.
3. **Enforcement is testable.** `PLT-301` (signature validation) and `PLT-305` (grace-period countdown) are table-driven rule engines with crisp boundaries — good early TDD practice.

**The counter-argument** is sequencing: licensing is a self-contained subsystem with no user-facing value on its own, and delaying it would let Auth + RBAC + Audit reach `M2` sooner.

---

## Decision

**Licensing ships in milestone 1** (`AGENTS.md` §7, D4). `PLT-EPIC-03` — `PLT-301` certificate validator, `PLT-302` entitlement enforcer, `PLT-303` online activation, `PLT-304` offline activation, `PLT-305` grace period — is in scope, alongside `PLT-EPIC-01/02/04`.

`AGENTS.md` §2.3 makes `@RequireEntitlement` **mandatory on any feature-gated capability**, so a Basic-edition school cannot reach Deluxe functionality **by calling the API directly**. Hiding a menu item is not enforcement.

---

## Consequences

### Positive
- Every later module is built with entitlement enforcement present from its first commit. No retrofitting.
- The product can be sold on editions from the first deployment.
- `@RequireEntitlement` ships as a real, tested guard alongside `@RequirePermission` and `@Audited`, so all three are proven before the first domain module.
- The certificate payload's limits (`maximum_students`, `maximum_staff`, …) give `PLT-302` concrete test cases.

### Negative / accepted costs
- `M2 Foundation Complete` (`SRS` §24) is defined as *"license enforcement demonstrably working"* — but the Jira sprint table puts licensing in **Sprint 3** while `M2` is the **Sprint 2** gate. **This is a real inconsistency in `SRS` §24.** See Open decision below.
- Roughly 29 points of milestone-1 work that produces no user-visible value on its own.
- The activation server and keypair process become a **milestone-1 dependency**, not a later concern (`TODO.md` ⚑6).

### Neutral
- Offline activation (`PLT-304`, P1) is in the epic but can slip without affecting the guards.
- `PLT-305`'s grace period means losing connectivity to the activation server does **not** lock a school out within the configured window (default 14 days) — a deliberate availability choice.

---

## Open decision ⚑

**Resolve the `M2` gate inconsistency.** `SRS` §24 sets `M2 Foundation Complete` = "license enforcement demonstrably working", but the sprint table places licensing in Sprint 3 and `M2` at the end of Sprint 2. Three ways out:

| Option | Consequence |
|---|---|
| **A — Move the `M2` gate to the end of Sprint 3.** | `M2` means what `SRS` §24 says it means. Sprint 2's exit becomes an internal checkpoint, not a milestone. **Recommended** — smallest change, no renumbering. |
| **B — Pull `PLT-301`/`PLT-302` into Sprint 2.** | Honours the existing gate. Costs Sprint 2 capacity, delaying RBAC sign-off. |
| **C — Redefine `M2` as "auth + RBAC + audit complete".** | Reorders the critical path so licensing follows. Weakens the guarantee the gate exists to give. |

Tracked as `TODO.md` ⚑7.

**Also unresolved (⚑6):** where the activation server lives (this repo or a separate service), and where licence keypairs are generated and stored. `PLT-301` needs an embedded public key; `LICENSE_PUBLIC_KEY_PATH` appears in `AGENTS.md` §11.

---

## Revisit when
- A school wants to run without any licence check (e.g. an internal pilot). That is an **offline activation** concern, not a removal of enforcement.
- The edition matrix changes enough that the certificate payload needs a version bump — that is a cert-version concern, tracked with the activation server, not a reason to revisit this ADR.

---

*Indexed in `docs/adr/README.md` · Records `AGENTS.md` §7 (D4) · Spec: Master Plan §3, §4 · `PLT-EPIC-03` · See `docs/work/PLATFORM_CORE_PLAN.md` §3.*
