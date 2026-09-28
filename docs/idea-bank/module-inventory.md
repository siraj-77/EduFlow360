# `module-inventory.md` — Module Inventory

> 🔴 **NOT YET EXTRACTED.**
> Required by `AGENTS.md` §6. Tracked as **`REQ-01`** in `docs/work/GAP_ANALYSIS_2026-09-28.md` §6.
> **A grep or a read against this file returning nothing is the expected result today, not a bug.**
> See `docs/idea-bank/README.md` for the extraction spec, the citation rules, and the blocking `PC-000`…`PC-006` gaps.

**Status:** Placeholder. Zero data rows.
**Target size:** one row per module in Master Plan §5, cross-checked against the 30-row table in Master Plan §29.

---

## Columns this file will carry

| Column | Source of truth |
|---|---|
| Module name | Master Plan §5 module tree |
| Master Plan § | §5 tree |
| SRS § | `SRS` §3.x |
| Priority (P0 / P1 / P2) | `SRS` Part D §19 |
| Required entities | `SRS` §6, then `domain-entities.md` |
| Owning `apps/api/src/modules/<name>/` | derived from the module tree |
| Licence gate (`allowed_modules` key) | Master Plan §3 editions matrix, §4.2 certificate payload |
| Offline-first? | `AGENTS.md` §2.12 |
| Shared-engine dependency | `AGENTS.md` §2.9 — the engine this module must extend, not fork |
| Existing SSOT equivalent? | `SSOT.md` §4, `AGENTS.md` §2.9 — the drift check |

## Acceptance criteria when filled

- [ ] Every row of **Master Plan §29**'s 30-module cross-check table maps to an entry here.
- [ ] Every entry maps back to a §29 row. Discrepancies are **recorded, not smoothed over**.
- [ ] Every entry names its shared-engine dependency, or explicitly states it owns a new engine and why §2.9 does not already cover it.
- [ ] Every entry carries a licence gate key from the §4.2 payload.
- [ ] Every entry answers the "existing equivalent?" column.

## Known traps for whoever fills this

- **`School_Setup_Workflow_v1.md` defines gates G0–G9** for a *single school's* onboarding. Those are delivery phases, not software modules. Do not turn them into rows here.
- **§2.9's seven shared engines** must not appear as separate modules. Attendance, stock, facility booking, approvals, documents, notifications and ledger are engines that *other* modules extend.
- **`PC-004` (admission) is in the MVP list with no FR behind it** — it needs a row *and* an FR, and both are missing.
- **BookShop / Canteen / School Hall** come from Master Plan v5.2 §17.6–17.9, which is **newer than the earlier corpus extraction**. §17 wins where the two disagree.

---

*Companion: `docs/idea-bank/README.md` · `business-rules.md` · `domain-entities.md` · `fr-index.md` · `edge-cases-and-risks.md`*
