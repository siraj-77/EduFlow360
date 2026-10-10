# TODO — Next Actions

> ## 🆕 UPDATED 2026-10-09 (later session) — tree restored, all 14 gates measured green
>
> The working tree had been reduced to 25 files with no `.git` and no source code. It has
> been recovered from the archive and **pushed to `https://github.com/siraj-77/EduFlow360`**
> (the repo was renamed `EduFlow` → `EduFlow360`; every clone's old `origin` 404'd, so the
> 88-commit history existed only inside a 217 MB archive).
>
> - `main` is clean, in sync with `origin`, and pushed; **91 commits**, of which the
>   first 88 predate this session. Verified by a fresh clone of `EduFlow360`.
> - **All 14 gates green on a clean install**, re-measured — not carried over:
>   install · prisma generate · typecheck 8/8 · lint 8/8 · format:check · unit **1,432** ·
>   coverage 8/8 · build 9/9 · migration:run · integration **240**/14 files · e2e **37/37** ·
>   docs:verify 256 refs · check:route-guards 83 files · check:coverage-tiers.
> - Full evidence: **`docs/work/GATE_RESULTS_2026-10-09.md`**.
> - The 44-item technical-debt register and the 10-row cross-document contradiction matrix
>   are in **`docs/superpowers/plans/2026-10-09-strategic-roadmap-v2.md`**.
>
> **Read before starting work — two things the setup docs did not say:**
> 1. `pnpm install` does not generate the Prisma client. Run
>    `pnpm --filter @eduflow/api exec prisma generate` or `pnpm typecheck` fails with
>    `no exported member 'PrismaClient'`. This is deliberate (`ci.yml:35-38`) but was
>    undocumented; the README now records it.
> 2. `pnpm migration:run` needs `DATABASE_URL` **exported in your shell** — the Prisma CLI
>    reads `.env` beside `schema.prisma`, not the repository root. Part of `SEC-115`.
>
> **The one-line version:** the project is whole, version-controlled and pushed for the
> first time. The next task is still **`SEC-115`** (env reconciliation), and the highest-value
> thing before any new feature is to read **`docs/core/SSOT.md`** (157 KB) — it may already
> settle the doc-generation conflicts that the debt register lists as open.
---

> **Resume note is in `docs/work/RESUME_2026-10-10-session-3.md`**
> (close of the `PLT-204` + `PLT-205-T3` session; supersedes
> `RESUME_2026-10-10-session-2.md`, whose "what is next #1" —
> execute `SEC-115` — is done).
> **Measured gate evidence: `docs/work/GATE_RESULTS_2026-10-09.md`.**
> **Debt register and roadmap: `docs/superpowers/plans/2026-10-09-strategic-roadmap-v2.md`.**
> **Read section 2 before starting work:** `pnpm test:integration` was flaky and
> the failure was inside the setup-token concurrency test. Its owner was
> `SEC-112` — **DONE 2026-10-10**: the integration config now runs the 14
> files sequentially (`fileParallelism: false`) over one bounded pool
> (`connection_limit=15`), and the suite is green (240/240, 14 files, 36.5s).

**Last updated:** 2026-10-10 (`PLT-204` + `PLT-205-T3` complete, all gates green; `SEC-112`/`OPS-105`/`OPS-106` and `SEC-115` pushed earlier today)
**How to use:** the topmost unchecked item is the next task. Log completion in `WORKLOG.md` in the same commit.

> ## ✔ DONE 2026-10-09 — Phase 0: uncommitted state adjudicated
>
> Four uncommitted changes were ruled on with evidence and preserved, not
> discarded. The uncommitted `AGENTS.md` rewrite — which falsely claimed
> "pre-scaffold, no application code exists" against a 168-file API tree,
> and cited a non-existent `ADR-003-fresh-build-single-tenant.md` — was
> **reverted on `main`**; the committed, corrected `AGENTS.md` (DOC-100,
> 2026-10-05) is the contract again. The old template deletion was **not
> applied** (it would break `docs:verify`: `FRONTEND_TEMPLATE.md:3` and
> `SSOT.md:118` reference the file). Prompt Pack v2 and the new ERD/DFD/UML
> diagram were **parked, not imported** as authority. The entire uncommitted
> state is preserved on branch **`docs/phase0-snapshot-2026-10-09`**
> (`753498c`) for Phase C adjudication. Gates re-verified on `main`:
> typecheck 8/8 · docs:verify 256 refs · route-guards 83 files ·
> coverage-tiers OK. Full record: **`docs/work/WORKLOG.md`** (2026-10-09
> entry).

> ## ✔ DONE 2026-10-09 — Phase 1: `SEC-115` acceptance criteria written
>
> Six criteria with runnable verification commands, written against the
> **measured** state (not the roadmap's stale C-2 sketch): **AC-1** one
> name per variable (`NEXT_PUBLIC_API_URL`→`NEXT_PUBLIC_API_BASE_URL`;
> `OIDC_CALLBACK_*` documented; `WEB_ORIGIN` into the `env.ts` schema,
> closing `FIX-08`/`G1-11`'s silent `??` in `main.ts:57`) · **AC-2** zero
> placeholders (11 bracketed values → greppable `localdev` values) ·
> **AC-3** no `NEXTAUTH_*` (`.env.local` deleted) · **AC-4**
> `pnpm migration:run` with no hand-exported `DATABASE_URL` (the one
> genuine loader gap) · **AC-5** the `loadEnvFile` comment matches D46
> (its "overwrites" claim is false — measured Node 26.7.0) · **AC-6** the
> reconciliation table committed as evidence.
> Full document: **`docs/superpowers/plans/2026-10-09-sec-115-acceptance-criteria.md`**.
> No owner decision was required.

> ## ✔ DONE 2026-10-10 — `SEC-115` executed (all six ACs closed) and pushed
>
> AC-1 (a/b/c), AC-2, AC-4 and AC-5 are complete and verified against
> the measured state, TDD-first. **AC-3 resolved by owner decision
> 2026-10-10: keep `.env.local`** — this is a dev machine and development
> is just starting, so the file (the only copy of the real Google OIDC
> credentials) stays. The criterion's substance holds in the committed
> tree: `NEXTAUTH_*` keys are absent from every tracked file and
> `.env.local` is git-ignored, so no `NEXTAUTH_*` value is committed.
> Full record: **`docs/work/WORKLOG.md`** (2026-10-10 entry). All
> eleven gates green. Committed and pushed to `origin/main`.
>
> ## ✔ DONE 2026-10-10 — `PLT-204` + `PLT-205-T3` (frontend permission-aware UI)
>
> The web half of the `PLT-EPIC-02` critical path, TDD-first.
> API: `GET /permissions/me` (`PERMISSION_READ_OWN`, granted to
> all five system roles) returns the caller's own effective keys —
> the authenticated principal only, no `userId` parameter to forge.
> Web: pure wire contract (`permissions-request.ts`),
> `PermissionsProvider`/`usePermissions` (fail-closed
> `has`/`hasAny`/`hasAll`), `PermissionGate`, `RequirePermission`
> (loading→Skeleton, denied→`/{locale}/forbidden`, unauthenticated→
> `/{locale}/sign-in`, error→null), localized `/forbidden` page,
> i18n in en/ta/si/ar. `PLT-205-T3`'s over-HTTP negative test
> proves a second account cannot read the first's permissions.
> API rbac 14 files/209 tests; web rbac 4 files/42 tests; the
> four new web source files at 100% coverage. Full gate set green
> (typecheck 8/8 · lint 8/8 · unit all packages · coverage tiers ·
> build 9/9 · integration 255/15 files · e2e 37/37 · route-guards
> 85 files · docs:verify 260 refs · format:check). Full record:
> **`docs/work/WORKLOG.md`** (2026-10-10 entry).
>
> ## ▶ NEXT — the milestone-1 critical path continues
>
> `PLT-EPIC-02` remainder: `PLT-204`'s T2-S3/T3-S3 owner
> visual-approval steps (not code). Then **`PLT-EPIC-03`**
> (enforce `@RequireEntitlement`) — **blocked on owner decision
> `⚑D-c`** — and **`PLT-EPIC-04`** (make `@Audited` write, wire
> `audit-immutability.sql`). The six blocking designs `PC-000`…
> `PC-006` (`AGENTS.md` §6.1) gate every feature module.
> Separately, the Phase C remainder (credential rotation A-1/A-2
> is the natural immediate follow-up while `.env.local` is retained,
> doc-delta register, Auth.js proof C-3, stale port-prose edits
> C-4, archive redaction A-4/A-5).

> ## ▶ START HERE — `docs/work/RESUME_2026-10-09.md`
>
> Written at the close of 2026-10-09 (EPIC-B session). It carries the
> measured state, the EPIC-B remainder in order, the open owner
> decisions, and the OPS-103 / OPS-112 evidence.
>
> **The one-line version:** `main` is clean and in sync at `5b4b466`,
> 87 commits, **all ten gates green**, CI runs all ten gates on every
> push (`OPS-101`), `pnpm build` gates on typecheck and lint
> (`OPS-103`), and the three `OPS-112` flakes are fixed (guard specs:
> `testTimeout` headroom; Playwright: the `.next` wipe is chained
> before `dev` as the named `dev:e2e` script). **The next task is
> `SEC-115`** (env reconciliation) — plus one owner decision: repo
> public or GitHub Pro so `CI` can be an enforceable *required* check
> (`F-15`).

> ## ✔ DONE 2026-09-30 — `D-4.1`, multi-role (`UserRole` join)
>
> The owner confirmed a user may hold multiple roles. Applied and proved against a real
> database: `UserRole` is the fifteenth model, `User.roleId` is gone, and permissions **union**
> across a user's roles with no primary-role flag, because `AGENTS.md` §2.3 makes the
> permission the only thing that gates a route. Proof: 12/12 integration against PostgreSQL 18.4.
>
> ---
>
> ## ✔ DONE 2026-09-30 — `ADR-024` and `PLT-107` written
>
> - **`ADR-024`** — the `Money` wire format: decimal string on the wire plus a branded
>   client type that cannot be built from a bare `number`. Amends `ADR-002`. Blocks `PLT-301`,
>   `PLT-302`. Web decision is native `bigint` on `target: ES2020`, no polyfill.
> - **`PLT-107`** — first-admin bootstrap: a one-time, single-use, expiring, audited setup
>   token on the one `INVITED` user. **Not a seed script.** The seed still writes
>   `passwordHash = null`, so there is no credential to bypass.
>
> ---
>
> ## ✔ DONE 2026-09-30 — `PLT-101` tranche 1: the `ExternalIdentity` model
>
> The sixteenth model, and applied the same way `UserRole` was: all three registration
> points updated in one commit (`PLATFORM_CORE_MODELS`, `PLATFORM_CORE_ENTITIES`, `CLUSTER`),
> then proved rather than asserted. 16 tables / 13 foreign keys against real PostgreSQL.
>
> **The decision that shaped it: identity keys on the provider `sub`, never on the email.**
> `providerEmail` is a snapshot and is deliberately not unique, because two unrelated
> people can share an address and merging them would combine two families’ children
> (`AGENTS.md` §2.13). `@@unique([schoolId, provider, providerSubject])` plus a test that
> keeps two same-address people as separate accounts.
>
> **`provider` is a column, not a table per provider** (owner: Google first, more expected),
> so Microsoft later is a row and not a migration. No Auth.js: `ADR-008` forbids it, and the
> `Session`/`RefreshToken` pair already exists for reuse detection.
>
> ---
>
> ## ▶ NEXT — `PLT-101` tranche 2: the OIDC flow itself
>
> Nothing above is a login yet. Still to build: `IOidcProvider` / `IOidcClient` ports and the
> Google adapter, authorization-code exchange, the callback route, state/nonce/PKCE, and
> session issuance on success.
>
> **Two things only the owner can answer, neither of which blocks starting:**
>
> - the allowed email domain — **ANSWERED 2026-10-02 (D49): per-school list in
>   `SchoolSettings`, fail-closed when empty, never an env var. `ADR-003` is one deployment
>   per school, so there is no single product-wide domain.
> - Workspace tenant or consumer Gmail — decides the consent screen and whether
>   `email_verified` is asserted
>
> Real Google end-to-end also needs client credentials and redirect URIs configured locally.
> Secrets must never be sent in chat or committed.
>
> **Then:** `B-2` theme toggle (last hollow gate, `AUD-30-04`) → wire
> `audit-immutability.sql`, since **`audit_records` is still mutable** → make the
> integration gate load `.env` (see below).
>
> ---
>
> ## ✔ DONE 2026-10-01 — housekeeping: the integration gate can reach its own database
>
> `DATABASE_URL` lives in the git-ignored `.env` and nothing loaded it, so on a clean
> shell `pnpm test:integration` died as a collection error telling the developer to set
> a variable no tool read. Every earlier green observation of this gate came from a
> reviewer exporting it by hand, which hid the defect. The config now loads the root
> `.env` with Node's built-in `process.loadEnvFile()`. **No dependency added.**
>
> Three properties, each proven rather than asserted: an already-set `DATABASE_URL`
> wins (so CI stays deterministic); the path is anchored to the config file, not the
> working directory; and a missing variable throws at start-up naming it
> (`AGENTS.md` §11). Regression guards in `integration-gate.spec.ts` were verified
> non-vacuous by removing the loader and watching them fail.
>
> ---
>
> ## ▶ UNBLOCKED 2026-10-02 — `PLT-101` tranche 2 may start
>
> **Owner cleared the sign-off gate and approved `jose`** for ID-token verification on
> 2026-10-02. That was the whole of the engineering block.
>
> ### ⚠ Still missing, and it is not a decision
>
> **No provider credentials exist in this repository.** A sweep on 2026-10-02 searched every
> `.env*`, `.json`, `.ts`, `.js`, `.mjs` and `.yml` file outside `node_modules`: there is no
> `GOOGLE_CLIENT_ID`, `MICROSOFT_CLIENT_ID` or `APPLE_CLIENT_ID` anywhere. `.env` holds only
> `DATABASE_URL`.
>
> `.env.local` holds `DATABASE_URL`, `NEXTAUTH_SECRET` and `NEXTAUTH_URL` — **legacy
> values from `EduFlowV3`**, not the new credentials; `.gitignore:2` already flags that file as
> a legacy leftover. The two NextAuth variables should be deleted: `ADR-008` rules out Auth.js, so
> `NEXTAUTH_SECRET` has no consumer and is a live secret on disk for no reason. **Neither file is
> tracked** — `.env` is ignored by rule 7 and `.env.local` by rule 8, so nothing leaks.
>
> The keys tranche 2 expects:
>
>     GOOGLE_CLIENT_ID=
>     GOOGLE_CLIENT_SECRET=
>     GOOGLE_REDIRECT_URI=http://localhost:3001/auth/oidc/callback
>
> ### Scope question: three providers, or one?
>
> Credentials are prepared for Google, Microsoft **and** Apple. The recorded decision (owner,
> 2026-09-30) is **"Google first, more providers expected"**, and `provider` is a **column**
> precisely so that Microsoft or Apple later is a row and not a migration. So holding the
> credentials costs nothing — but building three providers is three times the surface and only
> one would be tested. **Recommendation: build Google, leave Microsoft and Apple as
> configured-but-unimplemented**, and prove the seam with a test rather than assuming it.
>
> ### Where tranche 2 actually stands (2026-10-02, after `028bb90`)
>
> ✔ **DONE — `IClock`.** `apps/api/src/modules/auth/domain/ports/clock.ts`, the
> `SystemClock` adapter, and a shared `FakeClock` in `src/testing/`. The ESLint rule that
> banned ambient time had no other side for days; this is it.
> ✔ **DONE — `IOidcProvider` + `GoogleOidcProvider`** on `jose` 6.2.12. Both external
> seams injected, so 20 cases run against a locally generated RSA key with no network
> and no Google project, while still exercising real signature verification. Each of the
> five checks has a forgery aimed at it.
> ✔ **DONE — the refresh-token reuse decision.** `decideRotation`, pure and
> table-driven, 12 cases. `revoke-family-reuse` is provably the only verdict with a side
> effect, reachable only on an already-used token in a live session and family.
>
> ### ✔ DONE 2026-10-02 — `ISessionRepository` + Prisma, and `sessions.token_hash`
>
> `PrismaSessionRepository` issues, rotates, revokes and sweeps. **29 integration tests**
> against real PostgreSQL, up from 17. Neither token is stored: `issue` and `rotate` mint
> 256-bit random strings, hand the plaintext over once, and keep only SHA-256.
>
> The reuse claim is proved against a real database rather than asserted: replaying a spent
> token yields `revoke-family-reuse`, and after `revokeFamily` the family has **zero** live
> tokens. A fake repository could not demonstrate atomicity, which is exactly the thing under
> test.
>
> **`sessions.token_hash` added** (D50). The model had a hashed refresh token and nothing on
> sessions, so the cookie value would have been a primary key. A field, not a model, so the
> three model tripwires were untouched.
>
> ### ⚠ STILL NOT DONE — `AGENTS.md` §2.3 needs both halves before a route exists
>
> **`Session`/`RefreshToken` repository.** The decision rule exists; nothing reads or writes
> the two tables yet. Still needed: the port, the Prisma implementation, token hashing at
> rest (`token_hash` is NOT NULL — a bearer credential cannot be stored in the clear),
> the `familyId` rotation chain, and integration tests against real PostgreSQL proving
> reuse actually revokes the family.
>
> **`@Public` and the redirect/callback routes.** The two blocking decisions are ANSWERED (D48,
> D49). What remains:
> security choices rather than implementation details:
>
> **What remains, now that D48 and D49 are answered:**
>
> ✔ **DONE — the four decorators and `check-route-guards`.**
> `@Public('<reason>')`, `@RequirePermission`, `@RequireEntitlement` and `@Audited` exist, and
> a tenth gate `pnpm check:route-guards` fails on a route carrying neither a permission nor a
> public exemption. Proven by injecting a real unguarded controller and watching the build fail.
> **Still NOT enforced: what the decorators MEAN.** No global guard reads the metadata yet, so a
> guard can be present and inert. The reader needs a permission engine (`PLT-2xx`), session
> resolution and licence verification, none of which exist.
>
> - **The cookie delivery adapter.** `SameSite=Lax`, `Secure`, `httpOnly`, path `/`, plus a
>   required custom header on state-changing requests as CSRF defence in depth.
> - **The allowlist setting** in `SchoolSettings`: a list, fail-closed when empty, and account
>   creation gated on `email_verified === true`.
> - **The identity-to-user resolution**, which needs `PLT-107` — a fresh install has no local
>   `User` for an identity to attach to. That story is written and is a real dependency, not
>   something the callback route can route around.
>
> **Guessing on either would be the wrong trade.** A route that is nearly right is harder
> to review than no route, because it invites the assumption that the security was checked.
>
> ### Order once those are answered
>
> 1. `ISessionRepository` port → Prisma implementation → integration tests proving
>    reuse revokes a whole family against real PostgreSQL
> 2. `@Public` decorator and its guard, with the allowlist `AGENTS.md` §2.3 requires
> 3. `GET /auth/oidc/redirect` → `GET /auth/oidc/callback`
> 4. The sign-in button in `apps/web`, then `PLT-104` OTP is milestone 2
>
> Nothing above touches a browser until 2 and 3, and 3 needs the two answers.

---

## S1 - 2026-10-05 session - ENV-101, DOC-100, WEB-05, SEC-110

Everything below is **measured**, not asserted. All ten `AGENTS.md` §4 gates were run with the cache
bypassed; the numbers in `RESUME_2026-10-05.md` come from those runs.

### Closed 2026-10-05

- [x] **ENV-101** · P0 · **DONE.** `pnpm install` had been failing with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` — every `node_modules` symlink still resolved to the pre-rename project directory, so pnpm wanted to purge the modules dir and refused without a TTY. `CI=true` (which pnpm's own error message names) recreated the tree: 676 packages, 0 stale symlinks, all 6 `allowBuilds` postinstalls resolving. **`prisma generate` is a separate step the install does not run** — `prisma/generate.mjs` only writes and formats the text file. Until this was fixed **no number in any document was verifiable**.
- [x] **DOC-100** · P0 · **DONE** (owner approval of ⚑'B, ⚑'A, ⚑N4, ⚑2). Six documents asserted the absence of application code; all corrected. ⚑2 in particular: `docs/archive/corpus/` never existed and three documents were arguing about it, which was gating 36 points of extraction.
- [x] **WEB-05** (was going to be `DSN-05`, **renumbered — see the collision note below**) · P0 · **DONE.** The one-click theme toggle. TDD: RED `41725ca`, GREEN `fc90fde`. **Closed `OPS-102`**, which was the only red gate in the repository: `pnpm test:coverage` is green for the first time, 8/8, exit 0.
- [x] **SEC-110** · P0 · **DONE.** `app.module.ts` built `PermissionGuard` with **two of four** constructor arguments. TDD: RED `bb1fd49`, GREEN `267e174`.

### Open, raised 2026-10-05

- [x] **SEC-101** · P0 · **DONE 2026-10-08** (`9bb3e96`). Baseline migration `0000_baseline` (497 lines: 8 enums, 16 tables, 36 indexes, 13 FKs) + `deploy:db` + `verify:baseline` (shadow-DB diff empty) + DB-level `PLT-401` append-only proof (5 tests; integration 235→240). Caught the `CRRITICAL` enum typo no prior gate saw.
- [x] **OPS-101** · P0 · **DONE 2026-10-08** (`f1511d5` + `f514cbe` F-14 fix + `fab6489` + `2712f74`). `.github/workflows/ci.yml` — all ten gates on every push to any branch. AC 1 proven (run `37830464218` green on main); AC 2 proven (broken branch commit failed run `37831524370`). **T3 blocked — `F-15`:** required status checks need GitHub Pro on a private repo (`gh api` → 403); owner decision pending.
- [x] **OPS-103** · P0 · **DONE 2026-10-09** (`53ad6b0`). `turbo.json` `build.dependsOn` gains `typecheck` and `lint` beside `^build` — `pnpm build` now runs both for every package before any build (9 tasks, 49.4s, vs 5 tasks / 17.75s ungated). TDD: RED A observed (build exited 0 while eslint exited 1 on the same tree — a *used* explicit `any`, an eslint error that is legal TS); GREEN A (build fails at `@eduflow/api#lint`). The typecheck RED was structurally impossible — every build in this repo already typechecks (`nest build` runs tsc, `next build` type-checks, leaf packages' `build === tsc --noEmit`): finding `F-16`, the plan's premise that build succeeds on type errors is false here; the ungated gate was lint. Tests still do not gate `build` (the plan's scope; CI runs them before build in fail-fast order).
- [x] **OPS-112** · P1 · **DONE 2026-10-09** (`5b4b466`). Three flakes, two fixes, two plan corrections. (a) The two guard specs: the plan's cache-warmup polling (`readCacheKeys`/`cacheKeyFor`) does not map to the code — the specs inject synchronous in-memory doubles with no warmup state, and the cold `pool exhausted` at `permission-cache-over-http.spec.ts:383` is a deliberate fixture (a DB failure must surface as 500, never 403). The claimed ~1-in-5 cold rate did not reproduce (20/20 isolated, 10/10 cold full-suite; 1 unexplained failure in 11 cold runs). The only cold-sensitive resource is wall-clock under parallel vitest workers → `testTimeout: 30_000` in `apps/api/vitest.config.ts` (same headroom reasoning as the Playwright 90s budgets). (b) `playwright.config.ts`: the `.next` wipe is chained into the `webServer` command before `dev`, extracted to the named `apps/web/scripts/clean-next.mjs` via the new `dev:e2e` script. A `globalSetup` wipe was tried first and **failed 27/37** — Playwright starts the webServer plugin BEFORE `globalSetup` (runner task order, `@playwright/test@1.63.0`), so the wipe deleted `.next` out from under the running dev server (`ENOENT routes-manifest.json`, webpack pack-cache ENOENTs); the chained form passes 37/37. e2e verified 3/3 after the fix. The plan's Step 1 was a no-op against the real code and its Step 2 comment misdescribed Playwright's execution order — both corrections are recorded in the WORKLOG entry.
- [x] **SEC-112** · P1 · **DONE 2026-10-10**. `vitest.integration.config.ts` now implements the controls that exist: `fileParallelism: false` (the 14 spec files run sequentially against the one CI database — the owner of the setup-token concurrency flake noted above) and `connection_limit=15` appended to the pooled `DATABASE_URL` (14 per-file `PrismaClient`s share one bounded pool). The doc comment was corrected to describe what is implemented; per-schema isolation was **not** invented — `AGENTS.md` §4's "isolated schema" wording is a documentation gap in `ARCHITECTURE.md` §17, recorded in this session's WORKLOG entry, not a control to fake. Integration verified green: 240/240, 14 files, 36.5s.
- [x] **OPS-105** · P1 · **DONE 2026-10-10**. `.gitleaks.toml` (new) extends the default rule set; allowlists `.env.example` (all-`localdev` markers per `AGENTS.md` §11) and the ephemeral CI Postgres service credentials. The 8 secret-shaped test fixtures migrated to `localdev` markers; the 3 pre-scan historical values are allowlisted by regex (history is immutable and shared — not rewritten). CI `secrets` job: full-history checkout (`fetch-depth: 0`) + gitleaks CLI v8.30.1 pinned by version and archive SHA256 (the Action needs a licence on private repos; the CLI does not). Verified: 97 commits scanned, no leaks found, exit 0 (was 7 findings before the migration).
- [x] **OPS-106** · P1 · **DONE 2026-10-10**. `"prepare": "husky"` in the root `package.json`; `husky@^9` + `lint-staged@^15` at the workspace root. `.husky/pre-commit` → lint-staged (`lint-staged.config.mjs`: `prettier --check` on every staged file + ESLint **per package** with `--max-warnings=0` — each package owns its `eslint.config.mjs`, and ESLint from the repo root fails, so staged files are grouped by package and linted with the package as CWD). `.husky/commit-msg` → `scripts/check-commit-message.mjs` (new): Conventional Commits, eleven types, subject ≤ 72 chars, mandatory requirement ID (`AGENTS.md` §9). `.husky/_` gitignored. Verified: `core.hooksPath` → `.husky/_`; lint-staged end-to-end on 19 staged files, exit 0; commit-msg validator 4/4 cases.
- [ ] **DOC-101** · P0 · **`scripts/report-status.mjs`.** Still the highest-leverage single item. **Eight documents already cite it as though it exists.** Today's session added a *fourth* wrong number to the record (`1,401` unit tests, when the measured figure is `1,431`) — which is the point: hand-maintained numbers decay faster than they can be corrected.
- [x] **RBAC-01** · P0 · **DONE 2026-10-08** — the 40-path WIP tree landed as three commits (`fdfcda2` `feat(rbac)` 27 files · `0b2021d` `feat(web)` 24 files · `6b6e5ad` `docs` 4 files); every gate verified green before committing.
- [ ] **WEB-105** · P1 · **`tests/e2e/sign-in.spec.ts` does not exist**, though `sign-in-form.spec.tsx:23` names it as the place keyboard, focus-order and click-on-submit are asserted. Nothing exercises the sign-in form or the new theme toggle over HTTP.
- [ ] **WEB-106** · P1 · **`data-table` archetype.** Every list screen in the ERP needs it; `AGENTS.md` §3.2.2 requires horizontal scroll or a card layout on mobile and the bare `Table` does neither.

### The ID collision, recorded because it already bit once

`DSN-05` **is already taken** in this file — it reads *"prefers-reduced-motion, 44px touch targets — done
2026-09-29"*. The theme toggle was planned as `DSN-05` in the 2026-10-05 action plan and was
renumbered **`WEB-05`** on landing, because `docs/work/TODO.md` and the handoff note were using
the same ID for two different things within one session.

This is `DOC-106` — three parallel ticket namespaces, no mapping — **observed rather than
predicted**, and it is the cheapest possible evidence that the unification is worth doing.
See `WEB-05` and `DSN-05` above for the two different items that collided.

## G0 — Commit the work that exists ✅ **DONE 2026-09-30**

> **Added 2026-09-30.** `SSOT.md:16` said _"8 commits, working tree clean."_ Measured: **14 commits, 15 modified, 12 untracked.** The entire ARC-01 ERD, the FIX-01/02/22 fixes, the 11-test e2e suite and every doc change from the last 24 hours exist **only in the working tree** and have never been pushed. A TDD checkpoint that is never committed is not a checkpoint, and `AGENTS.md §9` makes the worklog part of the commit.

- [x] **G0-1** ✅ **DONE 2026-09-30.** All 27 files committed as discrete checkpoints and pushed to `origin/main`. **No amend, no squash** — the RED/GREEN pairs are the evidence and were preserved as separate commits. `git status --porcelain` empty; `pnpm test` 0. **23 commits**, tree clean. The ERD, the e2e suite and every fix are now in history rather than in a working tree. → `AUD-30-09`

---

## G1 — Make the gates honest 🔴 **THE HIGHEST-LEVERAGE WORK IN THE REPOSITORY**

> **Added 2026-09-30.** Full stories, points and acceptance criteria: `docs/work/ACTION_PLAN_2026-09-30.md` **EPIC-G1 (23 pts)**.
>
> **Re-measured 2026-09-30 after `G1-3`:** `typecheck` 0 ✅ · `lint` 0 ✅ · `test` 0 ✅ (**132 tests**, all executing) · `docs:verify` 0 ✅ (**213** refs) · `test:e2e` 0 ✅ (**37** browser tests) · `test:integration` **1** ❌ **now honestly red** · `test:coverage` 0 ❌ **still hollow** · `format:check` **2** ❌ · `build` not re-run.
> **Honest score: 6 of 9 trustworthy · 2 hollow · 1 red.** This supersedes both the _"5 of 9 … 1 not run"_ line and the _"7 of 9 … 0 hollow"_ line in `SSOT.md` §1, which does not sum to 9.
>
> The 2026-09-30 audit found **four gates that are green and verify nothing**, and **one test that has never run**. All five were found by _executing_ the gates; none was visible from reading the configuration. `coverage-gate.spec.ts` and `e2e-gate.spec.ts` were written on 2026-09-29 to solve exactly this problem and they work — the class of defect then recurred in four adjacent places they do not cover.
>
> **Measured 2026-09-30:** `typecheck` 0 ✅ · `lint` 0 ✅ · `test` 0 ⚠️ (103 tests, 3 never run) · `build` 0 ✅ · `docs:verify` 0 ✅ (**188** refs) · `format:check` **2** ❌ · `test:coverage` 0 ❌ **enforces nothing** · `test:integration` 0 ❌ **runs nothing** · `test:e2e` not run ⚠️ **one test vacuous**.
>
> **Honest score: 5 of 9 green and trustworthy, 2 green but hollow, 1 red, 1 not run.**

- [x] **G1-1** ✅ **P0 — `web-port.spec.ts` had never executed.** **DONE 2026-09-30.** RED observed twice: `vitest run web-port.spec.ts` → `No test files found, exit 1` _even when named explicitly_, and the suite green at `4 passed (4)` while the test did not run. Moved to `src/lib/web-port.spec.ts` beside the module it tests; `playwright.config.ts` import updated; the spec's root-derivation replaced with a walk up to the `@eduflow/web` manifest so it is position-independent. **GREEN `2 files / 7 tests`** — the exact predicted count. **Teeth proven:** `--port 3500` → `3000` gives `AssertionError: "dev" must use --port 3500: expected 'next dev --port 3000' to contain '--port 3500'`, exit 1; reverted. Side effect: the `src/lib/**/*.ts` coverage tier is now **live** (`web-port.ts` 100%) — a partial `FIX-26` win obtained by fixing the real defect. Full evidence: `TDD_EVIDENCE_GATES.md`. → closes **`AUD-30-01`**
- [x] **G1-2** ✅ **DONE 2026-09-30.** **The test-file oracle.** New `apps/api/src/config/test-file-oracle.spec.ts` — **15 tests**. Every `*.spec.ts`/`*.test.*` on disk is asserted to be matched by a runner's `include` glob, no spec file may be 0 bytes, `apps/web` must split between Vitest and Playwright **without overlap**, and every detected runner must have a **non-empty** glob set. Zero new dependencies: the engine is Node's own `fs.globSync`, verified against all three glob forms this repo uses. **⚠️ The first RED was invalid and discarded** — my Playwright glob read `[jt]s[x]?` instead of `[jt]s?(x)`, which matches nothing, and the test reported `apps/web/tests/e2e/shell.spec.ts` as unowned. That looked like a _second_ live instance of `AUD-30-01`; it was my bug. **The hole it exposed is now closed** by the non-empty-glob-set case, which passed while Playwright owned nothing. **Valid RED by deliberate break:** `web-port.spec.ts` recreated at the **package root** of `apps/web` — outside `src/**` and `tests/**`, and therefore outside both runners — → exit 1, naming that exact path. Reverted. **GREEN 15/15**; `@eduflow/api` **78 → 93**, repo total **110 → 125**. Full transcript, including the discarded attempt: `TDD_EVIDENCE_GATES.md` §`A-3`. → **closes the `AUD-30-01` class**
- [x] **G1-3** ✅ **DONE 2026-09-30.** **Integration gate guards.** New `apps/api/src/config/integration-gate.spec.ts` — **7 tests**. Closes **two** shapes, not one: a `test:integration` script that always exits 0, and a Vitest integration config setting `passWithNoTests: true`. The second needed its own assertion because `isPassingStub()` cannot see a config key. **RED genuine, both defects at once** — exit 1 naming `apps/web`'s `echo … && exit 0` _and_ `apps/api`'s `passWithNoTests: true`. **GREEN 7/7.** Production fix is two lines: `apps/web/package.json` `test:integration` **deleted** (turbo now skips web, which is honest — it has no integration tests), and `passWithNoTests: false`. **`pnpm test:integration` now exits 1 and that is the intended state** until `F-7` supplies a real test against a containerized Postgres; a gate that fails because it has no test tells you what is missing, one that passes tells you nothing. **The obvious wrong fix is guarded:** a case asserts at least one package still declares the gate, so deleting every script cannot make the spec pass while the root command reports success. Transcript: `TDD_EVIDENCE_GATES.md` §`G1-3`. → closes **`AUD-30-02`**
- [x] **G1-4** ✅ **DONE 2026-09-30.** The 320px topnav case asserted `expect(0).toBe(0)` over zero links. It now asserts `expect(nav.linkCount).toBeGreaterThan(0)` and reports the shortest control by name. **Closing it caught a second instance of the same class:** the global touch-target sweep selects `a[href], button`, and because `AGENTS.md` §3.2.1 bans `<button>`, the `<summary>` language trigger was never measured — a control the whole `AGENTS.md` §3.2.2 floor depends on. `summary` added. ⚠️ **The closure is narrower than the audit asked for:** the audit named the _locale nav-parity_ loop, and that loop still carries no floor assertion. It is non-vacuous in practice now that the topnav renders real `<a>` elements, but it could silently pass against zero links again. → partially closes **`AUD-30-03`**
  - [ ] **G1-5** ✅ **UNBLOCKED 2026-10-05 — `FIX-10`'s blocker is gone.** The blocker was shadcn (`Button` was a `.gitkeep`); `Button` has shipped, so `ThemeToggle` now exists and `ThemeScript`'s two untested branches are reachable by a real control. **Still open:** the e2e still asserts `data-theme === 'light'` at first paint under Playwright's default light scheme, so `prefers-color-scheme: dark` and a stored `localStorage` value are still only covered by unit tests. `apps/web/tests/e2e/` needs both → **WEB-105** ➜ `AUD-30-04` · full spec: `ACTION_PLAN_2026-09-30-v2.md` **B-2**
- [x] **G1-6** ✅ **DONE 2026-09-30.** **The last hollow gate.** `scripts/check-coverage-tiers.mjs` — exits 1 when any configured threshold glob matches **0** source files. **Measured: 5 of 6 tiers decorative**, and the sharper finding — **`apps/api` had no live tier at all**, so the API's coverage was _ungated_: all three of its tiers point at `domain/`, `use-cases/`, `*.controller.ts`, which exist and are empty, while its real tested source in `src/config/` had no tier. **Written as a spec first and it worked** (red, naming all five globs and the ungated package) — then **moved out of `pnpm test` deliberately**: a failing spec fails the gate every session runs to answer "is the product tested?", and `F-1` is three epics away. `pnpm test` stays **0**; `pnpm test:coverage` is **1**, honestly, on the gate that owns the concern. **Teeth shown both ways:** with a real file under `domain/entities/` the count dropped 5 → 4 _and_ the "apps/api is ungated" line disappeared. ⚠️ Hit this repo's own recorded `*/`-in-a-comment footgun twice writing it. → closes **`FIX-26`** · full transcript: `TDD_EVIDENCE_GATES.md` §`A-2`
- [ ] **G1-7** ⚠️ **Half done 2026-09-30 — `format:check` exit 2 → 1.** The fatal half is fixed: `infra/docker/docker-compose.yml` was rejected at `1:1` because its header was a JavaScript `/** … */` block, which YAML cannot parse — so the `docker compose -f …` command `AGENTS.md` §14 documents **could never have worked**. Converted to `#` comments; the file now parses, and `format:check` no longer aborts. What remains are **78 style warnings, not errors**, of which 77 are outside this story's blast radius and one is `AGENTS.md` itself — reformatting the contract needs owner approval (`D14`). My own 25 files are Prettier-clean. **Not closed.**
- [x] **G1-8** ✅ **DONE 2026-09-30, as a side effect of B-1.** `packages/config` had no gate visiting it, and B-1 is the first change that made `ui-kit` a real TypeScript package — which is what exposed the concrete instance: **`@types/react` was not declared in `packages/ui-kit`**, so every `React` import in the new primitives was implicitly `any`. The errors surfaced as misleading `implicitly has an 'any' type` failures in whichever file happened to be checked first (`table.tsx`), not as a missing dependency. Declared `@types/react`/`@types/react-dom`; `--filter @eduflow/ui-kit typecheck` and `lint` both exit 0. → closes **`AUD-30-05`**
- [ ] **G1-9** ⚠️ `turbo.json` `globalDependencies`; remove `**/*.spec.ts` from the **4** tsconfig excludes (not 5 — `apps/web` has none) → `FIX-06`, `FIX-07`
- [ ] **G1-10** ⚠️ **Parse half DONE 2026-09-30; pinning still open.** `docker-compose.yml`'s `/** … */` header is now `#` comments and the file **parses** — Prettier accepts it, and this was the fatal error behind `G1-7`. The `minio`/`mailpit` `:latest` pinning is **not** claimed: `docker` is not installed in this environment, so `docker compose config` could not be run to validate the file, and pinning a version I cannot verify is guessing. ⚠️ **Unverified while reading the fix:** the `minio` healthcheck is `['CMD','mc','ready','local']`, which needs an `mc` alias named `local`; if the image does not provide it, the check can never pass and anything using `depends_on: condition: service_healthy` would hang. **Check this when Docker is available.** → `FIX-03` **partly closed**
- [ ] **G1-11** ⚠️ `main.ts` `??` silent default; validate `WEB_ORIGIN` + `NEXT_PUBLIC_API_URL` (`D32`) → `FIX-08`
- [ ] **G1-12** ⚠️ `src/modules/modules/` → `registry/`; anchor the ESLint globs → `FIX-09`

**Exit criterion — the negative test:** for each of the 9 gates, introduce one deliberate defect, **watch it exit non-zero**, revert. Nine commands, nine observed reds, recorded in `docs/work/TDD_EVIDENCE_GATES.md`. Until that is done, no gate in this epic is more than a file on disk.

---

## G2 — Make the record accurate ⚠️ 13 pts

> **Six quantity classes are wrong at once:** `docs:verify` 147/155/179 → **188** · tests 51/63/67/78 → **103** · commits 3/4/8 → **14** · ADRs 19/21 → **21** · tracked files 262 → **269** · tsconfigs excluding specs 5 → **4**. Six wrong numbers is evidence the class recurs, so the fix is to **generate** the report, not write it (`D38`).

- [ ] **G2-1** Correct `SSOT.md` §1 — every number re-measured; delete the duplicate `pnpm test` row; the gate line becomes _"5 of 9 green and trustworthy, 2 hollow, 1 red"_, not "6 of 7". → `AUD-30-06` ✅ **mostly done 2026-09-30 evening** — §1, §1a and §1b re-measured and the score corrected to _"7 of 9 green and trustworthy, 0 hollow, 1 red"_; `AUD-30-03` closed. ⚠️ **Do not hand-maintain the rest: this line has now been wrong twice in one day, which is the argument for G2-2 below, not a reason to patch it a third time**
- [ ] **G2-2** 🔴 **`scripts/report-status.mjs`** — run the 9 gates, emit the `SSOT.md` §1 table. The `D33` pattern applied to the status report: one source, generated artefact, drift **impossible**. Include a `--check` mode for CI. Worth more than fixing six instances
- [ ] **G2-3** ⚠️ **Renumber the collision.** `REMEDIATION_PLAN_2026-09-29.md` uses `ARC-01` for `IClock` and `OPS-01` for the integration harness; `GAP_ANALYSIS`/`TODO` use `ARC-01` for the **completed** ERD and `OPS-01` for compose. Renumber to `ARC3-xx` / `OPS-01b`; the ERD keeps `ARC-01` everywhere. **`PLT-*` is never touched** (`D39`). → `AUD-30-07`
- [ ] **G2-4** ⚠️ `PLATFORM_CORE_PLAN.md` — delete `:139`'s _"resolves cleanly — P14 sits after P8"_ (retracted), fix the Jest reference, the "test runner is missing" line, and _"MinIO is not optional"_. **The doc most likely to mislead the next session.** → `AUD-30-08`, `DOC-07`
- [ ] **G2-5** ✅ **DONE 2026-09-30** — D8/D9/D10 marked _applied_ in `SSOT.md §4`; verified in `8105a27`. Three of the four ⚑3 asks retired

---

## P0a — Repair the scaffold ⚠️ 9 of 12 remaining

Full stories, points and acceptance criteria: `docs/work/REMEDIATION_PLAN_2026-09-29.md` EPIC-00. **Re-sequenced into EPIC-G1 (gates), EPIC-G3 (scaffold) and EPIC-G4 (CI) by `ACTION_PLAN_2026-09-30.md`; this section is the index, not the plan.**

- [x] **FIX-01** ✅ ~~`@vitest/coverage-v8` in all 5 test-bearing packages~~ **DONE 2026-09-29** — ⚠️ but the tiers still enforce nothing → **G1-6** / `FIX-26`
- [x] **FIX-02** ✅ ~~one real e2e spec~~ **DONE 2026-09-29** — 11 tests — ✅ **now 37, all executing, and the vacuous nav case is closed (`G1-4`)**
- [ ] **FIX-03** 🔴 `docker-compose.yml` does not parse → **G1-10**
- [x] **FIX-04** ✅ `proxy.ts` compiled to zero middleware → **G3-3, DONE 2026-09-30** - `src/middleware.ts`, `proxy.ts` deleted, `/` no longer 404s
- [ ] **FIX-05** ⚠️ `pnpm format:check` → **G1-7**
- [ ] **FIX-06 / FIX-20** ⚠️ `turbo.json` + `packages/config` has no `scripts` → **G1-8**, **G1-9**
- [ ] **FIX-07** ⚠️ specs excluded from typecheck in **4** tsconfigs → **G1-9**
- [ ] **FIX-08** ⚠️ silent default in `main.ts` (D32) → **G1-11**
- [ ] **FIX-09** ⚠️ `src/modules/modules/` → `registry/` → **G1-12**
  - [ ] **FIX-10** ✅ **`ThemeToggle` DONE 2026-10-05** (`DSN-05` below → renumbered **`WEB-05`** to break an ID collision, see `DOC-106`). `features/theme/hooks/use-theme.tsx` + `components/theme-toggle.tsx`, a ui-kit `Button`, wired into `TopNav` and the root layout. TDD: RED `41725ca`, GREEN `fc90fde`. **Remaining: `loading.tsx` / `error.tsx` / `not-found.tsx`** → **G3-2**
- [ ] 🔴 **NEXT `FIX-11`** — shadcn/ui. `packages/ui-kit/src/components/ui/` is still a `.gitkeep` and there is no `components.json`, so `AGENTS.md` §3.2.1 remains unsatisfiable and, measured 2026-09-30, **its raw-element ban had never fired at all** — three stacked defects: an impossible `JSXElement[name.name=…]` selector (a `JSXElement` has no `name` in ESTree), a flat-config rule-array overwrite, and `parserOptions: {}` wiping JSX. **All three fixed** and proven against the real CLI; new 9-case suite `apps/web/src/config/ui-primitive-rules.spec.ts`. **Remaining: `components.json`, Radix, and the primitives.** → spec: `ACTION_PLAN_2026-09-30-v2.md` **B-1`
- [x] **FIX-22** ✅ ~~build-script allow-list inert~~ **DONE 2026-09-29** — `allowBuilds`, not `onlyBuiltDependencies`
- [ ] **FIX-25** ⚠️ `docs-verify.mjs` cannot resolve `path:line` refs. **Third reactive patch to the same tool for the same class**
- [ ] **FIX-26** ⚠️ coverage tiers match **zero** instrumented files → **G1-6**

---

> 📌 **Shipped, and not in any plan — the landing page.** `apps/web/src/features/landing/` is the first real screen: template-faithful visual language and motion, four locales, RTL, dark mode, responsive to 320px, an honest `/[locale]/sign-in` placeholder, and a `<details>`-based language dropdown ordered English/Sinhala/Tamil/Arabic. **It is a slice, not a milestone** — no Platform Core story, no API, no data. It exists partly because the RTL, i18n, theme and touch-target rules in `AGENTS.md` §3.2 have nothing to bite on until a screen exists, and a rule with nothing to bite on is a rule nothing tests. **Its remaining gaps are tracked normally:** `FIX-10` (theme toggle, `loading.tsx`, `error.tsx`, `not-found.tsx`), `G1-5` (dark-mode e2e), `DSN-03` (table archetype), `DSN-04` (font stack), and `FIX-11` (shadcn — the disclosure becomes a real `DropdownMenu`).

---

## ARC-08 → ARC-09 — Design the gaps the project ERD drew ⚠️ **NEW 2026-09-30**

> **Added 2026-09-30.** `docs/diagrams/ERD_PROJECT.excalidraw` draws the system at module level with an **evidence tier** on every row: `SPECIFIED` · `NAMED` · `MODULE` · `GAP`. **`MODULE` means the corpus names a capability and no entity at all**, and `GAP` is one of `PC-000`…`PC-006`. Seven gaps are drawn **in their own band rather than inside the modules they block**, because a gap drawn inside a module reads as handled. **No entity was invented** — `docs/idea-bank/README.md` §6 rule 5 forbids it, and ~120 unnamed corpus concepts remain unnamed. Gate: `project-erd.spec.ts` (27 cases). Record: `docs/diagrams/ERD_PROJECT_AND_ARCHITECTURE.md`.

- [ ] **ARC-09-1** `PC-004` **Admission** — the only gap `MP` §30 explicitly demands an entity set for **in the ERD**. Design `Application` → `EntranceTest` → `Approval` → auto-conversion to `Student`. Blocks MVP scope
- [ ] **ARC-09-2** `PC-005` **BookShop / Canteen / Hall** — the `Sale` record is the missing piece; `MP` §17.6–17.9 specify the behaviour and `FR-RET-01` assumes the sale _is_ a stock movement while `MP` §30 separately demands an **immutable** sales log. Two records, one sentence, no reconciliation → `T3`
- [ ] **ARC-09-3** `PC-006` **Student Wallet** — stored-value legal review + GL liability design. Enterprise add-on; **must not ship without** jurisdiction review (`AGENTS.md` §2.10)
- [ ] **ARC-09-4** `PC-000` **Attendance** and `PC-001` **Leave/Workforce** — no design at all; `MP` §8/§9 defer to a **v3.0 document not in this repository**. Requires first-principles design (`D1` carve-out: designed fresh)
- [ ] **ARC-09-5** `PC-002` **Grading & Moderation** — P0 with zero rules. **Never invent a threshold**; `PC-002` is the ticket
- [ ] **ARC-09-6** **The six certificate keys that do not exist** (GAP-GATE-1) — facilities hire, hall rental, wallet, alumni, leadership and substitution are gated in `MP` §3 but have **no key** in the signed payload's `allowed_modules`/`features`, so `@RequireEntitlement` cannot be written for them. Needs either a payload extension or an edition-matrix change → owner decision
- [ ] **ARC-09-7** **The journal entity's name and shape** — `LedgerEntry` / "Journal Entry" / `journal_entries` is **one concept, four names**. The balance invariant forces entry + line; the naming is undecided
- [ ] **ARC-09-8** **The default CoA omissions** — `MP` §5.2 seeds `1000/4000/5000` but omits **`Deposits Held`** (§17.6) and the **wallet liability** (§17.10), plus no `Purchases`/`COGS` account for `SCHOOL_RUN`. A checkable inconsistency
- [ ] **ARC-09-9** **`.gitattributes`** — `core.autocrlf=true` with no `.gitattributes` makes `schema-generation.spec.ts` red on Windows: the checked-in `schema.prisma` is CRLF (687 CR) and the generator writes LF. Content identical. Repo-wide fix, so it was **reported, not patched**

---

## P0 — Do These First

> **State 2026-09-30 (late evening):** P2 (scaffold) is DONE. The ERD is written **and committed** (ARC-01); Phase 0 has exited. `G0` is closed — 23 commits, clean tree, everything pushed. **The top engineering priority is `EPIC-G1`, then `EPIC-G4 (P3 CI)`.** The single next task is **`G1-2`**.
>
> **Added late 2026-09-30 — ARC-08.** `docs/diagrams/ERD_PROJECT.excalidraw` and `REFERENCE_ARCHITECTURE.excalidraw` now draw the system **above** the schema: 23 modules with licence gates and evidence tiers, all 7 `PC-000`…`PC-006` gaps drawn as gaps, the 7 shared engines, and the prohibitions. **No entity was invented.** New work items **`ARC-09-1`…`ARC-09-9`** are listed above — they are the _design_ work the diagram deliberately refuses to guess at, so they do **not** change the P0 ordering.
>
> ⚠️ **`PLT-101` entry condition is NOT met.** `TODO.md:226` records it as _"the harness is still not trustworthy"_, and the 2026-09-30 audit confirmed why in more detail. It got measurably closer today — 3 of the 4 hollow gates are closed — but `test:integration` still runs nothing (`AUD-30-02`), the coverage tiers still match **zero** instrumented files (`FIX-26`), `format:check` is red (`FIX-05`), and nothing runs in CI (`FIX-12`). **Do not start a Platform Core story until EPIC-G1 closes.**

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
- [ ] **G4-5** gitleaks **done 2026-10-10 via `OPS-105`** (`.gitleaks.toml` + the CI `secrets` job, full history, pinned CLI); the **dependency audit** half remains open — the compensating control for `D21`
- [x] **G4-6** **done 2026-10-10 via `OPS-106`** — `.husky/pre-commit` (lint-staged: prettier + per-package ESLint `--max-warnings=0`) and `.husky/commit-msg` (`scripts/check-commit-message.mjs`: Conventional Commits, subject ≤ 72, mandatory requirement ID)
- [ ] **G4-7** React-hooks ESLint rules, dropped with `eslint-config-next` (D25)
- [ ] **G4-8** CI workflow: PR → typecheck → lint → custom checks → unit + coverage → build → integration (containerised Postgres) → secrets scan. E2E on `main` only
- [ ] **G4-9** ⚠️ **Human gate** — a PR with (a) an unguarded route (b) a `new Date()` in a use-case (c) a raw `<button>` ⚠️ **(c) only became checkable 2026-09-30** — the ban had never fired before (d) a missing i18n key must **FAIL CI for each**, then pass. ⚠️ **Requires G3-1 (shadcn) first** — the gate needs a raw `<button>` to fail _and_ a compliant `<Button>` to pass

### 3. Write the ERD ✅ **DONE 2026-09-29 (ARC-01) — supersedes D22. Phase 0 exited. ✅ COMMITTED 2026-09-30 (G0-1)**

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
- [ ] `DSN-03` RTL foundation — **core proven 2026-09-29** (`/ar` serves `dir=rtl`); **advanced 2026-09-30** — the language dropdown anchors its menu to the trigger's _inline_ end (flush left in Arabic, `alignLeft: 0`), and the first form-shaped card in the product (`/[locale]/sign-in`) is verified in Tamil and Arabic. _Table archetype still to build (P4W)._
- [ ] `DSN-04` font stack for Tamil/Sinhala/Arabic — ⚑ **needs owner decision**; PDF pipeline must be covered too. _A provisional Noto stack is in `styles.css`._
- [x] `DSN-05` `prefers-reduced-motion`, ≥ 44 px touch targets — **done 2026-09-29**, and **corrected 2026-09-30**. ⚠️ The first version of this line said "verified by test" and **nothing was measuring the rendered box** — the token existed and the page shipped at 32px, with both CTAs at **43px, one pixel under the floor**. Six real violations. Now `every interactive element is at least 44px tall` sweeps `a[href], button, summary`, skips zero-area (hidden) elements, asserts the count is non-zero, and names the trigger so the sweep cannot pass vacuously. `prefers-reduced-motion` was equally nominal: cancelling the marquee left a **clipped** strip — now a centred wrapping list. _shadcn/ui components themselves are FIX-11_
- [ ] `DSN-06` CI enforcement: no literal user-facing string in JSX/TSX. _The no-hard-coded-hex half is done and firing; the string half is P3 — a heuristic produces false positives, which is worse than no check. `ARCHITECTURE.md:346` currently overstates this._
- [x] `OPS-01` `infra/docker/docker-compose.yml` — **services defined 2026-09-29**: Postgres, Redis, MinIO, Mailpit. ⚠️ **the file does not parse — FIX-03**
- [ ] `OPS-02` CI pipeline — **P3, the top priority after P0a**
- [ ] `OPS-03` coverage gate — ✅ **the command now runs** (FIX-01) and thresholds match `AGENTS.md` §4 exactly (90/85 domain + use-cases, 70 controllers, 80 frontend hooks), and the gate was proved able to fail. ⚠️ **but the globs match 0 instrumented files, so it enforces nothing today — FIX-26**
- [ ] `OPS-04` security scanning — dependency, OWASP ZAP, **secret scanning**, log-content scan (P3)
- [x] `OPS-05` `docs:verify` — **done 2026-09-29**: **155** references across 8 documents resolve
- [ ] `OPS-07` backup & restore **drill** — a restore actually performed and verified
- [x] `ARC-07` `docs/adr/` — **21 ADRs written** (001–021, contiguous). **None is `Accepted`** — see ⚑10
- [ ] `ARC-08` `directives/` — module, route, rule-engine, table-driven-test, new-`ILedgerPostingRule` SOPs
      **⚠️ This ID was also claimed by the project ERD on 2026-09-30; that work is now `ARC-10` and this row keeps `ARC-08`.** `AUD-30-07`
- [ ] 🔴 **`ARC-10` — the project ERD and reference architecture have pictures but no enforcement.** `docs/diagrams/ERD_PROJECT.excalidraw` (235 elements) and `REFERENCE_ARCHITECTURE.excalidraw` (86 elements) are **real, clean-UTF-8, substantive**, and their corpus analysis is genuinely new. But **all 6 pipeline artefacts their header claimed do not exist**: no ERD source module, no renderer, no geometry check, no 27-case contract gate, no `generate:diagrams` script — all six claimed paths are absent. **A hand-edit to either diagram fails nothing.** Its §6 claimed 27/27 green with a drift gate "proven by breaking it" — there is no gate to break. Its §8 reported a pre-existing `schema-generation` failure that **does not occur** (measured: 0 CR bytes, 26/26 green). → spec: `ACTION_PLAN_2026-09-30-v2.md` **B-6`
- [ ] 🔴 **The signed licence payload has no key for six gated capabilities** — facilities hire, hall rental, wallet, alumni, leadership, substitution (`ARC-09` finding 2). **`@RequireEntitlement` cannot be written against a capability the payload cannot name.** Blocks the entitlement half of `F-2` and `PLT-302`. Either the payload extends or the gate is scoped down — an owner decision
- [ ] ⚠️ **The default Chart of Accounts seed omits two accounts the spec requires** — `Deposits Held` (MP §17.6) and the **wallet liability** (MP §17.10) (`ARC-09` finding 4). A checkable inconsistency between `MP` §5.2 and `MP` §17.6/§17.10
- [ ] ⚠️ **`docs:verify` scans 8 hard-coded documents and none of them is a new diagram doc.** That is how six false path claims in `ERD_PROJECT_AND_ARCHITECTURE.md` passed the only gate that catches documentation drift. → `C-3` should make the scanned set discoverable rather than hard-coded
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

| #                                                                                                                                                                                                                                                                                                                                                            | Question                                                                                                                                                                                                                                                                                                                                                                            | Blocks                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ⚑1                                                                                                                                                                                                                                                                                                                                                           | Rotate the token + is the third-party `ANTHROPIC_BASE_URL` intentional?                                                                                                                                                                                                                                                                                                             | §1 above                                                                                                                                                                                                                       |
| ⚑2                                                                                                                                                                                                                                                                                                                                                           | Was `docs/archive/corpus/` deliberately deleted, or never migrated?                                                                                                                                                                                                                                                                                                                 | Extraction reliability                                                                                                                                                                                                         |
| ⚑3                                                                                                                                                                                                                                                                                                                                                           | Approve the four `AGENTS.md` corrections: D8 legacy path, D9 i18n claim, D10 raw-SQL count, C-01 repo name                                                                                                                                                                                                                                                                          | Doc accuracy                                                                                                                                                                                                                   |
| ⚑4                                                                                                                                                                                                                                                                                                                                                           | Font stack for Tamil / Sinhala / Arabic (screen **and** PDF)                                                                                                                                                                                                                                                                                                                        | `DSN-04`                                                                                                                                                                                                                       |
| ⚑5                                                                                                                                                                                                                                                                                                                                                           | Required report-card layouts for the initial customer set — Master Plan §30 flags this as needed **before Phase 5**                                                                                                                                                                                                                                                                 | Document/Print Engine abstraction                                                                                                                                                                                              |
| ⚑6                                                                                                                                                                                                                                                                                                                                                           | ~~Activation server: in this repo or a separate service?~~                                                                                                                                                                                                                                                                                                                          | ✅ **Answered** — `ADR-010`: **external vendor service**, port + OpenAPI + local fake. Private key never in this repo                                                                                                          |
| ⚑7                                                                                                                                                                                                                                                                                                                                                           | ~~`SRS` §24 Gate M2 vs. the licensing sprint position.~~                                                                                                                                                                                                                                                                                                                            | ⚠️ **Reopened 2026-09-29.** The reorder puts licensing at P8, before the P14 gate — but `SRS §24` Gate M2 is defined at _end of Phase 1_. **Relabelling a step is not moving a gate**, and `SRS §24` was never amended. Now ⚑D |
| ⚑8                                                                                                                                                                                                                                                                                                                                                           | Design `PC-000`…`PC-006` now, or formally defer with owners and milestones?                                                                                                                                                                                                                                                                                                         | `REQ-07`                                                                                                                                                                                                                       |
| ⚑9                                                                                                                                                                                                                                                                                                                                                           | **`SRS` §19 vs. `AGENTS.md` §7 (D5) on mobile.** `SRS` puts a Parent/Student Personal Portal in the MVP and `SRS` §20 AC-5 requires it; `AGENTS.md` makes `apps/mobile` milestone 2; Master Plan §24 carries a full mobile architecture. Three documents, two positions. Options in `ADR-005` — A (adopt D5, amend `SRS`), B (revert to `SRS`), C (parent read-only **web** portal) | MVP scope · **Recommended: C**, then A                                                                                                                                                                                         |
| ✅ **ANSWERED 2026-09-30 — owner approved all 21 ADRs.** Applied: 21 status lines + `docs/adr/README.md` (23 cells, and the _"No ADR is `Accepted`"_ claim replaced). Caveats **retained**, not erased: `ADR-003` reconstructed-then-signed · `ADR-005` `SRS` §19 conflict recorded as a deviation · `ADR-020` `AGENTS.md` §3.1 amendment still outstanding. | → **`D-0` closed**; unblocks **`EPIC-D` in full**                                                                                                                                                                                                                                                                                                                                   |

| ⚑'H | **One role per user, or a `UserRole` join?** ANSWERED 2026-09-30: **multi-role** — a `UserRole` join table. The schema has a single `roleId` FK; the ERD gate **deliberately fails** if a 15th model appears, so the schema change and the tripwire amendment must land **in the same commit** or the suite breaks at the wrong moment. `ERD:84`: _"a teacher who is also a parent cannot be expressed."_ | **`D-4.1` DECIDED, not yet applied** → `PLT-201`, `PLT-202`, `PLT-204`, and P6 |

| ✅11 | **Approve proposed story `PLT-107`** (first-admin bootstrap via one-time setup token). School Setup Workflow §6.5 requires it; **no existing story covers it**, so a fresh deployment cannot create its first administrator | Epic 01 / school onboarding |
| **11 — ANSWERED 2026-09-30 (owner):** **build the story.** One-time, single-use, expiring, audited setup token — _not_ a seed script. A seed script is cheaper and adequate for one database per school (§2.1), but it leaves the **documented** first-launch workflow (§6.5) unimplementable, so §6.5 would have to be amended instead. The seed script then falls out of the story as a dev convenience rather than becoming the production path. **`PLT-107` must still be ticked with acceptance criteria in the plan** — the decision is recorded, the story is not yet written. | → **`D-4.3` closed** · unblocks `PLT-101` → Epic 01 |
| ⚑12 | **The `M2` naming legend** — approve the "Milestone 2" vs "Gate M2" distinction in `SSOT.md` §4 | All milestone references |
| **⚑A** | **Approve a one-line change to `AGENTS.md` §3.1** (`Jest` → `Vitest`). D27 decided the runner and `ADR-020` records it, but §3.1 is inside §3 which this session is directed not to touch | **The contract still contradicts the code** |
| **⚑B** | **Approve the `AGENTS.md:8,17` status correction.** Both still say _"pre-scaffold / no application code exists yet"_. They are in the preamble and §1 — **not** §2/§3/§13 — so this is D14, not the standing restriction | Every session opens by reading a false state |
| ⚑'G | **`Money` wire format — ANSWERED 2026-09-30 (owner): option (C)**, string on the wire + a branded client type that cannot be built from a bare `number`. **Why C and not B:** `ADR-002` exists to forbid float money, and (B) reintroduces it one layer up, just less visibly — `Number.MAX_SAFE_INTEGER` caps LKR (2dp) at ~90tn and KWD/BHD/JOD (3dp) at ~9bn, **silently losing minor units**, and currency is a per-school **setting** (§2.14) so a 3dp currency cannot be assumed away. (B) is defensible only with a test that fails when a currency exceeds 2dp. **The trigger is real, not hypothetical:** `JSON.stringify({amountMinor: 100n})` throws, so the first endpoint returning a `Money` 500s. **Still to do — the decision is recorded, the work is not started:** (1) write **`ADR-024`** amending `ADR-002` with the wire format, (2) add the `MoneyWire` type + a serialiser, (3) a test that fails on a 3dp currency. | → **`D-4.2` closed** · unblocks `PLT-301`, `PLT-302`, `ARC-06`, P8 |

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
- **Status:** **approved `D-4.3` 2026-09-30, story written 2026-09-30, token half built 2026-10-02.** IDs are never renumbered (`AGENTS.md` §7), so this is `PLT-107`, appended. Full story: `docs/work/STORY_PLT-107_first-admin-bootstrap.md`.
- **Where it runs:** inside Epic 01, **before Epic 03 completes** (Prompt Pack §2.2), because licence activation (P8) and school settings (P10) both presuppose an administrator exists.
- **Constraints it inherits:** no default credentials, ever; the setup token is single-use, short-lived, and consumed on first successful use; the act is audited; the route is `@Public('<reason>')` (there is no user to authenticate) and therefore allowlisted per `ADR-018`.

**✅ Done 2026-10-02 — `PLT-107` token half.** Two `User` columns (`setupTokenHash`, `setupTokenExpiresAt`), `IPasswordHasher`, and the issue/inspect/consume path. Consumption is **one conditional `UPDATE`** — the affected-row count is the verdict, `id` is deliberately absent from the `WHERE` so no read-then-write creeps in, and `gt` (not `gte`) means a token is dead at its expiry instant. Unit 259, integration 48. The naive read-then-write was reinstated to **prove the concurrency test fails** (5/5 red, 2–8 of 8 claims wrongly accepted), then restored.

**✅ Resolved 2026-10-02 — argon2id approved and implemented** (`SSOT.md` D56). `argon2` 0.45.1 installed; `Argon2idPasswordHasher` implements the port. Parameters are **injected from `school_settings.password_hash_parameters`** (`AGENTS.md` §2.14) with a documented OWASP-derived default when unset, so an unconfigured school can still log in. `argon2.needsRehash` was **rejected** — see D56. This unblocks `POST /auth/setup/complete`.

**✅ Resolved 2026-10-02 — sign-in policy** (`SSOT.md` D57). **Must-link, never auto-provision.** The allowlist is a pre-filter, not authorisation; without this rule any student with a school Gmail becomes a system user. Unblocks `GET /auth/oidc/callback`.

**✅ Landed 2026-10-02 — `GET /auth/oidc/redirect`.** First controller in the repository. State travels in an **HMAC-signed cookie**, deliberately **not** Redis: no Redis deployment is verified here (`G1-10`), and login must not depend on a service that may be down. `pnpm check:route-guards` proven load-bearing — removing the allowlist entry fails the build.

### ✅ Resolved 2026-10-03 — the flaky integration gate, root-caused

- **`pnpm test:integration` is no longer flaky.** 12 consecutive clean runs here; 34 for the
  implementer. The cause was **not** a race between callers.
- **My brief stated the verdict mapping INVERTED**, and so did the earlier WORKLOG entry.
  `decideSetupToken` maps `bootstrap-claimed` → `reject-consumed` and `no-token-issued` →
  `reject-unclaimed`. The earlier entry read it the other way round and would have pointed a
  fixer at the wrong branch. Corrected in place.
- **Actual mechanism:** `PrismaSetupTokenRepository.consume` records consumption **only** by
  NULLing the token columns, and writes nothing to the account. `deploymentState()` infers
  "claimed" from the **account**, so after the winner commits, the row is
  indistinguishable from a never-enrolled deployment. A loser whose read lands after that
  commit is told `reject-unclaimed`. **The information is not in the database**, so no change
  inside the rule can recover it — that would need a `setup_token_consumed_at` column, i.e. a
  change to owner-approved `PLT-107` option (b) which `PLT-104` supersedes anyway.
- **No production exposure.** `SetupTokenService.consume` has no production caller. The route
  uses `PrismaBootstrapClaimRepository.claim`, which spends the token and writes the credential
  in ONE transaction, so its losers are always 409. Exactly 1 accept in 1400/1400 bursts.
- The corrected test is **stronger**, not looser: no loser ever receives a `userId` or
  `reject-invalid`. Deliberate break confirmed — reinstating read-then-write fails it.

### ✅ Done 2026-10-03 — the OIDC callback. `PLT-101` vertical slice complete

- `SessionGuard` (first guard to resolve a cookie into a principal), `IExternalIdentityRepository`,
  and `GET /auth/oidc/link` (authenticated, link-only) + `GET /auth/oidc/callback`
  (`@Public`, **sign-in only**). The mode is **sealed inside the signed state**, so it cannot be
  flipped by a query parameter — verified by mutation, 4 tests fail if the check is forced open.
- **`test:coverage` now has ONE failure, not two.** The `apps/api` domain tier went 89.08% →
  **green** because there is more tested code, not because a threshold moved; no tier was deleted.
  What stays red is two `apps/web` hooks tiers matching zero files — **correctly red**: the fix
  is to write the hooks.

### ⚠️ Gaps left by the callback

- **Unlink does not exist.** A user who links the wrong Google account cannot undo it.
- **`Session` carries no `provider`/`providerSubject`.** Not needed today — `ExternalIdentity`
  holds it — but "which identity is attached to this session" is now unanswerable, and
  answering it later is a migration.
- **Two `HmacOidcStateStore` branches are untested.** Reaching them needs a valid signature,
  and producing one means re-implementing the store's MAC. They fail closed and are reported
  rather than tested.
- **The password policy is still provisional** — length bounds only, marked `provisional: true`,
  `SSOT.md` D62. Needs owner sign-off.
- **Five environment variables have no corpus source** (`env.ts` says so on each).

### ✔ Done 2026-10-03 — the permission engine. `@RequirePermission` enforces

- `PermissionGuard` resolves permissions from the schema's own relation
  `User — UserRole — Role — RolePermission — Permission`, union across roles with no primary-role
  flag. **No permission model was invented**, which is the part that mattered.
- **Fails closed**: no principal, no role, or an unknown permission key all refuse.
- `@Public` exempts it via the **same** `PUBLIC_ROUTE_KEY` `CsrfGuard` and `SessionGuard` use.
  Three global guards, one marker.
- **Order is `CsrfGuard` — `SessionGuard` — `PermissionGuard`.** `PermissionGuard` never re-reads the cookie. The
  wrong order still refuses, which is the trap: it would report every 401 as `NO_PRINCIPAL`,
  a wiring fault logged as policy. Asserted over a socket — unauthenticated
  `/auth/oidc/link` answers **401, not 403**.
- `route-permissions.json` + `permission-matrix.spec.ts` reconcile **all 5 routes in both
  directions**, with three separate columns for permission / entitlement / audit so the
  matrix cannot imply enforcement that does not exist.
- **Ownership policies were NOT built** — the `User` model's own schema comment says the
  relationships do not exist yet and names `PLT-203`. Not stubbed: a method returning `true`
  is worse than an absent one. ✅ **Superseded 2026-10-04: the `PLT-203` ENGINE now exists**
  (port, fail-closed rule, `@OwnsResource`, `PermissionGuard` pipeline, 3 negative security
  tests). What is still unbuilt is the three concrete *policies* — teacher→class,
  parent→child, vendor→outlet — because no class table, guardian link or outlet table exists.
  `ownershipPoliciesFor()` returns `[]` and the boot warning says so in full. An empty
  registry **refuses** any `@OwnsResource` route (`NO_POLICY_FOR_ENTITY`, a wiring fault),
  which is the intended fail-closed direction. See WORKLOG 2026-10-04.
- Break-and-restore x3. The instructive one: unwiring the guard left **every permitted case
  passing** and failed 6 behavioural + 4 structural tests — only the denial tests noticed.

### ⚠ Needs an owner decision

- ~~**`GET /auth/oidc/link` now 403s for everyone on a freshly seeded database.**~~ ✅
  **Fixed 2026-10-04 by `PLT-205` T1.** `AUTH_LINK_EXTERNAL_IDENTITY` is now in
  `PERMISSION_CATALOGUE` (`src/modules/rbac/domain/permission-catalogue.ts`), and `seed.mjs`
  reads that catalogue rather than carrying its own array — so it **cannot drift again**.
  `PermissionKey` is now a union, so the same omission as a *typo* is a compile error, and
  `permission-catalogue.spec.ts` reconciles routes → catalogue → usage in both directions.
  Verified against the live database: the route's key is granted and the seed is idempotent.
- **`PLT-205`'s Role × Module × Action matrix is not built.** T1 and T2 are done — the
  catalogue and the **five** system roles (`SCHOOL_ADMIN`, `TEACHER`, `STUDENT`, `PARENT`,
  `STAFF`, per the corpus §DoR, `SUPER_ADMIN` absent and asserted) with **Option A** grants.
  **T3–T6 remain:** the matrix fixture, the parametrised integration suite, the maintenance
  gate, and the owner row-by-row review that is `P6`'s actual exit gate.
- **`PERMISSION_ASSIGN` is deliberately granted to nobody.** Option A's no-self-escalation
  principle: a role that can grant itself that key makes the permission system advisory. It
  is named in `UNASSIGNED_PERMISSION_KEYS` so `PLT-201` Task 5 can report it rather than
  someone re-deriving the reasoning. **Consequence: until a role can be granted at runtime,
  nobody can hold it** — an operator edits `SCHOOL_ADMIN`'s grants, a one-line git-visible
  change. Recorded here so it is not discovered as a missing feature.
- **`TEACHER` / `STUDENT` / `PARENT` / `STAFF` hold no permissions.** Not an oversight: no
  attendance, finance, grading or workforce module exists to grant anything on, and
  `AGENTS.md` §6 forbids inventing one. The empty sets are also the matrix's first real
  denials. Each role's grants arrive with its module.
- Two `RbacModule` connection pools exist (its own, plus auth's). Chosen over
  refactoring tested auth wiring; worth revisiting.
- A reader failure surfaces as **500, not 403**, by design. Flagged in case that is wrong.

## Do Not

- ❌ **Do not start `PLT-101`** before the entry conditions in `PLATFORM_CORE_PLAN.md` §2 are met. The ERD is done **and committed** (ARC-01) and `test:coverage`/`test:e2e` are fixed (FIX-01/02), but the harness is still **not trustworthy**: the coverage tiers match **zero** instrumented files (FIX-26), `format:check` fails (FIX-05), `test:integration` runs nothing in either package (AUD-30-02), and nothing runs in CI (FIX-12). **ERD sign-off is also still owed** — see item 3
- ❌ **Do not treat a green gate as evidence the gate is sound.** **Five** different defects have now made `pnpm test:e2e` report a meaningless result — an empty `testDir`, an always-passing stub script, a readiness probe that accepted a foreign server, a nav-parity floor that asserted `expect(0).toBe(0)`, and four language-picker cases that passed against a _closed_ menu. Ask what the gate actually ran
- ❌ **Do not accept a "done" marker on a rule that nothing measures.** `DSN-05` read _"≥ 44px touch targets — done, verified by test"_ for a day while the page shipped at 32px and its CTAs at 43px. The token existing is not the floor being enforced. Check for a test that _reads the rendered box_
- ❌ **Do not merge while any §4 gate is red.** One is (`format:check`). P0a exists for this
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
