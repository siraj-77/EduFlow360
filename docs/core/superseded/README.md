# Superseded documents

These are the previous generation of the planning documents. They are kept for history and
traceability. **They are not authoritative** — do not build against them.

| Superseded file | Replaced by |
|---|---|
| `EduFlow_Project_Master_Plan_v5.2.md` | `docs/core/EduFlow360_Project_Master_Plan_v5.3.md` |
| `EduFlow_SRS_TestPlan_MVP_Roadmap_v1.2.md` | `docs/core/EduFlow360_SRS_TestPlan_MVP_Roadmap_v1.3.md` |
| `EduFlow_School_Setup_Workflow_v1.md` | `docs/core/EduFlow360_School_Setup_Workflow_v1.1.md` |
| `EduFlow_Jira_Epics_PlatformCore_RBAC_v1.md` | `docs/core/EduFlow360_Jira_Epics_PlatformCore_RBAC_v2.md` |

No successor existed for the Agentic Prompt Pack, so
`docs/core/EduFlow_Agentic_Prompt_Pack_PlatformCore_v1.md` stayed in `docs/core/` and
**remains the execution-order document**. It is referenced from `AGENTS.md` and is still live.

## Known drift between the two generations

The `v5.3` / `v1.3` refresh landed in documentation only and has **not** been reconciled
against `docs/core/SSOT.md` or the ADRs. Recorded here so the difference is not mistaken for
a defect:

| Area | `_v5.2` / `_v1.2` | `_v5.3` / `_v1.3` | Reconciled? |
|---|---|---|---|
| School Setup (6 tabs) | absent | Master Plan §5A | **no** — no code |
| Academic Setup | absent | Master Plan §5B, `FR-ACD-01..16` | **no** — no code |
| Platform requirements | `FR-PLT-01..15` | `FR-PLT-01..15` + `FR-SET-01..12` | partly |
| Basic General Ledger | absent | Master Plan §5.2 | **no** |
| Milestones | one set | a second, conflicting set | **no** — three definitions of "M2" exist across the docs |
| Roadmap phases | 16 | 17 (adds Phase 1A) | **no** — two roadmaps |

The reconciliation plan is
[`docs/superpowers/plans/2026-10-09-strategic-roadmap-v2.md`](../../superpowers/plans/2026-10-09-strategic-roadmap-v2.md),
Phases C and D.

When you need a decision, `docs/core/SSOT.md` and `docs/adr/` outrank **both** generations.