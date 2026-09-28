# `fr-index.md` — Functional Requirement Index

> 🔴 **NOT YET EXTRACTED.**
> Required by `AGENTS.md` §6. Tracked as **`REQ-04`** in `docs/work/GAP_ANALYSIS_2026-09-28.md` §6.
> **A grep for `FR-PLT` against this file returning nothing is the expected result today, not a bug** — and the Prompt Pack greps here for every Platform Core story (§4.2 Step 0, §10.5).
> See `docs/idea-bank/README.md` for the extraction spec and the citation rules.

**Status:** Placeholder. Zero requirement rows.
**Purpose:** the traceability backbone joining `SRS` → epics → stories → tests.

---

## Columns this file will carry

| Column | Note |
|---|---|
| FR ID | `FR-PLT-01`…`FR-PLT-08`, `FR-ACA-*`, `FR-ATT-*`, `FR-FIN-*`, `FR-COM-*`, `FR-DOC-*`, `FR-MOB-*`, `FR-WFM-*`, `FR-LRN-*`, `FR-LIB-*`, `FR-TRP-*`, `FR-RET-*`, `FR-CAN-*`, `FR-BKS-*`, `FR-FAC-*`, `FR-EVT-*`, `FR-ALM-*`, `FR-LDR-*`, `FR-AI-*`, `FR-HLP-*` |
| Statement | Verbatim from `SRS` Part A |
| **Source §** | Mandatory |
| MVP flag | P0 / P1 / P2 per `SRS` Part D §19 |
| **Implementing epic / story** | `PLT-*` where known; **`unassigned`** otherwise — never left blank |
| **Test reference** | Which test proves it |

## Platform Core requirements in scope

`SRS` §3.1 maps to the 33 stories in `EduFlow_Jira_Epics_PlatformCore_RBAC_v1.md`. The Jira document states its own source range as **FR-PLT-01 → FR-PLT-08**.

The mapping is **not yet 1:1** and this file is where the mismatch becomes visible. Known gaps that must appear as `unassigned` or `GAP` rows rather than being quietly dropped:

| Gap | Why |
|---|---|
| **First-admin bootstrap** | School Setup Workflow §6.5 requires a one-time setup token. **No `PLT` story covers it.** Prompt Pack §2.2 proposes `PLT-107`. |
| **Social login (Google / Microsoft / Apple / Facebook)** | Not in the Platform Core epics. Prompt Pack §2.2: out of scope. `AGENTS.md` §13 additionally forbids implementing them without confirmed client credentials. |
| **MFA** | Not in the Platform Core epics. Out of scope this milestone. |
| **M1/M2 milestone labels** | Ambiguous across `SRS` §24, the Prompt Pack §7 and `AGENTS.md` §7. See the legend in `docs/core/SSOT.md`. |

## Why the "unassigned" column matters

An FR with a blank implementation column is a requirement nobody owns. An FR with **no row at all** is worse — it is invisible, and "MVP acceptance criterion met" becomes an assertion rather than a demonstration. This file exists so that `SRS` §20's eight MVP acceptance criteria can be *demonstrated* by pointing at a test, not merely asserted.

---

*Companion: `docs/idea-bank/README.md` · `business-rules.md` · `PLATFORM_CORE_PLAN.md` §7 (per-story TDD obligations)*
