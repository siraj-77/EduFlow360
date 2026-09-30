# ACTION PLAN v2 — Gate, Vehicle, Product

**Status:** proposed — awaiting owner approval · **in progress**
**Date:** 2026-09-30
**Progress:** `A-3` ✅ · `A-1` ✅ · `A-2` ✅ — **`EPIC-A` is 3 of 4 done** (`A-4` left). `B-1` 🟢 **DONE — all 11 primitives, 28 ui-kit tests.** **161 unit tests.** Honest gate score **7 of 9 trustworthy · 0 hollow · 2 deliberately red**.

**`B-1` finding, 2026-09-30:** `AGENTS.md` §3.2.1's raw-element ban **had never fired**. Three stacked defects — an impossible `JSXElement[name.name=…]` selector (a `JSXElement` has no `name` in ESTree), a flat-config rule-array overwrite, and `parserOptions: {}` wiping JSX. All three fixed and proven against the real CLI. **This is why the landing page shipped with no theme toggle: the author obeyed a constraint that nothing was enforcing.**
**Supersedes:** `docs/work/ACTION_PLAN_2026-09-30.md` (kept as history; it carries no status column, has zero checkboxes, and predates the last three commits)
**Execution authority for the build:** `docs/core/EduFlow_Agentic_Prompt_Pack_PlatformCore_v1.md` §5 — the P0–P14 sequence (`SSOT.md` D17). This plan does not renumber any `PLT-*` story.
**Precedence:** `AGENTS.md` + `ADR-003` > `docs/core/SSOT.md` > this file.
**Method:** every story is TDD. RED observed and recorded before GREEN. No story is closed on the strength of a config file existing.

---

## 0. What this plan is built on

Every number below was **measured on 2026-09-30**, not read from a document. The predecessor plan's central lesson was that a hand-maintained record is worse than no record, so this plan opens with its own evidence.

### 0.1 The nine gates, executed

| Gate        | Command                 | Exit  | Truthful?               | Evidence                                                                             |
| ----------- | ----------------------- | ----- | ----------------------- | ------------------------------------------------------------------------------------ |
| Typecheck   | `pnpm typecheck`        | 0     | ✅ yes                  | 8/8 tasks                                                                            |
| Lint        | `pnpm lint`             | 0     | ✅ yes                  | 8/8 tasks, 0 errors                                                                  |
| Unit tests  | `pnpm test --force`     | 0     | ✅ yes                  | **132 tests**, all executing (api 100 · i18n 10 · ui-kit 8 · shared-types 7 · web 7) |
| E2E         | `pnpm test:e2e`         | 0     | ✅ yes                  | **37 real browser tests**                                                            |
| Docs        | `pnpm docs:verify`      | 0     | ✅ yes                  | **213 references** resolving                                                         |
| Coverage    | `pnpm test:coverage`    | 0     | ❌ **hollow**           | tiers match **0** instrumented files · **`A-2` is the fix**                          |
| Integration | `pnpm test:integration` | **1** | ✅ **honest**           | was hollow; `A-1` made it fail for the right reason                                  |
| Format      | `pnpm format:check`     | **2** | 🔴 honestly red         | `FIX-05`                                                                             |
| Build       | `pnpm build`            | —     | not re-run this session | repo reports 0                                                                       |

**Honest score: 6 of 9 trustworthy · 2 hollow · 1 red.**

`SSOT.md:18` currently claims _"7 of 9 green and trustworthy; 0 hollow; 1 red"_. That does not sum, and `SSOT.md:44–45` marks two of the same gates ❌ on the page beneath it. Corrected by `C-1`.

### 0.2 The vehicle

| Area                                 | Measured                                                                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src`                       | **189 production lines** — `app.module.ts` (19) + `main.ts` (29) + `config/env.ts` (168)                                           |
| 12 module folders                    | **144 `.gitkeep`, zero** controllers, use-cases, entities, repositories, ports, adapters, DTOs. `controllers: []`, `providers: []` |
| `apps/api/prisma/migrations`         | **does not exist**                                                                                                                 |
| `apps/web/src`                       | 1,427 lines — landing page + a deliberate non-form sign-in notice. 904 of them CSS                                                 |
| `packages/ui-kit/src/components/ui/` | **empty** (`.gitkeep`). No `components.json`                                                                                       |
| `'use client'` in the repo           | **zero**                                                                                                                           |
| Theme toggle                         | **does not exist** — `theme-script.tsx` reads `localStorage`, never writes it                                                      |
| CI                                   | **none.** No `.github/`, no `.husky/`                                                                                              |
| `check-route-guards`                 | **does not exist.** `RequirePermission` → 1 hit (a comment). `RequireEntitlement` → 0                                              |
| `check-i18n`                         | **does not exist**                                                                                                                 |
| Stories shipped                      | **0 of 33**                                                                                                                        |
| Git                                  | 24 commits · 293 tracked · 147 `.gitkeep` · tree clean · in sync with `origin/main`                                                |
| Hygiene                              | **clean** — zero generated coverage HTML, `tsbuildinfo`, `.next`, `dist`, `.env.local` tracked                                     |

### 0.3 The diagnosis this plan acts on

> **The guard rails are built and the vehicle is not.**

The repository has spent three days on a measurement layer. That was correct for P0–P2 and is now the bottleneck: the 20th audit finding is almost always about a document, and each new finding spawns another register inside `SSOT.md`, which itself needs another audit. The most recent session (`e93b0f6`) was documentation-only.

**Anti-goal for this plan:** no new documentation epic may be started until `EPIC-G` ships. This is the rule that stops the loop.

---

## 1. Deviations from the predecessor plan

| Change                                         | From                                          | To                                                       | Why                                                                                                                                                                        |
| ---------------------------------------------- | --------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirements extraction off the critical path  | `EPIC-G6`, 34 pts, all 87 FRs, blocking       | `EPIC-I`, 14 pts, **Platform Core slice only**, parallel | Platform Core needs `FR-PLT-01…08`. The other 77 FRs belong to modules with no epics yet. A 37-point documentation project should not gate the first line of product code. |
| CI timeboxed                                   | `EPIC-G4` (P3), 34 pts, 9 stories             | `EPIC-E`, 18 pts, 3 stories                              | P3's human gate needs a raw `<button>` to fail CI _and_ a compliant `<Button>` to pass — impossible with zero ui-kit components. Fix shadcn first, then the minimum CI.    |
| Record repair made explicit and one-time       | `EPIC-G2`, 13 pts, "make the record accurate" | `EPIC-C`, 19 pts, "bind the record, then freeze"         | 20 internal contradictions in `SSOT.md`; 42 unmapped TODO items; a backlog whose triggers never fire. This is a one-time cost, not a standing workstream.                  |
| shadcn promoted to the top                     | `G3-1`, 9 pts, third in the critical path     | `B-1`, 8 pts, **second**                                 | It unblocks `AGENTS.md` §3.2.1 (currently unsatisfiable), the theme toggle, and P3's human gate. Nothing else unlocks three things at once.                                |
| Walking skeleton inside the pre-feature window | `EPIC-G5` (P4/P4W), 33 pts                    | `EPIC-F`, 39 pts                                         | Unchanged in position; the stories are specified here for the first time.                                                                                                  |
| Net points before first feature                | 147 (header sum)                              | **130**                                                  | 20 points of requirements extraction moved off the critical path; 16 points of record work moved parallel.                                                                 |

**Point totals in this plan are estimates and are labelled as such.** They do not replace the Jira plan's 199, which is a different scope (product only).

---

## 2. Waves and the critical path

```
W0  A-3 A-1 A-4 B-4 B-5 B-6 C-5        14 pts   the gates that lie
W1  B-1 → B-2 → B-3                    16 pts   shadcn: the highest unlock
W2  C-1 C-2 C-3 C-4 C-6 C-7   (parallel)19 pts   bind the record, then freeze
W3  E-1 E-2 E-3                        18 pts   make the gates non-advisory
W4  D-0 D-4                     (owner)  6 pts   approve ADRs; three blocking decisions
W5  D-1 D-2 D-3 D-5                    14 pts   reconcile the Jira plan
W6  F-1 F-2 F-3 F-4 F-5 F-6 F-7        39 pts   FIRST PRODUCT CODE
W7  G-6 G-2 G-3 G-4 G-5 G-7            34 pts   FIRST FEATURE SHIPPED
     EPIC-H  (P6–P14)                 ~130 pts   sequenced, not specified here
     EPIC-I  (parallel, any time)      14 pts   requirements slice
```

**Critical path:** `A-3 → A-1 → B-1 → B-2 → E-1 → E-2 → F-1 → F-2 → F-3 → F-5 → G-6 → G-2`

**Two things gated the first feature and were not engineering work — both now closed by the owner on 2026-09-30:**

1. ~~**`D-0` — approve or reject `ADR-001`…`ADR-021`.**~~ ✅ **CLOSED.** All 21 approved and marked `Accepted`. Every correction in `EPIC-D` therefore resolves to an approved ADR, so the Jira plan can be amended without putting an approved-_looking_ document in conflict with the code. **Caveats retained rather than erased:** `ADR-003` reconstructed-then-signed, the `ADR-005` `SRS` §19 conflict is recorded as a deviation, and the `ADR-020` `AGENTS.md` §3.1 amendment (`Jest` → `Vitest`) is **still outstanding** — see `TODO.md` item ⚑A.
2. ~~**`D-4.3` — `PLT-107`, first-admin bootstrap.**~~ ✅ **CLOSED — build the story**, not a seed script. A one-time, single-use, expiring, audited setup token. A seed script is cheaper and adequate for one database per school (§2.1), but it leaves the **documented** first-launch workflow (`School_Setup_Workflow_v1.md` §6.5) unimplementable, so §6.5 would need amending instead; the seed script then falls out of the story as a dev convenience. **`PLT-107` is not yet written** — see the gap list.

**And one decision that gates money, not features:**

3. ✅ **`D-4.2` — `Money` wire format: option (C)**, string on the wire plus a branded client type that cannot be built from a bare `number`. `ADR-002` exists to forbid float money, and the `number` option reintroduces it one layer up, just less visibly — `MAX_SAFE_INTEGER` caps LKR at ~90tn and KWD/BHD/JOD at ~9bn, silently losing minor units, and currency is a per-school **setting** (§2.14) so 3dp cannot be assumed away. **`ADR-024` is not yet written** — see the gap list.

---

## EPIC-A — Make the gates honest

**Goal:** no gate reports green for a reason unrelated to the application.
**Why first:** every later story's evidence is only as trustworthy as the gates that record it. Two gates currently lie and one is red.
**Exit:** all nine gates trustworthy; `format:check` green; a deliberate break in each of the two repaired gates observed RED and reverted.
**Estimate:** 13 pts

### Story A-3: A test-file oracle, so a dormant test cannot recur — ✅ **DONE 2026-09-30**

- **As a** developer **I want to** every `*.spec.ts` asserted as matched by its own package's runner `include` globs **so that** a test file outside the globs can never again look correct in review while never executing.
- **Closes:** `AUD-30-01` class (P0, recurrence). The instance was closed by `G1-1`; the class was not.
- **Why P0:** `apps/web/web-port.spec.ts` matched neither `src/**` nor `tests/**` and **had never executed**. Vitest applies `include` as a filter even to explicit arguments, so naming it on the command line found nothing. It guards the one accepted duplication of the port number — the duplication that exists because on 2026-09-29 a foreign application on port 3000 answered Playwright's readiness probe and all 11 e2e tests ran against it.
- **Tasks:**
  - [x] Walk every package with a test script; for each, resolve its Vitest `include` globs
  - [x] Assert every `*.spec.ts` on disk is matched by its package's globs; report the unmatched path
  - [x] Assert no spec file is 0 bytes
  - [x] Generalise the guard-on-the-guard pattern already proven in `coverage-gate.spec.ts`
- **Acceptance Criteria:**
  - Given a spec file created outside the package's `include` globs, when `pnpm test` runs, then it fails with the unmatched path named, and the failure is not a pass
  - Given the file moved inside the globs, then the suite is green and the new file's tests appear in the count
  - Given any spec file of 0 bytes, then the suite fails naming it
- **Story Points:** 3 · **Priority:** P0 · **Labels:** `test`, `tooling`
- **Note:** this is the task the predecessor plan named as the single next action (`TODO.md:28`, `WORKLOG.md:1714`).

### Story A-1: The integration gate cannot pass while it runs nothing — ✅ **DONE 2026-09-30**

- **As a** developer **I want to** `pnpm test:integration` to be incapable of exiting 0 without running a test **so that** it stops reporting a green that means nothing.
- **Closes:** `AUD-30-02` (P1).
- **Measured today:** `apps/web/package.json:15` is literally `test:integration: "echo \"no web integration suite at P2\" && exit 0"`. `apps/api/vitest.integration.config.ts:15` is `passWithNoTests: true` with `include: ['src/**/*.integration.spec.ts']` and **zero** matching files. The helper that detects this exact shape, `isPassingStub()` at `e2e-gate.spec.ts:49`, currently covers `test:e2e` only.
- **Tasks:**
  - [x] Extend `isPassingStub()` to cover `test:integration` in every declaring package
  - [x] Delete the `echo … && exit 0` stub from `apps/web/package.json`
  - [x] Set `passWithNoTests: false` in `vitest.integration.config.ts`
  - [x] Decide the honest end-state: the gate stays red until `F-7` supplies the first real integration test
- **Acceptance Criteria:**
  - Given the current tree, when `pnpm test:integration` runs, then it exits **non-zero** with a message naming the package and the reason, and the message distinguishes "no test files" from "tests failed"
  - Given a `test:integration` script matching `isPassingStub()`'s shape, then the guard test fails
  - Given `F-7` lands a real integration test, then the gate exits 0
- **Story Points:** 3 · **Priority:** P0 · **Labels:** `test`, `tooling`
- **Deliberate choice:** this gate is left **red** for the duration. A red gate is honest; a green one is a lie. `F-7` turns it green.

### Story A-2: The coverage tiers must match a real file — ✅ **DONE 2026-09-30** (moved to `scripts/check-coverage-tiers.mjs`; `pnpm test` stays green by design)

- **As a** developer **I want to** a configured coverage tier that matches zero files to fail loudly **so that** the mandatory `AGENTS.md` §4 gate stops being a no-op.
- **Closes:** `FIX-26` (P1, re-rated from S3).
- **Measured today:** `apps/api/vitest.config.ts:15-27` configures `src/**/domain/**/*.ts` 90/85, `src/**/use-cases/**/*.ts` 90/85, `src/**/*.controller.ts` 70 — and **0 files match any of them**, because all 12 module folders are `.gitkeep`. I verified the glob count directly. The gate was _proved able to fail_ on 2026-09-29, but by a temporary probe threshold on a real file — a different claim from "the configured tiers bite."
- **Tasks:**
  - [x] Add a check that fails when any configured threshold glob matches 0 files, naming the glob
  - [x] Re-measure the web tier (`src/lib/**` is live; `src/**/hooks/**` matches 0)
  - [x] Record in `TDD_EVIDENCE_GATES.md` that the real fix is `EPIC-F` creating the first `domain/` file
- **Acceptance Criteria:**
  - Given the current tree, when `pnpm test:coverage` runs, then it exits non-zero naming `src/**/domain/**/*.ts` as matching 0 files
  - Given one file created under `apps/api/src/modules/health/domain/`, then that tier reports a percentage and its threshold applies
  - Given a tier dropped below its threshold, then the gate exits non-zero naming the tier and the actual value
- **Story Points:** 5 · **Priority:** P0 · **Labels:** `test`, `tooling`
- **Depends on:** `A-3` (so the class cannot recur silently)

### Story A-4: `format:check` back to green

- **As a** developer **I want to** no permanently red gate **so that** a red result keeps meaning something.
- **Closes:** `FIX-05` (the only red `AGENTS.md` §4 gate). Measured exit **2**.
- **The decision, which must be made rather than deferred:** the glob is `**/*.{ts,tsx,js,mjs,cjs,json,md,yml,yaml}` — it covers all of `docs/` **and `AGENTS.md` itself**. Formatting 60+ markdown files including the governing contract produces a large diff that makes every future documentation review noisy.
- **Recommendation:** format all source, and narrow the glob to source + config, excluding `docs/` and `AGENTS.md`. Record the exclusion in the script so it is visible rather than hidden in a glob.
- **Tasks:**
  - [ ] Run `pnpm format` over source and config
  - [ ] Narrow the `format:check` glob; state the exclusion inline
  - [ ] Add a separate `format:check:docs` for optional use, not wired into the mandatory gate
- **Acceptance Criteria:**
  - Given a clean tree, when `pnpm format:check` runs, then it exits 0
  - Given a deliberately misformatted `.ts` file, then it exits non-zero naming the file
  - Given `AGENTS.md` is hand-formatted, then the mandatory gate does not flag it
- **Story Points:** 2 · **Priority:** P1 · **Labels:** `tooling`

---

## EPIC-B — Unblock every screen that has a button

**Goal:** make `AGENTS.md` §3.2.1 satisfiable, and deliver the one-click theme toggle §3.2.5 requires.
**Why second:** the rule and the ban are already live and firing. That is why the landing page had to be built from links only and shipped with **no theme toggle** — recorded verbatim at `WORKLOG.md:230`.
**Exit:** a `<Button>` renders and passes lint; a raw `<button>` still fails; the toggle works in all four locales; route states exist.
**Estimate:** 21 pts

### Story B-1: Initialise shadcn/ui into `packages/ui-kit` — 🟢 **DONE 2026-09-30**

- **As a** developer **I want to** the shadcn primitives `AGENTS.md` §3.2.1 mandates **so that** the rule stops being a prohibition with nothing behind it.
- **Closes:** `FIX-11` (S1). This is the single highest-unlock item in the repository.
- **Measured before:** no `components.json` anywhere; `packages/ui-kit/src/components/ui/` contained only `.gitkeep`; `git grep "@eduflow/ui-kit" -- apps/web/src` returned two hits, both CSS `@import`. **Zero component imports.** §3.2.1 was unsatisfiable.
- **✅ DONE — gate half, then the primitives.** While making §3.2.1 satisfiable I found the rule that was supposed to make it satisfiable **had never fired**. Three stacked defects, all fixed, proven against the real CLI, covered by the first suite to ever execute the `next` config (`apps/web/src/config/ui-primitive-rules.spec.ts`, 9 cases). The exemption is scoped to `components/ui/**` under two globs — the config is shared between two cwds — and the colour ban is **re-declared inside** that exemption, not switched off.
- **✅ All 11 required primitives exist**, token-bound, TDD'd: `button` `input` `label` `card` `select` `dialog` `table` `sheet` `dropdown-menu` `skeleton` `sonner` (plus `badge` and a local `icons` module). `select`, `dropdown-menu` and `sonner` were added in a **second RED→GREEN** after the first tranche went green, because the plan's own list is the acceptance criterion and eight of eleven is not done.
- **Two decisions taken inside this story, both recorded where they are enforced:**
  - **`--on-brand` / `--on-danger` / `--on-accent` added to `styles.css`.** A button needs readable text on `--brand`; the only alternative was `text-white`, which is a hard-coded colour in spirit and **invisible to the hex-literal rule** because it is not written as `#rrggbb`. The ten §3.2.5 colours are unchanged — this adds the foreground half so the palette grows _pairs_. `UI_KIT_TOKENS` was deliberately **not** extended, because `index.spec.ts` asserts against the §3.2.5 list.
  - **No `lucide-react`.** It is declared nowhere in this workspace, and §3.2.6 requires directional icons to mirror under RTL — so the mirror has to be provable and testable, not inherited from a package whose default is LTR-only. Two inline 24×24 paths in `icons.tsx` beat a runtime dependency and a second place for the RTL decision to be wrong.

**Why this was worth 8 points:** it unblocks (1) §3.2.1, (2) the theme toggle → `AUD-30-04`, **the last hollow gate**, (3) Prompt Pack P3's human gate, which requires a raw `<button>` to fail CI _and_ a compliant `<Button>` to pass. Point 3 was **impossible** before this.

- **Tasks:**
  - [x] Add `components.json` at the repo root
  - [x] Add the primitives the token set already supports: `button` `input` `label` `card` `select` `dialog` `table` `sheet` `dropdown-menu` `skeleton` `sonner`
  - [x] Map every component to the **existing** `--*` tokens via Tailwind v4 `@theme inline`; do not introduce a second token source
  - [x] Ship the accessibility defaults §3.2.2 requires: `--touch-target-min` on every interactive primitive
  - [x] Verify RTL: every primitive uses logical properties, and directional icons mirror
- **Acceptance Criteria:**
  - [x] Given a component rendering `<Button>`, when `pnpm lint` runs, then it exits 0 — **verified**, `lint` 0
  - [x] Given a component rendering a raw `<button>`, then `pnpm lint` exits non-zero naming the rule — **the ban survived the addition**; `ui-primitive-rules.spec.ts` still passes
  - [x] Given `prefers-reduced-motion: reduce`, then a `Button` with a transition has none running — **handled globally** in `styles.css`; the primitive defers to it rather than duplicating the query
  - [x] Given `html dir="rtl"`, then a `Sheet` slides from the inline-end edge, not the right edge — `SheetContent` uses `inset-inline` via `start-0`/`end-0`; asserted by the physical-property sweep
  - [x] Given a hex literal is added to a component, then `pnpm lint` exits non-zero — asserted against all 11 component files
- **Story Points:** 8 · **Priority:** P0 · **Labels:** `web`, `design-system`
- **Risk cleared:** shadcn's default theme was **not** used. `components.json` sets `cssVariables` against the existing token file and no component imports a shadcn colour scale; the "second token source" outcome did not occur. **Verified by test, not by reading** — the sweep asserts no component class carries `#`, `rgb(` or `hsl(`.
- **Not done here, deliberately:** the primitives are exported from the package barrel but **no feature page consumes them yet.** B-2 (theme toggle) and P3 are the consumers.

### Story B-2: Theme toggle, and the dark path it unlocks

- **As a** user **I want to** a one-click light/dark toggle **so that** I can choose the theme rather than only receiving the OS default.
- **Closes:** `FIX-10`, `AUD-30-04` (P2).
- **Measured today:** `AGENTS.md` §3.2.5 requires "a one-click toggle." `theme-script.tsx` has `getItem` and reads `prefers-color-scheme`, and has **no `setItem` anywhere** — there is no toggle on any screen. Consequently the e2e theme test only ever asserts `light`; Playwright's default `colorScheme` is `light`, so the `prefers-color-scheme: dark` branch and the `localStorage` branch are **never executed**.
- **Tasks:**
  - [ ] Add the toggle as a shadcn `Button` (depends on `B-1`)
  - [ ] `data-theme` set on `<html>` before first paint, honouring a saved choice then `prefers-color-scheme`
  - [ ] e2e: the toggle flips `data-theme`, the choice survives reload, and the dark token set resolves on the **rendered** document via `getComputedStyle`
  - [ ] Verify all ten `AGENTS.md` §3.2.5 tokens differ between light and dark
- **Acceptance Criteria:**
  - Given `colorScheme: 'dark'` and no saved choice, when the page loads, then `document.documentElement.dataset.theme === 'dark'` and all ten tokens resolve to their dark values
  - Given a saved `light` choice with the OS set to dark, then the page renders light
  - Given the toggle is activated, then `localStorage` is written and a reload preserves it
  - Given the toggle is absent, then the test **fails** — an assertion over zero toggles must not pass
- **Story Points:** 5 · **Priority:** P0 · **Labels:** `web`, `accessibility`
- **Closes the vacuous-test class:** the previous fix for `AUD-30-03` added a floor assertion to a _different_ test; the specific nav-parity loop the audit named still has none. Any toggle test must assert the control exists before asserting its behaviour.

### Story B-3: Route states — `loading.tsx`, `error.tsx`, `not-found.tsx`

- **As a** user **I want to** a loading, error and not-found state on every route **so that** no navigation lands on a blank page.
- **Tasks:** [ ] `loading.tsx` per §3.2.4 with `<Skeleton>` · [ ] `error.tsx` · [ ] `not-found.tsx` · [ ] all four locales
- **Acceptance Criteria:**
  - Given any route under `[locale]`, when it is requested, then a `loading.tsx` exists for it
  - Given a 404, when rendered, then `not-found.tsx` renders with a translated message in the active locale
- **Story Points:** 3 · **Priority:** P1 · **Labels:** `web`
- **Note:** `AGENTS.md` §3.2.4 also requires `<Skeleton>` for async data and `disabled` + spinner on submit. Neither pattern exists yet because there is no interactive screen.

### Story B-4: `docker-compose.yml` parses

- **As a** developer **I want to** the `AGENTS.md` §14 command to run **so that** I can bring up Postgres and Redis.
- **Closes:** `FIX-03` (S1). Line 1 of `infra/docker/docker-compose.yml` is a `/** */` JS block comment in a YAML file. Two images are unpinned. No MinIO bucket bootstrap.
- **Tasks:** [ ] Remove the block comment · [ ] Pin both images by digest · [ ] Add MinIO bucket bootstrap · [ ] Document the Docker-optional third state (`ADR-019`)
- **Acceptance Criteria:**
  - Given the file as committed, when `docker compose -f infra/docker/docker-compose.yml config` runs, then it exits 0 and prints four services
  - Given an image reference, then it is pinned, not `:latest`
- **Story Points:** 2 · **Priority:** P1 · **Labels:** `infra`
- **Blocked for the owner:** no PostgreSQL is available in this environment. `D-34` (proving the audit REVOKE) and `F-3` (migrations) both need it. See §5.

### Story B-5: No silent defaults in `main.ts`

- **As a** developer **I want to** start-up to fail fast naming the missing variable **so that** a missing setting is never papered over with a default that happens to be right on my machine.
- **Closes:** `FIX-08`, `D32`. `main.ts:23` reads `process.env.WEB_ORIGIN ?? 'http://localhost:3500'`. `WEB_ORIGIN` and `NEXT_PUBLIC_API_URL` are in `.env.example` but **not** in the Zod schema.
- **Tasks:** [ ] Add both to `env.ts` · [ ] Delete the `??` · [ ] Keep `ADR-019`'s three-state `DATABASE_URL` (that one _satisfies_ §11; the `??` does not)
- **Acceptance Criteria:**
  - Given `WEB_ORIGIN` unset, when the app boots, then it throws naming `WEB_ORIGIN` and does not listen
  - Given `.env.example` as committed, when every variable is read, then each is either in the schema or explicitly marked not-read-by-the-api
- **Story Points:** 2 · **Priority:** P1 · **Labels:** `api`, `config`

### Story B-6: Delete `src/modules/modules/`

- **As a** developer **I want to** 12 real module folders **so that** the module registry does not contain a directory that is not a module.
- **Closes:** `FIX-09`. A 13th directory named `modules` sits alongside the 12 real ones, holding 12 `.gitkeep` files.
- **Acceptance Criteria:** Given the tree, when module folders are listed, then exactly 12 exist and none is named `modules`
- **Story Points:** 1 · **Priority:** P2 · **Labels:** `api`, `housekeeping`

---

## EPIC-C — Bind the record, once, then freeze

**Goal:** stop the documentation layer from consuming the project. **This is a one-time cost, not a standing workstream.**
**Why:** 20 internal contradictions in `SSOT.md`; six quantity classes simultaneously wrong; 42 open `TODO.md` items with no plan pointer; a backlog whose triggers are scoped too narrowly to ever fire; a worklog whose two newest entries sit below its own footer.
**Exit:** the count-drift class is structurally impossible; every open item has an owner; three tracking documents stop growing.
**Estimate:** 19 pts · **Runs parallel to `EPIC-A` and `EPIC-B`.**

### Story C-1: `scripts/report-status.mjs` — generate §1, never hand-write it

- **As a** developer **I want to** the state-of-record table generated by running the gates **so that** it cannot be wrong.
- **Closes:** `AUD-30-06` (P1), `D38`, `G2-2`.
- **The decision already made and never executed:** `SSOT.md:28` states _"This table is hand-maintained and has now been wrong twice. `G2-2` replaces it with `scripts/report-status.mjs`, which runs the gates and emits this section."_ `scripts/` contains only `docs-verify.mjs`.
- **Evidence of the class:** six quantity classes were wrong simultaneously in one revision — `docs:verify` refs (147/155/179/188/207/209 all appear), unit tests (51/63/67/78/103/106/110), commits (3/4/8/14/23/24), tracked files (262/269/293), ADRs (18/19/21), tsconfigs excluding specs (4/5). The commit that recorded the correction was titled _"stop hand-maintaining the numbers"_ — and did not install the generator.
- **Tasks:**
  - [ ] Run the nine gates; emit the `§1a` table with the `Truthful?` column
  - [ ] Compute commit count, tracked-file count, `.gitkeep` count, unit-test count and `docs:verify` reference count from the repository — never from a literal
  - [ ] Emit a diff against the committed `SSOT.md` §1 and exit non-zero on any difference
  - [ ] Wire into `docs:verify` so a drifting count fails the existing gate
- **Acceptance Criteria:**
  - Given a clean tree, when `node scripts/report-status.mjs` runs, then the diff against `SSOT.md` §1 is empty
  - Given `SSOT.md` §1 edited to say `999 commits`, when the script runs, then it exits non-zero naming the line
  - Given any of the nine gates exits non-zero, then the emitted table shows it and the script exits non-zero
- **Story Points:** 5 · **Priority:** P0 · **Labels:** `tooling`, `docs`
- **This is the single highest-value story in `EPIC-C`.** It converts a recurring class of defect into an impossible one.

### Story C-2: Resolve the 20 internal contradictions in `SSOT.md` — by shrinking it, not patching it

- **As a** developer **I want to** one document that answers "what is the current state?" **so that** I do not have to reconcile two sections before acting.
- **Measured:** `SSOT.md` is 93,602 bytes / 412 lines. §1 + §1a + §1b — the part that is genuinely a state record — is **12.4%** of it. §4 (decisions of record) is **36.2%** and duplicates `CHANGELOG.md`. §3 (what does not exist) is 9.4% and is two revisions stale: it claims 7 web source files (there are 24), 38 i18n keys (there are 63 leaf keys), 262 tracked files (there are 293), and 155 `docs:verify` references (there are 207+). §7 open questions duplicate `TODO.md`.
- **Recommendation — shrink, do not rewrite:**
  - **Keep** §1, §1a, §1b (12.4%) — with §1 generated by `C-1`
  - **Keep** §8 "The Most Important Facts" and the footgun register — genuinely useful, nothing else holds it
  - **Move** §4 decisions → `CHANGELOG.md` (it is a chronological register; `D27`–`D32` already sit out of numeric order because entries were appended by date into a non-chronological scheme)
  - **Delete** §3 — a dated inventory that will be wrong again within one commit
  - **Move** §7 open questions → `TODO.md` §"Decisions Needed From The Owner"
  - **Target:** 93 KB → ~20 KB
- **Specific contradictions this must resolve:**
  | #    | Subject                | Statement A                                                      | Statement B                                                                                 |
  | ---- | ---------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
  | C-1  | Gate score             | `§1:18` "7 of 9, 0 hollow, 1 red" (sums to 8)                    | `§1a:44-46` two rows ❌ `no`; `CHANGELOG:34` "5 of 9, 2 hollow"                             |
  | C-2  | Git state              | `§1:16` "23 commits, clean, all pushed"                          | `§5.1:279` "14 commits, NOT clean"; `§8:379` "14 commits, 15 modified, 12 untracked"        |
  | C-3  | ERD commit state       | `§1:20` "now committed"                                          | `§5.1:282,289,290` "uncommitted"; `§8:382` "is uncommitted"                                 |
  | C-4  | `docs:verify` count    | `§1a:42` 207                                                     | `§3:143` 155 (called _wrong_ by §1a)                                                        |
  | C-5  | Tracked files          | `§1:14` 293                                                      | `§3:145` 262; `§8:383` 269                                                                  |
  | C-6  | Unit tests             | `§1:14,40` 110                                                   | `§5.1:280` 103                                                                              |
  | C-7  | `AUD-30-03`            | `§1b:68` "Closed by G1-4"                                        | `§5.1:303` "🔴 Open → G1-4"                                                                 |
  | C-8  | ⚑3 asks                | `§4` D8/D9/D10 "retired"                                         | `§7:357` listed as an open question                                                         |
  | C-11 | `D24` identity         | `§4:201` D24 = toolchain                                         | `§5.1:274` "(D24)" for the credential; `§5.1:278` "(D16)"; `CHANGELOG:238` D24 = credential |
  | C-12 | Dangling ref           | `§5.1:279` "see §1.1"                                            | no `§1.1` exists in SSOT; the section is `§1a`                                              |
  | C-15 | Footgun table          | `§8:395` presents `AUD-30-01` as an open P0 in the present tense | `§1b:66` and `§8:377` record it closed 2026-09-30                                           |
  | C-17 | `AGENTS.md` line cites | `§7:364` "`:8,17`"                                               | actual `:6,:16`. `§1b:100` "`:81,498`" — second occurrence is `:508`                        |
- **Acceptance Criteria:**
  - Given `SSOT.md`, when it is read end to end, then no two sections state different facts about the same subject
  - Given `git rev-list --count HEAD`, then the number in `§1` is generated, not typed
  - Given `SSOT.md` is under 25 KB, then the state-of-record questions are all answerable from it
- **Story Points:** 5 · **Priority:** P1 · **Labels:** `docs`
- **Depends on:** `C-1` (generate before shrinking, so the surviving table cannot drift)

### Story C-3: Every open `TODO.md` item gets a plan pointer or a named owner

- **As a** developer **I want to** know whether an unchecked box is work I will do **so that** I can tell a deferred item from an abandoned one.
- **Measured:** **42 of the 80 open items have no `→ Gx-y` pointer.** Every other open item is mapped into the action plan. The unmapped set includes `FIX-25` (rated S1, given a story and a 1-point budget in `REMEDIATION_PLAN_2026-09-29.md:71`, then silently dropped between two plan generations), `OPS-07` (restore drill), all seven `REQ-*` items, the ERD sign-off, and the seven `PC-000`…`PC-006` deferrals.
- **Tasks:**
  - [ ] For each of the 42: add a `→ <epic>-<story>` pointer, or `deferred — owner: <name>, target: <milestone>`, or delete it
  - [ ] Restore `FIX-25` to a plan or record why it is dropped
  - [ ] Fix the two items whose text says DONE but whose box is unticked (`G1-4`, `G2-5`) — `TODO.md:4` defines "the topmost unchecked item" as _the_ next task, so the mechanism currently points correctly only by luck of ordering
- **Acceptance Criteria:**
  - Given `TODO.md`, when every `- [ ]` line is extracted, then each carries either a plan pointer or an explicit deferral with an owner and a target
  - Given the file, when a line says `DONE`, then its box is ticked
- **Story Points:** 3 · **Priority:** P0 · **Labels:** `docs`

### Story C-4: Rewrite `BACKLOG.md` triggers as states of the world

- **As a** developer **I want to** a backlog whose triggers can actually fire **so that** deferred work surfaces when its condition is met.
- **Measured:** `BACKLOG.md` is `Last updated: 2026-09-28` — untouched through the two busiest days. Its 13 rejected items are the most valuable content in the file (`BLG-090` _"the single most likely wrong turn in this project"_).
- **The trigger that should have fired and did not.** `BLG-002` reads: _"Auto-generate `AGENTS.md` §7's story count and point total from the Jira document, so §7 cannot drift"_ · **Trigger:** _"`§7` and the Jira doc disagree"_. The count never disagreed — 33/199 is correct in all four documents. But the identical class of drift happened **six times over inside `SSOT.md`**, and the generalised fix is already recorded as `D38`/`C-1`. The trigger was scoped to one document and one number. **A backlog whose triggers are that narrow is decoration.**
- **Tasks:**
  - [ ] Rewrite every trigger as a _state_, not a symptom. `BLG-002` becomes _"any count hand-written into a governing document"_ — the version that would have fired six times
  - [ ] Update the deferred-from-33 section: it mirrors `ADR-005`'s list, which omits the mobile tasks on `PLT-101` and `PLT-103`
  - [ ] Add the multi-role question (`ERD` Q1) to the owner-decision register — it is referenced in three documents and **owned in none**
- **Acceptance Criteria:**
  - Given any backlog row, then its trigger names a state of the repository, not a symptom in one file
  - Given `ADR-005`'s deferral list, then the backlog's mirrors it exactly, including the two mobile tasks it omits
- **Story Points:** 2 · **Priority:** P1 · **Labels:** `docs`

### Story C-5: Restore the `WORKLOG.md` ordering convention

- **As a** developer **I want to** the newest entry at the top **so that** following the stated convention does not hide the last two commits.
- **Measured:** line 5 declares `**Convention:** Newest first`. Line 1518 re-declares it as a footer. Then the two most recent commits — `0159ce9` (00:52) and `e93b0f6` (01:03) — were **appended below that footer**, at lines 1520 and 1647. Three declarations, one violation.
- **Tasks:**
  - [ ] Move both entries above line 11 · [ ] Delete the duplicate footer at 1518 · [ ] Add entry-length guidance to the template (170 KB / 16 entries = 10.6 KB per entry; the newest is 117 lines for one UI session)
- **Acceptance Criteria:**
  - Given the file, when entry headings are listed in line order, then their dates are non-increasing
  - Given any entry, then exactly one `Next Steps` or `Still open` section exists
- **Story Points:** 1 · **Priority:** P1 · **Labels:** `docs`
- **Two `AGENTS.md` §9 deviations to record, both already disclosed in the log:** six of twelve commits have no entry of their own (each RED reproducer is documented only inside the following fix commit), and the `ARC-01` entry states _"WORKLOG.md was not touched by the ARC-01 run itself — another agent was mid-edit on shared docs."_

### Story C-6: Enforce `CHANGELOG.md`'s own scope rule

- **As a** developer **I want to** a changelog that describes the product **so that** I can tell what shipped by reading it.
- **Measured:** line 4 states `**Scope:** User-visible change to the _product_. Documentation-only changes ... are recorded in WORKLOG.md, not here.` Then `[Unreleased]` is ~90 lines of audit findings, six quantity corrections, and _"Fixed — four suspected defects that are not defects."_ Not one line describes a user-visible change. The changelog has **never** contained a product entry, and is now a second audit log competing with `CODE_AUDIT_2026-09-30.md`, which covers the same ground in more detail.
- **The `[0.1.0-scaffold]` entry is a retraction wearing a version heading:** it carries `> ⚠️ **Partly inaccurate**` and six ❗ markers — ❗ shadcn not initialised, ❗ the compose file does not parse, ❗ no locale negotiation, ❗ the dictionary was never the template's, ❗ `AGENTS.md` was not modified, ❗ `env.ts` omissions. A reader scanning version headings sees a clean release. Its gate table (lines 157–164) still reports **6 gates, 51 tests, 147 references** — all superseded.
- **Tasks:**
  - [ ] Move the audit narrative to `CODE_AUDIT_2026-09-30.md`; keep the changelog for product changes
  - [ ] Re-title `[0.1.0-scaffold]` to `[0.0.1-infrastructure]`, or split the six ❗ items into a `Known issues` block
  - [ ] Delete the superseded gate table
  - [ ] Fix the `D24`/`D16` collision: `CHANGELOG:238` attributes the accepted-risk credential to `D24`; `D24` is the toolchain decision
- **Acceptance Criteria:**
  - Given any entry, then every item in it describes a change observable in the running product
  - Given the accepted-risk credential, then exactly one decision ID names it, and it is the same ID `SSOT.md` uses
- **Story Points:** 3 · **Priority:** P1 · **Labels:** `docs`

### Story C-7: Mark the predecessor plan superseded

- **As a** developer **I want to** one action plan **so that** I do not read requirements out of a superseded file.
- **Tasks:** [ ] Add a supersession banner to `ACTION_PLAN_2026-09-30.md` pointing here · [ ] Record that it has no status column, zero checkboxes, and predates the last three commits
- **Acceptance Criteria:** Given either plan, then the older one names the newer one in its first ten lines
- **Story Points:** 1 · **Priority:** P2 · **Labels:** `docs`

---

## EPIC-D — Reconcile the Jira plan against the ADRs and the ERD

**Goal:** make the 33-story plan safe to execute. It has not been touched since **2026-09-27** — before the repository existed.
**Why it matters:** `git log --follow` on `docs/core/EduFlow_Jira_Epics_PlatformCore_RBAC_v1.md` returns exactly **one** commit. Three days of work produced 21 ADRs, a 14-model schema and an ERD. The plan that describes the actual product work is now the most stale document in the repository.
**Measured state:** the arithmetic is sound — **9 epics, 33 stories, 199 points**, every epic subtotal reconciling, no duplicate or missing story ID, the cross-epic dependency graph and critical path still correct. All 9 epic Goals, all 33 story statements, and 12 of 14 entity tasks survive intact. **But 22 of 33 stories carry at least one open text-level defect, blocking question, or mandatory order change. 11 of 33 are clean.**
**Estimate:** 20 pts · **Gated on `D-0`.**

### Story D-0: Approve or reject `ADR-001`…`ADR-021` — GATE

- **As a** the owner **I want to** accept or reject each ADR **so that** the corrections in `EPIC-D` have a binding baseline.
- **This is the root blocker for the entire epic.** `docs/adr/README.md:67`: _"**No ADR is `Accepted`.** Nothing in this directory has been signed off."_ Every resolution in `D-1`…`D-5` lives in an unapproved ADR. Amending the Jira plan now would put an **approved-looking** document in conflict with the actual code — which is precisely the failure `CODE_AUDIT_2026-09-30.md` exists to correct.
- Corroborating: `ARCHITECTURE.md:307` — _"A rule that is not mechanically enforced is a suggestion."_ Nothing in `docs/adr/` is enforced, because there is no CI until `EPIC-E`.
- **Tasks:**
  - [ ] Review each ADR; mark `Accepted` or `Rejected`
  - [ ] `ADR-003` is marked **reconstructed, pending sign-off** and governs the whole project — sign it first
  - [ ] `ADR-005` is marked **conflicts with `SRS` §19** — resolve or record the deviation
  - [ ] `ADR-020`'s `AGENTS.md` §3.1 amendment is **blocked**; `ADR-024` (Money wire format) is **undecided**
- **Acceptance Criteria:**
  - Given `docs/adr/README.md`, then every ADR carries `Accepted` or `Rejected`, and zero are `Proposed`
  - Given `AGENTS.md` §3.1, then it names the runner the repository actually ships
- **Story Points:** 3 · **Priority:** P0 · **Labels:** `governance` · **Owner time, not engineering time**

### Story D-1: Correct the four contradictions where the Jira text is now wrong

- **As a** developer **I want to** the plan to not contradict an accepted ADR **so that** I do not build the wrong thing from a correct-looking document.
- **Tasks and evidence:**

  | #   | Story                     | Jira text                                                                                                        | Contradicted by                                                                                                                                                                                      | Consequence if built as written                                                                                                                                                                                                                                                                                                                                                                           |
  | --- | ------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | 1   | `PLT-402` (line 256)      | _"writes the audit record **asynchronously (non-blocking, via queue) after the action completes successfully**"_ | `ADR-013` — which names this line **four times** and states _"The Jira text predates this reasoning and is superseded here."_                                                                        | Highest severity in the plan. A queued audit row is lost when the queue is unavailable, leaving a committed financial or disciplinary action with no trace. _"The failure is silent, and it surfaces months later during an audit, when it is no longer fixable."_ Also inverts the ordering: _"after the action completes successfully" means the action is committed before the record is even queued._ |
  | 2   | `PLT-202` AC 1 (line 137) | _"**Any controller route missing an explicit permission decorator** fails a CI static-check"_                    | `ADR-018` — the check accepts `@RequirePermission` **or** `@Public('<reason>')` and rejects everything else                                                                                          | **Literally unsatisfiable.** Six routes legitimately carry no permission: `/health/liveness`, `/health/readiness`, `POST /license/activate`, `POST /auth/login`, `POST /auth/otp/request`, `/auth/password-reset/request`. Implement as written and **CI fails on the login route.** The plan has zero occurrences of the word "public" in a routing sense.                                               |
  | 3   | `PLT-303` (line 209)      | _"calls the Activation Server with serial key + hardware footprint (**school_id, server MAC hash**)"_            | `ADR-010` (server is external, behind `ILicenceActivationClient`) + `ADR-011` (_"❌ MAC address hash (as `PLT-303` currently says). Rejected: unstable across container restarts and VM migration"_) | A developer writes a use-case making an HTTP call to an undefined service — violating `AGENTS.md` §2.2 — against an identifier that breaks on a routine container restart. `PLT-304` (line 218) has the same defect in softer form.                                                                                                                                                                       |
  | 4   | `PLT-201` (line 119)      | _"`Role` entity (id, name, is_system_role: boolean, **school_id nullable for system roles**)"_                   | `ADR-003` (one database is one school) + the ERD's own flagged deviation                                                                                                                             | A nullable column inside a unique constraint **does not constrain**. The ERD flagged this and deviated to `NOT NULL` + `isSystemRole`; the governing document was never corrected.                                                                                                                                                                                                                        |

- **Acceptance Criteria:**
  - Given the amended plan, when each of the four stories is read, then no sentence contradicts an `Accepted` ADR
  - Given `PLT-202`'s AC, then it accepts either decorator and names the six `@Public` routes
  - Given `PLT-303`, then it names `ILicenceActivationClient` and a local fake, and contains no MAC reference
- **Story Points:** 5 · **Priority:** P0 · **Labels:** `planning`, `governance`
- **Depends on:** `D-0`

### Story D-2: Apply the four technical supersessions

- **As a** developer **I want to** the plan to name the technology that was chosen **so that** I do not re-open a settled decision mid-story.
- **Tasks:**

  | Story                                     | Current text                                                                     | Replace with                                                                                                                                                                                         | Source           |
  | ----------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
  | `PLT-101` (line 40)                       | _"Implement password hashing (**bcrypt/argon2**) with configurable cost factor"_ | `argon2id` behind `IPasswordHasher`, verify-and-rehash, timing-safe compare. Note `ADR-007:38` carves out: rehash-on-login rewrites the stored hash, so `PLT-401`'s immutability rule does not apply | `ADR-007`        |
  | `PLT-301` / `:303` / `:304`               | _"signature verification (**RSA-2048/ECDSA**)"_; payload list omits two fields   | `ECDSA P-256 + SHA-256 over a canonical deterministic serialisation`. Add **`keyId`** and **`canonicalizationVersion`** — both part of the signed material, both already in the schema               | `ADR-009`        |
  | `PLT-101` (line 44) / `PLT-103` (line 70) | mobile login-screen and remote-session tasks                                     | move to milestone 2. `ADR-005`'s deferral list names `PLT-104`, `PLT-106` and the push half of `PLT-702` — **it omits these two**                                                                    | `ADR-005` + `D5` |
  | `PLT-702` AC (line 370)                   | _"A test event delivered via **both channels**"_                                 | email only in milestone 1. Push is milestone 2, so this AC **cannot pass** in M1                                                                                                                     | `ADR-005`        |

- **Acceptance Criteria:**
  - Given `PLT-101`, then it names `argon2id` and `IPasswordHasher`, and contains no `bcrypt`
  - Given `PLT-301`, then its payload list includes `keyId` and `canonicalizationVersion`
  - Given `PLT-702`'s AC, then it is satisfiable without the push channel
  - Given the sprint table, then no story deferred to milestone 2 still appears in a milestone-1 sprint. Note `PLT-104` is currently in **Sprint 1** (line 453)
- **Story Points:** 3 · **Priority:** P0 · **Labels:** `planning`
- **Depends on:** `D-0`

### Story D-3: Rewrite the two undeliverable acceptance criteria, and record the two missing deliverables

- **As a** developer **I want to** acceptance criteria that can actually pass **so that** "done" means something.
- **Measured — the plan's ACs are thin and prose-shaped.** `PLT-205`'s AC: _"matrix is maintained as new modules are added (living document, updated per new Epic)"_ — no failure condition. `PLT-901`'s AC omits what happens in `GRACE`. A minority are genuinely testable and survive intact: `PLT-401` names the layer (_"at the database connection level"_), `PLT-203` names the exact double-negative, `PLT-201` names _"server-side, not just UI-hidden"_.
- **Tasks:**

  | Story                | Current AC                                                                                                    | Why undeliverable                                                                                                                                                                                                                                                                    | Rewrite to                                                                                                                                                    |
  | -------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `PLT-902` (line 418) | _"A dashboard exists showing **p50/p95/p99 latency for at least the Attendance capture endpoint**"_           | The endpoint does not exist — it arrives in a later milestone. And `ADR-016:48`: _"p50/p95/p99 are **not directly exported by the text format**; they are computed by the collector from a histogram or summary … and **that is what the story's acceptance criterion should say**"_ | Assert the exposition endpoint returns a histogram with bounded cardinality (route, method, status only), and that the collector computes percentiles from it |
  | `PLT-801` (line 387) | _"a homework submission file is only retrievable by the submitting student, their teacher, and their parent"_ | All three entity types are absent from Platform Core **by design** (`BLG-102`)                                                                                                                                                                                                       | Assert `IFileAccessPolicy` behaviour against fakes, and record `ADR-015:44`'s cost: _"the policy code is written twice, once against fakes"_                  |

- **Also record — two deliverables no document owns:**
  - **`PLT-903`** AC (line 422) names _"last backup time"_. **No backup story exists** in the 33, no `OPS-*` story, no entity. Its AC is undeliverable as written.
  - **`PLT-802`** task (line 394): _"Per-school storage quota tracking tied to license `limits`"_. There is **no quota column and no quota table** among the 14 models. `StoredFile` has `sizeBytes` and `retentionUntil` but nothing aggregating usage.
- **Acceptance Criteria:**
  - Given any AC in the amended plan, then it names an observable condition and a failure case — a goal with no failure condition is not an AC
  - Given `PLT-902` and `PLT-801`, then each is satisfiable within milestone 1
  - Given `PLT-903` and `PLT-802`, then each has either a story or an explicit deferral with an owner
- **Story Points:** 3 · **Priority:** P1 · **Labels:** `planning`
- **Depends on:** `D-0`

### Story D-4: Take the three blocking decisions — GATE for `EPIC-G`

- **As a** the owner **I want to** three decisions recorded **so that** `PLT-101` is not built on an unanswerable question.
- **Three stories cannot be started today, and one of them is a prerequisite for the first feature:**

  | #   | Decision                                     | Blocks                          | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
  | --- | -------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | 1   | **One role per user, or a `UserRole` join?** | `PLT-201`, `PLT-202`, `PLT-204` | The schema has a single `roleId` FK with the comment _"One role per user. See the open question on multi-role support."_ The ERD gate **fails if a 15th model appears.** `ERD:84`: _"A teacher who is also a parent cannot be expressed … a decision for the owner **before `PLT-201`**, not something to add silently."_ The Jira plan is silently single-role in four places and never says so; `UserRole` appears nowhere in it. **Referenced in three documents, owned in none.** |
  | 2   | **`Money` `bigint` → JSON wire format**      | `PLT-301`, `PLT-302`            | `packages/shared-types` **already ships** `Money{amountMinor: bigint}` with a passing test, and `bigint` does not survive `JSON.stringify`. Nothing forbids a bare `number`. This is ⚑G / proposed `ADR-024` — undecided, and it is already a live cross-app contract. `PLT-302` is additionally double-blocked: enforcing `maximum_students` needs a `Student` entity that does not exist.                                                                                           |
  | 3   | **`PLT-107` — first-admin bootstrap**        | **`PLT-101`**                   | `School_Setup_Workflow_v1.md` §6.5 requires a one-time setup token. `PLT-107` is **proposed, not ticketed**. `SSOT.md` §7 Q13: _"**no existing story covers it**, so a fresh deployment cannot create its first administrator."_ `PLT-101` ships an auth system with **no way to create the first user.**                                                                                                                                                                             |

- **Tasks:**
  - [ ] Decide 1; if multi-role, amend the schema source and re-generate — the ERD gate's 14-model assertion is a deliberate tripwire
  - [ ] Decide 2; write `ADR-024`; specify the wire format and the type rule that forbids `number`
  - [ ] Tick `PLT-107` with acceptance criteria, or fold bootstrap into a seed script and record the choice
- **Acceptance Criteria:**
  - Given a fresh database with no users, then there is a documented, tested path to creating the first administrator, and it does not require a credential from a previous deployment
  - Given decision 2, then `ADR-024` is `Accepted` and a cross-app test proves `bigint` survives serialisation
  - Given decision 1, then the schema and the ERD agree, and the tripwire assertion matches the decision
- **Story Points:** 3 · **Priority:** P0 · **Labels:** `governance`, `data-model`
- **Depends on:** `D-0` · **Blocks:** `EPIC-G` entirely

### Story D-5: Record the two unowned Definition-of-Ready deliverables, and the missing mandatory test

- **As a** developer **I want to** every Definition of Ready satisfied **so that** an epic's precondition is a real thing.
- **Measured: 0 of 5 scorable DoRs are fully satisfied. 3 partial, 2 not. And 4 of 9 epics have no DoR at all** (06, 07, 08, 09 — they carry only _Goal_ and _Maps to_). 7 of 9 have no Definition of Done.
- **Two DoR halves have no deliverable anywhere:**
  1. **`PLT-EPIC-04` DoR** (line 240) requires a _"list of 'sensitive actions' per module agreed."_ It appears in **no ADR, no ERD section, no schema comment, no `SSOT.md` decision.** It is the direct input to `AGENTS.md` §2.3's `@Audited` requirement and to `PLT-402`'s `reasonRequired` configuration. **An undiscovered, unowned deliverable on the most security-critical surface.**
  2. **`PLT-EPIC-05` DoR** (line 286) requires _"**Logging library selected** (e.g., Pino/Winston)."_ No ADR selects one. `AGENTS.md` §3.1 says confirm before adding, and `ADR-020` is the precedent for recording the choice. `F-5` needs this.
- **One mandatory test is missing from a story's task list:** `PLT-102` names two tests; `ADR-008:38` lists the **concurrent-refresh race** as Mandatory, with a named catastrophic failure mode — _"the loser's rejection must **not** nuke the family, or every user on a poor connection gets logged out."_
- **Tasks:**
  - [ ] Produce the sensitive-actions list as a checked-in artefact; wire `check-route-guards` to it
  - [ ] Write the logging-library ADR (unblocks `F-5`)
  - [ ] Add the concurrent-refresh race to `PLT-102`'s tasks
  - [ ] Add DoR/DoD to epics 06–09, or record that the Prompt Pack's entry conditions govern them instead
- **Acceptance Criteria:**
  - Given any `@Audited('<ACTION>')` in the codebase, then `<ACTION>` appears in the checked-in sensitive-actions list
  - Given `PLT-102`, then its task list names the concurrent-refresh race
- **Story Points:** 3 · **Priority:** P1 · **Labels:** `planning`, `security`
- **Depends on:** `D-0`

---

## EPIC-E — CI: the minimum that makes the gates non-advisory

**Goal:** stop every gate in this plan from being advisory.
**Why:** without CI, nothing runs unless a human remembers. Every gate result in §0.1 exists only because a session typed the command.
**Scope decision:** this is **not** Prompt Pack P3's 34 points. P3's human gate requires a raw `<button>` to fail CI _and_ a compliant `<Button>` to pass — impossible until `B-1`. So shadcn first, then the minimum CI.
**Note:** branch protection requires a paid plan for private repos. The **workflow file does not** — ship the workflow; note the limitation.
**Estimate:** 18 pts

### Story E-1: One workflow running the nine gates

- **As a** developer **I want to** the gates to run on every push **so that** "verified" means verified on a machine I do not control.
- **Tasks:**
  - [ ] `.github/workflows/gates.yml` running all nine gates
  - [ ] Report pass/fail per gate, not a single aggregate
  - [ ] Run `docs:verify` and `report-status.mjs` (from `C-1`) as gates in their own right
  - [ ] Record that branch protection is unavailable on the current plan
- **Acceptance Criteria:**
  - Given a push to `main`, then the workflow runs and reports nine named results
  - Given a gate that exits non-zero, then the workflow fails and names that gate
  - Given `report-status.mjs` finds a drifted count in `SSOT.md` §1, then the workflow fails
- **Story Points:** 5 · **Priority:** P0 · **Labels:** `ci`
- **Depends on:** `A-3`, `C-1`

### Story E-2: `scripts/check-route-guards.mjs` — make `AGENTS.md` §2.3 executable

- **As a** developer **I want to** a controller route with neither decorator to fail the build **so that** §2.3's fail-closed guarantee stops being prose.
- **Measured:** `AGENTS.md` §2.3 — _"A **CI static check must fail** on any controller route carrying neither"_ and §13 _"CI must fail on a missing `@RequirePermission`."_ Today: `git grep RequirePermission` outside docs returns **1 hit, a comment** in `prisma-schema.spec.ts:20`. `RequireEntitlement` → **0 hits**. `check-route-guards` does not exist. `scripts/` contains one file.
- **Tasks:**
  - [ ] Accept `@RequirePermission(k)` **or** `@Public('<reason>')`; reject everything else (`ADR-018`)
  - [ ] Require a `@Public` reason to be non-empty **and** present in a checked-in allowlist
  - [ ] Require every `@RequirePermission` key to have a row in the RBAC matrix fixture (`ADR-012`)
  - [ ] Require `@RequireEntitlement` on any feature-gated capability, so a Basic-edition school cannot reach Deluxe functionality by calling the API directly
  - [ ] Require a checked-in allowlist file so exemptions are reviewable rather than invisible
- **Acceptance Criteria:**
  - Given a controller route with neither decorator, when the script runs, then it exits non-zero naming the file, the route and the class
  - Given a route with `@Public('health liveness probe')` and that reason in the allowlist, then it passes
  - Given `@Public('temporary debug')` **not** in the allowlist, then it fails naming the unlisted reason
  - Given a `@RequirePermission('FINANCE_INVOICE_REVERSE')` with no matrix row, then it fails naming the key
  - Given the script itself deleted, then `pnpm test` fails — the guard is covered by a guard
- **Story Points:** 8 · **Priority:** P0 · **Labels:** `ci`, `security`
- **Depends on:** `F-2` (the decorators must exist to be checked)

### Story E-3: `scripts/check-i18n.mjs` and a pre-commit hook

- **As a** developer **I want to** a literal user-facing string in JSX to fail **so that** §2.8's review-blocking rule is mechanical.
- **Measured:** `AGENTS.md` §2.8 — _"A literal English string in JSX/TSX is a review-blocking issue."_ `packages/config/eslint/next.js:15-18` states the rule is _"NOT enforced here … implemented as `scripts/check-i18n` in P3."_ It does not exist. What exists is indirect: key **parity** across four locales (`i18n-resources/src/index.spec.ts`) and a ban on hex **colours** (`next.js:40-48`). Neither detects a raw English string in JSX. The landing page's own comment claims _"Every string on this page is a translation key"_ — the parity half is enforced, the no-literal half is not.
- **Tasks:**
  - [ ] Detect a bare string literal in JSX text and in `title=`/`placeholder=`/`aria-label=` that is not a `t()` call
  - [ ] Allow-list the four locales' values so a translation is not flagged
  - [ ] Pre-commit hook running the fast gates (`lint`, `typecheck`, `test`, `check-i18n`, `docs:verify`)
  - [ ] Enable secret scanning (the only un-done item in `TODO.md` §P0 — `GAP-01`'s compensating control)
- **Acceptance Criteria:**
  - Given `<h1>Welcome</h1>`, when `check-i18n` runs, then it exits non-zero naming the file and the literal
  - Given `<h1>{t('hero.title')}</h1>`, then it passes
  - Given a Tamil string literal, then it passes — the rule bans untranslated English, not non-English
  - Given a pre-commit hook, then a commit touching `apps/*/src` runs the fast gates and aborts on failure
- **Story Points:** 5 · **Priority:** P1 · **Labels:** `ci`, `i18n`
- **Depends on:** `B-1` (a shadcn `Button` renders a translated label; the rule must not flag it)

---

## EPIC-F — P4: the walking skeleton — the first product code

**Goal:** turn 189 lines of API into a running, guarded, persistent service.
**Why this is the first epic that writes product code.** Every preceding epic hardens the toolchain. This one uses it.
**Pulled forward by `ADR-017`:** ① structured logging + redaction, because `PLT-101`'s own AC requires _"password is never … logged in plaintext"_ and _"a redaction guarantee cannot be asserted by a story that runs two epics after the logger exists."_ ② `/health/liveness`, because _"a boot that cannot be health-checked cannot be verified in CI."_
**Estimate:** 39 pts

### Story F-1: `IClock` and the domain error hierarchy

- **As a** developer **I want to** time injected and errors typed **so that** accrual, expiry, deadlines and hold expiry are deterministically testable.
- **Measured:** `AGENTS.md` §2.4 forbids `Date.now()`/`new Date()`/`Math.random()` in domain and use-case code. `packages/config/eslint/node.js` already bans them and the rule is **live and firing** — but `apps/api/src` has no `domain/` or `use-cases/` directory to point at, so the ban currently protects nothing. `ADR-004` says this is _"enforced mechanically, not by convention."_
- **Tasks:**
  - [ ] `IClock` port + system implementation + test double · [ ] typed domain error hierarchy · [ ] a global exception filter
- **Acceptance Criteria:**
  - Given a use-case calling `Date.now()`, when `pnpm lint` runs, then it exits non-zero naming the rule and the file — the ban now has a real target
  - Given two tests of the same accrual logic run at different wall-clock times, then both produce identical results
- **Story Points:** 5 · **Priority:** P0 · **Labels:** `api`, `architecture`

### Story F-2: The four guard decorators, fail-closed

- **As a** developer **I want to** every route to require an explicit authorization decision **so that** an unguarded route is impossible rather than merely discouraged.
- **Tasks:**
  - [ ] `@RequirePermission` · [ ] `@RequireEntitlement` · [ ] `@Audited` · [ ] `@Public` (`ADR-018`) · [ ] a global guard that fails closed
  - [ ] The `@Public` allowlist file, checked in
- **Acceptance Criteria:**
  - Given a controller with no decorator, when the app boots, then it **refuses to start** naming the route — fail-closed, never fail-open
  - Given `@Public('health liveness probe')` with the reason in the allowlist, then the app boots
  - Given `@RequireEntitlement('canteen')` on a route and a Basic-edition licence, then the request is refused
- **Story Points:** 8 · **Priority:** P0 · **Labels:** `api`, `security`
- **This is what makes `E-2` meaningful.** A static check for a decorator that does not exist checks nothing.
- **Ownership policies are enforced, not just roles** (`AGENTS.md` §2.3): teacher → own classes, parent → own children, vendor → own outlet, via `IOwnershipPolicy`, with role-denial and ownership-denial **distinguishable in logs**.

### Story F-3: First migration, seed script, and the audit REVOKE proof

- **As a** developer **I want to** a real database with a real migration **so that** anything that persists can run.
- **Measured:** `apps/api/prisma/migrations` **does not exist**. `ERD Q7`: _"No migration has been generated. `prisma migrate` is a **P4** deliverable."_ And `D34` is _"[!] **Not yet demonstrated**"_ — `hardening/audit-immutability.sql` exists and a gate checks it is well-formed, but **nothing has ever attempted an `UPDATE` against `audit_records`**, because there is no PostgreSQL in this environment.
- **Tasks:**
  - [ ] Generate the initial migration from the generated schema · [ ] Apply `audit-immutability.sql` · [ ] **Attempt an `UPDATE` and an `DELETE` and observe both fail at the database connection level** — this is the demonstration `PLT-401`'s AC demands and `TODO.md:125` requires · [ ] Seed script: system roles, permissions, and the first administrator path
- **Acceptance Criteria:**
  - Given the migration applied, when a raw `UPDATE audit_records SET ...` is issued over a direct connection, then it fails with a permission error, and the test asserts the failure
  - Given the same for `DELETE` and for `TRUNCATE`, then each fails
  - Given the application role, then `INSERT` and `SELECT` succeed — immutability without loss of function
  - Given a fresh database, then the seed creates the system roles from the code catalogue and one administrator, idempotently
- **Story Points:** 5 · **Priority:** P0 · **Labels:** `api`, `data`, `security`
- **Blocked for the owner:** requires PostgreSQL. `ADR-019`'s `persistence: 'disabled'` state is why nothing can be proven today. See §5.

### Story F-4: `/health/liveness`

- **As a** an operator **I want to** a liveness endpoint **so that** a boot can be verified in CI and in a container orchestration check.
- **Tasks:** [ ] `GET /health/liveness` returning 200 once the process is listening · [ ] `@Public('container liveness probe')` with the reason in the allowlist · [ ] readiness is **not** in this story — it stays in P13 per `ADR-017` ②
- **Acceptance Criteria:**
  - Given the app running, when `GET /health/liveness` is called, then it returns 200 with no database access
  - Given the app not running, then the request fails at the transport layer — the endpoint must not depend on Postgres or Redis
  - Given `E-2` is enabled, then this route passes only because its `@Public` reason is in the allowlist
- **Story Points:** 3 · **Priority:** P0 · **Labels:** `api`, `ops`

### Story F-5: Structured logger, redaction, and dual error logging

- **As a** developer **I want to** errors in both a rotating file and the database **so that** a failure is diagnosable after the process is gone.
- **Measured:** `AGENTS.md` §2.15 — every `ERROR`/`CRITICAL` to **both** the rotating structured-JSON file **and** the DB error log, never one without the other. Rotation: 25 MB active, 3 historical. No logger exists; no ADR selects one (`D-5`).
- **Tasks:**
  - [ ] Apply the logging-library ADR from `D-5` · [ ] Redaction of passwords, tokens, card data, secrets, biometric templates (`AGENTS.md` §2.13) · [ ] Correlation IDs · [ ] Dual sink · [ ] 25 MB × 3 rotation
- **Acceptance Criteria:**
  - Given a request that throws, when it is handled, then one row exists in `error_logs` **and** one line exists in the JSON file, sharing a correlation ID
  - Given a log line containing a password, token, card number or biometric template, then it is redacted — asserted by test, not by inspection
  - Given the active file exceeds 25 MB, then it rotates and three historical files are retained
  - Given an `ERROR`, then **both** sinks are written; there is no configuration in which only one is
- **Story Points:** 8 · **Priority:** P0 · **Labels:** `api`, `observability`, `security`
- **Depends on:** `D-5.2` (the library ADR), `F-3` (the DB sink needs a migration)
- **Note:** `FIX-17` recorded a code-page-850 console artefact that made non-ASCII output look like mojibake. Ensure the logger writes UTF-8 and that the test does not read through a console.

### Story F-6: Typed API client, and the 403/404/error pages

- **As a** developer **I want to** a typed client and real error pages **so that** the web app can talk to the API without ad-hoc fetching.
- **Tasks:** [ ] typed client in `apps/web` (`AGENTS.md` §3.1: **UI only, no server actions**) · [ ] 403 · [ ] 404 · [ ] error boundary · [ ] all four locales
- **Acceptance Criteria:**
  - Given any API call from the web app, then it goes through the typed client and no server action exists
  - Given a 403 from the API, then a translated 403 page renders naming the missing permission
  - Given an unhandled error, then the error page renders and the correlation ID is shown so support can trace it
- **Story Points:** 5 · **Priority:** P1 · **Labels:** `web`, `api`
- **Depends on:** `B-1`, `B-3`, `F-4`

### Story F-7: The first real integration test

- **As a** developer **I want to** `test:integration` to run an actual test **so that** the gate stops being a stub and starts being evidence.
- **Depends on:** `A-1`. Until this lands, `pnpm test:integration` is **red by design** — that is the honest state.
- **Tasks:** [ ] One integration test against a real Postgres (containerized, isolated schema per `AGENTS.md` §4) · [ ] Cover the audit-REVOKE demonstration from `F-3`, because that is precisely the claim that cannot be made without a real database · [ ] Retire the `echo … && exit 0` stub
- **Acceptance Criteria:**
  - Given `pnpm test:integration`, then at least one test executes and the count is non-zero
  - Given the audit table, then the integration test observes an `UPDATE` failing at the connection level
  - Given the suite, then it runs against a real Postgres in an isolated schema, not a mock
- **Story Points:** 5 · **Priority:** P0 · **Labels:** `test`, `api`, `data`
- **Depends on:** `A-1`, `F-3` · **Closes:** `AUD-30-02` for real

---

## EPIC-G — The first feature

**Goal:** a real user logs in. This is the first thing a school could actually use.
**Entry conditions, all measured:** `A-3` `A-1` `A-2` `A-4` done · `B-1` `B-2` done · `C-1` done · `E-1` `E-2` done · `EPIC-F` done · **`D-0` and `D-4` decided** · the Jira plan reconciled (`D-1`…`D-3`, `D-5`).
**Story points are the Jira plan's, unchanged.** `ADR-017:63` — _"No acceptance criterion is weakened. Story IDs, priorities and acceptance criteria are unchanged. Only the ordering moves."_ This plan does not renumber any `PLT-*` story and does not re-estimate any `PLT-*` story.
**Estimate:** ~34 pts

| Story                                   | Pts    | Jira ref                    | Notes                                                                                                                                                                                                                                     |
| --------------------------------------- | ------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G-6** `PLT-107` first-admin bootstrap | 3      | **proposed — not ticketed** | **Must precede all of `EPIC-G`.** `School_Setup_Workflow_v1.md` §6.5. Without it `PLT-101` ships auth with no way to create the first user                                                                                                |
| **G-2** `PLT-101` JWT login             | 8      | `PLT-101`                   | argon2id behind `IPasswordHasher` (`ADR-007`). Redaction guaranteed by `F-5`, not asserted. Lockout threshold from settings, not hard-coded — the Jira AC says `5`/`10 minutes` while its own task says `N` configurable                  |
| **G-3** `PLT-102` refresh rotation      | 8      | `PLT-102`                   | Add the **concurrent-refresh race** test from `ADR-008:38` — the failure mode is that the loser's rejection nukes the family and logs out every user on a poor connection                                                                 |
| **G-4** `PLT-103` sessions              | 5      | `PLT-103`                   | Devices, IP, last-active, per login                                                                                                                                                                                                       |
| **G-5** `PLT-105` password reset        | 5      | `PLT-105`                   | Email via `INotificationChannelAdapter` from the first story that needs it (`ADR-014`) — **not** a direct email library call, which would violate `AGENTS.md` §2.2 from the first commit                                                  |
| **G-7** Auth-event audit retrofit       | 5      | `ADR-017` ④                 | Login success/failure, lockout, logout, session revoke, refresh-reuse detection, password reset, role change. Uses the `IAuditRecorder` port defined in `G-2`, real store in P7. **A port that does not exist anywhere in the Jira plan** |
|                                         | **34** |                             |                                                                                                                                                                                                                                           |

**Deferred to milestone 2** (`D5`, `ADR-005`, `BLG-020`/`021`/`022`): `PLT-104` OTP · `PLT-106` root detection · the push half of `PLT-702` · the mobile tasks on `PLT-101` and `PLT-103` (the last two are **missing from `ADR-005`'s deferral list** — see `D-2`).

**The critical security test for this epic** (`AGENTS.md` §4.1): prove a parent's session can never read another family's data, and that the audit record for a sensitive action is written **in the same transaction** — not queued.

---

## EPIC-H — Platform Core remainder (P6–P14), sequenced not specified

Sized from the Jira plan, unchanged. The deviations that matter are already recorded in `ADR-017`; the corrections are in `EPIC-D`.

| P   | Epic                                     | Stories          | Pts      | Blocked on                                                |
| --- | ---------------------------------------- | ---------------- | -------- | --------------------------------------------------------- |
| P6  | `PLT-EPIC-02` Dynamic RBAC               | `PLT-201`–`205`  | 42       | **`D-4.1` multi-role**                                    |
| P7  | `PLT-EPIC-04` Immutable Audit            | `PLT-401`–`404`  | 21       | `F-3` (REVOKE proof) · **`D-5.1` sensitive-actions list** |
| P8  | `PLT-EPIC-03` Licensing                  | `PLT-301`–`305`  | 29       | **`D-4.2` Money wire format**                             |
| P9  | `PLT-EPIC-05` remainder                  | `PLT-503`, `504` | 8        | `F-5`                                                     |
| P10 | `PLT-EPIC-06` Module Registry & Settings | `PLT-601`, `602` | 16       | P8                                                        |
| P11 | `PLT-EPIC-08` Storage                    | `PLT-801`, `802` | 13       | `D-3` (AC rewrite)                                        |
| P12 | `PLT-EPIC-07` Notifications              | `PLT-701`, `702` | 13       | P8 · `G-5` (the email adapter)                            |
| P13 | `PLT-EPIC-09` Health & Monitoring        | `PLT-901`–`903`  | 13       | `D-3` (`PLT-902`/`PLT-903` ACs)                           |
| P14 | Milestone close-out                      | `PLT-205` final  | —        | all of the above                                          |
|     |                                          |                  | **~157** |                                                           |

---

## EPIC-I — Requirements extraction, narrowed and moved off the critical path

**Goal:** extract the requirements Platform Core actually needs, and formally defer the rest.
**Why narrowed:** the predecessor plan ran all 37 points across all 87 FRs, blocking. Platform Core needs **`FR-PLT-01`…`08`** — 10 of 87. A 37-point documentation project should not gate the first line of product code.
**Why still needed:** `AGENTS.md` §13 tells every agent the working requirements are in `docs/idea-bank/` — five stubs totalling 16,124 bytes with **zero data rows**. The Prompt Pack greps those files before every story.
**The rule this must obey** (`idea-bank/README.md` §6): _"**Cite or mark as GAP. Never assert an uncited rule.**"_ and _"**Never invent a threshold, formula, rate or schedule.** If the corpus is silent, it is silent."_
**Estimate:** 14 pts · **Runs at any time, in parallel. Not on the critical path.**

### Story I-1: Fix `fr-index.md`'s own schema before extracting into it

- **As a** developer **I want to** the target file's column spec to be correct **so that** the extraction does not inherit a wrong schema.
- **Measured:** `fr-index.md:17` lists **20** FR prefixes. SRS §3 actually contains **23** — it omits `FR-AST` (2 FRs), `FR-HST` (1) and `FR-WAL` (1). Its schema also offers a single MVP flag, but **3 FRs are dual-priority**: `FR-ATT-02`, `FR-COM-01`, `FR-MOB-01`.
- **Acceptance Criteria:** Given the column spec, then all 23 prefixes appear; given a dual-priority FR, then the schema has a defined way to record both
- **Story Points:** 1 · **Priority:** P1 · **Labels:** `requirements`

### Story I-2: Extract the Platform Core slice only

- **As a** an agent about to build a Platform Core story **I want to** the rules and entities for `FR-PLT-01`…`08` **so that** I do not grep an empty file and invent an answer.
- **Tasks:** [ ] `fr-index.md` rows for the 10 `FR-PLT` FRs, each traced to a story and a test · [ ] `business-rules.md` for the rules those stories depend on · [ ] `domain-entities.md` cross-checked against `SSOT.md` §4 and `AGENTS.md` §2.9 for an existing equivalent
- **Acceptance Criteria:**
  - Given `FR-PLT-01`, then `fr-index.md` carries a row naming its story, its test target, and whether it is MVP
  - Given any rule row, then it carries a source citation **and** a named test target
  - Given a concept that already exists in `SSOT.md` or `AGENTS.md` §2.9, then the row names the equivalent rather than creating a parallel one
  - Given the corpus is silent on a rule, then the row reads `GAP — needs design (PC-xxx)` and **not** an invented threshold
- **Story Points:** 8 · **Priority:** P1 · **Labels:** `requirements`

### Story I-3: Record the two orphaned Platform Core FRs

- **As a** developer **I want to** every shipped behaviour to trace to a requirement **so that** requirements debt created by shipping is visible.
- **Measured:** `FR-PLT-09` (_runtime language switching across en/ta/si/ar, persisted on the user profile_) and `FR-PLT-10` (_RTL layout when Arabic is selected_) have **no epic**. The Jira document's declared source range is `FR-PLT-01 → FR-PLT-08`. Both were **built anyway**, off-plan, via `DSN-02`/`DSN-03` and the landing page. That is work shipped against requirements with no owner and no acceptance test.
- **Tasks:** [ ] Add both as `unassigned` in `fr-index.md` · [ ] Either write the missing stories or record the deferral
- **Acceptance Criteria:** Given the two FR IDs, then each appears in `fr-index.md` with status `unassigned` and a named owner
- **Story Points:** 2 · **Priority:** P1 · **Labels:** `requirements`

### Story I-4: `REQ-07` — formally defer `PC-000`…`PC-006`

- **As a** the owner **I want to** each known gap either designed or formally deferred **so that** no module is ever built on an invented rule.
- **Measured:** no design exists for any of the seven. `School_Setup_Workflow_v1.md` carries a _provisional_ treatment for all seven (19 references, 3 explicit "do not finalise" instructions) — but **no named owner and no target milestone for any of them.** They are _managed_, not _resolved_. `REQ-07` requires all three.
- **Correction to record while doing this:** `PC-005` is **mis-classified.** `idea-bank/README.md` treats BookShop/Canteen/Hall as an FR gap, but **SRS §3.10 already contains 15 FRs** — `FR-RET-01…04`, `FR-CAN-01…04`, `FR-BKS-01…03`, `FR-FAC-01…04`. It is a **rules/entities/settlement-design** gap, not an FR gap.
- **Verified state of the seven:**

  | Gap                              | Corpus state                                                                                                                                      |
  | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `PC-000` Attendance              | 8 `FR-ATT` rows exist; **no** thresholds, no discrepancy algorithm, no capture-source conflict resolution, no absence-alert delay                 |
  | `PC-001` Leave / Workforce       | 5 `FR-WFM` rows exist; **no** accrual formula, no entitlement table, no carry-forward cap value                                                   |
  | `PC-002` Grading & Moderation    | `FR-ACA-06/07/08` state _what_ must happen; **no** grading scheme, band boundaries, moderation protocol or pass mark                              |
  | `PC-003` Tax & currency          | **Verified zero:** 0 occurrences of `tax`/`taxes` in SRS v1.2. 1 in Master Plan v5.2. `ADR-002` decides the _representation_ only                 |
  | `PC-004` Admission               | **Zero `FR` rows.** "admission" appears 5× in prose only. `SRS §6` explicitly defers it: _"Admission pipeline needs its own explicit entity set"_ |
  | `PC-005` Retail / Canteen / Hall | **15 FRs exist.** No entities, no settlement rules, no operator-model contract. **Reclassify**                                                    |
  | `PC-006` Student Wallet          | 1 FR (`FR-WAL-01`). No stored-value legal analysis, no GL design, no liability posting rule                                                       |

- **Acceptance Criteria:** Given each of the seven, then it carries either a design reference or `deferred — owner: <name>, target: <milestone>`; given `PC-005`, then it is classified as a rules/entities gap
- **Story Points:** 3 · **Priority:** P1 · **Labels:** `requirements`, `governance`

---

## 5. Decisions needed from the owner

These are not engineering tasks. Four of them block work in this plan.

| #     | Decision                                                            | Blocks                                            | Why it cannot be decided by an agent                                                                                                                                                                     |
| ----- | ------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | Approve or reject `ADR-001`…`ADR-021`                               | **`EPIC-D` entirely**, and `E-2`                  | Zero are `Accepted`. Every correction in `EPIC-D` resolves to an unapproved ADR. `ADR-003` — which governs the whole project — is marked _reconstructed, pending sign-off_                               |
| **2** | One role per user, or a `UserRole` join?                            | `PLT-201`, `P6`                                   | The ERD gate fails if a 15th model appears. `ERD:84` calls it _"a decision for the owner before `PLT-201`, not something to add silently."_ A teacher who is also a parent cannot currently be expressed |
| **3** | `Money` `bigint` → JSON wire format                                 | `PLT-301`, `PLT-302`, `P8`                        | `shared-types` already ships `bigint` in a live cross-app contract, and `bigint` does not survive `JSON.stringify`                                                                                       |
| **4** | `PLT-107` first-admin bootstrap — story or seed script?             | **`PLT-101`, `EPIC-G` entirely**                  | No story covers it. `PLT-101` would ship auth with no way to create the first user                                                                                                                       |
| **5** | Amend `AGENTS.md` §3.1 (Jest → Vitest) and the §6/§16 status lines? | honesty of the governing contract                 | `ADR-020` records the amendment as **blocked**. The repository ships Vitest; `AGENTS.md` §3.1 still mandates Jest. Every agent reads the wrong runner                                                    |
| **6** | PostgreSQL, or Docker Desktop?                                      | `F-3`, `F-7`, `D-5.1`, and the audit REVOKE proof | No PostgreSQL in this environment. `ADR-019`'s `persistence: 'disabled'` is why the audit immutability invariant is _specified and guarded against deletion, not demonstrated_                           |
| **7** | `format:check` scope — format the docs, or narrow the glob?         | `A-4`                                             | Formatting `AGENTS.md` and 60+ markdown files produces a large diff that makes every future documentation review noisy                                                                                   |

---

## 6. Summary

|                                             | Stories   | Est. pts |
| ------------------------------------------- | --------- | -------- |
| `EPIC-A` Make the gates honest              | 4         | 13       |
| `EPIC-B` Unblock every screen with a button | 6         | 21       |
| `EPIC-C` Bind the record, then freeze       | 7         | 19       |
| `EPIC-D` Reconcile the Jira plan            | 6         | 20       |
| `EPIC-E` CI: the minimum                    | 3         | 18       |
| `EPIC-F` P4 walking skeleton                | 7         | 39       |
| `EPIC-G` First feature                      | 6         | 34       |
| **To first feature shipped**                | **39**    | **164**  |
| `EPIC-H` Platform Core remainder            | 33 (Jira) | ~157     |
| `EPIC-I` Requirements slice (parallel)      | 4         | 14       |

**164 estimated points to a shipped login, of which 91 are gates, tooling, documentation and CI, and 73 are product code.** The previous plan was 147 points to _start_ the first story, with a further ~140 before it shipped, and 34 of those on requirements extraction for FRs no Platform Core story needs.

**The ratio is the finding.** 56% of the remaining work is still about the thing being measured rather than the thing being built. `EPIC-C` is the last epic in this plan that touches documentation, and it is explicitly one-time. `EPIC-F` is the first that writes a line a school would use.

**The one rule that keeps this from repeating:** no new documentation epic may be started until `EPIC-G` ships.

---

_Companion documents: `AGENTS.md` · `docs/core/SSOT.md` · `docs/core/EduFlow_Jira_Epics_PlatformCore_RBAC_v1.md` · `docs/core/EduFlow_Agentic_Prompt_Pack_PlatformCore_v1.md` · `docs/work/PLATFORM_CORE_PLAN.md` · `docs/work/TDD_EVIDENCE_GATES.md` · `docs/analysis/CODE_AUDIT_2026-09-30.md`_
