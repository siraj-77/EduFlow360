# EduFlow — Repository & Documentation Gap Analysis + Master Action Plan

**Date:** 2026-09-28
**Author:** opencode (analysis pass)
**Scope:** `H:\AI-Dev\MyProjects\EduFlow` (current repo) and `H:\AI-Dev\MyProjects\EduFlowV3` (legacy, read-only reference)
**Method:** Full recursive file inventory; line-level read of every document in `docs/core/`; measurement of the legacy corpus (models, raw-SQL sites, test count); verification of every cross-reference asserted in `AGENTS.md` against the filesystem.
**Status:** Pre-scaffold. **Zero application code exists.** This document is the gate between "excellent planning" and "no product".

> ## 📸 This is a point-in-time snapshot
>
> It describes the repository as it stood **before** the Git bootstrap. Several statements are now historical. They are **left unrewritten on purpose** — a dated analysis is evidence of what was true when it was made, and editing it retroactively destroys that.
>
> **Changed since (all 2026-09-28):**
>
> | Was | Now |
> |---|---|
> | "Not a git repository" (§2.3) | ✅ `main` → private remote `siraj-77/EduFlow`, 3 commits, working tree clean |
> | `GAP-01` live token = **S1, blocks all work** (§4) | ⚠️ **Accepted risk (D16)** — never committed, `.claude/` gitignored before `git init`; rotation deferred by owner |
> | `GAP-02` not a git repo = **S1** (§4) | ✅ **Closed** |
> | `GAP-03` no toolchain = **S1** (§4) | ✅ **Closed 2026-09-29** — pnpm + Turborepo + TS strict + ESLint + Vitest + Playwright; 51 tests green. **The #1 blocker is now `GAP-09` (no CI)** |
> | 18 documents written, 6 of them empty | ✅ All 6 filled; 23 markdown files total |
> | `docs/adr/`, `docs/analysis/`, `docs/design/` absent | ✅ Created; `docs/adr/` has ADR-001…021 |
> | `docs/idea-bank/` absent | 🟡 Directory + README + 5 stubs exist; **extraction still not done** (`GAP-04` open) |
> | `PLATFORM_CORE_PLAN.md` absent | ✅ Created, then resequenced to the Prompt Pack's P0–P14 (D17) |
> | — | 🆕 The **Agentic Prompt Pack** was added to `docs/core/` and is more granular than the sprint map in §6 |

> ### 🔴 Delta 2026-09-29 — the scaffold landed, and it is defective
>
> Commit `951acec` scaffolded the monorepo (`GAP-03` closed). A second audit on 2026-09-29 examined that scaffold and found **32 issues**, of which **7 are S1 blockers that this document does not record** — because they could not exist before the scaffold did.
>
> | Was assumed on 2026-09-28 | Measured on 2026-09-29 |
> |---|---|
> | `GAP-03` no toolchain = the **#1 blocker** | ✅ Closed. `GAP-09` (no CI) is now #1 |
> | 3 commits | **8 commits** |
> | 23 markdown files | **44 markdown files**, 262 tracked files |
> | `docs/adr/` has ADR-001…006 | **ADR-001…021** |
> | — | ❌ **`pnpm test:coverage` and `pnpm test:e2e` both fail.** `WORKLOG.md` reported all gates green; its table listed 6 of the 7 |
> | — | ❌ **`docker-compose.yml` does not parse** — line 1 is a `/** */` block comment |
> | — | ❌ **`proxy.ts` is dead code on Next 15** — the build emits zero middleware |
> | — | ❌ **shadcn/ui was never initialised**, while ESLint bans the raw elements it would supply |
> | — | ❌ **`AGENTS.md §6` published five invented corpus figures** (139 modules / 257 rules / 35 entities / 73 FRs) over five zero-row stubs totalling 16 KB |
> | — | ❌ **`AGENTS.md:8,17` still declare the repo un-scaffolded** |
>
> **⚠️ §4 `GAP-04` and §6 `GAP-05` remain open and unchanged.** So do the estimates in §0 and the sequencing in §7, except that **EPIC-00 now precedes everything** — including the `REQ` stories this document sequences first.
>
> **The 139 / 257 / 35 / 73 figures in this document are wrong and were never sourced.** See §4 `GAP-04` and `docs/analysis/CODE_AUDIT_2026-09-29.md` DOC-01. `SRS §3` actually contains **87** FRs. **Do not use them to size anything** (D28).
>
> **The action plan for all post-scaffold work is `docs/work/REMEDIATION_PLAN_2026-09-29.md`.** This document remains the record of what was true before the scaffold.

> **For current state, read `docs/core/SSOT.md`.** For the current plan, read `docs/work/REMEDIATION_PLAN_2026-09-29.md`.


> **Read this first:** `AGENTS.md` §1 already declares the repo pre-scaffold. This analysis confirms it and quantifies the delta. It also found **one live credential committed to disk** and **~30 broken document cross-references in `AGENTS.md`**. Both are tracked in §4.

---

## 0. Executive Summary

| Dimension | State | Verdict |
|---|---|---|
| Application code | **0 files** | 🔴 Not started |
| Monorepo / toolchain | **0 files** — no `package.json`, no `pnpm-workspace.yaml`, no `turbo.json`, no `tsconfig.json`, no ESLint/Prettier | 🔴 Not started |
| Version control | **Not a git repository** | 🔴 Critical — `AGENTS.md` §4.3/§9 assume git for checkpoints, TDD evidence and worklog discipline |
| Planning documents | 5 substantive (≈270 KB) | 🟢 Strong |
| Referenced-but-missing documents | **~30 files across 6 directories** | 🔴 `AGENTS.md` points at files that do not exist |
| Empty documents (0 bytes) | 6 — `SSOT.md`, `ARCHITECTURE.md`, `TODO.md`, `WORKLOG.md`, `BACKLOG.md`, `CHANGELOG.md` | 🔴 The governance layer is unwritten |
| CI / environments | **None** | 🔴 All §4 quality gates are unrunnable |
| Secrets hygiene | **1 live token in `.claude/settings.json`** | 🔴 Rotate now |
| Legacy reference corpus | 630 TS files, 59 Prisma models, 897 test files | 🟢 Available; reuse inventory never written |

**Bottom line:** The *thinking* is done and unusually good. The *engineering* has not started. Roughly **95% of the effort required to reach a shippable foundation is unstarted**, and the highest-leverage work is not writing feature code — it is establishing the repository, the toolchain, the missing requirement extractions, and the enforcement gates that make the rest of the work verifiable.

**Estimated total:** the 6 new epics in §6 (A–F) are **the entire path to "green repository"**, estimated **~172 points / 6–9 calendar weeks** with a 3-person team, sequenced in §7. The pre-existing `PLT-EPIC-01..09` (199 points) cannot start until **EPIC-B** (scaffold) and **EPIC-C** (architecture contracts) are done.

---

## 1. Project Status

### 1.1 What actually exists

| Path | Size | Assessment |
|---|---|---|
| `AGENTS.md` | 35.5 KB | Excellent, governing contract. **But ~30 cross-references resolve to nothing.** See §3.3. |
| `.gitignore` | 1.4 KB | Good, and unusually thoughtful — it already documents *why* the root `.env.local` must not be migrated. |
| `.claude/settings.json` | 0.3 KB | 🔴 Contains a live `ANTHROPIC_AUTH_TOKEN` and a third-party `ANTHROPIC_BASE_URL`. |
| `.claude/settings.local.json` | 0.1 KB | Fine. |
| `.env.local` | 0.2 KB | Legacy `DATABASE_URL` + `NEXTAUTH_*`. Gitignored, and `.gitignore` explicitly says do not migrate. Still: a NextAuth-shaped file in a repo that mandates NestJS is a misleading artefact. |
| `docs/core/EduFlow_Project_Master_Plan_v5.2.md` | 79.4 KB | Best artefact in the repo. 30 sections, full module tree, GL design, i18n, editions matrix, risk register. **Not mentioned in `AGENTS.md` §1's planning-document list** (it is, but the 4th doc below is not). |
| `docs/core/EduFlow_SRS_TestPlan_MVP_Roadmap_v1.2.md` | 39.5 KB | Strong. Parts A–E, FRs, test strategy with coverage tiers, MVP scope + 8 acceptance criteria, 16-phase roadmap, 6 milestone gates. |
| `docs/core/EduFlow_Jira_Epics_PlatformCore_RBAC_v1.md` | 35.0 KB | 9 epics, 33 stories, acceptance criteria, dependency graph, sprint breakdown. **The traceability backbone.** |
| `docs/core/EduFlow_School_Setup_Workflow_v1.md` | 80.3 KB | 21 phases, gates G0–G9, RACI, appendices A–J. **Not referenced anywhere in `AGENTS.md`.** Doc-governance gap (§3.4). |
| `docs/template/EduFlow — Frontend Template.html` | 34.4 KB | Real but **much smaller than `AGENTS.md` §2.8 claims**. See §3.6. |

### 1.2 What does not exist

```
MISSING DIRECTORIES (all referenced by AGENTS.md)
  apps/            ← §3.1 repo structure
  packages/        ← §3.1
  infra/           ← §3.1
  directives/      ← §10 Layer-1 SOPs
  docs/idea-bank/  ← §6 "the authoritative requirements"  ← WORST GAP
  docs/analysis/   ← §5.1 reuse inventory
  docs/adr/        ← §1 "Governing ADR: ADR-003"
  docs/design/     ← §2.8 template assessment
  docs/modules/    ← §9 module working notes
  docs/archive/corpus/  ← §12

MISSING ROOT FILES
  package.json  pnpm-workspace.yaml  turbo.json  tsconfig.json
  .env.example  .editorconfig  .prettierrc  eslint.config.js
  README.md  LICENSE  .nvmrc

MISSING DOCS
  docs/core/SSOT.md            (exists, 0 bytes)   ← §12 "current state of the project"
  docs/core/ARCHITECTURE.md     (exists, 0 bytes)   ← §12 "how is it architected"
  docs/work/PLATFORM_CORE_PLAN.md  (missing)       ← §7 "Plan:" pointer target
  docs/work/WORKLOG.md          (exists, 0 bytes)   ← §9 "if work is not in the worklog..."
  docs/work/TODO.md             (exists, 0 bytes)   ← §12
  docs/work/BACKLOG.md          (exists, 0 bytes)   ← §9
  docs/work/CHANGELOG.md        (exists, 0 bytes)
  docs/adr/ADR-003-new-app-single-tenant-selective-reuse.md  ← §1 GOVERNING ADR
  docs/analysis/LEGACY_REUSE_INVENTORY.md         ← §5.1
  docs/design/FRONTEND_TEMPLATE.md                ← §2.8
  docs/idea-bank/{module-inventory,business-rules,domain-entities,
                 edge-cases-and-risks,fr-index}.md  ← §6
```

### 1.3 Reality check

Against the SRS Part E roadmap (`§21` timeline), the project is at **Phase 0, week ~1 of 2–3**, and Phase 0's exit criteria ("Stakeholder sign-off on SRS + ERD; MVP scope locked") is **partially met**: SRS exists and MVP scope is locked, but **the ERD does not exist in any form** — not as a document, not as a Prisma schema, not in the legacy corpus as a reusable artefact. Phase 0 cannot exit without it.

---

## 2. Codebase Analysis

### 2.1 Source code: none

There is no `src/`, no `apps/`, no `packages/`. `AGENTS.md` §1's statement is accurate. This is not a defect; it is the starting position. It does mean every architectural rule in `AGENTS.md` §2 is currently **unverified prose** — a rule nobody has yet tried to violate.

### 2.2 Toolchain: none

No `package.json`. Therefore **none** of these are runnable: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`, `pnpm build`, `pnpm test:integration`, `pnpm test:e2e`. `AGENTS.md` §4's seven quality gates are all currently **vacuous** — they cannot fail because they cannot run. A gate that cannot run is not a gate.

**Consequence for TDD:** the two skills loaded for this session (`test-driven-development`, `tdd-workflow`) both require a working `<test>` command, a coverage command, and git for RED/GREEN checkpoint commits. **None of the three exist.** TDD cannot begin until EPIC-B lands. This is the single hardest blocker on the whole plan.

### 2.3 Version control: absent

`git rev-parse` → `fatal: not a git repository`. No `.git` in the repo or any parent.

This breaks, concretely:
- `AGENTS.md` §4.1 "checkpoint after each TDD stage: one commit for RED, one for GREEN" — impossible.
- `tdd-workflow` Step 3/5/6 checkpoint commits — impossible.
- `tdd-workflow` Step 8 evidence report "preserve across squash merges" — impossible.
- `AGENTS.md` §9 "no direct commits to protected branches", conventional-commit traceability to `PLT-*` IDs — impossible.
- All `*.pem`, `*.key` protection in `.gitignore` — currently protecting nothing, and protecting nothing on day 0 means the first `git init` + `git add -A` will sweep in whatever is on disk, including `.claude/settings.json`'s live token.

**This is why the token is P0.** The fix is not "add it to `.gitignore`" — `.gitignore` is irrelevant before the first commit, and the file is not a build artefact, it is config. The fix is rotate the credential, then move it out of the repo.

### 2.4 Secrets & environment

**Finding SEC-01 (P0, immediate):** `.claude/settings.json` contains
```
"ANTHROPIC_AUTH_TOKEN": "thk_live_…"   ← a live bearer token, prefix "thk_live_"
"ANTHROPIC_BASE_URL":   "https://tokenharbor.ai"
```
`thk_live_` is a production-issued credential, and the base URL is a third-party proxy rather than the vendor default. Two separate risks:
1. **Exposure.** Not gitignored, sitting in a repo whose entire purpose is to be version-controlled and shared. The moment `git init && git add -A` runs, it is in history forever. `.gitignore` currently lists `.env`, `.env.*`, `*.pem`, `*.key` — **not** `.claude/`.
2. **Supply chain.** Routing all model traffic through a non-default base URL means a third party sits in the path of every prompt, which for this project means prompts containing school data schemas, licence-payload designs and student-data architecture.

**Finding ENV-02 (P3):** `.env.local` carries `NEXTAUTH_SECRET` / `NEXTAUTH_URL` and a Next.js-shaped `DATABASE_URL` pointing at `localhost:5432/eduflowdb_new`. `AGENTS.md` §3.1 mandates **NestJS** (not NextAuth/Next.js server actions) and §2.1 mandates **one PostgreSQL database per school**. A single shared `DATABASE_URL` is therefore architecturally wrong for this app even as a placeholder — it models the legacy multi-tenant shape. `.gitignore` correctly flags this, but leaving the file in place invites someone to "just use it".

**Finding ENV-03 (P1, missing):** `AGENTS.md` §11 mandates `.env.example` documenting every variable, and mandates "start-up must fail fast naming the missing variable; no silent defaults". `AGENTS.md` §11 itself says `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` / `LICENSE_PUBLIC_KEY_PATH` / `STORAGE_ENDPOINT` / `REDIS_URL` — none of these appear anywhere in the repo, and no `.env.example` exists.

### 2.5 Legacy reference corpus (`EduFlowV3`)

**Path correction:** `AGENTS.md` §1 points at `H:\AI-Dev\MyProjects\EduFlowV3\`. That path exists but contains only `EduFlowV3/`, `EduFlowV3.7z`, `eduflow/` and a `nul` file. The **actual application** is three levels down: `H:\AI-Dev\MyProjects\EduFlowV3\EduFlowV3\eduflow\`. Anyone following `AGENTS.md` literally will not find the code.

Measured (excludes `node_modules`, `.next`):

| Measure | Value | `AGENTS.md` claim | Match? |
|---|---|---|---|
| Prisma models | **59** | "35-model scoping" (§5.2) | ⚠️ Unverified — 35 may be the *scoped subset*; needs confirming |
| Prisma enums | **23** | — | — |
| `schema.prisma` size | 41 KB | — | — |
| `$queryRaw` / `$executeRaw` call sites | **149** | "9 unfiltered sites" (§5.2) | ❌ **Off by ~16×.** Re-measurement required; the exclusion criteria are undocumented |
| TypeScript/TSX files | **630** | — | — |
| Test files (`*.test.*`/`*.spec.*`) | **897** | — | 🟢 Abundant — this is the real prize |
| `prisma-tenant-extension.ts` | present | "do not reuse" (§5.2) | ✅ Confirmed, correctly excluded |
| `directives/` | present in legacy | new `directives/` (AGENTS.md §10) | 🟡 Worth mining for SOP content |
| Legacy git repo | present (`.git`) | — | 🟢 Could supply provenance |

**Assessment:** the legacy corpus is substantial and the *reason* `AGENTS.md` §5 can be confidently specific about what to reuse (fee calculation, promotion rules, scheduling, auth logic, validation) is that it was audited. But `docs/analysis/LEGACY_REUSE_INVENTORY.md` — the artefact §5.1 calls the "inventory and per-file judgements" — **was never written**, and one of its headline numbers (9 raw-SQL sites) is off by more than an order of magnitude. Per `AGENTS.md` §5.2 ("When in doubt, do not port. A ported file must be named in the reuse inventory") **nothing may be ported until that inventory exists.** That is a hard, currently-active blocker.

---

## 3. Documentation Analysis

### 3.1 Document inventory & health

| Document | Size | Health | Notes |
|---|---|---|---|
| `AGENTS.md` | 35.5 KB | 🟡 **Good content, broken links** | ~30 dangling references (§3.3) |
| Master Plan v5.2 | 79.4 KB | 🟢 Excellent | Most complete artefact. §5.2 GL and §5.3 i18n are unusually concrete |
| SRS v1.2 | 39.5 KB | 🟢 Excellent | Part B test strategy and Part D MVP ACs are directly executable |
| Jira Epics v1 | 35.0 KB | 🟢 Excellent | 33 stories, real ACs, dependency graph |
| School Setup Workflow v1 | 80.3 KB | 🟢 Excellent but **orphaned** | Not in `AGENTS.md` §1's list, not in §12 "where to look" |
| Frontend Template | 34.4 KB | 🟡 Over-claimed | See §3.6 |
| `SSOT.md` | **0 B** | 🔴 Empty | §12 calls this the answer to "what is the current state" |
| `ARCHITECTURE.md` | **0 B** | 🔴 Empty | §12 calls this the answer to "how is it architected" |
| `WORKLOG.md` | **0 B** | 🔴 Empty | §9: "If work is not in the worklog, it did not happen" |
| `TODO.md` | **0 B** | 🔴 Empty | §12: "What is the next task?" |
| `BACKLOG.md` | **0 B** | 🔴 Empty | §9: unscheduled ideas destination |
| `CHANGELOG.md` | **0 B** | 🔴 Empty | No release history possible pre-scaffold |

### 3.2 Document dependency graph (what is load-bearing)

```
Master Plan v5.2  ──┐
                    ├──► Jira Epics v1 ──► (build order for PLT-EPIC-01..09)
SRS v1.2 ───────────┘
   │
   ├──► Part B (test strategy) ──► every future TDD gate
   ├──► Part C §15-17 (kickoff) ──► repo layout, Day-1 checklist
   └──► Part D (MVP) ────────────► scope gate

School Setup Workflow v1 ──► delivery process (ORPHANED: no inbound edge)

MISSING LINK: idea-bank/* ──► nothing. It is the layer between "planning prose"
             and "buildable requirements". AGENTS.md §6 calls it
             "the authoritative requirements". Without it, every story must
             be re-derived from 200-page prose by hand, per module.
```

### 3.3 Broken cross-references in `AGENTS.md` (verification table)

Every claim below was checked against the filesystem.

| `AGENTS.md` ref | Asserts | Reality |
|---|---|---|
| §1 | "Governing ADR: `docs/adr/ADR-003-new-app-single-tenant-selective-reuse.md`" | ❌ Directory and file do not exist |
| §1 | Planning docs = Master Plan v5.2, SRS v1.2, Jira Epics v1 | ⚠️ Incomplete — omits School Setup Workflow v1 (80 KB) |
| §2.8 | "Harvest them into `packages/i18n-resources/` and `packages/ui-kit`" | ❌ `packages/` does not exist |
| §2.8 | "Assessment: `docs/design/FRONTEND_TEMPLATE.md`" | ❌ Does not exist |
| §3 | Full tree `apps/`, `packages/`, `directives/`, `infra/` | ❌ None exist |
| §4 | `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:coverage`, `pnpm test:integration`, `pnpm test:e2e` | ❌ No `package.json`; none runnable |
| §5.1 | "Inventory: `docs/analysis/LEGACY_REUSE_INVENTORY.md`" | ❌ Does not exist |
| §5.2 | "9 unfiltered `$queryRaw`/`$executeRaw` sites" | ❌ Measured **149** |
| §6 | `docs/idea-bank/` — 5 files, "the authoritative requirements" | ❌ Directory does not exist |
| §6.1 | Blocking gaps `PC-000` … `PC-004` ticketed | ⚠️ Described but no ticket system; `PC-005`/`PC-006` marked "not yet ticketed" |
| §7 | "Plan: `docs/work/PLATFORM_CORE_PLAN.md`" | ❌ Does not exist |
| §9 | "Update `docs/work/WORKLOG.md` and `docs/work/TODO.md`" | ⚠️ Both exist but are 0 bytes |
| §9 | "`PLT-205`'s living matrix" — RBAC permission-matrix fixture | ❌ Does not exist; gated on `PLT-205` (Sprint 4) |
| §10 | `directives/` — Layer-1 SOPs | ❌ Does not exist |
| §11 | `.env.example` documents every variable | ❌ Does not exist |
| §12 | "Current state → `docs/core/SSOT.md`" | ❌ 0 bytes |
| §12 | "Architecture → `docs/core/ARCHITECTURE.md`" | ❌ 0 bytes |
| §12 | "Module notes → `docs/modules/<module>/`" | ❌ Does not exist |
| §12 | "Original corpus → `docs/archive/corpus/`" | ❌ Does not exist (may be intentionally deleted — **confirm**) |
| §14 | All pnpm/turbo commands | ❌ Not runnable |

**Total: ~21 verified-dangling references.** In a repository whose governing document's core function is to be an operating contract, this is the highest-leverage documentation defect: an agent following `AGENTS.md` literally will spend its first session failing to open files.

### 3.4 Internal contradictions

| # | Contradiction | Detail | Resolution |
|---|---|---|---|
| C-01 | Repository name | `AGENTS.md` §1 = `EduFlow`; `SRS` §15 = `sms-platform/` | Use `EduFlow`. Update SRS §15. |
| C-02 | Legacy path | `AGENTS.md` §1 = `EduFlowV3\`; actual app at `EduFlowV3\EduFlowV3\eduflow\` | Correct `AGENTS.md` §1 with the full path |
| C-03 | Story count | `AGENTS.md` §7: "the Jira plan file lists 33 — reconcile if they differ"; counted = **33 stories** | ✅ Reconciled. No action. |
| C-04 | Epic points | `AGENTS.md` §7 table sums 34+42+29+21+18+16+13+13+13 = **199**; Jira doc says "~199" | ✅ Consistent |
| C-05 | SMS provider | `AGENTS.md` §2.2: SMS provider "deliberately undecided"; Master Plan §5.3/§23 name WhatsApp (Vvaslution) | Not a real conflict — WhatsApp is decided, SMS is not. State this explicitly. |
| C-06 | **Setup Workflow orphan** | 80 KB process doc with gates G0–G9, unreferenced by `AGENTS.md` | **Add to `AGENTS.md` §1 and §12.** It defines the delivery process the epics must satisfy. |
| C-07 | **Phase numbering** | SRS Part E: Phases 0–15, MVP at end of Phase 6/7. Master Plan §28: Phases 0–15, MVP-critical at Phase 5–6. Jira doc: 4 sprints. | Three different planning horizons for the same work. Declare SRS Part E authoritative for dates; Master Plan §28 for sequence; Jira doc for the first milestone. |
| C-08 | SMS/tax/currency | `AGENTS.md` §6.1 `PC-003`: "Tax & currency never mentioned"; Master Plan §5.2 has no tax concept either | **Still blocking.** `PC-003` is real. |

### 3.5 Estimation accuracy

The Jira doc estimates 33 stories / 199 points / 4 sprints for Platform Core with 3–4 backend engineers. That estimate **implicitly assumes the repository, toolchain, CI and architecture contracts already exist.** They do not. Adding EPIC-A…EPIC-F (~172 pts) roughly **doubles** the pre-MVP estimate. The original 4-sprint figure is not wrong — it is scoped to "build the epics", not "build the product". The gap must be made explicit in `PLATFORM_CORE_PLAN.md`.

### 3.6 Frontend template: `AGENTS.md` §2.8 over-claims

`AGENTS.md` §2.8 states the template "already contains a complete `en`/`ta`/`si`/`ar` dictionary and a working RTL implementation". Measured:

| Claim | Measured | Verdict |
|---|---|---|
| "complete en/ta/si/ar dictionary" | **21 keys per locale**, all landing-page marketing copy (`navLogin`, `heroTitle`, `kpiStudents`, `f1h`…`f4p`, `footer`) | ❌ **Over-claimed.** Real, correctly-encoded translations (verified: `ar.navLogin` = `062A 0633 062C 064A 0644 0020 0627 0644 062F 062E 0648 0644`) — but 21 marketing keys is not a dictionary, and zero application keys exist |
| "working RTL implementation" | **4 CSS rules**: `html[dir="rtl"]` on `.stats/.hero-cta/.nav-links`, `.marquee-track` animation reverse, `.lang-menu` right→left, `.lang-menu button` text-align. Plus one JS line setting `dir` on `<html>` | ⚠️ A **landing page** is mirrored. No form/input alignment, no sidebar, no table, no icon mirroring, no logical properties. Does not satisfy `AGENTS.md` §3.2.6 |
| "light/dark token set" | `:root:not([data-theme="light"])` + `:root[data-theme="dark"]`, tokens `--bg --surface --brand --brand-2 --accent --muted --border` | ✅ Accurate and genuinely useful |
| "honour `prefers-color-scheme`" (AGENTS.md §3.2.5) | 1 occurrence | 🟡 Present but thin |
| `prefers-reduced-motion` (AGENTS.md §3.2.7) | **0 occurrences** | ❌ Absent — must be added |
| OAuth providers shown | Google, Microsoft, Apple, Facebook | 🔴 `AGENTS.md` §13 forbids implementing these without confirmed credentials. `settings.json` has a `social()` handler for all four. Do not port. |
| Marketing claims | "Trusted by 200+ schools", "1.2M Students Managed", "Start Free Trial" | ❌ False / contradicts per-school edition sales. `AGENTS.md` §2.8 already flags these. Do not port. |

**Correction needed in `AGENTS.md` §2.8** — the template is a **token + RTL-pattern donor**, not a dictionary donor. Real i18n content must be authored per module. This materially changes the E-EPIC estimate.

---

## 4. Gap Register

Severity: **S1** = blocks all work · **S2** = blocks a milestone · **S3** = degrades quality · **S4** = hygiene

| ID | Gap | Sev | Blocks | Evidence |
|---|---|---|---|---|
| **GAP-01** | Live `thk_live_` token in `.claude/settings.json`; third-party `ANTHROPIC_BASE_URL` | **S1** | All — credential exposure + supply-chain risk | §2.4 |
| **GAP-02** | Not a git repository | **S1** | TDD checkpoints, worklog discipline, conventional commits, secret protection | §2.3 |
| **GAP-03** | No `package.json` / workspace / toolchain | **S1** | TDD (no test runner), all §4 quality gates, every epics story | §2.2 |
| **GAP-04** | `docs/idea-bank/` absent — "the authoritative requirements" | **S1** | Every domain epic; forces re-derivation of 257 rules/35 entities/73 FRs from prose ⚠️ **those three numbers are wrong and unsourced — see the note below** | §1.2, §3.2 |

> ### ⚠️ GAP-04's stated impact used invented figures
>
> The figures **257 rules / 35 entities / 73 FRs** in the `GAP-04` row, and the **139 modules / 20 domains / 15 risks / 40 boundary tests / 41 failure modes** that `AGENTS.md` §6 attached to the same directory, **have no source in this repository**. They also appear in `AGENTS.md:331-337` and `WORKLOG.md:308`.
>
> Measured 2026-09-29 (`docs/analysis/CODE_AUDIT_2026-09-29.md` DOC-01): the five `docs/idea-bank/` files are **zero-row stubs totalling 16,124 bytes**, each declaring `**Status:** Placeholder. Zero …rows.` Independently enumerating `SRS §3` yields **87 unique FR IDs**, not 73 — so even the real FR count was wrong. The 9 NFR figure is the only correct one.
>
> **`GAP-04` itself is real and remains S1.** Only its sizing was fabricated. `AGENTS.md §6`'s table was removed by **D28** on 2026-09-29 rather than replaced — substituting 87 without performing the extraction would be a second invention. **Do not use any of these numbers to size the work.**
| **GAP-05** | No ERD / data model in any form | **S1** | SRS Phase 0 exit; `PLT-EPIC-01` "Definition of Ready" | §1.3 |
| **GAP-06** | `LEGACY_REUSE_INVENTORY.md` absent + raw-SQL count wrong (9 vs 149) | **S2** | All porting, per `AGENTS.md` §5.2 | §2.5 |
| **GAP-07** | 6 documents exist at 0 bytes (`SSOT`, `ARCHITECTURE`, `WORKLOG`, `TODO`, `BACKLOG`, `CHANGELOG`) | **S2** | Onboarding, traceability, `AGENTS.md` §9 compliance | §3.1 |
| **GAP-08** | ~21 dangling cross-references in `AGENTS.md` | **S2** | Agent/human orientation; causes wasted first sessions | §3.3 |
| **GAP-09** | No CI, no `.env.example`, no local environment | **S2** | Definition of Done (`AGENTS.md` §4), fail-fast startup (§11) | §1.2 |
| **GAP-10** | `PLATFORM_CORE_PLAN.md` absent though `AGENTS.md` §7 points at it | **S2** | Milestone 1 planning | §1.2 |
| **GAP-11** | `docs/adr/` absent — the "Governing ADR" does not exist | **S2** | Justification for single-tenant; the single most consequential decision is undocumented | §1.2 |
| **GAP-12** | `School_Setup_Workflow_v1.md` (80 KB, gates G0–G9) orphaned | **S2** | Delivery process definition; new hires will not find it | §3.4 C-06 |
| **GAP-13** | `FRONTEND_TEMPLATE.md` absent; §2.8's claims are inaccurate | **S3** | i18n/RTL estimation; risk of planning against a false assumption | §3.6 |
| **GAP-14** | `PC-000`…`PC-006` design gaps unresolved (attendance, leave, grading, tax, admission, retail, wallet) | **S2** | Those entire domains — cannot be built | `AGENTS.md` §6.1 |
| **GAP-15** | No i18n content, no `packages/ui-kit`, no app-shell RTL | **S3** | Every UI story; `AGENTS.md` §2.8/§3.2.6 | §3.6 |
| **GAP-16** | `prefers-reduced-motion` absent from template; no design system | **S3** | Accessibility gate | §3.6 |
| **GAP-17** | `docs/archive/corpus/` absent — is it deleted or never migrated? | **S3** | Provenance/audit of the idea-bank extraction | §1.2 |
| **GAP-18** | `PLT-205` RBAC permission-matrix fixture does not exist | **S2** | `AGENTS.md` §2.3 static check; every new route | §3.3 |
| **GAP-19** | `.env.local` is NextAuth-shaped; no `.env.example` | **S3** | Misleads implementers toward the wrong auth model | §2.4 |
| **GAP-20** | Story-count reconciliation in `AGENTS.md` §7 is already correct (33) — but there is no mechanism to keep it correct | **S4** | Doc drift | §3.4 C-03 |
| **GAP-21** | Three conflicting phase-numbering schemes | **S4** | Scheduling clarity | §3.4 C-07 |

---

## 5. Areas for Improvement

Beyond the gaps, seven structural improvements are worth making. These are recommendations, not defects.

**IMP-01 — Turn `AGENTS.md` into a verified contract.** Add a CI check (or a `pnpm run docs:verify` script) that greps every backticked path in `AGENTS.md` and fails if the file does not exist. Cheap, and it makes GAP-08 structurally impossible to reintroduce. `AGENTS.md` §2.3 already demands a static check for `@RequirePermission`; the same technique applies to documentation.

**IMP-02 — Reconcile the three planning horizons explicitly.** SRS Part E (dates), Master Plan §28 (sequence), Jira doc (first milestone) are each correct for their own question but none says so. One short table in `SSOT.md` declaring which is authoritative for what removes a whole class of confusion.

**IMP-03 — Make the RBAC matrix exist before the RBAC engine.** `AGENTS.md` §9 says "Do not merge a route without updating it — this is `PLT-205`'s living matrix", but `PLT-205` is a Sprint-4 story. The matrix must be a **scaffold in Sprint 1** (empty, seeded with the system roles) and be filled as routes land. Deferring it guarantees the static check has nothing to check against on day one.

**IMP-04 — Extract the idea-bank before writing epics, not after.** `AGENTS.md` §6 instructs reading the relevant idea-bank section before implementing any module. With the idea-bank missing, every story author is reconstructing requirements from 200 pages of prose independently — producing drift between modules that no reviewer will catch. This is the highest-leverage single item in the plan.

**IMP-05 — Pre-warm the TDD harness as its own story.** Because RED/GREEN evidence requires a runner, coverage and git, a dedicated story ("the harness is green on an empty module") is worth separating from scaffold. It converts an abstract gate into a demonstrable fact and makes every later story cheaper.

**IMP-06 — Extract i18n keys as a byproduct of each story, from day one.** `AGENTS.md` §4.2 requires all four locales. If `packages/i18n-resources/` does not exist at Sprint 1, every UI story will hard-code English and be retrofitted later — which `AGENTS.md` §2.8 calls "review-blocking". Building the four-locale skeleton in Sprint 1 makes the default the correct behaviour.

**IMP-07 — Reconcile the legacy inventory before the first port, and record the 149-vs-9 discrepancy as an explicit decision.** The number in `AGENTS.md` §5.2 is wrong by ~16×. Either the earlier audit used a narrower definition (documented nowhere) or it was simply mistaken. Either way a reader will trust the wrong number. Correct it with the measurement method recorded, so the next audit is reproducible.

---

## 6. Master Action Plan — Jira/Epic Style

Project keys: `REPO` (Repository/Toolchain), `ARC` (Architecture/Contracts), `REQ` (Requirements), `DSN` (Design System/i18n), `OPS` (CI/Environments), `PLT` (existing Platform Core, unchanged).

**Global Definition of Done — applies to every story in this document:**
1. Failing test written and **observed failing for the intended reason** (RED checkpoint commit) — where the story produces behaviour.
2. Minimal implementation (GREEN checkpoint commit).
3. Refactor with tests green.
4. `pnpm lint` 0 errors · `pnpm typecheck` 0 errors · `pnpm test` green · `pnpm test:coverage` at tiered threshold · `pnpm build` green.
5. `docs/work/WORKLOG.md` and `docs/work/TODO.md` updated **in the same commit**.
6. Conventional commit referencing the requirement ID: `feat(scope): description (REPO-01)`.
7. No secrets in tracked files.

**Story points:** Fibonacci (1,2,3,5,8,13). **Estimates assume a 3-person team** (2 backend, 1 full-stack/QA).

---

### EPIC REPO — Repository, Security & Toolchain Foundation
**Goal:** A version-controlled, secret-clean, runnable, gate-enforced monorepo exists.
**Blocks:** literally every other epic.
**Estimate:** 34 points · **Target: Sprint 0 (2 weeks)**

| Story | Title | Pts | Priority | Acceptance Criteria |
|---|---|---|---|---|
| **REPO-01** | **Rotate exposed credential and remove it from the repo** | 2 | **P0** | (a) `thk_live_` token in `.claude/settings.json` rotated at the issuer; (b) file rewritten to reference an env var or moved to a gitignored location; (c) `ANTHROPIC_BASE_URL` either reverted to the vendor default or the third-party routing is an explicit, recorded decision; (d) **Done only after the old token is confirmed dead** — deleting the string is not remediation. |
| **REPO-02** | `git init`, `.gitignore` hardening, first commit | 3 | **P0** | (a) `git init` run; (b) `.gitignore` extended with `.claude/`, `*.log`, `graphify-out/`; (c) `git remote` configured (or a local bare remote created for parity with per-school deployments); (d) first commit is a clean tree — verified with `git status --porcelain` empty and `git ls-files` showing no secret; (e) branch protection documented. |
| **REPO-03** | Monorepo scaffold — root `package.json`, `pnpm-workspace.yaml`, `turbo.json` | 5 | **P0** | Workspaces: `apps/*`, `packages/*`. Scripts `lint`, `typecheck`, `test`, `test:coverage`, `build`, `test:integration`, `test:e2e` exist at root and resolve per `AGENTS.md` §14. `pnpm -r build` succeeds on an empty tree. |
| **REPO-04** | Shared config package — `packages/config` | 5 | **P0** | Extends `packages/shared-types` (`@/*` → `./src/*` per `AGENTS.md` §8). TypeScript **strict**, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` on. ESLint flat config; Prettier config; a rule banning `any` without the mandated `// TODO: type this` + ticket comment; **banning `@ts-ignore`/`@ts-expect-error` outright**. `AGENTS.md` §2.3's missing-`@RequirePermission` check lives here as an ESLint rule from day one. |
| **REPO-05** | Test harness — Jest, RTL, MSW, Playwright, coverage gates | 8 | **P0** | `pnpm test` runs; `pnpm test:coverage` **enforces** `AGENTS.md` §4 tiers (domain 90/85, controllers 70, frontend hooks 80) and **fails the build** when unmet. `pnpm test:integration` uses a containerized Postgres on an isolated schema. `pnpm test:e2e` boots the app. A single trivial spec exists and passes — the harness is demonstrably green before any feature lands. |
| **REPO-06** | `apps/api` — NestJS skeleton with Clean Architecture boundary | 8 | **P0** | Boots. `main.ts` reads config via validated schema. `docs`-level module folders exist for **every** top-level domain in Master Plan §5 per `SRS` §17, each with `controllers/ use-cases/ domain/{entities,repositories,services}/ infrastructure/{postgres,adapters}/ dto/`. Prisma client generated; first migration applies against the containerized DB. |
| **REPO-07** | `apps/web` — Next.js skeleton, Tailwind v4 + shadcn/ui | 5 | **P0** | Boots with `next-intl` wired to a 4-locale route (`/en /ta /si /ar`). Tokens from the frontend template applied as CSS variables. `data-theme` set on `<html>` before first paint; `prefers-color-scheme` honoured; `prefers-reduced-motion` respected. Root layout renders in Arabic with `dir="rtl"` and no layout breakage. |
| **REPO-08** | `.env.example` + fail-fast config validation | 3 | **P0** | Every variable in `AGENTS.md` §11 documented with a placeholder. Startup **fails naming the missing variable**; no silent defaults; verified by a test that unsets a variable and asserts the error message. Placeholder values are unmistakably fake (`<generate with: openssl rand -base64 32>`), never real-looking. |

**Exit criteria:** `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm test:coverage && pnpm build` all green on an empty-but-real tree, in CI, on a fresh clone. **This is the "Foundation Harness" milestone.**

---

### EPIC ARC — Architecture & Engineering Contracts
**Goal:** Every rule in `AGENTS.md` §2 becomes a written contract with a test or a check that proves it, before feature code depends on it.
**Blocks:** `PLT-EPIC-01` "Definition of Ready"; SRS Phase 0 exit.
**Estimate:** 42 points · **Target: Sprint 0–1**

| Story | Title | Pts | Priority | Acceptance Criteria |
|---|---|---|---|---|
| **ARC-01** | ERD — the data model, signed off | 13 | **P0** | Covers the entities in `SRS` §6 plus `User`, `Role`, `Permission`, `RolePermission`, `Session`, `RefreshToken`, `AuditRecord`, `SchoolSettings`, `ModuleRegistry`, `License`, `NotificationPreference`, `NotificationDelivery`, `StoredFile`. Money as **integer minor units + explicit currency** (`AGENTS.md` §2.5). Every school-scoped table carries `school_id` as **metadata, not a security control** (`§2.1`). Resolves the `PC-004` admission gap. Mermaid or Prisma schema checked in. **Explicitly does NOT port the legacy 59-model tenant scoping.** |
| **ARC-02** | `docs/core/ARCHITECTURE.md` | 8 | **P0** | Currently 0 bytes. Documents: layer dependency rules; the four canonical adapter interfaces; the shared-engine table (`AGENTS.md` §2.9); money and time conventions; error and logging policy; tenancy model. Includes **at least one worked counter-example** of a rejected design (the tenancy layer) so future readers do not "restore" it. |
| **ARC-03** | `IClock` + base test utilities | 5 | **P0** | `IClock` injected everywhere `AGENTS.md` §2.4 requires. **An ESLint/CI check fails on `Date.now()` or `new Date()` in `domain/` or `use-cases/`.** Shared factories/fixtures for `Student`, `Staff`, `School`, `Class`, `FeeInvoice` available to all tests. |
| **ARC-04** | Guard decorators — `@RequirePermission`, `@RequireEntitlement`, `@Audited` (contract + skeletons) | 5 | **P0** | All three exist and compose. Skeletons ship in `PLT-EPIC-02/03/04`; what matters here is that the **shape** and the **static check** land first, so no route is ever written without them. |
| **ARC-05** | RBAC permission-matrix fixture scaffold | 3 | **P0** | `PLT-205`'s living matrix exists as an **empty-but-seeded** fixture from Sprint 1 (system roles + full permission key taxonomy, zero routes). The static check in `ARC-04` validates new routes against it. Addresses IMP-03. |
| **ARC-06** | Money value object + journal-balance invariant | 5 | **P0** | `Money` (minor units + currency + per-school scale) with a dedicated unit test. Journal entry **rejects imbalance in the domain layer, before the database** (`§2.5`) — a failing-then-passing test that proves the rejection. |
| **ARC-07** | `docs/adr/` — decision records | 3 | **P0** | `ADR-003` (single-tenant + selective legacy reuse) reconstructed from `AGENTS.md` and **marked as requiring owner sign-off** — it currently does not exist despite being cited as governing. Plus records for: money representation, mobile at milestone 2, licensing in milestone 1, i18n approach. |
| **ARC-08** | Port-scoped rules file (`directives/`) | 2 | **P1** | `directives/` exists with SOPs for: adding a module, adding a route, adding a rule engine, writing a table-driven test, adding a new `ILedgerPostingRule`. Follows `AGENTS.md` §10. Mine `EduFlowV3/directives/` for salvageable content. |
| **ARC-09** | Resolve contradiction register | 3 | **P1** | C-01…C-08 in §3.4 each closed with a decision recorded in `SSOT.md`; `AGENTS.md`, SRS §15 and the Master Plan updated to agree. |

---

### EPIC REQ — Requirements Extraction (`docs/idea-bank/`)
**Goal:** Produce the "authoritative requirements" layer that `AGENTS.md` §6 depends on, so no story is authored by re-reading 200 pages of prose.
**Blocks:** every domain epic; GAP-04; highest leverage in the plan.
**Estimate:** 34 points · **Target: Sprint 1 (parallel with PLT-EPIC-01)**

> **This is extraction, not invention.** The content is derived from Master Plan v5.2, SRS v1.2 and `AGENTS.md` §2. Every rule keeps a **source citation**. Where the corpus is silent, the entry says `GAP — needs design (PC-xxx)`. **Do not invent business rules.** Fabricating a threshold here would be worse than leaving it blank, because it would look authoritative.

| Story | Title | Pts | Priority | Acceptance Criteria |
|---|---|---|---|---|
| **REQ-01** | `module-inventory.md` | 5 | **P0** | All domains from Master Plan §5, each with: name, Master Plan §, SRS §, priority (from SRS Part D P0/P1/P2), required entities, owning `apps/api` module folder, licence gate (`allowed_modules` key from Master Plan §3). Cross-checked against Master Plan §29's 30-row coverage table — every row maps to an inventory entry. |
| **REQ-02** | `domain-entities.md` | 8 | **P0** | Per entity: fields + types, constraints, `schoolId` flag, money flag, owning module, and **existing SSOT-equivalent check** — per `AGENTS.md` §6, each entry must state whether an equivalent already exists in `SSOT.md` or §2.9, so parallel concepts under new names are caught at creation time. |
| **REQ-03** | `business-rules.md` | 8 | **P0** | One row per rule: ID, statement, **source citation**, edge cases, affected entities, and a **table-driven test target**. Every rule engine named in `AGENTS.md` §4.1 (promotion, leave accrual, attendance discrepancy, licence validation, GL posting, facility conflict) has at least one row. |
| **REQ-04** | `fr-index.md` | 5 | **P0** | Every FR in SRS Part A, with: ID, statement, source §, MVP flag (P0/P1/P2 per SRS Part D §19), **which epic/story implements it**, and a test reference. This is the traceability backbone joining SRS → epics → tests. |
| **REQ-05** | `edge-cases-and-risks.md` | 5 | **P1** | Boundary conditions, failure modes and known gaps, each mapped to a test. Must explicitly list the unresolved `PC-000`…`PC-006` design gaps with their blocking impact. |
| **REQ-06** | `AGENTS.md` §2 "existing equivalent" index | 2 | **P1** | A single searchable table of every existing engine/port/value-object named in §2.2/§2.9, so §6's "creating a parallel concept under a new name" check is a lookup, not an archaeology exercise. |
| **REQ-07** | Resolve or formally defer `PC-000`…`PC-006` | 3 | **P1** | Each of the seven gaps (attendance, leave, grading, tax/currency, admission, retail, wallet) is either **designed** (with rules + entities) or **formally deferred with a named owner and a target milestone**. An unticketed deferral is not acceptable — it is how `PC-005`/`PC-006` already happened. |

---

### EPIC DSN — Design System, i18n & RTL
**Goal:** Make the correct thing the default. Correct output is produced by stories, not retrofitted by a reviewer.
**Blocks:** every frontend story; GAP-13/15/16; IMP-06.
**Estimate:** 21 points · **Target: Sprint 1**

> Premise from §3.6: the frontend template is a **token and RTL-pattern donor**, not a dictionary donor. It has 21 marketing keys and 4 landing-page RTL rules. Real i18n content is authored per module, from Sprint 1.

| Story | Title | Pts | Priority | Acceptance Criteria |
|---|---|---|---|---|
| **DSN-01** | `packages/ui-kit` from template tokens | 5 | **P0** | shadcn/ui components using the template's CSS variables (`--bg --surface --text --muted --border --brand --brand-2 --accent --danger --ok`) in **both** light and dark. No hard-coded hex. `data-theme` on `<html>` pre-paint. `prefers-color-scheme` honoured when no stored choice. Marketing content (`"Trusted by 200+"`, `"1.2M Students"`, `"Start Free Trial"`) and all four social-login buttons **excluded**. |
| **DSN-02** | `packages/i18n-resources` — 4-locale skeleton | 5 | **P0** | `en/ta/si/ar` resource files exist and are **key-parity enforced** (a test fails when one locale is missing a key). Namespaces per module. **No English fallback in a non-English locale** (`AGENTS.md` §4.2). API, and an RTL/LTR symmetry test. |
| **DSN-03** | RTL foundation | 5 | **P0** | `dir` set on `<html>` from locale. Logical properties only (`ms/me/ps/pe`, `start/end`). Sidebar becomes a `Sheet` drawer on mobile / full sidebar on `lg:`. Directional icons mirrored. **Arabic renders correctly on a login page, a form page and a data-table page** — the three archetypes every later screen copies. |
| **DSN-04** | Font strategy for Tamil / Sinhala / Arabic | 3 | **P0** | Approved font stack decided with the owner (`AGENTS.md` §3.2.7) and applied. Proof of coverage for all four scripts **on screen and in the PDF pipeline** — the PDF path is a common late discovery. |
| **DSN-05** | Accessibility baseline | 2 | **P0** | `prefers-reduced-motion` respected; motion ≤ 200 ms; touch targets ≥ 44 px; visible focus rings. Lighthouse accessibility audit runs in CI (`OPS-04`). |
| **DSN-06** | CI enforcement of UI rules | 1 | **P1** | Lint/CI **fails** on a literal user-facing English string in JSX/TSX outside a resource file (`AGENTS.md` §2.8 "review-blocking issue" → here it is machine-enforced). Fails on a hard-coded hex in a component. |

---

### EPIC OPS — CI/CD, Quality Gates & Environments
**Goal:** Make "done" mechanically verifiable. Per IMP-05, the harness is a story, not an assumption.
**Blocks:** `AGENTS.md` §4 definition of done; GAP-09.
**Estimate:** 34 points · **Target: Sprint 1**

| Story | Title | Pts | Priority | Acceptance Criteria |
|---|---|---|---|---|
| **OPS-01** | Local environment — `infra/docker/docker-compose.yml` | 5 | **P0** | PostgreSQL + Redis up via the documented command. Isolated schema per integration run. No dependency on the legacy `.env.local` database. |
| **OPS-02** | CI pipeline skeleton | 8 | **P0** | `PR → lint + typecheck → unit + coverage gate → integration (containerized) → build → [main] E2E smoke → security scan → staging`. **Green on an empty commit** (`SRS` §16.1). Gates are **required checks** — a red gate blocks merge, it does not warn. |
| **OPS-03** | Coverage gate enforcement | 5 | **P0** | `AGENTS.md` §4 tiers enforced automatically per path glob. **A deliberately under-covered file fails the build** — verified by a test, because an unenforced threshold is indistinguishable from no threshold. |
| **OPS-04** | Security scanning | 5 | **P0** | `npm audit`/Snyk gating; OWASP ZAP baseline on staging; **secret scanning** on the repo (which would have caught GAP-01). Log-content scan for sensitive fields (`PLT-502`). |
| **OPS-05** | Documentation verification check | 3 | **P1** | A `docs:verify` script extracts every backticked path from `AGENTS.md`, `SSOT.md` and this plan and **fails** if any does not exist. Structurally prevents GAP-08 from returning (IMP-01). |
| **OPS-06** | Per-school deployment provisioning | 8 | **P1** | The `AGENTS.md` §2.1 model realised: one deployment + one database per school. Provisioning is a script/manifest, not a manual step. Prisma migrations applied per school database. No cross-school query path exists in the product DB. |
| **OPS-07** | Backup & restore drill | 3 | **P0** | Documented, and **actually drilled** — a restore performed and verified. `PLT-903`'s "last backup time" needs a real source. |
| **OPS-08** | Observability skeleton | 3 | **P1** | Correlation IDs generated and propagated (`PLT-501` groundwork). Error logs to **both** file and DB (`AGENTS.md` §2.15). Rotation configured: 25 MB active, 3 historical. |
| **OPS-09** | Staging environment | 3 | **P1** | Deployed and reachable. E2E smoke runs against it before production promotion. |

---

### EPIC PLT — Platform Core & RBAC (existing; restated with gates)
**Source:** `docs/core/EduFlow_Jira_Epics_PlatformCore_RBAC_v1.md` — 9 epics, 33 stories, 199 points. **Story IDs and acceptance criteria are unchanged and authoritative there.** This section only adds what was missing: entry conditions, per-story TDD obligations, and a re-scoped schedule.

**Entry conditions (all must hold before `PLT-101` starts):**
- `REPO-01…08` complete (EPIC REPO exit criteria met) — otherwise there is no test runner and TDD is impossible.
- `ARC-01` (ERD) signed off — `PLT-EPIC-01` "Definition of Ready" requires it.
- `ARC-04`/`ARC-05` (guard shape + matrix scaffold) in place.

**Per-story TDD obligations added to every `PLT-*` story:**
1. Table-driven tests for rule engines: `PLT-203` ownership matrix, `PLT-205` role × module × action, `PLT-301` signature validation (valid / bit-flipped / expired-as-distinct-from-invalid), `PLT-305` grace-period countdown across the boundary.
2. Security tests that prove the **negative**: teacher A cannot edit teacher B's grades even holding `GRADE_ENTER`; a parent cannot read another family's child; a vendor cannot read beyond its own outlet; a Basic-edition school cannot reach a Deluxe route **by calling the API directly**.
3. Every new route updates the `ARC-05` matrix in the same commit (`AGENTS.md` §9).
4. Journal/audit paths assert an audit record was written.

**Re-scope (GAP-21, §3.5):** the original "4 sprints" assumed a working repo. Realistic sequence once REPO/ARC land:

| Sprint | Focus | Exit |
|---|---|---|
| **Sprint 0** | `REPO-01…08`, `ARC-01…07` | **Foundation Harness** — all §4 gates green in CI on a fresh clone |
| **Sprint 1** | `DSN-01…06`, `OPS-01…05`, `REQ-01…05`, `PLT-101`, `PLT-102` | Guards and matrix exist; auth works; idea-bank extracted |
| **Sprint 2** | `PLT-103`, `PLT-104`, `PLT-105`, `PLT-201`, `PLT-202`, `PLT-203`, `PLT-204` | **M2 — Foundation Complete** (`SRS` §24) |
| **Sprint 3** | `PLT-301…305`, `PLT-401`, `PLT-402`, `PLT-501…503`, `PLT-601`, `PLT-602` | Licensing + audit + diagnostics demonstrably working |
| **Sprint 4** | `PLT-205` (matrix sign-off), `PLT-403`, `PLT-701`, `PLT-702`, `PLT-801`, `PLT-802`, `PLT-901…903` | **M3 — Platform Core complete.** Then Academic may begin. |

**Deferred per `AGENTS.md` §7 (D5):** `PLT-104` and `PLT-106` (mobile) move to milestone 2. Note `PLT-106` was already P2.

---

## 7. Sequencing & Critical Path

```
SPRINT 0 (blocking everything)
  REPO-01 rotate token ──► REPO-02 git init ──► REPO-03 workspace
                                                  │
                        ┌─────────────────────────┼──────────────────────┐
                        ▼                         ▼                      ▼
                  REPO-04 config           REPO-05 test harness     ARC-01 ERD
                        │                         │                      │
                        └──────────► REPO-06 api ◄─┘        ARC-02 ARCHITECTURE
                                      REPO-07 web            ARC-03 IClock+utils
                                      REPO-08 .env.example    ARC-04 guard shape
                                                            ARC-05 matrix fixture
                                                            ARC-06 Money
                                                            ARC-07 ADR
                              ▼
                    ★ FOUNDATION HARNESS ★
                    all §4 gates green in CI on a fresh clone
                              │
SPRINT 1  ───────────────────┴──────────────────────────────
   ├── REQ-01..05 idea-bank  (parallel, doc-only, no code deps)
   ├── DSN-01..06 design system + i18n + RTL
   ├── OPS-01..05 CI, coverage gate, security scan
   └── PLT-101, PLT-102 (auth)  ← first real behaviour
                              │
SPRINT 2 ─────────────────────┴────────────
   └── PLT-103,104,105 · PLT-201,202,203,204
                              │
                    ★ M2 FOUNDATION COMPLETE ★
                              │
SPRINT 3 ─────────────────────┴────────────
   └── PLT-301..305 · PLT-401,402 · PLT-501..503 · PLT-601,602
                              │
SPRINT 4 ─────────────────────┴────────────
   └── PLT-205 sign-off · PLT-403 · PLT-701,702 · PLT-801,802 · PLT-901..903
                              │
                    ★ M3 PLATFORM CORE COMPLETE ★
                              │
                    Academic (SRS Phase 2) may begin
```

**Critical path:** `REPO-01 → REPO-02 → REPO-03 → REPO-05 → REPO-06 → ARC-01 → Sprint 0 exit → PLT-101`. Everything else parallelises off it.

**Longest pole:** `ARC-01` (ERD, 13 pts) — it is `PLT-EPIC-01`'s Definition of Ready and the SRS Phase 0 exit gate. Start it first, in parallel with `REPO-01..03`; it needs no code.

**Highest-leverage parallel work:** `REQ-01..05` (idea-bank). It is documentation-only, has zero code dependencies, unblocks every later domain epic, and prevents the drift described in IMP-04. If only one non-code track can be staffed, staff this one.

---

## 8. Global Definition of Done

A story is done when **all** hold:

- [ ] Failing test written and **observed failing for the intended reason** (RED commit on the active branch, reachable from `HEAD`)
- [ ] Minimal implementation; test now green (GREEN commit)
- [ ] Refactored with tests green
- [ ] `pnpm lint` 0 errors · `pnpm typecheck` 0 errors · `pnpm test` green · `pnpm test:coverage` at tiered threshold · `pnpm build` green
- [ ] `pnpm test:integration` green where DB/queue is involved
- [ ] `pnpm test:e2e` green for user-facing flows
- [ ] Rules live in a use-case behind an interface — not in UI or a controller
- [ ] No second attendance / stock / booking / approval / document / notification / ledger engine
- [ ] Every new route: `@RequirePermission` + `@RequireEntitlement` (if gated) + `@Audited` (if sensitive) + matrix row added
- [ ] Money is integer minor units + explicit currency; journal entries balance
- [ ] Time via `IClock`; rule engines have table-driven boundary tests
- [ ] i18n keys present in **all four** locales; RTL, light and dark, and mobile verified
- [ ] Errors logged to file **and** DB; nothing sensitive logged
- [ ] No secrets in tracked files
- [ ] `docs/work/WORKLOG.md` and `docs/work/TODO.md` updated **in the same commit**
- [ ] Conventional commit referencing the requirement ID

---

## 9. Open Questions for the Owner

These need a human decision. I have not guessed at any of them.

1. **Was `docs/archive/corpus/` deliberately deleted, or never migrated?** `AGENTS.md` §12 points at it as the original corpus. Without it, the idea-bank extraction has no verifiable source and REQ-01…05 become prose-summarisation rather than extraction. **This materially changes REQ's reliability.**
2. **`PLATFORM_CORE_PLAN.md`** — should it be a re-scoped version of the Jira doc's sprint table (as drafted in §6) or a standalone plan? Currently `AGENTS.md` §7 points at a file that does not exist.
3. **Third-party `ANTHROPIC_BASE_URL`** — intentional, or a leftover from environment setup? If intentional it needs a recorded ADR (§1.3 supply-chain risk); if not, revert it as part of `REPO-01`.
4. **Which planning horizon is authoritative for dates?** SRS Part E, Master Plan §28, or the Jira sprint table (C-07).
5. **Report-card layouts** — Master Plan §30 flags this as needing confirmation "before Phase 5" because it drives the Document/Print Engine's abstraction. Needs the initial customer set's required layouts.
6. **Font stack** for Tamil/Sinhala/Arabic on screen and in PDF (DSN-04) — `AGENTS.md` §3.2.7 says confirm with the owner.
7. **Activation server** — `PLT-303` needs a real endpoint and a keypair-generation process. Is it in scope for this repo or a separate service?
8. **`PC-000`…`PC-006`** — design these now, or formally defer with named owners and target milestones? REQ-07 requires one or the other.

---

## 10. What This Analysis Did Not Do

- Did not implement anything. TDD cannot start — there is no test runner (GAP-03).
- Did not modify `AGENTS.md`. Its ~21 dangling references and the §2.8 over-claim are **reported here for your decision** rather than silently edited, because `AGENTS.md` is the governing contract and changing it is your call.
- Did not fabricate `docs/idea-bank/`. Fabricated business rules would look authoritative and be wrong.
- Did not create the missing `apps/`, `packages/`, `infra/`, `directives/` trees. Empty scaffolding is not progress; REPO-03/ARC-08 specify what they must contain.
- Did not port any legacy code. `AGENTS.md` §5.2 forbids it without the reuse inventory (GAP-06).
- Did not verify the 149 raw-SQL sites individually — only counted call sites. Per-file judgements belong in the reuse inventory (`GAP-06`).

---

*Analysis complete. Companion documents: `docs/core/SSOT.md` (current state), `docs/core/ARCHITECTURE.md` (architecture), `docs/work/PLATFORM_CORE_PLAN.md` (milestone-1 execution plan), `docs/work/TODO.md` (next actions), `docs/work/WORKLOG.md` (this session's log).*
