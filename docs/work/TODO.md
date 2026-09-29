# TODO — Next Actions

**Last updated:** 2026-09-30
**How to use:** The topmost unchecked item is the next task. Log completion in `WORKLOG.md` in the same commit.
**Analysis:** `docs/analysis/CODE_AUDIT_2026-09-30.md` (**current** evidence) · `docs/work/ACTION_PLAN_2026-09-30.md` (**the action plan**) · `docs/analysis/CODE_AUDIT_2026-09-29.md` (prior audit) · `docs/work/REMEDIATION_PLAN_2026-09-29.md` (superseded for EPIC-00/EPIC-DOC scope) · `docs/work/GAP_ANALYSIS_2026-09-28.md` (pre-scaffold baseline) · `docs/work/PLATFORM_CORE_PLAN.md`

---

## G0 — Commit the work that exists 🔴 **DO THIS FIRST**

> **Added 2026-09-30.** `SSOT.md:16` said *"8 commits, working tree clean."* Measured: **14 commits, 15 modified, 12 untracked.** The entire ARC-01 ERD, the FIX-01/02/22 fixes, the 11-test e2e suite and every doc change from the last 24 hours exist **only in the working tree** and have never been pushed. A TDD checkpoint that is never committed is not a checkpoint, and `AGENTS.md §9` makes the worklog part of the commit.

- [ ] **G0-1** 🔴 Commit the 27 uncommitted files as the ARC-01 / FIX-01 / FIX-02 / FIX-22 checkpoints, in WORKLOG order. `git status --porcelain` empty; `pnpm test` still exits 0. **No amend, no squash** — the RED/GREEN pairs are the evidence. → `AUD-30-09`

---

## G1 — Make the gates honest 🔴 **THE HIGHEST-LEVERAGE WORK IN THE REPOSITORY**

> **Added 2026-09-30.** Full stories, points and acceptance criteria: `docs/work/ACTION_PLAN_2026-09-30.md` **EPIC-G1 (23 pts)**.
>
> The 2026-09-30 audit found **four gates that are green and verify nothing**, and **one test that has never run**. All five were found by *executing* the gates; none was visible from reading the configuration. `coverage-gate.spec.ts` and `e2e-gate.spec.ts` were written on 2026-09-29 to solve exactly this problem and they work — the class of defect then recurred in four adjacent places they do not cover.
>
> **Measured 2026-09-30:** `typecheck` 0 ✅ · `lint` 0 ✅ · `test` 0 ⚠️ (103 tests, 3 never run) · `build` 0 ✅ · `docs:verify` 0 ✅ (**188** refs) · `format:check` **2** ❌ · `test:coverage` 0 ❌ **enforces nothing** · `test:integration` 0 ❌ **runs nothing** · `test:e2e` not run ⚠️ **one test vacuous**.
>
> **Honest score: 5 of 9 green and trustworthy, 2 green but hollow, 1 red, 1 not run.**

- [x] **G1-1** ✅ **P0 — `web-port.spec.ts` had never executed.** **DONE 2026-09-30.** RED observed twice: `vitest run web-port.spec.ts` → `No test files found, exit 1` *even when named explicitly*, and the suite green at `4 passed (4)` while the test did not run. Moved to `src/lib/web-port.spec.ts` beside the module it tests; `playwright.config.ts` import updated; the spec's root-derivation replaced with a walk up to the `@eduflow/web` manifest so it is position-independent. **GREEN `2 files / 7 tests`** — the exact predicted count. **Teeth proven:** `--port 3500` → `3000` gives `AssertionError: "dev" must use --port 3500: expected 'next dev --port 3000' to contain '--port 3500'`, exit 1; reverted. Side effect: the `src/lib/**/*.ts` coverage tier is now **live** (`web-port.ts` 100%) — a partial `FIX-26` win obtained by fixing the real defect. Full evidence: `TDD_EVIDENCE_GATES.md`. → closes **`AUD-30-01`**
- [ ] **G1-2** 🔴 **A test-file oracle.** Every `*.spec.ts` must be inside its runner's `include`. **This is what stops G1-1 recurring** — G1-1 fixed one instance, G1-2 fixes the class. Generalises the `coverage-gate.spec.ts` guard-on-the-guard pattern
- [ ] **G1-3** 🔴 **Integration gate guards.** `apps/web`'s `test:integration` is `echo "no web integration suite at P2" && exit 0`; `apps/api`'s is `passWithNoTests: true`. `isPassingStub()` already exists in `e2e-gate.spec.ts` — extend it from `test:e2e` to `test:integration`. → `AUD-30-02`
- [ ] **G1-4** 🔴 **Nav-parity floor.** `shell.spec.ts` resolves `nav a, header a`; the app renders **zero** `<a>` elements, so `expect(0).toBe(0)` passes. Add `expect(en.length).toBeGreaterThan(0)`. The tagline test nine lines above already carries the correct floor. → `AUD-30-03`
- [ ] **G1-5** ⚠️ **Dark theme e2e.** The theme test only asserts `'light'`; Playwright's default colour scheme is light, so `ThemeScript`'s `prefers-color-scheme: dark` and `localStorage` branches never run. `AGENTS.md` §3.2.5 requires both themes. → `AUD-30-04`
- [ ] **G1-6** 🔴 **Coverage globs bite.** `domain/`, `use-cases/` and `*.controller.ts` match **0 files**; `web` reports 0%. Add tiers covering the real source, and assert every configured glob matches ≥1 instrumented file. → `FIX-26`
- [ ] **G1-7** ⚠️ `pnpm format:check` (exit 2, 60 files, **including `AGENTS.md` itself** — reformatting the contract needs owner approval, `D14`)
- [ ] **G1-8** ⚠️ `packages/config` gets `lint` + `typecheck`. It exports every ESLint config and the base tsconfig, and **no gate visits it**. Re-rated S3 → S1 (`D37`). → `AUD-30-05`
- [ ] **G1-9** ⚠️ `turbo.json` `globalDependencies`; remove `**/*.spec.ts` from the **4** tsconfig excludes (not 5 — `apps/web` has none) → `FIX-06`, `FIX-07`
- [ ] **G1-10** ⚠️ `docker-compose.yml` — `/**` is not a YAML comment and the file does not parse; pin `minio`/`mailpit` off `:latest` → `FIX-03`
- [ ] **G1-11** ⚠️ `main.ts` `??` silent default; validate `WEB_ORIGIN` + `NEXT_PUBLIC_API_URL` (`D32`) → `FIX-08`
- [ ] **G1-12** ⚠️ `src/modules/modules/` → `registry/`; anchor the ESLint globs → `FIX-09`

**Exit criterion — the negative test:** for each of the 9 gates, introduce one deliberate defect, **watch it exit non-zero**, revert. Nine commands, nine observed reds, recorded in `docs/work/TDD_EVIDENCE_GATES.md`. Until that is done, no gate in this epic is more than a file on disk.

---

## G2 — Make the record accurate ⚠️ 13 pts

> **Six quantity classes are wrong at once:** `docs:verify` 147/155/179 → **188** · tests 51/63/67/78 → **103** · commits 3/4/8 → **14** · ADRs 19/21 → **21** · tracked files 262 → **269** · tsconfigs excluding specs 5 → **4**. Six wrong numbers is evidence the class recurs, so the fix is to **generate** the report, not write it (`D38`).

- [ ] **G2-1** Correct `SSOT.md` §1 — every number re-measured; delete the duplicate `pnpm test` row; the gate line becomes *"5 of 9 green and trustworthy, 2 hollow, 1 red"*, not "6 of 7". → `AUD-30-06` ✅ **partly done by this edit**
- [ ] **G2-2** 🔴 **`scripts/report-status.mjs`** — run the 9 gates, emit the `SSOT.md` §1 table. The `D33` pattern applied to the status report: one source, generated artefact, drift **impossible**. Include a `--check` mode for CI. Worth more than fixing six instances
- [ ] **G2-3** ⚠️ **Renumber the collision.** `REMEDIATION_PLAN_2026-09-29.md` uses `ARC-01` for `IClock` and `OPS-01` for the integration harness; `GAP_ANALYSIS`/`TODO` use `ARC-01` for the **completed** ERD and `OPS-01` for compose. Renumber to `ARC3-xx` / `OPS-01b`; the ERD keeps `ARC-01` everywhere. **`PLT-*` is never touched** (`D39`). → `AUD-30-07`
- [ ] **G2-4** ⚠️ `PLATFORM_CORE_PLAN.md` — delete `:139`'s *"resolves cleanly — P14 sits after P8"* (retracted), fix the Jest reference, the "test runner is missing" line, and *"MinIO is not optional"*. **The doc most likely to mislead the next session.** → `AUD-30-08`, `DOC-07`
- [ ] **G2-5** ✅ **DONE 2026-09-30** — D8/D9/D10 marked *applied* in `SSOT.md §4`; verified in `8105a27`. Three of the four ⚑3 asks retired

---

## P0a — Repair the scaffold ⚠️ 9 of 12 remaining

Full stories, points and acceptance criteria: `docs/work/REMEDIATION_PLAN_2026-09-29.md` EPIC-00. **Re-sequenced into EPIC-G1 (gates), EPIC-G3 (scaffold) and EPIC-G4 (CI) by `ACTION_PLAN_2026-09-30.md`; this section is the index, not the plan.**

- [x] **FIX-01** ✅ ~~`@vitest/coverage-v8` in all 5 test-bearing packages~~ **DONE 2026-09-29** — ⚠️ but the tiers still enforce nothing → **G1-6** / `FIX-26`
- [x] **FIX-02** ✅ ~~one real e2e spec~~ **DONE 2026-09-29** — 11 tests — ⚠️ but one passes vacuously → **G1-4** / `AUD-30-03`
- [ ] **FIX-03** 🔴 `docker-compose.yml` does not parse → **G1-10**
- [ ] **FIX-04** 🔴 `proxy.ts` compiles to zero middleware → **G3-3**
- [ ] **FIX-05** ⚠️ `pnpm format:check` → **G1-7**
- [ ] **FIX-06 / FIX-20** ⚠️ `turbo.json` + `packages/config` has no `scripts` → **G1-8**, **G1-9**
- [ ] **FIX-07** ⚠️ specs excluded from typecheck in **4** tsconfigs → **G1-9**
- [ ] **FIX-08** ⚠️ silent default in `main.ts` (D32) → **G1-11**
- [ ] **FIX-09** ⚠️ `src/modules/modules/` → `registry/` → **G1-12**
- [ ] **FIX-10** ⚠️ `ThemeToggle` + `loading.tsx` / `error.tsx` / `not-found.tsx` → **G3-2**
- [ ] **FIX-11** 🔴 shadcn/ui. **Makes `AGENTS.md` §3.2.1 unsatisfiable today** — ESLint bans 6 raw elements, `packages/ui-kit` has **zero** components. **Must precede P3's human gate.** → **G3-1**
- [x] **FIX-22** ✅ ~~build-script allow-list inert~~ **DONE 2026-09-29** — `allowBuilds`, not `onlyBuiltDependencies`
- [ ] **FIX-25** ⚠️ `docs-verify.mjs` cannot resolve `path:line` refs. **Third reactive patch to the same tool for the same class**
- [ ] **FIX-26** ⚠️ coverage tiers match **zero** instrumented files → **G1-6**

---

## P0 — Do These First

> **State 2026-09-30:** P2 (scaffold) is DONE. The ERD is **written** (ARC-01) and Phase 0 has exited — but it is **uncommitted**, so do **G0** before anything else. The top engineering priority is **EPIC-G1**, then **EPIC-G4 (P3 CI)**.
>
> ⚠️ **`PLT-101` entry condition is NOT met.** `TODO.md:226` records it as *"the harness is still not trustworthy"*, and the 2026-09-30 audit confirmed why in more detail. **Do not start a Platform Core story until EPIC-G1 closes.**

### 1. Rotate the exposed credential — ⚠️ **ACCEPTED RISK, NOT BLOCKING** _(decided 2026-09-28, D16)_

`.claude/settings.json` holds a **live** `thk_live_` bearer token and a third-party `ANTHROPIC_BASE_URL`.

**Deferred by owner decision.** The token was **never committed** — `.claude/` was added to `.gitignore` _before_ `git init`, and the first-commit staging audit confirmed the token value is absent. The remote is **private**, sole holder. Residual exposure is **local-disk only**.

- [x] `.claude/` gitignored — `.gitignore:99`
- [x] Verified absent from the first commit — staging gate 2b/2c
- [ ] _Deferred:_ rotate at the issuer
- [ ] _Deferred:_ decide whether the third-party base URL is intentional
- [ ] **Enable secret scanning in CI** — P3.6. **The only un-done item here.** → EPIC-G4, G4-5

**Revisit if:** the repo goes public · a second person is granted access · the folder is shared or archived · the machine is shared.

### 2. Prompt Pack P3 — Quality gates and CI 🔴 **AFTER EPIC-G1** · 34 pts

The `AGENTS.md` rules are already machine-enforced **locally**. Nothing enforces them for anyone else. P3 turns the contract from prose into something that fails a build. Full stories: `ACTION_PLAN_2026-09-30.md` **EPIC-G4**.

- [ ] **G4-1** `check-route-guards` — TypeScript AST: every NestJS route must carry `@RequirePermission(...)` **or** `@Public('<reason>')`. Reject `@Public` combined with `@RequireEntitlement`, and on entity-scoped routes (`ADR-018`)
- [ ] **G4-2** `@Public` allowlist with mandatory justification, enforced **both ways**
- [ ] **G4-3** `check-i18n` — `ARCHITECTURE.md:346` claims ESLint enforces this; **no such rule exists**. Then fix the claim either way (`FIX-18`)
- [ ] **G4-4** `check-worklog` (`AGENTS.md` §9)
- [ ] **G4-5** gitleaks + dependency audit — the compensating control for `D21`
- [ ] **G4-6** lint-staged; commit-msg Conventional Commits referencing the requirement ID
- [ ] **G4-7** React-hooks ESLint rules, dropped with `eslint-config-next` (D25)
- [ ] **G4-8** CI workflow: PR → typecheck → lint → custom checks → unit + coverage → build → integration (containerised Postgres) → secrets scan. E2E on `main` only
- [ ] **G4-9** ⚠️ **Human gate** — a PR with (a) an unguarded route (b) a `new Date()` in a use-case (c) a raw `<button>` (d) a missing i18n key must **FAIL CI for each**, then pass. ⚠️ **Requires G3-1 (shadcn) first** — the gate needs a raw `<button>` to fail *and* a compliant `<Button>` to pass

### 3. Write the ERD ✅ **DONE 2026-09-29 (ARC-01) — supersedes D22. Phase 0 exited. ⚠️ UNCOMMITTED → G0-1**

`apps/api/prisma/schema.prisma` now holds 14 generated models, and the diagram is generated from **the same source** — see `docs/diagrams/ERD_PLATFORM_CORE.md` for every decision, its rationale, and 7 open questions. Gate: `apps/api/src/config/{prisma-schema,schema-generation}.spec.ts` — **26 cases**, including a live `prisma validate` subprocess and a byte-identical check that neither artefact has been hand-edited.

- [x] Platform Core entities: `User` `Role` `Permission` `RolePermission` `Session` `RefreshToken` `AuditRecord` `ErrorLog` `SchoolSettings` `ModuleRegistry` `License` `NotificationPreference` `NotificationDelivery` `StoredFile` — **and no more.** The gate fails if a 15th model appears, and names `Student`/`Class`/`Teacher` explicitly as forbidden (`PLT-203`/`PLT-801` use ports with fakes)
- [x] Money as **integer minor units + explicit currency** (`ADR-002`) — `currency_code` / `minor_unit_scale` / `rounding_mode` on `SchoolSettings`, and the gate **fails if `Float` or `Decimal` is ever added**. No money column exists in Platform Core
- [x] `schoolId` as **metadata, not a security control** (`ADR-003`) — on all 14, injected by the renderer, no `School` table, no foreign key, no `SUPER_ADMIN`, no `tenant` anywhere
- [x] Uniqueness scoped within one school's database — never global. Every `@unique`/`@@unique` must name `school_id` first
- [x] `audit_records`: `REVOKE UPDATE, DELETE` from the application role — plus `TRUNCATE`, **plus a `BEFORE UPDATE OR DELETE` trigger**, because a revoke binds only the role it is revoked from and Prisma migrates as the owner. `apps/api/prisma/hardening/audit-immutability.sql`, guarded by a test
- [x] **Do not** port the legacy 59-model tenant scoping — nothing resembling `prisma-tenant-extension` or ambient tenant context exists
- [ ] **⚠️ Prove the REVOKE, don't just ship it.** No PostgreSQL in this environment (`ADR-019`), so nothing has actually attempted an `UPDATE` against `audit_records`. Needs an integration test — P4 / `OPS-07`
- [ ] **7 open questions recorded, not answered** — in `docs/diagrams/ERD_PLATFORM_CORE.md` §5. Two need a decision before `PLT-201`: **one role per user** (a `UserRole` table would be a 15th entity), and the **deliberate deviation from `PLT-201`** making `Role.school_id` NOT NULL
- [ ] Resolve the `PC-004` admission gap — **untouched, and not blocked by this work**
- [ ] **Sign-off recorded before `PLT-101` starts** — still open

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

> ⚑2 still open: was `docs/archive/corpus/` deleted, or never migrated? It determines whether this is _extraction_ (verifiable citations) or _summarisation_ (weaker provenance). The work is the same either way.

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
- [x] `DSN-01` `packages/ui-kit` tokens — **done 2026-09-29**: light + dark in `styles.css`, `prefers-reduced-motion` added, verified by test. _shadcn/ui components themselves are FIX-11_
- [x] `DSN-02` `packages/i18n-resources` — **done 2026-09-29**: en/ta/si/ar, 38 keys, parity enforced by 10 vitest cases
- [ ] `DSN-03` RTL foundation — **core proven 2026-09-29** (`/ar` serves `dir=rtl`). _Login, form and table archetypes still to build (P4W)._
- [ ] `DSN-04` font stack for Tamil/Sinhala/Arabic — ⚑ **needs owner decision**; PDF pipeline must be covered too. _A provisional Noto stack is in `styles.css`._
- [x] `DSN-05` `prefers-reduced-motion`, ≥ 44 px touch targets — **done 2026-09-29**, verified by test
- [ ] `DSN-06` CI enforcement: no literal user-facing string in JSX/TSX. _The no-hard-coded-hex half is done and firing; the string half is P3 — a heuristic produces false positives, which is worse than no check. `ARCHITECTURE.md:346` currently overstates this._
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
- [ ] ⬜ `ADR-025` write down **D33** (ERD + `schema.prisma` generated from one source, superseding D22) · `ADR-026` write down **D34** (`audit_records` immutability as privilege + trigger). **Numbering is 025+ because 022–024 are already spoken for.** Both are currently recorded only in `SSOT.md` §4 — see `docs/adr/README.md`
- [ ] ⬜ `ARCHITECTURE.md` — add the missing coverage, CI/CD, **per-school deployment topology** and error-handling sections; correct the `:343,346,351` overclaims (FIX-18, FIX-19)
- [ ] ⬜ `PLATFORM_CORE_PLAN.md` — §3.1/§8 still show the toolchain as missing; `:139`'s Gate M2 claim is circular (DOC-07)

---

## P2 — Housekeeping

- [ ] `REQ-06` SSOT "existing equivalent" index
- [ ] `REQ-07` resolve or formally defer `PC-000`…`PC-006` (each needs a named owner and a target milestone — `PC-005`/`PC-006` are currently unticketed)
- [ ] `OPS-06` per-school deployment provisioning — including _"migrations applied per school database"_, which `AGENTS.md` §2.1 requires and **no document currently owns**
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

| #      | Question                                                                                                                                                                                                                                                                                                                                                                            | Blocks                                                                                                                                                                                                                         |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ⚑1     | Rotate the token + is the third-party `ANTHROPIC_BASE_URL` intentional?                                                                                                                                                                                                                                                                                                             | §1 above                                                                                                                                                                                                                       |
| ⚑2     | Was `docs/archive/corpus/` deliberately deleted, or never migrated?                                                                                                                                                                                                                                                                                                                 | Extraction reliability                                                                                                                                                                                                         |
| ⚑3     | Approve the four `AGENTS.md` corrections: D8 legacy path, D9 i18n claim, D10 raw-SQL count, C-01 repo name                                                                                                                                                                                                                                                                          | Doc accuracy                                                                                                                                                                                                                   |
| ⚑4     | Font stack for Tamil / Sinhala / Arabic (screen **and** PDF)                                                                                                                                                                                                                                                                                                                        | `DSN-04`                                                                                                                                                                                                                       |
| ⚑5     | Required report-card layouts for the initial customer set — Master Plan §30 flags this as needed **before Phase 5**                                                                                                                                                                                                                                                                 | Document/Print Engine abstraction                                                                                                                                                                                              |
| ⚑6     | ~~Activation server: in this repo or a separate service?~~                                                                                                                                                                                                                                                                                                                          | ✅ **Answered** — `ADR-010`: **external vendor service**, port + OpenAPI + local fake. Private key never in this repo                                                                                                          |
| ⚑7     | ~~`SRS` §24 Gate M2 vs. the licensing sprint position.~~                                                                                                                                                                                                                                                                                                                            | ⚠️ **Reopened 2026-09-29.** The reorder puts licensing at P8, before the P14 gate — but `SRS §24` Gate M2 is defined at _end of Phase 1_. **Relabelling a step is not moving a gate**, and `SRS §24` was never amended. Now ⚑D |
| ⚑8     | Design `PC-000`…`PC-006` now, or formally defer with owners and milestones?                                                                                                                                                                                                                                                                                                         | `REQ-07`                                                                                                                                                                                                                       |
| ⚑9     | **`SRS` §19 vs. `AGENTS.md` §7 (D5) on mobile.** `SRS` puts a Parent/Student Personal Portal in the MVP and `SRS` §20 AC-5 requires it; `AGENTS.md` makes `apps/mobile` milestone 2; Master Plan §24 carries a full mobile architecture. Three documents, two positions. Options in `ADR-005` — A (adopt D5, amend `SRS`), B (revert to `SRS`), C (parent read-only **web** portal) | MVP scope · **Recommended: C**, then A                                                                                                                                                                                         |
| ⚑10    | **Approve `ADR-001`…`ADR-021`.** None is `Accepted`. `ADR-020`/`ADR-021` are closest — decided 2026-09-29 as agent recommendations ratified in one conversation                                                                                                                                                                                                                     | Everything that depends on a decision                                                                                                                                                                                          |
| ⚑11    | **Approve proposed story `PLT-107`** (first-admin bootstrap via one-time setup token). School Setup Workflow §6.5 requires it; **no existing story covers it**, so a fresh deployment cannot create its first administrator                                                                                                                                                         | Epic 01 / school onboarding                                                                                                                                                                                                    |
| ⚑12    | **The `M2` naming legend** — approve the "Milestone 2" vs "Gate M2" distinction in `SSOT.md` §4                                                                                                                                                                                                                                                                                     | All milestone references                                                                                                                                                                                                       |
| **⚑A** | **Approve a one-line change to `AGENTS.md` §3.1** (`Jest` → `Vitest`). D27 decided the runner and `ADR-020` records it, but §3.1 is inside §3 which this session is directed not to touch                                                                                                                                                                                           | **The contract still contradicts the code**                                                                                                                                                                                    |
| **⚑B** | **Approve the `AGENTS.md:8,17` status correction.** Both still say _"pre-scaffold / no application code exists yet"_. They are in the preamble and §1 — **not** §2/§3/§13 — so this is D14, not the standing restriction                                                                                                                                                            | Every session opens by reading a false state                                                                                                                                                                                   |
| **⚑G** | **`Money` wire format.** `ADR-002:48` says the `bigint` → JSON boundary _"must be designed in `ARC-06`, not discovered later"_, yet `Money{amountMinor: bigint}` already ships in `packages/shared-types`. Proposed as `ADR-024`                                                                                                                                                    | `ARC-06`, `PLT-301`                                                                                                                                                                                                            |

---

## ADR Approval — Prompt Pack P1 ⚑10

`docs/adr/ADR-001` … `ADR-021` are **written but none is `Accepted`.** Review them, edit, and mark each Accepted. Highest-risk first:

| ADR                                                                 | Why it needs a human                                                                                                                                   |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [ADR-003](../adr/ADR-003-new-app-single-tenant-selective-reuse.md)  | **Reconstructed**, not contemporaneous. Records who decided, and whether the D1 carve-out was in the original decision. **Needs sign-off most of all** |
| [ADR-013](../adr/ADR-013-audit-durability-same-transaction.md)      | **Overrides the Jira document's `PLT-402` text.** Changes the `IAuditRecorder` port signature                                                          |
| [ADR-018](../adr/ADR-018-public-route-escape-hatch.md)              | Introduces the only exemption from the fail-closed rule                                                                                                |
| [ADR-020](../adr/ADR-020-test-runner-is-vitest.md)                  | **New.** Its `AGENTS.md` §3.1 amendment is blocked — see ⚑A                                                                                            |
| [ADR-021](../adr/ADR-021-next-intl-is-the-web-i18n-library.md)      | **New.** Ratifies a decision that was taken without a recorded confirmation                                                                            |
| [ADR-009](../adr/ADR-009-licence-signature-ecdsa-canonical-json.md) | If a signing service already issues **RSA**, use RSA and skip this ADR                                                                                 |
| [ADR-010](../adr/ADR-010-activation-server-external-boundary.md)    | Confirms the private key never enters this repo                                                                                                        |
| [ADR-005](../adr/ADR-005-mobile-is-milestone-2.md)                  | **Conflicts with `SRS` §19** — see ⚑9                                                                                                                  |
| [ADR-017](../adr/ADR-017-deviations-from-jira-sprint-order.md)      | The four pull-forwards. The Jira sprint table no longer describes the real order                                                                       |
| ADR-001, 002, 004, 006, 007, 008, 011, 012, 014, 015, 016, 019      | Lower risk. Each has a recommended default already applied                                                                                             |

---

## Proposed Story — `PLT-107` ⚑11

**First-admin bootstrap via a one-time setup token.**

- **Required by:** `EduFlow_School_Setup_Workflow_v1.md` §6.5 (Phase 3, first launch, first administrator).
- **Gap:** **no `PLT` story covers it.** The 33 stories in the Jira document do not include any bootstrap mechanism, and `PLT-101` is ordinary credential login against existing users — so a fresh deployment has **no way to create its first administrator.**
- **Status:** **proposed.** IDs are never renumbered (`AGENTS.md` §7), so this is `PLT-107`, appended.
- **Where it runs:** inside Epic 01, **before Epic 03 completes** (Prompt Pack §2.2), because licence activation (P8) and school settings (P10) both presuppose an administrator exists.
- **Constraints it inherits:** no default credentials, ever; the setup token is single-use, short-lived, and consumed on first successful use; the act is audited; the route is `@Public('<reason>')` (there is no user to authenticate) and therefore allowlisted per `ADR-018`.

**Next step:** the Prompt Pack P5 prompt asks for the story _text_ to be proposed for approval. Draft it as part of Epic 01, do not implement without sign-off.

---

## Do Not

- ❌ **Do not start `PLT-101`** before the entry conditions in `PLATFORM_CORE_PLAN.md` §2 are met. **The ERD is done** (ARC-01) and `test:coverage`/`test:e2e` are fixed (FIX-01/02), but the harness is still **not trustworthy**: the coverage tiers match **zero** instrumented files (FIX-26), `format:check` fails (FIX-05), and nothing runs in CI (FIX-12). **ERD sign-off is also still owed** — see item 3
- ❌ **Do not merge while any §4 gate is red.** One is (`format:check`). P0a exists for this
- ❌ **Do not treat a green gate as evidence the gate is sound.** Three different defects made `pnpm test:e2e` report a meaningless result — an empty `testDir`, an always-passing stub script, and a readiness probe that accepted a foreign server. Ask what the gate actually ran
- ❌ **Do not treat a config file existing as a gate passing**, and equally **do not treat a green coverage gate as enforced coverage.** FIX-01 closed while the tiers still matched 0 files — `AGENTS.md §4.1`'s "a test count is not evidence of coverage" applies to a passing gate too
- ❌ **Do not reintroduce `onlyBuiltDependencies` as an alternative to `allowBuilds` in `pnpm-workspace.yaml`.** It is **inert in pnpm 11.22.0** — it reads back correctly via `pnpm config get`, so it looks configured, but pnpm never acts on it and every postinstall is blocked. A key that reads back correctly and does nothing is worse than one that is absent (FIX-22)
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

_Companion documents: `docs/analysis/CODE_AUDIT_2026-09-29.md` · `docs/work/REMEDIATION_PLAN_2026-09-29.md` · `docs/work/GAP_ANALYSIS_2026-09-28.md` · `docs/work/PLATFORM_CORE_PLAN.md` · `docs/work/WORKLOG.md` · `docs/work/BACKLOG.md` · `docs/core/SSOT.md` · `docs/core/EduFlow_Agentic_Prompt_Pack_PlatformCore_v1.md`._
