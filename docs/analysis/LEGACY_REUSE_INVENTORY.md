# LEGACY REUSE INVENTORY

**Purpose:** `AGENTS.md` §5.1 names this file as the "inventory and per-file judgements" governing what may be ported from the legacy app.
**Rule (`AGENTS.md` §5.2):** *"When in doubt, do not port. A ported file must be named in this inventory with a reason."*
**Status:** 🟡 **Category-level judgements complete. Per-file judgements PENDING.**
**Last measured:** 2026-09-28

---

## 1. The Corpus

**Correct path:** `H:\AI-Dev\MyProjects\EduFlowV3\EduFlowV3\eduflow\`

> ⚠️ **`AGENTS.md` §1 states the path as `H:\AI-Dev\MyProjects\EduFlowV3\`.** That directory contains only `EduFlowV3/`, `EduFlowV3.7z`, `eduflow/` and a `nul` file. **The application is three levels down.** Anyone following `AGENTS.md` literally will not find the code. Tracked as `SSOT.md` D8.

The legacy app is a **Next.js 16 monolith** with a multi-tenant SaaS data model. It is **read-only reference material** (`AGENTS.md` §1). It is not being extended, deployed, or ported wholesale.

### 1.1 Measured inventory (2026-09-28)

Excludes `node_modules` and `.next`.

| Measure | Value |
|---|---|
| Prisma models (`model` declarations) | **59** |
| Prisma enums (`enum` declarations) | **23** |
| `prisma/schema.prisma` size | 41 KB |
| TypeScript / TSX files | **630** |
| Test files (`*.test.ts`, `*.spec.ts`, `*.test.tsx`) | **897** |
| `$queryRaw` / `$executeRaw` call sites | **149** |
| `lib/prisma-tenant-extension.ts` | **present** — correctly excluded |
| `lib/` subdirectories | `actions`, `core`, `generated`, `scheduler`, `timetable`, `utils`, `__tests__` |
| Vitest config, Playwright config | present |
| Legacy git history | present (`.git`) — could supply provenance |
| Legacy `directives/` | present — mineable for SOP content (`ARC-08`) |

---

## 2. ⚠️ Corrections to `AGENTS.md` §5.2

`AGENTS.md` §5.2 states:
> "**Raw-SQL repositories** | 9 unfiltered `$queryRaw`/`$executeRaw` sites. Not ported."

**Measured: 149 call sites.** The figure is off by roughly **16×**.

| Possible explanation | Assessment |
|---|---|
| A narrower definition was used (e.g. only sites deemed genuinely unfiltered) | Possible, but **no exclusion criteria are documented anywhere**, so the figure cannot be reproduced or audited |
| The earlier audit was simply mistaken | Equally possible |
| Only one module was counted | Would need stating |

**Either way, a reader will trust the wrong number.** Corrected to **149**, with the method recorded so the next audit is reproducible:

> **Method (2026-09-28):** recursive file enumeration of `H:\AI-Dev\MyProjects\EduFlowV3\EduFlowV3\eduflow\` for `*.ts` and `*.tsx`, excluding any path matching `node_modules` or `\.next`, counting lines matching `\$queryRaw|\$executeRaw`. Method: `Get-ChildItem -Recurse -Include *.ts,*.tsx | Select-String -Pattern '\$queryRaw|\$executeRaw'`. **Each site still needs an individual judgement** — a count is not a review.

**Also unverified:** `AGENTS.md` §5.2 refers to "35-model scoping" of 59 total models. The 35 may be the *scoped subset* rather than a total. Not confirmed.

**This is the whole point of the inventory.** A number nobody can reproduce is not a control.

---

## 3. The Whitelist (`AGENTS.md` §5.1)

### 3.1 REUSE — with reasons

| Category | Why it is safe to reuse | Test asset available |
|---|---|---|
| **Fee calculation** | Pure arithmetic over school configuration. No tenancy assumption, no UI, no raw SQL. Money precision validation is the risky part and is explicitly listed as reusable. | Yes — table-driven |
| **Fee assignment** | Assignment logic over academic structure. Same reasoning. | Yes |
| **Promotion rules** | Classification over attendance % and grade thresholds. Boundary conditions are the specification. | Yes — table-driven |
| **Scheduling engine** | Constraint solving over timetable structure. Input/output; no persistence assumption. | Yes |
| **Login / authentication logic** | Credential verification, password hashing, password reset, session handling, CSPRNG temporary passwords. The login logic above `tenant-context` is portable. | Yes |
| **Entity shapes & field semantics** | **With care:** re-derive tenancy per ADR-003. **Do not port legacy scoping columns as a mechanism.** Entity *field semantics* are reusable; the *scoping mechanism* is not. | n/a |
| **Validation rules** | Field-level and cross-field validation, including money precision and boundary conditions. Portable once money is re-expressed as integer minor units (ADR-002). | Yes |
| **Tests for all of the above** | `AGENTS.md` §5.1: *"The table-driven rule-engine tests are the executable specification. Porting them ports the spec."* | **897 test files** |

### 3.2 ⛔ CARVE-OUT — DO NOT PORT (D1)

> **`AGENTS.md` §5.1:** *"Attendance, Leave and Grading are designed fresh. Nothing in those three domains is ported, and the legacy implementations are not the specification. Their tests do not port either."*

| Domain | Explicitly excluded | Includes |
|---|---|---|
| **Attendance** | Implementation **and** tests | Capture-source conflict resolution, discrepancy detection, regularisation |
| **Leave / Workforce** | Implementation **and** tests | Accrual, approval chains, substitution |
| **Grading** | Implementation **and** tests | Schemes, moderation, report-card comments |

**Rationale:** these three are the correctness-critical domains, are `PC-000`/`PC-001`/`PC-002` (all three are *known-unresolved design gaps*), and are the ones where a ported rule would be hardest to notice being wrong. Noted as a September 2026 audit outcome in `AGENTS.md` §5.1 — which suggests it was **added after** the original ADR-003 decision, and is worth confirming on ADR-003 sign-off.

### 3.3 DO NOT REUSE (`AGENTS.md` §5.2)

| Category | Why | Verified |
|---|---|---|
| **Tenant-scoping layer** | `prisma-tenant-extension.ts`, `tenant-context.ts`, ~35-model scoping. Solves a problem that does not exist under ADR-003. Importing it adds a bypass surface with no threat behind it — **and 149 raw-SQL sites would bypass it anyway.** | ✅ `prisma-tenant-extension.ts` present |
| **Global cross-school `@unique` constraints** | 14 constraints assume a shared database. Irrelevant and **wrong** here. | Count from `AGENTS.md`; unverified |
| **Raw-SQL repositories** | 149 sites. Each is a place the tenant extension does not apply. | ✅ 149 measured |
| **All UI, components, styling** | The interface is being redesigned. Nothing carries over. | — |
| **Next.js server actions / App Router API** | `AGENTS.md` §3.1: the API is a **separate NestJS service**. No server actions. | — |
| **Workspace artefacts** | Root scratch scripts, 4 stale generated Prisma clients, a self-nested clone, 431 KB log dumps. | Confirmed present: `check-config.js`, `check-db*.js`, `fix-cleanup.js`, `dev-server.log`, `.next/`, `nul` |

---

## 4. The Worked Counter-Example — Why the Tenant Layer Is Not Merely Unused

`ARCHITECTURE.md` §5.1 carries the full analysis. The short form, because this is the single most likely wrong turn in the project:

The legacy isolation model is a Prisma client extension + ambient AsyncLocalStorage context. A Prisma extension **does not apply to raw SQL**, and there are **149 raw-SQL call sites**. So the legacy codebase simultaneously (a) believes it is tenant-isolated and (b) contains 149 places where that isolation silently does not hold.

In a multi-tenant SaaS holding real student data, that is a breach. Under ADR-003 there is no threat to breach — no other school's rows exist in the database — so the correct response is to **delete the machinery, not harden it**. Every guard removed is a guard that cannot be bypassed.

**Do not restore it.** Recorded in `BACKLOG.md` BLG-090 as rejected, so it is not quietly re-raised.

---

## 5. PENDING — Per-File Judgements

`AGENTS.md` §5.2: *"A ported file must be named in the reuse inventory with a reason."* **Until this table has rows, nothing may be ported.**

**Format for each row:**

| Legacy path | Category (§3.1) | Port? | New path | Reason | Test ported? |
|---|---|---|---|---|---|

**Work queue, highest value first:**

| # | Target | Why it is worth the effort |
|---|---|---|
| 1 | Promotion rule tests | Table-driven boundary tests are the executable spec; the logic is small once the carve-out is respected (promotion is **not** in D1) |
| 2 | Fee calculation + its tests | Money arithmetic is expensive to re-derive and easy to get subtly wrong |
| 3 | Scheduling engine | Constraint solving is the hardest thing to rewrite correctly |
| 4 | Auth: password hashing, reset, session handling | Security-sensitive; getting it right matters more than novelty |
| 5 | Entity field semantics (per model, not wholesale) | Re-derive tenancy per ADR-003; take field definitions only |
| 6 | Validation rules, especially money precision | Feeds ADR-002's boundary tests |
| 7 | Legacy `directives/` SOP content | For `ARC-08` |

**Explicitly out of queue:** anything in §3.2 (D1 carve-out) or §3.3.

---

## 6. Companion

- `AGENTS.md` §5 — the normative whitelist
- `docs/adr/ADR-003-new-app-single-tenant-selective-reuse.md` — the governing decision
- `docs/core/ARCHITECTURE.md` §5 — the tenancy model and the worked counter-example
- `docs/core/SSOT.md` D10 — the correction of record
