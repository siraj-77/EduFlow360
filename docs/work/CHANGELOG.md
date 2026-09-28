# CHANGELOG

**Format:** [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · **Versioning:** [Semantic Versioning](https://semver.org/)
**Scope:** User-visible change to the *product*. Documentation-only changes that do not alter a documented contract are recorded in `WORKLOG.md`, not here.

> **No released version exists.** The repository is pre-scaffold (`SSOT.md` §1). The entry below marks the documentation baseline, not a product release.

---

## [Unreleased]

Nothing yet. The first product entry will be the **Foundation Harness** milestone (Prompt Pack P4): all seven `AGENTS.md` §4 quality gates green in CI on a fresh clone, with an under-covered file proven to fail the coverage gate.

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
