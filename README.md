# EduFlow360

**Single-tenant school ERP.** One PostgreSQL database and one application deployment **per school** (`AGENTS.md` §2.1, `ADR-003`).

> **Before you write any code, read [`AGENTS.md`](AGENTS.md).** It is the operating contract and it overrides every other document in this repository. Current state: [`docs/core/SSOT.md`](docs/core/SSOT.md). Execution order: `docs/core/EduFlow_Agentic_Prompt_Pack_PlatformCore_v1.md` §5.

**Status: milestone 1 (Platform Core & RBAC) in progress.** `PLT-101` (5 routes) and `PLT-107` shipped; `PLT-EPIC-02` is ~75% built. 1,401 unit + 235 integration + 37 e2e tests pass (measured 2026-10-05). The ERD is written and generated from one source, so it cannot drift from the Prisma schema.

**Scope.** Milestone 1 is the platform: auth, RBAC, licensing, audit, diagnostics, module registry, notification router, storage, health, and the admin console. School Setup and Academic Setup are specified and decomposed but not built. `apps/mobile` is milestone 2 (`ADR-005`) and is not scaffolded.

---

## Requirements

| Need | Version | Notes |
|---|---|---|
| **Node** | **≥ 22** (`.nvmrc` pins 22) | You may be on 26; the floor is 22 so CI and laptops agree |
| **pnpm** | 11.x | `npm i -g pnpm`. Use pnpm to *install*; either runner works to *run scripts* |
| **Docker Desktop** | optional | See "Running without Docker" — not required at the current stage |

`corepack` is **not required** and is broken on some Windows Node installs. Install pnpm globally instead.

---

## Setup

```bash
pnpm install
cp .env.example .env        # Windows: copy .env.example .env
pnpm dev
```

`pnpm dev` starts both apps. The API deliberately boots with **persistence disabled** until a `DATABASE_URL` is configured — see the banner it prints and *Why the API boots without a database* below.

| App | URL |
|---|---|
| Web | http://localhost:3500 — and `/en` `/ta` `/si` `/ar` for each locale |
| API | http://localhost:3001 |
| MinIO console *(with Docker)* | http://localhost:9001 |
| Mailpit *(with Docker)* | http://localhost:8025 |

**Ports are configuration, never hard-coded** (`AGENTS.md` §2.14). `WEB_PORT` is 3500 in
`apps/web/src/lib/web-port.ts` and `PORT` defaults to 3001 in `apps/api/src/config/env.ts`;
`web-port.spec.ts` asserts the value, so it cannot drift silently. Some planning documents
still say 3030/3031 — **those are stale; the code and its test are the authority.**

---

## Running without Docker

**This is the supported path on a machine with no Docker, and the application code is identical either way.** The app reads `DATABASE_URL`, `REDIS_URL` and `STORAGE_ENDPOINT` from the environment; `infra/docker/docker-compose.yml` is one convenient way to supply them, not a requirement.

Nothing is needed at the current stage. From **P4** onward, in rough order of difficulty:

| Service | Windows without Docker | Effort |
|---|---|---|
| **PostgreSQL** | Official Windows installer. Set `DATABASE_URL`. | Easy — standard install |
| **MinIO** | Standalone Windows binary. Set `STORAGE_ENDPOINT`. | Easy — one exe |
| **Mailpit** | Standalone Windows binary. Point SMTP at `localhost:1025`. | Easy — one exe |
| **Redis** | ⚠️ **No official Windows build.** Options: WSL2, Memurai (Redis-compatible), or skip until P4. | Awkward |

Redis is only needed from **P4**, when BullMQ arrives. Until then `REDIS_URL` is optional and the app says so at boot.

`REDIS_URL` is never silently defaulted to a guessed localhost — a wrong guess produces a connection error much later, in a queue worker, with an unrelated-looking stack trace. `AGENTS.md` §11 requires failing fast by name instead.

---

## Why the API boots without a database

`AGENTS.md` §11 says: *"Start-up must fail fast naming the missing variable; no silent defaults."* That pulls two ways at this stage, because there are **no persistence features yet** and Docker is not installed.

The resolution is a **third state**, not a default. When `DATABASE_URL` is absent the API reports `PERSISTENCE DISABLED`, logs it loudly at boot, and constructs no repository:

```
  ⚠  PERSISTENCE DISABLED — no DATABASE_URL configured.
     Expected at this stage (P2 scaffold): no persistence features exist yet.
     This is an explicit state, not a fallback. No repository is constructed.
     From P4 onward DATABASE_URL is REQUIRED and the API will refuse to boot without it.
     Missing: DATABASE_URL, REDIS_URL
```

A guessed `localhost` URL would be silent and would fail later and elsewhere. From **P4** this state is removed and the variable becomes required.

---

## Commands

Run with `pnpm` (or `npm run …` — the scripts are identical).

| Command | What it does |
|---|---|
| `pnpm dev` | Both apps in watch mode |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint — **the rules `AGENTS.md` relies on** |
| `pnpm typecheck` | `tsc --noEmit`, strict |
| `pnpm test` | Unit + contract tests |
| `pnpm test:coverage` | Enforces the `AGENTS.md` §4 coverage tiers |
| `pnpm test:integration` | Real Postgres, isolated schema *(P4)* |
| `pnpm test:e2e` | Playwright |
| `pnpm docs:verify` | Fails if a documented path does not exist |
| `pnpm format` | Prettier |
| `pnpm migration:generate --name <n>` | Prisma migration *(P4)* |

---

## Rules that are enforced, not documented

`AGENTS.md` is a contract, so the load-bearing parts are machine-checked. A rule nobody has watched fail is a suggestion.

| Rule | Enforced by | Where |
|---|---|---|
| `domain/` and `use-cases/` import no framework, ORM, queue or vendor SDK | ESLint `no-restricted-imports` | `AGENTS.md` §2.2 |
| `domain/` and `use-cases/` call no `Date.now()`, `new Date()`, `Math.random()` | ESLint `no-restricted-syntax` | `AGENTS.md` §2.4 |
| No `@ts-ignore`, `@ts-expect-error`, bare `any`, or empty `catch` | ESLint | `AGENTS.md` §8 |
| No raw `<button>` `<input>` `<select>` `<textarea>` `<table>` `<dialog>` | ESLint | `AGENTS.md` §3.2.1 |
| No hard-coded colour in a component | ESLint | `AGENTS.md` §3.2.5 |
| All four locales have identical key sets | vitest | `AGENTS.md` §4.2 |
| Every token defined in light **and** dark | vitest | `AGENTS.md` §3.2.5 |
| Environment validated; every invalid variable named at once | vitest | `AGENTS.md` §11 |
| Every documented path exists | `pnpm docs:verify` | `OPS-05` |
| Domain/use-case coverage ≥ 90% line, 85% branch | vitest `coverageThreshold` | `AGENTS.md` §4 |

`PLT-202` guard check (`@RequirePermission` on every route), `check-i18n` and `check-worklog` land in **P3**.

Each enforced rule has a test that watches it fire, so removing a rule breaks the build instead of quietly disabling the guarantee.

---

## Layout

```
apps/
  api/            NestJS + Prisma + Zod. 12 module folders, each with
                  controllers/ use-cases/ domain/{entities,repositories,services,ports}/
                  infrastructure/{postgres,adapters}/ dto/   (AGENTS.md §3)
  web/            Next.js + Tailwind v4 + shadcn/ui. UI only — the API is
                  a separate service, so no server actions (AGENTS.md §3.1)
packages/
  config/         Shared tsconfig, ESLint, Prettier. Where the rules live
  shared-types/   Cross-app contracts
  ui-kit/         shadcn/ui wrappers over the design tokens
  i18n-resources/ en / ta / si / ar
infra/docker/     Local services (optional — see above)
docs/             The contract. Start at docs/core/SSOT.md
```

**`apps/mobile` is milestone 2** (`AGENTS.md` §7, D5) and is not scaffolded.

---

## Where to look

**Start here, in this order:**

| Question | Answer |
|---|---|
| What am I allowed to do? | [`AGENTS.md`](AGENTS.md) — the contract, overrides everything |
| What is the current state? | [`docs/core/SSOT.md`](docs/core/SSOT.md) — decisions of record |
| What is the next task? | [`docs/work/TODO.md`](docs/work/TODO.md) |
| What was decided, and why? | [`docs/adr/`](docs/adr/) — 21 ADRs |
| How is it architected? | [`docs/core/ARCHITECTURE.md`](docs/core/ARCHITECTURE.md) → [`docs/diagrams/`](docs/diagrams/) |
| In what order do I build it? | [`docs/core/EduFlow_Agentic_Prompt_Pack_PlatformCore_v1.md`](docs/core/EduFlow_Agentic_Prompt_Pack_PlatformCore_v1.md) §5 |

**Requirements and delivery:**

| Question | Answer |
|---|---|
| What must the system do? | [`docs/core/EduFlow360_SRS_TestPlan_MVP_Roadmap_v1.3.md`](docs/core/EduFlow360_SRS_TestPlan_MVP_Roadmap_v1.3.md) — 120 FRs, 9 NFRs, test strategy, MVP |
| What is the full architecture? | [`docs/core/EduFlow360_Project_Master_Plan_v5.3.md`](docs/core/EduFlow360_Project_Master_Plan_v5.3.md) |
| Platform stories | [`docs/core/EduFlow360_Jira_Epics_PlatformCore_RBAC_v2.md`](docs/core/EduFlow360_Jira_Epics_PlatformCore_RBAC_v2.md) — 10 epics, 39 stories |
| School Setup / Academic stories | [`docs/core/EduFlow360_Jira_Epics_SchoolSetup_Academic_v1.md`](docs/core/EduFlow360_Jira_Epics_SchoolSetup_Academic_v1.md) — 16 epics, 54 stories |
| How is a school stood up? | [`docs/core/EduFlow360_School_Setup_Workflow_v1.1.md`](docs/core/EduFlow360_School_Setup_Workflow_v1.1.md) — gates G0–G9 |
| What may be reused from the old app? | [`docs/analysis/LEGACY_REUSE_INVENTORY.md`](docs/analysis/LEGACY_REUSE_INVENTORY.md) |
| What is the recovery plan? | [`docs/superpowers/plans/2026-10-09-strategic-roadmap-v2.md`](docs/superpowers/plans/2026-10-09-strategic-roadmap-v2.md) |

### Two document generations

The planning docs exist at two versions. The `EduFlow360_*` set is the current one; the
earlier `EduFlow_*` set is preserved under
[`docs/core/superseded/`](docs/core/superseded/) for history and is **not** authoritative.

| Current | Supersedes |
|---|---|
| `EduFlow360_Project_Master_Plan_v5.3` | `EduFlow_Project_Master_Plan_v5.2` |
| `EduFlow360_SRS_TestPlan_MVP_Roadmap_v1.3` | `EduFlow_SRS_TestPlan_MVP_Roadmap_v1.2` |
| `EduFlow360_School_Setup_Workflow_v1.1` | `EduFlow_School_Setup_Workflow_v1` |
| `EduFlow360_Jira_Epics_PlatformCore_RBAC_v2` | `EduFlow_Jira_Epics_PlatformCore_RBAC_v1` |
| `EduFlow360_Jira_Epics_SchoolSetup_Academic_v1` | *(new)* |

`docs/core/EduFlow_Agentic_Prompt_Pack_PlatformCore_v1.md` has **no successor** and is still
the execution-order document referenced from `AGENTS.md`.

---

## Contributing

Work on a branch, open a PR. Conventional commits referencing the requirement ID: `feat(fees): late-fee accrual (PLT-301)`.

TDD is required: write the failing test, **watch it fail for the right reason**, then implement. Update `docs/work/WORKLOG.md` and `docs/work/TODO.md` in the same commit as the change (`AGENTS.md` §9).
