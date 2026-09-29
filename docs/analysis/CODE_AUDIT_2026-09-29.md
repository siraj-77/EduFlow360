# Code & Documentation Audit — 2026-09-29

**Purpose:** the evidence base for `docs/work/REMEDIATION_PLAN_2026-09-29.md`. Every row here was observed, not inferred. Where a command was run, its actual output is quoted.
**Audited commit:** `951acec` "feat(scaffold): P2 monorepo, toolchain, and AGENTS.md rules made executable" (8 commits total).
**Scope:** all 262 tracked files. `apps/api` (5 source files), `apps/web` (7 source files), `packages/*` (4 packages), `infra/`, `scripts/`, and all 42 markdown files under `docs/`.
**Companion:** `docs/work/GAP_ANALYSIS_2026-09-28.md` (pre-scaffold baseline) · `docs/work/REMEDIATION_PLAN_2026-09-29.md` (the action plan) · `docs/core/SSOT.md` (state of record).

---

## 1. Method

1. Full recursive read of `apps/`, `packages/`, `scripts/`, `infra/`.
2. Full read of every `docs/**/*.md` except the HTML template (35,204 bytes, noted not read).
3. **Every quality gate executed**, not assumed. Output quoted verbatim below.
4. Verification greps for each absence claim: `find`, `git check-ignore`, `git ls-files`, byte-level `od -c` for encoding.
5. Two independent parallel audits (codebase, documentation) whose findings were then re-verified by the orchestrator before inclusion. Any finding the orchestrator could not reproduce was dropped.

**NOT VERIFIED** is stated explicitly wherever a claim could not be checked. It appears nowhere else in this document — every other row was confirmed.

---

## 2. Gate results — executed

The seven `AGENTS.md` §4 gates, plus two the contract also requires.

| Gate | §4 requirement | **Actual** | Evidence |
|---|---|---|---|
| `pnpm typecheck` | 0 errors | ✅ **PASS** | 8/8 tasks, exit 0 |
| `pnpm lint` | 0 errors | ✅ **PASS** | 8/8 tasks, 0 errors, exit 0 |
| `pnpm test` | all pass | ✅ **PASS** | 51 tests, 5 files, 0 failures, 8/8 tasks |
| `pnpm test:coverage` | thresholds enforced | ❌ **FAIL, exit 1** | `MISSING DEPENDENCY  Cannot find dependency '@vitest/coverage-v8'` |
| `pnpm build` | green | ✅ **PASS** | `/en /ta /si /ar` prerendered as static |
| `pnpm test:integration` | containerised Postgres | ⚠️ **PASS but vacuous** | `No test files found, exiting with code 0` |
| `pnpm test:e2e` | Playwright | ❌ **FAIL, exit 1** | `Error: No tests found` → `@eduflow/web#test:e2e` |
| `pnpm format:check` | §8 "ESLint + Prettier must pass" | ❌ **FAIL, exit 2** | 60 files unformatted |
| `pnpm docs:verify` | — | ✅ **PASS** | `docs:verify OK — 155 references across 8 documents resolve` |

Verbatim failure output, `pnpm test:coverage`:

```
@eduflow/shared-types:test:coverage:  MISSING DEPENDENCY  Cannot find dependency '@vitest/coverage-v8'
@eduflow/ui-kit:test:coverage:       MISSING DEPENDENCY  Cannot find dependency '@vitest/coverage-v8'
@eduflow/shared-types#test:coverage:  ERROR  command (…) exited (1)
 Tasks:    3 successful, 8 total
Failed:    @eduflow/shared-types#test:coverage
```

**3 of 7 §4 gates fail, plus `format:check`.** `WORKLOG.md:17` records *"✅ Complete. All gates green."* and its table at `:32-39` lists only **six** gates — omitting precisely `test:coverage` and `test:e2e`.

---

## 3. Test inventory

| File | Lines | Tests | Result |
|---|---|---|---|
| `apps/api/src/config/env.spec.ts` | 93 | 12 | ✅ |
| `apps/api/src/config/lint-rules.spec.ts` | 158 | 14 | ✅ |
| `apps/web/src/lib/rtl.spec.ts` | 34 | 4 | ✅ |
| `packages/shared-types/src/index.spec.ts` | 19 | 3 | ✅ |
| `packages/ui-kit/src/index.spec.ts` | 115 | 8 | ✅ |
| `packages/i18n-resources/src/index.spec.ts` | 81 | 10 | ✅ |
| **Total** | **500** | **51** | **51/51 pass** |

`lint-rules.spec.ts` is the highest-value file in the repository: it runs ESLint's real `Linter` against the **real exported config** using virtual paths (`:22-23, 37-42`), and includes **negative tests** proving the rules are path-scoped rather than global (`:89-96` a controller may import NestJS; `:131-137` infrastructure may read the real clock). This is the "watch it fail" discipline `AGENTS.md` §4.1 asks for.

**Gaps:** no integration tests exist (`vitest.integration.config.ts:15` sets `passWithNoTests: true`). No component tests — `vitest.setup.ts` stubs `matchMedia` for `ThemeScript` but **no test ever renders `ThemeScript` or `layout.tsx`**, so the pre-paint script and the RTL shell are untested.

---

## 4. Findings — code (24)

Severity: **S1** blocks the next epic · **S2** must land before P4 · **S3** correctness/hygiene.

| ID | Sev | Finding | Evidence | Violates |
|---|---|---|---|---|
| **FIX-01** | S1 | `test:coverage` cannot run — `@vitest/coverage-v8` is declared in **no** `package.json` in the repo | `grep -rn "coverage-v8" --include=package.json .` → `NOT DECLARED`; `ls -d node_modules/.pnpm/@vitest+coverage*` → no such directory | §4 (mandatory gate) |
| **FIX-02** | S1 | `test:e2e` fails — `testDir` exists and is empty | `apps/web/playwright.config.ts:12` `testDir: './tests/e2e'`; `ls -A apps/web/tests/e2e` → empty; `git ls-files` → untracked | §4 |
| **FIX-03** | S1 | compose file is invalid YAML — line 1 is a JavaScript block comment | `infra/docker/docker-compose.yml:1` = `/**`, closed `:14` with ` */`; strict YAML parse fails at the transition to `name: eduflow` (16:5) | §14 |
| **FIX-04** | S1 | `proxy.ts` is dead code on Next 15 — no locale negotiation at all | Next **15.5.26**; `next/dist/lib/constants.js:265` `MIDDLEWARE_FILENAME = 'middleware'`; no `middleware.ts` anywhere; after a successful build `.next/server/middleware-manifest.json` → `middleware: {}` | §2.8, §3.1 |
| **FIX-05** | S3 | `format:check` fails on 60 tracked files, including `AGENTS.md` itself | `pnpm format:check` → exit 2; includes `AGENTS.md`, `CLAUDE.md`, `README.md`, all 20 `docs/adr/*.md`, `docs/core/{ARCHITECTURE,SSOT}.md`, `pnpm-lock.yaml` | §8 |
| **FIX-06** | S3 | `turbo.json` cache never invalidates — `globalDependencies` names two files absent from root | `turbo.json:4` `["…", "tsconfig.base.json"]`; `ls tsconfig.base.json` → no such file (it lives at `packages/config/tsconfig.base.json`); `.env` is gitignored and absent | §4 |
| **FIX-07** | S2 | `**/*.spec.ts` excluded from typecheck in **all 5** tsconfigs — test type errors are invisible | `apps/api/tsconfig.json:23`; `packages/{shared-types,ui-kit,i18n-resources}/tsconfig.json`; verified `tsc --listFiles \| grep -c spec.ts` → `0` | §4 |
| **FIX-08** | S2 | `main.ts` uses a `??` silent default for `WEB_ORIGIN`; `WEB_ORIGIN` and `NEXT_PUBLIC_API_URL` are in `.env.example` but not in the `env.ts` schema | `apps/api/src/main.ts:23` `origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000'`; `.env.example:45,48` declare both | §11 (no silent defaults) |
| **FIX-09** | S2 | `src/modules/modules/` — the module-registry feature shares a name with the container directory; ESLint layer globs are unanchored | `apps/api/src/modules/modules/`; `packages/config/eslint/node.js:96-97` `**/domain/**/*.ts` | §3, §13 |
| **FIX-10** | S3 | No theme **toggle**; no `loading.tsx` / `error.tsx` / `not-found.tsx` | `theme-script.tsx:20` **reads** `localStorage.getItem('eduflow-theme')`; repo-wide `setItem('eduflow-theme'` → no matches; i18n keys `theme.toggle`/`theme.light`/`theme.dark` already exist in all 4 locales and are unused | §3.2.4, §3.2.5 |
| **FIX-11** | S1 | shadcn/ui was never initialised; `ui-kit` has zero components — **and raw elements are banned** | `find . -name components.json` → empty; `packages/ui-kit/src/components/ui/.gitkeep` is the only content; `ui-kit/src/index.ts` exports only a token-name array; `ui-kit/package.json` has no `react` in `dependencies`; **but** `packages/config/eslint/next.js:22-38` errors on `JSXElement[name.name='button'\|'input'\|'select'\|'textarea'\|'table'\|'dialog']` | §3.2.1 |
| **FIX-12** | S1 | No CI and no pre-commit hook | `ls -d .github` → no such directory; `ls -d .husky` → no such directory; `grep -rn "gitleaks\|lint-staged\|husky\|commitlint" --include=package.json` → empty; `ls .git/hooks \| grep -v sample` → empty | §2.3, §4, §8 |
| **FIX-13** | S1 | `check-route-guards` does not exist; no `@Public` allowlist file | `apps/api/src/config/lint-rules.spec.ts:18-19` — *"P3 extends this to `check-route-guards`, `check-i18n` and `check-worklog`"*; `scripts/` contains exactly one file; `ARCHITECTURE.md:335-337` claims three rows enforced by `scripts/check-route-guards` | §2.3 |
| **FIX-14** | S1 | Test-runner contract conflict — docs say Jest, scaffold ships Vitest | `AGENTS.md:216` `Jest, React Testing Library, Playwright (web), Detox (mobile)`; `apps/api/package.json:47` + `apps/web/package.json` both `"vitest": "^2.1.8"`; `SRS §10` six Jest rows; `ARCHITECTURE.md:351` `Jest coverageThreshold`; `TODO.md:93` `REPO-05` — Jest. **Resolved by D27 / ADR-020.** | §3.1 |
| **FIX-15** | S2 | Money-float, i18n-literal and dependency-boundary rules are prose only | no `dependency-cruiser`, no `.dependency-cruiser.*`, no `import/no-restricted-paths`; `Money{amountMinor: bigint}` in `shared-types/src/index.ts:48-51` is advisory — nothing forbids a `number` | §2.5, §2.8 |
| **FIX-16** | S2 | `prisma/schema.prisma` is empty — no models, no `migrations/`, no `seed.ts` | `apps/api/prisma/schema.prisma:31-38` — only `generator client` + `datasource db`; `apps/api/prisma/migrations/` missing. Disclosed as D22 | §2.5, §2.6, §2.7 |
| **FIX-17** | S3 | Mojibake in two tracked files; two unpinned images; no MinIO bucket bootstrap | `apps/api/package.json:17` raw bytes `C3 A2 E2 82 AC E2 80 9C` — **executed** at test time; `apps/web/package.json:5` same; `docker-compose.yml` uses `minio/minio:latest` and `axllent/mailpit:latest` while Postgres/Redis are pinned; no service creates `STORAGE_BUCKET` | §11 |
| **FIX-18** | S3 | `ARCHITECTURE.md` overstates enforcement on three rows | `:343` money "Type system + review"; `:346` "No user-facing literal in JSX/TSX \| ESLint" — no such rule exists; `:351` "Jest `coverageThreshold`" | ARCHITECTURE §17 |
| **FIX-19** | S3 | `ARCHITECTURE.md` has no coverage section, no CI/CD section, no per-school deployment topology, no error-handling spec | verified by full read; §2.1 requires "Migrations applied per school database" and no section owns that | ARCHITECTURE |
| **FIX-20** | S3 | `packages/config` has **no `scripts` object** — the entire enforcement layer is never linted or typechecked | `Object.keys(scripts)` → `[]`; the six load-bearing files (`eslint/{base,node,next}.js`, 3 tsconfigs) reach the gate only as an ESLint import | §4 |
| **FIX-21** | S3 | Prettier config has two sources of truth; the package export is dead code | `.prettierrc.json` and `packages/config/prettier.config.js` are byte-equivalent; `packages/config/package.json:14` exports `"./prettier"`; repo-wide grep for `@eduflow/config/prettier` → **zero** references | §8 |
| **FIX-22** | S2 | The build-script allow-list in `pnpm-workspace.yaml` did not work, so **`pnpm add` exited 1** and no dependency could be added cleanly. **Fixed 2026-09-29.** The cause was worse than the audit first recorded | The file carried **two** allow-lists. `allowBuilds` had literal `set this to true or false` strings instead of booleans. `onlyBuiltDependencies` turned out to be **inert in pnpm 11.22.0** — it reads back correctly via `pnpm config get` but pnpm never acts on it, blocking 4 packages including `esbuild`. Measured: inert key alone → `ERR_PNPM_IGNORED_BUILDS`, exit 1; equivalent `allowBuilds` block → exit 0, postinstalls run. `pnpm install` on a satisfied tree exits 0 either way, so the breakage is invisible until a dependency is added | — |
| **FIX-23** | S3 | `pnpm clean` uses `rm -rf` — not Windows-compatible, against the repo's own no-Docker Windows path | `package.json:22`; `README.md` documents running on Windows without Docker | — |
| **FIX-24** | S3 | The theme-token test reads **source** `styles.css`, not the built CSS | `packages/ui-kit/src/index.spec.ts:25-28` reads the file from disk; the minifier rewrites `--surface:#ffffff` → `#fff` in the shipped bundle, so a token could be correct in source and wrong after build with no test failing | §3.2.5 |
| **FIX-25** | S3 | `docs-verify.mjs` cannot resolve `path:line` references — **found during the doc correction pass, not by the original audit** | `scripts/docs-verify.mjs:60-65` filters on `PATH_EXTENSIONS` and `REPO_ROOT_RE` but never strips a trailing `:\d+`. Writing `` `docs/idea-bank/README.md:3` `` makes the resolver look for a file literally named `README.md:3` and report it missing. Root-level references like `` `.gitignore:99` `` escape only because `REPO_ROOT_RE` requires a `docs/`-style prefix, so the limitation is invisible until someone writes a line-anchored reference under `apps/`, `docs/`, `infra/` or `packages/` | OPS-05 |

**FIX-25 is a real RED gate already observed:** the doc pass produced

```
  - docs/core/SSOT.md: docs/idea-bank/README.md:3 — referenced but does not exist
  - docs/core/SSOT.md: infra/docker/docker-compose.yml:1 — referenced but does not exist
2 broken reference(s) in 179 checked.
```

and `pnpm docs:verify` exited 1. The prose was corrected rather than the tool, so the defect is still open. `docs-verify.mjs` already carries two prior patches for the same class of problem — `WORKLOG.md:77` records *"The `docs-verify` regex truncated paths at `*` and at em-dashes"*. **This is the third instance.** The tool is being patched reactively against prose conventions it should be tolerant of.

### Found while fixing FIX-01

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| **FIX-26** | S3 | **The `AGENTS.md` §4 coverage tiers are correctly written but currently match zero instrumented files.** The gate now runs and exits 0 while enforcing nothing | API thresholds are `src/**/domain/**/*.ts`, `src/**/use-cases/**/*.ts`, `src/**/*.controller.ts` — **no `domain/`, `use-cases/` or `*.controller.ts` file exists**, so all three globs match 0 files. Web thresholds are `src/**/hooks/**` and `src/lib/**`; `src/lib/` contains only `rtl.spec.ts`, a test file that is not instrumented. Measured coverage of real source: `env.ts` 97.84%, but `main.ts` 0%, `app.module.ts` 0%, `layout.tsx` 0%, `page.tsx` 0%, `theme-script.tsx` 0% — **none of which has any threshold** |
| **FIX-22** ↑ | S2 | `pnpm add` **exits 1**, so the repository cannot take a new dependency through its normal path. **Now diagnosed and fixed 2026-09-29** | `pnpm add -D @vitest/coverage-v8 …` completed the install and wrote the lockfile, then exited non-zero with `[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: @prisma/client@6.19.3, prisma@6.19.3`. The first hypothesis — that removing the malformed `allowBuilds` block was sufficient — was **wrong**, and was disproved by running it. The real cause is that `onlyBuiltDependencies` is inert in pnpm 11.22.0; the working key is `allowBuilds` with boolean values. `pnpm install` on a satisfied tree exits 0, so the failure is invisible until a dependency is added |

**On FIX-26, precisely what is and is not wrong.** The gate is *not* broken: the tiers are correct, they match `AGENTS.md` §4 exactly, and they will bite the moment P4 creates a `domain/` folder — that is the gate working as designed against code that does not exist yet. The genuine gap is narrower: **real, currently-undertested source (`main.ts`, `app.module.ts`, `layout.tsx`, `page.tsx`, `theme-script.tsx`) carries no threshold at all**, so it can fall to 0% without failing anything. That part is not self-resolving and is worth a threshold once the P4 walking skeleton exists. Recorded rather than fixed here, because a test asserting the *absence* of a `domain/` directory would be testing the absence of code rather than a defect.

### 4.1 Compliant — recorded so it is not "fixed" later

| Area | Evidence |
|---|---|
| Tailwind v4 correctly CSS-first (**no `tailwind.config` is correct**) | `postcss.config.mjs:3`; built CSS contains `.text-muted{color:var(--muted)}`, proving `@theme inline` resolved from the imported package file |
| §3.2.5 token set present and **exact** | `ui-kit/src/styles.css:17-37` — all 10 tokens at the exact `AGENTS.md:227-228` values; 5 dark overrides at the exact §3.2.5 values; `prefers-reduced-motion` at `:68-77`; `--motion-base:200ms`, `--touch-target-min:44px` |
| Pre-paint theme, no FOUC | `theme-script.tsx` rendered inside `<head>` (`layout.tsx:41-43`); `suppressHydrationWarning` on `<html>` (`layout.tsx:40`); `prefers-color-scheme` honoured at `theme-script.tsx:20-24` |
| i18n parity **perfect** | 38 keys, identical sets across en/ta/si/ar; zero missing, zero extra. Translations are genuine — `ar.nav.dashboard`=لوحة المعلومات, `si.nav.dashboard`=උපකරණ පුවරුව, `ta.nav.dashboard`=டாஷ்போர்டு. Enforced by 10 tests including an anti-stub check that no locale copies `nav.dashboard` verbatim |
| `env.ts` fail-fast is real and enforced | `main.ts:14` calls `loadConfig()` before `NestFactory.create`; verified live: `PORT=notanumber npx nest start` → `Error: EDUFLOW — environment validation FAILED.` naming the variable. `env.spec.ts` is a 12-case table including placeholder rejection and "names EVERY invalid variable at once" |
| §2.2 / §2.4 mechanically enforced | `eslint/node.js:19-59,100-107` framework/ORM/queue/vendor-SDK import ban; `:61-84,108-113` `Date.now()`/`new Date()`/`Math.random()` ban. Both test-verified |
| Module tree complete | 12 modules × 12 directories, all `.gitkeep`; zero missing against `AGENTS.md` §3 |
| `.env.example` well-formed | 48 lines, all `<…>` placeholders, no real-looking credentials. `.env.local` correctly gitignored (`.gitignore:8`); `git ls-files` confirms only `.env.example` is tracked |
| `tsconfig.tsbuildinfo` correctly ignored | `.gitignore:31`; `git check-ignore -v` confirms; **zero** `.tsbuildinfo` files tracked. `apps/api/tsconfig.json:20` sets `tsBuildInfoFile` to prevent the documented emit-nothing footgun |
| `AGENTS.md` §9 same-commit rule | `git show --stat 951acec` includes both `docs/work/WORKLOG.md` (+107) and `docs/work/TODO.md` (+123). **Satisfied** |

---

## 5. Findings — documentation (8)

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| **DOC-01** | S1 | `AGENTS.md §6` publishes **five invented figures** for the idea-bank, and instructs the reader to treat that directory as "the authoritative requirements" | `AGENTS.md:331-337` tabulates *139 modules / 20 domains · 257 rules · 35 entities · 15 risks / 40 boundary tests / 41 failure modes · 73 FRs + 9 NFRs*. All five files declare `**Status:** Placeholder. Zero …rows.` Total **16,124 bytes** — physically incapable of holding the claimed content. `docs/idea-bank/README.md:3` says `**Status:** 🔴 **STUBS ONLY. The extraction has not been performed.**` The false figures propagate to `GAP_ANALYSIS:285` and `WORKLOG.md:308`. Independently enumerating `SRS §3` yields **87 unique FR IDs**, not 73 (the 9 NFR figure is correct). **Resolved by D28.** |
| **DOC-02** | S1 | `AGENTS.md` still declares the repository has no code | `AGENTS.md:8` `> **Status:** pre-scaffold. No application code exists yet.`; `AGENTS.md:17` `The codebase is not yet scaffolded.` `AGENTS.md` was last modified at `8105a27` — *before* the scaffold. `CHANGELOG.md:6` repeats it. **Blocked — owner sign-off required (D14).** |
| **DOC-03** | S1 | `SSOT.md §3` "What Does Not Exist" is false and internally contradicts `SSOT.md §1` | `SSOT.md:13-14` says *"P2 (Prompt Pack scaffold) is complete … 51 passing tests"*; `SSOT.md:81-89` §3, headed "What Does Not Exist", opening *"Nothing has been built"*, claims all source, all infra and all tooling absent. `951acec` added 223 files / 9,988 insertions and did **not** touch §3. Also: `SSOT.md:70` still calls the School Setup Workflow "orphaned — not referenced by `AGENTS.md`" (false; `AGENTS.md:19` names it — GAP C-06 was closed at `8105a27`); header `Last updated: 2026-09-28` while §1a is dated 2026-09-29; **GAP-05 is listed twice** at `:166` and `:168` with different wording |
| **DOC-04** | S2 | `GAP_ANALYSIS`'s own "Changed since" delta table is now stale | Banner `:13-26` says "3 commits" (now 8), "GAP-03 no toolchain = still open, **the #1 blocker**" (closed — the #1 blocker is now GAP-09 no-CI), "23 markdown files" (now 42), "`ADR-001…006`" (now `001…019`). The *decision* to leave a dated analysis unrewritten is sound (D34); the defect is that its delta aged the same way. Also `:285` repeats the false `257/35/73` figures |
| **DOC-05** | S2 | Four decisions were made with **no ADR** | `docs/adr/README.md:52` — *"**No ADR is `Accepted`.** Nothing in this directory has been signed off."* `README.md:94-102` requires an ADR for anything *"expensive to reverse, constrains future work, or non-obvious enough that a competent engineer would plausibly have chosen differently."* Four clear that bar and live only in SSOT/WORKLOG: (1) Vitest over Jest; (2) `eslint-config-next` rejected (D25) — `README.md:98` explicitly requires an ADR for a new build tool; (3) toolchain versions Tailwind v4 / Node ≥ 22 / Prisma / Nest / Next (D22–D24) — only the Docker half (D23) became ADR-019; (4) `next-intl` — `AGENTS.md:214` says *"confirm before adding"*, and it was added |
| **DOC-06** | S2 | `TODO.md` has duplicated, contradictory and false blocks | `:9` opens `## P0` with items 1-6, then **restarts numbering** at `:87` (`### 4. Build the toolchain`) and `:100` (`### 5. Extract the requirements`) — both duplicates, and `:89` states *"Until this lands, `test-driven-development` and `tdd-workflow` cannot execute — there is no runner, no coverage command, no git."* **False on all three counts.** `:208` repeats it: *"the test runner does not"*. A **P0** item (`## 3. Approve the Decision Records`) is filed under `## P2` at `:175`. Header still `Last updated: 2026-09-28` |
| **DOC-07** | S2 | `PLATFORM_CORE_PLAN.md` §3.1/§8 are stale, and its gate claim is circular | `:53` lists "Test harness green — Jest… coverage gates" unticked (done, in Vitest); `:80-85` §3.1 "Work that precedes P0" still shows Toolchain ❌ / Skeletons ❌; `:94` *"The test runner is missing, so no production code can be written."* — false; `:133` "MinIO is not optional" is contradicted by ADR-019. `:139` claims the P0-P14 reorder satisfies the licensing gate, but `SRS §24` Gate M2 requires license enforcement at **end of Phase 1** and P8 sits after P4/P4W/P5/P6/P7 — reordering relabels which step is "Foundation Complete", it does not move the gate. `SRS §24` was never amended. Same class of unresolved conflict as ⚑9 |
| **DOC-08** | S3 | The `Money` `bigint` → JSON boundary is unmapped, and the type is already live in a cross-app contract | `ADR-002:48` — *"`bigint` does not serialise to JSON. Requires an explicit boundary conversion… **This must be designed in `ARC-06`, not discovered later.**"* But `packages/shared-types/src/index.ts:48-51` already ships `Money { amountMinor: bigint }` with a passing test, and ARC-06's dependency is **not** in `PLATFORM_CORE_PLAN.md`'s 20 entry conditions. A future API story returning `Money` hits `TypeError: Do not know how to serialize a BigInt`. `ADR-002:53` also leaves Postgres `numeric` ↔ integer-minor-units mapping unstated. **Not yet decided** — `REMEDIATION_PLAN` EPIC-ADR proposes ADR-024 (Money crosses the wire as a decimal string; `Money` moves behind a `MoneyDto` so `shared-types` never ships a raw `bigint`). Not covered by D27-D32. |

---

## 6. Reconciled — no action needed

| Claim | Result |
|---|---|
| Story and point counts | **Reconcile exactly.** 9 epics · **33 stories · 199 points**, verified by independent enumeration in `AGENTS.md §7`, `EduFlow_Jira_Epics_…_v1.md` (both the index and the per-story `- **Story Points:**` sum), `PLATFORM_CORE_PLAN.md:28-30`, `SSOT.md:69`, Prompt Pack §2.2. `AGENTS.md §7`'s *"reconcile if they differ"* flag is answered and should be struck |
| Coverage thresholds | **Match.** `SRS §12` ≡ `AGENTS.md §4` ≡ `apps/api/vitest.config.ts:15-27` (domain + use-cases 90/85, controllers 70) and `apps/web/vitest.config.ts:26-30` (hooks 80, lib 80). Numerically correct — merely unrunnable (FIX-01) and currently globbing 0 files |
| `pnpm docs:verify` | **PASS** — 155 references across 8 documents, 7 on a justified `ALLOWED_MISSING` allowlist (`scripts/docs-verify.mjs:40-48`) |
| `ARCHITECTURE.md` vs `AGENTS.md` | **No contradictions.** Strictly *more* specific in three places: the per-layer may/may-not-import table (§2), `@Public` + `@RequireEntitlement` rejection (:89), `Math.random()` (:337). Gaps listed as FIX-19 |
| `LEGACY_REUSE_INVENTORY.md` | **Accurate and honest.** Corrects `AGENTS.md §5.2`'s "9 sites" to a measured **149** and records the measurement method — satisfying its own IMP-07 standard that *"a number nobody can reproduce is not a control."* Per-file judgement table is empty **by design**, with a 7-item work queue |
| `FRONTEND_TEMPLATE.md` | **Accurate and honest.** Enumerates all 21 keys, verifies the Arabic codepoints, tabulates 6 missing RTL requirements, refuses the marketing claims. Records that the template proves browser-side rendering but says nothing about the PDF pipeline. Highest-quality document pair in the repo |
| Master Plan §5 module tree | ~60-70 named nodes, **not 139** — corroborates DOC-01 |
| Master Plan §29 | 30 rows, exactly as `idea-bank/README.md:64` and `module-inventory.md:30` claim ✅ |
| `AGENTS.md §9` same-commit rule | **Satisfied** for `951acec` |

---

## 7. Open conflicts requiring an owner decision

| # | Conflict | Blocking |
|---|---|---|
| **⚑A** | `AGENTS.md §3.1` says Jest. Q1(a) approves amending it to Vitest, but the standing instruction is **do not touch `AGENTS.md` §2/§3/§13**. §3.1 is inside §3. **Not edited.** ADR-020 records the amendment as blocked pending per-line sign-off | `FIX-14` stays partially open |
| **⚑B** | `AGENTS.md:8,17` "pre-scaffold / no application code" (DOC-02) — same §2/3/13 restriction does not apply (§8 and the preamble), but D14 requires owner approval. **Not edited** | `DOC-02` stays open |
| **⚑C** | `SRS §19` puts a Parent mobile Personal Portal in the MVP and `SRS §20` AC-5 requires it; `AGENTS.md §7` (D5) and `ADR-005` make mobile milestone 2; Master Plan §24 carries a full mobile architecture. Three documents, two positions | MVP scope ⚑9 |
| **⚑D** | `SRS §24` Gate M2 vs. the P0-P14 ordering (DOC-07) | Phase 0 exit |
| **⚑E** | `PLT-107` (first-admin bootstrap) required by Workflow §6.5; **no existing story covers it**, so a fresh deployment cannot create its first administrator | Epic 01 ⚑11 |
| **⚑F** | Node floor: `.nvmrc` = 22, the local runtime is **26.7.0** | CI reproducibility |

---

## 8. Not in scope

The `EduFlowV3` legacy corpus (read-only reference, `AGENTS.md` §5) was not re-audited; `docs/analysis/LEGACY_REUSE_INVENTORY.md` covers it. `docs/archive/` is empty. `docs/template/EduFlow — Frontend Template.html` (35,204 bytes) was not read line-by-line — `docs/design/FRONTEND_TEMPLATE.md` is its analysis of record.

---

*Companion documents: `docs/work/REMEDIATION_PLAN_2026-09-29.md` · `docs/work/GAP_ANALYSIS_2026-09-28.md` · `docs/core/SSOT.md` · `docs/work/TODO.md` · `docs/work/WORKLOG.md`.*
