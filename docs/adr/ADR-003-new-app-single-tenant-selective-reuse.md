# ADR-003 — New Application, Single-Tenant, Selective Legacy Reuse

**Status:** ✅ **Accepted 2026-09-30 (owner) — reconstructed from the decision history, then signed**
**Date:** 2026-09-28 (reconstructed)
**Deciders:** *unrecorded* — the original decision-makers are not named in any surviving document. **This is itself a gap; record them on sign-off.**
**Affects:** The entire application. Data model, RBAC, query design, deployment model, and every module.
**Source:** `AGENTS.md` §1, §2.1, §5, §13
**Precedence:** Per `AGENTS.md` §1, this ADR wins over every other planning document.

> ## ⚠️ Provenance notice
>
> `AGENTS.md` §1 names `docs/adr/ADR-003-new-app-single-tenant-selective-reuse.md` as the **governing decision**, and §1's own precedence rule makes it win over every other planning document.
>
> **The file did not exist.** It was reconstructed on 2026-09-28 from `AGENTS.md`, which is the most authoritative available source. The content below is a faithful restatement of rules that appear in `AGENTS.md`; it is **not** a contemporaneous record of the deliberation, the alternatives that were weighed, or who decided.
>
> **This ADR must be signed off before it is treated as settled.** A governing decision without a record of its alternatives is how the next engineer "helpfully" re-adds the tenancy layer.

---

## Context

A legacy implementation exists at `H:\AI-Dev\MyProjects\EduFlowV3\EduFlowV3\eduflow\` — a Next.js 16 monolith built on a **multi-tenant SaaS** data model. Measured 2026-09-28:

| Measure | Value |
|---|---|
| Prisma models | 59 |
| Prisma enums | 23 |
| TypeScript/TSX files | 630 |
| Test files | 897 |
| `$queryRaw` / `$executeRaw` call sites | **149** |
| `lib/prisma-tenant-extension.ts` | present |
| Global `@unique` constraints assuming a shared database | 14 |

Three forces made this a decision rather than a default.

**1. The delivery model changed.** The product moved from multi-tenant SaaS to **per-school deployment**. That is not a scaling change; it moves the isolation boundary from a code-enforced logical boundary to a physical one.

**2. The legacy isolation machinery is bypassable, and was already bypassed.** The tenant layer defends isolation with a Prisma client extension, ambient AsyncLocalStorage context, and scoping columns. A Prisma extension does not apply to raw SQL — and there are **149 raw-SQL call sites**. Each of those is either an isolation hole or an implicit acknowledgement that the extension is incomplete. Carrying that forward into a product with real children's data is not acceptable.

**3. Extending a Next.js monolith contradicts the target architecture.** `AGENTS.md` §3.1 mandates a **separate NestJS API service** with no server actions. The legacy app's API surface is App Router server actions. There is no incremental path that preserves both.

---

## Decision

### 1. Build a new application

A new codebase, structured per `AGENTS.md` §3:

```
apps/api    NestJS + Prisma + Zod      (separate service; no server actions)
apps/web    Next.js + React + TS strict + Tailwind + shadcn/ui
apps/mobile Expo                       (milestone 2 — see ADR-005)
packages/   shared-types, ui-kit, i18n-resources, config
infra/      per-school provisioning, CI, Terraform
```

### 2. Single-tenant: one database and one deployment per school

| Property | Value |
|---|---|
| Deployment unit | One application instance per school |
| Database | One PostgreSQL database per school |
| Data isolation | **Physical** — no shared rows between schools |
| Migrations | Applied per school database |

**The load-bearing consequence:** a missing `WHERE` clause *cannot* leak data across schools, because no other school's rows exist in that database. Isolation stops depending on every query being correctly scoped.

Therefore, in the domain layer, we **do not build**:

- ❌ `schoolId`-scoped query extensions
- ❌ ambient tenant context (AsyncLocalStorage or equivalent)
- ❌ cross-tenant guards
- ❌ a row-level-security dependency *for isolation*
- ❌ a `SUPER_ADMIN` cross-tenant role — there is nothing to be cross-tenant about; the highest role is an in-school administrator
- ❌ cross-school aggregate queries against the product database (that is a separate analytical store, out of scope)
- ❌ `if (schoolId === ...)` branches and ad hoc feature flags — capability gating goes through the licence/entitlement engine only

**What we do carry:** a `schoolId` column on school-scoped entities, for **auditability, licence portability and future flexibility**. It is **metadata, not a security control.** Uniqueness constraints are scoped within a school's database and are **never assumed global**.

### 3. Selective legacy reuse, on an explicit whitelist

`AGENTS.md` §5 is the whitelist. In summary:

**Reuse:** fee calculation, fee assignment, promotion rules, scheduling engine; login/authentication logic (credential verification, password hashing, password reset, session handling, CSPRNG temporary passwords); entity shapes and field semantics (re-deriving tenancy per decision 2); field-level and cross-field validation including money precision; the table-driven rule-engine tests for the above.

**Carve-out (D1):** **Attendance, Leave and Grading are designed fresh.** Nothing in those three domains is ported, the legacy implementations are not the specification, and their tests do not port either.

**Do not reuse:** all UI, components and styling; the tenant-scoping layer; global cross-school `@unique` constraints; raw-SQL repositories; Next.js server actions / App Router API; workspace artefacts.

**Rule:** *when in doubt, do not port.* A ported file **must** be named in `docs/analysis/LEGACY_REUSE_INVENTORY.md` with a reason. That inventory did not exist until 2026-09-28, and its per-file judgements are still pending.

### 4. The engineering contract is `AGENTS.md`

It wins over the Master Plan, the SRS and the idea-bank. Where they disagree — for example on tenancy — follow `AGENTS.md` and **flag the discrepancy**.

---

## Consequences

### Positive

- **Isolation is structural, not procedural.** A forgotten filter is a data-quality bug, not a breach. The class of defect that caused the legacy 149 raw-SQL holes cannot occur.
- **A whole subsystem of bypass surface is deleted**, not hardened. Every guard removed is a guard that cannot be bypassed.
- **No global `@unique` constraints**, so two schools in one database could legitimately hold the same value without collision.
- **Deployment is simple**: one database, one container, one licence. No connection-pool sharding, no tenant routing, no cross-tenant cache keys.
- **The highest-value legacy assets are preserved** — 897 test files of rule-engine specification, and the auth/finance/promotion logic, which is where re-derivation is most expensive.

### Negative / accepted costs

- **No cross-school reporting.** Every school is its own island. Analytics across a portfolio requires a separate store — a real limitation, accepted deliberately.
- **`schoolId` is not enforced.** It is metadata. A future reader could mistake it for a security control. **Mitigated** by `ARCHITECTURE.md` §5.1, which documents the rejected design in detail precisely so it is not "restored".
- **Connections cannot be pooled across schools** in any future multi-school process, because there is no future multi-school process in the product DB.
- **Per-school operational overhead**: migrations, backups and upgrades are run N times. Provisioning is therefore a tracked story (`OPS-06`), not a manual step.
- **No drift protection from legacy fixes.** Anything not ported must be re-derived, and re-derivation can produce a subtly different rule. Mitigated by porting the table-driven tests alongside the logic (`AGENTS.md` §5.1).

### Neutral

- Licences are still per school; the certificate payload's `school_id` becomes a **matching** check rather than a routing key.
- Reporting is per school. Cross-domain dashboards within a school are unaffected.

---

## Rejected alternatives

### ❌ Extend the legacy Next.js monolith

**Rejected because** it contradicts `AGENTS.md` §3.1 (separate NestJS API, no server actions) and because the legacy UI is explicitly not being carried over — so "extend" would mean rewriting most of it anyway, while keeping the 149 raw-SQL sites and the tenant layer that has to be dismantled.

### ❌ Keep multi-tenant with row-level security

**Rejected because** RLS is a defence worth having when isolation *must* be logical. Here it would be a second mechanism layered over physical isolation, adding a bypass surface to defend something that is already defended by the deployment topology. It also keeps the per-query overhead and the "did I remember `SET LOCAL`" failure mode.

### ❌ Port the tenant extension but drop the ambient context

**Rejected because** a partial tenant layer is worse than none. It suggests a guarantee ("queries are tenant-scoped") that 149 raw-SQL sites would not honour, so it creates false confidence — the worst outcome available.

### ❌ Add a `SUPER_ADMIN` role "for support"

**Rejected because** there is nothing to be cross-tenant about. A support user is an administrator of one school, operating in that school's deployment. The role would have no meaning and would become a bypass.

### ❌ Rewrite from the legacy schema, tenancy stripped

**Rejected because** the legacy 59-model schema encodes the tenancy assumption in ~35 models' column layout, its 14 global unique constraints and its raw-SQL queries. Stripping tenancy is not a deletion; it is a re-derivation, which is why decision 3 is a *whitelist* rather than a filter.

---

## Revisit when

- The owner decides a **multi-school or group console** is required. That is a new product, a new deployment model, and a new ADR. (`SRS` §19 currently places it out of scope.)
- A regulatory requirement mandates **logical** tenant isolation inside a shared database — e.g. a jurisdiction requiring a single database with per-tenant RLS. This ADR would need superseding, not amending.
- The portfolio wants **cross-school aggregate reporting**. Correct answer: a separate analytical store, per §2.1. Do **not** relax decision 2 to enable it.
- The owner wants a hosted multi-tenant tier for small schools. That inverts the deployment model and is a full re-decision.

---

## On sign-off

When signing, record:

1. **Deciders** — who made this call, and when.
2. **Alternatives genuinely considered** beyond the four above.
3. Whether decision 3's carve-out (D1: attendance, leave, grading) was in the original decision or added later. `AGENTS.md` describes it as a September 2026 audit outcome, which suggests it was **added after** the original decision — worth confirming, because it changes what "selective" originally meant.

---

*Indexed in `docs/adr/README.md` · Referenced by `AGENTS.md` §1 · Implemented in `docs/core/ARCHITECTURE.md` §5 · Analysis in `docs/analysis/LEGACY_REUSE_INVENTORY.md`.*
