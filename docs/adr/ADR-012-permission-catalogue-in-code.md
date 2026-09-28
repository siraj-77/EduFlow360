# ADR-012 — Permission Catalogue Declared in Code, Synced to the Database

**Status:** 🟡 Proposed — needs sign-off
**Date:** 2026-09-28
**Deciders:** *unrecorded* (decision supplied by Prompt Pack §2.1 D-F)
**Affects:** `PLT-201`, `PLT-202`, `PLT-205` · `AGENTS.md` §2.3
**Source:** Prompt Pack §2.1 (D-F) · `EduFlow_Jira_Epics_PlatformCore_RBAC_v1.md` `PLT-201`

---

## Context

`PLT-201` stores permissions as data (`Permission` entity, `RolePermission` join). `PLT-205` maintains a living matrix that the CI static check validates routes against. `AGENTS.md` §9 forbids merging a route without a matrix row.

That means a permission key appears in at least three places: a `@RequirePermission('X')` decorator on a route, a row in the `PLT-205` matrix, and — under a database-sourced approach — a row in the `permissions` table populated at runtime.

Three sources of truth for one string is how a guard starts rejecting a legitimate request: the decorator says `ATTENDANCE_MARK`, the database has `ATTENDANCE_RECORD`, and nobody notices until a teacher cannot mark attendance.

The catalogue must be **enumerable at build time** for `PLT-205` to verify anything, and it must **survive as data** because roles reference permissions and schools define custom roles.

## Decision

**Permissions are declared in code as `MODULE_ACTION` constants, and synced to the database on deploy.**

- One exported constant per permission, e.g. `ATTENDANCE_MARK`, `FINANCE_INVOICE_REVERSE`, `AUDIT_LOG_VIEW`.
- A deploy-time sync reconciles the `permissions` table with the code catalogue. The sync is **idempotent** — running it twice changes nothing (`PLT-201` test).
- **Roles reference catalogue keys**, never hand-typed strings. A role holding a permission that no longer exists is a sync-time error, not a silent orphan.
- **The code catalogue is the authority** for *which permissions exist*. The database is the authority for *which roles hold them*.
- System roles (in-school Super Admin, School Admin) are **immutable**: they cannot be deleted or stripped of core permissions, enforced **server-side** and tested by bypassing the UI (`PLT-201`).
- **A `PLT-205` matrix row is required for every `MODULE_ACTION` key.** The Prompt Pack wires `check-route-guards` to require a row per `@RequirePermission` key, so a new route cannot ship with a permission nobody has thought about.

### Naming

`MODULE_ACTION`, uppercase, `SCREAMING_SNAKE_CASE`. This is a namespace convention, and the module prefix is what makes the catalogue readable and prevents collisions. It is not a tenancy or a hierarchy — a permission's prefix is its owning module, nothing more.

## Consequences

### Positive
- **One place defines a permission.** A typo is a compile error, not a 403 in production.
- The catalogue is **enumerable at build time**, which is what makes `PLT-205`'s static check possible at all.
- Renaming a permission is a compile-time exercise across the codebase.
- Custom roles (`PLT-201`) can only reference permissions that exist, so an admin UI cannot offer a permission the guards do not check.
- A deploy-time sync means a new permission is available to roles as soon as the version ships — no manual DB step.

### Negative / accepted costs
- **A deploy is required for a new permission to exist in the database.** A role cannot be configured to hold a permission that is not yet deployed. Correct, but worth stating.
- **Database state can drift if a migration is skipped.** Mitigated by making the sync idempotent and runnable as a migration step, so drift is corrected rather than accumulated.
- **The code catalogue and the matrix file are still two artefacts** — the constants and the `PLT-205` expectation rows. The static check ties them together, but a human reads both. `PLT-205`'s human gate exists for exactly this: the matrix *is* the authorisation policy, and the Prompt Pack requires reviewing it line by line.
- **Adds a build step** to the deploy path. Small, and it replaces a class of runtime failure.

### Neutral
- "Super Admin" means the **in-school** highest role. There is no cross-tenant role — `AGENTS.md` §2.1 forbids one, and ADR-003 confirms there is nothing for it to be cross-*tenant* about.
- Edition-based restriction on who may create custom roles reads a licence entitlement later (`PLT-302`).

## Rejected alternatives

**❌ Permissions defined only in the database, seeded by migration.** Rejected: the catalogue is then not enumerable at build time, so `PLT-205` cannot statically verify that every `@RequirePermission` key has a matrix row. The core safety property is lost. It also makes a typo a runtime 403.

**❌ Permissions as TypeScript `enum`.** Rejected: a `string` const object (`as const`) gives the same compile-time safety while remaining plain strings — which is required, because `@RequirePermission` takes a string and the value must survive serialisation into a decorator metadata argument. A numeric enum would not.

**❌ Free-text permission strings, no catalogue.** Rejected: no build-time safety, no way to enumerate, and typos become silent authorisation failures.

**❌ Declaring permissions on the route decorator as the sole source.** Rejected: the decorator is where a permission is *used*, not where it is *defined*. Scattering definitions across hundreds of routes makes the catalogue unmanageable and un-reviewable, and cannot answer "what permissions exist?"

## Links
- `AGENTS.md` §2.3, §9 (matrix row required per route) · `PLT-201`, `PLT-202`, `PLT-205`
- Prompt Pack §2.1 (D-F), §6 P6, §7 · `docs/adr/ADR-013-audit-durability-same-transaction.md`
- `docs/work/PLATFORM_CORE_PLAN.md` (RBAC matrix is seeded in Sprint 1, not deferred to `PLT-205`)

## Revisit when
- A school needs to define permissions at runtime. That is **custom roles**, which `PLT-201` already permits — the *catalogue* stays in code.
