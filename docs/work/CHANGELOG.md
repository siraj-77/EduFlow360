# CHANGELOG

**Format:** [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · **Versioning:** [Semantic Versioning](https://semver.org/)
**Scope:** User-visible change to the *product*. Documentation-only changes that do not alter a documented contract are recorded in `WORKLOG.md`, not here.

> **No released version exists.** The repository is pre-scaffold (`SSOT.md` §1). The first entry below marks the establishment of the documentation baseline, not a product release.

---

## [Unreleased]

Nothing yet. The first product entry will be `REPO-*` completion — specifically the **Foundation Harness** milestone: all seven `AGENTS.md` §4 quality gates green in CI on a fresh clone.

---

## [0.0.0-docs-baseline] — 2026-09-28

### Added

**Analysis and planning**
- `docs/work/GAP_ANALYSIS_2026-09-28.md` — full repository and documentation analysis: current state, 21-item gap register with severities, 7 improvement areas, and a 6-epic Jira-style action plan (`REPO` 34pts, `ARC` 42pts, `REQ` 34pts, `DSN` 21pts, `OPS` 34pts ≈ 172pts) with a critical path and sprint schedule.

**Governance documents (all previously 0 bytes)**
- `docs/core/SSOT.md` — current state, 11 decisions of record, blocking status, 8 open questions for the owner, and a planning-horizon precedence table.
- `docs/core/ARCHITECTURE.md` — layer dependency rules, module anatomy, the three fail-closed guards, the seven shared engines, money/time/audit conventions, adapter ports, human-in-the-loop, privacy, settings, logging, UI rules, and **§17 mapping every rule to the story that will enforce it**.
- `docs/work/PLATFORM_CORE_PLAN.md` — the milestone-1 execution view referenced by `AGENTS.md` §7 but previously missing: 20 entry conditions, 5-sprint schedule, per-story TDD obligations, quality gates, pre-merge self-check.
- `docs/work/TODO.md` — next actions in priority order, with 8 items requiring an owner decision.
- `docs/work/WORKLOG.md` — the activity log mandated by `AGENTS.md` §9.
- `docs/work/BACKLOG.md` — 24 deferred ideas plus 9 **rejected** ideas recorded so they are not re-raised.
- `docs/work/CHANGELOG.md` — this file.

**Decision records** (`docs/adr/`)
- `README.md` — ADR index and format.
- `ADR-003-new-app-single-tenant-selective-reuse.md` — **reconstructed** from `AGENTS.md`, since `AGENTS.md` §1 cites it as governing but the file did not exist. **Requires owner sign-off.**

**Analyses** (all previously cited by `AGENTS.md` but missing)
- `docs/analysis/LEGACY_REUSE_INVENTORY.md` — measured legacy corpus (59 Prisma models, 23 enums, 630 TS files, 897 test files, **149 raw-SQL call sites**) and the port whitelist with per-category judgements. Per-file port judgements still pending.
- `docs/design/FRONTEND_TEMPLATE.md` — measured frontend template: 21 i18n keys per locale, 4 RTL CSS rules, 0 `prefers-reduced-motion`. Establishes it as a **token and RTL-pattern donor only**.
- `docs/idea-bank/README.md` — specifies the requirements extraction. **Intentionally contains no extracted content** (see `WORKLOG.md` D13).

### Changed

None. `AGENTS.md` and the four core planning documents were **not modified** — they are accurate, and `AGENTS.md` is the governing contract (`WORKLOG.md` D14).

### Security

- **Reported, not remediated:** a live `thk_live_` credential in `.claude/settings.json` plus a third-party `ANTHROPIC_BASE_URL`. Rotation requires a human action at the issuer. Tracked as `GAP-01` / `REPO-01`, and it must happen **before `git init`** or the credential becomes permanent history.

### Known issues

Four figures in `AGENTS.md` were re-measured on 2026-09-28 and found inaccurate. **They are not corrected here** — `AGENTS.md` is the governing contract and editing it is the owner's decision.

| `AGENTS.md` | Claim | Measured | Tracking |
|---|---|---|---|
| §1 | Legacy at `EduFlowV3\` | `EduFlowV3\EduFlowV3\eduflow\` | `SSOT.md` D8 |
| §2.8 | Template has a "complete `en`/`ta`/`si`/`ar` dictionary" | 21 marketing keys, 0 application keys | `SSOT.md` D9 |
| §5.2 | "9 unfiltered `$queryRaw`/`$executeRaw` sites" | **149** | `SSOT.md` D10 |
| §5.2 | "35-model scoping" | 59 models total | `LEGACY_REUSE_INVENTORY.md` |

Two further inconsistencies: `SRS` §24 sets the `M2` gate to "license enforcement demonstrably working" while licensing is scheduled for Sprint 3 and `M2` is the Sprint 2 gate; and `SRS` §19 places mobile in the MVP while `AGENTS.md` §7 (D5) makes `apps/mobile` milestone 2. Both need an owner decision (`TODO.md` ⚑7, `BACKLOG.md` BLG-051).

---

## Version history

*No tagged versions. The first tag follows the Foundation Harness milestone.*
