# Resume — for the session after 2026-10-10 21:05

> **Supersedes** `RESUME_2026-10-10-session-2.md`. Its "What is
> next #1" (execute `SEC-115`) is **done** (owner ruled on AC-3:
> keep `.env.local`), as are `SEC-112` + `OPS-105` + `OPS-106`
> and `PLT-204` + `PLT-205-T3`. Open items are carried forward
> below.
> Companion documents: `docs/work/GATE_RESULTS_2026-10-09.md`
> (**stale** — its 1,432-unit / 240-integration figures are
> superseded, see Quality gates) and
> `docs/superpowers/plans/2026-10-09-strategic-roadmap-v2.md`
> (44-item debt register, 10-row contradiction matrix).
>
> **Read this file, then `docs/work/WORKLOG.md`'s 2026-10-10
> `PLT-204` entry, then the Jira epic
> `docs/core/EduFlow360_Jira_Epics_PlatformCore_RBAC_v2.md`.**

## State of the tree

- **`main` is `7682d34`, clean, pushed, in sync with `origin`**
  (`bc02539..7682d34` pushed this session).
- **This session's commit:** `7682d34` —
  `feat(rbac): PLT-204 permission-aware UI + PLT-205-T3 bypass
  tests` (31 files, +2532/−47).
- Commits since session-2's handover, all pushed: `dc9457d`
  (`SEC-115` env reconciliation) → `bc02539` (`SEC-112` +
  `OPS-105` + `OPS-106`) → `7682d34` (`PLT-204`).

## What this session did

`PLT-204` (Frontend Permission-Aware UI Rendering) +
`PLT-205-T3` (negative direct-API bypass tests), TDD-first, both
halves, full gate set green, committed and pushed.

1. **API half** — `GET /permissions/me` on
   `PermissionsController` with `@RequirePermission('PERMISSION_READ_OWN')`
   (new catalogue entry, granted to all five system roles). The
   `ReadMyPermissions` use-case reads the principal from
   `requirePrincipal(request)` only — **there is no `userId`
   parameter to forge**. Backed by the new
   `IPermissionGrantReader.grantedKeys({ userId })` port (UNION
   across the user's roles, dedup, sort) and its Prisma
   implementation; wired into `rbac.module.ts`'s persistence
   branch only. `route-permissions.json` row added with
   `audited: null` (reading one's own keys is not a sensitive
   action per `AGENTS.md` §2.3).
2. **Web half** — `apps/web/src/features/rbac/`:
   `permissions-request.ts` (pure wire contract; refusal kinds
   `unauthenticated`/`denied`/`network`/`unexpected`; classifies
   from the status alone; `parsePermissionsBody` never throws;
   `GET` with `credentials: 'include'` and **no CSRF header** —
   GET is a safe method), `hooks/use-permissions.tsx`
   (`PermissionsPhase` `loading`/`ready`/`unauthenticated`/`error`;
   `has`/`hasAny`/`hasAll` **fail closed** unless `ready`),
   `components/permission-gate.tsx`, `components/require-permission.tsx`
   (loading→`Skeleton`, denied→`/{locale}/forbidden`,
   unauthenticated→`/{locale}/sign-in`, **error→renders null and
   redirects nowhere**), `app/[locale]/forbidden/page.tsx` (async
   server component, `getTranslations`, `generateStaticParams`
   over `SUPPORTED_LOCALES`), and the `forbidden` i18n namespace
   in en/ta/si/ar.
3. **`PLT-205-T3`** — `permissions-over-http.integration.spec.ts`
   proves over real HTTP that a second account cannot read the
   first's permissions and that an unauthenticated request is
   refused.
4. **Reverted an unexplained working-tree change to
   `.env.example`** (`DATABASE_URL` database name `eduflow_dev` →
   `eduflow360db`). It matches the dev database but was out of
   scope for a `feat(rbac)` commit and of unverified provenance.
   Re-apply as a docs commit with a rationale if it was intended.

## What is next, in order

1. **`PLT-EPIC-02` remainder:** `PLT-204`'s T2-S3/T3-S3 owner
   visual-approval steps (not code — a human looks at the
   gate/redirect behaviour in the browser).
2. **`PLT-EPIC-04`** — make `@Audited` write, wire
   `audit-immutability.sql`. The audit repository already exposes
   only `create()`/`query()`; the database-level
   `REVOKE UPDATE/DELETE` grant is the remaining defence-in-depth
   half. This is the last epic on the milestone-1 critical path
   that is **not** blocked.
3. **`PLT-EPIC-03`** (enforce `@RequireEntitlement`) —
   **blocked on owner decision `⚑D-c`** (the licensing/entitlement
   model). Do not start without it.
4. **The six blocking designs `PC-000`…`PC-006`** (`AGENTS.md`
   §6.1) gate every feature module. `PC-000` (Attendance) is
   first because every later module depends on it. Nothing
   module-sized may be built until these exist.
5. **Phase C remainder** (carried from session-2, still open):
   credential rotation A-1/A-2 (the natural immediate follow-up
   while `.env.local` is retained — rotating the Google OIDC
   secrets keeps the dev machine working), doc-delta register
   `DOC_DELTA_2026-10-09.md`, Auth.js proof C-3, stale
   port-prose edits C-4 (3030/3031 → 3001/3500 in four planning
   documents), archive redaction A-4/A-5.
6. **Adjacent mechanical task** (find-and-replace, not a
   decision): apply the SSOT Naming legend (`SSOT.md:424-437`) to
   `PlatformCore_RBAC_v2.md` (36 stories tagged `M1`),
   `SchoolSetup_Academic_v1.md` (54 tagged `M2`),
   `School_Setup_Workflow_v1.1.md:10`.

## Owner decisions open (carried forward)

| ID | Decision | Blocks |
| --- | --- | --- |
| **⚑D-c** | Licensing/entitlement model for `PLT-EPIC-03` | `PLT-EPIC-03`, EPIC-C |
| **`PLT-205` T6** | Owner review of the RBAC permission matrix | the whole RBAC path |
| **`DSN-04`** | Approved font stack for Tamil / Sinhala / Arabic | i18n work |
| **`PLT-105`** | Password reset before or after `PLT-EPIC-03`? | forgot/reset pages |
| **`F-15`** | Repo public or GitHub Pro — required status checks are a Pro feature on a private repo | CI enforceability |
| **`O-6`** | Pull the email adapter (`PLT-701`) forward? It blocks `PLT-105`. A cost call, not build order. | `PLT-105` |

Closed since session-2: **`SEC-115` AC-3** (owner ruled
2026-10-10: **keep `.env.local`** — dev machine, development just
starting; the criterion's substance holds in the committed tree).

## Quality gates

**All green, measured 2026-10-10 on `7682d34`** (supersedes the
`GATE_RESULTS_2026-10-09.md` figures):
format:check exit 0 · docs:verify **260 references** across 8
documents · check:route-guards **85 source files**, every route
guarded · check:coverage-tiers exit 0 · typecheck 8/8 · lint 8/8,
**0 warnings** · unit all 8 packages — API **73 files / 1278
tests** (rbac **14 files / 209 tests**), web **42 new rbac
tests**, i18n-resources 10 parity tests · coverage tiers OK, the
four new web rbac source files at **100% lines and branches** ·
build 9/9 · integration **15 files / 255 tests** (36.8s, real
PostgreSQL) · e2e **37/37** (1.4m).

## Traps still in force

- **After every fresh clone or `pnpm install`, run
  `pnpm --filter @eduflow/api exec prisma generate`** — no
  `postinstall` (`ci.yml:35-38`), deliberate.
- **`pnpm migration:run` now works with no hand-exported
  `DATABASE_URL`** (`SEC-115` AC-4: `apps/api/prisma/migrate.mjs`
  loads the root `.env`). Session-2's trap on this is **closed**.
- **`format:check:docs` fails on 60 files and CI never runs it**
  (`ci.yml:127` runs `format:check` only). Wire it or delete it.
- **The `pnpm test:integration` flake is closed** — `SEC-112`
  (`fileParallelism: false`, `connection_limit=15`); 255/255 this
  session.
- **`rbac.module.ts` contains mojibake em-dashes (`â€”`).** Edit
  anchors in that file must use pure-ASCII substrings or the edit
  tool will not match.
- **next-intl is 3.26.5** (`package.json` says `^3.26.3`). The
  client `NextIntlClientProvider` build throws without an explicit
  `locale` prop, but the react-server build resolves locale from
  the request context, so `useLocale()` works in client components
  under the layout's provider (which passes only `messages`).
- **The pre-commit hook** (lint-staged) runs `prettier --check`
  and per-package ESLint `--max-warnings=0` on staged files; the
  commit-msg hook requires Conventional Commits **plus a
  requirement ID** (`PLT-*`, `SEC-*`, …), subject ≤ 72 chars.
  Run `prettier --write` on new files before committing — 11 files
  needed it this session.
- **Cold-cache surface:** any `turbo.json` change invalidates
  every turbo cache and fires a fully cold `pnpm test`.
- **PowerShell 5.1:** no `&&` — use `;` or `if ($?)`. Multi-line
  `git commit -m` here-strings are unreliable — write the message
  to a file and use `git commit -F`.
- **Never print or commit real credentials.** `.env.local` still
  holds live Google OIDC credentials (see A-1/A-2 above).
