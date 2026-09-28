# `business-rules.md` — Business Rules

> 🔴 **NOT YET EXTRACTED.**
> Required by `AGENTS.md` §6. Tracked as **`REQ-03`** in `docs/work/GAP_ANALYSIS_2026-09-28.md` §6.
> **A grep against this file returning nothing is the expected result today, not a bug** — which matters, because the Prompt Pack's story template (§4.2 Step 0) tells the agent to grep here for every story it runs. A silent empty result would send it off to invent an answer.
> See `docs/idea-bank/README.md` for the extraction spec and the citation rules.

**Status:** Placeholder. Zero rules.
**This is the highest-value file of the five.** It is the layer between ~3,000 lines of planning prose and buildable requirements.

---

## Columns this file will carry

| Column | Note |
|---|---|
| Rule ID | Stable. **Never renumbered** (`AGENTS.md` §7) |
| Statement | **One rule per row.** Do not merge related rules |
| **Source citation** | **Mandatory.** Master Plan §x / `SRS` §x / `AGENTS.md` §x / legacy file. No citation → no row |
| Edge cases | From `edge-cases-and-risks.md` |
| Affected entities | Cross-link to `domain-entities.md` |
| **Table-driven test target** | The test that proves it. A rule with no test target is a wish |

## Mandatory coverage

Every rule engine named in `AGENTS.md` §4.1 and `SRS` §10 must have **at least one row**. A rule engine with no row cannot be TDD'd, because nobody wrote down what it should do.

| Engine | Source of truth |
|---|---|
| Promotion | Master Plan §11 · `AGENTS.md` §4.1 |
| Leave accrual | Master Plan §9 · `SRS` §10 · **`PC-001`, no design exists** |
| Attendance discrepancy detection | Master Plan §8 · **`PC-000`, no design exists** |
| Licence validation + grace period | Master Plan §4 · `PLT-301`, `PLT-305` |
| GL posting | Master Plan §5.2 · `AGENTS.md` §2.6 |
| Facility / hall conflict checking | Master Plan §17.1–17.5 |
| Concession settlement | Master Plan §17.7 |
| Grading & moderation | **`PC-002`, zero rules specified** |

## The rule that matters most

> **Cite, or mark as GAP. Never invent a threshold.**

A fabricated rule is worse than a missing one, because it is indistinguishable once written down. A plausible-looking line — *"absence alert fires at 2 consecutive absences"* — will be configured against by teachers, tested, and trusted, and may be entirely invented. **A missing rule is visible. An invented one is not.**

Where the corpus is silent, the row reads:

```
GAP — needs design. Referenced by: Master Plan §8 (no threshold specified).
Blocking story: PC-000. Owner: <unassigned>. Target: <unset>.
```

Never a plausible number in place of a gap.

## Known-unresolved gaps that must appear here

`PC-000` attendance · `PC-001` leave/workforce · `PC-002` grading & moderation · `PC-003` tax & currency · `PC-004` admission · `PC-005` retail/hall · `PC-006` wallet

`PC-000`–`PC-004` are the blocking `PC-` gaps; `PC-005`/`PC-006` are **proposed and not ticketed**, which is itself the problem. See `docs/core/SSOT.md` §5.2.

---

*Companion: `docs/idea-bank/README.md` · `edge-cases-and-risks.md` · `fr-index.md` · `AGENTS.md` §4.1 (table-driven tests)*
