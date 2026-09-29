# TODO — Next Actions

**Last updated:** 2026-09-29
**How to use:** The topmost unchecked item is the next task. Log completion in `WORKLOG.md` in the same commit.
**Analysis:** `docs/analysis/CODE_AUDIT_2026-09-29.md` (evidence) · `docs/work/REMEDIATION_PLAN_2026-09-29.md` (**the action plan**) · `docs/work/GAP_ANALYSIS_2026-09-28.md` (pre-scaffold baseline) · `docs/work/PLATFORM_CORE_PLAN.md`

---

## P0a — Repair the scaffold 🔴 **START HERE**

> **Added 2026-09-29.** The 2026-09-29 audit found that **3 of the 7 `AGENTS.md` §4 gates fail**, and that `WORKLOG.md:17` reported them as green while listing only 6 of 7. `pnpm test:coverage` exits 1 on a missing dependency; `pnpm test:e2e` exits 1 with no tests; `pnpm format:check` exits 2 on 60 files.
>
> Five defects shared one cause: **each was invisible to the gate set that was actually run.** A gate marked `[x]` on the strength of a config file existing, rather than the gate running.

Full stories, points and acceptance criteria: `docs/work/REMEDIATION_PLAN_2026-09-29.md` EPIC-00 (**21 pts**; 1 of 11 done).

- [x] **FIX-01** 🔴 ~~Add `@vitest/coverage-v8` to all 5 test-bearing packages~~ **DONE 2026-09-29** — `pnpm test:coverage` exits 0, and was *proved* able to exit 1 with a temporary probe threshold. 12-case invariant suite added. ⚠️ but the §4 globs still match 0 instrumented files → **FIX-26**
- [ ] **FIX-02** 🔴 One real e2e spec — 4 locales render, `/ar` has `dir="rtl"`, tokens applied
- [ ] **FIX-03** 🔴 `docker-compose.yml` — `#` comments, pinned images, bucket bootstrap. **The file does not parse today**
- [ ] **FIX-04** 🔴 `proxy.ts` → `middleware.ts` + locale negotiation. **It compiles to zero middleware today**
- [ ] **FIX-05** ⚠️ `pnpm format` (60 files) + the 2 mojibake `package.json` entries
- [ ] **FIX-06** ⚠️ `turbo.json` `globalDependencies` → real paths; add `scripts` to `packages/config`
- [ ] **FIX-07** ⚠️ Remove `**/*.spec.ts` from the 5 `exclude` arrays — test type errors are invisible
- [ ] **FIX-08** ⚠️ `main.ts` — drop the `??` on `WEB_ORIGIN`; validate `WEB_ORIGIN` and `NEXT_PUBLIC_API_URL` (D32)
- [ ] **FIX-09** ⚠️ `src/modules/modules/` → `src/modules/registry/`; anchor the ESLint globs
- [ ] **FIX-10** ⚠️ `ThemeToggle` (the i18n keys already exist and are unused) + `loading.tsx` / `error.tsx` / `not-found.tsx`
- [ ] **FIX-11** 🔴 Initialise shadcn/ui. **Must precede P3** — that gate needs a raw `<button>` to fail *and* a compliant `<Button>` to pass
- [ ] **FIX-22** ⚠️ ⚠️ **raised S3 → S2** — `pnpm add` **exits 1** (`ERR_PNPM_IGNORED_BUILDS`). The `allowBuilds` placeholders are a malformed allow-list. `pnpm install` on a clean tree exits 0, so this is invisible until a dependency is added — which is when it blocks work
- [ ] **FIX-25** ⚠️ `docs-verify.mjs` cannot resolve `path:line` references. **Third reactive patch to the same tool for the same class of problem**
- [ ] **FIX-26** ⚠️ The §4 coverage tiers match **zero** instrumented files. `main.ts`, `app.module.ts`, `layout.tsx`, `page.tsx`, `theme-script.tsx` are at 0% with **no threshold at all**

**Exit criterion:** all 7 §4 gates exit 0, **plus** `format:check` and `docs:verify` — each verified by running it, not by reading the config.

---

## P0 — Do These First

> **State 2026-09-29:** P2 (scaffold) is DONE, but **two gates are still broken — see P0a above.** `test:coverage` was fixed (FIX-01). Read `docs/core/SSOT.md` §1a for the measured results.
> The ERD is deferred by owner decision (D22). Once P0a is green, the top engineering priority is **P3 — CI**.

### 1. Rotate the exposed credential — ⚠️ **ACCEPTED RISK, NOT BLOCKING** *(decided 2026-09-28, D16)*

`.claude/settings.json` holds a **live** `thk_live_` bearer token and a third-party `ANTHROPIC_BASE_URL` (`https://tokenharbor.ai`).

**Deferred by owner decision.** The token was **never committed** — `.claude/` was added to `.gitignore` *before* `git init`, and the first-commit staging audit confirmed the token value is absent. The remote is **private**, sole holder. Residual exposure is **local-disk only**.

- [x] `.claude/` gitignored — `.gitignore:99`
- [x] Verified absent from the first commit — staging gate 2b/2c
- [ ] *Deferred:* rotate at the issuer
- [ ] *Deferred:* decide whether the third-party base URL is intentional
- [ ] **Enable secret scanning in CI** — Prompt Pack P3.6. **This is now the only un-done item here, and it is part of P3.**

**Revisit if:** the repo goes public · a second person is granted access · the folder is shared or archived · the machine is shared.

### 2. Prompt Pack P3 — Quality gates and CI 🔴 **THE TOP PRIORITY (after P0a)**

The `AGENTS.md` rules are already machine-enforced **locally**. Nothing enforces them for anyone else. P3 is what turns the contract from prose into something that fails a build.

- [ ] `check-route-guards` — TypeScript AST: every NestJS route must carry `@RequirePermission(...)` **or** `@Public('<reason>')`. Also reject `@Public` combined with `@RequireEntitlement`, and on entity-scoped routes. Allowlist file with mandatory justification, enforced **both ways** (`ADR-018`)
- [ ] `check-i18n` — all four locale files have identical key sets. *(A vitest suite already covers this in `packages/i18n-resources`; the script is for CI reporting on a PR.)*
- [ ] `check-worklog` — a PR changing source must also change `docs/work/WORKLOG.md` (`AGENTS.md` §9)
- [ ] gitleaks + dependency audit
- [ ] lint-staged pre-commit hook; commit-msg Conventional Commits check
- [ ] **CI workflow**: PR → typecheck → lint → custom checks → unit + coverage → build → integration (containerised Postgres) → secrets scan. E2E on `main` only
- [ ] **React-hooks ESLint rules** — dropped with `eslint-config-next` (D25); add when there are hooks
- [ ] **Human gate:** a dummy PR with (a) an unguarded route (b) a `new Date()` in a use-case (c) a raw `<button>` (d) a missing i18n key — **CI must FAIL for each**, then pass. ⚠️ **Requires FIX-11 first**

### 3. Write the ERD 🔴 **Deferred (D22) — blocks `PLT-EPIC-01`. The longest pole.**

`apps/api/prisma/schema.prisma` is **deliberately empty**. The ERD is `PLT-EPIC-01`'s Definition of Ready and the SRS Phase 0 exit gate. It needs no code and no Docker.

- [ ] Platform Core entities: `User` `Role` `Permission` `RolePermission` `Session` `RefreshToken` `AuditRecord` `ErrorLog` `SchoolSettings` `ModuleRegistry` `License` `NotificationPreference` `NotificationDelivery` `StoredFile`
- [ ] Money as **integer minor units + explicit currency** (`ADR-002`) — ⚠️ and settle the `bigint` → JSON boundary first (⚑G, proposed `ADR-024`)
- [ ] `schoolId` as **metadata, not a security control** (`ADR-003`)
- [ ] Uniqueness scoped within one school's database — never global
- [ ] `audit_records`: `REVOKE UPDATE, DELETE` from the application role
- [ ] Resolve the `PC-004` admission gap
- [ ] **Do not** port the legacy 59-model tenant scoping
- [ ] Sign-off recorded before `PLT-101` starts

### 4. Extract the requirements (`docs/idea-bank/`) 🔴

Five loud stubs exist; **zero data rows.** The Prompt Pack §4.2 greps `fr-index.md` and `business-rules.md` before **every** story.

> ⚠️ **`AGENTS.md` §6 claimed this directory held 139 modules, 257 rules, 35 entities and 73 FRs. It holds none of them** — 16 KB of stubs. **D28 removed the figures.** `SRS §3` actually contains **87** FRs, not 73. Do not reconstruct §6's table without running the extraction first.

- [ ] `REQ-01` `module-inventory.md` — cross-checked against Master Plan §29's 30-row table
- [ ] `REQ-02` `domain-entities.md` — each entry states whether an SSOT/§2.9 equivalent exists
- [ ] `REQ-03` `business-rules.md` — every rule carries a source citation **and** a test target
- [ ] `REQ-04` `fr-index.md` — **all 87 FRs**, each traced to its story and a test
- [ ] `REQ-05` `edge-cases-and-risks.md`
- [ ] Every rule engine named in `AGENTS.md` §4.1 has at least one row
- [ ] Silence in the corpus is recorded as `GAP — needs design (PC-xxx)`, never invented

> ⚑2 still open: was `docs/archive/corpus/` deleted, or never migrated? It determines whether this is *extraction* (verifiable citations) or *summarisation* (weaker provenance). The work is the same either way.

### 5. ~~Initialise the repository~~ ✅ **DONE 2026-09-28** (GAP-02 closed)

- [x] `git init -b main`; `origin` → `siraj-77/EduFlow` (private)
- [x] `.gitignore` hardened — `.claude/`, `graphify-out/`
- [x] Pushed as a fast-forward on top of `0bedbe30`; no force
- [x] Branch protection — ❌ **unavailable** (needs a paid plan for private repos). Report, don't work around it

### 6. ~~Scaffold the monorepo~~ ✅ **DONE 2026-09-29** (GAP-03 closed) — **with 5 defects, now tracked as P0a**

- [x] 6 packages, pnpm 11 + Turborepo, TS strict
- [x] 12 API module folders × 12 directories, matching `AGENTS.md` §3
- [x] 4 locales with key-parity enforcement
- [x] Tokens in light **and** dark; `prefers-reduced-motion` added
- [x] `.env.example` + fail-fast validation + `README.md`
- [x] **API boots with no `.env`** — honest `PERSISTENCE DISABLED` banner (`ADR-019`)
- [x] **Web serves `/en` `/ta` `/si` `/ar`**, `/ar` with `dir=rtl`
- [x] typecheck · lint · test (51) · build · docs:verify green
- [ ] ⚠️ `docker-compose.yml` — **written, but invalid YAML** (FIX-03)
- [ ] ⚠️ shadcn/ui — **not initialised.** The lint rule banning raw elements has nothing to point at (FIX-11)
- [ ] ⚠️ Locale negotiation — `proxy.ts` is dead code on Next 15 (FIX-04)

---

## P1 — Needed Before the First Feature

- [ ] `ARC-03` `IClock` — the **ESLint ban on `Date.now()`/`new Date()`/`Math.random()` is already live**; only the `IClock` interface and shared test factories remain (P4)
- [ ] `ARC-04` guard decorator **shapes** + static check — so no route is ever written without all three (P3/P4)
- [ ] `ARC-05` RBAC permission-matrix fixture — **seeded in Sprint 1, not deferred to `PLT-205` in Sprint 4**
- [ ] `ARC-06` `Money` value object + journal-balance invariant test — ⚠️ **front-loaded by proposed `ADR-024`**; the `bigint` → JSON boundary must be designed here, per `ADR-002:48`
- [x] `DSN-01` `packages/ui-kit` tokens — **done 2026-09-29**: light + dark in `styles.css`, `prefers-reduced-motion` added, verified by test. *shadcn/ui components themselves are FIX-11*
- [x] `DSN-02` `packages/i18n-resources` — **done 2026-09-29**: en/ta/si/ar, 38 keys, parity enforced by 10 vitest cases
- [ ] `DSN-03` RTL foundation — **core proven 2026-09-29** (`/ar` serves `dir=rtl`). *Login, form and table archetypes still to build (P4W).*
- [ ] `DSN-04` font stack for Tamil/Sinhala/Arabic — ⚑ **needs owner decision**; PDF pipeline must be covered too. *A provisional Noto stack is in `styles.css`.*
- [x] `DSN-05` `prefers-reduced-motion`, ≥ 44 px touch targets — **done 2026-09-29**, verified by test
- [ ] `DSN-06` CI enforcement: no literal user-facing string in JSX/TSX. *The no-hard-coded-hex half is done and firing; the string half is P3 — a heuristic produces false positives, which is worse than no check. `ARCHITECTURE.md:346` currently overstates this.*
- [x] `OPS-01` `infra/docker/docker-compose.yml` — **services defined 2026-09-29**: Postgres, Redis, MinIO, Mailpit. ⚠️ **the file does not parse — FIX-03**
- [ ] `OPS-02` CI pipeline — **P3, the top priority after P0a**
- [ ] `OPS-03` coverage gate — ✅ **the command now runs** (FIX-01) and thresholds match `AGENTS.md` §4 exactly (90/85 domain + use-cases, 70 controllers, 80 frontend hooks), and the gate was proved able to fail. ⚠️ **but the globs match 0 instrumented files, so it enforces nothing today — FIX-26**
- [ ] `OPS-04` security scanning — dependency, OWASP ZAP, **secret scanning**, log-content scan (P3)
- [x] `OPS-05` `docs:verify` — **done 2026-09-29**: **155** references across 8 documents resolve
- [ ] `OPS-07` backup & restore **drill** — a restore actually performed and verified
- [x] `ARC-07` `docs/adr/` — **21 ADRs written** (001–021, contiguous). **None is `Accepted`** — see ⚑10
- [ ] `ARC-08` `directives/` — module, route, rule-engine, table-driven-test, new-`ILedgerPostingRule` SOPs
- [x] `ARC-09` contradiction register C-01…C-08 — **closed** 2026-09-28/29; see the resolved-conflicts table in `CHANGELOG.md`
- [ ] ⬜ `ADR-022` write down D25 (`eslint-config-next` rejected) · `ADR-023` write down D24 (toolchain versions) — both decisions were taken without one
- [ ] ⬜ `ARCHITECTURE.md` — add the missing coverage, CI/CD, **per-school deployment topology** and error-handling sections; correct the `:343,346,351` overclaims (FIX-18, FIX-19)
- [ ] ⬜ `PLATFORM_CORE_PLAN.md` — §3.1/§8 still show the toolchain as missing; `:139`'s Gate M2 claim is circular (DOC-07)

---

## P2 — Housekeeping

- [ ] `REQ-06` SSOT "existing equivalent" index
- [ ] `REQ-07` resolve or formally defer `PC-000`…`PC-006` (each needs a named owner and a target milestone — `PC-005`/`PC-006` are currently unticketed)
- [ ] `OPS-06` per-school deployment provisioning — including *"migrations applied per school database"*, which `AGENTS.md` §2.1 requires and **no document currently owns**
- [ ] `OPS-08` observability skeleton — correlation IDs, file **and** DB error logging, 25 MB × 4 rotation
- [ ] `OPS-09` staging environment
- [ ] `apps/mobile` scaffold — **milestone 2** (`AGENTS.md` §7 D5, `ADR-005`)
- [ ] `infra/terraform` — `AGENTS.md` §3.1 marks it optional; `OPS-06` first
- [ ] ⚑ **Install Docker Desktop** (optional) or **PostgreSQL for Windows** (required at P4). See `README.md` § "Running without Docker" — Redis is the one service with no official Windows build
- [ ] `docs/analysis/LEGACY_REUSE_INVENTORY.md` — per-file port judgements (created 2026-09-28 with measurements only)
- [ ] `docs/modules/<module>/` working notes as modules land
- [ ] Reconcile the three phase-numbering schemes (SSOT §4 precedence table now records the answer; `AGENTS.md` and SRS §15 still need updating)
- [ ] Fix the remaining S3 hygiene items — `pnpm-workspace.yaml` `allowBuilds` placeholders (FIX-22), `rm -rf` in `pnpm clean` on Windows (FIX-23), the duplicate Prettier config (FIX-21), the source-vs-built CSS token test gap (FIX-24)

---

## Decisions Needed From the Owner

Blocking the items marked ⚑.

| # | Question | Blocks |
|---|---|---|
| ⚑1 | Rotate the token + is the third-party `ANTHROPIC_BASE_URL` intentional? | §1 above |
| ⚑2 | Was `docs/archive/corpus/` deliberately deleted, or never migrated? | Extraction reliability |
| ⚑3 | Approve the four `AGENTS.md` corrections: D8 legacy path, D9 i18n claim, D10 raw-SQL count, C-01 repo name | Doc accuracy |
| ⚑4 | Font stack for Tamil / Sinhala / Arabic (screen **and** PDF) | `DSN-04` |
| ⚑5 | Required report-card layouts for the initial customer set — Master Plan §30 flags this as needed **before Phase 5** | Document/Print Engine abstraction |
| ⚑6 | ~~Activation server: in this repo or a separate service?~~ | ✅ **Answered** — `ADR-010`: **external vendor service**, port + OpenAPI + local fake. Private key never in this repo |
| ⚑7 | ~~`SRS` §24 Gate M2 vs. the licensing sprint position.~~ | ⚠️ **Reopened 2026-09-29.** The reorder puts licensing at P8, before the P14 gate — but `SRS §24` Gate M2 is defined at *end of Phase 1*. **Relabelling a step is not moving a gate**, and `SRS §24` was never amended. Now ⚑D |
| ⚑8 | Design `PC-000`…`PC-006` now, or formally defer with owners and milestones? | `REQ-07` |
| ⚑9 | **`SRS` §19 vs. `AGENTS.md` §7 (D5) on mobile.** `SRS` puts a Parent/Student Personal Portal in the MVP and `SRS` §20 AC-5 requires it; `AGENTS.md` makes `apps/mobile` milestone 2; Master Plan §24 carries a full mobile architecture. Three documents, two positions. Options in `ADR-005` — A (adopt D5, amend `SRS`), B (revert to `SRS`), C (parent read-only **web** portal) | MVP scope · **Recommended: C**, then A |
| ⚑10 | **Approve `ADR-001`…`ADR-021`.** None is `Accepted`. `ADR-020`/`ADR-021` are closest — decided 2026-09-29 as agent recommendations ratified in one conversation | Everything that depends on a decision |
| ⚑11 | **Approve proposed story `PLT-107`** (first-admin bootstrap via one-time setup token). School Setup Workflow §6.5 requires it; **no existing story covers it**, so a fresh deployment cannot create its first administrator | Epic 01 / school onboarding |
| ⚑12 | **The `M2` naming legend** — approve the "Milestone 2" vs "Gate M2" distinction in `SSOT.md` §4 | All milestone references |
| **⚑A** | **Approve a one-line change to `AGENTS.md` §3.1** (`Jest` → `Vitest`). D27 decided the runner and `ADR-020` records it, but §3.1 is inside §3 which this session is directed not to touch | **The contract still contradicts the code** |
| **⚑B** | **Approve the `AGENTS.md:8,17` status correction.** Both still say *"pre-scaffold / no application code exists yet"*. They are in the preamble and §1 — **not** §2/§3/§13 — so this is D14, not the standing restriction | Every session opens by reading a false state |
| **⚑G** | **`Money` wire format.** `ADR-002:48` says the `bigint` → JSON boundary *"must be designed in `ARC-06`, not discovered later"*, yet `Money{amountMinor: bigint}` already ships in `packages/shared-types`. Proposed as `ADR-024` | `ARC-06`, `PLT-301` |

---

## ADR Approval — Prompt Pack P1 ⚑10

`docs/adr/ADR-001` … `ADR-021` are **written but none is `Accepted`.** Review them, edit, and mark each Accepted. Highest-risk first:

| ADR | Why it needs a human |
|---|---|
| [ADR-003](../adr/ADR-003-new-app-single-tenant-selective-reuse.md) | **Reconstructed**, not contemporaneous. Records who decided, and whether the D1 carve-out was in the original decision. **Needs sign-off most of all** |
| [ADR-013](../adr/ADR-013-audit-durability-same-transaction.md) | **Overrides the Jira document's `PLT-402` text.** Changes the `IAuditRecorder` port signature |
| [ADR-018](../adr/ADR-018-public-route-escape-hatch.md) | Introduces the only exemption from the fail-closed rule |
| [ADR-020](../adr/ADR-020-test-runner-is-vitest.md) | **New.** Its `AGENTS.md` §3.1 amendment is blocked — see ⚑A |
| [ADR-021](../adr/ADR-021-next-intl-is-the-web-i18n-library.md) | **New.** Ratifies a decision that was taken without a recorded confirmation |
| [ADR-009](../adr/ADR-009-licence-signature-ecdsa-canonical-json.md) | If a signing service already issues **RSA**, use RSA and skip this ADR |
| [ADR-010](../adr/ADR-010-activation-server-external-boundary.md) | Confirms the private key never enters this repo |
| [ADR-005](../adr/ADR-005-mobile-is-milestone-2.md) | **Conflicts with `SRS` §19** — see ⚑9 |
| [ADR-017](../adr/ADR-017-deviations-from-jira-sprint-order.md) | The four pull-forwards. The Jira sprint table no longer describes the real order |
| ADR-001, 002, 004, 006, 007, 008, 011, 012, 014, 015, 016, 019 | Lower risk. Each has a recommended default already applied |

---

## Proposed Story — `PLT-107` ⚑11

**First-admin bootstrap via a one-time setup token.**

- **Required by:** `EduFlow_School_Setup_Workflow_v1.md` §6.5 (Phase 3, first launch, first administrator).
- **Gap:** **no `PLT` story covers it.** The 33 stories in the Jira document do not include any bootstrap mechanism, and `PLT-101` is ordinary credential login against existing users — so a fresh deployment has **no way to create its first administrator.**
- **Status:** **proposed.** IDs are never renumbered (`AGENTS.md` §7), so this is `PLT-107`, appended.
- **Where it runs:** inside Epic 01, **before Epic 03 completes** (Prompt Pack §2.2), because licence activation (P8) and school settings (P10) both presuppose an administrator exists.
- **Constraints it inherits:** no default credentials, ever; the setup token is single-use, short-lived, and consumed on first successful use; the act is audited; the route is `@Public('<reason>')` (there is no user to authenticate) and therefore allowlisted per `ADR-018`.

**Next step:** the Prompt Pack P5 prompt asks for the story *text* to be proposed for approval. Draft it as part of Epic 01, do not implement without sign-off.

---

## Do Not

- ❌ **Do not start `PLT-101`** before the entry conditions in `PLATFORM_CORE_PLAN.md` §2 are met — chiefly the **test harness** and the **ERD**. The test runner now exists (D27) and all 51 tests pass, but the harness is **not yet trustworthy**: `test:coverage` cannot run (FIX-01), `test:e2e` has no tests (FIX-02), and nothing runs in CI (FIX-12)
- ❌ **Do not merge while any §4 gate is red.** Two are (`test:e2e`, `format:check`). P0a exists for this
- ❌ **Do not treat a config file existing as a gate passing**, and equally **do not treat a green coverage gate as enforced coverage.** FIX-01 closed while the tiers still matched 0 files — `AGENTS.md §4.1`'s "a test count is not evidence of coverage" applies to a passing gate too
- ❌ **Do not use `pnpm add` expecting exit 0** until FIX-22 is fixed — it exits 1 on `ERR_PNPM_IGNORED_BUILDS` even when the install succeeds. Read the lockfile, not the exit code
- ❌ **Do not port any legacy code** until `LEGACY_REUSE_INVENTORY.md` names the file with a reason (`AGENTS.md` §5.2)
- ❌ **Do not build tenancy machinery.** See `ARCHITECTURE.md` §5 for the worked counter-example of exactly why
- ❌ **Do not hard-code user-facing strings.** The four-locale skeleton must exist before the first UI story, not after
- ❌ **Do not invent business rules** to fill the idea-bank. **A gap is visible; a fabricated threshold is not** — and do not restore the `139 / 257 / 35 / 73` figures `AGENTS.md` §6 carried until `REQ-01…05` has actually run (D28)
- ❌ **Do not queue sensitive-action audit writes.** `ADR-013` — a queued audit row can be lost, and a record that exists to prove what happened cannot be probabilistic
- ❌ **Do not use a fake permission key** for a public route. Use `@Public('<reason>')` and add an allowlist row (`ADR-018`)
- ❌ **Do not invent `Student` / `Class` / `Teacher`** in Platform Core. `PLT-203` uses abstract ports with fakes
- ❌ **Do not follow the Jira sprint table literally** — it cannot satisfy its own acceptance criteria. Use the P0–P14 sequence (`ADR-017`)
- ❌ **Do not renumber** any `PLT-*` or `P*` identifier. New work is `FIX-nn` / `DOC-nn` / `ADR-0nn`
- ❌ **Do not add a new top-level module** without checking Master Plan §5 and the module inventory
- ❌ **Do not port the frontend template's social-login buttons** or its marketing claims. See `docs/design/FRONTEND_TEMPLATE.md`
- ❌ **Do not edit `AGENTS.md` §2, §3 or §13** without explicit per-line owner sign-off

---

*Companion documents: `docs/analysis/CODE_AUDIT_2026-09-29.md` · `docs/work/REMEDIATION_PLAN_2026-09-29.md` · `docs/work/GAP_ANALYSIS_2026-09-28.md` · `docs/work/PLATFORM_CORE_PLAN.md` · `docs/work/WORKLOG.md` · `docs/work/BACKLOG.md` · `docs/core/SSOT.md` · `docs/core/EduFlow_Agentic_Prompt_Pack_PlatformCore_v1.md`.*
