# TDD EVIDENCE — the gates can go red

**Purpose:** `ACTION_PLAN_2026-09-30.md` **EPIC-G1** exit criterion.
**Method:** for each gate, introduce one deliberate defect, run the command, **watch it exit non-zero**, revert. Nine commands, nine observed reds.
**Rule:** _verify by running the command, never by reading the config_ (`SSOT.md` §8 footguns).

> **A probe is not a tier.** On 2026-09-29 the coverage gate was "proved able to fail" — but by a _temporary probe threshold on a real file_, not by the configured `§4` tiers. A probe proves the mechanism works; a tier that matches nothing proves nothing. That distinction is the reason `FIX-26` is still open. Record which kind of evidence each row has.

---

## 1. Status

| #   | Gate                    | Baseline (clean tree)     | Can it go red?                           | Evidence                                                                      | Verdict                                                      |
| --- | ----------------------- | ------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | `pnpm typecheck`        | exit **0**                | ✅ **observed**                          | `B-1` 2026-09-30 — a missing `@types/react` made every `React` import `any`   | ✅ **honest**                                                |
| 2   | `pnpm lint`             | exit **0**                | ✅ **observed**                          | `B-1` — 9 cases execute the `next` config and prove the raw-element ban fires | ✅ **honest**                                                |
| 3   | `pnpm test`             | exit **0**, **161** tests | ✅ **3 of 3 observed**                   | `G1-1`/`G1-2`/`G1-3` §2, `B-1`                                                | ✅ **honest**                                                |
| 4   | `pnpm test:coverage`    | **exit 1**                | ✅ **now red**                           | §2, `A-2` 2026-09-30                                                          | ✅ **honest** — was hollow, enforced nothing                 |
| 5   | `pnpm build`            | exit **0**                | ⬜ **not yet observed**                  | —                                                                             | ⏸ **not re-run this session**                                |
| 6   | `pnpm test:integration` | **exit 1**                | ✅ **now red**                           | §2, `G1-3` 2026-09-30                                                         | ✅ **honest, deliberately**                                  |
| 7   | `pnpm test:e2e`         | exit **0**, 37 tests      | ✅ **observed, and it flaked**           | `B-1` — 36/37 on one run, 37/37 on the next two                               | ✅ **honest**, ⚠️ **1 flaky case, cause not yet identified** |
| 8   | `pnpm format:check`     | exit **2** → **1**        | ✅ **now red on style, no longer fatal** | `B-1` — compose `/**` header fixed; 78 style warnings remain                  | ✅ **honest** · `G1-7` **half closed**                       |
| 9   | `pnpm docs:verify`      | exit **0**, 213 refs      | ✅ **observed twice**                    | §2, "catches a moved file" + "catches prose that invented a path"             | ✅ **honest**                                                |

**Re-measured after B-1, 2026-09-30:** `typecheck` 0 · `lint` 0 · `test` 0 (**161**) · `docs:verify` 0 · `test:e2e` 0 (**37**) · `test:coverage` **1** _(honest, `A-2`)_ · `test:integration` **1** _(honest, no Postgres yet)_ · `format:check` **1** _(improved from 2)_ · `build` not re-run.
**Honest score: 7 of 9 trustworthy · 0 hollow · 2 deliberately red · 1 not re-run.** **Zero hollow gates remain** — the last was closed by `A-2`.

⚠️ **Two things this table does not yet prove, recorded rather than hidden:**

- **`test:e2e` is flaky.** One run gave `36 passed | 1 failed`, the two after it gave `37 passed`. The failure text was `SyntaxError: Unexpected end of JSON input` from Playwright's `[WebServer]` plus `.landing-topnav is missing` — i.e. the dev server was not serving when the test ran, consistent with the turbo pipeline and a direct run competing for port 3500. **Not confirmed**: no single test has been observed failing twice. A flake that is only ever seen under parallel load should be fixed, not re-run until green.
- **`docker` is not installed here**, so `docker compose -f infra/docker/docker-compose.yml config` has never been executed. The compose file is verified to **parse**, and nothing more than that. `G1-10` stays open for the version pinning, and the `minio` healthcheck is unverified.

**4 of 9 rows now have their deliberate-defect evidence recorded.** One hollow remains — the e2e dark branch (`AUD-30-04`) — which is a _different_ failure from "cannot go red": it exits 0 and would exit 0 regardless of what the application does.

**Honest score: 6 of 9 trustworthy · 1 hollow · 2 red.** (`test:integration` and `test:coverage` are now red _for the right reason_; `format:check` is red as always.) This supersedes the `"5 of 9 … 1 not run"` line the audit recorded and the `"7 of 9 … 0 hollow"` line in `SSOT.md` §1, which does not sum to 9.

---

## 2. Evidence observed 2026-09-30, before this file existed

Recorded because it was collected during the audit and is the RED for `G1-1`. Everything else must still be gathered.

### `G1-1` / `AUD-30-01` — a test file outside its runner's `include` globs

**Status: ✅ CLOSED 2026-09-30.** The strongest RED in this file, and the only story in EPIC-G1 with a completed cycle.

**RED, observed twice, by execution:**

```console
$ pnpm --filter @eduflow/web exec vitest run web-port.spec.ts
No test files found, exiting with code 1

$ pnpm --filter @eduflow/web test
 Test Files  1 passed (1)
      Tests  4 passed (4)          # exit 0 — green, while the test does not run
```

**Why this was the strongest RED.** The file was named explicitly on the command line and the runner _still_ refused it, because Vitest applies `include` as a filter to explicit arguments. The second command is the proof of silence: the suite reports green, `1 passed (1)`, and that one file is `src/lib/rtl.spec.ts` with its 4 tests. `web-port.spec.ts` — 3 tests guarding the 2026-09-29 port-3000 incident — appeared in no count anywhere.

**GREEN.** Both files moved from the package root to `src/lib/`, colocated per `AGENTS.md` §3 ("one test file per source file"). `playwright.config.ts`'s import updated to `./src/lib/web-port`. The spec's own `dirname(import.meta.url)` — which resolved to the web package _only because the file sat at the root_ — replaced with a walk up to the `@eduflow/web` manifest, so the test is position-independent. A hard-coded `../../` would have been a second thing that silently drifts when a file moves, and the whole point of this file is that a test which quietly stops testing is the bug.

```console
$ pnpm --filter @eduflow/web test
 Test Files  2 passed (2)
      Tests  7 passed (7)          # exit 0 — matches the G1-1 acceptance criteria exactly
```

**Proof it has teeth** — the production change this test exists to prevent:

- **Defect:** `apps/web/package.json`, `"dev": "next dev --port 3500"` → `--port 3000`
- **Command:** `pnpm --filter @eduflow/web test`
- **Observed:**
  ```text
   ❯ src/lib/web-port.spec.ts (3 tests | 1 failed) 11ms
     → "dev" must use --port 3500: expected 'next dev --port 3000' to contain '--port 3500'
  AssertionError: "dev" must use --port 3500: expected 'next dev --port 3000' to contain '--port 3500'
   ❯ src/lib/web-port.spec.ts:60:68
   Test Files  1 failed | 1 passed (2)
        Tests  1 failed | 6 passed (7)
  ```
  exit **1**
- **Reverted:** yes, and the suite returned to `7 passed (7)`.
- **Kind:** **real behaviour.** A before/after pair on the same defect: silence, then a precise named failure.

**⚠️ A footgun hit during this cycle, recorded because it nearly invalidated the RED.** The first attempt to break the port used PowerShell `Set-Content -Encoding utf8`, which **writes a BOM**. The suite went red with exit 1 — but for the _wrong_ reason:

```text
[SyntaxError] Unexpected token '﻿', "﻿{
```

That is a parse error, not the port assertion, and per the TDD rule it does not count as valid RED: _"the failure is not caused only by unrelated syntax errors." The file was restored from a byte-exact backup and the break redone with a BOM-free write. **This is the second time in the project that a PowerShell BOM has been the actual cause of a failure** — it is already a recorded footgun (`SSOT.md` §8), and it is the reason the restore path is `Copy-Item` + a BOM assertion rather than a rewrite.

**Side effect, not scope creep.** `apps/web/vitest.config.ts` declares a `src/lib/**/*.ts` coverage threshold. That glob previously matched only a spec file, so it was inert. With a real source file in `src/lib/` it is now live: `web/src/lib` reports **100% statements, 100% branches, 100% functions, 100% lines**. A partial `FIX-26` win for the web package, obtained by fixing the actual defect rather than by editing a config.

**Recurrence is blocked.** See `A-3` below.

### `A-3` / `G1-2` — the test-file oracle

**Status: COMPLETE 2026-09-30.** Closes the class, not the instance.

**Kind: mechanism probe, on a real defect.** A guard's RED cannot be a missing feature, because the feature is the absence of a defect. The evidence is therefore a deliberate break that reproduces `AUD-30-01` exactly.

**⚠️ The first RED attempt was invalid and was discarded.** Recorded because the same discipline applies that caught the PowerShell BOM. The new test reported `apps/web/tests/e2e/shell.spec.ts` as unowned — which looked like a _second_ live instance of `AUD-30-01`, and would have been a serious finding. It was **my own bug**: the Playwright glob was written `[jt]s[x]?` instead of `[jt]s?(x)`, and the former matches nothing at all.

```text
**/*.spec.ts                      -> ["shell.spec.ts"]
**/*.{spec,test}.?(c|m)[jt]s?(x)  -> ["shell.spec.ts"]
**/*.{spec,test}.?(c|m)[jt]s[x]?  -> []            <-- the bug
```

Per `tdd-workflow`, a failure caused by broken test setup is not a RED gate. The pattern was corrected. **A false RED that names a real-looking path is more dangerous than no test at all**, because it invites a confident report of a defect that does not exist — the same failure as `FIX-17` ("I nearly reported this as a P0 data-integrity defect") and the port-3000 incident.

**A hole that bug exposed, now closed.** The test also asserted that `apps/web` is discovered by _both_ Vitest and Playwright. That assertion **passed** while Playwright's glob set was empty, because it only compared runner _names_. An additional case now asserts every detected runner has a non-empty glob set, so a mis-parsed or non-matching pattern can never again masquerade as a repository finding.

**RED, by deliberate break, on the original defect shape:**

- **Defect:** `apps/web/web-port.spec.ts` recreated at the package root — the same path, outside `src/**` and `tests/**`, and therefore outside both runners
- **Command:** `pnpm --filter @eduflow/api exec vitest run src/config/test-file-oracle.spec.ts`
- **Observed:**
  ```text
  × every spec file on disk is executed by some runner > '@eduflow/web' >
    has every spec file on disk matched by a runner include glob
    → @eduflow/web: 1 spec file(s) exist on disk but no runner collects them:
      apps/web/web-port.spec.ts

  Test Files  1 failed (1)
       Tests  1 failed | 14 passed (15)
  ```
  exit **1**
- **Reverted:** yes — the probe was deleted, and `git status` shows only the two intended new files
- **Kind:** **mechanism probe on a real defect.** Note that `pnpm --filter @eduflow/api test` did **not** collect the probe: it is in `apps/web`, outside the api runner's globs. The probe was genuinely dormant for the same reason the original was, and the oracle is what noticed.

**GREEN:**

```console
$ pnpm --filter @eduflow/api exec vitest run src/config/test-file-oracle.spec.ts
 ✓ gives every detected runner a non-empty glob set 650ms
 Test Files  1 passed (1)
      Tests  15 passed (15)
```

**Full-suite effect:** `@eduflow/api` **78 → 93** tests, all passing. Repository total **110 → 125**.

**What the oracle checks, and why each case is there:**

| Case                                                                | Guards against                                                                                                         |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| every on-disk spec matched by a runner's include glob               | `AUD-30-01` — the defect itself                                                                                        |
| no spec file is 0 bytes                                             | a file that is collected and asserts nothing                                                                           |
| every detected runner has a non-empty glob set                      | **the false RED above**                                                                                                |
| `apps/web` splits between Vitest and Playwright **without overlap** | either runner running nothing, or both loading the other's test API                                                    |
| include globs are _read_ from the configs, not assumed              | the parser silently returning nothing, so every package falls back to the Vitest default and matches nearly everything |
| packages declaring `test` actually have spec files                  | a package whose script runs a runner over an empty tree                                                                |

**Zero new dependencies.** The glob engine is `node:fs`'s own `globSync` (Node 26.7.0), verified against all three glob forms this repository uses — including Vitest's `**/*.{test,spec}.?(c|m)[jt]s?(x)` default. A re-implemented matcher would have been the weakest link in a test whose entire job is trusting its own matching.

**Known limits, stated rather than hidden:** the oracle reads `include`/`exclude`/`testDir` as **text** from the configs. A config computing its globs dynamically would not be seen. Every config in the repository today declares them literally; `coverage-gate.spec.ts` already relies on the same text-read approach for `provider`.

### `docs:verify` — catches a file that moved

- **Defect:** `git mv apps/web/web-port.{ts,spec.ts} apps/web/src/lib/` while `SSOT.md` cited the old path
- **Command:** `pnpm docs:verify`
- **Observed:** `3 broken reference(s) in 207 checked`, naming all three citations
- **Reverted:** not reverted — the **citations** were corrected to the new path, because the move was the intended change and the stale reference was the defect
- **Kind:** **real behaviour.** The tool proving it still guards `OPS-05` after its own `FIX-25` patches

**Worth recording:** `docs:verify` is the only gate in this repository that caught a _documentation_ drift caused by a code change, and it did so on the same day it was measured green. It is also the cheapest gate in the set. `AUD-30-07`-class identifier drift is what it exists for, and it is currently unblocked by a working implementation.

### `G1-4` / `AUD-30-03` — an assertion with no floor

**RED, by inspection, not yet executed.** `shell.spec.ts` resolves `nav a, header a`; `page.tsx:32-37` renders a `<nav>` holding one `<span>`, and the web app contains no `<a>` element. So `nav.length` is `0` for all four locales and `expect(0).toBe(0)` passes. The expected GREEN is a **failure**: adding `expect(en.length).toBeGreaterThan(0)` must turn this test red on the current tree, and that failure is the evidence the assertion now has teeth. Note that the tagline test nine lines above already carries the correct `not.toBe('')` floor — the author knew the shape of the trap and missed it once.

### `G1-3` / `AUD-30-02` — a gate that exits 0 while running nothing — **CLOSED**

**Status: COMPLETE 2026-09-30.** This entry replaces the _"observed, but it is a green that should be red"_ note that stood here earlier. That observation is now a fix.

```console
$ pnpm test:integration
@eduflow/web:test:integration: $ echo "no web integration suite at P2" && exit 0
@eduflow/api:test:integration: No test files found, exiting with code 0
 Tasks:  5 successful, 5 total
```

**Both shapes are now covered, and neither is visible to `isPassingStub()`.** A script stub is; a config key is not — so the new file needed its own assertion rather than an extension of the existing one.

**RED, genuine, both defects at once.** New `apps/api/src/config/integration-gate.spec.ts`:

```text
× 'apps/web' > does not declare a test:integration that always passes
  → apps/web declares test:integration as "echo "no web integration suite at P2" && exit 0"
    - a script that always exits 0 without running a test. Root pnpm test:integration
    runs turbo over every package, so this reports a green integration gate it does
    not provide. …
× 'apps/api' does not set passWithNoTests
  → apps/api/vitest.integration.config.ts sets passWithNoTests: true. Vitest then exits 0
    when its include glob matches no files …
 Test Files  1 failed (1)
      Tests  2 failed | 6 passed (8)          exit 1
```

**GREEN — the two-line production fix:**

| File                                    | Change                                                                                                                                              |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/package.json`                 | `test:integration` **deleted**. Turbo then skips the package, which is honest: web has no integration tests. The stub claimed it had a passing one. |
| `apps/api/vitest.integration.config.ts` | `passWithNoTests: true` → **`false`**, with the reason written into the file                                                                        |

```console
$ pnpm --filter @eduflow/api exec vitest run src/config/integration-gate.spec.ts
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

**`pnpm test:integration` now exits 1, and that is the intended state:**

```console
$ pnpm test:integration
@eduflow/api:test:integration: No test files found, exiting with code 1
test:integration EXIT = 1
```

**The gate is deliberately left red until `F-7`** supplies the first real integration test against a containerized PostgreSQL. A gate that fails because it has no test yet tells the next developer exactly what is missing; a gate that passes because it has no test yet tells them nothing. `D30`. **Do not set `passWithNoTests` back to `true` to make this green** — the file says so, and `integration-gate.spec.ts` fails if you do.

**The obvious wrong fix is guarded.** Deleting every `test:integration` script would make the new spec pass while `pnpm test:integration` reported success having run nothing — the same hollow gate, reached the other way. A case asserts **at least one package declares an integration gate**, because `AGENTS.md` §4 requires the gate to exist.

**Guard on the guard:** three cases test `isPassingStub()` against a known stub, a known runner invocation, and a real failing command (`vitest run --coverage || exit 1`). A detector that stopped recognising its shape would otherwise make every other case pass without checking anything.

**Case count moved 8 → 7, and that is correct.** `apps/web` no longer declares the script, so its `describe.each` case no longer applies. The remaining coverage moved into the "at least one package declares it" case, which is the assertion that now carries web's absence.

**Full-suite effect:** `@eduflow/api` **93 → 100** tests. Repository total **125 → 132**.

### `B-1` — the shadcn primitives, two RED→GREEN cycles

`AGENTS.md` §3.2.1 bans raw `<button> <input> <select> <textarea> <table> <dialog>`, and `packages/ui-kit/src/components/ui/` was a `.gitkeep`. **The ban had a compliant target nowhere**, so it was unsatisfiable. The story's own list is 11 primitives; this was done in two cycles, because 8 of 11 is not done.

**Cycle 1 — RED before any component existed.** The spec was written first, importing all 8 components, and the failure was a _resolution_ failure — the honest kind, because it proves the modules genuinely do not exist rather than asserting against a stub:

```console
$ pnpm --filter @eduflow/ui-kit exec vitest run
 Error: Failed to resolve import "./badge" from "src/components/ui/primitives.spec.tsx". Does the file exist?
 Test Files  1 failed | 1 passed (2)
```

⚠️ **The first RED also caught a defect I had just introduced.** `index.spec.ts` failed too, with `TypeError: The URL must be of scheme file` ×5. That was **my** `environment: 'jsdom'`: the pre-existing token suite reads CSS via `readFileSync(new URL('./styles.css', import.meta.url))`, and under jsdom `import.meta.url` is an `http://` URL, so `readFileSync` rejects it. **A suite that passed before my change was broken by my change**, and the fix was to scope the DOM rather than edit the passing test: `environment: 'node'` in `vitest.config.ts`, and `// @vitest-environment jsdom` as a docblock in the one file that renders. After the fix: `index.spec.ts` **8/8 green**, components red. That ordering matters — a RED that takes down an unrelated green suite is a RED that has to be diagnosed before it can be trusted.

**Also my error, caught by the same run:** the first `asChild` case asserted `bg-brand` on a `Button` with no `variant`, which renders the _default_ (`bg-surface`). The test was wrong, not the component. Fixed to `variant="brand"`, which is what the case was actually about.

**Cycle 1 GREEN — 25/25.**

**Cycle 2 — the plan lists 11, not 8.** `select`, `dropdown-menu` and `sonner` were missing, and `select` is **not optional**: §3.2.1 bans a raw `<select>`, so without a compliant picker the ban is a dead end for any school choosing language, class, currency or role. RED the same way:

```console
$ pnpm --filter @eduflow/ui-kit exec vitest run
 Error: Failed to resolve import "./select" from "src/components/ui/primitives.spec.tsx". Does the file exist?
```

⚠️ **Cycle 2's first run produced a _false_ result and had to be discarded.** `1 failed | 27 passed (28)` — but alongside it: `Vitest caught 1 unhandled error during the test run. This might cause false positive tests.` The Select case failed with `Unable to find role="listbox"` and the real cause was an **unhandled** `TypeError: target.hasPointerCapture is not a function` thrown from inside Radix. **Vitest can report a suite green while an exception is in flight**, so the "27 passed" was not trustworthy. Two separate fixes, both of which were my bugs:

| Defect                                       | Why                                                                                                                                | Fix                                                                                                                                                                                                                                                                                    |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Element.prototype.hasPointerCapture` absent | jsdom implements Pointer Events dispatch but not the _capture_ methods, and `@radix-ui/react-select` calls it on every pointerdown | Shimmed in `vitest.setup.ts`, guarded on `typeof Element` because the node-environment token suite has no DOM. The shim asserts nothing **on purpose** — these tests assert roles and keyboard access, not pointer bookkeeping, and a fake capture would only make them look thorough. |
| New tests nested inside `describe('Dialog')` | My append landed before the Dialog block's terminator, so a Select case reported as `Dialog > exposes a listbox through Select`    | Closed the `Dialog` describe and gave `Select`, `DropdownMenu` and `Toaster` their own blocks                                                                                                                                                                                          |

**Cycle 2 GREEN — 28/28, no unhandled errors.**

**What the suite asserts, beyond "it renders":**

| Case                                                                                                     | Guards against                                                                                         |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| No component class contains `#`, `rgb(` or `hsl(`                                                        | §3.2.5 being unenforceable, and the `text-white` loophole it opens                                     |
| Brand variant resolves through `bg-brand`                                                                | A component reaching for a raw Tailwind palette instead of the token                                   |
| No component class uses a physical direction utility (`ml-`, `pr-`, `left-`, `rounded-l`, `text-left` …) | §3.2.6; **asserted over all 11 files**, not spot-checked                                               |
| The 44px floor comes from `var(--touch-target-min)`, and the literal `44px` is absent                    | A floor that passes today and diverges the first time the token moves                                  |
| `asChild` gives an `<a>` the full treatment                                                              | Forcing every navigation into a real `<button>` — which is what the landing page had to do before this |
| `Card` renders a heading inside a landmark                                                               | A container with no structure for a screen reader to navigate                                          |
| `Skeleton` is `aria-hidden`                                                                              | Announcing "skeleton" while data loads                                                                 |
| Dialog is closed until triggered, and exposes a dialog                                                   | A modal that exists in the DOM before it is asked for                                                  |
| Select exposes `role="listbox"`, DropdownMenu exposes `role="menuitem"`                                  | Substituting a `div` popup for the semantic role                                                       |
| The **raw-element ban still passes** `ui-primitive-rules.spec.ts` (9 cases)                              | The exemption being written so wide it swallowed the ban — the specific way a fix like this regresses  |

**Full-suite effect:** `@eduflow/ui-kit` **8 → 28** tests. Repository total **141 → 161** (7 shared-types + 100 api + 16 web + 10 i18n-resources + 28 ui-kit).

**Two decisions recorded in code, not just here:** `--on-brand` / `--on-danger` / `--on-accent` were added to `styles.css` because a button needs readable text on `--brand` and `text-white` is a hard-coded colour that the hex-literal rule **cannot see**; and `lucide-react` was **declined** — undeclared in this workspace, and §3.2.6 requires the RTL mirror to be provable, so two inline paths in `icons.tsx` beat a dependency whose default is LTR-only.

### `B-1` gate half — `AGENTS.md` 3.2.1's raw-element ban had **never fired**

**Status: gate FIXED 2026-09-30. `B-1` itself is not done — the primitives are not written yet.**

**The rule, as written, could not reject anything.** `AGENTS.md` §3.2.1 — _"All UI primitives are
shadcn/ui components — no raw `<button>`, `<input>`, `<select>`, `<textarea>`, `<table>`,
`<dialog>`"_ — had three independent defects stacked on top of each other. All three had to be
fixed before it fired once.

| #   | Defect                                       | Why it made the rule dead                                                                                                                                                                                                                                              |
| --- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Selector was `JSXElement[name.name='<tag>']` | **In the ESTree spec a `JSXElement` has no `name` property** — it has `openingElement`, `children`, `closingElement`. The node carrying `name` is `JSXOpeningElement`. The selector matched a property that cannot exist.                                              |
| 2   | Two `no-restricted-syntax` blocks            | The colour block (`files: ['**/*.tsx', '**/*.ts']`) came **after** the raw-element block (`files: ['**/*.tsx']`), and a later flat-config object **replaces** the whole rule array rather than merging. The raw-element patterns were discarded for every `.tsx` file. |
| 3   | `parserOptions: {}` in `base.js`             | Setting `parserOptions` **replaces** what `tseslint.configs.recommended` set. Empty meant **no JSX was produced at all**, so every `JSX…` selector had nothing to match.                                                                                               |

**Why it stayed hidden for three days.** `lint-rules.spec.ts` exercises the **node** config, whose
rules contain no JSX selectors. **No suite had ever executed the _next_ config.** The rule was read
carefully, cited in a WORKLOG entry as the reason the landing page had to be built from links with
no theme toggle, and reported as "real and wired into `apps/web/eslint.config.mjs`" — and it had
never rejected a single line.

**RED, genuine, and it found the rule rather than the exemption:**

```text
Test Files  1 failed (1)
     Tests  4 failed | 5 passed (9)
```

The 4 failures were the exemption cases. Adding the exemption then broke the 4 **consumer** cases,
which is what exposed the overwrite — the ban had been silently replaced.

**Proof against the real toolchain, not the test harness.** A raw `<button>` written to a real
`.tsx` file and linted by the real CLI:

```console
$ pnpm --filter @eduflow/web exec eslint src/lib/probe-raw.tsx
✖ 1 problem (1 error, 0 warnings)
EXIT = 1        # was 0 before all three fixes
```

**The isolation that found defect 1** — five minimal configs against the same source, because three
suspected causes were each individually plausible:

```text
files:["**/*.tsx"] + JSXElement                  -> no messages
files:["**/*.tsx"] + any JSXElement              -> HIT-ANY        <- JSX parsed fine
files:["**/*.tsx"] + JSXOpeningElement[name.name] -> HIT-OPEN       <- the name lives here
no languageOptions at all                        -> Parsing error: Unexpected token <
```

`JSXElement` matched; `JSXElement[name.name=…]` did not. The AST was correct and the selector was
not. Reading the config would not have found this — `AUD-30-01` and `FIX-26` again: a rule that
reads as enforced and is not.

**The primitives exemption** is now in place, scoped to `components/ui/**` under **two** globs
because the config is shared between two working directories — `packages/ui-kit` when it lints
itself, and the repo root or `apps/web` otherwise. An exemption anchored at only one passes
locally and fails in CI. **`AGENTS.md` §3.2.5's colour ban is re-declared rather than switched off**
inside the exemption: a primitive that hard-codes a hex cannot work in both themes, and the
primitives are exactly where that mistake would land. A test asserts it.

**9 cases in `apps/web/src/config/ui-primitive-rules.spec.ts`**, covering: the ban fires for all six
elements; it names the replacement; it still fires in `ui-kit/src/lib` (exemption is scoped to
`components/ui`, not the package); the primitives are exempt from both cwd forms; the colour ban
survives inside a primitive.

**Not yet done:** no `components.json`, no Radix, no primitive written. `B-1` continues.

---

### `A-2` / `FIX-26` — a coverage gate that enforces nothing — **LAST HOLLOW GATE CLOSED**

**Status: COMPLETE 2026-09-30.**

**The defect.** `AGENTS.md` §4's coverage tiers can be perfectly written, correctly quoted and backed by an installed provider, and still enforce nothing, because the glob matches no file. Measured:

| Package    | Tier                       | Threshold | Files matched |
| ---------- | -------------------------- | --------- | ------------- |
| `apps/api` | `src/**/domain/**/*.ts`    | 90 / 85   | **0**         |
| `apps/api` | `src/**/use-cases/**/*.ts` | 90 / 85   | **0**         |
| `apps/api` | `src/**/*.controller.ts`   | 70        | **0**         |
| `apps/web` | `src/**/hooks/**/*.ts`     | 80        | **0**         |
| `apps/web` | `src/**/hooks/**/*.tsx`    | 80        | **0**         |
| `apps/web` | `src/lib/**/*.ts`          | 80        | **LIVE**      |

**Five of six decorative.** The gate had been _proved able to fail_ on 2026-09-29 — but by a temporary probe threshold on a real file, which is a different claim from _"the configured tiers bite"_. That is the `mechanism probe` vs `configured tier` distinction this file's §4 rule 2 exists to draw.

**Sharper than "five empty tiers": `apps/api` had no live tier at all.** It ships real, tested source in `src/config/`, and all three of its tiers point at `domain/`, `use-cases/` or `*.controller.ts` — directories that exist and are empty. So the API's coverage was **ungated**, not merely under-gated.

**RED, genuine, by execution.** Written first as a spec in `coverage-gate.spec.ts`; it went red naming all five globs _and_ the ungated package:

```text
× a configured threshold must match at least one instrumented file
  → 5 of 6 configured coverage tiers match ZERO source files, so they enforce nothing
    while pnpm test:coverage still exits 0:
      apps/api  src/**/domain/**/*.ts
      apps/api  src/**/use-cases/**/*.ts
      apps/api  src/**/*.controller.ts
      apps/web  src/**/hooks/**/*.ts
      apps/web  src/**/hooks/**/*.tsx
 Test Files  1 failed (1)
```

**Moved to `scripts/check-coverage-tiers.mjs`, and the reason is the interesting part.** A failing spec fails **`pnpm test`** — the gate every session runs to answer _"is the product tested?"_. `F-1`, which fixes this, is three epics away. A permanently-red main gate is exactly `D30`: _"a gate left red teaches the next developer to ignore it."_ So the red moved to the gate that **owns the concern**:

| Gate                 | Before     | After          | Reading                                            |
| -------------------- | ---------- | -------------- | -------------------------------------------------- |
| `pnpm test`          | 0          | **0**          | product tests are green, and that means something  |
| `pnpm test:coverage` | 0 — hollow | **1 — honest** | the coverage gate is not yet real, and now says so |

Both signals honest; neither is one anyone learns to ignore.

**Both halves of the evidence observed:**

```console
# with a real file under domain/entities/
$ node scripts/check-coverage-tiers.mjs
4 configured tier(s) match ZERO source files:          # was 5
  apps/api  src/**/use-cases/**/*.ts
  apps/api  src/**/*.controller.ts
  apps/web  src/**/hooks/**/*.ts
  apps/web  src/**/hooks/**/*.tsx
# ...and the "apps/api is ungated" line is GONE          # the check discriminates
```

Reverted, and the full state returned. **The gate is not merely failing — it responds to real code arriving**, which is the difference between a mechanism probe and a configured tier.

**⚠️ Two compile errors on the way, both the same footgun this repository has already recorded.** `WORKLOG.md` `[0.1.0-scaffold]` "Fixed" lists _"a `*/` inside a JSDoc comment that closed it early and parsed the glob as code."_ I wrote a block comment containing a glob table. A recursive glob ends in the two-character sequence **star-slash**, so **any** `**/` terminates the comment. It happened twice — once for the globs, once because my own explanation of the bug contained the sequence. Every comment in the file is now a line comment, with a note saying that a future "tidy" into a block comment will not compile. That is the only reason to prefer the uglier style.

**Wired into both packages:** `"test:coverage": "vitest run --coverage && node ../../scripts/check-coverage-tiers.mjs"`.

**Do not delete a tier to make this green**, and do not set `passWithNoTests` back to `true`. Both messages say so. The fix is `F-1`.

**What is still hollow after this:** the e2e dark-theme branch (`AUD-30-04`) — the theme test only ever asserts `light`, and no theme toggle exists because shadcn does not (`B-1`/`B-2`). `test:coverage` is no longer hollow; it is **red**, which is a different and better state.

**What is still hollow after this:** `test:coverage` (`FIX-26`, tiers match 0 instrumented files) and `format:check` (`FIX-05`, exit 2). Two, down from four.

---

## 3. What to record for each remaining gate

Use this shape. Paste the **actual command** and the **actual output line** — never a paraphrase.

```markdown
### <gate> — <defect introduced>

- **Defect:** <one line, e.g. `Date.now()` in `src/modules/x/domain/entities/y.ts`>
- **Command:** `<exact command>`
- **Observed:** `<exact output, including the exit code>`
- **Reverted:** <yes/no, and how verified>
- **Kind:** mechanism probe | configured tier
```

### Suggested defect per gate

| Gate               | Suggested deliberate defect                                    | Which `AGENTS.md` rule it proves                                                                                       |
| ------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `typecheck`        | a type error inside a `*.spec.ts`                              | `FIX-07` — specs are currently excluded from 4 tsconfigs, so this may **not** go red                                   |
| `lint`             | `import { Injectable } from '@nestjs/common'` inside `domain/` | §2.2 layering                                                                                                          |
| `lint`             | `new Date()` inside `use-cases/`                               | §2.4 `IClock` determinism                                                                                              |
| `lint`             | a raw `<button>` in a `.tsx`                                   | §3.2.1 — ⚠️ **cannot pass until `G3-1` lands shadcn**, since the compliant alternative does not exist                  |
| `test`             | change an asserted value in `ui-kit/src/index.spec.ts`         | that the suite actually asserts                                                                                        |
| `test`             | ~~rename `src/lib/rtl.spec.ts` to a non-`.spec` name~~         | ✅ **`A-3` done — this class is now blocked.** See the `A-3` transcript above                                          |
| `test:coverage`    | ~~lower the `--bg` threshold in `ui-kit`~~                     | ✅ **`A-2` done.** The gate now refuses to pass while any tier matches 0 files, via `scripts/check-coverage-tiers.mjs` |
| `build`            | a `tsconfig` error in the web app                              | that the build is not replaying a stale cache                                                                          |
| `test:integration` | a failing `*.integration.spec.ts`                              | requires `F-7` — a real PostgreSQL (`D34`)                                                                             |
| `test:integration` | ~~add `passWithNoTests: true` back~~                           | ✅ **`A-1` done — guarded by `integration-gate.spec.ts`.** Currently red by design                                     |
| `test:e2e`         | change `layout.tsx` so `/ar` renders `dir="ltr"`               | §3.2.6 RTL                                                                                                             |
| `test:e2e`         | delete one locale's `app.tagline`                              | §2.8 / §4.2 no silent English fallback                                                                                 |
| `docs:verify`      | reference a file that does not exist                           | `OPS-05`                                                                                                               |
| `format:check`     | _already red_ — record the baseline                            | `FIX-05`                                                                                                               |

---

## 4. Rules for this file

1. **Paste real output.** A row with no transcript is not evidence, it is a claim — and this repository already carries a `SSOT.md` full of claims that measurement contradicted.
2. **Record the kind.** `mechanism probe` and `configured tier` are different evidence, and conflating them is how the coverage gate came to be reported green while enforcing nothing.
3. **Revert and re-run.** A gate left red teaches the next developer to ignore it, which is the failure `D30` was written about.
4. **Update it in the same commit as the change** (`AGENTS.md` §9).
5. **This file is what makes EPIC-G4's human gate meaningful.** P3's human gate is the same exercise run through CI instead of a terminal. If the gates cannot go red locally, a CI failure proves nothing either.

---

_Companion: `docs/work/ACTION_PLAN_2026-09-30-v2.md` EPIC-A · `docs/work/ACTION_PLAN_2026-09-30.md` EPIC-G1 · `docs/analysis/CODE_AUDIT_2026-09-30.md` §2 (baseline) and §3 (the four hollow gates) · `docs/core/SSOT.md` §1a and §1b_
