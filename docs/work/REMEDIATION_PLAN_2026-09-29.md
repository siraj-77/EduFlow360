# Remediation Plan — 2026-09-29

**Purpose:** the actionable successor to `docs/work/GAP_ANALYSIS_2026-09-28.md`. That document analysed a **pre-scaffold** repository. This one analyses the repository **as it is after `951acec`**, and covers three things the earlier plan could not: a scaffold that turned out to have defects, three broken gates that were reported as green, and two governing documents that are now false.
**Evidence:** `docs/analysis/CODE_AUDIT_2026-09-29.md` — 32 findings, every one observed rather than inferred.
**Precedence:** `AGENTS.md` and ADR-003 > this file. No `PLT-*` or `P*` identifier is renumbered here.

---

## 0. Where the project actually is

| | |
|---|---|
| **Phase** | Prompt Pack **P2 (scaffold) complete.** P0-P2 done. **P3 is 0% delivered** and remains the top engineering priority. |
| **Code** | 262 tracked files, but only **~350 lines of real source**. 147 of the files are `.gitkeep`. |
| **Tests** | **51 passing across 5 files** — genuine, not theatre. |
| **Gates** | **3 of 7 §4 gates fail**, plus `format:check`. `WORKLOG.md:17` says "all gates green". |
| **The one-line truth** | The scaffold is real and mostly good. **The claims made about it are not.** |

### Why EPIC-00 exists at all

Five defects share a single property: **each was invisible to the gate set that was actually run.**

| Defect | Why the gate missed it |
|---|---|
| `test:coverage` cannot run | The gate that would have caught it is the broken one |
| `test:e2e` has no tests | `playwright.config.ts` has an empty `testDir`, and "no tests found" was never triaged as a failure |
| compose file is invalid YAML | The gate set contains **no compose-config parse** |
| `proxy.ts` is dead code | The build passes because `generateStaticParams` hard-codes the 4 locales |
| no CI | The gates that *do* run, run locally — for one developer |

The pattern is that a gate was marked done on the strength of a *config file existing*, not on the gate *running*. EPIC-00's exit criterion is therefore stated as observed output, never as intent.

---

## 1. Decisions taken 2026-09-29

Six conflicts were put to the owner; all six answered with the recommended option. Recorded in `docs/work/WORKLOG.md` 2026-09-29 and flagged for later review. **These are agent recommendations ratified by the owner, not prior precedent.**

| ID | Question | Decision | Rationale |
|---|---|---|---|
| **D27** | Test runner: `AGENTS.md §3.1` says Jest, scaffold ships Vitest | **Vitest. Amend the documents. ADR-020.** | Vitest is installed, configured, 51 tests pass, and it is compatible with the ESLint 9 flat config the scaffold depends on. Migrating backwards is pure cost for no gain. **The §3.1 amendment is BLOCKED** — see §5 ⚑A |
| **D28** | `AGENTS.md §6` publishes five invented corpus figures | **Delete the figures. State the stubs are empty.** | 16 KB of stub cannot hold 139 modules. Independently enumerating `SRS §3` yields **87** FRs, not 73. Substituting 87 without performing the extraction would be a *second* invention, which is the exact failure mode `docs/idea-bank/README.md` was written to prevent |
| **D29** | `next-intl` was added though `AGENTS.md:214` says "confirm before adding" | **Ratify. ADR-021.** | It is one of the two options `AGENTS.md:214` names, it is wired correctly, and 4 locales already pass a 10-case parity suite. The defect was procedural, not technical |
| **D30** | Fix the broken gates now, or fold into P3? | **Fix now.** | `AGENTS.md §4` says no production code merges without all green. FIX-01 and FIX-04 are a `package.json` line and a spec file. Leaving them red means every future CI run inherits a red baseline and learns to ignore it |
| **D31** | Next 15 or 16? `proxy.ts` implies 16; `package.json` pins `^15.1.3` | **Rename `proxy.ts` → `middleware.ts` on Next 15.** | 15.5.26 is the installed, tested version. A framework major upgrade is a separate, larger change that deserves its own decision. The rename is one file |
| **D32** | `env.ts` is entirely optional; `AGENTS.md §11` says "no silent defaults" | **Keep the ADR-019 third state. Remove the `??` default in `main.ts` now.** | ADR-019's `persistence: 'disabled'` is a *third state* — not a default, not a failure — so §11 is satisfied rather than relaxed. But `main.ts:23`'s `?? 'http://localhost:3000'` is an **unargued silent default** and has no such justification. Different thing, so it gets a different answer |

**Not covered by D27-D32:** the `Money` `bigint` → JSON boundary (DOC-08). Proposed as ADR-024, **undecided** — see EPIC-ADR.

---

## EPIC-00 — Make the scaffold honest · 21 pts

*Do this before anything else. Every later epic inherits this baseline.*

### Stories

| Story | Pts | Task | Acceptance criteria | Closes |
|---|---|---|---|---|
| **FIX-01** | 2 | Add `@vitest/coverage-v8` to all 5 test-bearing packages; prove the gate can fail | `pnpm test:coverage` exits 0 **and** a deliberately-inflated threshold makes it exit non-zero | FIX-01 |
| **FIX-02** | 3 | One real e2e spec: 4 locales render, `/ar` has `dir="rtl"`, tokens applied, theme present | `pnpm test:e2e` exits 0 with ≥ 4 passing assertions | FIX-02 |
| **FIX-03** | 1 | `docker-compose.yml`: `#` comments not `/** */`; pin `minio` and `mailpit`; bootstrap the `eduflow` bucket | a strict YAML parse succeeds; all 4 services healthchecked; no `:latest` | FIX-03, FIX-17 |
| **FIX-04** | 1 | `apps/web/proxy.ts` → `middleware.ts`; wire `createMiddleware` locale negotiation | `middleware-manifest.json` is non-empty; `/` redirects to `/en`; `Accept-Language: ar` → `/ar` | FIX-04 |
| **FIX-05** | 2 | `pnpm format` across 60 files; repair the 2 mojibake `package.json` entries | `pnpm format:check` exits 0; `od -c` shows `C3 A2 E2 82 AC E2 80 9C` gone | FIX-05, FIX-17 |
| **FIX-06** | 2 | `turbo.json` `globalDependencies` → real paths; add `scripts` to `packages/config`; drop bogus `outputs` | editing `packages/config/tsconfig.base.json` busts the cache; `@eduflow/config#lint` appears in the run | FIX-06, FIX-20 |
| **FIX-07** | 1 | Remove `**/*.spec.ts` from the 5 `exclude` arrays | `tsc --listFiles \| grep -c spec.ts` > 0 | FIX-07 |
| **FIX-08** | 2 | `main.ts`: drop the `??` on `WEB_ORIGIN`; add `WEB_ORIGIN` and `NEXT_PUBLIC_API_URL` to the `env.ts` schema | a typo in `WEB_ORIGIN` fails startup **naming the variable**; no `??` on an env read remains | FIX-08 |
| **FIX-09** | 1 | `src/modules/modules/` → `src/modules/registry/`; anchor the `eslint/node.js` globs to `apps/api/src/modules/*/` | no path is literally `modules/modules` | FIX-09 |
| **FIX-10** | 3 | `ThemeToggle` (writes `localStorage['eduflow-theme']`; keys already exist in 4 locales) + `loading.tsx`, `error.tsx`, `not-found.tsx` | one-click toggle works; verified in both themes and RTL | FIX-10 |
| **FIX-11** | 3 | Initialise shadcn/ui in `packages/ui-kit`; add the primitives the ban forces: `button` `input` `card` `table` `dialog` `select` `textarea` `skeleton` `sheet` `scroll-area` | `ui/` populated; a screen can be built without tripping the raw-element ban; `react` in `dependencies` | FIX-11 |
| **FIX-25** | 1 | Make `docs-verify.mjs` strip a trailing `:NN` from a reference before resolving it — **third reactive patch to the same tool for the same class of problem** | `` `docs/x.md:3` `` and `` `docs/x.md` `` both resolve | FIX-25 |

### Ordering constraint

**FIX-11 must land before P3's human gate.** That gate requires a raw `<button>` to fail CI, and therefore requires a compliant `<Button>` to exist for the passing half. Building the check first means the check cannot be demonstrated.

**FIX-25 is a low-risk, high-value patch.** `docs-verify.mjs` is the repository's only live documentation gate, and it has now failed three times for three different prose conventions it could tolerate. Each failure was correct behaviour on a reference the tool was never designed to accept, which means the failure mode is *prose author discomfort* rather than *documentation error* — the wrong signal.

### Definition of Done

All 7 `AGENTS.md §4` gates exit 0, **plus** `pnpm format:check` and `pnpm docs:verify`. Each verified by running the command, not by reading the config.

---

## EPIC-DOC — Correct the governing documents · 18 pts

*Doc-only. TDD-exempt by nature — a document has no runtime behaviour to test. The verification here is `pnpm docs:verify` plus a re-read.*

| Story | Pts | Task | Closes |
|---|---|---|---|
| **DOC-01** | 3 | `AGENTS.md §6` — delete the five invented figures; state the stubs are empty; record the real 87-FR count | DOC-01 |
| **DOC-02** | 2 | `AGENTS.md:8,17` — status → "scaffolded (P2 complete); no business logic" | DOC-02 · **BLOCKED, see §5 ⚑B** |
| **DOC-03** | 3 | `SSOT.md` — rewrite §3 as a real inventory; fix the `:70` orphan claim; bump the header; de-duplicate GAP-05; replace the gate table with today's true results | DOC-03 |
| **DOC-04** | 2 | `TODO.md` — delete the duplicated `:87-110` and `:175` blocks; strike the three false "the test runner does not exist" claims | DOC-06 |
| **DOC-05** | 2 | `PLATFORM_CORE_PLAN.md` §3.1/§8 — mark the toolchain/skeleton rows done; correct `:53,94,133`; restate `:139` as **unresolved** pending an `SRS §24` amendment | DOC-07 |
| **DOC-06** | 1 | `GAP_ANALYSIS` — add a dated "Delta 2026-09-29" row set; annotate `:285`'s false figures | DOC-04 |
| **DOC-07** | 2 | `ARCHITECTURE.md` — add the missing coverage, CI/CD, per-school deployment-topology and error-handling sections; correct the `:343,346,351` overclaims | FIX-18, FIX-19 |
| **DOC-08** | 2 | `adr/README.md:52` — replace "**No ADR is `Accepted`**" with a per-ADR status column | DOC-05 |
| **DOC-09** | 1 | Strike `AGENTS.md §7`'s answered "reconcile if they differ" note | §6 of the audit |

**What is deliberately *not* done:** `AGENTS.md` §2, §3 and §13 are not touched, per standing instruction. That blocks DOC-02 and the §3.1 half of DOC-01/D27. See §5.

---

## EPIC-ADR — Record the un-ADR'd decisions · 8 pts

`docs/adr/README.md:94-102` requires an ADR for anything *"expensive to reverse, constrains future work, or non-obvious enough that a competent engineer would plausibly have chosen differently."* Four decisions cleared that bar while living only in SSOT/WORKLOG.

| Story | Pts | ADR | Status |
|---|---|---|---|
| **ADR-020** | 2 | Test runner is Vitest. Amends `AGENTS.md §3.1`, `SRS §10`, `ARCHITECTURE.md:351` | **D27 — decided.** Amendment itself blocked, see §5 ⚑A |
| **ADR-021** | 2 | `next-intl` ratified for web | **D29 — decided** |
| **ADR-022** | 2 | `eslint-config-next` rejected; React-hooks rules vendored directly | **D25 — decided, needs writing down** |
| **ADR-023** | 1 | Toolchain versions: Tailwind v4, Node ≥ 22, Prisma, Nest, Next | **D24 — decided, needs writing down** |
| **ADR-024** | 1 | `Money` crosses the wire as a decimal **string**; `Money` moves behind a `MoneyDto` so `shared-types` never ships a raw `bigint` | ⚑ **UNDECIDED** — closes DOC-08 |

---

## EPIC-P3 — Prompt Pack P3 · 34 pts · unchanged, still the top priority

Untouched by this audit. The blockers it was always meant to fix are FIX-12 and FIX-13.

`check-route-guards` (TypeScript AST; two-way allowlist per ADR-018) · `check-i18n` · `check-worklog` · gitleaks + dependency audit · lint-staged + commit-msg hook · the CI pipeline · vendored React-hooks rules · **the human gate** — a dummy PR containing (a) an unguarded route, (b) a `new Date()` in a use-case, (c) a raw `<button>`, (d) a missing i18n key. **Each must fail CI, then pass.**

---

## EPIC-REQ — Extract the requirements · 34 pts

Unblocked by nothing, de-risks everything. The Prompt Pack greps these files before **every** story.

`REQ-01` `module-inventory.md`, cross-checked against Master Plan §29's verified 30-row table · `REQ-02` `domain-entities.md`, each entry stating whether an §2.9 equivalent already exists · `REQ-03` `business-rules.md`, **every rule carrying a source citation and a test target** — this is what makes the §4.1 table-driven tests writable rather than guessed · `REQ-04` `fr-index.md`, the real 87 FRs with `§` citations · `REQ-05` edge-cases.

**Standing rule from D28:** where the corpus is silent, record `GAP — needs design (PC-xxx)`. Never invent a figure to fill a table.

---

## EPIC-ARC — Contracts and enforcement · 42 pts

`ARC-01` `IClock` + id-generator · `ARC-02` guard shapes (consumes P3's checker) · `ARC-03` `ARCHITECTURE.md` boundary rules · `ARC-04` RBAC matrix fixture (`PLT-205`, blocks P6) · `ARC-05` correlation-ID interceptor + redaction · `ARC-06` Money VO + journal-balance invariant · `ARC-07` typed error hierarchy + global filter · `ARC-08` `directives/`.

**`ARC-06` is now front-loaded by ADR-024.** `ADR-002:48` says the serialisation boundary *"must be designed in ARC-06, not discovered later"* — yet `Money{amountMinor: bigint}` already ships in a cross-app contract with a passing test. The dependency was invisible because it was never written down as an entry condition.

---

## EPIC-DSN — Close the open questions · 21 pts

`⚑2` archive corpus · `⚑8` PC-000…PC-006 · `⚑9` mobile in MVP (**⚑C**) · **`⚑D` SRS §24 Gate M2** · `⚑11` `PLT-107` setup token (**⚑E**) · `⚑F` Node 22-vs-26 · ADR-024 `Money` wire format · `schoolId` retention policy.

---

## EPIC-OPS — Operations · 34 pts

`OPS-01` integration harness — currently a **vacuous pass** (0 tests, exit 0) · `OPS-02` `infra/ci/` · `OPS-03` real coverage enforcement · `OPS-06` per-school provisioning + licence binding, including *"migrations applied per school database"* which `AGENTS.md §2.1` requires and no document currently owns.

---

## 3. Critical path

```
FIX-01 ──► coverage gate can run ──┐
FIX-04 ──► proxy dead code fixed ──┤
FIX-03 ──► compose parses ─────────┤
                                  ├──► P3 CI (34) ──► ARC-02 ──► P4 ERD ──► P5 PLT-101
DOC-01..09 (doc-only, parallel) ───┤        ▲                          │
                                  │        │                          ▼
FIX-11 ──► shadcn/ui exists ───────┘────────┘ must precede     P4W ──► P6 RBAC
                                     the raw-<button>                  (needs ARC-04)
                                     human-gate case
```

**The single highest-leverage move is FIX-01 → FIX-02 → P3.** Until coverage runs and CI exists, `AGENTS.md §2`'s entire guarantee set is a suggestion, and the TDD RED gate cannot be evidenced to anyone but the developer running it.

**The longest pole is the ERD** (D22, deferred). It needs no code and no Docker. Everything in P4 onward waits on it.

---

## 4. How this plan is executed

Per `AGENTS.md §4.1` and the `test-driven-development` / `tdd-workflow` skills:

- **No production change without a RED gate that was watched fail**, for the right reason. The failing output is quoted before the implementation is written.
- One story at a time. Report after each.
- One commit for RED, one for GREEN, optional one for refactor. Not squashed.
- `docs/work/WORKLOG.md` and `docs/work/TODO.md` updated **in the same commit** as the change (`AGENTS.md` §9).
- Doc-only stories are TDD-exempt — their verification is `pnpm docs:verify` plus a re-read.

**Exception, stated explicitly:** FIX-05 (`pnpm format`) and FIX-06 (`turbo.json`) are pure configuration with no runtime behaviour. Per the TDD skill's own guidance, exceptions require the human partner's say-so — recorded here, and both are verified by running the affected gate rather than by a test.

---

## 5. Still blocked

| # | Blocked item | Why | Unblock needs |
|---|---|---|---|
| **⚑A** | The `AGENTS.md §3.1` Jest→Vitest amendment (D27) | §3.1 is inside §3, and the standing instruction is **do not touch `AGENTS.md` §2/§3/§13** | A per-line go-ahead on `AGENTS.md` §3.1 only. ADR-020 records the amendment as required-but-unapplied, so the decision is not lost |
| **⚑B** | `AGENTS.md:8,17` status correction (DOC-02) | D14 — `AGENTS.md` corrections need owner approval | Owner approval. These lines are in the preamble and §1, **not** in §2/§3/§13, so this is D14 rather than the standing restriction |
| **⚑C** | `SRS §19` vs `AGENTS.md §7` on mobile | Three documents, two positions (`ADR-005`, ⚑9) | Owner decision — option C recommended |
| **⚑D** | `SRS §24` Gate M2 vs the P0-P14 order | The reorder relabels "Foundation Complete"; it does not move the gate | An `SRS §24` amendment |
| **⚑E** | `PLT-107` first-admin bootstrap | A fresh deployment currently has **no way to create its first administrator** | Story approval (⚑11) |
| **⚑F** | `.nvmrc` = 22 vs local runtime 26.7.0 | CI reproducibility | Confirm the floor |
| **⚑G** | ADR-024 `Money` wire format | DOC-08 | Owner decision |

---

## 6. What this plan deliberately does not do

- **No `PLT-*` or `P*` renumbering** (`AGENTS.md` §13). New work is `FIX-nn`, `DOC-nn`, `ADR-0nn`.
- **No tenancy machinery**, no second engine, no direct journal or audit writes (`AGENTS.md` §2.1, §2.9, §13).
- **No `apps/mobile`** — milestone 2 (D5, ADR-005).
- **No ERD.** Still deferred by D22. EPIC-ARC and P4 wait on it, and inventing one is the specific failure `AGENTS.md §6` names.
- **No invented requirements.** The idea-bank stays empty until `REQ-01…05` runs against a real source.
- **No change to `AGENTS.md` §2, §3 or §13.**

---

*Companion documents: `docs/analysis/CODE_AUDIT_2026-09-29.md` (evidence) · `docs/work/GAP_ANALYSIS_2026-09-28.md` (pre-scaffold baseline) · `docs/work/PLATFORM_CORE_PLAN.md` (milestone-1 execution) · `docs/core/SSOT.md` (state of record) · `docs/work/TODO.md` (next task) · `docs/work/WORKLOG.md` (activity log).*
