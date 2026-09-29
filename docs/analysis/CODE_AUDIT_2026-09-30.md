# CODE AUDIT — 2026-09-30

**Audited commit:** `f67c8aa` · **Branch:** `main` · **Working tree:** dirty (see §1.1)
**Method:** every row in §2 was **executed**, not inferred from a config file. The predecessor (`CODE_AUDIT_2026-09-29.md`) established that rule; this audit extends it to the *new* findings, four of which are gates that had been reported green and are not.
**Predecessor:** `docs/analysis/CODE_AUDIT_2026-09-29.md` · 32 findings. This file supersedes it as the current measurement.

---

## 1. Executive summary

**The project is a well-built scaffold with a dishonest measurement layer.**

The engineering that exists is unusually disciplined: layering and determinism rules are real ESLint rules that fire, i18n parity is enforced by tests, the ERD is generated from one source so it cannot drift from the Prisma schema, and several test files encode *specific past incidents* so they cannot recur. On 2026-09-28 the gap analysis was correct to say the problem was absent tooling. That is now solved. The problem has moved.

It has moved to the layer that *reports on* the work. Five of the ten gates are green for reasons unrelated to what they claim to verify, and the single most load-bearing sentence in `SSOT.md` — *"8 commits, working tree clean"* — is false on both counts. Every claim made on 2026-09-29 about the ERD, the coverage fix, the e2e fix and the build-script fix exists **only in the working tree** and has never been pushed.

**The headline finding is a test that cannot fail because it cannot run.** `apps/web/web-port.spec.ts` — three tests written specifically to prevent a documented incident in which Playwright ran all 11 e2e tests against an unrelated application on port 3000 — matches neither of its package's `include` globs and has **never executed**. It is not a weak test. It is a dead one, and it is dead in the exact way `SSOT.md:345` warns about.

### 1.1 The one fact that governs everything else

`SSOT.md:16` states *"Git, on `main`, pushed to the private remote `siraj-77/EduFlow`. 8 commits, working tree clean."*

**Measured 2026-09-30:**

| Claim | Measured | Delta |
| --- | --- | --- |
| 8 commits | **14** | +6 |
| working tree clean | **15 modified, 12 untracked** | false |
| pushed | **local-only** | unverified |

Uncommitted: the entire ARC-01 body of work (`schema-source.mjs`, `generate.mjs`, both renderers, `audit-immutability.sql`, `prisma-schema.spec.ts`, `schema-generation.spec.ts`, all three `docs/diagrams/ERD_PLATFORM_CORE.*`), the FIX-01/02/22 fixes, the e2e suite, and every doc change made in the last 24 hours.

This is not a tidiness complaint. It is the same failure the audit corpus names at `SSOT.md:345` — *"A gate marked `[x]` on the strength of a config file existing is not a gate that passed"* — applied to a *status* marked complete on the strength of files existing on disk. `AGENTS.md §9` requires the worklog to be updated in the same commit as the change. Five commits of TDD checkpoints are green in the log; none of their files are in git.

---

## 2. Gate results — executed 2026-09-30

| Gate | Command | Exit | Truthful? | Note |
| --- | --- | --- | --- | --- |
| Typecheck | `pnpm typecheck` | **0** | ✅ yes | 8/8 tasks |
| Lint | `pnpm lint` | **0** | ✅ yes | 8/8 tasks, 0 errors |
| Unit tests | `pnpm test` | **0** | ⚠️ **partly** | 8/8, **103 tests** — but 3 of them never run (§3.1) |
| Coverage | `pnpm test:coverage` | **0** | ❌ **no** | §4 tiers match **0 instrumented files**; `web` reports **0%** |
| Build | `pnpm build` | **0** | ✅ yes | 5/5; `/en /ta /si /ar` prerendered |
| Integration | `pnpm test:integration` | **0** | ❌ **no** | *"No test files found"* **and** an `echo && exit 0` stub (§3.2) |
| E2E | `pnpm test:e2e` | not run | ⚠️ **partly** | 11 tests declared; **1 passes vacuously** (§3.3) |
| Format | `pnpm format:check` | **2** | ✅ yes | **FAILS** — the one honestly red gate |
| Docs | `pnpm docs:verify` | **0** | ✅ yes | **188 refs / 8 docs** (corpus says 147, 155, 179) |
| `pnpm add` | — | — | ✅ yes | `allowBuilds` boolean map; regression test exists |

**Honest score: 5 of 9 gates green and trustworthy, 2 green but hollow, 1 red, 1 not run.**

### 2.1 Test count correction

`SSOT.md` carries the number **three times in one table** — `51 → 63` at line 36, `78` at line 42, both rows labelled `pnpm test`. Measured:

| Package | Tests | Files |
| --- | --- | --- |
| `@eduflow/api` | 78 | 7 |
| `@eduflow/i18n-resources` | 10 | 1 |
| `@eduflow/ui-kit` | 8 | 1 |
| `@eduflow/web` | **4** | 1 |
| `@eduflow/shared-types` | 3 | 1 |
| **Total** | **103** | **11** |

Plus 11 e2e. `web` is the outlier at 4 and it is the reason: see §3.1.

---

## 3. New findings — hollow gates

These four are not in any prior document. Each is a gate reported green that verifies nothing, or a test that cannot run. They share one root cause: **nothing in the repository watches whether a gate is actually wired to anything.** `e2e-gate.spec.ts` and `coverage-gate.spec.ts` were written to solve exactly this for two gates; the class of defect recurred in four adjacent places they do not cover.

### 3.1 `web-port.spec.ts` has never executed — **P0, NEW**

**Measured, twice:**

```
$ pnpm --filter @eduflow/web exec vitest run web-port.spec.ts
No test files found, exiting with code 1

$ pnpm --filter @eduflow/web test
Test Files  1 passed (1)
     Tests  4 passed (4)
```

`apps/web/vitest.config.ts:15` declares:

```ts
include: ['src/**/*.spec.{ts,tsx}', 'tests/**/*.spec.{ts,tsx}'],
```

`apps/web/web-port.spec.ts` is at the **package root**. It matches `src/**` — no. It matches `tests/**` — no. The file is invisible to the runner. Naming it explicitly still finds nothing, because Vitest applies `include` as a filter even to explicit arguments.

**Why this is P0 and not a tidiness item.** `web-port.ts` and `web-port.spec.ts` exist because of a real, documented incident (`web-port.ts:5-18`): on 2026-09-29 the port was 3000 in four places, an unrelated application held 3000, answered Playwright's readiness probe with a 307, and **all 11 e2e tests ran against that other application — 11 failures, none of which mentioned the port.** The port was then centralised into `web-port.ts`, with a deliberately accepted duplication in `package.json` ("npm scripts are not a module graph"), and that accepted duplication is *only* held in place by `web-port.spec.ts`.

So: the fix for a silent-wrong-application failure is unguarded, and the guard does not run. The next person who changes `--port 3500` to `--port 3000` in `dev` or `start` reintroduces the exact incident, and the test that exists to prevent it will not notice. The test will also keep *looking* correct in review, which is worse than having no test.

**Also note:** `rtl.spec.ts` has exactly 4 tests, matching the run. The web package's four passing tests are the *only* ones running. This also means the docs' claim of "4 files" for `pnpm test` is off — the corpus describes 6 and 7 at different times, and the true figure is 11 spec files of which 1 is excluded by a glob.

### 3.2 The integration gate is hollow in both packages that declare it — **P1, NEW**

`e2e-gate.spec.ts` contains a test named *"no package declares an e2e script that always passes"*, and `isPassingStub()` is implemented and working. It checks `test:e2e` only.

| Package | `test:integration` | Verdict |
| --- | --- | --- |
| `@eduflow/api` | `vitest run --config vitest.integration.config.ts` | **hollow** — `passWithNoTests: true` (`vitest.integration.config.ts:15`), 0 `*.integration.spec.ts` exist |
| `@eduflow/web` | `echo "no web integration suite at P2" && exit 0` | **hollow** — a literal passing stub, the exact shape `isPassingStub()` detects |
| 4 packages | *(no script)* | correct — turbo skips them |

`pnpm test:integration` exits **0**. It is listed in `AGENTS.md §4` as a mandatory gate: *"Integration — `pnpm test:integration` — Containerized real-Postgres, isolated schema."* It runs nothing, in either package, and no test watches it.

`isPassingStub()` already exists and already works. Extending the guard from `test:e2e` to `test:integration` is a two-line change plus the guard that `passWithNoTests: true` is not silently vacuous.

### 3.3 The e2e nav-parity test passes with zero navigation — **P1, NEW**

`apps/web/tests/e2e/shell.spec.ts` — *"the four locales expose the same set of navigation destinations"*:

```ts
const nav = await readNav(locale);
expect(nav.length, `/${locale} rendered ${nav.length} nav destinations where /en rendered ${en.length}`).toBe(en.length);
```

`readNav` resolves `page.locator('nav a, header a')`. `apps/web/src/app/[locale]/page.tsx:32-37` renders:

```tsx
<nav aria-label={t('dashboard')} className="flex flex-col gap-2">
  <span className="text-muted text-sm">
    {t('dashboard')} · {t('students')} · {t('staff')} · {t('academics')}
  </span>
</nav>
```

**There is not one `<a>` element in the entire web app.** So `allInnerTexts()` returns `[]` for all four locales, `nav.length` is `0`, and `expect(0).toBe(0)` passes. The test proves that four locales render the same number of navigation links, which is zero.

The author knew the shape of this trap. Nine lines earlier, the tagline test carries exactly the right guard:

```ts
expect(en, 'the English tagline did not render, so this test cannot prove anything').not.toBe('');
```

The nav test has no equivalent floor. Adding `expect(en.length).toBeGreaterThan(0)` before the loop closes it — and would have failed immediately, correctly, telling the truth that the shell has no navigation yet.

**Related, same file.** The `<nav>` is `aria-label`ed `nav.dashboard` while containing four section names, and a `<nav>` with no links is not a navigation landmark. `AGENTS.md §3.2` requires the sidebar as a `Sheet` drawer on mobile; `layout.tsx:46-51` defers it to "the first feature module" — but `FIX-11` (no shadcn) blocks the first interactive screen, so the deferral has no landing point.

### 3.4 The e2e theme test only ever proves light — **P2, NEW**

`ThemeScript` (`apps/web/src/components/theme-script.tsx:18-24`) resolves theme in three steps: stored choice → `prefers-color-scheme: dark` → light. The e2e test asserts only that the resolved value is `'light'`:

```ts
expect(atFirstPaint.theme, `/${code} has no data-theme on <html>`).toBe('light');
```

Playwright's default `colorScheme` is `light` and nothing in `playwright.config.ts` changes it, so the `prefers-color-scheme: dark` branch and the `localStorage` branch are **never executed**. `AGENTS.md §3.2.5` requires *"Light and dark themes are both required, with a one-click toggle."*

The dark tokens *are* covered — but by `ui-kit/src/index.spec.ts`, which reads **`packages/ui-kit/src/styles.css`, the source file**. A production build minifies and could rewrite the shipped bundle. `shell.spec.ts` itself makes this exact argument in its token test (*"a build-time minifier could rewrite (it turns `#ffffff` into `#fff`)"*) — and then applies it only to light, never testing dark *in the rendered document at all*. A second `test.describe` with `test.use({ colorScheme: 'dark' })` closes it.

The **toggle** itself does not exist: `theme-script.tsx` only *reads* `localStorage.getItem('eduflow-theme')`, and there is no `setItem` anywhere in the repository. `AGENTS.md §3.2.5`'s "one-click toggle" is unbuilt. This is `FIX-10`, already tracked; §3.4 is the additional fact that the e2e gate does not compensate for it.

---

## 4. Carried-forward findings, re-measured

Tracked, still open, with the measurement confirmed rather than repeated.

| ID | Finding | Re-measured 2026-09-30 |
| --- | --- | --- |
| **FIX-03** | `docker-compose.yml` is invalid YAML — line 1 is `/**`, closed by ` */` at line 14 | ✅ **confirmed**, file does not parse |
| **FIX-04** | `proxy.ts` is a Next 16 convention; Next 15 compiles **zero** middleware | ✅ **confirmed** — no `middleware.ts` |
| **FIX-05** | `format:check` fails | ✅ **confirmed, exit 2** — the only honestly red gate |
| **FIX-06** | `turbo.json` `globalDependencies` names `tsconfig.base.json`, which is at `packages/config/` | ✅ **confirmed** |
| **FIX-07** | `**/*.spec.ts` excluded from typecheck | ⚠️ **4** tsconfigs, not 5 — `apps/web` has no such exclude |
| **FIX-08** | `main.ts` silent default + two vars in `.env.example` absent from `env.ts` | ✅ **confirmed** — fallback is now `'http://localhost:3500'`, docs say `3000` |
| **FIX-11** | No `components.json`; `ui-kit` has zero components while ESLint bans 6 raw elements | ✅ **confirmed** — blocks the first interactive screen |
| **FIX-12/13** | No `.github/`, no `.husky/`, no `check-route-guards` | ✅ **confirmed** — `AGENTS.md §2.3` is prose only |
| **FIX-17** | Mojibake in `package.json` descriptions | ❌ **NOT A DEFECT — see §5** |
| **FIX-20** | `packages/config` has no `scripts` | ✅ **confirmed** — *and it is worse than S3, see §6.1* |
| **FIX-26** | Coverage tiers match 0 instrumented files | ✅ **confirmed, measured** — see below |
| **D34** | `audit_records` REVOKE + trigger | ⚠️ **still unproven** — no PostgreSQL (`ADR-019`) |

### 4.1 FIX-26, measured

```
apps/api/src/**/domain/**/*.ts      -> 0 files
apps/api/src/**/use-cases/**/*.ts  -> 0 files
apps/api/src/**/*.controller.ts     -> 0 files
```

The three globs in `apps/api/vitest.config.ts:19-29` match nothing, because those directories contain only `.gitkeep`. `apps/web/vitest.config.ts:30-34` has the same shape: `src/**/hooks/**` and `src/lib/**` — `src/lib/rtl.spec.ts` matches `src/lib/**/*.ts` but no source file does. The web coverage report confirms it: **0% statements, 0% lines, 10% functions.**

`pnpm test:coverage` is a mandatory `AGENTS.md §4` gate. It exits 0 and enforces **nothing**. The gate was *proved able to fail* on 2026-09-29 — but by a temporary probe threshold on a real file, which is a different claim from "the configured tiers bite." They do not.

This is the highest-leverage single fix in the repository: one glob correction per package, and the coverage gate becomes real for the first time.

---

## 5. Verified NOT a defect — do not "fix" these

Recording these so a future audit does not re-raise them. Each looked like a defect and was not.

| Looked like | Reality | How verified |
| --- | --- | --- |
| **FIX-17 "mojibake"** in `package.json`, `.env.example`, `.gitignore`, `docker-compose.yml`, `eslint/node.js`, `ta.json` | **Clean UTF-8 throughout.** A repo-wide scan for U+FFFD replacement characters across every `.ts/.tsx/.json/.mjs/.md/.yml/.css/.prisma/.sql` file found **zero**. The em-dashes and the Tamil/Sinhala/Arabic strings render as garbage only because the shell console is code page 850 (`ibm850`). | Byte-level read; `ta.json` is genuine Tamil, `ar.json` genuine Arabic |
| **`web-port.ts` duplicates the port in `package.json`** | **Deliberate, documented and tested.** *"npm scripts are not a module graph."* `web-port.spec.ts` holds the duplication in place — except it does not run (§3.1). The design is right; only the guard is dead. | `web-port.ts:20-26` |
| **`AGENTS.md` cites Jest; the repo uses Vitest** | **Real, correctly tracked** as `FIX-14` / `⚑A`, but a *deliberate* pending amendment blocked on owner approval — not an oversight. Editing `AGENTS.md` is `D14`-restricted. | `AGENTS.md:216`, `TODO.md:185` |
| **`docs:verify` allows missing paths** (`apps/mobile`, `directives/`, `infra/ci/`, `keys/`) | **Correct.** Those are milestone-2 or not-yet-written by decision. An allowlist is the right mechanism. One entry is now stale: `docs/modules/` exists but is empty. | `scripts/docs-verify.mjs:41-47` |
| **`schema.prisma` has no `Student`/`Class`/`Teacher`** | **Correct and deliberate** (`D33`). `PLT-203`/`PLT-801` build against abstract ports with fakes. Inventing them is `BLG-102`, rejected on the record. | `SSOT.md:141` |
| **`Money.amountMinor: bigint` has no wire format** | **Real** (`⚑G`, proposed `ADR-024`), and correctly left open rather than guessed. `schema.prisma` has no money column, so nothing forces it yet. | `SSOT.md:147`, ERD §5.5 |

---

## 6. Areas for improvement — judgement, not defects

### 6.1 The enforcement layer is itself unenforced — raise FIX-20 from S3 to **S1**

`packages/config` exports the ESLint flat configs, the Prettier config and the base `tsconfig` that **every other package depends on**. It has no `scripts` object, so `turbo run lint` and `turbo run typecheck` never visit it. Its own `eslint/` and `prettier.config.js` are never linted or format-checked as code.

The package whose stated purpose is *"the single place `AGENTS.md` rules become machine-enforced"* has no gate of its own. If `eslint/node.js` acquires a syntax error or a bad glob, every consumer breaks and no gate notices. The corpus rates this S3 because it is not user-visible. It is the load-bearing file for every rule in §2, and it should be S1.

### 6.2 The corpus is accurate about the *architecture* and drifting about the *facts*

The architectural content is strong: `ARCHITECTURE.md`, the 21 ADRs, the ERD decision record, `LEGACY_REUSE_INVENTORY.md`. The problems are all in the numbers and statuses:

| Quantity | Values in circulation | Measured |
| --- | --- | --- |
| `docs:verify` references | 147 · 155 · 179 | **188** |
| Unit tests | 51 · 63 · 67 · 78 | **103** |
| Commits | 3 · 4 · 8 | **14** |
| ADR count | 19 · 21 | **21** |
| Tracked files | 262 | **269** |
| tsconfigs excluding specs | 5 | **4** |
| EPIC-00 progress | "1 of 11" | **3 of 12** |

Six quantities, six wrong. `SSOT.md` exists to answer *"what is the current state?"* and it carries a false git state (§1.1), two conflicting rows for `pnpm test` in one table, and a `⚠️ needs correction` marker against three `AGENTS.md` edits that were already applied in `8105a27`.

**The fix is not more writing. It is a generator.** The pattern that produced ARC-01 — one source producing both the schema and the diagram, so they cannot disagree (`D33`) — is the right answer here too. A `scripts/report-status.mjs` that runs the gates and emits the `SSOT.md §1` table would make the count class of error structurally impossible, exactly as `schema-source.mjs` made schema drift impossible.

### 6.3 Identifier collision: `ARC-xx` and `OPS-01`

`REMEDIATION_PLAN_2026-09-29.md:139` uses `ARC-01` for `IClock` + id-generator. `GAP_ANALYSIS_2026-09-28.md:401` and `TODO.md:68` use `ARC-01` for the **ERD, which is complete**. `REMEDIATION_PLAN:153` uses `OPS-01` for the integration harness; `GAP_ANALYSIS:457` and `TODO.md:134` use it for `docker-compose`.

A reader following the remediation plan concludes the ERD is still to be written, and files an integration harness under a docker-compose ticket. Neither document flags the renumbering. This is the same failure class as the removed `139 / 257 / 35 / 73` figures — an **identifier collision**, not a fact error — and it needs one renumbering pass, not a rewrite.

### 6.4 `PLATFORM_CORE_PLAN.md` asserts a resolution that was retracted

`PLATFORM_CORE_PLAN.md:139` states that Gate M2 *"resolves cleanly — P14 sits after P8."* `TODO.md:179` and `CHANGELOG.md:37` both record that this was **reopened**: `SRS §24` places Gate M2 at the end of Phase 1, `P8` sits earlier in the sequence, and *"relabelling a step is not moving a gate."* The false sentence is still in the file, and the file also still says *"the test runner is missing"* and *"MinIO is not optional."* Tracked as `DOC-07`; it is the doc most likely to mislead the next session.

---

## 7. What is genuinely good — do not disturb it

The discipline here is real and should be preserved verbatim:

- **`schema-source.mjs` → `schema.prisma` + Excalidraw diagram + ERD prose, with a byte-identical regression test** (`schema-generation.spec.ts`). A hand-edit to either artefact fails the build. This is the best idea in the repository and §6.2 proposes extending it to the status report.
- **Tests that encode incidents, not just assertions.** `e2e-gate.spec.ts` documents the port-3000 foreign-application failure in 20 lines of comment and then asserts the specific flag that prevents it (`reuseExistingServer: false`), while *explicitly declining* to assert the port value so the test cannot reject its own fix. `web-port.spec.ts` does the same. `coverage-gate.spec.ts` records the exact `MISSING DEPENDENCY` state the repo was in.
- **Real ESLint rules scoped by path** for the two rules that matter most: layering (§2.2) and determinism (§2.4), with the glob-not-anchored reasoning written down.
- **A guard on the guard** — `coverage-gate.spec.ts` asserts the list of coverage-gated packages equals a specific five, so if the workspace changed such that none ran coverage, the suite could not pass vacuously. This is exactly the check missing from §3.2 and §3.3.
- **D22 → D33 is a well-argued reversal.** Deferring the ERD was right about not guessing; deferral then became the longest pole. Recording the reversal with its original reasoning intact, rather than quietly overwriting it, is the correct way to handle a decision that was defensible and still became wrong.
- **The `AGENTS.md` §6 figures were deleted, not replaced** (D28). Removing an invented number instead of substituting a different invented number is the hardest call in the corpus and it was made correctly.

---

## 8. Finding index

| ID | Title | Severity | State |
| --- | --- | --- | --- |
| **AUD-30-01** | `web-port.spec.ts` matches no `include` glob; has never run | **P0** | 🔴 open |
| **AUD-30-02** | Integration gate hollow in both declaring packages; no guard | **P1** | 🔴 open |
| **AUD-30-03** | e2e nav-parity test passes with zero nav links | **P1** | 🔴 open |
| **AUD-30-04** | e2e theme test never exercises dark; no toggle exists | **P2** | 🔴 open |
| **AUD-30-05** | `packages/config` unlinted/untyped — the enforcement layer is unguarded | **P1** | 🔴 open (re-rated from `FIX-20` S3) |
| **AUD-30-06** | `SSOT.md` git state false; 6 count classes drift | **P1** | 🔴 open |
| **AUD-30-07** | `ARC-xx` / `OPS-01` collide across two authoritative docs | **P1** | 🔴 open |
| **AUD-30-08** | `PLATFORM_CORE_PLAN.md` asserts a retracted resolution | **P2** | 🔴 open (`DOC-07`) |
| **FIX-26** | Coverage tiers match 0 files | **P1** | 🔴 open |
| **FIX-05** | `format:check` red | **P2** | 🔴 open |
| **FIX-03/04/11** | compose invalid · no middleware · no shadcn | **P1** | 🔴 open |
| **FIX-12/13** | No CI; no `check-route-guards` | **P1** | 🔴 open |
| **D34** | Audit REVOKE unproven | **P2** | 🔴 open |

**Action plan:** `docs/work/ACTION_PLAN_2026-09-30.md`
