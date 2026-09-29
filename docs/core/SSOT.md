# SSOT — Single Source of Truth

**Purpose:** The answer to "what is the current state of this project?"
**Last updated:** 2026-09-29
**Precedence:** `AGENTS.md` and `ADR-003` > this file > all other documents. This file records *state and decisions*. It does not restate the rules — see `ARCHITECTURE.md` for those.

---

## 1. Current State — 2026-09-29

| | |
|---|---|
| **Phase** | SRS Part E **Phase 0**. Prompt Pack **P0–P2 complete; P3 not started.** |
| **Application code** | **Scaffold only.** Infrastructure, no business logic. 6 workspace packages, **63 passing tests**. **~350 lines of real source**; 147 of 262 tracked files are `.gitkeep`. |
| **Toolchain** | ✅ **Working.** pnpm 11 workspace + Turborepo, TS strict, ESLint 9 flat config, Prettier, **Vitest** (`ADR-020`), Playwright configured. |
| **Version control** | ✅ **Git, on `main`, pushed to the private remote `siraj-77/EduFlow`.** 8 commits, working tree clean. |
| **Repository contents** | `AGENTS.md` · `CLAUDE.md` · `README.md` · `apps/{api,web}` · `packages/{config,shared-types,ui-kit,i18n-resources}` · `infra/docker` · `docs` · `scripts` |
| **Quality gates** | ⚠️ **2 of 7 §4 gates FAIL** (FIX-02 `test:e2e`, FIX-05 `format:check`). `test:coverage` fixed 2026-09-29. See §1a. ❌ **Not in CI** — P3. |
| **CI** | ❌ **None.** No `.github/`, no `.husky/`. Branch protection also unavailable (needs a paid plan for private repos). |
| **ERD** | ❌ **Not written** — owner deferred (D22). `apps/api/prisma/schema.prisma` is deliberately empty. |
| **Phase 0 exit criteria** | SRS ✅ · MVP scope ✅ · **ERD ❌** — so Phase 0 has **not** exited. |
| **Stories completed** | 0 of 33 Platform Core stories. The P0–P2 prompts are infrastructure, not stories. |

**Do not describe this project as "in development".** The correct description is *"scaffolded; three quality gates broken; no feature code yet."*

---

## 1a. Verified working — re-measured 2026-09-29

Every row below was **executed**, not inferred. The previous version of this table listed six gates and omitted the two that fail. Full evidence: `docs/analysis/CODE_AUDIT_2026-09-29.md` §2.

| Gate | Result | Note |
|---|---|---|
| `pnpm typecheck` | ✅ **PASS** | 8/8 tasks, exit 0 |
| `pnpm lint` | ✅ **PASS** | 8/8 tasks, 0 errors, exit 0 |
| `pnpm test` | ✅ **PASS** | **51 tests → 63**, 6 files |
| `pnpm build` | ✅ **PASS** | web prerenders `/en /ta /si /ar` as static HTML |
| `pnpm docs:verify` | ✅ **PASS** | **179 references** across 8 documents resolve |
| **`pnpm test:coverage`** | ✅ **PASS** *(fixed 2026-09-29, FIX-01)* | `@vitest/coverage-v8@2.1.9` now declared and installed in all 5 test-bearing packages. Was `MISSING DEPENDENCY`, exit 1. ⚠️ **exits 0 while enforcing nothing — the §4 globs match 0 instrumented files (FIX-26).** The gate was *proved* able to fail with a temporary probe threshold |
| **`pnpm test:e2e`** | ❌ **FAIL, exit 1** | `Error: No tests found`. `playwright.config.ts:12` points at `apps/web/tests/e2e`, which exists and is empty → FIX-02 |
| **`pnpm format:check`** | ❌ **FAIL, exit 2** | 60 files unformatted, including `AGENTS.md` itself → FIX-05 |
| `pnpm test` | ✅ **PASS** | **63 tests** (was 51) — FIX-01 added a 12-case coverage-gate invariant suite |
| `pnpm add` | ❌ **exit 1** | `[ERR_PNPM_IGNORED_BUILDS]` — the `allowBuilds` placeholders are a malformed allow-list. **`pnpm install` on a clean tree exits 0**, so this is invisible until a dependency is added → FIX-22 |
| `pnpm test:integration` | ⚠️ **PASS but vacuous** | `No test files found, exiting with code 0` — a green gate that tests nothing |
| API boots with **no `.env`** | ✅ PASS | prints the `PERSISTENCE DISABLED` banner, starts, listens on 3001 (D23, `ADR-019`) |
| Web serves all four locales | ✅ PASS | `/en` `dir=ltr` · `/ar` **`dir=rtl`** · `/ta` · `/si`, all 200, `data-theme` present |
| Docker | ❌ not installed | by owner decision, `ADR-019` |

**2 of the 7 `AGENTS.md` §4 gates still fail, plus `format:check`.** FIX-01 closed `test:coverage` on 2026-09-29. `AGENTS.md §4` states *"No production code is merged without all of these green"* — so that rule remains unmeetable. The rest of EPIC-00 is ~19 points, tracked in `docs/work/REMEDIATION_PLAN_2026-09-29.md`.

**A green coverage gate is not the same as enforced coverage.** `pnpm test:coverage` now exits 0 and **was proved able to exit 1** (a temporary probe threshold on `src/main.ts` produced `ERROR: Coverage for lines (0%) does not meet "src/main.ts" threshold (100%)`, exit 1). But the §4 tiers match **zero** instrumented files, so the gate currently enforces nothing — FIX-26. `AGENTS.md §4.1`'s *"a test count is not evidence of coverage"* applies to a passing gate just as much as to a test count.

**Five defects shared one cause: each was invisible to the gate set that actually ran.** The coverage gate that would have caught the coverage problem *was* the broken one. The compose file has no gate at all. `proxy.ts` is dead but the build passes because `generateStaticParams` hard-codes the four locales. A gate marked "done" on the strength of a config file existing, rather than the gate running.

### Enforced rules, each with a test that watches it fire

These are real and verified:

| Rule | Mechanism |
|---|---|
| `domain/` + `use-cases/` import no framework, ORM, queue or vendor SDK | ESLint `no-restricted-imports` — 6 cases |
| `domain/` + `use-cases/` call no `Date.now()` / `new Date()` / `Math.random()` | ESLint `no-restricted-syntax` — 5 cases |
| No `@ts-ignore`, `@ts-expect-error`, bare `any`, empty `catch` | ESLint — 3 cases |
| No raw `<button>` `<input>` `<select>` `<textarea>` `<table>` `<dialog>` | ESLint — ⚠️ **bans what does not yet exist** (FIX-11) |
| No hard-coded colour in a component | ESLint |
| All four locales have identical key sets; none empty; none a copy of English | vitest — 10 cases |
| Every token defined in light **and** dark, at the exact §3.2.5 values | vitest — 8 cases |
| Environment validated before boot; every invalid variable named at once | vitest — 12 cases |
| `dir` correct for all four locales | vitest — 4 cases |

### Claimed but not enforced

| Claim | Reality |
|---|---|
| `ARCHITECTURE.md:346` — "No user-facing literal in JSX/TSX \| ESLint" | **No such rule exists.** P3 |
| `ARCHITECTURE.md:351` — "Jest `coverageThreshold`" | Wrong tool (`ADR-020`) **and** unenforced (FIX-01) |
| `ARCHITECTURE.md:343` — money by "Type system + review" | `Money` is advisory. Nothing forbids a `number` |
| `AGENTS.md:81,498` — *"CI must fail"* on a missing `@RequirePermission` | **No CI, and no `check-route-guards` exists** (FIX-12, FIX-13) |

Per `ARCHITECTURE.md:307` — *"A rule that is not mechanically enforced is a suggestion"* — this table is the honest measure of what `AGENTS.md` §2 currently guarantees.

---


---

## 2. What Exists

| Path | Size | State |
|---|---|---|
| `AGENTS.md` | 35.5 KB | Governing contract. ~21 dangling cross-references — see Gap Analysis §3.3 |
| `docs/core/EduFlow_Project_Master_Plan_v5.2.md` | 79.4 KB | Complete. Most detailed artefact in the repo |
| `docs/core/EduFlow_SRS_TestPlan_MVP_Roadmap_v1.2.md` | 39.5 KB | Complete. Parts A–E |
| `docs/core/EduFlow_Jira_Epics_PlatformCore_RBAC_v1.md` | 35.0 KB | Complete. 9 epics / 33 stories / 199 pts |
| `docs/core/EduFlow_School_Setup_Workflow_v1.md` | 80.3 KB | Complete. **Referenced by `AGENTS.md:19`** — the earlier "orphaned" note was closed by `8105a27` and was stale here |
| `docs/core/ARCHITECTURE.md` | — | **Written 2026-09-28** (was 0 bytes) |
| `docs/core/SSOT.md` | — | This file (was 0 bytes) |
| `docs/template/EduFlow — Frontend Template.html` | 34.4 KB | Token + RTL-pattern donor only. See `docs/design/FRONTEND_TEMPLATE.md` |
| `docs/work/PLATFORM_CORE_PLAN.md` | — | **Written 2026-09-28** (was missing) |
| `docs/adr/`, `docs/analysis/`, `docs/design/`, `docs/idea-bank/README.md` | — | **Created 2026-09-28** |
| `docs/analysis/CODE_AUDIT_2026-09-29.md` | — | **Written 2026-09-29** — 32 findings, evidence for the remediation plan |
| `docs/work/REMEDIATION_PLAN_2026-09-29.md` | — | **Written 2026-09-29** — EPIC-00/DOC/ADR; the successor to `GAP_ANALYSIS_2026-09-28` |
| `docs/adr/ADR-020`, `ADR-021` | — | **Written 2026-09-29** — test runner; web i18n library |

---

## 3. What Does Not Exist

Rewritten 2026-09-29. The previous version of this section opened *"Nothing has been built"* and claimed all source, all infrastructure and all tooling were absent. That was true on 2026-09-28 and false from `951acec` onward, and it contradicted §1 of this same file. The audit is `docs/analysis/CODE_AUDIT_2026-09-29.md`.

### Present, and easy to mistake for absent

| Exists | Detail |
|---|---|
| `apps/api` | NestJS skeleton. 12 module folders × 12 directories, all `.gitkeep`. Real source is `src/config/env.ts` (168 lines) and `src/main.ts` (29 lines) |
| `apps/web` | Next.js 15 skeleton. 7 source files: `layout.tsx`, `page.tsx`, `globals.css`, `theme-script.tsx`, `i18n/{routing,request}.ts` |
| `packages/*` | 4 packages. `shared-types` (contracts), `ui-kit` (**tokens only — zero components**), `i18n-resources` (4 locales, 38 keys), `config` (the enforcement layer) |
| `infra/docker` | 4 services with healthchecks. ⚠️ **the file is currently invalid YAML — FIX-03** |
| `package.json`, `turbo.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.env.example`, `README.md` | All present and working |
| `scripts/docs-verify.mjs` | Working. 155 references across 8 documents resolve |

**147 of the 262 tracked files are `.gitkeep`.** The scaffold is wide and shallow by design — it establishes the tree `AGENTS.md` §3 requires, not behaviour.

### Genuinely absent

| Absent | Consequence | Tracked as |
|---|---|---|
| **The ERD / data model** | `schema.prisma` is **deliberately empty**. No models, no `migrations/`, no `seed.ts`. Blocks `PLT-EPIC-01` and the SRS Phase 0 exit gate | D22, GAP-05 |
| **Requirements content** | `docs/idea-bank/*` is 5 loud stubs, **zero data rows**. The Prompt Pack greps these before **every** story | GAP-04, `REQ-01…05` |
| **CI and pre-commit** | No `.github/`, no `.husky/`, no gitleaks or lint-staged. Every rule is enforced only for the developer who ran it locally | GAP-09, P3 |
| **`check-route-guards`** | §2.3's fail-closed guarantee is prose only. `lint-rules.spec.ts:18-19` says so explicitly | FIX-13, P3 |
| **shadcn/ui components** | No `components.json`; `ui-kit` has zero components — **while `eslint/next.js:22-38` bans raw `<button>`, `<input>`, `<dialog>` and four others.** The first interactive screen cannot be written | FIX-11 |
| **Locale negotiation** | `proxy.ts` is dead code on Next 15; the build compiles **zero** middleware | FIX-04 |
| `directives/` | §10 Layer-1 SOPs | ARC-08 |
| `infra/ci/`, `infra/terraform/` | — | OPS-02, OPS-06 |
| `apps/mobile` | ✅ **correctly absent** — milestone 2 (D5, ADR-005) | — |
| `keys/` | Licence public key | OPS-06 |
| `docs/archive/corpus/` | The extraction's cited source | ⚑2 |
| Any Prisma model | See ERD above | D22 |

### Knowingly incomplete

| Item | State |
|---|---|
| **Money as integer minor units** | `Money{amountMinor: bigint}` is declared in `shared-types` with a passing test, but **no rule prevents a `number`**, and the `bigint` → JSON boundary is undesigned (ADR-002:48; ⚑G) | 
| **User-facing-string ban** | `ARCHITECTURE.md:346` claims ESLint enforces it. **It does not** — P3 |
| **Per-school deployment topology** | `AGENTS.md` §2.1 requires *"migrations applied per school database"*. **No document owns this.** OPS-06 |

---

## 4. Decisions of Record

| ID | Decision | Status | Source |
|---|---|---|---|
| **D1** | **Attendance, Leave and Grading are designed fresh.** Nothing in those three domains is ported from the legacy app; the legacy implementations are not the specification and their tests do not port either. | ✅ Decided | `AGENTS.md` §5.1 carve-out |
| **D2** | Single-tenant: one PostgreSQL database and one application deployment **per school**. Physical isolation. No tenant-scoping machinery, no `SUPER_ADMIN` cross-tenant role, no cross-school aggregate queries against the product database. `schoolId` is **metadata, not a security control**. | ✅ Decided | `AGENTS.md` §2.1 |
| **D3** | Governed by `ADR-003`. **Caveat:** `ADR-003` did not exist as a file until 2026-09-28 and was reconstructed from `AGENTS.md`. It is **not yet owner-signed**. | ⚠️ Reconstructed | `docs/adr/ADR-003-*` |
| **D4** | Licensing ships in milestone 1. | ✅ Decided | `AGENTS.md` §7 |
| **D5** | `apps/mobile` is **milestone 2**. `PLT-104`, `PLT-106` and the push half of `PLT-702` move with it. Milestone-2 MVP is a reduced vertical slice: enrolment → class assignment → attendance → fee invoice → GL posting → receipt. | ✅ Decided | `AGENTS.md` §7 |
| **D6** | Story IDs (`PLT-101`…`PLT-903`, `PLT-EPIC-01`…`09`) are the traceability backbone and are **never renumbered**. Verified: 33 stories, 199 points. | ✅ Reconciled | `EduFlow_Jira_Epics_..._v1.md` |
| **D7** | SMS provider is **deliberately undecided**; `ISmsAdapter` stays vendor-agnostic. WhatsApp targets the Vvaslution API. | ✅ Decided | `AGENTS.md` §2.2 |
| **D8** | Legacy corpus lives at `H:\AI-Dev\MyProjects\EduFlowV3\EduFlowV3\eduflow\`. **Note:** `AGENTS.md` §1 states the path as `EduFlowV3\`, which is one level too shallow — the application is three levels down. | ⚠️ `AGENTS.md` needs correction | Verified 2026-09-28 |
| **D9** | `AGENTS.md` §2.8's claim that the frontend template contains "a complete `en`/`ta`/`si`/`ar` dictionary" is **inaccurate** — 21 marketing keys exist, zero application keys. The template is a **token and RTL-pattern donor**. | ⚠️ `AGENTS.md` needs correction | `docs/design/FRONTEND_TEMPLATE.md` |
| **D10** | The legacy raw-SQL figure in `AGENTS.md` §5.2 ("9 sites") is **wrong**; 149 call sites were measured on 2026-09-28. The measurement method must be recorded before the figure is trusted. | ⚠️ `AGENTS.md` needs correction | `docs/analysis/LEGACY_REUSE_INVENTORY.md` |
| **D11** | Nothing may be ported from the legacy app until `docs/analysis/LEGACY_REUSE_INVENTORY.md` names the file with a reason (`AGENTS.md` §5.2). That inventory is now written but **per-file judgements are still pending**. | ✅ Rule in force | `AGENTS.md` §5.2 |
| **D12** | **No application code was written during the 2026-09-28 analysis pass.** | The Iron Law (`NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST`) requires a runner, coverage and git. None existed. Removing the blocker beats bypassing the method. | `WORKLOG.md` D12 |
| **D13** | **`docs/idea-bank/` was created empty by design.** Five loud stubs + a README, no data rows. | A fabricated business rule is indistinguishable from a real one once written down, and every downstream story would trust it. A missing rule is visible; an invented one is not. | `WORKLOG.md` D13 |
| **D14** | **`AGENTS.md` corrections are applied only with owner approval.** | It is the governing contract; editing it is the owner's call, not an agent's. | `WORKLOG.md` D14 |
| **D15** | **Single PostgreSQL database and one deployment per school** (one database per school, physical isolation). | 2026-09-28. | Owner decision |
| **D16** | **The live `thk_live_` token in `.claude/settings.json` is an accepted risk, not a blocker.** Rotation deferred. | 2026-09-28. The token was never committed — `.claude/` was gitignored before `git init` and the first-commit staging gate verified its absence. The remote is **private** with the owner as sole holder, so residual exposure is local-disk only. Revisit if the repo goes public, a second person gains access, or the folder is shared or archived. | Owner decision — supersedes the earlier P0 framing in `GAP_ANALYSIS` §4 |
| **D17** | **The Agentic Prompt Pack's P0–P14 sequence supersedes the earlier 5-sprint map.** | Added 2026-09-28. It is more granular, encodes four pull-forwards and two interim-adapter patterns, and was authored against the full corpus. | Prompt Pack §5 |
| **D18** | **Audit durability: sensitive-action audit rows are written in the same DB transaction as the business change.** | 2026-09-28. Overrides the Jira `PLT-402` text ("asynchronously, via queue") — a queue failure that loses the audit row defeats the purpose of an audit trail. Queueing remains for non-critical, high-volume events. To be recorded formally in an ADR. | Prompt Pack D-G |
| **D19** | **`.claude/` is gitignored in full** rather than committed as a sanitised template. | It is machine-specific model routing plus a credential — local machine configuration, not project configuration. | Owner decision 2026-09-28 |
| **D20** | **The remote's GitHub-default `.gitignore` was replaced** with the repository's own. | The default is Next.js-oriented and did not exclude `.claude/`. Replaced in `f7257cf` as a fast-forward, so the remote's `0bedbe30` is preserved. | Owner decision 2026-09-28 |
| **D21** | **GitHub push protection could not be enabled** (HTTP 422). | `security_and_analysis` requires GitHub Advanced Security, which is paid-only for private repositories. Reported, not worked around. The compensating control is the `gitleaks` job in Prompt Pack P3.6. | 2026-09-28 |
| **D22** | **The ERD is deferred by owner decision.** `apps/api/prisma/schema.prisma` ships **empty** with a comment explaining why. | 2026-09-29. A plausible-but-invented schema is worse than none: entity shapes are the thing `AGENTS.md` §6 warns causes drift, and a guessed `Student`/`Class` would have to be reconciled against the real ERD later. Prisma base migration remains a **P4** deliverable, so P2 was never blocked by it. |
| **D23** | **Docker is optional; the API has an explicit `persistence: 'disabled'` boot state** (`ADR-019`). | 2026-09-29, owner: *"no docker installed on my windows PC, we should be able to run the project by `npm run dev`"*. A third state — not a default, not a failure — so `AGENTS.md` §11 ("no silent defaults") is **satisfied rather than relaxed**. `DATABASE_URL` becomes **required at P4**, where the branch is deleted. |
| **D24** | **Tailwind v4, Node ≥ 22, Prisma, NestJS/Next.js latest stable.** *(The original also said "Jest"; superseded by D27.)* | 2026-09-29, owner accepted the recommended defaults. Tailwind v4 because migrating off it later is the painful direction. Node floor pinned **below** the local 26 so CI and laptops agree, and because `argon2` (ADR-007) is a native module most likely to fail on a bleeding-edge Node. |
| **D25** | **`eslint-config-next` is not used.** | It patches ESLint internals and fails against ESLint 9.39 ("calling module was not recognized"). The two rules that matter for `AGENTS.md` §3.2 are implemented directly and verified to fire. React-hooks rules return in **P3** when there are hooks to check. |
| **D26** | **The token test asserts only what `AGENTS.md` §3.2.5 actually specifies.** | An early version required every token to be overridden in dark mode. `AGENTS.md` mandates **five** surface overrides and leaves the five brand tokens theme-independent. Asserting the stricter rule meant the only way to satisfy it was to change the design tokens — a test that can only be passed by editing the thing it is supposed to protect. |

### Added 2026-09-29 — the post-scaffold audit

Six conflicts were put to the owner; all six answered with the agent's recommended option. **These are agent recommendations ratified by the owner in one conversation, not independently-weighed owner decisions. All are flagged for later review** — see `WORKLOG.md` 2026-09-29.

| ID | Decision | Rationale |
|---|---|---|
| **D27** | **The test runner is Vitest, not Jest.** `ADR-020`. | The repository already ships Vitest: 51 passing tests, three `vitest.config.ts` files, coverage tiers already written in Vitest's own syntax and matching `AGENTS.md` §4 exactly. Five documents said Jest. Amending the documents costs nothing; migrating the repository would be pure cost. **The `AGENTS.md` §3.1 amendment is BLOCKED** — §3.1 is inside §3, which this session is directed not to touch. See ⚑A |
| **D28** | **`AGENTS.md` §6's five invented corpus figures are deleted, not replaced.** | §6 claimed 139 modules / 257 rules / 35 entities / 73 FRs. All five `idea-bank` files are zero-row stubs totalling 16 KB — physically incapable of holding that content. Independently enumerating `SRS` §3 yields **87** FRs, not 73 (the 9 NFR figure is correct). Substituting 87 without performing the extraction would be a *second* invention — the exact failure `docs/idea-bank/README.md` exists to prevent. The figures are removed and the stubs are described as empty |
| **D29** | **`next-intl` is ratified as the web i18n library.** `ADR-021`. | `AGENTS.md:214` says *"confirm before adding"* and named `next-intl` first. It was added without a recorded confirmation — a procedural defect, not a technical one. Swapping to `react-i18next` would discard a working, parity-tested setup to correct a filing omission |
| **D30** | **The broken gates are fixed now, not folded into P3.** | `AGENTS.md §4` says no production code merges without all gates green. FIX-01 and FIX-04 are a `package.json` line and a spec file. Leaving them red means every future CI run inherits a red baseline and learns to ignore it |
| **D31** | **`proxy.ts` is renamed to `middleware.ts` on Next 15.** Not upgraded to 16. | Next 15.5.26 is the installed, tested version, and `next/dist/lib/constants.js:265` defines `MIDDLEWARE_FILENAME = 'middleware'`. A framework major upgrade deserves its own decision and its own verification. The rename is one file |
| **D32** | **The `ADR-019` third state stays. The `??` default in `main.ts` goes.** | `persistence: 'disabled'` is a *third state* — not a default, not a failure — so `AGENTS.md` §11 is satisfied, not relaxed. But `main.ts:23`'s `?? 'http://localhost:3000'` is an **unargued silent default** with no such justification. Different thing, so it gets a different answer |

### Planning-horizon precedence (resolves Contradiction C-07)

| Question | Authoritative source |
|---|---|
| **Execution order, first milestone** | **`EduFlow_Agentic_Prompt_Pack_PlatformCore_v1.md` §5 — the P0–P14 sequence. Supersedes any sprint map** (D17) |
| **Dates, durations, team composition** | SRS v1.2 Part E (§21–23) |
| **Build sequence rationale** | Master Plan v5.2 §28 |
| **Story-level detail and acceptance criteria** | `EduFlow_Jira_Epics_PlatformCore_RBAC_v1.md` |
| **Deviations from the Jira order** | `docs/adr/ADR-017-deviations-from-jira-sprint-order.md` |
| **Delivery process and gates G0–G9** | `EduFlow_School_Setup_Workflow_v1.md` |
| **Engineering contract and per-ADR detail** | `docs/core/ARCHITECTURE.md` · `docs/adr/` |
| **Repository name** | `EduFlow` (not `sms-platform`; SRS §15 is wrong) |

### Naming legend — "M2" is ambiguous, so qualify it

**Three documents use "M2" for two different things.** This is the fix; apply it everywhere.

| Write this | Means | Source |
|---|---|---|
| **Milestone 1** / **Milestone 2** | The *product* milestones. Milestone 2 is the **mobile** milestone | `AGENTS.md` §7 (D5), `ADR-005` |
| **Gate M1** … **Gate M6** | The *sign-off gates*. "Gate M2 — Foundation Complete" is one of them | `SRS` §24 |

In the Prompt Pack §7 story table, the `M1`/`M2` column means **milestone** — so `PLT-104` marked `M2` is *milestone* 2 (mobile), **not** Gate M2. **Never write a bare "M2".**

*Resolves conflict C3, found when the Agentic Prompt Pack was reconciled with the sprint map on 2026-09-28.*

---

## 5. Blocking Status

> **Updated 2026-09-28, after `git init` and the first push.** GAP-01 and GAP-02 are now closed or accepted. Read §5.1 as the *current* state, not the pre-initialisation state.

### 5.1 S1 — the top severity tier

**GAP-02 is closed** and **GAP-01 is an accepted risk** (D24). Three remain genuinely open.

| ID | Blocker | Owner action | State |
|---|---|---|---|
| **GAP-01** | Live `thk_live_` credential in `.claude/settings.json`; third-party `ANTHROPIC_BASE_URL` | Rotate at the issuer | ⚠️ **Accepted risk (D16).** Never committed — `.claude/` gitignored before `git init`, verified absent from the first commit. Remote is **private**, owner is sole holder. Revisit if the repo goes public, a second person gets access, or the folder is shared. |
| **GAP-02** | Not a git repository | — | ✅ **Closed 2026-09-28.** `main` → `siraj-77/EduFlow` (private), 4 commits, working tree clean. |
| **GAP-03** | No toolchain, therefore no test runner | — | ✅ **Closed 2026-09-29.** pnpm + Turborepo + TS strict + ESLint + Vitest + Playwright. 51 tests green. `GAP-09` (no CI) remains open. |
| **GAP-04** | `docs/idea-bank/` has no content | — | 🔴 **Open.** README + 5 loud stubs exist; the **extraction** (`REQ-01…05`) has not been performed. Highest-leverage work available. |
| **GAP-05** | No ERD / data model | — | 🔴 **Open, deferred by owner (D22). Longest pole.** `schema.prisma` is deliberately empty. Blocks `PLT-EPIC-01` and the SRS Phase 0 exit gate |
| **GAP-09** | No CI, no environments | — | 🔴 **Open. The top engineering priority** — Prompt Pack P3. Branch protection also unavailable (paid plan) |

**Added 2026-09-29 — the EPIC-00 blockers.** Not in the original `GAP_ANALYSIS` register, because that analysis predated the scaffold. Full evidence in `docs/analysis/CODE_AUDIT_2026-09-29.md`.

| ID | Blocker | State |
|---|---|---|
| **FIX-01** | ~~`test:coverage` cannot run~~ | ✅ **Closed 2026-09-29.** `@vitest/coverage-v8@2.1.9` declared in all 5 test-bearing packages; `pnpm test:coverage` exits 0 and was proved able to exit 1. ⚠️ but the tiers match 0 instrumented files → FIX-26 |
| **FIX-02** | `test:e2e` fails — empty `testDir` | 🔴 Open |
| **FIX-03** | `docker-compose.yml` is invalid YAML — line 1 is a `/**` comment | 🔴 Open. The `AGENTS.md` §14 command cannot run |
| **FIX-04** | `proxy.ts` is dead code on Next 15 — zero middleware compiled, no locale negotiation | 🔴 Open |
| **FIX-11** | shadcn/ui never initialised, yet raw elements are banned | 🔴 Open. **Blocks the first interactive screen** |
| **FIX-12** | No CI, no pre-commit hook | 🔴 Open — same defect as GAP-09 |
| **FIX-13** | `check-route-guards` does not exist | 🔴 Open. §2.3 is prose only |

### 5.2 Known-unresolved requirement gaps (`AGENTS.md` §6.1)

These domains **cannot be built** until designed. They are recorded here so they are not forgotten.

| Gap | Blocks | Ticket |
|---|---|---|
| Attendance — no design at all | Attendance module | `PC-000` |
| Leave / Workforce — no design at all | Workforce, leave accrual | `PC-001` |
| Grading & Moderation — P0, zero rules | Exams, report cards, promotion, analytics | `PC-002` |
| Tax & currency — never mentioned, despite invoicing | Fees, payroll, procurement | `PC-003` |
| Admission — in MVP list, no FR behind it | MVP scope | `PC-004` |
| BookShop / Canteen / School Hall — in Master Plan v5.2 §17.6–17.9 (newer than the idea-bank extraction); needs FR/rule/entity extraction and settlement design | Retail, hall rental | `PC-005` *(proposed)* |
| Student Wallet — stored-value legal review and GL design | Wallet | `PC-006` *(proposed)* |

`PC-005` and `PC-006` are **proposed and not ticketed**. An unticketed deferral is how they got here. `REQ-07` requires each gap to be either designed or formally deferred with a named owner and target milestone.

---

## 6. Why `docs/idea-bank/` Has a README But No Content

**Measured 2026-09-29** (`docs/analysis/CODE_AUDIT_2026-09-29.md` DOC-01). All five files are 43–62 lines of header, column schema, acceptance criteria and trap list, totalling **16,124 bytes**, each declaring `**Status:** Placeholder. Zero …rows.`

**`AGENTS.md` §6 tabulated five figures for this directory that no document in the repository supports:**

| `AGENTS.md §6` claimed | Actually in the file |
|---|---|
| 139 modules across 20 domains | **0** |
| 257 business rules | **0** |
| 35 domain entities | **0** |
| 15 risks, 40 boundary tests, 41 failure modes | **0 / 0 / 0** |
| 73 FRs + 9 NFRs | **0** FRs. The **9 NFR figure is correct** — `SRS §5` has `NFR-01`…`NFR-09` |

Independently enumerating `SRS §3` yields **87 unique FR IDs**, not 73. The false numbers propagated to `GAP_ANALYSIS:285` and `WORKLOG.md:308`.

**Why this was dangerous rather than merely untidy:** the stub files are honest and loud — line 3 of `fr-index.md` reads `> 🔴 **NOT YET EXTRACTED.**` and `docs/idea-bank/README.md` reads `**Status:** 🔴 **STUBS ONLY. The extraction has not been performed.**` But `AGENTS.md` is read first, in full, and instructed the reader to treat the directory as *"the authoritative requirements"*. An agent that trusted §6, grepped `business-rules.md` for a lockout threshold, got nothing, and had no signal that the file was a stub. **D28 removes the figures.** They are deleted rather than replaced, because substituting a different unverified number would be a second invention.

The directory was created empty by design. A fabricated business rule — a plausible attendance threshold, a leave accrual formula, a fee schedule — would be indistinguishable from a real one once written down, and would be trusted by every downstream story. **A missing rule is visible; an invented one is not.** The extraction is tracked as `REQ-01`…`REQ-05`, and `docs/archive/corpus/` — the cited source — does not exist (⚑2).

---

## 7. Open Questions — Awaiting Owner Decision

| # | Question | Blocks |
|---|---|---|
| 1 | Was `docs/archive/corpus/` deliberately deleted, or never migrated? | `REQ-01…05` reliability |
| 2 | Is the third-party `ANTHROPIC_BASE_URL` intentional? | `REPO-01` |
| 3 | Approve the 3-corrected-`AGENTS.md` items: D8 legacy path, D9 i18n claim, D10 raw-SQL count | `AGENTS.md` accuracy |
| 4 | Confirm the planning-horizon precedence table in §4 | Scheduling |
| 5 | Required report-card layouts for the initial customer set | Master Plan §30 flags this as needed **before Phase 5**; drives the Document/Print Engine abstraction |
| 6 | Font stack for Tamil / Sinhala / Arabic, on screen and in PDF | `DSN-04`; `AGENTS.md` §3.2.7 requires owner confirmation |
| 7 | Activation server: in scope for this repo, or a separate service? Where do the licence keypairs live? | `PLT-301`, `PLT-303` — **answered by `ADR-010`: external vendor service** |
| 8 | Design `PC-000`…`PC-006` now, or formally defer with owners and milestones? | `REQ-07` |
| **9** | ⚑**A** — **Approve a one-line change to `AGENTS.md` §3.1** (`Jest` → `Vitest`). D27 decided the runner; the contract still says otherwise. §3.1 is inside §3, which this session is directed not to touch | **The contract contradicts the code** |
| **10** | ⚑**B** — **Approve the `AGENTS.md:8,17` status correction.** Both lines still say *"pre-scaffold / no application code exists yet"*. They sit in the preamble and §1, **not** §2/§3/§13, so this is D14 rather than the standing restriction | An agent reads a false state before opening a file |
| **11** | ⚑**C** — **`SRS` §19 vs `AGENTS.md` §7 on mobile.** `SRS` puts a Parent mobile portal in the MVP; `AGENTS.md` (D5) and `ADR-005` make mobile milestone 2; Master Plan §24 carries a full mobile architecture. Three documents, two positions | MVP scope · **Recommended: option C**, parent read-only web portal |
| **12** | ⚑**D** — **`SRS` §24 Gate M2 vs the P0–P14 order.** Gate M2 requires license enforcement at end of Phase 1; P8 sits after P4/P4W/P5/P6/P7. The reorder relabels "Foundation Complete" — it does not move the gate. `SRS §24` was never amended | Phase 0 exit |
| **13** | ⚑**E** — **Approve `PLT-107`** (first-admin bootstrap). Workflow §6.5 requires it; **no existing story covers it**, so a fresh deployment cannot create its first administrator | Epic 01 |
| **14** | ⚑**F** — **Node floor.** `.nvmrc` says 22; the local runtime is 26.7.0 | CI reproducibility |
| **15** | ⚑**G** — **`Money` wire format.** `ADR-002:48` says the serialisation boundary *"must be designed in `ARC-06`, not discovered later"*, yet `Money{amountMinor: bigint}` already ships in `packages/shared-types` with a passing test. Proposed as `ADR-024` | `ARC-06`, `PLT-301` |

---

## 8. The Most Important Facts

**Re-ordered 2026-09-29.** The previous list led with CI while the repository reported three of its seven gates green. The first fact is now the false reporting itself.

1. **Two of the seven `AGENTS.md` §4 gates still fail, and the record had said they were green.** `pnpm test:e2e` exits 1 with no tests (FIX-02) and `pnpm format:check` exits 2 on 60 files (FIX-05). `WORKLOG.md` read *"✅ Complete. All gates green"* and its table listed only **six** of seven — omitting precisely the ones that fail. `test:coverage` was a third and is now fixed (FIX-01), though the tiers still enforce nothing (FIX-26). **EPIC-00, ~19 points remaining.**
2. **Every gate is enforced only for the developer who runs it.** No `.github/`, no `.husky/`, and `check-route-guards` does not exist — so `AGENTS.md` §2.3's *"CI must fail on a missing `@RequirePermission`"* is prose. Per `ARCHITECTURE.md:307`, a rule that is not mechanically enforced is a suggestion. **Prompt Pack P3 is the single highest-value engineering step**, and FIX-11 must land before its human gate.
3. **The two highest-authority documents were both false, in the same direction.** `AGENTS.md` §6 tabulated five invented corpus figures over five zero-row stubs, and `AGENTS.md:8,17` declared a scaffolded repository to be un-scaffolded. Every session opens by reading documents that misdescribe the project. D28 removes the figures; the status lines are **blocked pending ⚑B**.
4. **The ERD does not exist** (deferred, D22). It is `PLT-EPIC-01`'s Definition of Ready and the SRS Phase 0 exit gate. It needs no code and no Docker — but until it exists, no Platform Core story can start, and it is the longest pole in the plan.
5. **The requirements layer does not exist.** Five loud stubs, zero data rows. Every story author is reconstructing requirements from ~3,000 lines of prose, and the Prompt Pack greps those files before *every* story. `REQ-01…05` is the highest-leverage pure-documentation work available.

### Deferred, not forgotten

The live `thk_live_` token in `.claude/settings.json` was **accepted as a risk on 2026-09-28 (D16)** rather than rotated. It was never committed — `.claude/` was gitignored *before* `git init`, and the first-commit staging gate verified the token value was absent. The remote is private with the owner as sole holder. **Revisit if the repo goes public, a second person gains access, or the folder is shared or archived.**

### Known footguns in the current scaffold

Recorded so they are not reintroduced:

| Footgun | Why it matters |
|---|---|
| **`/**` is not a YAML comment** | `infra/docker/docker-compose.yml` opens with one, so the file **does not parse** and the `AGENTS.md` §14 command cannot run. `WORKLOG.md` records that the same `/**` shape *did* land in a `package.json` string, where it is merely mojibake. The failure is silent in both cases — nothing type-checks a YAML comment (FIX-03, FIX-17) |
| **`proxy.ts` compiles to nothing on Next 15** | `next-intl`'s plugin wrapper looks like a middleware entry and passes every gate, but `MIDDLEWARE_FILENAME = 'middleware'`, so **zero middleware is emitted**. Only the build manifest reveals it (FIX-04) |
| A gate marked `[x]` on the strength of a **config file existing** | Five defects survived review this way. The gate table in `WORKLOG.md:32-39` listed 6 of 7 and omitted the two failing ones. **Verify by running the command, never by reading the config** (FIX-01, FIX-02) |
| `incremental: true` + a `--noEmit` typecheck run | Writes a `.tsbuildinfo`, so a later real build concludes nothing changed and **emits nothing while exiting 0**. Fixed via `tsBuildInfoFile`; `typecheck` also passes `--incremental false` |
| A `*/` sequence inside a JSDoc block comment | `**/domain/**` closes the comment early and the remainder is parsed as code. The layer globs are in `//` comments for this reason |
| PowerShell `Set-Content -Encoding UTF8` | Writes a **BOM**, which breaks JSON parsing in Vite/PostCSS. Every file touched that way was stripped |
| pnpm's isolated `node_modules` | A shared config package must declare what its config **imports**; consumers do not leak. `@eduflow/config` declares `@eslint/js` for this reason |
| `turbo.json` `globalDependencies` naming a file that is not at the root | `tsconfig.base.json` lives in `packages/config/`, and `.env` is gitignored. Turbo never invalidates, so a stale typecheck result can be replayed (FIX-06) |

---

*Companion documents: `ARCHITECTURE.md` (how it is architected) · `docs/analysis/CODE_AUDIT_2026-09-29.md` (32 findings, evidence) · `docs/work/REMEDIATION_PLAN_2026-09-29.md` (the action plan) · `docs/work/GAP_ANALYSIS_2026-09-28.md` (pre-scaffold baseline) · `docs/work/PLATFORM_CORE_PLAN.md` (milestone-1 execution) · `docs/work/TODO.md` (next task) · `docs/work/WORKLOG.md` (activity log).*
