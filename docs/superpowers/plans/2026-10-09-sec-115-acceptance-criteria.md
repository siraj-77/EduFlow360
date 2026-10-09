# SEC-115 — Acceptance criteria: environment reconciliation

| Field | Value |
| --- | --- |
| Ticket | `SEC-115` (P0) — "env-var reconciliation, startup fail-fast" (`RESUME_2026-10-09.md:71`) |
| Status | **Criteria written 2026-10-09. Execution pending.** |
| Authority | **Code wins over docs** (roadmap C-2). `apps/api/src/config/env.ts` is the authority for variable **names**; `apps/api/src/config/env-files.ts` for **precedence**; `apps/web/src/lib/api-base-url.ts` for the web app's variable. |
| Scope | Document reconciliation plus **one genuine loader gap** (the Prisma CLI) plus **two adjacent defects** already ticketed but never closed (`FIX-08`/`G1-11`, `F-2`). **Not a build** — D46 (loader precedence) and D47 (Google OIDC all-or-nothing) are already implemented (`SSOT.md:253-264`, roadmap D-44). |
| Owner decisions | **None required.** Every criterion resolves against code-as-authority or an existing convention (`localdev` marker, the `OIDC_STATE_TTL_MS` documented-default precedent). |

Written before touching anything, per roadmap D-44: *"Write its acceptance
criteria before touching it, or it will be re-scoped twice."*

## 1. The measured state (evidence, 2026-10-09)

### 1.1 Three loaders, three opinions

| Loader | File(s) read | Precedence | State |
| --- | --- | --- | --- |
| API application | workspace-root `.env` then `.env.local` (`env-files.ts:150-153`) | `process.env` → `.env.local` → `.env` (D46) | implemented |
| Integration suite | repository-root `.env` only (`vitest.integration.config.ts:50-71`) | `process.env` wins (guard) | implemented; **comment's rationale is wrong** (AC-5) |
| Prisma CLI (`migration:run` / `migration:generate`) | `.env` **beside `schema.prisma`** (`apps/api/prisma/.env`) — **absent** | shell export only | **the gap** (AC-4): fails with `Validation Error Count: 1` until `DATABASE_URL` is exported by hand |

Measured file inventory: root `.env` holds `DATABASE_URL` only; `.env.local`
holds `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`; `apps/api/prisma/.env` does
not exist.

### 1.2 The variable reconciliation table

`env.ts` schema (28 keys) vs `.env.example` (28 vars) vs what code actually reads:

| Variable | `env.ts` schema | `.env.example` | Read by | Verdict |
| --- | --- | --- | --- | --- |
| `PORT` | ✓ default 3001 (`:42`) | ✓ `:71` | API boot | aligned |
| `DATABASE_URL` | ✓ `postgresql://` enforced | ✓ `:13` **placeholder** | API + Prisma | aligned; placeholder to resolve (AC-2) |
| `REDIS_URL` | ✓ | ✓ `:17` **placeholder** | API | aligned; placeholder (AC-2) |
| `STORAGE_ENDPOINT` / `_ACCESS_KEY` / `_SECRET_KEY` | ✓ | ✓ `:22-24` **placeholders** | API | aligned; placeholders (AC-2) |
| `STORAGE_BUCKET` | ✓ default `eduflow` | ✓ `:25` concrete | API | aligned |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ✓ ≥32 chars | ✓ `:30-31` **placeholders** | API | aligned; placeholders (AC-2) |
| `LICENSE_PUBLIC_KEY_PATH` | ✓ | ✓ `:36` **placeholder** | API | aligned; placeholder (AC-2) |
| `GOOGLE_CLIENT_ID` / `_SECRET` | ✓ all-or-nothing (D47) | ✓ `:56-57` **placeholders** | API | aligned; placeholders (AC-2) |
| `GOOGLE_REDIRECT_URI` | ✓ all-or-nothing (D47) | ✓ `:58` concrete | API | aligned |
| `OIDC_STATE_TTL_MS` | ✓ default 600000 | ✓ `:67` concrete | API | aligned |
| `NODE_ENV`, `LOG_LEVEL`, `LOG_DIR` | ✓ | ✓ `:70-73` concrete | API | aligned |
| `SCHOOL_ID` | ✓ UUID, optional, **no default** | ✓ `:84` **placeholder** | every repository | aligned; placeholder (AC-2) |
| `SESSION_TTL_MS`, `REFRESH_TOKEN_TTL_MS`, `LOGIN_MAX_FAILED_ATTEMPTS`, `LOGIN_LOCKOUT_MS`, `PASSWORD_MIN_LENGTH`, `PASSWORD_MAX_LENGTH`, `SETUP_MAX_ATTEMPTS`, `SETUP_ATTEMPT_WINDOW_MS` | ✓ | ✓ `:96-115` concrete | API | aligned |
| `WEB_ORIGIN` | **✗ not in schema** | ✓ `:118` | `main.ts:57` as `process.env.WEB_ORIGIN ?? DEFAULT_WEB_ORIGIN` — a **silent `??` default** | **defect** — closes `FIX-08`/`G1-11` (AC-1c) |
| `NEXT_PUBLIC_API_URL` | ✗ | ✓ `:121` | **nothing** | **defect** — documented but unread (AC-1a) |
| `NEXT_PUBLIC_API_BASE_URL` | n/a (web-side, browser-exposed) | **✗ absent** | `apps/web/src/lib/api-base-url.ts:61` | **defect** — read but undocumented (AC-1a) |
| `OIDC_CALLBACK_MAX_ATTEMPTS`, `OIDC_CALLBACK_WINDOW_MS` | ✓ defaults 20 / 600000 (`:341-351`) | **✗ absent** | `auth.module.ts:427-428` | **gap** — undocumented (AC-1b) |

Doc-only names that exist in planning prose and nowhere in code —
`WEB_PORT`/`API_PORT` (`PlatformCore_v2.md:1149,1154`),
`WEB_BASE_URL`/`API_BASE_URL` (`:1158`) — are reconciled by the Phase C/D
doc edits, not by code. The port decision itself is **closed by evidence**
(owner decision O-2): API **3001** (`env.ts:42`), web **3500**
(`web-port.ts`, asserted by `web-port.spec.ts:55`); the 3030/3031 in four
planning documents is stale prose.

### 1.3 Placeholders

`.env.example` ships **11 bracketed values** (lines 13, 17, 22, 23, 24, 30,
31, 36, 56, 57, 84). The roadmap's "12" counts the nested `<password>` token
inside `DATABASE_URL`'s value on line 13. The file's own header (`:6-8`)
declares *"the validator rejects one that is still a placeholder"* — true of
the **runtime** `.env` (`env.ts:28-37`, `PLACEHOLDER_PATTERN`), false of the
template itself. AC-2 makes the statement true of both.

### 1.4 The forbidden pair

`.env.local` defines `NEXTAUTH_SECRET` and `NEXTAUTH_URL`. NextAuth **is**
Auth.js; `.env.example:55` says *"Do NOT install Auth.js. Both of its
session strategies contradict ADR-008"*, and ADR-008 chooses JWT + refresh
rotation. `NEXTAUTH_SECRET` has no consumer anywhere in the tree.

## 2. Acceptance criteria

### AC-1 — One name per variable, consistent across template, schema and code

Every variable `.env.example` declares is read by code under the same name;
every variable code reads is declared in `.env.example`. Three concrete fixes:

- **(a)** `.env.example:121` `NEXT_PUBLIC_API_URL` is **renamed** to
  `NEXT_PUBLIC_API_BASE_URL` — the name `api-base-url.ts:61` actually reads.
  The old name is read by nothing; a deployment that set the documented name
  silently got `http://localhost:3001` (foundation-hardening F-2, 2026-10-07).
- **(b)** `OIDC_CALLBACK_MAX_ATTEMPTS` and `OIDC_CALLBACK_WINDOW_MS` are
  **added** to `.env.example` with their defaults and provenance comments
  matching `env.ts:319-351` (both are recorded gaps, no corpus source).
- **(c)** `WEB_ORIGIN` **enters the `env.ts` schema** with a documented
  default of `http://localhost:3500` (the `OIDC_STATE_TTL_MS` precedent:
  not a secret, a deployment value, a never-written configuration should
  produce the conservative answer rather than a boot failure), and
  `main.ts:57` reads it from validated config instead of
  `process.env.WEB_ORIGIN ?? …`. This closes `FIX-08`/`G1-11`
  (`ACTION_PLAN_2026-09-30.md:57`): no `??` on an env read remains.

**Verify:**

```powershell
Select-String -Path .env.example -Pattern 'NEXT_PUBLIC_API_URL'        # no matches
Select-String -Path .env.example -Pattern 'NEXT_PUBLIC_API_BASE_URL'   # one match
Select-String -Path apps\api\src\config\env.ts -Pattern 'WEB_ORIGIN'  # schema entry
Select-String -Path apps\api\src\main.ts -Pattern 'process\.env\.WEB_ORIGIN'  # no matches
pnpm --filter @eduflow/api test   # green, incl. the new WEB_ORIGIN schema test
```

### AC-2 — Zero unresolved placeholders in `.env.example`

All 11 bracketed values become **greppable, local-development-only** values
using the archive's `localdev` marker convention (roadmap C-2 Step 3):

```
DATABASE_URL=postgresql://eduflow_dev:localdev@localhost:5432/eduflow_dev
JWT_ACCESS_SECRET=localdev-only-not-a-real-secret-0000000000000000
JWT_REFRESH_SECRET=localdev-only-not-a-real-secret-1111111111111111
```

`AGENTS.md` §11 forbids real-looking examples in tracked files; the
`localdev` marker is greppable and obviously fake, which is the point. The
header comment is reworded to state precisely what the validator does: it
rejects a placeholder in the **runtime** `.env` (`env.ts:28-37`), and this
template ships none. The template's `EduFlow` → `EduFlow360` comment rename
(C-2 Step 3) is included.

**Verify:**

```powershell
Select-String -Path .env.example -Pattern '<.*>'   # no matches
pnpm --filter @eduflow/api test                    # green — env.spec.ts:45 and
                                                   # env-oidc.spec.ts:55 still prove
                                                   # the RUNTIME rejection of placeholders
```

### AC-3 — No `NEXTAUTH_*` anywhere, and no Auth.js dependency

`.env.local` is **deleted** (gitignored; local-only). It carries the
forbidden pair, the leaked Google secret, and the only copy of the real
Google credentials — which must be re-entered from the Google console into
the recreated root `.env` (they are not in the repository, by design).
`.env` is recreated from the rewritten `.env.example` in `KEY=value` form,
no spaces around `=`.

**Verify:**

```powershell
Select-String -Path ".env*" -Pattern "NEXTAUTH"   # no matches
Select-String -Path "package.json","apps\*\package.json","packages\*\package.json" -Pattern "next-auth|@auth/core"   # no matches
```

### AC-4 — `pnpm migration:run` works with no hand-exported `DATABASE_URL`

In a fresh shell with no `DATABASE_URL` in the environment, the command
applies pending migrations (or reports none pending) and exits 0, without
Prisma's `Validation Error Count: 1`. The Prisma CLI reads `.env` beside
`schema.prisma` (`apps/api/prisma/.env`, absent), so the root `migration:run`
script — or the `@eduflow/api` script it delegates to — must load the
repository-root `.env` before the Prisma CLI runs. The same fix covers
`migration:generate`. Implementation choice (wrapper script vs Prisma's own
env-file flag, if the installed version has one) belongs to execution; the
observable behaviour is the criterion.

**Verify:**

```powershell
Remove-Item Env:\DATABASE_URL -ErrorAction SilentlyContinue
pnpm migration:run   # exits 0, no "Validation Error"
```

### AC-5 — The `vitest.integration.config.ts` comment matches D46

The comment (`:26-27`) claims `process.loadEnvFile()` *"overwrites existing
keys"*. That is **false** — measured on Node 26.7.0, and SSOT D46 records
that a test caught the opposite assumption before it shipped. The guard is
still correct; only its rationale is wrong. The comment is rewritten to the
measured behaviour: the loader does **not** overwrite, so an exported or
CI-injected value wins either way, and the guard exists to **fail fast with
a message that names the variable** — not to protect precedence.

**Verify:**

```powershell
Select-String -Path apps\api\vitest.integration.config.ts -Pattern "overwrite"   # no matches
pnpm test:integration   # green (240 tests)
```

### AC-6 — The reconciliation is committed as evidence

The table in §1.2 — every variable, its schema entry, its template line, its
reader, its verdict — is committed with the change (this document plus a
`WORKLOG.md` entry), so the "24 of 28 `.env.example` vars are undocumented
in the planning docs" lag (roadmap D-09) has its baseline and the Phase C/D
doc edits can close it against a measured table rather than a re-derived one.

**Verify:** this file exists; `WORKLOG.md` carries the entry; every row of
§1.2 has a verdict.

## 3. Amendments to roadmap Task C-2 (the sketch is stale against the recovered code)

1. **C-2 Step 2's conflict table is wrong about "code".** It lists
   `WEB_PORT`/`API_PORT` as the code's names. Those exist in planning prose
   only. The code's names are `PORT` (API, `env.ts:42`) and
   `NEXT_PUBLIC_API_BASE_URL` (web, `api-base-url.ts:61`). §1.2 above is the
   corrected table.
2. **C-2 Step 5's tests reference an API that does not exist.**
   `loadEnv({ nodeEnv: 'development' })` and `SEED_SUPERADMIN_PASSWORD` are
   not in the recovered code. The real API is `loadConfig(env)`
   (`env.ts:417`), and no seed-password variable exists in the schema. Any
   RED-first test must be written against `loadConfig`.
3. **C-2 Step 3's `localdev` convention is adopted** (AC-2).
4. **C-2 Step 4's `.env.local` deletion is adopted**, with the
   Google-credential re-entry note (AC-3).
5. **C-2's "12 placeholders" is 11 bracketed values** (§1.3).

## 4. Explicitly out of scope

- **Credential rotation** (the leaked `thk_live_` gateway token and `GOCSPX-`
  Google secret in `New folder.7z`, and the live `NEXTAUTH_SECRET` that dies
  with `.env.local`) — roadmap Phase 2, tasks A-1/A-2. Deleting `.env.local`
  removes one copy from the working tree; it does not rotate anything.
- **The SSOT Naming-legend find-and-replace** (`SSOT.md:424-437` applied to
  `PlatformCore_RBAC_v2.md`, `SchoolSetup_Academic_v1.md`,
  `School_Setup_Workflow_v1.1.md:10`) — `RESUME_2026-10-10.md` item 2, a
  separate mechanical task.
- **The port decision** — closed by evidence (O-2, §1.2). Only the stale
  prose edits remain, in Phase C/D.
- **`format:check:docs`** (fails on 60 files, CI never runs it) — hygiene,
  separate ticket.

## 5. Definition of done

All six verification blocks green, plus the full gate set on the commit:
`pnpm typecheck` · `pnpm lint` · `pnpm test` (1,432) · `pnpm test:coverage`
· `pnpm test:integration` (240) · `pnpm docs:verify` · `pnpm check:route-guards`
· `node scripts/check-coverage-tiers.mjs`. `WORKLOG.md` and `TODO.md` updated
in the same commit (`AGENTS.md` §9).
