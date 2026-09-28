# PLATFORM CORE PLAN — Milestone 1

**Project key:** `PLT` · **Source of truth for stories:** `docs/core/EduFlow_Jira_Epics_PlatformCore_RBAC_v1.md`
**Execution authority:** `docs/core/EduFlow_Agentic_Prompt_Pack_PlatformCore_v1.md` §5 — **its P0–P14 sequence supersedes the sprint map below** (`SSOT.md` D17)
**This file** is the *engineering* view: entry conditions, the prompt-by-prompt order, TDD obligations, exit gates.
**Last updated:** 2026-09-28
**Full analysis:** `docs/work/GAP_ANALYSIS_2026-09-28.md`

---

## 0. Naming legend — read before any milestone reference

**"M2" is used for two different things across the corpus.** This table is the fix (`SSOT.md` §4).

| Write this | Means | Source |
|---|---|---|
| **Milestone 1** / **Milestone 2** | The *product* milestones. Milestone 2 is the **mobile** milestone | `AGENTS.md` §7 (D5), ADR-005 |
| **Gate M1** … **Gate M6** | The *sign-off gates*. "Gate M2 — Foundation Complete" is one of them | `SRS` §24 |

In the Prompt Pack §7 story table the column `M1`/`M2` means **milestone**, so `PLT-104` is `M2` = milestone 2 = mobile. It does **not** mean Gate M2.

**Never write a bare "M2".** Always qualify it.

---

## 1. Scope — What This Milestone Is

**In:** Platform Core & RBAC — `PLT-EPIC-01` … `PLT-EPIC-09`. 9 epics, **33 stories, 199 points** (verified by enumeration, 2026-09-28).

**Story count reconciliation** (Prompt Pack §2.2 asks for this): 33 stories, 199 points. `AGENTS.md` §7's figures are correct; the Prompt Pack's note that "your `AGENTS.md` cites a corpus figure" resolves to agreement, not conflict.

**Out (per `AGENTS.md` §7, D5 — `apps/mobile` is milestone 2):**
- `PLT-104` (OTP login) → milestone 2
- `PLT-106` (jailbreak/root detection) → milestone 2 (already P2)
- Push half of `PLT-702` → milestone 2

**Precondition:** none of the 33 stories can start today. See §2.

**Milestone-2 MVP** is a **reduced vertical slice**: enrolment → class assignment → attendance → fee invoice → GL posting → receipt.

---

## 2. Entry Conditions — All Must Hold

`PLT-101` cannot start until every one of these is true. They are the work of epics `REPO`, `ARC`, `DSN` and `OPS`.

| # | Condition | Story | Why it blocks |
|---|---|---|---|
| 1 | Live credential rotated; `.claude/settings.json` clean | `REPO-01` | Before `git init`, or the token enters history permanently |
| 2 | Git repository initialised; `.gitignore` hardened; clean first commit | `REPO-02` | TDD checkpoint commits, worklog discipline, conventional commits |
| 3 | Monorepo scaffold — `package.json`, `pnpm-workspace.yaml`, `turbo.json` | `REPO-03` | No workspace, no packages, no cross-package types |
| 4 | Shared config — TypeScript strict, ESLint, Prettier, **missing-guard static check** | `REPO-04` | The fail-closed guarantee is a lint rule, not a habit |
| 5 | **Test harness green on an empty tree** — Jest, RTL, MSW, Playwright, coverage gates | `REPO-05` | **No test runner ⇒ no TDD.** Hardest blocker in the plan |
| 6 | `apps/api` NestJS skeleton with per-domain Clean Architecture folders; Prisma migrating | `REPO-06` | `SRS` §17 requires the boundary from day one |
| 7 | `apps/web` Next.js skeleton, Tailwind + shadcn, 4 locales, themes | `REPO-07` | Every UI story depends on it |
| 8 | `.env.example` + fail-fast config validation | `REPO-08` | `AGENTS.md` §11: fail fast naming the missing variable |
| 9 | **ERD signed off** | `ARC-01` | `PLT-EPIC-01` "Definition of Ready". **Longest pole** — needs no code, start day one |
| 10 | `ARCHITECTURE.md` written | `ARC-02` | Done 2026-09-28 |
| 11 | `IClock` + static check banning `Date.now()` in domain/use-cases + shared test factories | `ARC-03` | Licence expiry, lockout cooldown, token expiry are all time-dependent |
| 12 | Guard decorator **shapes** + ESLint check live | `ARC-04` | So no route is ever written without all three guards |
| 13 | RBAC permission-matrix fixture scaffolded and seeded | `ARC-05` | The static check needs something to check against |
| 14 | `Money` value object + journal-balance invariant test | `ARC-06` | `PLT-302` limit enforcement returns money-typed errors |
| 15 | `docs/adr/` + reconstructed `ADR-003` | `ARC-07` | The governing ADR is cited by `AGENTS.md` §1 and does not exist |
| 16 | `packages/ui-kit` from template tokens | `DSN-01` | `PLT-204` needs `<PermissionGate>` to wrap something |
| 17 | `packages/i18n-resources` — 4 locales, key-parity enforced | `DSN-02` | `AGENTS.md` §2.8 makes literal strings review-blocking from story one |
| 18 | RTL foundation verified on login / form / table | `DSN-03` | `PLT-204` and `PLT-403` render tables and forms |
| 19 | CI pipeline green on an empty commit | `OPS-02` | `SRS` §16.1 |
| 20 | Coverage gate enforcement **verified to fail** | `OPS-03` | An unenforced threshold is indistinguishable from no threshold |

---

## 3. Execution Order

The original Jira document's "~4 sprints" estimate **assumed a working repository**. It did not exist. The Prompt Pack's P0–P14 sequence is the corrected order (`SSOT.md` D17).

### 3.1 Work that precedes P0

| Track | Work | State |
|---|---|---|
| Security / VCS | Rotate token (accepted risk, D24) · `git init` + hardened `.gitignore` | ✅ Done 2026-09-28 |
| Toolchain | Workspace · shared config · **test harness** · `.env.example` | ❌ **P2/P3 — the blocking work** |
| Skeletons | `apps/api` · `apps/web` | ❌ P2 |
| Contracts | ERD · `ARCHITECTURE.md` · `IClock` · guard shapes · matrix fixture · `Money` · **ADRs** | 🟡 `ARCHITECTURE.md` ✅, ADRs 🟡 drafted, **ERD ❌ longest pole** |
| Environment | compose (Postgres, Redis, MinIO, Mailpit) · CI | ❌ P2/P3 |
| Requirements | idea-bank extraction `REQ-01…05` | ❌ **stubs exist, extraction does not** |

**Foundation Harness exit gate** (reached at P4):
> `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm test:coverage && pnpm build` all green **in CI on a fresh clone**, with a deliberately-under-covered file proven to fail the coverage gate.

**Critical path:** toolchain → test harness → `apps/api` → ERD → `PLT-101`.
**Longest pole:** the **ERD** — documentation-only, zero code dependencies, start day one in parallel.
**Highest-leverage parallel:** the **idea-bank extraction** — doc-only, unblocks every later domain, and `PLT-205`'s matrix cannot be written without it.

**TDD status:** two of the three prerequisites are now met (git exists; a working tree exists). **The test runner is missing**, so no production code can be written. `test-driven-development` and `tdd-workflow` both require a working `<test>` command, a coverage command, and git for RED/GREEN checkpoints.

### 3.2 The prompt sequence — P0 … P14

**`EduFlow_Agentic_Prompt_Pack_PlatformCore_v1.md` §5 is the execution authority for order** (`SSOT.md` D17). It is more granular than the sprint table, and it encodes four **documented deviations** from the Jira document's sprint order, recorded in **`ADR-017`**.

| Step | Prompt | Stories | Gate |
|---|---|---|---|
| 0 | **P0** Orientation & readiness report | — (read-only) | Owner reads the report, answers questions, confirms the deviation list |
| 1 | **P1** Decisions → ADRs | — | Owner approves/edits each ADR. **ADR-001…018 already drafted 2026-09-28 — this is the approval step** |
| 2 | **P2** Scaffold the monorepo | — (no business code) | Owner runs every command on a clean clone |
| 3 | **P3** Quality gates & CI | — | **The most valuable safety net.** A dummy PR with an unguarded route, a `new Date()` in a use-case, a raw `<button>` and a missing i18n key must make CI fail, then pass |
| 4 | **P4** API kernel + walking skeleton · **P4W** web foundation | *pulled forward:* `PLT-501`, `PLT-502` (minimal), `PLT-901` (liveness only) | Boot everything; try the deliberately unguarded route; toggle theme/language; read the redaction tests |
| 5 | **P5** Epic 01 Authentication | `PLT-101`, `102`, `103`, `105` + email adapter from `702` | Try login, trigger lockout with 5 bad passwords, reset via the mail catcher, inspect logs for leaks |
| 6 | **P6** Epic 02 RBAC | `PLT-201`, `202`, `203`, `204`, `205` | **Owner reviews the matrix file line by line — it *is* the authorisation policy** |
| 7 | **P7** Epic 04 Audit + **auth retrofit** | `PLT-401`, `402`, `403`, `404` | **Owner connects as the application role and tries to `UPDATE` an audit row** |
| 8 | **P8** Epic 03 Licensing | `PLT-301`, `302`, `303`, `304`, `305` | Tamper with a certificate in staging; confirm locked mode, not a crash |
| 9 | **P9** Epic 05 remainder | `PLT-503`, `504` (P2, time permitting) | — |
| 10 | **P10** Epic 06 Registry & Settings | `PLT-601`, `602` | — |
| 11 | **P11** Epic 08 Storage | `PLT-801`, `802` | — |
| 12 | **P12** Epic 07 Notification router | `PLT-701`, `702` (**email only** — push is milestone 2) | Refactor P5's interim email path through the router; **tests must stay green** |
| 13 | **P13** Epic 09 Health & metrics | `PLT-901` (complete), `902`, `903` | — |
| 14 | **P14** Milestone close-out | `PLT-205` final, E2E, security review | **Gate M2 "Foundation Complete"** |

### The four documented deviations (ADR-017)

The Jira document's sprint order cannot satisfy four of its own stories' acceptance criteria. `ADR-017` records each deviation, its reason, its mitigation and its cost.

| # | Pulled forward | Why | Mitigation |
|---|---|---|---|
| ① | `PLT-501` + `PLT-502` → **P4** | `PLT-101`'s acceptance criteria require redaction. A redaction guarantee met two epics late is met by assertion, not test, on the most sensitive surface in the system | Minimal logger only; rotation stays in P9 |
| ② | `PLT-901` liveness → **P4** | A boot that cannot be health-checked cannot be verified in CI or by an orchestrator | Liveness only; readiness stays in P13 |
| ③ | Email adapter (half of `PLT-702`) → **P5** | `PLT-105` (password reset, P0) must send a reset mail, and the router is P12. Without this it either blocks or calls a vendor SDK directly — a layering violation | Built behind `INotificationChannelAdapter`, production-quality, **reused unchanged** by P12 (ADR-014) |
| ④ | `IAuditRecorder` interim adapter → defined in **P5**, real audit retrofitted in **P7** | Epic 01 must record login success/failure, lockout, logout, session revoke, refresh-reuse detection, password reset and role change — but the durable store lands a later epic | P7's auth retrofit is **mandatory**, tests written first, with its own human gate (ADR-013) |

**No acceptance criterion is weakened. No story ID changes. Point estimates are unchanged** — only sequencing.

### Local environment — all four services

`OPS-01` compose file must include **PostgreSQL, Redis, MinIO and a local mail catcher (Mailpit)**, per Prompt Pack §1.1. MinIO is not optional: it means development and CI exercise the real S3 API rather than a mock that behaves nothing like it. Mailpit is what makes `PLT-105`'s reset mail testable without a network.

### Sprint 0 → P0–P2 mapping

The pre-Prompt-Pack sprint map is superseded. For reference, the old grouping maps as: **Sprint 0** ≈ P0–P4 · **Sprint 1** ≈ P4W–P5 · **Sprint 2** ≈ P6 · **Sprint 3** ≈ P7–P8 · **Sprint 4** ≈ P9–P14.

**Milestone gate naming:** the P14 human gate is **Gate M2 "Foundation Complete"** (`SRS` §24). Note the open inconsistency recorded in `ADR-006`: `SRS` §24 defines Gate M2 as *"license enforcement demonstrably working"*, but licensing lands at **P8**, after the gate the old sprint map placed at the end of Sprint 2. Under the P0–P14 sequence this resolves cleanly — **P14 sits after P8**, so the gate is satisfied when it is checked. `ADR-006` records the options; with the Prompt Pack ordering, option A is effectively in force.

---

## 4. Per-Story TDD Obligations

Added to every `PLT-*` story. Story acceptance criteria in the Jira document remain authoritative; these are the *test* obligations.

### 4.1 Table-driven tests for rule engines

| Story | Engine | Boundaries to cover |
|---|---|---|
| `PLT-203` | `IOwnershipPolicy` | Teacher A / Teacher B · homeroom vs. non-homeroom · parent with 1 child vs. 3 · vendor scoped to outlet 1 vs. outlet 2 |
| `PLT-205` | Permission matrix | Every row of the living fixture, including direct-API negative tests |
| `PLT-301` | Licence signature | Valid · bit-flipped payload · expired (distinguishable from invalid) · wrong key · malformed |
| `PLT-305` | Grace-period countdown | Day 0 · day 13 · **day 14 boundary** · day 15 (lock) · clock injected, never real time |
| `PLT-102` | Token rotation | Valid refresh · expired · reuse-after-rotation ⇒ whole family revoked |
| `PLT-101` | Lockout | 4 failures (allowed) · 5th (locked, 429) · cooldown expiry · invalid credential ⇒ no email/password disclosure |

### 4.2 Security tests that prove the negative

Mandatory integration tests, not optional. Each asserts a 403 (or equivalent) on a request that *should* fail:

1. Teacher A cannot edit teacher B's class grades **while holding `GRADE_ENTER`**.
2. A parent's session cannot read another family's child.
3. A vendor cannot read beyond its own outlet.
4. A Basic-edition school cannot reach a Deluxe route **by direct API call**, bypassing the UI.
5. A chatbot query cannot read data outside the asking user's RBAC scope.
6. Role-denial and ownership-denial are **distinguishable in logs**.

### 4.3 Structural obligations

- **Every new route** updates the `ARC-05` matrix **in the same commit** (`AGENTS.md` §9).
- Routes touching a sensitive action assert an **audit record was written**.
- `PLT-401`: a test asserts `UPDATE`/`DELETE` on `audit_records` **fails at the database connection level** — not merely "no code calls it".
- `PLT-502`: a test asserts a log line containing `password`, an `Authorization` header, and a card-number-shaped string is redacted in the output.
- `PLT-602`: a test asserts a settings change takes effect **without a server restart**.

### 4.4 Checkpoint discipline

For every story producing behaviour: one commit for **RED** (failing test, observed failing for the intended reason), one for **GREEN**, one optional for refactor. Do not squash until the TDD evidence report is written.

---

## 5. Quality Gates — Non-Negotiable Before Commit

| Gate | Command | Requirement |
|---|---|---|
| Unit tests | `pnpm test` | All pass. **A failing test must be observed before the fix** |
| Typecheck | `pnpm typecheck` | 0 errors |
| Lint | `pnpm lint` | 0 errors |
| Coverage | `pnpm test:coverage` | Thresholds enforced |
| Build | `pnpm build` | Green |
| Integration | `pnpm test:integration` | Containerized real Postgres, isolated schema |
| E2E | `pnpm test:e2e` | Playwright (web) |

**Coverage thresholds** — tiered, from `SRS` §12:

| Area | Line | Branch |
|---|---|---|
| Domain entities & use-cases | 90% | 85% |
| Controllers / DTOs | 70% | — |
| Frontend logic hooks | 80% | — |

Adapters are **contract-tested**, not coverage-gated. **A test count is not evidence of coverage.**

---

## 6. Epic Dependency Order

```
PLT-EPIC-01 (Auth) ──┬──► PLT-EPIC-02 (RBAC) ──► PLT-EPIC-06 (Registry/Settings)
                      │                                │
                      └──► PLT-EPIC-04 (Audit) ◄─────┘
                                    │
PLT-EPIC-03 (Licensing) ───────────┴──► PLT-EPIC-07 (Notification Router)
                                    │
PLT-EPIC-05 (Diagnostics) ─────────┘

PLT-EPIC-08 (Storage) — independent, parallel after EPIC-01
PLT-EPIC-09 (Health)   — independent, lowest priority
```

**Critical path for MVP:** `PLT-EPIC-01 → PLT-EPIC-02 → PLT-EPIC-03 → PLT-EPIC-04` must be substantially complete before any other module begins, because every subsequent module assumes `@RequirePermission`, `@RequireEntitlement` and `@Audited` already exist and work.

---

## 7. Pre-Merge Self-Check

Applies to every `PLT-*` story. Derived from `AGENTS.md` §4.3.

- [ ] Typecheck, lint, tests, coverage, build green
- [ ] Logic sits in a use-case behind an interface — not in UI or a controller
- [ ] No second attendance / stock / booking / approval / document / notification / ledger engine
- [ ] No operator-model fork in outlet code beyond settlement strategy and RBAC scope
- [ ] Every new route has all three guards; **the RBAC matrix fixture is updated**
- [ ] Money is integer minor units; journal entries balance; posting goes through a rule
- [ ] Errors go to file **and** DB; nothing sensitive logged
- [ ] i18n keys in all four locales; RTL, light/dark and mobile verified
- [ ] Time via `IClock`; rule engines have table-driven boundary tests
- [ ] Vendor-facing paths expose minimal data
- [ ] Epic success criteria met; no secrets in tracked files
- [ ] `docs/work/WORKLOG.md` and `docs/work/TODO.md` updated **in the same commit**

---

## 8. Pointing Corrections

Three figures in `AGENTS.md` were re-measured on 2026-09-28 and are **inaccurate**. They need the owner's decision to correct.

| `AGENTS.md` claim | Measured | Where |
|---|---|---|
| §5.2: "9 unfiltered `$queryRaw`/`$executeRaw` sites" | **149** call sites | `docs/analysis/LEGACY_REUSE_INVENTORY.md` |
| §5.2: "35-model scoping" | 59 models total; 35 may be the scoped subset | same |
| §1: legacy at `EduFlowV3\` | actual app at `EduFlowV3\EduFlowV3\eduflow\` | `SSOT.md` D8 |

A fourth, in §2.8 — the frontend template has a "complete en/ta/si/ar dictionary" — is **21 marketing keys and zero application keys**: `docs/design/FRONTEND_TEMPLATE.md`.

---

*Companion documents: `docs/core/EduFlow_Jira_Epics_PlatformCore_RBAC_v1.md` (authoritative stories) · `docs/core/SSOT.md` · `docs/core/ARCHITECTURE.md` · `docs/work/GAP_ANALYSIS_2026-09-28.md` · `docs/work/TODO.md`.*
