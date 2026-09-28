# Architecture Decision Records

`AGENTS.md` §1 names `ADR-003` as the governing decision. It is indexed here.

---

## Index

| ADR | Title | Status | Date | Supersedes |
|---|---|---|---|---|
| [ADR-001](ADR-001-monorepo-toolchain.md) | Monorepo with pnpm workspaces and Turborepo | 🟡 Proposed — needs sign-off | 2026-09-28 | — |
| [ADR-002](ADR-002-money-as-integer-minor-units.md) | Money as integer minor units with per-school scale | 🟡 Proposed — needs sign-off | 2026-09-28 | — |
| [ADR-003](ADR-003-new-app-single-tenant-selective-reuse.md) | New application, single-tenant, selective legacy reuse | ⚠️ **RECONSTRUCTED — needs owner sign-off** | 2026-09-28 | — |
| [ADR-004](ADR-004-time-via-injected-clock.md) | Time via an injected `IClock` | 🟡 Proposed — needs sign-off | 2026-09-28 | — |
| [ADR-005](ADR-005-mobile-is-milestone-2.md) | `apps/mobile` is milestone 2 | ⚠️ **CONFLICTS with `SRS` §19** | 2026-09-28 | — |
| [ADR-006](ADR-006-licensing-ships-in-milestone-1.md) | Licensing ships in milestone 1 | 🟡 Proposed — needs sign-off | 2026-09-28 | — |

---

## ⚠️ Read this first

**`ADR-003` did not exist as a file until 2026-09-28**, despite `AGENTS.md` §1 citing it as the governing decision and §1's own precedence rule making it win over every other planning document. It has been **reconstructed from `AGENTS.md`**, which is the most authoritative source available, but it is a reconstruction and not a contemporaneous record.

**It requires owner sign-off before it can be treated as settled.** Reconstructed on 2026-09-28; rationale in `docs/work/WORKLOG.md` D19.

---

## Status meanings

| Status | Meaning |
|---|---|
| ✅ **Accepted** | Binding. Code must comply. |
| 🟡 **Proposed** | Written down, awaiting owner approval |
| ⚠️ **Reconstructed** | Recovered from another document; content is faithful but provenance is second-hand. Needs sign-off. |
| 🔴 **Superseded** | Replaced by a later ADR |

**No ADR is `Accepted`.** Nothing in this directory has been signed off.

---

## Format

```markdown
# ADR-NNN — <Title>

**Status:** 🟡 Proposed
**Date:** YYYY-MM-DD
**Deciders:** <who>
**Affects:** <modules, files, decisions>

## Context
What forces make this a decision rather than a default.

## Decision
What was decided, in the active voice.

## Consequences
### Positive
### Negative / accepted costs
### Neutral

## Rejected alternatives
Each with why it lost. **This section is the point** — an ADR that
records only the decision gives a future reader no way to tell whether
the alternative is still on the table.

## Revisit when
The observable condition that would invalidate this.
```

---

## When an ADR is required

Write one when a decision is **expensive to reverse**, **constrains future work**, or **was non-obvious enough that a competent engineer would plausibly have chosen differently**.

In this codebase that means, at minimum:
- Any addition to, or removal from, the shared engines table (`AGENTS.md` §2.9)
- Any change to the three mandatory guards, or to fail-closed behaviour
- Any change to the tenancy model (`AGENTS.md` §2.1) — **especially any proposal to add tenant scoping**
- Any new state-management library, ORM, CSS framework or build tool (`AGENTS.md` §8)
- Any decision to port a legacy file (requires a row in `LEGACY_REUSE_INVENTORY.md` **and** an ADR if the port is non-obvious)
- Any licensing, money, time or identity decision
- Anything that resolves one of the eight Open Questions in `docs/core/SSOT.md` §7

---

*Referenced from: `AGENTS.md` §1, §12 · `docs/core/SSOT.md` §4 · `docs/core/ARCHITECTURE.md`.*
