# CHANGELOG

**Format:** [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · **Versioning:** [Semantic Versioning](https://semver.org/)
**Scope:** User-visible change to the *product*. Documentation-only changes that do not alter a documented contract are recorded in `WORKLOG.md`, not here.

> **No released version exists.** The repository is scaffolded (`SSOT.md` §1); no feature code has been written. The `[0.1.0-scaffold]` entry below marks the scaffold commit, not a product release.

---

## [Unreleased]

### Fixed — documentation corrections (2026-09-29)

**The `[0.1.0-scaffold]` entry overstated what shipped.** A post-scaffold audit found **3 of the 7 `AGENTS.md` §4 gates fail** and that the `WORKLOG.md` entry reporting them as green listed only six of the seven. Corrected across the governing documents; the code fixes are tracked as EPIC-00 and are **not** in this entry.

| Correction | Where |
|---|---|
| `WORKLOG.md` "All gates green" → the measured results, with a correction banner on the scaffold entry | `WORKLOG.md` |
| `SSOT.md §3` "Nothing has been built" → a real inventory separating *present but easy to mistake for absent* from *genuinely absent* | `SSOT.md` |
| `SSOT.md:70` "School Setup Workflow is **orphaned**" → **referenced by `AGENTS.md:19`**; GAP C-06 closed at `8105a27` | `SSOT.md` |
| `SSOT.md` `Last updated: 2026-09-28` → `2026-09-29`; **GAP-05 listed twice** in §5.1 → de-duplicated | `SSOT.md` |
| `AGENTS.md §6`'s five invented corpus figures **deleted** (D28) | `AGENTS.md` |
| `TODO.md`'s duplicated `### 4. Build the toolchain` / `### 5. Extract the requirements` blocks removed; three false *"the test runner does not"* claims struck | `TODO.md` |
| `TODO.md` "docker-compose.yml ✅" and "shadcn/ui" → marked as delivered-but-defective with the finding IDs | `TODO.md` |
| ⚑7 "✅ Resolved by reordering" → **reopened.** `SRS §24` Gate M2 is defined at *end of Phase 1*; the reorder relabels a step, it does not move a gate | `TODO.md` |
| `GAP_ANALYSIS_2026-09-28.md`'s "Changed since" delta → a dated 2026-09-29 row set | `GAP_ANALYSIS` |
| `adr/README.md` "**No ADR is `Accepted`**" → per-ADR status, plus the four decisions that had no ADR until now | `adr/README.md` |

### Added

- **`ADR-020` — the test runner is Vitest, not Jest** (D27). Five documents said Jest; the repository ships Vitest 2.1.8 with 51 passing tests and coverage tiers already in Vitest syntax. **The `AGENTS.md §3.1` amendment is blocked** — §3.1 is inside §3, which this session is directed not to touch. Now ⚑A
- **`ADR-021` — `next-intl` is the web i18n library** (D29). Ratifies a decision taken without the confirmation `AGENTS.md:214` required. It is one of the two options that line names.
- **`docs/analysis/CODE_AUDIT_2026-09-29.md`** — 32 findings (24 code, 8 documentation), each with executed-command evidence. 10 are S1.
- **`docs/work/REMEDIATION_PLAN_2026-09-29.md`** — the action plan that supersedes `GAP_ANALYSIS_2026-09-28.md` for post-scaffold work. EPIC-00 (21 pts) · EPIC-DOC · EPIC-ADR · then P3, REQ, ARC, DSN, OPS.

### Known issues — recorded, not fixed

**No product behaviour changed in this release. These are defects in the `[0.1.0-scaffold]` commit itself.**

| ID | Issue |
|---|---|
| **FIX-01** | `pnpm test:coverage` cannot run — `@vitest/coverage-v8` is in no `package.json`. The §4 coverage gate is unenforced |
| **FIX-02** | `pnpm test:e2e` exits 1 — the `testDir` exists and is empty |
| **FIX-03** | `infra/docker/docker-compose.yml` **does not parse** — line 1 is a `/** */` block comment in a YAML file |
| **FIX-04** | `apps/web/proxy.ts` is the Next 16 convention in a Next 15 project, so the build emits **zero middleware**. There is no locale negotiation |
| **FIX-11** | shadcn/ui was never initialised — no `components.json`, `ui-kit` has zero components — **while ESLint bans the raw elements that would replace them** |
| **FIX-12** | No CI, no pre-commit hook. Every rule is enforced only for the developer who runs it |
| **FIX-13** | `check-route-guards` does not exist, so `AGENTS.md §2.3`'s fail-closed guarantee is prose |

**Root cause:** five of these survived review because **each was invisible to the gate set that actually ran**, and three were marked done on the strength of a *config file existing* rather than the gate running. The coverage gate that would have caught the coverage problem *was* the broken one. The lesson is now recorded in `SSOT.md` §8: *verify by running the command.*

---

## [0.1.0-scaffold] — 2026-09-29

> ⚠️ **Partly inaccurate — see `[Unreleased]` above.** The items marked ❗ below were reported as delivered and are not.

### Added

**Monorepo** — 6 packages, pnpm 11 + Turborepo (`ADR-001`)
- `apps/api` — NestJS 11 + Prisma + Zod. **12 module folders × 12 directories**, matching `AGENTS.md` §3: `controllers/ use-cases/ domain/{entities,repositories,services,ports}/ infrastructure/{postgres,adapters}/ dto/`
- `apps/web` — Next.js 15 + React 19 + Tailwind v4. **UI only** — no server actions (`AGENTS.md` §3.1). ❗ **shadcn/ui was NOT initialised** — no `components.json`, `packages/ui-kit/src/components/ui/` is empty, and `ui-kit` has no `react` dependency
- `packages/config` — strict tsconfig, three ESLint flat configs, Prettier
- `packages/shared-types` · `packages/ui-kit` · `packages/i18n-resources`
- `infra/docker/docker-compose.yml` — Postgres, Redis, MinIO, Mailpit ❗ **the file does not parse** (FIX-03); two images unpinned; no bucket bootstrap
- `README.md` (incl. the no-Docker Windows path) · `CLAUDE.md` · `.env.example` · `.npmrc` · `.nvmrc` · `.editorconfig` · `.prettierrc.json`
- `scripts/docs-verify.mjs` (`OPS-05`)
- 147 `.gitkeep` files so the module structure is tracked

**Configuration**
- `apps/api/src/config/env.ts` — Zod-validated environment. Validated **before** the Nest app is constructed; every invalid variable named in one throw; cites `AGENTS.md` §11 in the message. ❗ `WEB_ORIGIN` and `NEXT_PUBLIC_API_URL` are in `.env.example` but **not in the schema**, and `main.ts:23` reads the raw ambient string with a `??` silent default (FIX-08, D32)
- **Three states for `DATABASE_URL`, not two** (`ADR-019`): absent → `persistence: 'disabled'` with a loud banner and **no repository constructed**; present-but-invalid → throws; present-and-valid → enabled. Nothing is mocked, defaulted or substituted.

**Design tokens** (`DSN-01`, `DSN-05`)
- `packages/ui-kit/src/styles.css` — light and dark token sets at the exact `AGENTS.md` §3.2.5 values, Tailwind v4 `@theme inline` mapping, `--motion-*` and `--touch-target-min`
- **`prefers-reduced-motion` added** — the template had none (`AGENTS.md` §3.2.7)
- Logical properties throughout; app-shell RTL built from scratch, not inherited

**i18n** (`DSN-02`) — `en/ta/si/ar`, **38 keys**, authored for the application, with none of the template's 21 marketing keys. RTL driven by `dir` on `<html>` from the locale. `next-intl` (D29, `ADR-021`). ❗ **No locale negotiation** — `proxy.ts` is dead code on Next 15 (FIX-04)

### Changed

- `packages/config/eslint/node.js` — the eight vendor SDKs that may not be imported from `domain/`/`use-cases/` are now named explicitly in the lint config. ❗ **This was originally recorded here as a change to `AGENTS.md` §2.2. `AGENTS.md` was not modified** — the last commit touching it is `8105a27`, before the scaffold
- `docs/adr/README.md` — reindexed, then to 21 ADRs (001–021) on 2026-09-29

### Enforced, not just documented

Each rule has a test that watches it **fail**, so removing a rule breaks the build rather than quietly disabling the guarantee:

| Rule | Mechanism | Test |
|---|---|---|
| `domain/` + `use-cases/` import no framework, ORM, queue or vendor SDK | ESLint `no-restricted-imports` | 6 cases in `api` |
| `domain/` + `use-cases/` call no `Date.now()` / `new Date()` / `Math.random()` | ESLint `no-restricted-syntax` | 5 cases in `api` |
| No `@ts-ignore`, `@ts-expect-error`, bare `any`, empty `catch` | ESLint | 3 cases in `api` |
| No raw `<button>` `<input>` `<select>` `<textarea>` `<table>` `<dialog>` | ESLint | rule firing, verified by probe |
| No hard-coded colour in a component | ESLint | rule firing, verified by probe |
| All four locales have identical key sets; none empty; none a copy of English | vitest | 10 cases |
| Every token defined in light **and** dark; exact `AGENTS.md` §3.2.5 dark values | vitest | 8 cases |
| Environment validated; every invalid variable named at once; `AGENTS.md` §11 cited | vitest | 10 cases |
| `dir` correct for all four locales | vitest | 4 cases |
| Documented paths exist | `pnpm docs:verify` | **147 references, 8 documents** |

### Quality

| Gate | Result |
|---|---|
| `pnpm typecheck` | ✅ 8/8 tasks, 6 packages, TS strict |
| `pnpm lint` | ✅ 8/8 tasks, **0 errors** |
| `pnpm test` | ✅ **51 passing** |
| `pnpm build` | ✅ web prerenders `/en` `/ta` `/si` `/ar` |
| `pnpm test:integration` | ✅ runnable, empty by design until P4 |
| `pnpm docs:verify` | ✅ 147 references resolve |

**Smoke-tested, not assumed:** the API boots with **no `.env`** and prints the honest banner; the web app serves all four locales with `/ar` returning `dir=rtl`.

### Fixed

Eleven real defects were caught by the gates during this phase, including: `{children}` destructured but never rendered (blank pages); `useTranslations` hook in an async Server Component (failed at prerender, not typecheck); a stale `tsbuildinfo` that made a build emit **nothing while exiting 0**; a `*/` inside a JSDoc comment that closed it early and parsed the glob as code; and a PowerShell BOM in two `package.json` files. All recorded in `SSOT.md` §8 "Known footguns".

### Known issues

- ❌ **No CI yet** (P3) — the gates above are green on one machine and enforced nowhere else.
- ❌ **No ERD** — deferred by owner decision (D22). `prisma/schema.prisma` is deliberately empty. Blocks `PLT-EPIC-01` and the SRS Phase 0 exit gate.
- ❌ **Branch protection unavailable** — requires a paid plan for private repos.
- ⚠️ **19 ADRs, none `Accepted`** (⚑10).
- ⚠️ **`OPS-03` coverage thresholds are written but not yet verified to fail.** An unenforced threshold is indistinguishable from no threshold.
- ⚠️ **`docs/idea-bank/` is stubs, not extraction** (`REQ-01…05` not done). The Prompt Pack greps those files before every story.
- ⚠️ **`eslint-config-next` dropped** (D25) — it patches ESLint internals and fails on 9.39. React-hooks rules return in P3.
- ⚠️ **DSN-03/DSN-01 partially done** — the token foundation and the `/ar` RTL route are proven; the login/form/table archetypes and the shadcn component set are P4W.

---

## [0.0.0-docs-baseline] — 2026-09-28

### Added

**Analysis and planning**
- `docs/work/GAP_ANALYSIS_2026-09-28.md` — full repository and documentation analysis: current state, a 21-item gap register with severities, 7 improvement areas, and a 6-epic action plan (`REPO` 34pts, `ARC` 42pts, `REQ` 34pts, `DSN` 21pts, `OPS` 34pts ≈ 172pts).
- `docs/superpowers/plans/2026-09-28-doc-reconcile-and-git-bootstrap.md` — 4-phase execution plan for the doc reconciliation and git bootstrap.

**Governance documents (all previously 0 bytes)**
- `docs/core/SSOT.md` — current state, 21 decisions of record, blocking status, 12 open questions, a planning-horizon precedence table, and an **M1/M2 naming legend**.
- `docs/core/ARCHITECTURE.md` — layer dependency rules, module anatomy, the four guards, the seven shared engines, money/time/audit conventions, adapter ports, human-in-the-loop, privacy, settings, logging, UI rules, and **§17 mapping every rule to the story or ADR that enforces it**.
- `docs/work/PLATFORM_CORE_PLAN.md` — entry conditions, the **P0–P14 execution order**, per-story TDD obligations, quality gates, pre-merge self-check.
- `docs/work/TODO.md` — next actions in priority order, 12 items requiring an owner decision, the ADR approval list, and the proposed `PLT-107`.
- `docs/work/WORKLOG.md` — the activity log mandated by `AGENTS.md` §9.
- `docs/work/BACKLOG.md` — deferred ideas plus **13 rejected ideas** recorded so they are not re-raised.
- `docs/work/CHANGELOG.md` — this file.
- `CLAUDE.md` — one-line pointer to `AGENTS.md` (Prompt Pack §10.1), so there is a single source of truth rather than a duplicate.

**Decision records** (`docs/adr/`) — 18, contiguous 001–018
- `001` monorepo · `002` money as integer minor units · `003` **new app / single-tenant / selective reuse** *(reconstructed, pending sign-off)* · `004` time via `IClock` · `005` mobile is milestone 2 *(conflicts with `SRS` §19)* · `006` licensing ships in milestone 1
- `007` argon2id behind `IPasswordHasher` · `008` token strategy with family reuse detection · `009` ECDSA P-256 over **canonical JSON** · `010` activation server is **external** · `011` install ID, not MAC · `012` permission catalogue in code · `013` **audit same-transaction** · `014` email adapter (SMTP) · `015` object storage (S3/MinIO) · `016` metrics (Prometheus) · `017` **deviations from the Jira sprint order** · `018` **`@Public` escape hatch**
- **None is `Accepted`.** Prompt Pack §6 P1 is the approval step, and the ADRs are already drafted — so P1 becomes a review, not a writing task.

**Analyses and specs**
- `docs/analysis/LEGACY_REUSE_INVENTORY.md` — measured legacy corpus (59 Prisma models, 23 enums, 630 TS files, 897 test files, **149 raw-SQL call sites**) and the port whitelist. Per-file port judgements still pending.
- `docs/design/FRONTEND_TEMPLATE.md` — measured template: 21 i18n keys per locale, 4 RTL CSS rules, 0 `prefers-reduced-motion`. Establishes it as a **token and RTL-pattern donor only**.
- `docs/idea-bank/` — README plus **five loud `NOT YET EXTRACTED` stubs**. See Known issues.

### Changed

- **`AGENTS.md`** — six hunks, seven measured corrections, owner-approved. Planning-document list now includes the Agentic Prompt Pack and the School Setup Workflow; legacy path corrected to `EduFlowV3\EduFlowV3\eduflow\`; `@Public('<reason>')` documented as the only route exemption; `Math.random()` added to the `IClock` rule; the i18n claim corrected from "a complete dictionary" to **21 marketing keys and zero application keys**; raw-SQL count **9 → 149** with its measurement method recorded; tree root `eduflow/` → `EduFlow/`.
- `docs/core/ARCHITECTURE.md` §4 — four-guard table now includes `@Public`, with the allowlist requirement and the rejected fake-permission-key alternative.
- `docs/core/ARCHITECTURE.md` §9 — new **§9.1 Durability**: sensitive audit rows share the business transaction; §9.2 lists what is audited and why P7's auth retrofit is mandatory.
- `docs/core/ARCHITECTURE.md` §17 — enforcement table expanded from 13 to **25 rows**, each naming the story or ADR that enforces it.
- `docs/work/PLATFORM_CORE_PLAN.md` — resequenced from a 5-sprint map to the **Prompt Pack's P0–P14**, with the four pull-forwards recorded (`ADR-017`) and the four required compose services.
- `docs/core/EduFlow_Agentic_Prompt_Pack_PlatformCore_v1.md` — two cosmetic corrections, owner-approved: the `ADR-005` example in §10.3 corrected to `ADR-009` (plus a second example), and §1.2's layout amended to include `CHANGELOG.md` and `docs/superpowers/plans/`.

### Resolved conflicts

| # | Conflict | Resolution |
|---|---|---|
| **C1** | Prompt Pack D-G (audit in the same transaction) vs. Jira `PLT-402` ("asynchronously, via queue") | **`ADR-013` — D-G wins.** A queued audit row can be lost, leaving a committed financial action with no trace. Recorded as a documented deviation |
| **C2** | `ADR-005` used for two different decisions | New ADRs continue from **007**; the Prompt Pack's example corrected |
| **C3** | "M2" meant milestone-2 and Gate-M2 in the same documents | Naming legend in `SSOT.md` §4 and `PLATFORM_CORE_PLAN.md` §0. **Never write a bare "M2"** |
| **C4** | docker-compose listed only Postgres + Redis | Corrected: **Postgres, Redis, MinIO, Mailpit** |
| **C5** | Lint rules incomplete | Added `Math.random()`, `@Public`, `check-i18n`, `check-worklog`, gitleaks, lint-staged, commit-msg check |

### Security

- **Accepted risk, not remediated (D24).** A live `thk_live_` credential in `.claude/settings.json`. **Never committed** — `.claude/` was gitignored *before* `git init`, and the first-commit staging gate verified the token value is absent. The remote is **private** with the owner as sole holder, so residual exposure is local-disk only. Revisit if the repo goes public, a second person gains access, or the folder is shared.
- **Push protection unavailable** (HTTP 422) — requires GitHub Advanced Security, paid-only for private repositories. **Reported, not worked around** (D21). Compensating control: the `gitleaks` job in Prompt Pack P3.

### Repository

- Git initialised on `main`; remote `origin` = `siraj-77/EduFlow` (private). First commit `f7257cf` — 27 files, 8,694 insertions, **documentation only, no application code**. Pushed as a **fast-forward** on top of the remote's `0bedbe30`, which is preserved. **No `--force` at any point.**
- `.gitignore` hardened: added `.claude/`, `graphify-out/`, `.graphify_*.json`. GitHub's Next.js-default `.gitignore` replaced by the repository's own.

### Known issues

- **`docs/idea-bank/` is stubs, not extraction.** The five files exist so every path `AGENTS.md` names resolves, and each opens with a loud `NOT YET EXTRACTED` header. **The extraction itself (`REQ-01…05`) has not been done**, and nothing may be built on a fabricated rule.
- **`docs/archive/corpus/` still does not exist** (`AGENTS.md` §12, Prompt Pack §1.2). Open question ⚑2.
- **No ADR is `Accepted`.** Open question ⚑10.
- **`SRS` §19 vs. `AGENTS.md` §7 (D5) on mobile** remains unresolved — `ADR-005`, open question ⚑9.
- **`PLT-107` (first-admin bootstrap) is proposed, not approved.** School Setup Workflow §6.5 requires it; no story covers it. Open question ⚑11.
- **Branch protection not enabled.** Push protection needs a paid plan for private repos.

---

## Version history

*No tagged versions. The first tag follows the Foundation Harness milestone.*
