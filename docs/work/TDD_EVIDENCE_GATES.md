# TDD EVIDENCE — the gates can go red

**Purpose:** `ACTION_PLAN_2026-09-30.md` **EPIC-G1** exit criterion.
**Method:** for each gate, introduce one deliberate defect, run the command, **watch it exit non-zero**, revert. Nine commands, nine observed reds.
**Rule:** *verify by running the command, never by reading the config* (`SSOT.md` §8 footguns).

> **A probe is not a tier.** On 2026-09-29 the coverage gate was "proved able to fail" — but by a *temporary probe threshold on a real file*, not by the configured `§4` tiers. A probe proves the mechanism works; a tier that matches nothing proves nothing. That distinction is the reason `FIX-26` is still open. Record which kind of evidence each row has.

---

## 1. Status

| # | Gate | Baseline (clean tree) | Can it go red? | Evidence | Verdict |
| - | ---- | --------------------- | -------------- | -------- | ------- |
| 1 | `pnpm typecheck` | exit **0** | ⬜ **not yet observed** | — | — |
| 2 | `pnpm lint` | exit **0** | ⬜ **not yet observed** | — | — |
| 3 | `pnpm test` | exit **0**, **106** tests | ✅ **1 of 3 observed** | `G1-1` §2, 2026-09-30 | — |
| 4 | `pnpm test:coverage` | exit **0** | ⬜ **not yet observed** | — | ⚠️ **web tier now live** (`G1-1` side effect); api tiers still match 0 files |
| 5 | `pnpm build` | exit **0**, 5/5 | ⬜ **not yet observed** | — | — |
| 6 | `pnpm test:integration` | exit **0** | ⬜ **not yet observed** | — | ❌ **hollow** (`AUD-30-02`) |
| 7 | `pnpm test:e2e` | *not run* | ⬜ **not yet observed** | — | ⚠️ **1 test vacuous** (`AUD-30-03`) |
| 8 | `pnpm format:check` | exit **2** | ✅ **already red** | baseline 2026-09-30 | ✅ **honest** |
| 9 | `pnpm docs:verify` | exit **0**, 207 refs | ✅ **observed 2026-09-30** | §2, "catches a moved file" | ✅ **honest** |

**1 of 9 rows have their deliberate-defect evidence recorded.** Gates 4, 6 and 7 are additionally hollow, which is a *different* failure from "cannot go red" — they exit 0 and would exit 0 regardless of what the application does.

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

**Why this was the strongest RED.** The file was named explicitly on the command line and the runner *still* refused it, because Vitest applies `include` as a filter to explicit arguments. The second command is the proof of silence: the suite reports green, `1 passed (1)`, and that one file is `src/lib/rtl.spec.ts` with its 4 tests. `web-port.spec.ts` — 3 tests guarding the 2026-09-29 port-3000 incident — appeared in no count anywhere.

**GREEN.** Both files moved from the package root to `src/lib/`, colocated per `AGENTS.md` §3 ("one test file per source file"). `playwright.config.ts`'s import updated to `./src/lib/web-port`. The spec's own `dirname(import.meta.url)` — which resolved to the web package *only because the file sat at the root* — replaced with a walk up to the `@eduflow/web` manifest, so the test is position-independent. A hard-coded `../../` would have been a second thing that silently drifts when a file moves, and the whole point of this file is that a test which quietly stops testing is the bug.

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

**⚠️ A footgun hit during this cycle, recorded because it nearly invalidated the RED.** The first attempt to break the port used PowerShell `Set-Content -Encoding utf8`, which **writes a BOM**. The suite went red with exit 1 — but for the *wrong* reason:

```text
[SyntaxError] Unexpected token '﻿', "﻿{
```

That is a parse error, not the port assertion, and per the TDD rule it does not count as valid RED: _"the failure is not caused only by unrelated syntax errors." The file was restored from a byte-exact backup and the break redone with a BOM-free write. **This is the second time in the project that a PowerShell BOM has been the actual cause of a failure** — it is already a recorded footgun (`SSOT.md` §8), and it is the reason the restore path is `Copy-Item` + a BOM assertion rather than a rewrite.

**Side effect, not scope creep.** `apps/web/vitest.config.ts` declares a `src/lib/**/*.ts` coverage threshold. That glob previously matched only a spec file, so it was inert. With a real source file in `src/lib/` it is now live: `web/src/lib` reports **100% statements, 100% branches, 100% functions, 100% lines**. A partial `FIX-26` win for the web package, obtained by fixing the actual defect rather than by editing a config.

**Recurrence is not yet blocked.** `G1-2` — the test-file oracle — is what stops the next `*.spec.ts` being orphaned the same way. This story fixed one instance; `G1-2` fixes the class.

### `docs:verify` — catches a file that moved

- **Defect:** `git mv apps/web/web-port.{ts,spec.ts} apps/web/src/lib/` while `SSOT.md` cited the old path
- **Command:** `pnpm docs:verify`
- **Observed:** `3 broken reference(s) in 207 checked`, naming all three citations
- **Reverted:** not reverted — the **citations** were corrected to the new path, because the move was the intended change and the stale reference was the defect
- **Kind:** **real behaviour.** The tool proving it still guards `OPS-05` after its own `FIX-25` patches

**Worth recording:** `docs:verify` is the only gate in this repository that caught a *documentation* drift caused by a code change, and it did so on the same day it was measured green. It is also the cheapest gate in the set. `AUD-30-07`-class identifier drift is what it exists for, and it is currently unblocked by a working implementation.

### `G1-4` / `AUD-30-03` — an assertion with no floor

**RED, by inspection, not yet executed.** `shell.spec.ts` resolves `nav a, header a`; `page.tsx:32-37` renders a `<nav>` holding one `<span>`, and the web app contains no `<a>` element. So `nav.length` is `0` for all four locales and `expect(0).toBe(0)` passes. The expected GREEN is a **failure**: adding `expect(en.length).toBeGreaterThan(0)` must turn this test red on the current tree, and that failure is the evidence the assertion now has teeth. Note that the tagline test nine lines above already carries the correct `not.toBe('')` floor — the author knew the shape of the trap and missed it once.

### `G1-3` / `AUD-30-02` — a `passWithNoTests` gate

**Observed, but it is a green that should be red:**

```console
$ pnpm test:integration
@eduflow/api:test:integration: No test files found, exiting with code 0
```

`apps/api/vitest.integration.config.ts:15` sets `passWithNoTests: true`. `apps/web/package.json` declares the literal stub `echo "no web integration suite at P2" && exit 0`. Two of two declaring packages report success without running anything, and `e2e-gate.spec.ts` already implements `isPassingStub()` — but only checks `test:e2e`.

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

| Gate | Suggested deliberate defect | Which `AGENTS.md` rule it proves |
| ---- | --------------------------- | --------------------------------- |
| `typecheck` | a type error inside a `*.spec.ts` | `FIX-07` — specs are currently excluded from 4 tsconfigs, so this may **not** go red |
| `lint` | `import { Injectable } from '@nestjs/common'` inside `domain/` | §2.2 layering |
| `lint` | `new Date()` inside `use-cases/` | §2.4 `IClock` determinism |
| `lint` | a raw `<button>` in a `.tsx` | §3.2.1 — ⚠️ **cannot pass until `G3-1` lands shadcn**, since the compliant alternative does not exist |
| `test` | change an asserted value in `ui-kit/src/index.spec.ts` | that the suite actually asserts |
| `test` | rename `src/lib/rtl.spec.ts` to a non-`.spec` name | `G1-2` — proves the oracle is needed |
| `test:coverage` | lower the `--bg` threshold in `ui-kit` | §3.2.5 — **must be a configured tier, not a probe** (`FIX-26`) |
| `build` | a `tsconfig` error in the web app | that the build is not replaying a stale cache |
| `test:integration` | a failing `*.integration.spec.ts` | requires `G5-4` — a real PostgreSQL (`D34`) |
| `test:e2e` | change `layout.tsx` so `/ar` renders `dir="ltr"` | §3.2.6 RTL |
| `test:e2e` | delete one locale's `app.tagline` | §2.8 / §4.2 no silent English fallback |
| `docs:verify` | reference a file that does not exist | `OPS-05` |
| `format:check` | *already red* — record the baseline | `FIX-05` |

---

## 4. Rules for this file

1. **Paste real output.** A row with no transcript is not evidence, it is a claim — and this repository already carries a `SSOT.md` full of claims that measurement contradicted.
2. **Record the kind.** `mechanism probe` and `configured tier` are different evidence, and conflating them is how the coverage gate came to be reported green while enforcing nothing.
3. **Revert and re-run.** A gate left red teaches the next developer to ignore it, which is the failure `D30` was written about.
4. **Update it in the same commit as the change** (`AGENTS.md` §9).
5. **This file is what makes EPIC-G4's human gate meaningful.** P3's human gate is the same exercise run through CI instead of a terminal. If the gates cannot go red locally, a CI failure proves nothing either.

---

_Companion: `docs/work/ACTION_PLAN_2026-09-30.md` EPIC-G1 · `docs/analysis/CODE_AUDIT_2026-09-30.md` §2 (baseline) and §3 (the four hollow gates) · `docs/core/SSOT.md` §1a and §1b_
