# `domain-entities.md` — Domain Entities

> 🔴 **NOT YET EXTRACTED.**
> Required by `AGENTS.md` §6. Tracked as **`REQ-02`** in `docs/work/GAP_ANALYSIS_2026-09-28.md` §6.
> **A read against this file returning nothing is the expected result today, not a bug.**
> See `docs/idea-bank/README.md` for the extraction spec, the citation rules, and the blocking `PC-000`…`PC-006` gaps.

**Status:** Placeholder. Zero entity definitions.
**Target size:** every entity in `SRS` §6 plus the Platform Core set, and the ERD (`ARC-01`).

---

## Columns this file will carry

| Column | Note |
|---|---|
| Entity name | PascalCase |
| Fields + types | TypeScript-precise. No `any`. |
| Constraints | DB-level, not just application-level |
| `schoolId` flag | `AGENTS.md` §2.1 — carry the column as **metadata, not a security control** |
| Money flag | `AGENTS.md` §2.5 — if true: **integer minor units + explicit currency code**, never `float` |
| Owning module | `apps/api/src/modules/<name>/domain/entities/` |
| Port (if external) | `IBellHardwareAdapter`, `ISmsAdapter`, `IStorageAdapter`, … — `AGENTS.md` §2.2 |
| **Existing equivalent?** | `AGENTS.md` §6 — *"creating a parallel concept under a new name is the most common way this codebase drifts"* |

That last column is the reason this file exists separately from the ERD. It is the check that runs at **entity-creation time**, not at review time.

## Entities Platform Core requires

Recorded here so the extraction cannot omit them, not as definitions:

`User` · `Role` · `Permission` · `RolePermission` · `Session` · `RefreshToken` · `AuditRecord` · `ErrorLog` · `SchoolSettings` · `ModuleRegistry` · `License` · `NotificationPreference` · `NotificationDelivery` · `StoredFile`

Plus, from `SRS` §6, the domain entities behind the 33 Platform Core stories' acceptance criteria.

## Rules for whoever fills this

- **Money is never a float.** `amount_minor: bigint` + `currency`. Per-school scale comes from settings, never a constant (`AGENTS.md` §2.5, §8).
- **Uniqueness is scoped within one school's database.** Never assume a global `@unique` — under ADR-003 that constraint would be *wrong*, not merely redundant, because two schools in one database may legitimately hold the same value.
- **Do not port legacy scoping columns as a mechanism.** `AGENTS.md` §5.1 permits reusing entity *field semantics*; it forbids re-importing the tenancy enforcement mechanism. `docs/analysis/LEGACY_REUSE_INVENTORY.md` §3.1.
- **The legacy schema has 59 models and 23 enums.** Most are tenancy-shaped and will not survive. Field semantics may; mechanism will not.
- **The D1 carve-out applies.** Attendance, Leave and Grading are **designed fresh**. This file may state what those entities must do; it must not import the legacy implementation as the specification.
- **`Student`, `Class` and `Teacher` must not be invented in Platform Core** (Prompt Pack §2.2, §9). The ownership engine (`PLT-203`) is built against **abstract ports with fakes**; the real entities arrive with the Academic module.

---

*Companion: `docs/idea-bank/README.md` · `module-inventory.md` · `business-rules.md` · `fr-index.md`*
