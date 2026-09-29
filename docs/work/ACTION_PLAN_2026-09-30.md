# ACTION PLAN — 2026-09-30

**Governs:** the gap between the 2026-09-29 scaffold state and `PLT-EPIC-01`.
**Companion to:** `docs/analysis/CODE_AUDIT_2026-09-30.md` (the measurements this plan is built on), `docs/core/EduFlow_Agentic_Prompt_Pack_PlatformCore_v1.md` (P0–P14, unchanged and still authoritative from P3 onward), `docs/work/REMEDIATION_PLAN_2026-09-29.md` (superseded by this file for EPIC-00 and EPIC-DOC scope).
**Precedence:** `AGENTS.md` + `ADR-003` > `docs/core/SSOT.md` > this file.
**Method:** every task is TDD — RED observed before GREEN (`AGENTS.md §4.1`). Points use the corpus scale.

---

## 0. The argument for the ordering

The 2026-09-28 gap analysis was right: no toolchain, no tests, no git, therefore no code. That is solved. The Prompt Pack's own answer is **P2 → P3**, and P3 is *"Quality gates & CI — the rules become executable"*, described in the pack as *"the most valuable safety net in the project."*

The temptation now is to skip P3 and start `PLT-EPIC-01`, because the scaffolding feels finished and the stories feel urgent. **That would repeat the exact failure this plan exists to prevent.** The audit found four gates that are green and verify nothing — a dead test, a hollow integration suite, a vacuous nav assertion, a theme test that only proves light. Every one is invisible to a developer reading the config, and visible only on execution. The corpus already names the pattern: *"A gate marked `[x]` on the strength of a config file existing is not a gate that passed."*

So the plan is not "fix docs, then build features." It is:

1. **Commit what exists.** 27 files of finished, TDD-checkpointed work are in the working tree only.
2. **Make the gates honest.** A green gate must be able to go red.
3. **Make the record accurate.** The documents that exist to correct the record are carrying the errors.
4. **Then, and only then, P3 and the P-sequence.**

Waves 0–3 are roughly 60 points. They unblock roughly 190.

---

## EPIC-G0 — Commit the work that exists · 1 pt · **START HERE**

**Why this is first and is not optional.** `SSOT.md:16` says *"8 commits, working tree clean."* Measured: **14 commits, 15 modified, 12 untracked.** The entire ARC-01 ERD, the FIX-01/02/22 fixes, the 11-test e2e suite and every doc change from the last 24 hours exist only in the working tree. `AGENTS.md §9` makes the worklog part of the commit, and a TDD checkpoint that is never committed is not a checkpoint.

| # | Task | Acceptance criteria |
| --- | --- | --- |
| **G0-1** | Stage and commit the 27 uncommitted files as the ARC-01 / FIX-01 / FIX-02 / FIX-22 checkpoints, in the order the WORKLOG records them. | `git status --porcelain` empty. `git log --oneline` shows the 5 checkpoint commits the WORKLOG claims are green. `pnpm test` still exits 0 afterwards. **No amend, no squash** — the RED/GREEN pairs are the evidence. |

**Exit criterion:** clean tree, and `SSOT.md §1` corrected to the real counts (EPIC-G2).

---

## EPIC-G1 — Make the gates honest · 23 pts · **the highest-leverage work in the repository**

**Goal:** every gate in `AGENTS.md §4` can go red, and every gate that reports green is doing so because of something real.

This is the load-bearing epic. Its exit criterion is a **negative** test, which is rare and therefore valuable: *deliberately break each gate, watch it fail, fix it.* The Prompt Pack calls this the *human gate* and calls it the most valuable safety net in the project. This epic is its rehearsal.

| # | Story | Pts | Closes | Acceptance criteria |
| --- | --- | --- | --- | --- |
| **G1-1** | `web-port.spec.ts` runs | 2 | `AUD-30-01` | **RED first:** `pnpm --filter @eduflow/web exec vitest run web-port.spec.ts` → `No test files found, exiting with code 1`. Already observed 2026-09-30. **GREEN:** move the file under `src/` (recommended — `web-port.ts` moves with it, or is imported from there) or extend `vitest.config.ts:15` `include`. The 3 tests execute; `@eduflow/web:test` reports **7 tests / 2 files**; `pnpm test` reports **106**. **Then break it:** change `--port 3500` to `--port 3000` in `dev`, confirm a red, revert. |
| **G1-2** | Test-file oracle | 3 | `AUD-30-01` class | Every `*.spec.ts` under a workspace package is inside its `include` globs. RED-first: the oracle enumerates spec files on disk, parses each `vitest.config.*` `include`, and fails on any file no glob matches — **`web-port.spec.ts` must be the first thing it reports.** This generalises the `coverage-gate.spec.ts` "guard on the guard" pattern, and it is what makes G1-1's class of defect non-recurring. |
| **G1-3** | Integration gate guards | 2 | `AUD-30-02` | Two assertions, mirroring the working `isPassingStub()` in `e2e-gate.spec.ts`: **(a)** no package declares a `test:integration` that matches `exit 0` without a runner — `apps/web`'s `echo "no web integration suite at P2" && exit 0` is the first thing it reports; **(b)** any `vitest.integration.config.ts` with `passWithNoTests: true` and zero `*.integration.spec.ts` files is a failure, not a pass. RED observed against today's tree, GREEN after. |
| **G1-4** | Nav-parity floor | 1 | `AUD-30-03` | `shell.spec.ts` asserts `expect(en.length).toBeGreaterThan(0)` before the parity loop, with a message naming the cause. **RED first:** it must fail today, because `page.tsx` renders zero `<a>` elements — that failure *is* the evidence the test now has teeth. Then build real `<Link>` navigation, or, if the shell legitimately has none yet, mark the test `test.fixme` with the reason. **It must not stay green while proving nothing.** |
| **G1-5** | Dark theme e2e | 2 | `AUD-30-04` | A `test.describe` with `test.use({ colorScheme: 'dark' })` asserting `data-theme="dark"` **and** that `getComputedStyle(document.documentElement).getPropertyValue('--bg')` equals the dark value `#0d0f16` on the **rendered** document. RED first — the suite has no dark path at all today. Extend to `/ar` so dark × RTL is covered together. |
| **G1-6** | Coverage globs bite | 4 | `FIX-26` | `apps/api/vitest.config.ts` globs resolve against the real tree. **RED first:** a deliberately wrong threshold on `src/config/env.ts` must exit 1. Add a `src/**/config/**/*.ts` and `src/main.ts` tier so the already-97.68%-covered files sit inside a threshold, and add a test asserting every configured glob matches at least one instrumented file — a glob matching nothing is a defect, exactly as a stub script is. Web: same for `src/lib/**` plus a `src/app/**` tier, which turns today's **0%** into a real failure. |
| **G1-7** | `format:check` green | 2 | `FIX-05` | `pnpm format:check` exits 0. 60 files, **including `AGENTS.md` itself** — reformatting the governing contract needs owner approval (`D14`), so either ask, or scope Prettier to exclude `AGENTS.md` **and record why in the config**. Re-run `docs:verify` afterwards, because formatting shifts line numbers. |
| **G1-8** | `packages/config` gets a gate | 2 | `AUD-30-05` | `packages/config/package.json` gains `lint` and `typecheck`; `turbo run lint` reports 7 packages, not 6. The package that exports every ESLint config and the base tsconfig is itself linted and type-checked. **RED first:** introduce a deliberate error in `eslint/node.js` and confirm nothing catches it today. |
| **G1-9** | `turbo.json` + tsconfigs | 2 | `FIX-06`, `FIX-07` | `globalDependencies` names `packages/config/tsconfig.base.json` — it is not at the root. Remove `**/*.spec.ts` from the **4** excludes (`apps/api`, `shared-types`, `ui-kit`, `i18n-resources`; *not* 5 — `apps/web` has none) so specs are type-checked. **RED first:** a type error inside a spec must fail `pnpm typecheck` today and not afterwards. |
| **G1-10** | Compose file parses | 1 | `FIX-03`, `FIX-17` | `infra/docker/docker-compose.yml` is valid YAML — remove the `/** */` block from line 1 and move the prose into `#` comments. Pin `minio/minio` and `axllent/mailpit` (currently `:latest`, an unpinned supply-chain variable). Add the MinIO bucket bootstrap. **RED first:** a test that runs `yaml.parse` on the file and asserts four named services — it fails today on a parse error. |
| **G1-11** | No silent defaults | 1 | `FIX-08` | `main.ts:23`'s `?? 'http://localhost:3500'` is removed; `WEB_ORIGIN` and `NEXT_PUBLIC_API_URL` are validated by `env.ts` alongside the existing 12 cases. `AGENTS.md §11` — *"no silent defaults"* — and `D32`. **RED first:** booting with `WEB_ORIGIN` unset must exit non-zero with the variable named. |
| **G1-12** | Unblocking rename | 1 | `FIX-09` | `src/modules/modules/` → `src/modules/registry/` (12 `.gitkeep` moves). Anchor the ESLint globs, or keep them unanchored and record the choice as deliberate — `eslint/node.js` argues the unanchored case well in a comment, so keep the argument and add the anchor for `modules/` specifically. |

**Exit criterion — the negative test. This is the point of the epic:**

> For **each** of `typecheck`, `lint`, `test`, `test:coverage`, `build`, `test:integration`, `test:e2e`, `format:check`, `docs:verify`: introduce one deliberate defect, run the command, **watch it exit non-zero**, revert. Nine commands, nine observed reds. Record the transcript in `docs/work/TDD_EVIDENCE_GATES.md`.
>
> On 2026-09-29 the coverage gate was "proved able to fail" — but by a *temporary probe threshold on a real file*, not by the configured tiers. That distinction is the whole point of G1-6. A probe proves the mechanism; a tier that matches nothing proves nothing.

**Points: 23.**

---

## EPIC-G2 — Make the record accurate · 13 pts

**Why this is worth 13 points.** The corpus is *excellent* on architecture and *drifting* on facts. Six quantity classes are wrong:

| Quantity | Values in circulation | Measured 2026-09-30 |
| --- | --- | --- |
| `docs:verify` references | 147 · 155 · 179 | **188 at audit time — 207 after the four new docs were added** |
| Unit tests | 51 · 63 · 67 · 78 | **103** |
| Commits | 3 · 4 · 8 | **14** |
| ADR count | 19 · 21 | **21** |
| Tracked files | 262 | **269** |
| tsconfigs excluding specs | 5 | **4** |
| EPIC-00 progress | "1 of 11" | **3 of 12** |

`SSOT.md` — whose stated purpose is answering *"what is the current state?"* — carries a false git state, two conflicting rows for `pnpm test` inside one table, and a `needs correction` marker against three `AGENTS.md` edits that were already applied in `8105a27`.

**The reference count is the proof, not the exception.** It moved 188 → 207 the moment four documents with cross-references were added — nothing about the repository changed except the documentation. A hand-written count is wrong before it is ever published, which is why G2-2 generates the table rather than editing it.

| # | Story | Pts | Closes | Acceptance criteria |
| --- | --- | --- | --- | --- |
| **G2-1** | Correct `SSOT.md` section 1 | 3 | `AUD-30-06` | Every number re-measured and correct: 14 commits, clean tree, 103 tests, 188 doc references, 21 ADRs, 269 tracked files. Delete the duplicate `pnpm test` row at `:36`. The honest gate line becomes **"5 of 9 green and trustworthy, 2 green but hollow, 1 red"** — not "6 of 7", which counts a gate that tests nothing as green. Add a section listing the four hollow gates with their finding IDs. |
| **G2-2** | Generate the status report | 5 | `AUD-30-06` class | `scripts/report-status.mjs` runs the 9 gates, captures exit codes, and emits the `SSOT.md` section 1 table as markdown. **That table is generated, not written.** This is the `D33` pattern — *generate from one source so they cannot describe different systems* — applied to the status report. It makes the count-drift class **structurally** impossible, which is worth more than any individual correction, because six wrong numbers is evidence the class recurs. Include a `--check` mode CI can run. |
| **G2-3** | Renumber the colliding IDs | 2 | `AUD-30-07` | `REMEDIATION_PLAN_2026-09-29.md` renumbers its `ARC-01`…`ARC-08` (now colliding with the *completed* ERD) to `ARC3-01`…`ARC3-08`, and its `OPS-01` (integration harness) to `OPS-01b`. The completed ERD keeps `ARC-01` everywhere else — it is a shipped, referenced identifier and must not move. Add a one-line note at the top of the remediation plan recording the renumbering, so a reader arriving from the old ID finds it. |
| **G2-4** | Fix `PLATFORM_CORE_PLAN.md` | 2 | `AUD-30-08`, `DOC-07` | Delete `:139`'s *"resolves cleanly — P14 sits after P8"* (retracted; `TODO.md:179`). Fix `:53` Jest to Vitest and its "unmet entry condition" table — those conditions are now met. Fix `:94` *"the test runner is missing"* and `:133` *"MinIO is not optional"* (contradicted by `D23` / `ADR-019`). This is the document most likely to mislead the next session. |
| **G2-5** | Reconcile the `AGENTS.md` decisions | 1 | `D8`/`D9`/`D10` | `SSOT.md` section 4 marks **D8, D9 and D10 as applied** — verified in `8105a27`: `AGENTS.md:18` has the full legacy path, `:116` says 21 keys and zero application keys, `:319` says 149 raw-SQL sites. Retire those three from the pending ask; keep the fourth (repo name) if genuinely outstanding. |

**Exit criterion:** `pnpm docs:verify` passes; no quantity appears with two different values anywhere in the corpus; no document asserts a resolution another document records as retracted.

---

## EPIC-G3 — Close the blocking scaffold gaps · 9 pts

Four of these block a human gate or the first interactive screen. `AGENTS.md §3.2.1` is currently **unsatisfiable**: ESLint bans raw `<button>`, `<input>`, `<select>`, `<textarea>`, `<table>` and `<dialog>`, and `packages/ui-kit/src/components/ui/` is empty. The first screen with a button cannot be written.

| # | Story | Pts | Closes | Acceptance criteria |
| --- | --- | --- | --- | --- |
| **G3-1** | Initialise shadcn/ui | 3 | `FIX-11` | `components.json` exists. **10 primitives** in `packages/ui-kit/src/components/ui/`: `button`, `input`, `label`, `card`, `dialog`, `table`, `select`, `textarea`, `dropdown-menu`, `sheet`. The `Sheet` is load-bearing — `AGENTS.md §3.2.2` requires the sidebar as a `Sheet` drawer on mobile. Per `AGENTS.md §2.2` the generated files are **vendor**: compose over them, never edit. Test: a screen built from `Button` passes lint; the same screen with a raw `<button>` fails with the `AGENTS.md 3.2.1` message. **RED first.** |
| **G3-2** | Theme toggle + route states | 2 | `FIX-10` | A `ThemeToggle` writing `localStorage.setItem('eduflow-theme', …)` — the read side already exists at `theme-script.tsx:18`, and there is **no** `setItem` anywhere in the repository. Plus `loading.tsx`, `error.tsx`, `not-found.tsx` per `AGENTS.md §3.2.4`. Test: the toggle flips `data-theme` and survives a reload; `prefers-color-scheme` is honoured when no choice is stored. |
| **G3-3** | Locale negotiation | 1 | `FIX-04` | `proxy.ts` becomes `middleware.ts` — Next 15 compiles **zero** middleware from the Next 16 convention — and negotiates `Accept-Language` into a redirect. Test: `/` with `Accept-Language: ar` redirects to `/ar`, which then serves `dir=rtl`. Note the tension with `localePrefix: 'always'`; decide and record which wins. |
| **G3-4** | `LEGACY_REUSE_INVENTORY` rows | 2 | `GAP-06`, `D11` | The inventory is measurements-only and says so: *"Until this table has rows, nothing may be ported."* Fill the per-file port judgements, each with a reason. This is not cosmetic — `D11` makes it a hard precondition for reuse, and `AGENTS.md §5.1` claims business logic is reusable. That claim is currently unsupported. |
| **G3-5** | Config cleanup | 1 | `FIX-21`, `FIX-23` | `pnpm clean` uses `rm -rf`, which does not exist on Windows — and this is a Windows workstation, which is why `D23` exists. Use `node -e` `rmSync` like the other packages. Resolve the two Prettier sources of truth: `packages/config/prettier.config.js` versus root `.prettierrc.json`. |

**Exit criterion:** a developer can build an interactive screen using only shadcn primitives from `@eduflow/ui-kit`, in both themes, in `/ar`, on a phone — and `pnpm lint` passes.

---

## EPIC-G4 — P3: the rules become executable · 34 pts

**The Prompt Pack's P3, unchanged and still 0% delivered.** It is the milestone's centre of gravity: the pack calls it *"the most valuable safety net in the project."* `AGENTS.md §2.3` currently states — in prose only — that a route with no `@RequirePermission` and no `@Public('<reason>')` is a defect. `lint-rules.spec.ts:18-19` admits this in the codebase itself.

Prerequisite: G3-1. The Prompt Pack's human gate opens a dummy PR that must fail CI, and a PR that touches a screen needs components to exist.

| # | Story | Pts | Closes | Acceptance criteria |
| --- | --- | --- | --- | --- |
| **G4-1** | `check-route-guards` | 5 | `FIX-13` | A TypeScript-AST script over `apps/api/src/modules/**/controllers/**`. Fails when a route carries neither `@RequirePermission` **nor** `@Public('<reason>')`; an `@Public` with an empty reason is itself a failure. Requires the guard decorators to exist — **pull G5-3 forward of this story.** |
| **G4-2** | `@Public` allowlist | 2 | `FIX-13` | A checked-in file listing every `@Public` use with its justification, reviewed like code. `AGENTS.md §2.3`: *"every `@Public` use is listed in a checked-in allowlist file with its justification, so exemptions are reviewable rather than invisible."* Two-way: the script fails both on an unlisted `@Public` and on a stale entry. |
| **G4-3** | `check-i18n` | 3 | `FIX-15`, `DSN-06` | `ARCHITECTURE.md:346` claims ESLint enforces *"no user-facing literal in JSX/TSX"*. **No such rule exists** — the `eslint/next.js` comment says so explicitly and defers it here for good reason: a heuristic produces false positives, which is worse than no check. Tune it against the real screens from G3. Then **fix the `ARCHITECTURE.md:346` claim either way** — a document that overstates enforcement is `FIX-18`. |
| **G4-4** | `check-worklog` | 1 | `AGENTS.md §9` | Fails a commit that changes source without also changing `docs/work/WORKLOG.md` and `TODO.md`. *"If work is not in the worklog, it did not happen."* |
| **G4-5** | Secret and dependency scanning | 4 | `FIX-12`, `D21` | `gitleaks` — the compensating control `D21` records, because GitHub push protection needs paid Advanced Security for private repositories — plus `pnpm audit`. |
| **G4-6** | Commit lint | 2 | `FIX-12` | `lint-staged` and `commitlint`, conventional commits, and a message that must reference the requirement ID (`AGENTS.md §9`). |
| **G4-7** | React-hooks rules | 2 | `D25` | `eslint-config-next` fails against ESLint 9.39, so `D25` vendored only the two rules that mattered. Restore the hooks rules now that there are hooks to check. |
| **G4-8** | CI workflow | 5 | `FIX-12`, `GAP-09` | `.github/workflows/ci.yml`: all 9 gates, `report-status.mjs --check`, a Postgres service container, and `DATABASE_URL` / `REDIS_URL` from secrets. Runs on push and on pull request. |
| **G4-9** | **The human gate** | 3 | — | A pull request with **4 deliberate defects** — an unguarded route, a missing i18n key, a hard-coded hex, a `number` money field — must fail CI with 4 named errors. Fix them; CI goes green. **Watch both states.** This is the only proof that G4-1 through G4-8 are wired, and it is exactly what the 2026-09-29 audit found missing. |

**Exit criterion:** a deliberate defect fails CI. Until that is observed, none of G4-1 through G4-8 is more than a file on disk.

---

## EPIC-G5 — P4 / P4W: the walking skeleton · 33 pts

Prerequisite: G1-11 (no silent defaults), G3-3, and `DATABASE_URL` becoming **required**. `ADR-019`'s `persistence: 'disabled'` third state was a concession to a machine without Docker, and `D23`'s own wording says the branch is deleted at P4.

| # | Story | Pts | Closes | Acceptance criteria |
| --- | --- | --- | --- | --- |
| **G5-1** | `IClock` and `FakeClock` | 3 | `ARC-03` | Interface plus a deterministic fake. The ESLint ban on `Date.now()`, `new Date()` and `Math.random()` in `domain/` and `use-cases/` is **already live** with nothing to ban yet. `AGENTS.md §2.4` requires this for accrual, licence expiry, deadlines and hold expiry. |
| **G5-2** | Typed error hierarchy and global filter | 3 | `ARC-07` | Domain errors, one filter, and the `ApiErrorBody` contract that `shared-types` already declares. Never leak a stack trace. |
| **G5-3** | The four guard decorators | 3 | `ARC-04` | `@RequirePermission`, `@RequireEntitlement`, `@Audited`, `@Public`, plus a **fail-closed global guard** so a route with no decorator is denied. Needed by G4-1 — **pull forward.** |
| **G5-4** | Prisma migration and seed | 4 | `FIX-16` | `prisma migrate dev` produces `migrations/` from the 14 generated models, plus `seed.ts`. The first time a real PostgreSQL exists in this environment. |
| **G5-5** | **Prove `audit_records` immutability** | 3 | `D34` | The `REVOKE` and `BEFORE UPDATE OR DELETE` trigger exist as SQL in `prisma/hardening/audit-immutability.sql` and **have never been executed** — `SSOT.md:189` says so plainly: *"Not yet demonstrated."* Test: connect **as the application role** and attempt `UPDATE` and `DELETE` on an `audit_records` row; both must raise. This performs the P7 human gate early, because it validates a design decision rather than a feature. |
| **G5-6** | Logger, correlation ID, redaction | 5 | `PLT-501`, `PLT-502` (pulled fwd) | `AGENTS.md §2.15` — every `ERROR` and `CRITICAL` to **both** the rotating JSON file **and** the DB error log. 25 MB active, 3 historical. Redact passwords, tokens, card data, secrets and biometric templates (`§2.13`). |
| **G5-7** | Liveness endpoint | 1 | `PLT-901` (pulled fwd) | Minimal. Readiness with real dependency checks is P13. |
| **G5-8** | App shell | 5 | `DSN-03`, `P4W` | shadcn shell, `Sheet` drawer sidebar on mobile and full on `lg:`, language switcher, typed API client carrying the correlation ID, and 403/404/error placeholders. RTL from the archetypes `shell.spec.ts` already proves. |
| **G5-9** | Login, form and table archetypes | 3 | `DSN-03` | The three layouts RTL must survive, in `/ar`, in both themes. `docs/design/FRONTEND_TEMPLATE.md` is explicit that the template's 4 CSS rules **do not** cover sidebar, form, table, logical properties or icon mirroring — app-shell RTL is built from scratch, not harvested. |
| **G5-10** | Login screen e2e | 3 | `P4W` | Playwright against a real rendered form, extending the suite beyond the shell. |

---

## EPIC-G6 — Requirements extraction · 34 pts

**Blocking, and the reason the plan is honest about sequencing.** `docs/idea-bank/` is **five loud, empty stubs totalling 16,124 bytes** — verified byte for byte — each declaring *"Placeholder. Zero rows."* The Prompt Pack greps them before **every** story. `REQ-03` (business rules) gates `PLT-301`…`PLT-305`; `REQ-02` (domain entities) gates the ledger; `REQ-04` must trace all **87** FRs.

`AGENTS.md §6` is admirably honest here: it *removed* the `139 modules / 257 rules / 35 entities / 73 FRs` figures rather than replacing them with different invented numbers (**D28**). That was the right call, and it leaves a hole that only the extraction can fill.

| # | Story | Pts | Closes | Acceptance criteria |
| --- | --- | --- | --- | --- |
| **G6-1** | `module-inventory.md` | 5 | `REQ-01` | Cross-checked against Master Plan §29's 30-row table. |
| **G6-2** | `domain-entities.md` | 8 | `REQ-02` | Each entry states whether an `SSOT.md §4` or `AGENTS.md §2.9` equivalent already exists — this is the anti-drift requirement. |
| **G6-3** | `business-rules.md` | 8 | `REQ-03` | Every rule carries a **source citation** and a **test target**. |
| **G6-4** | `fr-index.md` | 5 | `REQ-04` | All 87 FRs traced to story and to test. |
| **G6-5** | `edge-cases-and-risks.md` | 5 | `REQ-05` | Risks, boundary tests, failure modes, test standards. |
| **G6-6** | `PC-000`…`PC-006` triage | 3 | `REQ-07` | Each **resolved or formally deferred**, with a named owner and a target milestone. `PC-005` and `PC-006` are not yet ticketed. |

**The rule that governs this epic, restated because it is the easiest thing to get wrong:** a gap in the corpus is recorded as `GAP — needs design (PC-xxx)`. **Never invent a threshold, a formula or a schedule to fill a table.** A missing rule is visible; a fabricated one is not, and every downstream story will trust it.

---

## Sequencing — the critical path

```
G0  commit what exists  (1 pt)
     |
G1  make the gates honest  (23 pts)  --  G1-1 web-port.spec runs
                                          G1-2 test-file oracle
                                          G1-3 integration guards
                                          G1-4 nav-parity floor
                                          G1-5 dark theme e2e
                                          G1-6 coverage globs bite
                                          G1-7..G1-12 the rest
     |
     +--> G2  make the record accurate  (13 pts)   [runs in parallel with G1]
     |
     +--> G6  requirements extraction  (34 pts)   [parallel; longest lead;
     |                                               no code needed; greps
     |                                               every future story]
     |
     +--> G3  blocking scaffold  (9 pts)  --  G3-1 shadcn/ui
                                                    |
                                                    v
                                          G4  P3: CI + guards (34 pts)
                                                    |
                                                    v
                                          G5  P4 kernel + web shell (33 pts)
                                                    |
                                                    v
                                          PLT-EPIC-01 .. 09  (P5..P14, 199 pts)
```

**Critical path:** `G0 -> G1 -> G3-1 -> G4 -> G5 -> PLT-EPIC-01`. Roughly **110 points** of prerequisite work before the first feature story.

**Longest lead and most parallelisable:** `G6` (34 pts). It needs no code, no gates and no decisions, and it is the thing that will block `PLT-301`…`PLT-305` in six weeks. Start it in parallel or it becomes the new longest pole — which is exactly how `D22`/`D33` happened with the ERD.

**Total before the first feature story: ~110 pts.** Milestone 1 is 199 points. The prerequisites are not a detour from the work; they are more than a third of it.

### Suggested parallel split for a small team

| Lane | Wave 0 | Wave 1 | Wave 2 | Wave 3 |
| --- | --- | --- | --- | --- |
| **A — gates** | G0-1 | G1-1…G1-6, G1-8, G1-9 | G4-1…G4-9 | G5-1…G5-7 |
| **B — web foundation** | | G1-4, G1-5, G3-1, G3-2 | G5-8, G5-9, G5-10 | with P5 |
| **C — requirements** | | G6-1, G6-2 | G6-3, G6-4, G6-5 | G6-6 |
| **D — record + ops** | | G1-7, G1-10…G1-12, G2-1…G2-5 | G3-4, G3-5 | with P5 |

Lane C is the one most likely to be skipped and the one that will hurt most six weeks from now. It is also the only lane that can run entirely without a decision from the owner.

---

## Owner decisions required

`D14` restricts `AGENTS.md` corrections to owner approval. These are the open questions, ordered by what they block. Nothing below was invented for this plan; each is already recorded in `docs/work/TODO.md` or `docs/core/SSOT.md`.

| # | Decision | Blocks | Recommendation |
| --- | --- | --- | --- |
| **`A`** | `AGENTS.md §3.1` names `Jest`; the repository uses **Vitest** (`ADR-020`, `D27`). *"The contract still contradicts the code."* | Every future session's first read | Approve. It is already ratified by an ADR. |
| **`B`** | `AGENTS.md:6` and `:16` say *"pre-scaffold. No application code exists yet"* and *"The codebase is not yet scaffolded."* Both are false. | Every session opens on a false state | Approve. |
| **`G`** | The `bigint` to JSON boundary for `Money` (`ADR-002:48` against the live `amountMinor: bigint`). Proposed `ADR-024`. | `ARC-06`, `PLT-301`, the whole ledger | Decide **before** G5, not during `PLT-301`. |
| **`3`** | The four `AGENTS.md` corrections. **Three are already applied** (`D8`/`D9`/`D10`, commit `8105a27`). | G2-5 | Approve the remaining one; retire the other three. |
| **`10`** | Approve `ADR-001`…`ADR-021`. **None is `Accepted`.** | Everything that depends on a decision | Batch-approve. An unapproved ADR is a suggestion, and there are 21 of them. |
| **`9`** | `SRS §19` puts mobile in the MVP; `AGENTS.md §7` and `D5` move it to milestone 2. Three documents, two positions. | MVP scope | `D5` and `ADR-005` are the governing position. Amend the SRS. |
| **`D`** | `SRS §24` Gate M2 versus the licensing sprint position. *"Relabelling a step is not moving a gate."* | P14 close-out | Amend `SRS §24` or move licensing. Do not leave it asserted in two places. |
| **`11`** | Approve the proposed `PLT-107` (first-admin bootstrap via one-time setup token). | `PLT-EPIC-01`, school onboarding | Decide before P5 — a school cannot be onboarded without it. |
| **`2`** | Was `docs/archive/corpus/` deleted, or never migrated? | Reliability of `REQ-01`…`REQ-05` | Answer or delete the `AGENTS.md §12` row that points at it. |
| **`4`** | The font stack for Tamil, Sinhala and Arabic, on screen and in generated PDFs. | `DSN-04`, then G5-9 | Blocks the RTL archetypes. |

### Decisions this plan deliberately does **not** take

Per `AGENTS.md §2` and `D14`, the following are the owner's to make and are recorded rather than resolved here:

- Whether `AGENTS.md` itself may be reformatted by Prettier (G1-7).
- Any threshold, formula, schedule or formula for attendance, leave, grading, tax, currency, admission, retail settlement or the student wallet (`PC-000`…`PC-006`). A gap is recorded as a gap.
- Whether the coverage tiers in `AGENTS.md §4` change, or whether the globs change to match them. G1-6 assumes the tiers are right and the globs are wrong, which is the reading that preserves the contract.

---

## What must not happen

Straight from `AGENTS.md §13`, restated because each is a live temptation at this point in the project:

- **Do not start `PLT-101` before EPIC-G1 closes.** The corpus already records the entry condition as *"the harness is trustworthy"*, and today the harness contains a test that has never run and a coverage gate that enforces nothing.
- **Do not build tenant-scoping machinery.** Single-tenant is `D2`; the legacy codebase is full of the wrong pattern and it looks correct.
- **Do not port anything from the legacy app** until `LEGACY_REUSE_INVENTORY.md` names the file with a reason (`D11`).
- **Do not add a second attendance, stock, booking, approval, document, notification or ledger engine** (`§2.9`).
- **Do not write directly to `journal_entries` or `audit_records`.**
- **Do not mark a gate done because a config file exists.** Run the command. This plan's entire Wave 1 exists because that rule was broken four times.
- **Do not renumber `PLT-*` IDs.** G2-3 renumbers `ARC-*` and `OPS-01` because they genuinely collide; `PLT-*` is the traceability backbone and is not touched.

---

## The one-paragraph version

The repository's *engineering* is in better shape than its *reporting*. Four gates are green and verify nothing, the headline git status is false, and six separate count classes have drifted — while the tests that do exist are unusually good, encoding real incidents and watching real invariants fire. So: commit the 27 uncommitted files, then spend 23 points making every gate able to go red (the single highest-leverage work available), 13 points generating the status report instead of writing it, and 9 points unblocking the shadcn hole that currently makes `AGENTS.md §3.2.1` unsatisfiable — while 34 points of requirements extraction run in parallel, because that is the thing that will block the licensing epic in six weeks and it needs no decision from anyone. The feature work is not being delayed. It is being unblocked.
