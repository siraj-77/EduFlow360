# PLATFORM CORE PLAN — Milestone 1

**Project key:** `PLT` · **Source of truth for stories:** `docs/core/EduFlow_Jira_Epics_PlatformCore_RBAC_v1.md`
**This file** is the *execution* view: entry conditions, sprint schedule, TDD obligations, exit gates.
**Last updated:** 2026-09-28
**Full analysis:** `docs/work/GAP_ANALYSIS_2026-09-28.md`

---

## 1. Scope — What This Milestone Is

**In:** Platform Core & RBAC — `PLT-EPIC-01` … `PLT-EPIC-09`. 9 epics, **33 stories, 199 points**.

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

## 3. Sprint Schedule

The original Jira document says "~4 sprints". That estimate **assumed a working repository**. It did not exist. Realistic sequence:

### Sprint 0 — Foundation Harness *(blocking; nothing else can start)*

| Track | Stories |
|---|---|
| Security / VCS | `REPO-01` rotate token · `REPO-02` git init + harden · |
| Toolchain | `REPO-03` workspace · `REPO-04` shared config · `REPO-05` test harness · `REPO-08` `.env.example` |
| Skeletons | `REPO-06` api · `REPO-07` web |
| Contracts | `ARC-01` ERD · `ARC-02` ARCHITECTURE · `ARC-03` IClock · `ARC-04` guard shapes · `ARC-05` matrix fixture · `ARC-06` Money · `ARC-07` ADRs · `ARC-09` contradiction register |
| Environment | `OPS-01` docker-compose · `OPS-02` CI skeleton |

**Exit gate — "Foundation Harness":**
> `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm test:coverage && pnpm build` all green **in CI on a fresh clone**, with a deliberately-under-covered file proven to fail the coverage gate.

**Critical path:** `REPO-01 → REPO-02 → REPO-03 → REPO-05 → REPO-06 → ARC-01 → exit → PLT-101`.
**Longest pole:** `ARC-01` (ERD, 13 pts) — documentation-only, zero code dependencies, start it on day one in parallel.
**Highest-leverage parallel:** the `REQ-01…05` idea-bank extraction (doc-only, unblocks every later domain).

### Sprint 1 — Guards, i18n, and the first real behaviour

| Track | Stories |
|---|---|
| Requirements | `REQ-01` module inventory · `REQ-02` domain entities · `REQ-03` business rules · `REQ-04` fr-index · `REQ-05` edge cases |
| Design | `DSN-04` fonts · `DSN-05` a11y baseline · `DSN-06` UI lint rules |
| Ops | `OPS-03` coverage gate · `OPS-04` security scanning · `OPS-05` `docs:verify` · `OPS-07` backup/restore drill |
| Process | `ARC-08` directives |
| **Platform Core** | **`PLT-101`** JWT login · **`PLT-102`** token refresh & rotation |

**Exit gate:** login works end to end; the four guards' shapes are proven on real routes; i18n exists in four locales; the RBAC matrix has its first real rows.

### Sprint 2 — RBAC end-to-end + Audit core

`PLT-103` sessions & forced logout · `PLT-104`→*milestone 2* · `PLT-105` password reset · `PLT-201` role & permission model · `PLT-202` permission guard · `PLT-203` ownership policy engine · `PLT-204` frontend permission-aware rendering

**Exit gate — `M2 Foundation Complete`** (`SRS` §24): **license enforcement demonstrably working** is `M2`'s stated criterion, so licensing (§4 Sprint 3) either slips into this gate or `M2` is redefined. **Decide in Sprint 1.** This is a real inconsistency in `SRS` §24 — flag for the owner.

### Sprint 3 — Licensing, Audit, Diagnostics, Settings

`PLT-301`…`PLT-305` licensing · `PLT-401` audit schema & append-only storage · `PLT-402` audit interceptor · `PLT-501`…`PLT-503` diagnostics · `PLT-601` module registry · `PLT-602` school settings

**Exit gate:** a Basic-edition school is blocked from a Deluxe route **by direct API call**; `UPDATE`/`DELETE` on `audit_records` fails at the database connection level; errors land in file **and** DB.

### Sprint 4 — Sign-off and the long tail

`PLT-205` RBAC matrix sign-off · `PLT-403` audit log viewer · `PLT-404` retention · `PLT-701`/`PLT-702` notification router (email half) · `PLT-801`/`PLT-802` storage · `PLT-901`…`PLT-903` health & monitoring

**Exit gate — `M3 Platform Core complete`:** every `AGENTS.md` §2.9 shared engine that Platform Core owns exists; Academic (SRS Phase 2) may begin.

### Deferred to Sprint 5+ (acceptable per the Jira doc)

`PLT-504` admin diagnostics viewer (P2) · `PLT-404` retention (P2) · `PLT-901`…`PLT-903` (P2)

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
