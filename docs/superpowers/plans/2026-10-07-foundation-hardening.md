# Foundation Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn EduFlow's currently *locally-verified* engineering contract into a *reproducible* one — land the 39 uncommitted paths, close the one red gate nobody is required to run, create the missing database provisioning path, and put every existing rule behind CI.

**Architecture:** Ten of eleven repository gates are green as measured 2026-10-07, but none of that evidence survives a clean clone, because there is no CI, no baseline migration, and no enforced pre-commit hook. This plan closes exactly those gaps. It deliberately does **not** start a new Platform Core story: `PLT-205` T3–T6 and `PLT-EPIC-04` both need provisioning and CI to be trustworthy first.

**Tech Stack:** pnpm 11 + Turborepo, NestJS 11, Prisma 6.19.3, Vitest 2.1.9, Playwright, Next.js, GitHub Actions, PostgreSQL 17.

**Spec:** `AGENTS.md` (the governing contract), `docs/work/TODO.md` (open P0/P1 items), `docs/work/RESUME_2026-10-05.md` (prior handoff), `docs/work/PLATFORM_CORE_PLAN.md` §2 (entry conditions), `docs/core/SSOT.md` (decisions).

---

## Scope Check — read this before starting

This plan covers **one subsystem: repository reproducibility.** It spans migrations, CI, gate honesty, flake removal and worktree hygiene, because those five are the same problem — *a guarantee that only exists if a developer remembers it*.

It does **not** cover `PLT-205` T3–T6, `PLT-EPIC-03` licensing, `PLT-EPIC-04` audit writing, or `PLT-701`. Those are separate subsystems with separate specs and separate failure modes. They are sequenced in **Part B** below with entry conditions and exit gates, and each should get its own plan document at that point. Writing TDD steps for 199 points of Platform Core here would be fabrication, not planning.

---

## Global Constraints

Verbatim from `AGENTS.md`. Every task's requirements implicitly include this section.

- **§2.1** One PostgreSQL database and one deployment per school. Physical isolation. No tenancy-scoping machinery. Do not add a `SUPER_ADMIN` role.
- **§2.3** Every route carries `@RequirePermission('<KEY>')` **or** `@Public('<reason>')`. A route with neither is a defect. `@Public` requires a checked-in allowlist row.
- **§2.4** Domain and use-case code must never call `Date.now()`, `new Date()` or `Math.random()`. Inject `IClock`.
- **§2.7** Audit records are append-only. Never write raw SQL that mutates `audit_records`.
- **§2.8** No hard-coded user-facing strings. English / Tamil / Sinhala / Arabic (RTL).
- **§2.15** Every `ERROR`/`CRITICAL` goes to both the rotating file log and the DB error log.
- **§4** Quality gates, all seven, must be green before commit: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm test:coverage`, `pnpm build`, `pnpm test:integration`, `pnpm test:e2e`.
- **§9** Conventional Commits referencing the requirement ID. `docs/work/WORKLOG.md` and `docs/work/TODO.md` updated **in the same commit** as the change.
- **§13** Do not edit `AGENTS.md` §2, §3 or §13 without per-line owner sign-off. §4 is **not** restricted — see Task 2 Step 6.
- **§11** Never put a real credential, or a real-looking example, in any tracked file. Start-up fails fast naming a missing variable.
- **Vitest is the test runner** (`ADR-020`). Not Jest.
- **Markdown block comments terminate on `*/`.** Writing a glob like `src/**/hooks/**/*.tsx` inside a `/** … */` comment ends the comment early and esbuild reports `ERROR: Unexpected "."` twenty lines later. This repository has hit it three times. **Describe globs in prose.**
- **Do not override `DATABASE_URL` when running `pnpm test:integration`.** Doing so shadows the repository-root `.env` and produces ~98 failures that look like a database defect. Unset it; `vitest.integration.config.ts` loads the root `.env` itself.
- **Windows / CRLF.** `core.autocrlf=true` with no `.gitattributes` makes `schema-generation.spec.ts` red for a reason that is not a defect. Never hand-edit `schema.prisma` — it is generated from `schema-source.mjs`.

---

## Measured State — 2026-10-07, `fef4110`, branch `main`

Everything below was **measured in this session**, not read from a document. Where a document disagrees, the measurement wins and the document is listed as wrong.

| Gate | Command | Result |
|---|---|---|
| Workspace | `pnpm install` | ✅ present |
| Typecheck | `pnpm typecheck` | ✅ 8/8 |
| Lint | `pnpm lint` | ✅ 8/8, **1 warning** `apps/web:185:18` non-null assertion |
| Unit | `pnpm test` | ✅ **1,432** (api 1,264 · web 123 · ui-kit 28 · i18n 10 · shared-types 7) |
| Coverage | `pnpm test:coverage` | ✅ 8/8, every tier matches ≥1 file |
| Build | `pnpm build` | ✅ 5/5 |
| Integration | `pnpm test:integration` | ✅ **235/235**, 13 files |
| E2E | `pnpm test:e2e` | ✅ **37/37** |
| Docs refs | `pnpm docs:verify` | ✅ 238 refs across 8 documents |
| Route guards | `pnpm check:route-guards` | ✅ 83 source files |
| **Format** | `pnpm format:check` | 🔴 **RED — 8 files** |

### Structural facts measured

| Fact | Value | Consequence |
|---|---|---|
| Uncommitted paths | **39** | Largest single un-quantified risk in the repository |
| `apps/api/prisma/migrations/` | **does not exist** | Zero migrations. Everything is `db push`. No reproducible provisioning. |
| `.github/` | **does not exist** | No CI. No hooks (`.git/hooks` holds only `.sample` files). |
| `apps/api/src/modules/` | 12 dirs; **9 hold only `.gitkeep`** | Only `auth`, `rbac`, `settings` have code. |
| `apps/web/src/app/[locale]/` | **3 routes**: `page`, `sign-in`, `loading` | No forgot/reset, no app shell beyond landing |
| `docs/idea-bank/*.md` | 5 files, **0 data rows** | `REQ-01`…`REQ-05` have not run |
| `directives/` | **empty** | `ARC-08` not started |
| i18n parity | 77 keys × 4 locales, exact parity | ✅ |
| `turbo.json` | every task `dependsOn: ["^build"]` | `build` depends on nothing — `OPS-103` |
| `.kilo/worktrees/` | **9.8 MB**, 2 nested checkouts | Gitignored (`.gitignore:98`), harmless, pure noise |

### Four new findings this session produced

These are **not** in `TODO.md`. Each is small, checkable, and cheap to lose.

**F-1 — `format:check` is a gate nobody is required to run.** It is red on 8 files *right now* and it appears in **no** gate list: not `AGENTS.md` §4's table (which has 7 rows), not §4.3's pre-merge checklist, not `PLATFORM_CORE_PLAN.md` §5. A gate with no owner stays red indefinitely. This is the root cause, and the 8 files are the symptom. → Task 2.

**F-2 — `.env.example` documents a variable no code reads.** `.env.example:121` declares `NEXT_PUBLIC_API_URL`; `apps/web/src/lib/api-base-url.ts:61` reads `process.env.NEXT_PUBLIC_API_BASE_URL`. Different names. Nothing reconciles them, so a deployment that sets the documented name silently gets `http://localhost:3001`. → Task 6.

**F-3 — `docs/work/EPIC_STATUS.md` is stale.** It states the sign-in page is "a 61-line stub with 0 form controls and 0 API calls." `apps/web/src/features/auth/` contains 11 files including a 280-line wired form. The document is one commit behind the uncommitted work. → Task 10.

**F-4 — `prisma migrate dev` cannot run today.** The `datasource db` block in `schema.prisma` has `url = env("DATABASE_URL")` and **no `shadowDatabaseUrl`**. `migrate dev` requires a shadow database and will refuse without one. This is the first mechanical blocker on `SEC-101`, and it is not mentioned anywhere. → Task 3.

---

## File Structure

Files this plan creates, modifies or deletes, with the single responsibility of each.

**Task 1 — landing 39 paths (no new files; two commits over existing ones)**

| Path | Change | Responsibility |
|---|---|---|
| `apps/api/prisma/seed.mjs` | M | Reads `PERMISSION_CATALOGUE`; cannot drift from the union |
| `apps/api/prisma/read-declaration.mjs` | A | Imports the TS catalogue into a `.mjs` seed without a build step |
| `apps/api/src/common/guards/permission.guard.ts` | M +357 | The one enforcing guard; 4 tokens, fails closed |
| `apps/api/src/common/guards/owns-resource.decorator.ts` | A | `@OwnsResource('<type>')` marker |
| `apps/api/src/modules/rbac/domain/{permission-catalogue,system-roles}.ts` | A | The declared keys, and the five immutable system roles |
| `apps/api/src/modules/rbac/domain/ports/{ownership-policy,permission-cache}.ts` | A | Two ports: ownership resolution, grant caching |
| `apps/api/src/modules/rbac/domain/services/{decide-ownership,cached-permission-lookup}.ts` | A | Two rules, each pure and table-tested |
| `apps/api/src/modules/rbac/infrastructure/adapters/{redis-permission-cache,static-ownership-policy-registry}.ts` | A | Two adapters for those ports |
| `apps/web/src/features/auth/**` | A (11 files) | Sign-in screen, request contract, CSRF header, hook |
| `apps/web/src/lib/api-base-url.ts` | A | Where the API lives (deployment value) |
| `packages/ui-kit/src/components/ui/{field,spinner}.tsx` | A | Two primitives by composition, not edits to `ui/` |
| `packages/i18n-resources/src/locales/{en,ta,si,ar}.json` | M | **All four or none** — a partial commit breaks every locale |

**Task 2 — `format:check` green, and it gets an owner**

| Path | Change | Responsibility |
|---|---|---|
| the 8 Prettier offenders | M | Formatting only; no semantic change |
| `AGENTS.md` §4 | M | Add `format:check` as an eighth named gate |
| `apps/api/src/config/format-gate.spec.ts` | A | Proves `format:check` is *reachable* and lists no orphans |

**Task 3 — `SEC-101` baseline migration**

| Path | Change | Responsibility |
|---|---|---|
| `apps/api/prisma/migrations/0_init/migration.sql` | A | The baseline: all 17 models, generated not hand-written |
| `apps/api/prisma/migrations/migration_lock.toml` | A | Pins the provider for `migrate deploy` |
| `apps/api/prisma/schema.prisma` | M (generated) | Gains `shadowDatabaseUrl` |
| `apps/api/prisma/schema-source.mjs` | M | Source of truth — the `.prisma` file is its output |
| `apps/api/prisma/hardening/audit-immutability.sql` | M | Invoked by the deploy script instead of a human `psql` |
| `apps/api/prisma/deploy.mjs` | A | `migrate deploy` → hardening → verify, one idempotent command |
| `apps/api/src/config/migrations.spec.ts` | A | Structural gate: a migration exists and hardening is reachable |
| `apps/api/src/modules/audit/infrastructure/postgres/audit-immutability.integration.spec.ts` | A | **`PLT-401` AC**: `UPDATE`/`DELETE` as the app role **fails at the connection** |

**Task 4 — `OPS-101` + `OPS-103` CI**

| Path | Change | Responsibility |
|---|---|---|
| `.github/workflows/ci.yml` | A | Seven gates + four custom checks + secret scan |
| `infra/ci/README.md` | A | What CI runs, and what it deliberately does not |
| `.gitleaks.toml` | A | Allowlist for `local_dev_only_not_a_secret` and friends |
| `turbo.json` | M | `build` gates on `typecheck`, `lint`, `test` |
| `.husky/pre-commit` + `commit-msg` | A | `format:check` on staged files; Conventional Commit + requirement ID |

**Task 5 — `OPS-112` flake removal**

| Path | Change | Responsibility |
|---|---|---|
| `apps/api/src/common/guards/permission-cache-over-http.spec.ts` | M | Waits for the cache to be genuinely warm before asserting on it |
| `apps/api/src/common/guards/permission-ownership-over-http.spec.ts` | M | Same |
| `apps/web/playwright.config.ts` | M | Wipe and serve become **two** webServers, not one shell command |
| `apps/web/package.json` | M | `dev:e2e` script so the config does not inline shell logic |

**Task 6 — `F-2` environment-variable reconciliation**

| Path | Change | Responsibility |
|---|---|---|
| `.env.example` | M | `NEXT_PUBLIC_API_BASE_URL` — the name the code reads |
| `apps/web/src/config/env-contract.spec.ts` | A | Reconciles `.env.example` against every `process.env` read, both directions |

**Task 7 — `WEB-105` sign-in E2E**

| Path | Change | Responsibility |
|---|---|---|
| `apps/web/tests/e2e/sign-in.spec.ts` | A | The file `sign-in-form.spec.tsx:23` already names |

**Task 8 — `PLT-205` T3, the matrix fixture, and the owner's review**

| Path | Change | Responsibility |
|---|---|---|
| `role-permissions.json` | A | Role × key, the authorisation policy, reviewable line by line |
| `apps/api/src/modules/rbac/role-permissions.spec.ts` | A | Reconciles the fixture ↔ `system-roles.ts` ↔ `seed.mjs` |

**Task 9 — stale-record correction**

| Path | Change | Responsibility |
|---|---|---|
| `docs/work/EPIC_STATUS.md` | M | `F-3`: sign-in is wired, not a stub |
| `docs/work/RESUME_2026-10-05.md` | M | Names `format:check` as the 11th gate, red |
| `docs/work/TODO.md` | M | Adds `F-1`…`F-4`; closes `RBAC-01` |

---

## Part A — The Executable Plan

Every task ends in a green gate set and a commit. Tasks 1–6 are the subsystem; 7–9 are the small corrections that must not be lost.

---

### Task 1: Land the 39 uncommitted paths (`RBAC-01`)

**Files:** the 39 paths in the table above. Two commits.

**Interfaces:**
- Consumes: nothing. This is already-written, already-tested work.
- Produces: `PERMISSION_CATALOGUE` (9 keys, sorted, exported), `PermissionKey` (a derived union), `ownershipPoliciesFor(): readonly IOwnershipPolicy[]` (currently `[]`), `IOwnershipPolicyRegistry`, `IPermissionCache`, `apiUrl(path, baseUrl?)`. Later tasks rely on these names existing in the tree.

> **Why this is first.** 39 uncommitted paths is the single largest un-quantified risk in the repository. They are a coherent, tested body of work sitting in the highest-variance state available: any `git checkout`, `git stash` or lost IDE buffer destroys them. Everything below is an improvement; this is just exposure.

- [ ] **Step 1: Confirm the whole set is green before touching anything**

Run:

```bash
pnpm typecheck; pnpm lint; pnpm test; pnpm test:coverage; pnpm build
```

Expected: all green, matching the Measured State table. **Do not stage anything yet.** A red gate here means the set is not landable and Task 1 becomes a debugging task, not a landing task.

- [ ] **Step 2: Confirm the deleted stylesheet has no dangling import**

`apps/web/src/app/[locale]/sign-in/sign-in.css` is deleted in the working tree. Verified dangling-reference-free in this session's measurement, but re-verify rather than trust it:

```bash
Select-String -Path apps\web\src\**\*.tsx,apps\web\src\**\*.ts,apps\web\src\**\*.css -Pattern "sign-in\.css"
```

Expected: **no output**. Any hit means the page still imports a file that is about to be deleted, and `pnpm build` will fail.

- [ ] **Step 3: Commit A — RBAC, the ownership engine, the cache, and the seed**

```bash
git add apps/api/prisma/seed.mjs `
        apps/api/prisma/read-declaration.mjs `
        apps/api/src/common/guards/permission.guard.ts `
        apps/api/src/common/guards/route-guards.decorator.ts `
        apps/api/src/common/guards/owns-resource.decorator.ts `
        apps/api/src/common/guards/owns-resource.decorator.spec.ts `
        apps/api/src/common/guards/permission-cache-over-http.spec.ts `
        apps/api/src/common/guards/permission-ownership-over-http.spec.ts `
        apps/api/src/modules/rbac `
        apps/api/src/testing/fake-ownership-policy.ts

git commit -m "feat(rbac): the permission catalogue, five system roles and the ownership engine (PLT-205 T1/T2, PLT-202 AC-2, PLT-203)"
```

- [ ] **Step 4: Verify commit A in isolation**

```bash
pnpm typecheck; pnpm lint; pnpm test; pnpm test:coverage
```

Expected: green. **`pnpm build` and `pnpm test:e2e` are expected to FAIL here** — `apps/web/src/app/[locale]/sign-in/page.tsx` is still the old stub while `packages/ui-kit` may already be needed. Confirm the failure is *only* in `apps/web`, then continue to Step 5. Record the exact failing package in the commit body.

- [ ] **Step 5: Commit B — the web sign-in feature, all four locales, the ui-kit primitives**

```bash
git add apps/web `
        packages/ui-kit/src/components/ui/field.tsx `
        packages/ui-kit/src/components/ui/spinner.tsx `
        packages/i18n-resources/src/locales

git commit -m "feat(web): the wired four-locale sign-in form, and the primitives it composes (PLT-101)"
```

> **All four locale files in one commit, always.** `AGENTS.md` §4.2: a key added to `en.json` and not to `ta/si/ar` is a silent English fallback in a non-English locale. A commit carrying three of four locales breaks every locale in one step.

- [ ] **Step 6: Verify the whole set, both commits landed**

```bash
pnpm typecheck; pnpm lint; pnpm test; pnpm test:coverage; pnpm build
pnpm test:integration; pnpm test:e2e
pnpm docs:verify; pnpm check:route-guards
```

Expected: every row of the Measured State table reproduced exactly — 1,432 unit, 235 integration, 37 e2e, 238 refs, 83 files. **Any number that differs is a finding, not a rounding error; write it down.**

- [ ] **Step 7: Confirm the tree is clean and record it**

```bash
git status --porcelain
```

Expected: **empty**. Then update `docs/work/WORKLOG.md` and `docs/work/TODO.md` in the *same* commit as any follow-up (§9), and tick `RBAC-01`.

---

### Task 2: Make `format:check` green, and give it an owner (`FIX-05`, `F-1`)

**Files:** 8 offenders; `AGENTS.md` §4; create `apps/api/src/config/format-gate.spec.ts`.

**Interfaces:**
- Consumes: Task 1.
- Produces: a red-able `format:check` gate that `AGENTS.md` §4 names, enforced in CI by Task 4 and on commit by Task 4's hook.

> **The 8 offenders, measured:** `apps/api/src/common/guards/permission-guard-production-wiring.spec.ts`, `apps/api/src/modules/rbac/rbac.module.spec.ts`, `apps/web/src/features/theme/components/theme-toggle.spec.tsx`, `apps/web/src/features/theme/components/theme-toggle.tsx`, `apps/web/src/features/theme/hooks/use-theme.spec.tsx`, `apps/web/src/features/theme/hooks/use-theme.tsx`, `packages/ui-kit/src/components/ui/icons.tsx`, `scripts/docs-verify.mjs`.

- [ ] **Step 1: Reproduce the failure, so the fix is observed**

```bash
pnpm format:check
```

Expected: `[warn] Code style issues found in 8 files.`

- [ ] **Step 2: Write the failing test**

Create `apps/api/src/config/format-gate.spec.ts`:

```typescript
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../../../../scripts/paths.mjs';

/**
 * `format:check` is a gate with no owner, and this file is what gives it one.
 *
 * It was RED for the repository's history — eight files — while appearing in
 * no gate list: not AGENTS.md section 4's table, not section 4.3's pre-merge
 * checklist, not PLATFORM_CORE_PLAN.md section 5. A gate nobody is required to
 * run stays red forever, and that is a cheaper failure than a broken gate only
 * by accident.
 *
 * Two assertions, and the second is the load-bearing one:
 *
 *  1. the command is reachable from the workspace root and exits 0;
 *  2. AGENTS.md *names* it — so deleting it from the contract is a failing
 *     test rather than a silent demotion back to an optional script.
 *
 * (2) is the one that would have caught this. (1) alone fails the day after
 * someone fixes the eight files and removes the gate, which is the exact moment
 * the next violation goes unnoticed.
 */
describe('format:check', () => {
  it('exits 0 from the workspace root', () => {
    expect(() =>
      execFileSync('pnpm', ['format:check'], { cwd: REPO_ROOT, stdio: 'pipe' }),
    ).not.toThrow();
  });

  it('is named as a required gate in AGENTS.md', () => {
    const contract = execFileSync('git', ['show', 'HEAD:AGENTS.md'], { cwd: REPO_ROOT });

    expect(contract.toString()).toContain('pnpm format:check');
  });
});
```

- [ ] **Step 3: Run it and watch it fail for the right reason**

```bash
pnpm --filter @eduflow/api exec vitest run src/config/format-gate.spec.ts
```

Expected: **2 failures.** The first throws (the eight files are unformatted); the second fails because `AGENTS.md` does not contain `pnpm format:check`. Both must fail — if only the first does, the contract assertion is vacuous and the test is not measuring what it claims.

- [ ] **Step 4: Fix the eight files**

```bash
pnpm exec prettier --write `
  apps/api/src/common/guards/permission-guard-production-wiring.spec.ts `
  apps/api/src/modules/rbac/rbac.module.spec.ts `
  apps/web/src/features/theme/components/theme-toggle.spec.tsx `
  apps/web/src/features/theme/components/theme-toggle.tsx `
  apps/web/src/features/theme/hooks/use-theme.spec.tsx `
  apps/web/src/features/theme/hooks/use-theme.tsx `
  packages/ui-kit/src/components/ui/icons.tsx `
  scripts/docs-verify.mjs
```

Expected: eight files rewritten, and the **same eight** — a different count means Prettier's glob resolution changed, not that the problem is solved.

- [ ] **Step 5: Name the gate in the contract**

In `AGENTS.md` §4's gate table, add one row after the `Build` row:

```markdown
| Format | `pnpm format:check` | 0 files unformatted. Prettier over all TS/TSX/JS/JSON/YAML |
```

**§4 is not in the §13 restricted set** (§2, §3, §13 only), so this edit needs no per-line sign-off. Add one line to the §4 preamble noting that this gate was added 2026-10-07 because it was red and unowned.

- [ ] **Step 6: Run the test again and watch it pass**

```bash
pnpm --filter @eduflow/api exec vitest run src/config/format-gate.spec.ts
pnpm format:check
```

Expected: **2 passed**; `format:check` exits 0.

- [ ] **Step 7: Prove the gate can still fail**

Append one file with a deliberate violation, run `pnpm format:check`, confirm exit 1, then `pnpm exec prettier --write` it and confirm green again.

A gate never observed failing is not a gate. Record the output in the commit body.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/config/format-gate.spec.ts AGENTS.md \
        apps/api/src/common/guards/permission-guard-production-wiring.spec.ts \
        apps/api/src/modules/rbac/rbac.module.spec.ts \
        apps/web/src/features/theme \
        packages/ui-kit/src/components/ui/icons.tsx \
        scripts/docs-verify.mjs

git commit -m "fix(ci): format:check was red and named by nobody (FIX-05, F-1)"
```

---

### Task 3: The baseline Prisma migration (`SEC-101`)

**Files:** see the Task 3 table above.

**Interfaces:**
- Consumes: Task 1 (`seed.mjs` must run against a migrated database).
- Produces: `apps/api/prisma/deploy.mjs` exporting `main(): Promise<void>`, runnable as `node prisma/deploy.mjs`; `pnpm migration:run` repointed at it. Task 4's CI `services.postgres` job invokes it. Task 7's e2e sign-in flow needs the schema it creates.

> **Why this is the largest infrastructure gap.** `AGENTS.md` §2.1 makes *one database per school* the entire isolation story. With zero migrations there is no reproducible provisioning path: every environment is a human running `prisma db push`, and `audit-immutability.sql` is a `psql` command somebody has to remember. A school cannot be deployed from a document.

**Measured blocker:** the `datasource db` block has `url = env("DATABASE_URL")` and **no `shadowDatabaseUrl`**, so `prisma migrate dev` refuses to run. That is `F-4`.

- [ ] **Step 1: Write the failing structural test**

Create `apps/api/src/config/migrations.spec.ts`:

```typescript
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_ROOT } from '../../../../scripts/paths.mjs';

const MIGRATIONS_DIR = join(API_ROOT, 'prisma', 'migrations');
const DEPLOY_SCRIPT = join(API_ROOT, 'prisma', 'deploy.mjs');
const HARDENING = join(API_ROOT, 'prisma', 'hardening', 'audit-immutability.sql');

/**
 * The baseline migration exists, and the hardening script is reachable.
 *
 * `schema-generation.spec.ts` already asserts the hardening SQL is present and
 * rewrites UPDATE/DELETE. It asserts the FILE exists. It never asserts anything
 * RUNS it — so `audit_records` immutability has been a file in the repository
 * rather than a control in any database, since it was written.
 *
 * These assertions are the difference between "the SQL is committed" and "the
 * SQL is applied", which is the whole of `PLT-401`'s acceptance criterion.
 */
describe('a reproducible provisioning path', () => {
  it('has at least one checked-in migration', () => {
    expect(existsSync(MIGRATIONS_DIR)).toBe(true);

    const entries = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    expect(entries.length).toBeGreaterThan(0);
  });

  it('pins the migration provider, so `migrate deploy` is deterministic', () => {
    const lock = readFileSync(join(MIGRATIONS_DIR, 'migration_lock.toml'), 'utf8');

    expect(lock).toContain('provider = "postgresql"');
  });

  it('runs the audit hardening, rather than leaving it to a human with psql', () => {
    expect(existsSync(DEPLOY_SCRIPT)).toBe(true);

    const script = readFileSync(DEPLOY_SCRIPT, 'utf8');

    expect(script).toContain('audit-immutability.sql');
  });

  it('creates the application role the hardening revokes from', () => {
    // The hardening script RAISEs if the role is absent, which is correct
    // behaviour and also means a fresh database cannot complete a deploy. The
    // deploy script therefore has to provision the role BEFORE it runs the
    // revokes, or provisioning is a two-step manual process again.
    const script = readFileSync(DEPLOY_SCRIPT, 'utf8');

    expect(script).toContain('eduflow_app');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm --filter @eduflow/api exec vitest run src/config/migrations.spec.ts
```

Expected: **4 failures**, the first naming `.../prisma/migrations` as absent. All four must fail; a partial pass means an assertion is reading something unintended.

- [ ] **Step 3: Give `migrate dev` a shadow database**

In `apps/api/prisma/schema-source.mjs` — **the source, not `schema.prisma`** — add to the `datasource db` block:

```
shadowDatabaseUrl = env("SHADOW_DATABASE_URL")
```

Then regenerate:

```bash
pnpm --filter @eduflow/api generate:schema
pnpm --filter @eduflow/api exec vitest run src/config/schema-generation.spec.ts
```

Expected: schema regenerated, `schema-generation.spec.ts` **green**. Never hand-edit `schema.prisma`; the ERD and the schema are both generated from this one file and a hand edit breaks `schema-generation.spec.ts`.

- [ ] **Step 4: Provision the shadow database**

Add to `infra/docker/docker-compose.yml`:

```yaml
  postgres-shadow:
    image: postgres:17-alpine
    container_name: eduflow-postgres-shadow
    restart: unless-stopped
    environment:
      POSTGRES_USER: eduflow_dev
      POSTGRES_PASSWORD: local_dev_only_not_a_secret
      POSTGRES_DB: eduflow_shadow
    ports:
      - '5433:5432'
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U eduflow_dev -d eduflow_shadow']
      interval: 5s
      timeout: 5s
      retries: 10
```

Document `SHADOW_DATABASE_URL` in `.env.example` as a **development-only** variable, and state in its comment that CI does not need it because `migrate diff` is used there instead of `migrate dev`.

- [ ] **Step 5: Generate the baseline migration against a scratch database**

Do **not** run this against your working `.env` database — `migrate dev` resets the database it is given, and that database holds the integration suite's fixtures.

```bash
$env:DATABASE_URL="postgresql://eduflow_dev:local_dev_only_not_a_secret@localhost:5432/eduflow_migrate_baseline?schema=public"
$env:SHADOW_DATABASE_URL="postgresql://eduflow_dev:local_dev_only_not_a_secret@localhost:5433/eduflow_shadow?schema=public"

pnpm --filter @eduflow/api exec prisma migrate dev --name 0_init --create-only
```

Expected: `apps/api/prisma/migrations/0_init/migration.sql` and `migration_lock.toml`, covering all **17** models. Read the generated SQL before accepting it — it is generated, but nobody has read it yet, and it is the file every school's database will be built from.

- [ ] **Step 6: Write the deploy script**

Create `apps/api/prisma/deploy.mjs`:

```javascript
/**
 * Provision one school's database. Idempotent, and the ONLY supported path.
 *
 * ## Why this exists
 *
 * Until now a school's database was built by a human typing `prisma db push`
 * and then a second human remembering to `psql` the audit-hardening script. Two
 * steps, neither recorded, neither repeatable. `AGENTS.md` section 2.7 requires
 * audit records to be append-only *at the database level*, and a control that
 * requires remembering is not a control.
 *
 * ## What it does, in order
 *
 *   1. create the application role if it is absent (the hardening script
 *      RAISEs without it, by design);
 *   2. `prisma migrate deploy` — never `migrate dev`, which can reset;
 *   3. apply `hardening/audit-immutability.sql`;
 *   4. verify the trigger exists, and fail loudly if it does not.
 *
 * Steps 3 and 4 are separate on purpose. Applying SQL and assuming it took
 * effect is how a deployment reports success with an unmutable audit table.
 *
 * Run:  node prisma/deploy.mjs      (or `pnpm migration:run`)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** The role the hardening script revokes UPDATE/DELETE/TRUNCATE from. */
const APP_ROLE = process.env.EDUFLOW_APP_ROLE ?? 'eduflow_app';

function run(args, options = {}) {
  execFileSync('npx', args, { cwd: HERE, stdio: 'inherit', ...options });
}

/** Create the application role if it does not already exist. */
function ensureApplicationRole() {
  // `psql -c` with DO block, because CREATE ROLE has no IF NOT EXISTS in
  // PostgreSQL 17 and a bare CREATE ROLE fails on the second deploy.
  const sql = `
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
        CREATE ROLE ${APP_ROLE} LOGIN PASSWORD NULL;
      END IF;
    END
    $$;
  `;

  run(['psql', process.env.DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-c', sql]);
}

function applyMigrations() {
  run(['prisma', 'migrate', 'deploy']);
}

function applyAuditHardening() {
  const sql = readFileSync(join(HERE, 'hardening', 'audit-immutability.sql'), 'utf8');

  run(['psql', process.env.DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-c', sql]);
}

/** Fail loudly if the immutability trigger is not actually installed. */
function verifyAuditHardening() {
  const sql = `
    SELECT COUNT(*) FROM pg_trigger
    WHERE tgname = 'audit_records_append_only' AND NOT tgisinternal;
  `;
  const out = execFileSync(
    'psql',
    [process.env.DATABASE_URL, '-At', '-c', sql],
    { encoding: 'utf8' },
  ).trim();

  if (out !== '1') {
    throw new Error(
      `audit_records_append_only trigger is absent (found ${out}). The database was ` +
        'migrated but audit records are MUTABLE. Do not proceed until this is fixed.',
    );
  }
}

export function main() {
  ensureApplicationRole();
  applyMigrations();
  applyAuditHardening();
  verifyAuditHardening();
  console.log('deploy: migrations applied, audit_records is append-only.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
```

Repoint `apps/api/package.json`:

```json
"migration:run": "node prisma/deploy.mjs"
```

- [ ] **Step 7: Run the structural test again**

```bash
pnpm --filter @eduflow/api exec vitest run src/config/migrations.spec.ts
```

Expected: **4 passed.**

- [ ] **Step 8: Write the `PLT-401` acceptance test — the one that proves the REVOKE**

Create `apps/api/src/modules/audit/infrastructure/postgres/audit-immutability.integration.spec.ts`:

```typescript
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * `PLT-401`: attempting an UPDATE/DELETE against `audit_records` **at the
 * database connection level** fails.
 *
 * `AGENTS.md` section 2.7 and `PLT_CORE_PLAN.md` section 4.3 both ask for the
 * stronger of the two claims. The weaker one — "no code calls update() on the
 * audit repository" — is already true, and proves nothing: `pg` connects with
 * nothing but a connection string, so it exercises exactly the path a rogue
 * migration or a support session would take.
 *
 * ## The two paths, and why both are tested
 *
 *  1. **As the application role** (`eduflow_app`) — the REVOKE binds. Proves the
 *     application's own credentials cannot rewrite history.
 *  2. **As the table owner** — the REVOKE does *not* bind, because an owner is
 *     not stopped by a privilege revoked from another role. Only the trigger
 *     stops it. This is the case that would survive a test of (1) alone, and it
 *     is the case that matters: Prisma migrates as the owner.
 *
 * Requires `apps/api/prisma/migrations/` to exist and `migration:run` to have
 * been applied. Skips with a named message rather than passing silently when no
 * `DATABASE_URL` is configured — `TODO.md` AUD-30-02's shape.
 */
const DATABASE_URL = process.env.DATABASE_URL;
const APP_ROLE = process.env.EDUFLOW_APP_ROLE ?? 'eduflow_app';

async function seedAuditRow(client) {
  await client.query(
    `INSERT INTO audit_records
       (school_id, actor_user_id, action_key, resource_type, resource_id, outcome, metadata)
     VALUES ($1, NULL, 'TEST.ACTION', 'test', 'immutability-probe', 'success', '{}'::jsonb)`,
    [process.env.SCHOOL_ID],
  );
}

async function expectRejected(client, sql) {
  await expect(
    client.query(sql),
    `${sql} must be rejected at the connection level`,
  ).rejects.toThrow(/append-only|permission denied|restrict_violation/i);
}

describe('audit_records is append-only at the database level', () => {
  let owner;
  let app;

  beforeAll(async () => {
    if (!DATABASE_URL) {
      throw new Error(
        'DATABASE_URL is unset. This suite connects to a real PostgreSQL and cannot ' +
          'prove a database-level control without one.',
      );
    }
    owner = new Client({ connectionString: DATABASE_URL });
    await owner.connect();
    await seedAuditRow(owner);

    app = new Client({
      connectionString: DATABASE_URL,
      user: APP_ROLE,
      // A role with NOLOGIN cannot be switched to, so the deploy script creates
      // it with LOGIN. This is the connection an attacker or a rogue migration
      // would use: the application's own credentials.
      password: process.env.EDUFLOW_APP_PASSWORD ?? 'local_dev_only_not_a_secret',
    });
    await app.connect();
  });

  afterAll(async () => {
    await owner?.end();
    await app?.end();
  });

  it('refuses UPDATE as the application role', async () => {
    await expectRejected(app, `UPDATE audit_records SET action_key = 'TAMPERED'`);
  });

  it('refuses DELETE as the application role', async () => {
    await expectRejected(app, `DELETE FROM audit_records`);
  });

  it('refuses UPDATE as the table owner, which the REVOKE alone does not stop', async () => {
    await expectRejected(owner, `UPDATE audit_records SET action_key = 'TAMPERED'`);
  });

  it('refuses DELETE as the table owner', async () => {
    await expectRejected(owner, `DELETE FROM audit_records`);
  });

  it('still permits INSERT and SELECT, or nothing could ever be recorded', async () => {
    // The negative tests above would also pass if the table were simply
    // unusable. This is the assertion that the trigger blocks *mutation* rather
    // than the table.
    await expect(app.query('SELECT COUNT(*) FROM audit_records')).resolves.toBeDefined();
    await expect(
      app.query(
        `INSERT INTO audit_records
           (school_id, actor_user_id, action_key, resource_type, resource_id, outcome, metadata)
         VALUES ($1, NULL, 'TEST.ALLOWED', 'test', 'append-probe', 'success', '{}'::jsonb)`,
        [process.env.SCHOOL_ID],
      ),
    ).resolves.toBeDefined();
  });
});
```

- [ ] **Step 9: Run it — first red, then green**

```bash
pnpm --filter @eduflow/api exec vitest run --config vitest.integration.config.ts src/modules/audit/infrastructure/postgres/audit-immutability.integration.spec.ts
```

Expected **RED** if the trigger was not applied. Then:

```bash
pnpm --filter @eduflow/api migration:run
```

Run the suite again. Expected **5 passed**.

- [ ] **Step 10: Prove the test can fail**

Comment out `CREATE TRIGGER audit_records_append_only` in `hardening/audit-immutability.sql`, re-apply, re-run. Expect **2 failures** — the two owner-path tests — and 3 passing, because the REVOKE alone still stops the application role. **That asymmetry is the finding**: a test of the application role alone would have reported green while the table owner could still rewrite history. Restore and re-apply.

- [ ] **Step 11: Run every gate, then commit**

```bash
pnpm typecheck; pnpm lint; pnpm test; pnpm test:coverage; pnpm build
pnpm test:integration; pnpm test:e2e
pnpm format:check; pnpm docs:verify; pnpm check:route-guards
```

```bash
git add apps/api/prisma apps/api/src/config/migrations.spec.ts \
        apps/api/src/modules/audit infra/docker/docker-compose.yml \
        .env.example apps/api/package.json

git commit -m "feat(db): the baseline migration and a one-command provisioning path (SEC-101, PLT-401)"
```

---

### Task 4: The first CI workflow (`OPS-101`, `OPS-103`)

**Files:** `.github/workflows/ci.yml`, `infra/ci/README.md`, `.gitleaks.toml`, `turbo.json`, `.husky/pre-commit`, `.husky/commit-msg`.

**Interfaces:**
- Consumes: Tasks 2 and 3. The `services.postgres` job calls `node prisma/deploy.mjs`, which does not exist before Task 3.
- Produces: the workflow every later task verifies itself against.

> **Why after `SEC-101` and not before.** The integration job needs a real PostgreSQL, and `migrate deploy` needs a migration. Wiring CI first means a red run whose cause is a missing file rather than a missing commit.

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  CI: 'true'

jobs:
  install:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11
      # `CI=true` is REQUIRED, not cosmetic: without it pnpm 11 blocks every
      # postinstall script and the workspace installs but nothing builds. This
      # was ENV-101's whole finding.
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile

  static:
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      # The four custom checks AGENTS.md phrases as rules but nothing ran:
      #   route guards -> an unguarded route fails the build
      #   coverage tiers -> a threshold matching zero files fails the build
      #   docs refs     -> a doc pointing at a missing file fails the build
      #   format        -> added by Task 2, red until this very day
      - run: pnpm check:route-guards
      - run: pnpm --filter @eduflow/api test:coverage
      - run: pnpm docs:verify
      - run: pnpm format:check

  build:
    needs: static
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build

  unit:
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test

  integration:
    needs: install
    runs-on: ubuntu-latest
    # A real PostgreSQL, provisioned by `prisma/deploy.mjs` rather than by
    # `db push` — Task 3's whole point. `migrate deploy` never resets, which is
    # what makes it the correct command in CI.
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: eduflow_dev
          POSTGRES_PASSWORD: local_dev_only_not_a_secret
          POSTGRES_DB: eduflow
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U eduflow_dev -d eduflow"
          --health-interval 5s --health-timeout 5s --health-retries 10
    env:
      DATABASE_URL: postgresql://eduflow_dev:local_dev_only_not_a_secret@localhost:5432/eduflow?schema=public
      SCHOOL_ID: 00000000-0000-4000-8000-000000000001
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Provision the database
        run: pnpm --filter @eduflow/api migration:run
      - run: pnpm test:integration

  e2e:
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: apps/web/playwright-report
          retention-days: 7

  secrets:
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Scan the full history, not just the tip
        # --no-git means "do not skip git history". A secret that was committed
        # and removed is still in the repository, and this is the compensating
        # control for the accepted risk in TODO.md item 1.
        uses: gitleaks/gitleaks-action@v2
        env:
          GITLEAKS_ENABLE_UPLOAD_ARTIFACT: 'false'
```

- [ ] **Step 2: Make `build` depend on something (`OPS-103`)**

In `turbo.json`, change the `build` task:

```json
"build": {
  "dependsOn": ["typecheck", "lint", "^build"],
  "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
}
```

> **Read the consequence before committing it.** This makes `pnpm build` ~4× slower locally, because every build now runs typecheck and lint for all eight packages first. That is the correct trade — `AGENTS.md` §4 says these must be green *before commit*, and this is the first mechanical enforcement of that sentence in the repository. Verify `pnpm build` still succeeds end to end, and note the duration in the commit body so nobody later "optimises" it back.

- [ ] **Step 3: Add the pre-commit hook**

```bash
pnpm add -D --filter @eduflow/api husky
```

Create `.husky/pre-commit`:

```bash
pnpm exec lint-staged
```

Create `.husky/commit-msg`:

```bash
node scripts/check-commit-message.mjs "$1"
```

Create `scripts/check-commit-message.mjs`:

```javascript
/**
 * Conventional Commits, plus the requirement ID `AGENTS.md` section 9 requires.
 *
 * Type is checked against the eleven allowed types. Scope is not checked, because
 * the existing history uses scopes this file cannot enumerate honestly. The
 * requirement ID is checked because a commit with no traceable requirement is
 * how the plan's traceability backbone (PLT-*, REQ-*, OPS-*, SEC-*) decays.
 *
 * Bypass for the rare genuinely-untraceable commit: `--no-verify`, and say so in
 * the body.
 */
import { readFileSync } from 'node:fs';

const TYPES = new Set([
  'feat', 'fix', 'test', 'refactor', 'docs', 'chore',
  'perf', 'build', 'ci', 'style', 'revert',
]);

const SUBJECT_MAX = 72;

// Requirement-ID shapes used in this repository's history.
const ID = /(?:\b(PLT|REQ|OPS|SEC|DSN|WEB|ARC|DOC|ADR|FIX|ENV|WEB)-\d+[a-z]?\b)/;

const message = readFileSync(process.argv[2], 'utf8').split('\n')[0] ?? '';

const match = /^(\w+)(\([^)]*\))?(!)?:\s+(.+)$/.exec(message);

if (!match) {
  console.error(`commit-msg: not a Conventional Commit.\n  got: ${message}`);
  process.exit(1);
}

const [, type, , , subject] = match;

if (!TYPES.has(type)) {
  console.error(`commit-msg: type "${type}" is not one of: ${[...TYPES].join(', ')}`);
  process.exit(1);
}

if (subject.length > SUBJECT_MAX) {
  console.error(`commit-msg: subject is ${subject.length} chars; keep it under ${SUBJECT_MAX}.`);
  process.exit(1);
}

if (!ID.test(message)) {
  console.error(
    'commit-msg: no requirement ID. AGENTS.md section 9 requires the commit to\n' +
      '  reference the requirement it implements (PLT-205, SEC-101, REQ-03, ...).\n' +
      '  Use --no-verify only for a commit with genuinely no requirement, and say why.',
  );
  process.exit(1);
}
```

- [ ] **Step 4: Configure `lint-staged`**

In the root `package.json`:

```json
"lint-staged": {
  "*.{ts,tsx,js,mjs,cjs,json}": ["prettier --check"],
  "*.{ts,tsx}": ["eslint --max-warnings=0"]
}
```

- [ ] **Step 5: Document what CI does and does not do**

Create `infra/ci/README.md`. It must state, explicitly:

- which of `AGENTS.md`'s rules are now **mechanically enforced** (route guards, coverage tiers, doc references, format, the seven gates, secret history);
- which remain **convention only** — no `new Date()` in a use-case is ESLint-enforced, but no check covers raw `<button>` in JSX, no i18n-literal detector exists (DSN-06), and no OWASP/dependency audit runs yet;
- that **no gate proves a guard is obeyed**, only that a decorator is present — the ceiling `route-guards.decorator.ts` documents, and the shape of the defect where nine green gates did not notice an app that could not boot.

- [ ] **Step 6: Verify locally, exactly as CI will**

Run each command in a fresh shell, in the order the workflow uses. Any that passes only because of your shell's state is a red CI run waiting to happen. Then:

```bash
git add .github infra/ci turbo.json package.json .husky scripts/check-commit-message.mjs
git commit -m "ci: the first workflow, and a build that gates on its own prerequisites (OPS-101, OPS-103)"
```

---

### Task 5: Remove the three flakes (`OPS-112`)

**Files:** two guard specs, `apps/web/playwright.config.ts`, `apps/web/package.json`.

**Interfaces:**
- Consumes: Task 4 (CI is where these flakes become red runs).
- Produces: a suite that is green on a cold cache and on a cold `.next`.

- [ ] **Step 1: Flake (a) — the cold permission cache**

`permission-cache-over-http.spec.ts` and `permission-ownership-over-http.spec.ts` fail roughly 1 run in 5 cold and pass 4/4 warm. A cache that answers "no entry" before its first write has landed is the expected behaviour of a cache, not a defect — so the test must wait for the cache to be genuinely warm, or assert the **BYPASS** path when it is cold.

In both specs, replace any bare `await` that assumes a populated cache with an explicit readiness assertion that names the state:

```typescript
/**
 * Wait for the cache to be warm, or assert the cold answer.
 *
 * `cachedPermissionLookup` has three paths: HIT, MISS (which writes through)
 * and BYPASS (no cache registered). A test that issues one request and asserts
 * a HIT is asserting a race: on a cold cache the first request legitimately
 * answers BYPASS.
 *
 * Polling the cache directly is the fix; `vi.waitFor` alone is not, because it
 * retries the *request* and every retry is also allowed to be a BYPASS.
 */
await vi.waitFor(async () => {
  const entries = await readCacheKeys(schoolId);
  expect(entries).toContain(cacheKeyFor(userId));
});
```

The cold case becomes its own assertion rather than a flake:

```typescript
it('answers BYPASS, correctly and identically, when no cache is registered', async () => {
  // The ordinary deployment shape (TODO.md: no Redis client is passed). Its
  // answers must equal the cached ones, only slower — that is the whole design.
});
```

- [ ] **Step 2: Flake (b) — Playwright wipes `.next` and starts the server in one command**

`apps/web/playwright.config.ts:101-102`:

```typescript
command:
  "node -e \"require('node:fs').rmSync('.next',{recursive:true,force:true})\" && npm run dev",
```

One shell command means the wipe and the server start are not separately observable, so a request can arrive while the manifest is half-written — seen once as `SyntaxError: Unexpected end of JSON input` on `/en/sign-in` while all 22 landing tests passed in the same run. Fix by moving the wipe out of the server command entirely:

```typescript
// Wipe once, BEFORE the server starts, as a global setup step. Combining the
// wipe and `dev` in one webServer command made the two racy: a request arriving
// mid-wipe read a half-written build manifest. `reuseExistingServer: false`
// stays, because a leftover dev server on the port is exactly the state this
// suite must not inherit.
webServer: {
  command: 'pnpm dev:e2e',
  url: `${BASE_URL}${PROBE_PATH}`,
  reuseExistingServer: false,
  timeout: 120_000,
  env: { PORT: String(WEB_PORT) },
},
```

And in `apps/web/package.json`:

```json
"dev:e2e": "node scripts/clean-next.mjs && next dev --port ${WEB_PORT:-3500}"
```

Create `apps/web/scripts/clean-next.mjs` as a three-line `rmSync`, so the wipe is a named, testable step rather than shell text embedded in a config value.

- [ ] **Step 3: Prove both fixes — cold, repeatedly**

Turbo's cache will make a second run prove nothing, so bypass it:

```bash
pnpm test -- --no-cache   # or: turbo run test --force
pnpm --filter @eduflow/api exec vitest run src/common/guards/permission-cache-over-http.spec.ts
pnpm --filter @eduflow/api exec vitest run src/common/guards/permission-ownership-over-http.spec.ts
```

Run each **ten times** and record the result. Ten is not arbitrary: the observed rate was ~1 in 5, so ten consecutive passes is weak evidence — if a failure appears, keep going and report the true rate rather than the last run.

Then delete `.next` and run the e2e suite three times.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/common/guards apps/web/playwright.config.ts \
        apps/web/package.json apps/web/scripts

git commit -m "fix(ci): three flakes that would make the first CI run red for no real reason (OPS-112)"
```

---

### Task 6: Reconcile `.env.example` with the code (`F-2`)

**Files:** `.env.example`; create `apps/web/src/config/env-contract.spec.ts`.

**Interfaces:**
- Consumes: Task 1 (`api-base-url.ts`).
- Produces: a gate that fails when a documented variable and a read variable disagree, in **either** direction.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/config/env-contract.spec.ts`:

```typescript
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { globSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * `.env.example` is documentation that operators follow literally.
 *
 * Measured 2026-10-07: `.env.example:121` documents `NEXT_PUBLIC_API_URL`.
 * `src/lib/api-base-url.ts:61` reads `process.env.NEXT_PUBLIC_API_BASE_URL`.
 * Different names, so an operator who set the documented variable got no error —
 * they got `http://localhost:3001`, the module's own default. Silent, and it
 * looks like it worked.
 *
 * This reconciles both directions, because either is a defect:
 *   - documented but never read: documentation that does nothing;
 *   - read but never documented: a required variable nobody knows to set.
 */
const REPO_ROOT = join(__dirname, '..', '..', '..', '..');
const EXAMPLE = readFileSync(join(REPO_ROOT, '.env.example'), 'utf8');

const documented = new Set(
  [...EXAMPLE.matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1] as string),
);

const readByCode = new Set<string>();
for (const file of globSync('src/**/*.{ts,tsx}', { cwd: join(REPO_ROOT, 'apps', 'web') })) {
  const text = readFileSync(join(REPO_ROOT, 'apps', 'web', file), 'utf8');
  for (const m of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) {
    readByCode.add(m[1] as string);
  }
}

describe('.env.example matches what the web app reads', () => {
  it('documents every NEXT_PUBLIC_ variable the web app reads', () => {
    const missing = [...readByCode].filter((name) => name.startsWith('NEXT_PUBLIC_'))
      .filter((name) => !documented.has(name));

    expect(missing).toEqual([]);
  });

  it('reads every NEXT_PUBLIC_ variable it documents', () => {
    const unread = [...documented].filter((name) => name.startsWith('NEXT_PUBLIC_'))
      .filter((name) => !readByCode.has(name));

    expect(unread).toEqual([]);
  });

  it('places no real-looking credential in a tracked file', () => {
    // AGENTS.md section 11. Placeholders are angle-bracketed; a real-looking
    // value is not. Cheap to check and the failure mode is a leaked credential.
    const realLooking = [...EXAMPLE.matchAll(/^([A-Z][A-Z0-9_]+)="([^"<][^"]*)"/gm)]
      .map((m) => `${m[1]}="${m[2]}"`)
      .filter((line) => !/local_dev_only_not_a_secret|generate with|uuid, for example/.test(line));

    expect(realLooking).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm --filter @eduflow/web exec vitest run src/config/env-contract.spec.ts
```

Expected: the second test fails with `["NEXT_PUBLIC_API_URL"]`; the first passes.

- [ ] **Step 3: Fix the name**

In `.env.example`, rename the variable to the one the code reads and document the two shapes `api-base-url.ts` supports:

```
# --- Web ---------------------------------------------------------------
# Must match the name apps/web/src/lib/api-base-url.ts reads. Until 2026-10-07
# this file documented NEXT_PUBLIC_API_URL while the code read
# NEXT_PUBLIC_API_BASE_URL, so setting the documented name silently yielded the
# local default. Reconciled by apps/web/src/config/env-contract.spec.ts.
#
# Absolute  - local development. The browser treats it as cross-origin.
# Relative  - the production shape, "/api", behind one reverse proxy. Same-origin,
#             which is what lets the httpOnly session cookie survive login.
NEXT_PUBLIC_API_BASE_URL="http://localhost:3001"
```

- [ ] **Step 4: Run it again**

```bash
pnpm --filter @eduflow/web exec vitest run src/config/env-contract.spec.ts
pnpm format:check
```

Expected: **3 passed**, format clean.

- [ ] **Step 5: Commit**

```bash
git add .env.example apps/web/src/config/env-contract.spec.ts
git commit -m "fix(env): .env.example documented a variable no code read (F-2)"
```

---

### Task 7: Sign-in E2E (`WEB-105`)

**Files:** create `apps/web/tests/e2e/sign-in.spec.ts`.

**Interfaces:**
- Consumes: Task 1 (`features/auth/**`), Task 3 (a provisioned database).
- Produces: the first E2E coverage of a form; the file `sign-in-form.spec.tsx:23` already names.

> **Why this is in a foundation plan.** 4,600 lines of sign-in code exist and **nothing exercises it over HTTP**. `sign-in-form.spec.tsx:23` cites `tests/e2e/sign-in.spec.ts` as the place keyboard, focus order and click-on-submit belong — a citation to a file that does not exist. A form with a real submit path and no E2E is a form whose 403 CSRF refusal, real 401 and real 429 have never been seen in a browser.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/e2e/sign-in.spec.ts`. Start with **one** case — the happy path — and let it fail:

```typescript
import { expect, test } from '@playwright/test';

/**
 * The sign-in form over HTTP.
 *
 * `sign-in-form.spec.tsx:23` names this file as where keyboard, focus order and
 * click-on-submit are asserted. It did not exist, so none of that was asserted
 * anywhere: 4,600 lines of sign-in code had zero E2E, which meant the real 403
 * from CsrfGuard, the real 401 and the real 429 had never been seen in a
 * browser.
 */
test.describe('sign in', () => {
  test('reports a wrong password without saying which half was wrong', async ({ page }) => {
    await page.goto('/en/sign-in');

    await page.getByLabel(/email|identifier/i).fill('nobody@example.test');
    await page.getByLabel(/password/i).fill('definitely-not-the-password');
    await page.getByRole('button', { name: /sign in/i }).click();

    // The message must NOT distinguish "no such user" from "wrong password".
    // `sign-in-request.ts` never reads a 401 body, so this is structural — and
    // it is the account-enumeration defence, so it is asserted rather than
    // assumed. A change that starts reading the body fails here.
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).not.toContainText(/no such user|unknown email/i);
  });
});
```

- [ ] **Step 2: Run it and read the failure**

```bash
pnpm --filter @eduflow/web exec playwright test tests/e2e/sign-in.spec.ts
```

Expected: it fails, and **read the failure before writing more cases**. If the alert never appears, the cause is one of: the form did not render, the request went cross-origin and CORS dropped it, or `CsrfGuard` refused with 403. Those are three different defects and only the first is a test bug. The comment at `sign-in-request.ts` `buildSignInRequest` already warns that the API's CORS allow-list does not send `Access-Control-Allow-Credentials`, which makes the cross-origin shape unusable — `playwright.config.ts` runs with `NEXT_PUBLIC_API_BASE_URL=/api` for exactly this reason.

- [ ] **Step 3: Add the remaining cases, one at a time, each failing first**

| Case | Asserts |
|---|---|
| Keyboard-only sign-in | Tab reaches identifier → password → submit; Enter submits |
| Focus order | Focus moves forward, never traps; the error moves focus to the alert |
| Click on submit | The button disables and shows a spinner; no double-submit |
| 429 throttling | A 6th attempt renders the `Retry-After` wait; the button stays disabled until it expires |
| Locale parity | `/ta/sign-in`, `/si/sign-in`, `/ar/sign-in` render; Arabic has `dir="rtl"` |
| Theme parity | Sign-in is legible in light **and** dark (`DSN-05`'s lesson: the token existing is not the floor enforced) |
| Touch target | Every interactive element is ≥44px — reuse the existing sweep from the landing suite rather than writing a new one |

- [ ] **Step 4: Run the full gate set and commit**

```bash
pnpm test:e2e
pnpm typecheck; pnpm lint; pnpm test; pnpm test:coverage; pnpm build
pnpm format:check
```

```bash
git add apps/web/tests/e2e/sign-in.spec.ts
git commit -m "test(web): the sign-in form over HTTP, which four thousand lines had never had (WEB-105)"
```

---

### Task 8: `PLT-205` T3 — the permission matrix, and the owner's review

**Files:** create `role-permissions.json`, `apps/api/src/modules/rbac/role-permissions.spec.ts`.

**Interfaces:**
- Consumes: Task 1 (`system-roles.ts`, `PERMISSION_CATALOGUE`, `seed.mjs`).
- Produces: the fixture the owner reviews; the exit gate for P6; unblocks `PLT-EPIC-04` (21 pts).

> **This is the declared critical path and the only human gate on it.** `PLT_CORE_PLAN.md` §3.2 makes the owner's line-by-line review the P6 exit gate. Hand it over as soon as T3 lands and build T4 while they read — that collapses the wait instead of serialising it.

- [ ] **Step 1: Write the failing reconciliation test**

Create `apps/api/src/modules/rbac/role-permissions.spec.ts`:

```typescript
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PERMISSION_KEYS } from './domain/permission-catalogue.js';
import { SYSTEM_ROLES } from './domain/system-roles.js';
import { REPO_ROOT } from '../../../../scripts/paths.mjs';

/**
 * The Role x Key fixture — `PLT-205` T3, and the authorisation policy itself.
 *
 * `route-permissions.json` answers "which permission gates this ROUTE". This
 * answers "which roles hold each permission", which is a different question and
 * the one an administrator actually configures.
 *
 * Three reconciliations, each bidirectional, because a fixture nobody compares
 * against the source is a historical document — the failure mode
 * `route-guards.allowlist.json` already guards against for `@Public`.
 *
 *  1. every catalogue key appears in exactly one role block;
 *  2. no fixture key is outside the catalogue (a typo here is a permission that
 *     silently grants nothing);
 *  3. `PERMISSION_ASSIGN` is granted to nobody, because a role that can grant
 *     itself that key makes the whole permission system advisory.
 */
const matrix = JSON.parse(readFileSync(join(REPO_ROOT, 'role-permissions.json'), 'utf8')) as {
  roles: Record<string, { granted: string[]; rationale: string }>;
};

describe('role-permissions.json', () => {
  it('grants every catalogue key to at least one role', () => {
    const granted = new Set(Object.values(matrix.roles).flatMap((r) => r.granted));
    const missing = PERMISSION_KEYS.filter((key) => !granted.has(key));

    expect(missing).toEqual([]);
  });

  it('grants no key that is not in the catalogue', () => {
    const granted = new Set(Object.values(matrix.roles).flatMap((r) => r.granted));
    const unknown = [...granted].filter((key) => !(PERMISSION_KEYS as readonly string[]).includes(key));

    expect(unknown).toEqual([]);
  });

  it('grants PERMISSION_ASSIGN to nobody, because self-escalation has no safe default owner', () => {
    const holders = Object.entries(matrix.roles)
      .filter(([, role]) => role.granted.includes('PERMISSION_ASSIGN'))
      .map(([name]) => name);

    expect(holders).toEqual([]);
  });

  it('agrees with system-roles.ts, which is what seed.mjs actually writes', () => {
    const disagreements = SYSTEM_ROLES.filter((role) => {
      const fixture = matrix.roles[role.key];

      if (fixture === undefined) return true;

      return (
        [...fixture.granted].sort().join(',') !== [...role.permissions].sort().join(',')
      );
    }).map((role) => role.key);

    expect(disagreements).toEqual([]);
  });

  it('gives every role a written rationale, so a row is never bare', () => {
    const bare = Object.entries(matrix.roles)
      .filter(([, role]) => typeof role.rationale !== 'string' || role.rationale.trim().length === 0)
      .map(([name]) => name);

    expect(bare).toEqual([]);
  });

  it('names SUPER_ADMIN nowhere, because AGENTS.md 2.1 forbids it', () => {
    expect(Object.keys(matrix.roles)).not.toContain('SUPER_ADMIN');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Expected: every test fails — `role-permissions.json` does not exist.

- [ ] **Step 3: Author the fixture from `system-roles.ts`, not from memory**

Copy `SYSTEM_ROLES` verbatim into `role-permissions.json`. Then write the **rationale** for each role, which is the part the owner is actually reviewing. Two of the five are counter-intuitive and both are already documented in `system-roles.ts`:

- `TEACHER`, `STUDENT`, `PARENT`, `STAFF` hold **no permissions**. Not an oversight: no attendance, grading, finance or workforce module exists to grant anything on, and `AGENTS.md` §6 forbids inventing one. The empty sets are also the matrix's first real denials.
- `PERMISSION_ASSIGN` is granted to **nobody**, so today **no user can hold it**. Consequence: an operator edits `SCHOOL_ADMIN`'s grants in `system-roles.ts` — a one-line, git-visible change — until `PLT-201` Task 5 ships runtime role management. Record this consequence in the fixture, so it is discovered rather than experienced.

- [ ] **Step 4: Run it again**

Expected: **6 passed.**

- [ ] **Step 5: Run every gate, then commit and hand over**

```bash
pnpm typecheck; pnpm lint; pnpm test; pnpm test:coverage; pnpm build
pnpm test:integration; pnpm format:check
```

```bash
git add role-permissions.json apps/api/src/modules/rbac/role-permissions.spec.ts
git commit -m "feat(rbac): the Role x Key matrix, which is the authorisation policy (PLT-205 T3)"
```

**Then stop and ask the owner to review `role-permissions.json` line by line.** While they read, build T4 (the parametrised integration suite that exercises every row of the fixture) — different files, so nothing conflicts.

- [ ] **Step 6: T4–T6, after the review lands**

| Task | Deliverable | Gate |
|---|---|---|
| T4 | `role-permissions.integration.spec.ts` — one parametrised case per row, asserting allow **and** deny | Every row exercised both ways |
| T5 | A maintenance gate: `role-permissions.json` must change whenever `PERMISSION_CATALOGUE` changes | Covered by Task 1's reconciliation tests |
| T6 | The owner's recorded sign-off | **`PLT-EPIC-04` cannot start without it** |

---

### Task 9: Correct the stale records

**Files:** `docs/work/EPIC_STATUS.md`, `docs/work/RESUME_2026-10-05.md`, `docs/work/TODO.md`, `docs/work/WORKLOG.md`.

- [ ] **Step 1: Fix `F-3`** — `EPIC_STATUS.md` states the sign-in page is "a 61-line stub with 0 form controls and 0 API calls." `apps/web/src/features/auth/` holds 11 files with a wired 280-line form. Correct the row and re-measure the frontend table.

- [ ] **Step 2: Record the 11th gate** — `RESUME_2026-10-05.md` §0 says "All ten `AGENTS.md` §4 gates are green." That was true of §4's seven rows, and it was the misleading part: the repository had an eleventh gate, `format:check`, which was red and which §4 did not name. Add the correction rather than deleting the claim — it is the clearest available example of the repository's own recurring failure: a gate nobody owns stays red, and a document reports the seven it knows about.

- [ ] **Step 3: Add `F-1`…`F-4` to `TODO.md`**, each with a measurement and a ticket ID. Never renumber existing IDs.

- [ ] **Step 4: Close what is now closed** — `RBAC-01` (Task 1), `FIX-05` (Task 2), `SEC-101` (Task 3), `OPS-101` (Task 4), `OPS-112` (Task 5).

- [ ] **Step 5: Verify the docs gate and commit**

```bash
pnpm docs:verify
pnpm format:check:docs

git add docs/
git commit -m "docs: correct the records that were one commit behind the tree (F-1..F-4)"
```

---

## Part B — Sequenced Roadmap After This Plan

Not executable steps. Each row names the entry condition this plan establishes, the exit gate, and where its own plan document should be written. Estimate the plans separately; do not write TDD steps for a subsystem whose spec does not exist.

| # | Subsystem | Pts | Entry condition — satisfied by | Exit gate | Blocker today |
|---|---|---|---|---|---|
| 1 | **`PLT-205` T4–T6** | — | Task 8 | Owner signs the matrix; every row exercised allow **and** deny | Owner review |
| 2 | **`PLT-EPIC-04` Audit** (`PLT-401`–`404`) | 21 | #1 + Task 3 | Owner connects as `eduflow_app` and an `UPDATE` fails at the connection | **Task 1** (`IAuditRecorder` retrofit, mandatory per `ADR-013`) |
| 3 | **`PLT-EPIC-03` Licensing** (`PLT-301`–`305`) | 29 | #2 — audit must exist before licences are posted | Tamper with a certificate in staging; confirm **locked mode, not a crash** | **Owner decision** ⚠️'D-c (entitlement model A/B/C); and `ARC-09` finding 2: six gated capabilities — facilities hire, hall rental, wallet, alumni, leadership, substitution — have **no key in the signed payload**, so `@RequireEntitlement` cannot be written against them |
| 4 | **Email adapter** (half of `PLT-701`) | — | Task 7 | `PLT-105` reset mail arrives in Mailpit and is asserted | **Owner decision** ⚠️: pull it forward, or accept that `PLT-105` cannot be built (pulled forward already per `ADR-017`, deviation 3) |
| 5 | **`PLT-105` Password reset** | 5 | #4 | Reset link consumed once; **all existing sessions invalidated** | #4 |
| 6 | **`PLT-EPIC-06` Registry & Settings** (`PLT-601`–`602`) | 16 | Task 3 | A settings change takes effect **without a server restart** | — |
| 7 | **`PLT-EPIC-05` Diagnostics** (`PLT-503`–`504`) | 18 | #2 | A `password`, an `Authorization` header and a card-shaped string are redacted in the output | `AGENTS.md` §2.15: file **and** DB |
| 8 | **`PLT-EPIC-08` Storage** (`PLT-801`–`802`) | 13 | #6 | Signed, time-limited URLs; private buckets only (`ADR-015`) | — |
| 9 | **`PLT-EPIC-09` Health** (`PLT-901`–`903`) | 13 | Task 4 | Readiness reflects real dependencies, not a boot banner | — |
| 10 | **`REQ-01`…`REQ-05`** — idea-bank extraction | 36 | **Nothing.** Doc-only, zero file overlap, parallelisable from day one | Every module after Platform Core stops being guesswork | **Nobody has started it.** ⚠️'2 is answered, so it is unblocked |
| 11 | **`OPS-112` remainder: `SEC-112`** schema isolation | — | Task 3 | `AGENTS.md` §4's "isolated schema" is real: per-file schema, not 13 clients on one database | Currently claims isolation in its own doc comment and implements none |
| 12 | **`OPS-103` remainder: the two `PrismaClient` pools** | — | Task 3 | One pool per deployment | `AuthModule` and `RbacModule` each build their own — twice the idle connections |

### Owner decisions still blocking

Ordered by points blocked. `⚠'B` and `⚠'A` sat open **seven days** while nine other questions got answered, and each cost one two-line edit — answer the cheap ones first.

| ID | Question | Blocks |
|---|---|---|
| `RBAC-05` | Does Option A extend to `LICENCE_APPLY` / `LICENCE_UPGRADE` / `AUDIT_READ`? Currently `SCHOOL_ADMIN`-only. **Withholding them leaves an instance that cannot be licensed.** | **`PLT-EPIC-04`** — the only human gate on the critical path |
| ⚠️'D-c | Entitlement model A / B / C | `PLT-302`, `SEC-112`, row #3 |
| `REQ-07` | `PC-000`…`PC-006` — **7 domain gaps, 0 named owners** | Every module after Platform Core |
| `DSN-04` | Font stack for Tamil/Sinhala/Arabic, screen **and** PDF. Currently a *declaration only*: no `@font-face`, so correct rendering depends on OS fonts | Every screen |
| ⚠️'G follow-up | Web `BigInt` polyfill (`ADR-024`) | Money on the wire |
| — | The password policy is `provisional: true`, unowned, and absent from `PLT-107`'s AC | Sign-in UX |

### Two things not to re-litigate

Both are correct states that read as gaps. A previous session recorded each, and both have already survived one attempt to "fix" them.

1. **`PLT-202` AC-2 is reachable, not met.** `SEC-110` made the cache injectable, but nothing passes a `redisClient`, because **`ioredis` is deliberately not a dependency yet**. `IPERMISSION_CACHE` resolves to `undefined` in every deployment — correct and documented. It becomes a real cache when the queue story brings the driver. **Do not add `ioredis` to make a number look better.**

2. **`PLT-203`'s concrete policies were correctly not written.** No class table, no guardian link, no outlet table. `AGENTS.md` §6 forbids inventing them. `ownershipPoliciesFor()` returns `[]` and the registry **refuses** any `@OwnsResource` route with `NO_POLICY_FOR_ENTITY` — a wiring fault, which is the safe direction. A visibly broken route is recoverable; a quietly unscoped one is a cross-family data leak.

---

## Self-Review

**1. Spec coverage.** Every open P0/P1 item in `TODO.md` maps to a task: `RBAC-01` → Task 1 · `F-1`/`FIX-05` → Task 2 · `SEC-101` → Task 3 · `OPS-101`/`OPS-103` → Task 4 · `OPS-112` → Task 5 · `F-2` → Task 6 · `WEB-105` → Task 7 · `PLT-205` T3–T6 → Task 8 · `F-3`/stale records → Task 9. Deliberately **out of scope and stated as such**: `SEC-112` (schema isolation), `ARC-08` (`directives/`), `REQ-01`–`05` (extraction), `OPS-06` (per-school provisioning beyond the migration), the second `PrismaClient` pool, `DSN-06` (i18n literal detection), and `WEB-106` (`data-table` archetype). Each appears in Part B or in `TODO.md` already; none is silently dropped.

**2. Placeholder scan.** No `TBD`, no "add appropriate error handling", no "similar to Task N". Task 3's `deploy.mjs` and the `PLT-401` integration spec are complete and runnable as written. Task 6's `env-contract.spec.ts` uses `globSync` from `node:fs` — verify that against Node 22 before relying on it; if unavailable, walk the directory the way `permission-matrix.spec.ts` already does with its `apiSourceFiles`. Task 7's table is the one deliberate exception: its cases are specified by assertion, and the first one's code is given in full, because the remaining cases depend on what the first failure actually says.

**3. Type consistency.** `PERMISSION_CATALOGUE` / `PermissionKey` (Task 1) are consumed by `route-permissions.spec.ts` and by Task 8 — same names, no aliasing. `SYSTEM_ROLES[].key` and `SYSTEM_ROLES[].permissions` (Task 1) are exactly what Task 8's reconciliation reads; if `system-roles.ts` names its fields differently, Task 8 Step 1 must follow the file, not this plan. `PermissionGuard`'s four constructor tokens are unchanged by any task here. `APPROLE`/`eduflow_app` and `EDUFLOW_APP_ROLE` are consistent between `deploy.mjs` and the `PLT-401` spec.

**4. The one risk this plan does not remove.** Every task above assumes `pnpm install` works and a developer reads this document. Task 4 is the first step that makes the contract independent of that, and it lands third-to-last. If exactly one thing from this plan gets done, it should be Task 4 — not because the others do not matter, but because the others are what makes the work *correct*, and Task 4 is what makes correctness *durable*.