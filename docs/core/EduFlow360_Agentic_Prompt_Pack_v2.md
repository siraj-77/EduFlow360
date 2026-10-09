# EduFlow360 — Agentic Development Prompt Pack
## Platform Core, Admin Console, School Setup & Academic Setup (`PLT-EPIC-01…10`, `SET-EPIC-00…06`, `HRM-EPIC-01`, `ACD-EPIC-01…08`): how to initiate the project and drive an AI coding agent step by step

**Version:** 2.0 · **Date:** October 9, 2026 · **Fresh development** (no relation to any earlier implementation) · **70–80% of the code is agent-written**
**Works with:** `AGENTS.md` (the contract — it always wins) · `EduFlow360_Jira_Epics_PlatformCore_RBAC_v2.md` (stories and acceptance criteria) · `EduFlow360_School_Setup_Workflow_v1.1.md` · Master Plan v5.3 · SRS v1.3
**Tool-agnostic:** written for Claude Code, Cursor, Copilot agent mode or any agentic IDE/CLI. Where a tool feature is mentioned, treat it as an example.

> **Agentic split:** about **70–80%** of the implementation is written by agents; humans own decisions, the permission matrix, security review, infrastructure/secrets, template changes, UAT and sign-off. Sub-tasks in the Jira plans are tagged 🤖 / 🤝 / 👤.

> **The core idea.** The agent is the *orchestrator and implementer*; **you are the gatekeeper**. Each prompt below produces one small, verifiable slice, ends at a **human gate**, and leaves the repo green (typecheck, lint, tests, coverage, build) with the worklog updated. You never ask the agent to "build Platform Core". You ask it to do **one story at a time, test first**.

---

## Table of Contents

1. Prerequisites and project initiation (Day 0)
2. Pre-flight decisions and known gaps
3. The working loop
4. Master prompts (reuse every session)
5. Execution order (sprint map)
6. The prompt pack (P0 … P20)
7. Per-story quick reference (all 33 stories)
8. Milestone Definition of Done
9. Anti-patterns and recovery
10. Appendix (templates and snippets)

---

## 1. Prerequisites and project initiation (Day 0)

### 1.1 Tooling on the developer machine
| Need | Notes |
|---|---|
| Node.js (current LTS), `pnpm`, git | Monorepo uses pnpm workspaces |
| Docker + Docker Compose | Local Postgres, Redis, MinIO (S3-compatible), a local mail catcher (e.g. Mailpit) |
| An agentic coding tool | Claude Code / Cursor / similar, with a **plan or read-only mode** |
| Optional | `gh` CLI for PRs; a secrets scanner (e.g. gitleaks) |

### 1.2 Repository and documentation layout
Create the repository and place the planning documents where `AGENTS.md` expects them. Create empty stubs for anything you do not have yet — the agent must be able to find every path `AGENTS.md` mentions.

```
eduflow/
├── AGENTS.md                      # the contract (root — every agent reads it)
├── CLAUDE.md                      # one line: "Read and follow @AGENTS.md" (if your tool uses CLAUDE.md)
├── docs/
│   ├── core/    EduFlow360_Project_Master_Plan_v5.3.md, EduFlow360_SRS_TestPlan_MVP_Roadmap_v1.3.md,
│   │            EduFlow360_Jira_Epics_PlatformCore_RBAC_v2.md, EduFlow360_School_Setup_Workflow_v1.1.md, SSOT.md
│   ├── adr/     ADR-003-fresh-build-single-tenant.md   (+ new ADRs from prompt P1)
│   ├── idea-bank/  module-inventory.md, business-rules.md, domain-entities.md, edge-cases-and-risks.md, fr-index.md
│   ├── design/     FRONTEND_TEMPLATE.md   (notes on the templates)
│   ├── template/   EduFlow360 — Frontend Template.html
│   ├── work/       PLATFORM_CORE_PLAN.md, TODO.md, WORKLOG.md, BACKLOG.md
│   └── archive/corpus/   (historical only)
└── directives/                    # SOPs the agent may update (AGENTS.md §10)
```

- Empty repo first commit contains **only docs + AGENTS.md** — no code.
- Protect the main branch: **no direct commits**; every change through a PR.
- **Fresh build:** nothing from any earlier project is copied, ported or consulted. The only inputs are the planning documents and the two approved UI templates in `docs/template/` (read-only; AGENTS.md §2.17).
- **URLs (dev):** web `http://localhost:3030` · admin `http://localhost:3030/admin` · API `http://localhost:3031` · default user `superadmin`.

### 1.3 Configure the agent
1. **Instruction file.** `AGENTS.md` at the root. If your tool reads a different filename (e.g. `CLAUDE.md`), add a one-line pointer file that imports/points to `AGENTS.md` rather than duplicating it — one source of truth.
2. **Permissions.** Allow: read files, run `pnpm`, `git` (non-destructive), `docker compose`, test/lint/build. **Require approval** for: deleting files outside the task, `git push --force`, `git reset --hard`, editing `.env*`, editing `AGENTS.md`, editing anything under `docs/adr/` or `docs/archive/`, network calls to unknown hosts.
3. **Roles (sub-agents or personas).** Map `AGENTS.md` §10 roles onto your tool: `planner`, `tester`, `builder`, `reviewer`, `ci`, `github`, `memory`, `detective`. If your tool has no sub-agents, you simulate them by running the **same prompt in separate sessions** (planner session → builder session → fresh reviewer session).
4. **Model settings.** Use the strongest available model for P0–P4 (planning, architecture, security-critical), and the same or a slightly faster one for repetitive story work once patterns are established.
5. **Session hygiene.** **One story (or one small prompt) per session.** Start fresh sessions; the repo, `AGENTS.md` and `WORKLOG.md` are the memory — not the chat.

### 1.4 Initiation checklist (do this before pasting any prompt)
- [ ] Repo created, main protected, docs and `AGENTS.md` committed
- [ ] Agent tool installed and pointed at the repo; permissions set (§1.3)
- [ ] `docs/work/TODO.md` and `WORKLOG.md` exist (even if nearly empty)
- [ ] Decisions in §2.1 reviewed by you (defaults are fine; just confirm)
- [ ] You know which prompts you will run in week 1 (§5)
- [ ] You have 30 minutes per day reserved for **human gates**

### 1.5 Indicative first-week schedule
| Day | Prompts | Human gate |
|---|---|---|
| 0 | Section 1.4 checklist | You confirm decisions |
| 1 | **P0** orientation → **P1** ADRs | Approve readiness report and ADRs |
| 2 | **P2** scaffold → **P3** quality gates/CI | Run every command yourself; CI green on a dummy PR |
| 3 | **P4** API kernel · **P4W** web foundation | Review the walking skeleton and the fail-closed guard test |
| 4–5 | **P5** Epic 01 (Auth) — first two stories | Review RED→GREEN commits; try the login flow by hand |

---

## 2. Pre-flight decisions and known gaps

### 2.1 Decisions needed before or during the first sprint
Each has a **recommended default** so you can approve quickly. The agent records them as ADRs in prompt **P1**.

| # | Decision | Recommended default | Needed by |
|---|---|---|---|
| D-A | Password hashing | `argon2id` behind an `IPasswordHasher` port (parameters from configuration) | PLT-101 |
| D-B | Access/refresh tokens | Short-lived access JWT (~15 min), rotating refresh tokens (~7 d) with token-family reuse detection; secrets from env | PLT-101/102 |
| D-C | Licence signature scheme | ECDSA P-256 + SHA-256 over a **canonical (deterministic) JSON** payload; public key embedded, private key only on the activation server | PLT-301 |
| D-D | Activation server | It is **a separate vendor service, not part of this repo**. Build an `ILicenceActivationClient` port, an OpenAPI contract, and a **local fake server** for dev/tests | PLT-303 |
| D-E | Instance fingerprint | Containers make MAC addresses unstable. Use a stable **install ID** generated at first boot and stored in the DB, plus an optional host hash | PLT-303/304 |
| D-F | Permission catalogue | Permissions are declared **in code** (`MODULE_ACTION`, e.g. `ATTENDANCE_MARK`) and synced to the DB on deploy; roles reference them | PLT-201 |
| D-G | Audit durability | Sensitive-action audit rows are written **in the same DB transaction** as the business change (no lost audit on a queue failure); async queue only for non-critical, high-volume events | PLT-402 |
| D-H | Email in dev/prod | SMTP behind `INotificationChannelAdapter`; local mail catcher in dev | PLT-105/702 |
| D-I | Object storage | MinIO locally; any S3-compatible provider in production, behind `IStorageAdapter` | PLT-801 |
| D-J | Metrics format | Prometheus-compatible endpoint | PLT-902 |

### 2.2 Known gaps between the plans (flag to yourself; resolve or accept)
| Gap | Recommended handling |
|---|---|
| **Story count**: Jira plan v2 lists **39 PLT stories (233 pts)** and the School Setup/Academic plan **54 stories (269 pts)** | These files are the executable lists |
| **Default system user** — the owner decided on a seeded **`superadmin`** (single-tenant), replacing the earlier one-time-token idea | Implemented as story **`PLT-107`** (Epic 01): idempotent seed, secret from `SEED_SUPERADMIN_PASSWORD`, forced password change, undeletable. Specified in AGENTS.md §2.16 |
| **Social login (Google/Microsoft/Apple/Facebook)** and **MFA** are **not in the Platform Core epics** | Out of scope for now; add as separate proposed stories later. The template's social buttons are rendered as designed but show a "not configured" message; the template's client-side demo lockout and demo credentials are **replaced by real server behaviour** (the markup stays identical) |
| **Mobile is milestone 2** | Defer `PLT-104` (OTP), `PLT-106` (jailbreak/root) and the push half of `PLT-702` |
| **`PLT-501`/`PLT-502`** (structured logging, redaction) are Sprint 3 in the Jira plan but `PLT-101`'s acceptance criteria require redaction | **Pull minimal 501/502 forward into P4** (documented deviation; log it in the worklog) |
| **`PLT-105`** (password reset) needs to send email before the router (`PLT-701`) exists | Pull the **email adapter** forward behind `INotificationChannelAdapter`; the full router comes in P12 |
| **Audit** (`PLT-401/402`) lands after Auth | Auth defines an `IAuditRecorder` port with an interim adapter; **P7 retrofits and tests audit for every auth event** |
| **Ownership policies** (`PLT-203`) reference classes/children that do not exist yet | Build the engine against abstract ports with fakes; wire real policies when the Academic module lands. Do **not** invent Student/Class entities in Platform Core |
| **Roles naming**: "Superadmin" | The immutable in-school `SUPERADMIN` role held by the seeded `superadmin` user. There is **no cross-tenant role** (AGENTS.md §2.1, §2.16) |

---

## 3. The working loop

```
        ┌───────────────────────────────────────────────────────────────────────┐
        │  YOU: pick next prompt (§5) ─► paste ─► agent PLANS (read-only)       │
        │            ▲                                   │                      │
        │   HUMAN GATE                              you approve plan            │
        │            │                                   ▼                      │
        │  merge PR ◄── reviewer (fresh session) ◄── builder: RED ► GREEN ► REFACTOR
        │            ▲                                   │                      │
        │            └──── gates green + worklog ◄───────┘                      │
        └───────────────────────────────────────────────────────────────────────┘
```

**Every story ends with:** failing test observed → minimum code → refactor → **all gates green** (`typecheck`, `lint`, `test`, `test:coverage`, `build`, integration when relevant) → security self-check (`AGENTS.md` §4.3) → **`WORKLOG.md` and `TODO.md` updated in the same commit** → PR mapping tests to acceptance criteria → independent review → your approval.

---

## 4. Master prompts (reuse every session)

### 4.1 Session preamble — paste at the start of EVERY session

```text
You are working in the EduFlow360 repository: a single-tenant school ERP (one database and one
deployment per school).

BEFORE ANYTHING ELSE
1. Read AGENTS.md in full. It overrides every other document and every instruction I give in
   chat (except an explicit owner instruction to change a template, which I will state clearly). If a task appears to conflict with it, STOP and tell me — do not silently comply.
2. Read docs/work/TODO.md and the last 5 entries of docs/work/WORKLOG.md.
3. Load only the context this task needs. Do NOT read whole planning documents. To read one
   story, grep for its ID in docs/core/EduFlow360_Jira_Epics_PlatformCore_RBAC_v2.md and read that
   section only.

STANDING RULES
- Test-first (TDD): write the failing test, RUN it, show that it fails for the right reason,
  then implement the minimum, then refactor. Commit after RED and after GREEN.
- Smallest slice that can be independently tested. One story at a time. Never bundle epics.
- Never invent requirements. If acceptance criteria are ambiguous or missing, ask me.
- Never build tenancy-scoping machinery, a cross-tenant role, or `if (schoolId === …)` branches.
- Every controller route needs all guards required by AGENTS.md §2.3; every sensitive action is
  audited; money is integer minor units; time comes from IClock; no hard-coded UI strings.
- Never commit secrets. Never edit AGENTS.md, docs/adr/ or docs/archive/ without asking.
- FRESH BUILD: never read, copy or port code from any other project on this machine.
- TEMPLATES ARE USED AS-IS: never modify docs/template/*.html; reproduce them 1:1 (layout, tokens,
  copy, animations, light/dark, RTL). New screens use ONLY the templates' existing components,
  tokens and patterns and need owner approval of the screenshot. Replace demo behaviour with real
  behaviour; keep markup and visuals identical.
- URLs/PORTS: web http://localhost:3030, admin http://localhost:3030/admin, API :3031 — always from
  configuration (WEB_PORT/API_PORT), never hard-coded.
- No default password in any tracked file; default user `superadmin` per AGENTS.md §2.16.
- Update docs/work/WORKLOG.md and docs/work/TODO.md in the SAME commit as the change.

STOP AND ASK IF: a rule conflicts with the task · a requirement is missing (PC-000…PC-006) ·
you are about to deviate from a template · a design decision is not covered by an ADR.

WHEN FINISHED REPORT: (1) what changed, (2) test names mapped to acceptance criteria,
(3) gate results (typecheck/lint/test/coverage/build), (4) deviations or decisions made,
(5) open questions, (6) the next recommended prompt.
```

### 4.2 Story execution template — replace `{…}` and paste

```text
[Paste the session preamble first.]

ROLE: builder (with planner and tester behaviour as described).
STORY: {STORY_ID} — {TITLE}   (Epic {EPIC_ID}, {POINTS} pts, priority {P0|P1|P2})
APPROVAL MODE: {plan-then-wait | proceed-if-plan-matches-guardrails}

STEP 0 — CONTEXT (read-only)
- Read the {STORY_ID} section of the Jira plan (tasks + acceptance criteria).
- Read relevant FR rows in docs/idea-bank/fr-index.md and business rules in business-rules.md.
- If UI: open the matching template screen (docs/template/*.html) and list the exact components/tokens to reuse.
- Inspect existing code in the affected module(s); list what already exists that I must reuse.

STEP 1 — PLAN (≤ 25 lines, then {WAIT for "approved" | continue})
- Files to create/modify, per layer (controller / use-case / domain / infrastructure / dto / web)
- Ports/interfaces involved and adapters needed
- Test list: one test (or table-driven case) per acceptance criterion, plus 3+ negative/boundary cases
- Guards/decorators, audit action keys, i18n keys, RBAC-matrix rows to add
- Risks, deviations from the Jira plan, questions

STEP 2 — RED
- Write the tests only. Run them. Show the failing output and explain why it fails for the right
  reason. Commit: `test({module}): {STORY_ID} failing tests for {short description}`.

STEP 3 — GREEN
- Write the minimum code to pass. No extra features. Commit:
  `feat({module}): implement {STORY_ID} {short description} ({FR-ID if any})`.

STEP 4 — REFACTOR
- Remove duplication, tighten names, keep everything green. Commit if anything changed.

STEP 5 — WIRING & COMPLETENESS
- All required guards on every new route; RBAC permission-matrix fixture rows added.
- @Audited (or IAuditRecorder call) on sensitive actions with mandatory reason where specified.
- Errors go to file log AND DB error log; nothing sensitive logged.
- Web parts (if any): shadcn/ui only, both themes, RTL-safe logical properties, i18n keys added
  to en/ta/si/ar (mark unreviewed translations clearly).
- Docs: update module notes / SSOT entry if you introduced an entity or enum.

STEP 6 — GATES
- Run: pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage && pnpm build
  (+ pnpm test:integration when persistence or guards changed). Report results verbatim.
- Walk the pre-merge self-check in AGENTS.md §4.3 and tick each item explicitly.

STEP 7 — WORKLOG & PR
- Update docs/work/WORKLOG.md (entry fields per AGENTS.md §9) and TODO.md in the final commit.
- Prepare a PR description: story link, summary, AC → test-name table, gate results, deviations,
  screenshots for UI.

DO NOT: modify unrelated files · start the next story · relax a test to make it pass · skip a gate.
```

### 4.3 Independent review prompt — run in a **fresh session** on the PR/branch

```text
[Paste the session preamble first.]

ROLE: reviewer. You did not write this code. Be sceptical and specific. Do not edit files.

REVIEW the diff of branch {BRANCH} against main for story {STORY_ID}.

1. AGENTS.md compliance — check each: §2.1 no tenancy machinery · §2.2 layering (domain imports
   no NestJS/Prisma/React) and no vendor SDK in use-cases · §2.3 guards on every route
   (@RequirePermission / @RequireEntitlement / @Audited or explicit @Public with justification)
   · §2.4 no Date.now()/new Date() in domain/use-cases · §2.5 no float money · §2.7 audit is
   append-only · §2.8 no hard-coded strings, all four locales · §2.15 dual error logging and
   redaction · §3.2 UI rules · §8 conventions.
2. Acceptance criteria — map EVERY criterion of {STORY_ID} to a concrete test; list any
   criterion without a test or with a weak test (e.g. mocks asserting mocks).
3. Security — brute force/enumeration, token handling, IDOR, authorization bypass paths,
   information leakage in errors/logs, secrets in code.
4. Test quality — real behaviour asserted, boundary cases present, no skipped/`only` tests,
   coverage thresholds met for the changed areas.
5. Scope — anything implemented that the story did not ask for; any code that looks copied from
   another project; any modification of a template file or deviation from the template's visuals.

OUTPUT: a table of findings — ID · severity (Blocker/Major/Minor/Nit) · file:line · issue ·
suggested fix — followed by a verdict: APPROVE / APPROVE WITH CHANGES / REQUEST CHANGES.
```

### 4.4 Epic close-out prompt

```text
[Paste the session preamble first.]

ROLE: planner + tester. Close out {EPIC_ID}.
1. List the epic's stories with status; confirm each acceptance criterion has a passing test.
2. Run the full gate suite plus integration and E2E; report verbatim.
3. Verify the epic's success criteria in the Jira plan and SRS FR rows (FR-PLT-…).
4. Update docs/work/PLATFORM_CORE_PLAN.md (progress), TODO.md, WORKLOG.md; update docs/core/SSOT.md
   for any new entity/enum/interface.
5. List deviations, deferred items (with reason and milestone), and technical debt (with tickets).
6. Recommend the next prompt. Do NOT start it.
```

---

## 5. Execution order (sprint map)

Follows the Jira plan's critical path (Auth → RBAC → Licensing → Audit) with the **documented deviations** from §2.2.

| Step | Prompt | Stories | Notes |
|---|---|---|---|
| 0 | **P0** Orientation | — | Read-only |
| 1 | **P1** Decisions → ADRs | — | You approve |
| 2 | **P2** Scaffold | — | No business code |
| 3 | **P3** Quality gates & CI | — | Tools that enforce `AGENTS.md` |
| 4 | **P4** API kernel · **P4W** Web foundation | *pulled forward:* `PLT-501`, `PLT-502` (minimal), `PLT-901` (liveness only) | Walking skeleton |
| 5 | **P5** Epic 01 Auth | `PLT-101`, `102`, `103`, `105`, `107` (+ email adapter from `702`) | + **`107` Superadmin seed**. Defer `104`, `106` (mobile milestone) |
| 6 | **P6** Epic 02 RBAC | `PLT-201`, `202`, `203`, `204`, `205` (matrix grows every story) | |
| 7 | **P7** Epic 04 Audit | `PLT-401`, `402`, `403`, `404` + **auth retrofit** | |
| 8 | **P8** Epic 03 Licensing | `PLT-301`, `302`, `303`, `304`, `305` | Fake activation server |
| 9 | **P9** Epic 05 remainder | `PLT-503`, `504` | |
| 10 | **P10** Epic 06 Registry & Settings | `PLT-601`, `602` | |
| 11 | **P11** Epic 08 Storage | `PLT-801`, `802` | |
| 12 | **P12** Epic 07 Notification router | `PLT-701`, `702` (email only) | Push = M2 |
| 13 | **P13** Epic 09 Health | `PLT-901` (complete), `902`, `903` | |
| 14 | **P14** Milestone-1 close-out | `PLT-205` final, E2E, security review | Milestone-1 gate |
| 15 | **P15** Epic 10 Admin console & template port | `PLT-1001`–`1005` (can start after P4W; finish after P6) | Port 3030, `/admin`, template fidelity |
| 16 | **P16** School Setup shell & profile | `SET-001/002`, `SET-EPIC-01` | Logo as DB blob |
| 17 | **P17** System Configuration & holidays | `SET-EPIC-02`, `SET-EPIC-03` | Student-ID engine, precision |
| 18 | **P18** Event categories, houses, scheduler constraints, readiness | `SET-EPIC-04…06`, `SET-003` | |
| 19 | **P19** Academic structure | `ACD-EPIC-01…06` | Dependency order |
| 20 | **P20** Teacher directory, assignments, promotion | `HRM-EPIC-01`, `ACD-EPIC-07`, `ACD-EPIC-08` | Promotion ⚠ needs `PC-002` |

---

## 6. The prompt pack

> Every prompt below is meant to be pasted **after** the session preamble (§4.1). Prompts P5–P13 tell the agent to run each story through the **story execution template** (§4.2) — paste that template once per story with the values in the table in §7.

### P0 — Orientation and readiness report (read-only)

```text
ROLE: planner (read-only). Do not create or modify any file except appending an entry to
docs/work/WORKLOG.md.

TASK: Produce a "Platform Core Readiness Report" so we can decide whether to start coding.

READ: AGENTS.md; docs/adr/ADR-003*; docs/core/SSOT.md (if present); the Jira plan's epic index,
dependency graph and sprint breakdown only; docs/work/PLATFORM_CORE_PLAN.md; the auth-related
the FR-PLT rows of docs/idea-bank/fr-index.md; the two template files (skim structure only).

OUTPUT (max 2 pages, plain language):
1. The 12 rules in AGENTS.md most relevant to Platform Core, each in one sentence, and one
   example of a violation you will watch for.
2. Story inventory: ID · points · priority · milestone (M1 or deferred to M2) · depends on.
3. Contradictions or gaps between documents (e.g. story counts, ordering conflicts, missing paths).
4. Decisions needed before code, each with your recommended default and why.
5. Which parts of the two templates map to which screens/stories (list only).
6. Questions for me (max 8).

DO NOT propose implementation code, scaffold anything or install anything.
```
**Human gate:** read the report; answer questions; confirm the deviation list in §2.2.

---

### P1 — Turn decisions into ADRs

```text
ROLE: planner. Create ADR files only (docs/adr/). Do not touch code.

TASK: Write concise Architecture Decision Records for the decisions I approved (D-A … D-J from
the prompt pack, plus any from your readiness report). Use the same format as ADR-003.
Suggested numbering: continue after the highest existing ADR.

For each ADR: Context · Decision · Alternatives considered · Consequences · Links to stories
(PLT-…) and AGENTS.md rules. Keep each under one page.

MUST-HAVE ADRs: password hashing (D-A) · token strategy (D-B) · licence signature scheme with
canonical JSON (D-C) · activation-server boundary and fake (D-D) · instance fingerprint (D-E) ·
permission catalogue in code (D-F) · audit durability (D-G) · plus "documented deviations from the
Jira sprint order" (pull-forward of PLT-501/502/901 and the email adapter).

Also update docs/work/TODO.md with the resulting work items. Append a WORKLOG entry.
```
**Human gate:** approve/edit each ADR. Agents must not edit ADRs afterwards without asking.

---

### P2 — Scaffold the monorepo (no business logic)

```text
ROLE: builder. This is infrastructure work; still follow TDD for any script that has logic.

TASK: Scaffold the repository skeleton exactly as AGENTS.md §3 describes.

DELIVER
1. pnpm workspace (+ Turborepo or equivalent) with: apps/api (NestJS, TypeScript strict, Prisma,
   Zod), apps/web (Next.js, TypeScript strict, Tailwind, shadcn/ui initialised — UI only, NO
   server actions), packages/{shared-types,ui-kit,i18n-resources,config}. Do NOT scaffold
   apps/mobile (milestone 2) — add only a README stating that.
2. packages/config: shared tsconfig (strict; alias @/* → ./src/*), ESLint, Prettier.
3. infra/docker/docker-compose.yml: PostgreSQL, Redis, MinIO, and a local mail catcher. Ports and
   credentials come from .env; provide .env.example with PLACEHOLDERS only. .gitignore must exclude
   .env*, build output and generated Prisma clients.
4. The module directory convention from AGENTS.md §3 for apps/api/src/modules/<name> and
   apps/web/src/features/<name> for the Platform Core modules: auth, users, rbac, licensing,
   audit, diagnostics, settings, modules, notifications, storage, health. Empty folders with a
   .gitkeep are fine; no business code.
5. Root scripts: install, dev, lint, typecheck, test, test:coverage, test:integration, test:e2e,
   build, migration:generate, migration:run — every script must actually run (even if with zero tests).
6. README with 5-minute setup instructions.

CONSTRAINTS: no dependencies beyond those named in AGENTS.md §3.1 without asking; no tenancy
scaffolding; no code from any other project (fresh build).

VERIFY (paste output): pnpm install; docker compose up -d and all services healthy; every root
script exits 0 on the empty scaffold.
```
**Human gate:** run the commands yourself on a clean clone.

---

### P3 — Quality gates and CI (the rules become executable)

```text
ROLE: ci + builder. TDD applies to every custom check script (write tests for the script first).

TASK: Make AGENTS.md enforceable by tooling.

DELIVER
1. Jest (or the repo's chosen runner) with coverage thresholds by path, per AGENTS.md §4:
   domain/entities + use-cases 90% line / 85% branch; controllers/dto 70% line; frontend logic
   hooks 80% line. Adapters excluded but must have contract-test folders.
2. ESLint rules: (a) files under **/domain/** and **/use-cases/** may not import @nestjs/*, @prisma/*,
   react, next, bullmq, or any vendor SDK; (b) forbid Date.now(), new Date() and Math.random()
   in domain/use-cases (use IClock / injected id generator); (c) in apps/web forbid raw
   <button>, <input>, <select>, <textarea>, <table>, <dialog>; (d) forbid `any`, @ts-ignore,
   @ts-expect-error; (e) forbid hard-coded user-facing strings in JSX (allow via i18n only).
3. scripts/check-route-guards (TypeScript AST): every NestJS controller route must carry
   @RequirePermission(...) OR an explicit @Public('<reason>'). Anything else fails CI. Also fail
   if a route uses @RequireEntitlement without @RequirePermission. Provide an allowlist file with
   mandatory justification for @Public routes. Write unit tests with fixture controllers.
4. scripts/check-i18n: all four locale files (en, ta, si, ar) have identical key sets; report
   missing keys.
5. scripts/check-worklog: a PR that changes source files must also change docs/work/WORKLOG.md.
6. Secrets scan (e.g. gitleaks) + dependency audit in CI.
7. CI workflow: on PR run typecheck → lint → custom checks → unit+coverage → build → integration
   (containerised Postgres) → secrets scan. E2E on main only.
8. Pre-commit hook (lint-staged) for lint/format; commit-message check for Conventional Commits.

VERIFY: open a dummy PR containing (a) an unguarded route, (b) a `new Date()` in a use-case,
(c) a raw <button>, (d) a missing i18n key. CI must FAIL for each. Then fix and show CI green.
```
**Human gate:** review the failing-then-passing CI evidence. This is the most valuable safety net in the project.

---

### P4 — API kernel and walking skeleton

```text
ROLE: builder. Strict TDD. Architecture per AGENTS.md §2.2 and §3.

GOAL: the smallest end-to-end skeleton that proves the architecture, before any feature story.

DELIVER (each with tests first)
1. IClock (SystemClock + FakeClock for tests). Injectable everywhere; ESLint already forbids
   direct Date usage.
2. Domain error hierarchy (ValidationError, NotFoundError, ForbiddenError, ConflictError,
   UnauthenticatedError, DomainInvariantError) and one global exception filter that maps them to
   HTTP responses with a stable error-code contract and NEVER leaks stack traces to clients.
3. Config module: Zod-validated environment; start-up FAILS FAST naming any missing variable.
4. Persistence: Prisma setup, base migration, a Testcontainers-based integration harness that
   gives each test file an isolated schema. `schoolId` is metadata only — do NOT build any scoping.
5. Logging (PLT-501/502 minimal, pulled forward): structured JSON logger, correlation ID
   middleware using AsyncLocalStorage (accept incoming header, generate otherwise, return it in
   the response), redaction of passwords, tokens, Authorization headers, card-number-like strings,
   secrets and biometric templates. Table-driven tests for redaction.
6. Dual error logging: every ERROR/CRITICAL goes to the file logger AND an `ErrorLogRepository`
   (port + Prisma implementation, table `error_logs`). A test must prove BOTH sinks receive it and
   that neither contains sensitive data. (Rotation is PLT-503 later.)
7. Decorators (metadata only for now): @Public(reason), @RequirePermission(key),
   @RequireEntitlement(key), @Audited(actionKey, { reasonRequired? }). Plus a GLOBAL guard that is
   FAIL-CLOSED: a route without @Public or @RequirePermission is rejected (test it).
8. Health liveness endpoint (PLT-901 partial) marked @Public('liveness probe').
9. A seed script skeleton and a `pnpm --filter api dev` boot that works against docker compose.

CONSTRAINTS: no auth logic yet; no feature endpoints; no copied code.

ACCEPTANCE: unit + integration tests green; kernel coverage ≥ thresholds; the CI checks from P3
pass; booting the app and calling GET /health/liveness returns 200 with a correlation ID header;
calling a deliberately unguarded test route is rejected.
```

### P4W — Web foundation

```text
ROLE: builder (frontend). TDD for logic hooks and utilities; component smoke tests with React
Testing Library. UI rules: AGENTS.md §3.2.

DELIVER
1. App shell using shadcn/ui: responsive layout (Sheet drawer sidebar on mobile), no feature pages.
2. Theming: CSS-variable tokens extracted VERBATIM from docs/template (no value changes), light + dark, a toggle,
   `data-theme` set before first paint, `prefers-color-scheme` honoured when nothing is saved.
3. i18n: bootstrap with English, Tamil, Sinhala, Arabic resource files in packages/i18n-resources;
   move the template's dictionary VERBATIM (placeholder marketing copy such as "Trusted by 200+ schools"
   is kept and listed in TODO.md as owner decision pending). RTL: set `dir` for
   Arabic; use logical properties only. A language switcher.
4. Typed API client that sends/receives the correlation ID and maps the error-code contract.
5. Login-independent layout only; placeholder 403/404/error pages using i18n keys.
6. Tests: theme toggle persistence, locale switching + dir attribute, API client error mapping;
   Playwright smoke test for load, theme toggle and Arabic RTL.

VERIFY: run the app in both themes and all four languages; paste screenshots or a short checklist.
```
**Human gate (after P4 + P4W):** boot everything, try the deliberately unguarded route, toggle theme/language, read the redaction tests.

---

### P5 — Epic 01: Authentication & Session Management

```text
[Story execution template §4.2 per story — run each story in a separate session, in this order.]

EPIC CONTEXT: PLT-EPIC-01. Stories in order: PLT-101 → PLT-102 → PLT-103 → PLT-105 → PLT-107.
DEFERRED (milestone 2): PLT-104 OTP, PLT-106 jailbreak/root detection — do NOT build.
PULL FORWARD: the email adapter half of PLT-702 (behind INotificationChannelAdapter) so PLT-105
can send reset mail. Full router is P12.

FRESH BUILD: design credential verification, password hashing, reset and session handling from
the acceptance criteria — no code from any other project. Use well-known libraries (e.g. argon2)
behind our ports.

DESIGN CONSTRAINTS (all stories)
- Ports: IPasswordHasher, ITokenService, IUserRepository, ISessionRepository, IRefreshTokenRepository,
  IAuditRecorder (interim adapter — P7 retrofits real auditing), INotificationChannelAdapter.
- Public routes are explicit @Public('<reason>'); everything else is guarded.
- Login errors are generic (never reveal which field failed). Lockout: 5 failed attempts within
  10 minutes locks the account for a configurable cooldown; respond 429; use IClock in tests.
- Refresh tokens are single-use with family reuse detection; reuse revokes the whole family.
- Passwords/tokens never appear in logs or responses. Reset tokens are single-use, time-limited;
  a successful reset invalidates ALL sessions.
- Web: login, forgot-password, reset-password pages with shadcn/ui, i18n in 4 locales, RTL-safe.
  NO social-login buttons (not in this milestone). NEVER implement lockout on the client.

PER-STORY KEY TESTS: see §7 quick reference. FIRST STORY (PLT-101) uses plan-then-wait; later
stories may proceed if the plan matches these guardrails.

AFTER PLT-105: implement PLT-107 (seed default `superadmin`, AGENTS.md §2.16): idempotent seed,
SEED_SUPERADMIN_PASSWORD from .env (dev fallback = random, printed once; fail fast elsewhere),
forced first-login password change, undeletable/undemotable/last-active protection, audited.
Never write a password in any tracked file or test fixture (generate values in test setup).
```
**Human gate:** try registration-less login with a seeded test user, trigger lockout with 5 bad passwords, use reset via the mail catcher, inspect logs for leaks.

---

### P6 — Epic 02: Dynamic RBAC & Policy Engine

```text
[Story execution template §4.2 per story — order: PLT-201 → PLT-202 → PLT-203 → PLT-204 → PLT-205.]

EPIC CONTEXT: PLT-EPIC-02 (critical path). Decision D-F: permissions are declared IN CODE
(MODULE_ACTION keys) and synced to the DB on deploy.

DESIGN CONSTRAINTS
- PLT-201: Role, Permission, RolePermission; immutable system roles (`SUPERADMIN` and
  School Admin) cannot be deleted or stripped of core permissions — enforced SERVER-SIDE with
  tests that bypass the UI. Custom roles are allowed by edition (read entitlement later).
- PLT-202: replace the P4 stub guard with real resolution: user → role(s) → permissions, cached
  behind IPermissionCache (Redis) with invalidation on role change; <5 ms target with cache.
  Role change must also force re-authentication (integrate with PLT-103). The static route check
  from P3 stays authoritative (fail-closed).
- PLT-203: IOwnershipPolicy + registry. Build the ENGINE against abstract ports (e.g.
  IClassAssignmentFacts, IGuardianLinkFacts) with fake implementations in tests. Do NOT create
  Student/Class/Teacher entities in Platform Core. Denials distinguish role-denial from
  ownership-denial in logs (not in client responses).
- PLT-204: usePermissions(), <PermissionGate>, route-level guard redirecting to a 403 page. Comment
  clearly that this is UX only.
- PLT-205: the RBAC permission-matrix fixture (Role × Module × Action → Allow/Deny) as a data file
  plus a parametrised integration suite that calls the real API directly (bypassing the UI). Design
  it so EVERY future route adds a row; wire check-route-guards to require a matrix row for each
  @RequirePermission key.

PER-STORY KEY TESTS: see §7. Security-critical: run the reviewer prompt (§4.3) on PLT-202 and
PLT-203 with a fresh session before merging.
```
**Human gate:** you review the matrix file line by line — it *is* the authorization policy.

---

### P7 — Epic 04: Immutable Audit Logging (+ auth retrofit)

```text
[Story execution template §4.2 per story — order: PLT-401 → PLT-402 → auth retrofit → PLT-403 → PLT-404.]

EPIC CONTEXT: PLT-EPIC-04. Decision D-G: sensitive-action audit rows are written in the SAME DB
transaction as the business change. Async queueing only for non-critical, high-volume events.

DESIGN CONSTRAINTS
- PLT-401: audit_records schema per Master Plan §6.1; repository exposes ONLY create() and
  query(). A migration REVOKES UPDATE and DELETE on the table from the application DB role
  (separate migration role). Integration test connects as the app role and proves UPDATE/DELETE
  FAIL at the database level. Add a lint/test that fails if anyone adds update/delete to the
  audit repository.
- PLT-402: @Audited interceptor captures actor, role, IP/device, before/after snapshots and
  reason; reasonRequired actions reject with 400 when reason is missing. Replace the interim
  IAuditRecorder adapter from P5.
- AUTH RETROFIT (mandatory): audit login success, login failure, lockout, logout/session revoke,
  refresh-reuse detection, password reset request/confirm, role change/forced logout. Write the
  tests FIRST for each event.
- PLT-403: query endpoint (indexed filters: date, module, actor, action) + admin UI with JSON diff
  and CSV export; permission AUDIT_LOG_VIEW; add matrix rows.
- PLT-404: retention config per category; archival job that NEVER deletes finance/security records
  inside their minimum retention window (test with FakeClock).

NEVER: expose any endpoint that edits or deletes audit rows, even for Superadmin.
```
**Human gate:** connect to the DB with the app role and try to UPDATE an audit row yourself.

---

### P8 — Epic 03: Licensing & Entitlement Enforcement

```text
[Story execution template §4.2 per story — order: PLT-301 → PLT-302 → PLT-303 → PLT-304 → PLT-305.]

EPIC CONTEXT: PLT-EPIC-03. Decisions D-C (ECDSA P-256 over canonical JSON), D-D (activation
server is external: build ILicenceActivationClient + OpenAPI contract + local FAKE server),
D-E (stable install ID).

DESIGN CONSTRAINTS
- PLT-301: Zod schema for the certificate payload (Master Plan §4.2). Signature verification over a
  CANONICAL, deterministic serialisation (key ordering, no whitespace ambiguity) — write tests
  that prove reordering keys does not break a valid signature and that flipping any byte breaks it.
  Tampered → locked maintenance mode (only activation + health reachable), never a crash or a
  silent bypass. Expired is distinct from invalid. Cache validated entitlements. Consider
  detecting system-clock rollback by persisting last-seen time (propose in the plan).
- PLT-302: EntitlementGuard composes AFTER PermissionGuard. Limit enforcement is a domain service
  `assertWithinLimit(limitKey, currentCount)` that OTHER modules call; Platform Core does not count
  students itself. Errors are clear and actionable (not generic 500).
- PLT-303/304: online activation through the port; offline flow generates a request token and
  imports a .lic file with IDENTICAL validation. Encrypt the stored certificate at rest.
- PLT-305: grace period (default 14 days) using IClock; background revalidation job (BullMQ);
  admin banner API; full lock only after the grace window.
- No hard-coded edition names in guards — gate by feature keys from the certificate.

SECURITY NOTE: the private signing key never enters this repository, tests included (generate
throwaway keypairs inside test setup).
```
**Human gate:** tamper with a certificate in staging and confirm the app degrades to locked mode.

---

### P9 — Epic 05 remainder: rotation and diagnostics viewer

```text
[Story execution template §4.2 — PLT-503, then PLT-504 (P2 — do only if time allows).]

PLT-503: 25 MB active log with 3 historical files (app.log, .1, .2, .3); the oldest is purged on
the next rotation. Prove with a test that writes past the cap under a fake filesystem or temp
directory. ERROR/CRITICAL remain queryable in the DB after file rotation removes them.
PLT-504: GET /diagnostics/errors with filters (severity, date range, correlation ID, module) and
an admin UI with stack-trace expansion; permission-gated; add matrix rows; redaction still applies.
```

### P10 — Epic 06: Module Registry & System Settings

```text
[Story execution template §4.2 — PLT-601 then PLT-602.]

PLT-601: registry = licence entitlement ∩ admin toggle. GET /modules returns the resolved active
list. Disabling a module removes it from navigation AND blocks its API routes (composes with
EntitlementGuard). Refuse to disable a module that another ENABLED module depends on (declare
dependencies in code; test the graph). Web navigation renders from this list.
PLT-602: typed key-value/JSONB settings with schema-validated accessors, cached, changes take
effect without restart, and every change is audited. Establish the categories in the Setup
Workflow §7 (profile, locale, currency/rounding, security policy, notification defaults,
retention, storage limits). Modules read settings ONLY through this service — add a lint/test that
flags hard-coded school-specific constants.
```

### P11 — Epic 08: Storage & File Manager

```text
[Story execution template §4.2 — PLT-801 then PLT-802.]

PLT-801: IStorageAdapter with S3-compatible implementation (MinIO in dev). Private buckets only;
signed, time-limited URLs; file-scope tagging (student-document, homework-submission, id-photo,
receipt…). Access decisions go through an `IFileAccessPolicy` that reuses RBAC + ownership
(a homework file readable only by the submitter, their teacher and their guardian — implemented
against fakes until those modules exist). A malware-scan hook as a PORT with a no-op adapter.
No module may import an S3 SDK directly (lint rule).
PLT-802: per-scope max size and allowed MIME types (validated by content sniffing, not just
extension), per-school storage quota reading licence limits; reject BEFORE any write occurs.
```

### P12 — Epic 07: Multi-Channel Notification Router

```text
[Story execution template §4.2 — PLT-701 then PLT-702 (EMAIL half only).]

PLT-701: NotificationEvent (type, recipient, payload, urgency NORMAL|EMERGENCY);
INotificationChannelAdapter; per-user preference resolution with EMAIL as the default channel.
SMS and WhatsApp are BILLED PER MESSAGE: implement per-recipient rate limiting and a digest hook
now; provide vendor-agnostic port stubs only (ISmsAdapter — provider undecided — and WhatsApp).
EMERGENCY events bypass digesting and rate limits and use all configured channels. BullMQ for
delivery with retry/backoff.
PLT-702: production-quality email adapter + delivery-status tracking (sent/delivered/failed).
The PUSH adapter is milestone 2 — leave a documented port only.
Refactor the interim email sending from P5 to go through the router (tests must stay green).
```

### P13 — Epic 09: Health, Metrics, Admin Status

```text
[Story execution template §4.2 — PLT-901 (complete) → PLT-902 → PLT-903.]

PLT-901: /health/liveness and /health/readiness (DB, Redis, licence NOT locked → 503 when not ready).
PLT-902: Prometheus-compatible metrics for request latency and error rate; a documented dashboard
definition for the attendance-capture route's p50/p95/p99 (route arrives in a later milestone —
provide the instrumentation hook and a synthetic test route).
PLT-903: Admin system-status widget (DB, Redis, licence state and grace countdown, last backup
time) using shadcn/ui, i18n ×4, both themes, RTL.
```

### P14 — Milestone close-out (Platform Core & RBAC)

```text
ROLE: core (orchestrator) + tester + reviewer (use separate sessions for each role).

1. tester: run the FULL gate suite, integration, and E2E (Playwright): login → lockout → reset;
   role-restricted access denied; unlicensed feature blocked at API; audit row visible in viewer;
   locale switch + RTL; theme switch.
2. tester: finalise PLT-205 — verify EVERY @RequirePermission key in code has a matrix row and a
   test; verify no unguarded routes; verify audit UPDATE/DELETE impossible.
3. reviewer (fresh session): whole-milestone security review focused on: brute force, token
   handling, IDOR, RBAC bypass, licence tampering, log leakage, secret hygiene, dependency audit.
4. core: reconcile docs — PLATFORM_CORE_PLAN.md, SSOT.md, ARCHITECTURE.md, ADRs, TODO/WORKLOG;
   list deferred items (PLT-104, PLT-106, push adapter, proposed social login/MFA
   stories) and known debt.
5. core: produce a demo script (10 minutes) and a "how to build the next module" checklist that
   references the kernel, guards, audit, settings and registry.
6. Tag the release candidate. Do NOT start the next milestone.

OUTPUT: milestone report with gate evidence, open risks, and a recommendation for the next
milestone (note: Attendance/Leave/Grading need PC-000/001/002 designs first).
```
**Human gate = Milestone M2 "Foundation Complete".**

### P15 — Epic 10: Admin console shell, template port, dev environment (port 3030)

```text
[Story execution template §4.2 per story — order: PLT-1001 → PLT-1003 → PLT-1004 → PLT-1002 → PLT-1005.]

EPIC CONTEXT: PLT-EPIC-10. Web on http://localhost:3030 (WEB_PORT), admin at /admin, API on :3031 (API_PORT).
TEMPLATES (AGENTS.md §2.17): docs/template/EduFlow360_Template_Landing_Auth.html and
EduFlow360_Template_Admin_Dashboard.html are READ-ONLY. Reproduce them 1:1 — layout, tokens, copy,
animations, theme and language behaviour, RTL, breakpoints. Replace only demo BEHAVIOUR with real
services. Placeholder marketing copy stays as-is and is listed in TODO.md as "owner decision pending".
Do not restyle, rename, re-order or simplify anything. If something cannot be matched exactly: STOP and ask.

DESIGN CONSTRAINTS
- PLT-1003 first: checksum guard for template files in CI; verbatim token/i18n extraction; baseline screenshots
  (light/dark × LTR/RTL) generated from the template HTML itself.
- PLT-1004: lockout is server-side only (429); social buttons render as designed and show "not configured".
- PLT-1002: `next` redirect must be same-origin relative only; `/admin/**` needs ADMIN_CONSOLE_ACCESS (UI + API).
- PLT-1005: menu from a typed MENU config filtered by permission + module registry. The ONLY authorised menu
  additions are "School Setup" and "Academic" (record as "Template change authorised by owner" in WORKLOG.md).
- No hard-coded localhost URLs or ports in source (CI check).
```
**Human gate:** compare the running app to the template side by side in both themes and Arabic; read the Playwright diffs.

---

### P16 — School Setup shell, settings reader, profile & logo

```text
[Story execution template §4.2 per story — order: SET-001 → SET-002 → SET-101 → SET-102 → SET-103.]

SPEC: Master Plan v5.3 §5A; Jira plan EduFlow360_Jira_Epics_SchoolSetup_Academic_v1.md.
UI RULE: School Setup screens are NOT in the templates. Compose them ONLY from the templates' existing
patterns (Settings-style tabs, cards, fields, buttons, pills, toggles, table rows). Show me a screenshot
and wait for approval before merging a new screen pattern.
CONSTRAINTS
- Profile and system configuration are SINGLETONS (database-enforced single row); other modules read them only via ISchoolSettingsReader.
- Logo: separate `school_logo` table (bytea), PNG/JPEG/WebP only, max 5 MB, magic-byte + dimension checks, SVG rejected,
  public GET with ETag/Cache-Control/nosniff; never loaded by profile reads.
- Every save @Audited; permissions SET_*; matrix rows added; strings in en/ta/si/ar; RTL/dark verified.
```

### P17 — System Configuration and Holidays

```text
[Story execution template §4.2 per story — SET-201 → SET-202 → SET-203 → SET-204 → SET-205 → SET-206, then SET-301 → SET-302 → SET-303.]

KEY RISKS TO TEST
- Student ID engine: table-driven tests + 200-way parallel generation (no duplicates); pattern change never rewrites existing IDs.
- Locks: school code after first ID; currency/precision after first financial posting; attendance type after first attendance
  record (use fakes behind ports — those modules do not exist yet).
- Money: precision = minor-unit scale; no floating-point money; formatMoney identical on API and web.
- Holidays: IHolidayCalendar across weekend-spanning holidays, 5/6-day weeks, different week-start days, school timezone (FakeClock).
OPEN OWNER DECISIONS (ask, do not guess): default/enabled languages field; working-day checkboxes; holiday type/applies-to.
```

### P18 — Event categories, houses, scheduler constraints, readiness

```text
[Story execution template §4.2 per story — SET-401/402, SET-501/502, SET-601 → 602 → 603, SET-003.]

CONSTRAINTS: soft-delete only for referenced records; hex colour validation; ITimetableConstraintPolicy is a PURE domain
service with boundary tests (exactly at limit, limit+1, consecutive blocks across breaks).
OPEN OWNER DECISION (ask first): "Max Teacher Hours/Week" vs "Max Periods Per Teacher/Week" — keep both?
Readiness checklist (SET-003) must list concrete gaps (e.g. "Grade 5-A has no class teacher").
```

### P19 — Academic structure (calendar → classes)

```text
[Story execution template §4.2 per story — order: ACD-101/102 → 103/104 → 201/202 → 301–305 → 401–404 → 501/502 → 601–603.]

DEPENDENCY ORDER IS A RULE: Calendar → Terms → Syllabus → Academic Levels → Sections → Grades → Class Medium → Subjects → Classes.
TERMINOLOGY (AGENTS.md §2.19): UI says "Academic Sections (Academic Level)"; code says AcademicLevel. Class = SchoolClass.
CONSTRAINTS
- Exactly one Active academic year; terms inside the year with no overlaps; closed years read-only (test with FakeClock).
- PeriodScheduleCalculator is pure and table-driven (no breaks, break after last period, zero-length break, exact fit, overflow).
- Unique codes; soft-delete of referenced records; subject unique on (code, grade, syllabus).
OPEN OWNER DECISIONS (ask first): subject model (one row per grade vs master+mapping); add Section + Academic Year to Class;
Rooms entity vs free-text room number; seed default mediums/categories.
```

### P20 — Teacher directory, assignments, promotion

```text
[Story execution template §4.2 per story — HRM-101 → 102 → 103, ACD-701 → 702 → 703 → 704 → 705, then ACD-801 → 802 → 803 → 804.]

CONSTRAINTS
- HRM-EPIC-01 is a MINIMAL prerequisite (teachers/staff directory); do not build the full HR module.
- Subject→Class: subject's grade must equal class's grade. Subject→Teacher: warn (not block) on load using ITimetableConstraintPolicy.
- Publish assignments as ownership facts (IClassAssignmentFacts) so teachers can edit grades only for assigned classes (PLT-203).
- Promotion: dry-run writes nothing; commit is transactional and idempotent; overrides need a reason and are audited;
  prior-year records are never overwritten. ⚠ Provisional until grading design PC-002 — mark clearly in code and UI.
Run the security reviewer prompt (§4.3) on ACD-702 and ACD-802.
```

---

## 7. Per-story quick reference (Platform Core — original 33 stories + PLT-107 + Epic 10)

Use with the story execution template (§4.2). "Key tests / traps" tells you what the agent most often gets wrong.

| Story | Title | Pts | Prio | Status | Key tests / traps |
|---|---|---|---|---|---|
| **PLT-101** | JWT login | 8 | P0 | M1 | Generic 401; lockout at 5 fails/10 min → 429 with FakeClock; password hash never returned/logged; timing-safe compare; user-enumeration test |
| **PLT-102** | Refresh & rotation | 8 | P0 | M1 | Reuse of rotated token revokes the family; expiry enforced server-side; concurrent refresh race |
| **PLT-103** | Session management, forced logout | 5 | P0 | M1 | Revocation effective on next request (not next refresh); role change forces re-auth; only self/Admin may list/revoke |
| **PLT-104** | OTP login | 5 | P1 | **M2** | Deferred — do not build |
| **PLT-105** | Password reset | 5 | P0 | M1 | Single-use, expiring token; success invalidates ALL sessions; no account enumeration on request endpoint |
| **PLT-106** | Root/jailbreak detection | 3 | P2 | **M2** | Deferred — do not build |
| **PLT-107** | Seed default Superadmin | 5 | P0 | M1 | Idempotent seed (run twice); fails fast without secret outside dev; forced password change; last-Superadmin protections; password never in logs/audit/tests |
| **PLT-201** | Role & permission model | 8 | P0 | M1 | System roles undeletable via API (not just UI); catalogue sync idempotent; role-permission edit audited |
| **PLT-202** | Permission guard | 8 | P0 | M1 | Fail-closed default; cache invalidation on role change; CI check catches unguarded routes |
| **PLT-203** | Ownership policy engine | 13 | P0 | M1 | Engine only — fakes for facts; role-denial vs ownership-denial distinguishable in logs; pluggable without editing the guard |
| **PLT-204** | Frontend permission UI | 5 | P0 | M1 | UX only; direct URL to restricted page → 403 page; comments state API is the boundary |
| **PLT-205** | Permission-matrix QA | 8 | P0 | M1 | Data-driven matrix hits the real API; every permission key has a row; negative direct-API tests |
| **PLT-301** | Licence validator | 8 | P0 | M1 | Canonical JSON; bit-flip fails; expired ≠ invalid; locked mode not crash; throwaway keys only |
| **PLT-302** | Entitlement enforcer | 8 | P0 | M1 | Guard composes after permission; gate by feature key not edition name; actionable limit errors |
| **PLT-303** | Online activation | 5 | P0 | M1 | Port + fake server; cert encrypted at rest; activation without restart (or clear message) |
| **PLT-304** | Offline activation | 5 | P1 | M1 | Same validation as online; request token bound to install ID |
| **PLT-305** | Grace period | 3 | P1 | M1 | IClock-driven countdown; banner API; lock only after window |
| **PLT-401** | Append-only audit schema | 5 | P0 | M1 | DB-level UPDATE/DELETE revoked and proven; no update/delete methods exist |
| **PLT-402** | Audit interceptor | 8 | P0 | M1 | Same-transaction write (D-G); reasonRequired → 400; exactly-once capture; before/after diff |
| **PLT-403** | Audit viewer | 5 | P1 | M1 | Indexed filters; CSV export permission-gated; JSON diff UI |
| **PLT-404** | Retention | 3 | P2 | M1 | Never deletes finance/security within window (FakeClock); archives, not deletes |
| **PLT-501** | Structured logger | 5 | P1 | M1 (**pulled fwd**) | Correlation ID on every line; header passthrough |
| **PLT-502** | Redaction | 5 | P0 | M1 (**pulled fwd**) | Table-driven: password, Authorization, card-like numbers, secrets, biometric templates |
| **PLT-503** | Log rotation | 3 | P1 | M1 | 25 MB × 3 historical; DB retains ERROR/CRITICAL |
| **PLT-504** | Diagnostics viewer | 5 | P2 | M1 | Filters incl. correlation ID; redaction still holds |
| **PLT-601** | Module registry | 8 | P0 | M1 | licence ∩ toggle; dependency-aware disable; API blocked not just hidden |
| **PLT-602** | Settings engine | 8 | P0 | M1 | Typed accessors; no restart; audited; lint flags hard-coded school values |
| **PLT-701** | Notification router | 8 | P1 | M1 | Email default; emergency bypass; rate limits/digest hooks; vendor-agnostic SMS port |
| **PLT-702** | Email & push adapters | 5 | P0 | M1 email · **M2 push** | Delivery status tracked; push port only |
| **PLT-801** | Storage abstraction | 8 | P1 | M1 | Signed URLs; access follows RBAC + ownership; no direct SDK imports |
| **PLT-802** | File validation & quota | 5 | P1 | M1 | MIME sniffing; reject before write; quota from licence |
| **PLT-901** | Health endpoints | 3 | P2 | M1 | Readiness 503 on DB/Redis down or licence locked |
| **PLT-902** | Metrics | 5 | P2 | M1 | Prometheus format; p50/p95/p99 hook |
| **PLT-1001–1005** | Admin console (port 3030, `/admin`, template port) | 29 | P0 | M1 | No hard-coded URLs; `next` open-redirect protection; template checksum guard; visual regression in 4 combos; lockout server-side only |
| **PLT-903** | Admin status page | 5 | P2 | M1 | i18n ×4, both themes, RTL; simulated failure shown |

---

## 8. Milestone Definition of Done (Platform Core & RBAC)

- [ ] All M1 stories merged with tests; deferred stories listed with reasons (PLT-104, PLT-106, push half of PLT-702)
- [ ] `typecheck`, `lint`, custom checks, `test`, `test:coverage` (thresholds), `build`, `test:integration`, `test:e2e` all green in CI
- [ ] **No unguarded route** (CI-enforced); every permission key has a matrix row and test
- [ ] Audit table cannot be updated/deleted by the application role (proven)
- [ ] Every auth, RBAC, licensing, settings and role-change action is audited
- [ ] Licence tamper → locked mode; grace period behaviour proven
- [ ] Errors reach **both** file and DB logs; redaction proven
- [ ] Settings/registry/storage/notification ports usable by the next module
- [ ] UI: shadcn only, light/dark, 4 locales, RTL verified
- [ ] ADRs, SSOT, PLATFORM_CORE_PLAN, WORKLOG, TODO current
- [ ] Independent security review complete; no open Blocker/Major
- [ ] Demo and "how to build the next module" checklist delivered

---

## 9. Anti-patterns and recovery

| Symptom | Likely cause | Recovery prompt |
|---|---|---|
| Agent starts building tenancy filters, `schoolId` scoping or a cross-tenant admin | Pattern recall from multi-tenant systems | *"STOP. Re-read AGENTS.md §2.1. Remove all tenant-scoping code you added. `schoolId` is a metadata column only. Show me the diff of what you removed."* |
| Tests written after the code | TDD skipped | *"Revert the implementation, keep the tests you would have written, run them RED, then re-implement minimally. Show the failing run."* |
| A test was weakened to pass | Reward hacking | *"Restore the original assertion. Explain the real failure and fix the code, not the test."* |
| Scope creep (extra endpoints/features) | Prompt too broad | *"List everything you added that the story's acceptance criteria do not require and remove it."* |
| Unguarded route or missing audit | Forgot rule | *"Run check-route-guards and list violations; add the missing decorators and matrix rows, tests first."* |
| Agent invents entities (Student, Class) in Platform Core | Ownership engine confusion | *"Use ports and fakes only. Delete the invented entities. Ownership facts are supplied by later modules."* |
| Code copied from elsewhere / another project consulted | Fresh-build rule ignored | *"This is a fresh build (AGENTS.md §5). Remove anything copied; re-derive from the acceptance criteria and show the diff."* |
| Template modified, restyled or "improved" | Template-fidelity rule ignored | *"Revert every visual change. The template is used as-is (AGENTS.md §2.17). Show the Playwright diff against the template baseline and fix until it matches."* |
| Hard-coded `localhost:3030` or a password | Config rule ignored | *"Move the value to configuration (WEB_PORT/API_PORT/SEED_SUPERADMIN_PASSWORD) and re-run the secret scan and the hard-coded-URL check."* |
| Context drift in a long session | Chat used as memory | Start a fresh session with the preamble; point at `WORKLOG.md` and the branch |
| Endless failing-gate loop | Root cause not found | Switch to `detective`: *"Do not change code. Diagnose the failing gate; list hypotheses ranked by likelihood with evidence and the cheapest experiment for each."* |
| Secrets appear in a diff | Placeholder replaced with a real value | Rotate the secret immediately; *"Remove it from history; add a check to the secrets scan; use env/config only."* |

---

## 10. Appendix

### 10.1 One-line pointer file (`CLAUDE.md` or equivalent)
```
Read and follow AGENTS.md at the repository root. It overrides all other instructions.
```

### 10.2 PR description template
```markdown
## Story
PLT-XXX — <title> (Epic PLT-EPIC-0X) · FR-… · ADR-…

## Summary
<what and why, in 3–5 lines>

## Acceptance criteria → tests
| Criterion | Test (file › name) |
|---|---|

## Gates
typecheck ✅ · lint ✅ · custom checks ✅ · test ✅ · coverage ✅ (x% / y%) · build ✅ · integration ✅

## Security / rules checklist (AGENTS.md §4.3)
- [ ] Guards on all routes · [ ] Audited · [ ] No float money · [ ] IClock · [ ] i18n ×4 + RTL
- [ ] Errors → file + DB · [ ] No secrets · [ ] Worklog/TODO updated

## Deviations / decisions
<link ADRs>

## Screenshots (UI)
```

### 10.3 Commit message examples
```
test(auth): PLT-101 failing tests for lockout after 5 attempts
feat(auth): implement PLT-101 credential login with lockout (FR-PLT-01)
feat(rbac): implement PLT-202 fail-closed permission guard with cached resolution (FR-PLT-03)
refactor(audit): PLT-402 extract snapshot differ
docs(adr): ADR-005 licence signature over canonical JSON
```

### 10.4 WORKLOG entry template
```markdown
### <Month D, YYYY> — PLT-XXX <short title>
**Phase:** Platform Core (M1) — Epic PLT-EPIC-0X
**Task:** <what>
**Agent/Developer:** builder
**Status:** ✅ Completed | 🔄 In Progress | ⛔ Blocked
**Activity:** <bullets>
**Files Changed:** Created … · Modified …
**Decisions Made:** <decision — rationale — ADR link>
**Next Steps:** <bullets>
**Quality:** Tests <n> · coverage <x%> · lint ✅ · build ✅ · issues <…>
```

### 10.5 Handy context-loading commands for the agent
```bash
# read exactly one story from the Jira plan
grep -n "PLT-101" docs/core/EduFlow360_Jira_Epics_PlatformCore_RBAC_v2.md
sed -n '<start>,<end>p' docs/core/EduFlow360_Jira_Epics_PlatformCore_RBAC_v2.md

# related requirements
grep -n "FR-PLT" docs/idea-bank/fr-index.md
grep -n -i "lockout\|refresh\|session" docs/idea-bank/business-rules.md
```

### 10.6 Your daily human-gate routine (15 minutes)
1. Read the agent's final report and the PR description.
2. Open the RED commit — do the tests actually describe the acceptance criteria?
3. Run the gates yourself once per epic (not every story).
4. Try the feature by hand as an attacker (wrong password ×5, wrong role, tampered input).
5. Skim `WORKLOG.md` for honesty about deviations.
6. Approve, or send back with a specific correction using the recovery prompts.

---

*End of EduFlow360 — Agentic Development Prompt Pack: Platform Core & RBAC v1.0*
