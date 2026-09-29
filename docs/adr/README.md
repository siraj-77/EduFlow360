# Architecture Decision Records

`AGENTS.md` §1 names `ADR-003` as the governing decision. All decisions of record are indexed here.

---

## Index

| ADR | Title | Source | Status |
|---|---|---|---|
| [ADR-001](ADR-001-monorepo-toolchain.md) | Monorepo with pnpm workspaces and Turborepo | `SRS` §15/§17 | 🟡 Proposed |
| [ADR-002](ADR-002-money-as-integer-minor-units.md) | Money as integer minor units, scale per school | `AGENTS.md` §2.5 | 🟡 Proposed |
| **[ADR-003](ADR-003-new-app-single-tenant-selective-reuse.md)** | **New application, single-tenant, selective legacy reuse** | `AGENTS.md` §1, §2.1, §5 | ⚠️ **RECONSTRUCTED — needs sign-off** |
| [ADR-004](ADR-004-time-via-injected-clock.md) | Time via an injected `IClock` | `AGENTS.md` §2.4 | 🟡 Proposed |
| [ADR-005](ADR-005-mobile-is-milestone-2.md) | `apps/mobile` is milestone 2 | `AGENTS.md` §7 (D5) | ⚠️ **CONFLICTS with `SRS` §19** |
| [ADR-006](ADR-006-licensing-ships-in-milestone-1.md) | Licensing ships in milestone 1 | `AGENTS.md` §7 (D4) | 🟡 Proposed |
| [ADR-007](ADR-007-password-hashing-argon2id.md) | Password hashing: argon2id behind `IPasswordHasher` | Prompt Pack D-A | 🟡 Proposed |
| [ADR-008](ADR-008-token-strategy-jwt-refresh-rotation.md) | Token strategy: short-lived access JWT, rotating refresh with family reuse detection | Prompt Pack D-B | 🟡 Proposed |
| [ADR-009](ADR-009-licence-signature-ecdsa-canonical-json.md) | Licence signature: ECDSA P-256 over **canonical JSON** | Prompt Pack D-C | 🟡 Proposed |
| [ADR-010](ADR-010-activation-server-external-boundary.md) | Activation server is an **external vendor service** | Prompt Pack D-D | 🟡 Proposed · **answers ⚑6** |
| [ADR-011](ADR-011-instance-fingerprint-install-id.md) | Instance fingerprint: stable install ID, **not MAC** | Prompt Pack D-E | 🟡 Proposed |
| [ADR-012](ADR-012-permission-catalogue-in-code.md) | Permission catalogue declared **in code** | Prompt Pack D-F | 🟡 Proposed |
| [ADR-013](ADR-013-audit-durability-same-transaction.md) | **Audit durability: same-transaction write** | Prompt Pack D-G | 🟡 Proposed · **resolves conflict C1** |
| [ADR-014](ADR-014-email-adapter-smtp.md) | Email behind `INotificationChannelAdapter` (SMTP, Mailpit in dev) | Prompt Pack D-H | 🟡 Proposed |
| [ADR-015](ADR-015-object-storage-minio-s3.md) | Object storage: S3-compatible behind `IStorageAdapter`, MinIO in dev | Prompt Pack D-I | 🟡 Proposed |
| [ADR-016](ADR-016-metrics-prometheus.md) | Metrics in Prometheus exposition format | Prompt Pack D-J | 🟡 Proposed |
| [ADR-017](ADR-017-deviations-from-jira-sprint-order.md) | **Documented deviations from the Jira sprint order** (4 pull-forwards) | Prompt Pack §2.2 | 🟡 Proposed |
| [ADR-018](ADR-018-public-route-escape-hatch.md) | `@Public('<reason>')` is the only route exemption, and it is allowlisted | Prompt Pack §P3.2/§P4.7 | 🟡 Proposed |
| [ADR-019](ADR-019-docker-optional-persistence-disabled-state.md) | **Docker is optional: an explicit `persistence: 'disabled'` boot state** | Owner decision 2026-09-28 | 🟡 Proposed · **deviates from Prompt Pack §1.1** |

**19 ADRs. Numbering is contiguous 001–019 and must stay that way** — the Prompt Pack §6 P1 instruction is to "continue after the highest existing ADR".

---

## ⚠️ Read these two first

**`ADR-003` did not exist as a file until 2026-09-28**, despite `AGENTS.md` §1 citing it as the governing decision and §1's own precedence rule making it win over every other planning document. It was **reconstructed from `AGENTS.md`**. The content is a faithful restatement of rules that appear in `AGENTS.md`, but it is **not** a contemporaneous record of the deliberation, the alternatives weighed, or who decided. **It requires owner sign-off.** Rationale: `docs/work/WORKLOG.md` D19.

**`ADR-005` conflicts with `SRS` §19.** `AGENTS.md` §7 (D5) makes `apps/mobile` milestone 2; `SRS` §19 places a Parent/Student Personal Portal in the MVP, and `SRS` §20 acceptance criterion 5 requires it. Per `AGENTS.md` §1's precedence rule, **`AGENTS.md` wins and `SRS` §19 is the document in error** — so the ADR records the decision, and the open item is amending `SRS`.

---

## Status meanings

| Status | Meaning |
|---|---|
| ✅ **Accepted** | Binding. Code must comply. |
| 🟡 **Proposed** | Written down, awaiting owner approval |
| ⚠️ **Reconstructed / Conflicting** | Recovered from another document, or contradicts one. Both need sign-off. |
| 🔴 **Superseded** | Replaced by a later ADR |

**No ADR is `Accepted`.** Nothing in this directory has been signed off. That is expected — these were written on one day, and the Prompt Pack §6 P1 prompt exists precisely to get them approved before code is written.

---

## Format

```markdown
# ADR-NNN — <Title>

**Status:** 🟡 Proposed
**Date:** YYYY-MM-DD
**Deciders:** <who>
**Affects:** <modules, files, decisions>
**Source:** <the document or decision this comes from>

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

## Links
## Revisit when
The observable condition that would invalidate this.
```

---

## When an ADR is required

Write one when a decision is **expensive to reverse**, **constrains future work**, or **was non-obvious enough that a competent engineer would plausibly have chosen differently**.

In this codebase that means, at minimum:
- Any addition to, or removal from, the shared engines table (`AGENTS.md` §2.9)
- Any change to the three mandatory guards, or to fail-closed behaviour — see ADR-018
- Any change to the tenancy model (`AGENTS.md` §2.1) — **especially any proposal to add tenant scoping**
- Any new state-management library, ORM, CSS framework or build tool (`AGENTS.md` §8)
- Any decision to port a legacy file (requires a row in `LEGACY_REUSE_INVENTORY.md` **and** an ADR if the port is non-obvious)
- Any licensing, money, time or identity decision
- Any deviation from a governing document's stated order or content — see ADR-017
- Anything resolving one of the Open Questions in `docs/core/SSOT.md` §7

---

*Referenced from: `AGENTS.md` §1, §12 · `docs/core/SSOT.md` §4 · `docs/core/ARCHITECTURE.md` · Prompt Pack §6 P1.*
