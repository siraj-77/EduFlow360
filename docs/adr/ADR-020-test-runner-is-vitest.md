# ADR-020 — The Test Runner Is Vitest, Not Jest

**Status:** ✅ **Accepted 2026-09-30 (owner) — the `AGENTS.md` §3.1 amendment is still outstanding**
**Date:** 2026-09-29
**Deciders:** Owner, 2026-09-29 (D27) — agent-recommended, owner-ratified
**Affects:** every test in the repository · `AGENTS.md` §3.1 · `SRS` §10 · `ARCHITECTURE.md:351`
**Resolves:** the six-document contradiction catalogued as FIX-14

---

## Context

`AGENTS.md` §3.1 fixes the stack in a table:

> `| Testing | Jest, React Testing Library, Playwright (web), Detox (mobile) |`

Four other documents repeat it: `SRS` §10 carries **six** separate Jest rows (unit, backend, frontend, mobile, contract, coverage via `Istanbul`/`nyc`); `ARCHITECTURE.md:351` says coverage thresholds come from _"Jest `coverageThreshold` per path glob"_; `GAP_ANALYSIS:354` and `PLATFORM_CORE_PLAN.md:53` list _"Jest, RTL, MSW"_ as the harness; `TODO.md:93` (`REPO-05`) does the same.

**The repository ships Vitest.** `apps/api/package.json` and `apps/web/package.json` both declare `"test": "vitest run"` and `"vitest": "^2.1.8"`. There is no Jest config, no Jest dependency, and no Jest anywhere. All 51 tests run on Vitest 2.1.9. Coverage thresholds are already written in Vitest's `coverageThreshold` form at `apps/api/vitest.config.ts:15-27` and `apps/web/vitest.config.ts:26-30`, and they match `AGENTS.md` §4's tiers exactly.

So the governing contract, read in full before every session, instructs an agent to build on a test runner the project does not use. The most likely concrete failure: an agent reading `AGENTS.md` §3.1 installs Jest, and a second runner silently takes over half the suite.

Two further facts pushed the same way. `eslint-config-next` was rejected (D25) because it _"patches ESLint internals and fails against ESLint 9.39"_; Jest's ecosystem packages carry the same maintenance burden against ESLint 9, so a Jest path would be a recurring tax. And `docs/adr/README.md:98` requires an ADR for any decision that is _"non-obvious enough that a competent engineer would plausibly have chosen differently"_ — this is exactly such a decision, and it was made inside a commit without one.

## Decision

**Vitest is the test runner. The documents are amended to match the code, not the reverse.**

- `vitest run` for unit and component tests; `vitest run --coverage` for the coverage gate.
- `@vitest/coverage-v8` is a **required** dev dependency in all five test-bearing packages. Its absence is what makes `pnpm test:coverage` exit 1 today (FIX-01), so it is pinned explicitly rather than assumed.
- Playwright remains the E2E runner, as `AGENTS.md` §3.1 already says and as the scaffold already installs.
- Detox remains the mobile runner for milestone 2 (`D5`, `ADR-005`). Unaffected.
- React Testing Library is already present for the web (`@testing-library/jest-dom` in `apps/web/vitest.setup.ts:1`) and is unaffected — it is a library, not a runner. `AGENTS.md` §3.1's "React Testing Library" clause stays correct.
- `MSW` is named in `GAP_ANALYSIS` and `TODO.md` but is **not** in `AGENTS.md` §3.1 and is not installed. It is deferred to the story that first mocks an HTTP boundary; it does not constrain this decision.

### The three amendments required

| Document          | Line | From                                                            | To                                                                |
| ----------------- | ---- | --------------------------------------------------------------- | ----------------------------------------------------------------- |
| `AGENTS.md`       | §3.1 | `Jest, React Testing Library, Playwright (web), Detox (mobile)` | `Vitest, React Testing Library, Playwright (web), Detox (mobile)` |
| `SRS`             | §10  | six Jest rows, `Istanbul`/`nyc`                                 | Vitest, `@vitest/coverage-v8`                                     |
| `ARCHITECTURE.md` | :351 | `Jest coverageThreshold per path glob`                          | `Vitest coverageThreshold per path glob`                          |

## Blocked

**The `AGENTS.md` §3.1 amendment has not been applied.** The standing instruction for this session is _"do not touch `AGENTS.md` §2/§3/§13"_, and §3.1 sits inside §3. `SRS` §10 and `ARCHITECTURE.md:351` are unblocked and may be amended freely.

`SRS` §10 is a **historical corpus document** (SRS v1.2, archived planning). Amending a historical record is arguably the wrong move in itself; the cleaner treatment is a supersession note pointing at this ADR, leaving the original text intact as the record of what was planned. **Owner to choose** between the two.

The decision itself is recorded and not lost. The mismatch is a known, dated, owned defect — not a silent one.

## Consequences

### Positive

- The contract stops lying. Five documents and the code now describe the same runner.
- The coverage tiers `AGENTS.md` §4 mandates are already expressed in Vitest's own syntax — no translation layer, no lossy mapping.
- The decision is discoverable at the point where it matters, which is what an ADR is for.
- `SRS` §12's coverage thresholds (90/85 domain and use-cases, 70 controllers, 80 frontend hooks) need **no** change; they were runner-agnostic in wording all along.

### Negative / accepted costs

- **Vitest has a smaller ecosystem than Jest.** The specific risk is MSW and any future transformer. Acceptable at the current size: 5 test files, 51 tests.
- **One edit is deferred** (§3.1), so the contradiction is reduced, not eliminated. It stays on the ⚑ list until explicitly cleared.
- D27 was reached by an agent recommendation, not by the owner independently weighing the two runners. It is flagged for later review on that basis.

### Neutral

- No test file changes. All 51 tests are runner-agnostic and pass either way in principle.
- No change to `AGENTS.md` §4, which names commands, not runners.
- No change to `PLT-*` or `P*` identifiers.

## Rejected alternatives

**❌ Migrate the repository to Jest to match `AGENTS.md`.** Rejected: 51 passing tests and three working `vitest.config.ts` files would be rewritten to satisfy a document. The cost is real and the benefit is nil — nothing about the product improves. Worse, Jest's transformer story against ESLint 9 is the same problem that made `eslint-config-next` unusable (D25), so this would import a known recurring failure.

**❌ Leave the mismatch undocumented.** Rejected: this is the state the repository was in when the audit ran. `AGENTS.md §3.1` is the first thing read, before any file is opened, so a reader forms a wrong model of the toolchain before they can encounter evidence. The whole point of an ADR is to make a non-obvious decision legible at the moment someone would otherwise reverse it.

**❌ Amend `AGENTS.md §3.1` anyway, treating D27 as sufficient authority.** Rejected: the standing instruction for this session explicitly protects §2, §3 and §13, and D27 authorises the _decision_, not a blanket override of that restriction. The amendment is recorded as blocked rather than applied unilaterally.

**❌ Use both runners.** Rejected: two runners means two coverage reporters, two transform pipelines, and an ambiguous answer to "did this file's tests run". `AGENTS.md §4.3` requires a test count to be evidence; two runners make it untrustworthy.

## The tested contract

A runner decision is only real if it is executable. `packages/config`'s `eslint/node.js` and the three `vitest.config.ts` files are already covered by `apps/api/src/config/lint-rules.spec.ts` (14 cases) and the four package `*.spec.ts` files. The **coverage gate itself** was not — `pnpm test:coverage` exited 1 on a missing dependency (FIX-01) and no threshold had ever been observed failing. ADR-020's acceptance test is therefore FIX-01: the gate runs, and an inflated threshold makes it fail.

## Links

- `AGENTS.md` §3.1 (**blocked**), §4 (the seven gates, runner-agnostic)
- `SRS` §10 (**superseded by this ADR**), §12 (coverage tiers — unchanged)
- `ARCHITECTURE.md:351` — **amend to** `Vitest coverageThreshold`
- `docs/analysis/CODE_AUDIT_2026-09-29.md` FIX-14
- `docs/work/REMEDIATION_PLAN_2026-09-29.md` EPIC-ADR
- `SSOT.md` D27 · `WORKLOG.md` 2026-09-29
- `D25` (`eslint-config-next` rejected) — the same ESLint 9 pressure

## Revisit when

- MSW or a Vitest-incompatible transformer becomes a genuine blocker. At that point the question is real and should be re-opened with evidence, not with a preference.
- The `AGENTS.md` §3.1 amendment is unblocked (⚑A), at which point this ADR's §"Blocked" section closes.
