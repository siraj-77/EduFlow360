# IDEA-BANK — Requirements Extraction

**Status:** 🔴 **EMPTY BY DESIGN. Extraction not yet performed.**
**Why this directory has a README and no content:** see §3 below.
**Referenced by:** `AGENTS.md` §6 — *"The authoritative requirements are in `docs/idea-bank/`, extracted from the archived planning corpus."*
**Tracked as:** `REQ-01` … `REQ-07` in `docs/work/GAP_ANALYSIS_2026-09-28.md` §6

---

## 1. Why This Matters

`AGENTS.md` §6:

> **Read the relevant idea-bank section before implementing any module.**
> **Before creating any entity, enum, interface or engine, check `docs/core/SSOT.md`, the idea-bank and §2.9 for an existing equivalent** — creating a parallel concept under a new name is the most common way this codebase drifts.

This is the layer between **planning prose** (Master Plan v5.2 — 1,046 lines; `SRS` v1.2 — 573 lines; School Setup Workflow — 1,443 lines) and **buildable requirements**.

**Without it, every story author independently reconstructs requirements from ~3,000 lines of prose.** Different modules will interpret the same passage differently. Nothing will break in CI. It will surface months later as modules that disagree about the same rule.

**This is the highest-leverage non-code work in the plan.** It is documentation-only, has zero code dependencies, and unblocks every later domain epic.

---

## 2. The Five Files to Produce

`AGENTS.md` §6 names these with the counts the extraction should reach.

### 2.1 `module-inventory.md`

All domains from Master Plan §5, each with:

| Column | Source |
|---|---|
| Module name | Master Plan §5 tree |
| Master Plan § | §5 tree |
| SRS § | `SRS` §3.x |
| Priority (P0/P1/P2) | `SRS` Part D §19 |
| Required entities | `SRS` §6 |
| Owning `apps/api` module folder | derived |
| Licence gate (`allowed_modules` key) | Master Plan §3 matrix / §4.2 payload |
| Offline-first? | `AGENTS.md` §2.12 |
| Shared engine dependency | `AGENTS.md` §2.9 |

**Acceptance:** cross-checked against **Master Plan §29's 30-row module-coverage table** — every row must map to an inventory entry, and every inventory entry to a §29 row. Discrepancies are recorded, not smoothed over.

### 2.2 `domain-entities.md`

Per entity: name, fields + types, constraints, `schoolId` flag, money flag, owning module, and — critically — **an "existing equivalent" check** stating whether an equivalent already exists in `SSOT.md` or `AGENTS.md` §2.9.

That last column is what enforces `AGENTS.md` §6's rule at creation time. Without it, the check is an archaeology exercise every time.

> **Money entities must be flagged.** `AGENTS.md` §2.5: integer minor units + explicit currency. Never `float`.

### 2.3 `business-rules.md`

The highest-value file. One row per rule:

| Column | Note |
|---|---|
| Rule ID | Stable, never renumbered |
| Statement | One rule, one row |
| **Source citation** | **Mandatory.** Master Plan §x / `SRS` §x / `AGENTS.md` §x / legacy file |
| Edge cases | From `edge-cases-and-risks.md` |
| Affected entities | Cross-link |
| **Table-driven test target** | Which test proves it |

**Mandatory coverage** — every rule engine named in `AGENTS.md` §4.1 and `SRS` §10 must have at least one row:

- Promotion
- Leave accrual
- Attendance discrepancy detection
- Licence validation (incl. grace-period boundary)
- GL posting
- Facility / hall conflict checking
- Concession settlement

Plus: `SRS` §11's module-by-module test plan is the checklist for what must be represented.

### 2.4 `fr-index.md`

| Column | Note |
|---|---|
| FR ID | `FR-PLT-01`, `FR-ACA-02`, `FR-FIN-01`, `FR-ATT-01`… from `SRS` Part A |
| Statement | Verbatim from `SRS` |
| Source § | Mandatory |
| MVP flag | P0 / P1 / P2 per `SRS` Part D §19 |
| **Implementing epic / story** | `PLT-*` where known; "unassigned" otherwise |
| **Test reference** | Which test proves it |

This is the traceability backbone joining `SRS` → epics → tests. Without it, "MVP acceptance criterion met" is an assertion rather than a demonstration.

### 2.5 `edge-cases-and-risks.md`

Boundary conditions, failure modes, known gaps. Every entry maps to a test.

**Must explicitly list the unresolved `PC-000` … `PC-006` design gaps** with their blocking impact (see §4).

---

## 3. 🔴 Why There Is No Content Here Yet

**A fabricated business rule is worse than a missing one.**

Consider what a plausible-looking invented rule looks like once written down:

> *"Absence alert is sent to the parent when a student is marked absent for 2 or more consecutive periods."*

Every downstream story would trust it. Teachers would configure against it. It would be tested, and the test would pass. And it may be **completely invented** — the corpus may never have specified a threshold, and the real school may need 1, or 3, or a percentage-of-day.

**A missing rule is visible. An invented one is not.** The failure mode is silent, it propagates across every module that touches attendance, and it is discovered during UAT with a school.

**Therefore:** every entry carries a **source citation**. Where the corpus is silent, the entry reads:

```
GAP — needs design. Referenced by: Master Plan §8 (no threshold specified).
Blocking story: PC-000. Owner: <unassigned>. Target: <unset>.
```

Never a plausible number in place of a gap.

---

## 4. Blocking gaps that MUST appear in the extraction

`AGENTS.md` §6.1. These domains **cannot be built** until designed. `REQ-07` requires each to be either designed, or **formally deferred with a named owner and a target milestone**.

| Gap | Blocks | Ticket | State |
|---|---|---|---|
| Attendance — no design at all | Attendance module | `PC-000` | Unresolved |
| Leave / Workforce — no design at all | Workforce, leave accrual | `PC-001` | Unresolved |
| Grading & Moderation — P0, zero rules | Exams, report cards, promotion, analytics | `PC-002` | Unresolved |
| Tax & currency — never mentioned, despite invoicing | Fees, payroll, procurement | `PC-003` | Unresolved. `ADR-002` decides the *representation* only |
| Admission — in the MVP list, no FR behind it | MVP scope | `PC-004` | Unresolved. Also affects the ERD (`ARC-01`) |
| BookShop / Canteen / School Hall — in Master Plan v5.2 §17.6–17.9, **newer than the idea-bank extraction** | Retail outlets, hall rental | `PC-005` | **Proposed, not ticketed** |
| Student Wallet — stored-value legal review + GL design | Wallet | `PC-006` | **Proposed, not ticketed** |

`PC-005` and `PC-006` being unticketed is itself the problem — it is how they got here. An unticketed deferral is not a deferral.

---

## 5. Open Dependency ⚑

`AGENTS.md` §12 states the original corpus lives at **`docs/archive/corpus/`**. **That directory does not exist.**

| Consequence | Effect on the extraction |
|---|---|
| Corpus **available** | True extraction with verifiable citations. Best case. |
| Corpus **deliberately deleted** | Extraction from Master Plan + `SRS` + `AGENTS.md`. Weaker but workable — those three are detailed and mutually consistent. |
| Corpus **never migrated** | Same as above, plus a provenance gap worth recording. |

**Tracked as `TODO.md` ⚑2 / `SSOT.md` §7. Must be resolved before `REQ-01` starts**, because it determines whether citations point at a primary source or at a summary of a summary.

---

## 6. Extraction Rules

1. **Cite or mark as GAP.** Never assert an uncited rule.
2. **One rule per row.** Do not merge related rules.
3. **Never invent a threshold, formula, rate or schedule.** If the corpus is silent, it is silent.
4. **Respect the D1 carve-out.** Attendance, Leave and Grading are designed fresh (`AGENTS.md` §5.1) — the idea-bank may describe what they must do, but must not import the legacy implementation as the specification.
5. **Precedence:** `AGENTS.md` and `ADR-003` win over Master Plan and `SRS`. Where they disagree, follow `AGENTS.md` and **flag the discrepancy** rather than silently reconciling.
6. **Prefer the newer document.** Master Plan v5.2 §17 (retail, hall) post-dates the earlier extraction — where the two conflict, v5.2 wins.
7. **Every rule gets a test target.** A rule with no test target is a wish.
8. **Record what is missing.** A complete extraction that silently omits a domain is worse than a partial one that says what it does not cover.

---

## 7. Next Action

```
REQ-01  module-inventory.md          5 pts   P0
REQ-02  domain-entities.md           8 pts   P0
REQ-03  business-rules.md            8 pts   P0
REQ-04  fr-index.md                  5 pts   P0
REQ-05  edge-cases-and-risks.md      5 pts   P1
REQ-06  SSOT "existing equivalent" index  2 pts   P1
REQ-07  Resolve or formally defer PC-000…PC-006   3 pts  P1
```

**Resolve ⚑2 (`docs/archive/corpus/`) before starting `REQ-01`.**

Full detail: `docs/work/GAP_ANALYSIS_2026-09-28.md` §6 (EPIC REQ).

---

*Referenced by `AGENTS.md` §6, §6.1, §12 · Companion: `docs/core/SSOT.md` §6 · `docs/work/TODO.md` · `docs/work/PLATFORM_CORE_PLAN.md`.*
