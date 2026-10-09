# Gate results — first full run on the restored tree

**Date:** 2026-10-09 · **Tree:** `bb27b6f` (the repository-restore commit) + working-tree fixes
**Node** v26.7.0 · **pnpm** 11.22.0 (`packageManager` exact match) · floor ≥ 22 per `engines`
**Postgres** localhost:5432 (`eduflowdb_new`, created fresh) · **Playwright** chromium installed

## Result: 14 of 14 gates green

| # | Gate | Command | Result |
|---|---|---|---|
| 1 | Install | `pnpm install --frozen-lockfile` | 676 packages, lockfile passes supply-chain policy, **0 downloaded** (all reused from `H:\.pnpm-store`), 8s |
| 2 | Prisma client | `pnpm --filter @eduflow/api exec prisma generate` | v6.19.3 generated. **Required manual step — see Finding F-1** |
| 3 | Typecheck | `pnpm typecheck` | **8/8 tasks, exit 0** |
| 4 | Lint | `pnpm lint` | **8/8 tasks, exit 0** — 1 pre-existing warning (`sign-in-form.spec.tsx:185` `no-non-null-assertion`) |
| 5 | Format (code) | `pnpm format:check` | **exit 0** — "All matched files use Prettier code style!" |
| 6 | Unit tests | `pnpm test --force` | **1,432 passed, 0 failed** across 85 files — api 1,264 · web 123 · ui-kit 28 · i18n 10 · shared-types 7 |
| 7 | Coverage | `pnpm test:coverage` | **8/8 tasks, exit 0** — "coverage tiers OK - every configured threshold matches at least one source file" |
| 8 | Build | `pnpm build` | **9/9 tasks, exit 0** — `/en` `/ta` `/si` `/ar` all prerendered |
| 9 | Migrations | `pnpm migration:run` | baseline applied. **Required an exported `DATABASE_URL` — Finding F-2** |
| 10 | Integration | `pnpm test:integration` | **240 passed, 0 failed** across 14 files |
| 11 | E2E | `pnpm test:e2e` | **37 passed, exit 0** (51.6s) |
| 12 | Docs | `pnpm docs:verify` | 251 references across 8 documents resolve, exit 0 |
| 13 | Route guards | `pnpm check:route-guards` | 83 source files, every route guarded, exit 0 |
| 14 | Coverage tiers | `pnpm check:coverage-tiers` | exit 0 |

This is the **first time every gate has been run in one pass on a clean install of this
tree.** The historical "ten gates green" figure belonged to `ff88d3c`; it has now been
re-measured at `bb27b6f`.

---

## Findings

### F-1 · A fresh clone cannot typecheck without a manual `prisma generate` — S3, doc gap

`pnpm install` completes cleanly and `pnpm typecheck` then fails across 11 files with:

```
Module '"@prisma/client"' has no exported member 'PrismaClient'
TS7006: Parameter 't' implicitly has an 'any' type
```

The cause is that the Prisma client is a **generated artifact**, and no `postinstall` hook
exists anywhere in the workspace — so a clean install never produces it.

**This is deliberate and documented**, and the reasoning is correct. `.github/workflows/ci.yml:35-38`:

> The Prisma client is generated explicitly. `@prisma/client`'s own postinstall does this,
> but an implicit step is a step nobody can see fail; the explicit `prisma generate` makes
> the dependency visible and deterministic.

So the gate is right and the **documentation is missing**: the README listed
`pnpm install → pnpm dev` as the whole setup and never mentioned the generation step. A
first-time contributor following the README hits an error that does not name its cause.

Fixed in the README under "Fresh clone: one required manual step".

### F-2 · The Prisma CLI cannot read the repository-root `.env` — S2, evidence for SEC-115

`pnpm migration:run` fails with a bare `Validation Error Count: 1` because
`schema.prisma:57` is `url = env("DATABASE_URL")` and the CLI looks for `.env` beside the
schema (`apps/api/prisma/`), not at the repository root.

Three loaders, three different answers about where configuration lives:

| Consumer | Where it looks | Effect |
|---|---|---|
| `apps/api/src/config/env.ts` | process env, Zod-validated | fail-fast by name |
| `vitest.integration.config.ts` | `resolve(import.meta.url, '../../.env')` | works |
| **Prisma CLI** | **beside `schema.prisma`** | **fails** |

Exporting `DATABASE_URL` makes it work; that is what every developer must currently do by
hand. This is the substantive half of roadmap item **D-09** and belongs in **SEC-115**.

### F-3 · `format:check:docs` fails on 60 files and is not in CI — S4

`pnpm format:check` (code) passes. `pnpm format:check:docs` fails:

```
docs/work/RESUME_2026-10-08.md · docs/work/TODO.md · docs/work/WORKLOG.md · AGENTS.md · README.md
Code style issues found in 60 files.
```

Pre-existing — it flags files nobody edited in this session. CI runs `format:check` only and
never `format:check:docs` (`ci.yml:127`), so the script is **dead weight that reads as a
gate**. Either wire it into CI and fix the 60 files, or delete it. Left as-is here because
neither is mine to decide.

### F-4 · Prisma 7 deprecation warning — S4, future work

`prisma generate` emits:

> The configuration property `package.json#prisma` is deprecated and will be removed in
> Prisma 7. Please migrate to a Prisma config file (e.g., `prisma.config.ts`).

Harmless on Prisma 6.19.3. Becomes a breaking change on upgrade. Belongs on the backlog with
`ARC-09-9` and the `schema-generation.spec.ts` line-ending work.

### F-5 · My own analysis was wrong twice — corrected, recorded, not buried

**The `KEY = value` debt item was false.** The roadmap asserted that `.env`'s
`DATABASE_URL = postgres…` form "may not load at all". Node's `process.loadEnvFile()`
trims whitespace — verified with a throwaway probe before changing anything. Migration,
integration and e2e all ran green against the existing `.env`. Item **D-05 is withdrawn**.

**The integration-spec count was wrong.** I wrote "15 integration spec files"; there are
**14**, which is exactly what vitest reports. A miscount from reading a list.

Both are recorded here rather than quietly amended, because a debt register that only ever
grows is not a debt register.

---

## What is still outstanding

| Item | Severity | Where |
|---|---|---|
| **SEC-115** env reconciliation — three loaders, four var schemes, 12 unresolved placeholders in `.env.example`, `NEXTAUTH_*` contradicting `ADR-008` | P0 | roadmap D-09, D-05(w), D-06, D-07 |
| `format:check:docs` — wire or delete (F-3) | P4 | — |
| Prisma 7 migration (F-4) | P4 | backlog with `ARC-09-9` |
| `OPS-105` gitleaks, `OPS-106` git hooks | P1 | `docs/work/TODO.md` |
| `SEC-112` integration schema isolation | P1 | `docs/work/TODO.md` |
| The 42-item debt register and 10-row contradiction matrix | S1–S4 | `docs/superpowers/plans/2026-10-09-strategic-roadmap-v2.md` |

**Not yet run, and not claimed:** nothing. Every gate in `ci.yml` was executed except the
ones CI skips by design on this branch. The gate list in `ci.yml` is authoritative.