# Resume — for the session after 2026-10-10 01:00

> **Supersedes** `RESUME_2026-10-10.md` (the repository-recovery session's
> handover). That file's "What is next #1" — *write `SEC-115`'s acceptance
> criteria* — is **done**; its remaining items are carried forward below.
> Written at the close of the third session — the **Phase 0 + `SEC-115`
> criteria session**.
> Companion documents, both current:
> `docs/work/GATE_RESULTS_2026-10-09.md` (measured state) and
> `docs/superpowers/plans/2026-10-09-strategic-roadmap-v2.md` (44-item debt
> register, 10-row contradiction matrix, 5-phase roadmap).
>
> **Read this file, then the SEC-115 acceptance criteria, then
> `GATE_RESULTS_2026-10-09.md`.**

## State of the tree

- **`main` is `9fc79e9`, 94 commits, clean, pushed, in sync with the remote.**
- **The snapshot branch `docs/phase0-snapshot-2026-10-09` (`753498c`) is
  pushed.** It holds the four uncommitted changes that existed at session
  start (the regressed `AGENTS.md` rewrite, the template deletion, Prompt
  Pack v2, the ERD/DFD/UML diagram) — preserved, not merged. Phase C rules
  on each; nothing was lost.
- **No code changed this session — only docs.** The 14/14 gate measurement
  (`GATE_RESULTS_2026-10-09.md`, measured on `3d23895`) still stands.
  Re-run the gates after `SEC-115` execution, which will change code.

## What this session did

Two commits: `ef87488` (Phase 0 adjudication) → `9fc79e9` (`SEC-115`
criteria), plus the handover commit.

1. **Phase 0 — adjudicated the uncommitted state.** The uncommitted
   `AGENTS.md` rewrite declared *"pre-scaffold. No application code exists
   yet"* against a 168-file API tree with 14/14 gates green, and cited
   `ADR-003-fresh-build-single-tenant.md`, which does not exist on disk.
   Reverted on `main`; the committed, corrected `AGENTS.md` (DOC-100) is
   the contract again. The old template deletion was **not** applied —
   `FRONTEND_TEMPLATE.md:3` and `SSOT.md:118` reference the file, so
   deleting it breaks `docs:verify`. Prompt Pack v2 and the ERD diagram
   were parked on the snapshot branch, not imported as authority.
2. **Phase 1 — wrote `SEC-115`'s acceptance criteria** (the task the
   previous handover called "the task, not a preliminary"):
   `docs/superpowers/plans/2026-10-09-sec-115-acceptance-criteria.md`.
   Six criteria, each with a runnable verification command, written against
   the **measured** state. Three findings the previous handover did not
   have: `NEXT_PUBLIC_API_URL` is documented but read by nothing while the
   web app reads the undocumented `NEXT_PUBLIC_API_BASE_URL`
   (`api-base-url.ts:61`); `WEB_ORIGIN` is read at `main.ts:57` through a
   silent `??` default and is absent from the `env.ts` schema (open
   `FIX-08`/`G1-11` since 2026-09-30); `OIDC_CALLBACK_MAX_ATTEMPTS` /
   `_WINDOW_MS` are in the schema but undocumented. Also measured: 11
   bracketed placeholders in `.env.example`, not 12.
3. **Pushed** `main` and the snapshot branch to `origin`.

## What is next, in order

1. **Execute `SEC-115` against its criteria** — TDD, RED-first. The six
   criteria and their verification commands are in
   `docs/superpowers/plans/2026-10-09-sec-115-acceptance-criteria.md` §2.
   **One open owner question: AC-3 deletes `.env.local`, which holds the
   only working copy of the real Google OIDC credentials in this tree.**
   The owner was asked at session close and deferred. Either confirm the
   deletion first, or execute AC-1/AC-2/AC-4/AC-5 and leave AC-3 for the
   owner to run (the credentials are re-entered from the Google console
   into the recreated `.env`).
2. **Phase 2 — the Phase C remainder:** the doc-delta register
   (`DOC_DELTA_2026-10-09.md`, one verdict per row), the Auth.js proof
   (C-3), the stale port-prose edits (C-4: 3030/3031 → 3001/3500 in four
   planning documents), credential rotation (A-1/A-2: the `thk_live_`
   gateway token and `GOCSPX-` Google secret in `New folder.7z`), and
   archive redaction (A-4/A-5).
3. **Phase 3 — Phase D specifications** (D-1 role/permission matrix is the
   critical one; it unblocks EPIC-C).
4. **Phase 4 — Phase E foundation closure. Phase 5 — Phase F vertical
   slice** (54 SET/ACD stories, already decomposed and arithmetically
   verified — *execute, do not re-plan*). **Phase 6 — Phase G scale.**
5. **Adjacent mechanical task** (`RESUME_2026-10-10.md` item 2): apply the
   SSOT Naming legend (`SSOT.md:424-437`) to `PlatformCore_RBAC_v2.md`
   (36 stories tagged `M1`), `SchoolSetup_Academic_v1.md` (54 tagged
   `M2`), `School_Setup_Workflow_v1.1.md:10`. Find-and-replace, not a
   decision.

## Corrections you must not re-introduce (this session's)

| Item | What the roadmap's C-2 sketch claims | The measured truth |
| --- | --- | --- |
| Code's port names | `WEB_PORT` / `API_PORT` | Those exist in planning prose only. The code's names are `PORT` (`env.ts:42`, default 3001) and `NEXT_PUBLIC_API_BASE_URL` (`api-base-url.ts:61`). |
| Test API | `loadEnv({ nodeEnv })`, `SEED_SUPERADMIN_PASSWORD` | Neither exists. The real API is `loadConfig(env)` (`env.ts:417`); no seed-password variable is in the schema. |
| Placeholder count | 12 | 11 bracketed values (lines 13, 17, 22, 23, 24, 30, 31, 36, 56, 57, 84); the 12th is the nested `<password>` token inside `DATABASE_URL`'s value. |
| `check:coverage-tiers` | a root `pnpm` script | It is **not** in the root `package.json`. Run `node scripts/check-coverage-tiers.mjs`. |

## Owner decisions open (carried forward, unchanged)

| ID | Decision | Blocks |
| --- | --- | --- |
| **NEW** | **`SEC-115` AC-3: delete `.env.local`?** It holds the only working copy of the real Google OIDC credentials in this tree. Owner deferred at session close. | `SEC-115` execution |
| **⚑D-c** | Licensing/entitlement model for `PLT-EPIC-03` | `SEC-112`, EPIC-C |
| **`PLT-205` T6** | Owner review of the RBAC permission matrix | the whole RBAC path |
| **`DSN-04`** | Approved font stack for Tamil / Sinhala / Arabic | i18n work |
| **`PLT-105`** | Password reset before or after `PLT-EPIC-03`? | forgot/reset pages |
| **`F-15`** | Repo public or GitHub Pro — required status checks are a Pro feature on a private repo | CI enforceability |
| **`O-6`** | Pull the email adapter (`PLT-701`) forward? It blocks `PLT-105`. A cost call, not build order. | `PLT-105` |

Closed by the previous session: **O-2** (ports: API 3001, web 3500, by
evidence). Closed this session: none.

## Quality gates

**14/14, measured 2026-10-09 on `3d23895`, cold install** — still valid,
no code has changed since. Full evidence: `GATE_RESULTS_2026-10-09.md`.
install · prisma generate · typecheck 8/8 · lint 8/8 · format:check · unit
**1,432** · coverage 8/8 · build 9/9 · migration baseline · integration
**240**/14 files · e2e **37/37** · docs:verify 256 refs · check:route-guards
83 files · check:coverage-tiers (`node scripts/check-coverage-tiers.mjs`).

## Traps still in force

- **After every fresh clone or `pnpm install`, run
  `pnpm --filter @eduflow/api exec prisma generate`** — no `postinstall`
  (`ci.yml:35-38`), deliberate.
- **`pnpm migration:run` needs `DATABASE_URL` exported in your shell** —
  until `SEC-115` AC-4 lands. The Prisma CLI reads `.env` beside
  `schema.prisma`; the test runners read the repo root. Three loaders,
  three opinions.
- **`format:check:docs` fails on 60 files and CI never runs it**
  (`ci.yml:127` runs `format:check` only). Wire it or delete it.
- **`pnpm test:integration` has a known flake** (setup-token concurrency
  test, unroot-caused, likely owner `SEC-112`). The previous session's
  WORKLOG claims it was root-caused and fixed (24 green runs); the two
  records disagree — re-verify before trusting either.
- **Cold-cache surface:** any `turbo.json` change invalidates every turbo
  cache and fires a fully cold `pnpm test`.
- **PowerShell 5.1:** no `&&` — use `;` or `if ($?)`. Multi-line
  `git commit -m` here-strings are unreliable — write the message to a file
  and use `git commit -F`.
- **Never print or commit real credentials.** `New folder.7z` and
  `.env.local` still hold live ones (see A-1/A-2 above).
