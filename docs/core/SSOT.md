# SSOT — Single Source of Truth

**Purpose:** The answer to "what is the current state of this project?"
**Last updated:** 2026-09-28
**Precedence:** `AGENTS.md` and `ADR-003` > this file > all other documents. This file records *state and decisions*. It does not restate the rules — see `ARCHITECTURE.md` for those.

---

## 1. Current State — 2026-09-28

| | |
|---|---|
| **Phase** | Pre-scaffold. SRS Part E **Phase 0**, but **P2 (Prompt Pack scaffold) is complete.** |
| **Application code** | **Scaffold only.** Infrastructure, no business logic. 6 workspace packages, 51 passing tests. |
| **Toolchain** | ✅ **Working.** pnpm 11 workspace + Turborepo, TS strict, ESLint 9 flat config, Prettier, Jest/Vitest, Playwright configured. |
| **Version control** | ✅ **Git, on `main`, pushed to the private remote `siraj-77/EduFlow`.** Working tree clean. |
| **Repository contents** | `AGENTS.md` · `CLAUDE.md` · `README.md` · `apps/{api,web}` · `packages/{config,shared-types,ui-kit,i18n-resources}` · `infra/docker` · `docs` · `scripts` |
| **Quality gates** | ✅ **All green locally**: typecheck · lint · test (51) · build · docs:verify · test:integration. ❌ **Not yet in CI** — P3. |
| **CI** | ❌ **None yet.** Branch protection also unavailable (needs a paid plan for private repos). |
| **ERD** | ❌ **Not written** — owner deferred. `apps/api/prisma/schema.prisma` is deliberately empty. |
| **Phase 0 exit criteria** | SRS ✅ · MVP scope ✅ · **ERD ❌** — so Phase 0 has **not** exited. |
| **Stories completed** | 0 of 33 Platform Core stories. The P0–P2 prompts are infrastructure, not stories. |

**Do not describe this project as "in development".** The correct description is *"scaffolded and gate-enforced; no feature code yet"*.

---

## 1a. Verified working (2026-09-29)

These were observed, not assumed:

| Check | Result |
|---|---|
| `pnpm typecheck` | ✅ 8/8 tasks, 6 packages |
| `pnpm lint` | ✅ 8/8 tasks, 0 errors |
| `pnpm test` | ✅ **51 tests passing** — shared-types 3 · i18n-resources 10 · ui-kit 8 · api 26 · web 4 |
| `pnpm build` | ✅ web prerenders **/en /ta /si /ar** as static HTML |
| `pnpm test:integration` | ✅ runnable, empty by design until P4 |
| `pnpm docs:verify` | ✅ **147 references across 8 documents resolve** |
| API boots with **no `.env`** | ✅ prints `PERSISTENCE DISABLED` banner, starts, listens on 3001 |
| Web serves all four locales | ✅ `/en` `dir=ltr` · `/ar` **`dir=rtl`** · `/ta` `dir=ltr` · `/si` `dir=ltr`, all HTTP 200, `data-theme` present |
| Docker | ❌ **Not installed** — by owner decision, `ADR-019` |

**Enforced rules, each with a test that watches it fire:**

| Rule | Mechanism |
|---|---|
| `domain/` + `use-cases/` import no framework, ORM, queue or vendor SDK | ESLint `no-restricted-imports` |
| `domain/` + `use-cases/` call no `Date.now()` / `new Date()` / `Math.random()` | ESLint `no-restricted-syntax` |
| No `@ts-ignore`, `@ts-expect-error`, bare `any`, empty `catch` | ESLint |
| No raw `<button>` `<input>` `<select>` `<textarea>` `<table>` `<dialog>` | ESLint |
| No hard-coded colour in a component | ESLint |
| All four locales have identical key sets | vitest |
| Every token defined in light **and** dark | vitest |
| Environment validated; every invalid variable named at once | vitest |

---


---

## 2. What Exists

| Path | Size | State |
|---|---|---|
| `AGENTS.md` | 35.5 KB | Governing contract. ~21 dangling cross-references — see Gap Analysis §3.3 |
| `docs/core/EduFlow_Project_Master_Plan_v5.2.md` | 79.4 KB | Complete. Most detailed artefact in the repo |
| `docs/core/EduFlow_SRS_TestPlan_MVP_Roadmap_v1.2.md` | 39.5 KB | Complete. Parts A–E |
| `docs/core/EduFlow_Jira_Epics_PlatformCore_RBAC_v1.md` | 35.0 KB | Complete. 9 epics / 33 stories / 199 pts |
| `docs/core/EduFlow_School_Setup_Workflow_v1.md` | 80.3 KB | Complete but **orphaned** — not referenced by `AGENTS.md` |
| `docs/core/ARCHITECTURE.md` | — | **Written 2026-09-28** (was 0 bytes) |
| `docs/core/SSOT.md` | — | This file (was 0 bytes) |
| `docs/template/EduFlow — Frontend Template.html` | 34.4 KB | Token + RTL-pattern donor only. See `docs/design/FRONTEND_TEMPLATE.md` |
| `docs/work/PLATFORM_CORE_PLAN.md` | — | **Written 2026-09-28** (was missing) |
| `docs/adr/`, `docs/analysis/`, `docs/design/`, `docs/idea-bank/README.md` | — | **Created 2026-09-28** |

---

## 3. What Does Not Exist

Nothing has been built. The following are **specified but absent**, and are the subject of the action plan in `docs/work/GAP_ANALYSIS_2026-09-28.md`:

- All source: `apps/api`, `apps/web`, `packages/*`
- All infrastructure: `infra/docker`, `infra/ci`, `infra/terraform`
- All process: `directives/`
- All tooling: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json`, `.env.example`, `README.md`
- The **ERD / data model** — the single largest missing engineering artefact
- `docs/idea-bank/*` (the "authoritative requirements" layer `AGENTS.md` §6 depends on) — directory now created with a README defining the extraction; **contents not written, by design** (see §6)
- `docs/archive/corpus/` — status unknown, see Open Questions

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
| **D24** | **Tailwind v4, Jest, Node ≥ 22, Prisma, NestJS/Next.js latest stable.** | 2026-09-29, owner accepted the recommended defaults. Tailwind v4 because migrating off it later is the painful direction. Node floor pinned **below** the local 26 so CI and laptops agree, and because `argon2` (ADR-007) is a native module most likely to fail on a bleeding-edge Node. |
| **D25** | **`eslint-config-next` is not used.** | It patches ESLint internals and fails against ESLint 9.39 ("calling module was not recognized"). The two rules that matter for `AGENTS.md` §3.2 are implemented directly and verified to fire. React-hooks rules return in **P3** when there are hooks to check. |
| **D26** | **The token test asserts only what `AGENTS.md` §3.2.5 actually specifies.** | An early version required every token to be overridden in dark mode. `AGENTS.md` mandates **five** surface overrides and leaves the five brand tokens theme-independent. Asserting the stricter rule meant the only way to satisfy it was to change the design tokens — a test that can only be passed by editing the thing it is supposed to protect. |

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
| **GAP-05** | No ERD / data model | — | 🔴 **Open, deferred by owner (D22).** `schema.prisma` is deliberately empty. Blocks `PLT-EPIC-01` and the SRS Phase 0 exit gate. |
| **GAP-09** | No CI, no environments | — | 🔴 **Open. Now the top engineering priority** — Prompt Pack P3. Branch protection also unavailable (paid plan). |
| **GAP-05** | No ERD | **Longest pole.** Blocks `PLT-EPIC-01` and SRS Phase 0 exit |

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

`AGENTS.md` §6 calls `docs/idea-bank/` "the authoritative requirements" and instructs reading the relevant section before implementing any module. The directory did not exist.

It has been created with a README that **specifies the extraction** but does not contain it, deliberately. A fabricated business rule — a plausible attendance threshold, a leave accrual formula, a fee schedule — would be indistinguishable from a real one once written down, and would be trusted by every downstream story. A missing rule is visible; an invented one is not. The extraction is tracked as `REQ-01`…`REQ-05`.

**Open dependency:** the extraction needs a verifiable source. `AGENTS.md` §12 points at `docs/archive/corpus/`, which does not exist. Until that is resolved, the extraction is prose-summarisation of Master Plan + SRS rather than extraction from a source corpus — which is workable but weaker. See Open Questions.

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
| 7 | Activation server: in scope for this repo, or a separate service? Where do the licence keypairs live? | `PLT-301`, `PLT-303` |
| 8 | Design `PC-000`…`PC-006` now, or formally defer with owners and milestones? | `REQ-07` |

---

## 8. The Three Most Important Facts

1. **CI does not exist yet, so the gates are green only on this machine.** `pnpm typecheck`, `lint`, `test`, `build` and `docs:verify` all pass locally, but nothing enforces them for anyone else. **Prompt Pack P3 is the single highest-value remaining step** — it is what turns `AGENTS.md` from prose into something that fails a build. Its human gate is the best one in the whole sequence: a dummy PR containing an unguarded route, a `new Date()` in a use-case, a raw `<button>` and a missing i18n key, each of which must fail CI and then pass.
2. **The ERD does not exist** (deferred, D22). It is `PLT-EPIC-01`'s Definition of Ready and the SRS Phase 0 exit gate. It needs no code and no Docker, so it can be written whenever — but until it exists, no Platform Core story can start.
3. **The requirements layer does not exist.** `docs/idea-bank/` has five loud stubs and zero data rows. Every story author is reconstructing requirements from ~3,000 lines of prose, and the Prompt Pack greps those files before *every* story. `REQ-01…05` is the highest-leverage work available and is pure documentation.

### Deferred, not forgotten

The live `thk_live_` token in `.claude/settings.json` was **accepted as a risk on 2026-09-28 (D16)** rather than rotated. It was never committed — `.claude/` was gitignored *before* `git init`, and the first-commit staging gate verified the token value was absent. The remote is private with the owner as sole holder. **Revisit if the repo goes public, a second person gains access, or the folder is shared or archived.**

### Known footguns in the current scaffold

Recorded so they are not reintroduced:

| Footgun | Why it matters |
|---|---|
| `incremental: true` + a `--noEmit` typecheck run | Writes a `.tsbuildinfo`, so a later real build concludes nothing changed and **emits nothing while exiting 0**. Fixed via `tsBuildInfoFile`; `typecheck` also passes `--incremental false` |
| A `*/` sequence inside a JSDoc block comment | `**/domain/**` closes the comment early and the remainder is parsed as code. The layer globs are in `//` comments for this reason |
| PowerShell `Set-Content -Encoding UTF8` | Writes a **BOM**, which breaks JSON parsing in Vite/PostCSS. Every file touched that way was stripped |
| pnpm's isolated `node_modules` | A shared config package must declare what its config **imports**; consumers do not leak. `@eduflow/config` declares `@eslint/js` for this reason |

---

*Companion documents: `ARCHITECTURE.md` (how it is architected) · `docs/work/GAP_ANALYSIS_2026-09-28.md` (full analysis + action plan) · `docs/work/PLATFORM_CORE_PLAN.md` (milestone-1 execution) · `docs/work/TODO.md` (next task) · `docs/work/WORKLOG.md` (activity log).*
