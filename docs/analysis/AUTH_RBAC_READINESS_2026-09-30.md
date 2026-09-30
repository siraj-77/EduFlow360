# Authentication, RBAC and Entitlement — readiness assessment

**Date:** 2026-09-30 · **Author:** `opencode` / space-bunny-free · **Status:** assessment, no code changed

Answers a direct question: _can the platform do OAuth login, roles/permissions, page- and
module-level access, CRUD + print/export permissions, backend authorization, an admin UI for
dynamic permissions, route protection, and permission-driven UI visibility?_

**Short answer: the data model can express all ten. None of the ten is implemented.** The gap
is not design; it is that `PLT-EPIC-01` and `PLT-EPIC-02` have not been started. This document
separates the two so the next story does not re-derive it.

---

## 1. What exists, measured

| Thing                                                     | State                  | Evidence                                                                                      |
| --------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------- |
| `User` `Role` `Permission` `RolePermission` tables        | ✅ **exist and apply** | 14 tables created in `eduflowdb_new`; FKs enforced by `database-contract.integration.spec.ts` |
| `Permission.key` shaped `MODULE_ACTION`                   | ✅ exists              | `schema.prisma:230` — _"e.g. `FINANCE_INVOICE_REVERSE`"_                                      |
| `Role.isSystemRole` immutability flag                     | ✅ exists, unused      | `ADR-012`                                                                                     |
| `ModuleRegistry`, `License`, `SchoolSettings` tables      | ✅ exist               | entitlement + module gating data                                                              |
| `SCHOOL_ADMIN` + 8 permissions seeded                     | ✅ exists              | `prisma/seed.mjs`, idempotent, verified by running twice                                      |
| `@RequirePermission` / `@RequireEntitlement` / `@Audited` | ❌ **not implemented** | 0 `CanActivate`; no `src/common/guards`                                                       |
| Permission catalogue in code                              | ❌ **not implemented** | 0 files matching `*permission*`                                                               |
| Login endpoint                                            | ❌ **not implemented** | `PLT-101` unstarted; `@node-rs/argon2` not installed                                          |
| OAuth providers                                           | ❌ **not implemented** | see §5                                                                                        |

**Every grep hit for `RequirePermission` is inside a spec asserting the guard is _documented_
in a schema comment** — `prisma-schema.spec.ts:20` and `project-erd.spec.ts:197`. Neither is an
implementation. Reading those hits as "RBAC exists" is the specific mistake this section exists
to prevent.

---

## 2. How strong is the RBAC design?

**The design is strong. The enforcement is absent.** Those are different claims and only the
first is currently true.

### What the design gets right

- **Capabilities are data, not code paths.** `Permission.key` is `MODULE_ACTION`, so
  `FINANCE_INVOICE_REVERSE` and `STUDENT_EXPORT_PRINT` are rows. A new action is a row, not a
  branch — which is what makes an admin UI possible at all.
- **Layered gates, all mandatory.** `AGENTS.md` §2.3 requires `@RequirePermission`,
  `@RequireEntitlement` and `@Audited` to compose on every route, with `@Public('<reason>')` as
  the only exemption and a checked-in allowlist. A route with neither permission nor public is
  a CI failure.
- **Role/permission immutability.** `isSystemRole` plus `ADR-012` means a system role cannot be
  stripped of core permissions by an admin. Without that, an admin UI can lock the school out of
  its own system — the most likely way a permission system becomes a liability.
- **Physical isolation upstream.** `AGENTS.md` §2.1: one database per school, so RBAC is
  defence in depth _inside_ a school, never the thing preventing cross-school access. That
  removes an entire class of bug the guards cannot otherwise catch.
- **Frontend gate is explicitly not the boundary.** §2.3 states the UI check is UX only. Hidden
  buttons are an affordance, not a control.

### The three real weaknesses

1. **No ownership policy yet.** `AGENTS.md` §2.3 also mandates `IOwnershipPolicy` — teacher → own
   classes, parent → own children, vendor → own outlet — with role-denial and ownership-denial
   distinguishable in logs. This is _not_ substitutable by a role check, and it is the part most
   likely to be forgotten, because every route looks correctly guarded before it is wrong.
2. **Single role per user.** `User.roleId` is one FK, not a join. A teacher who is also a parent
   **cannot be expressed** (`ERD:84`). `D-4.1` is decided (a `UserRole` join) but not applied, and
   the schema change must land in the same commit as the amendment to the deliberate 14-model
   ERD tripwire.
3. **Six capabilities have no licence key.** `ARC-10`: facilities hire, hall rental, wallet,
   alumni, leadership, substitution are absent from the signed payload, so
   `@RequireEntitlement` cannot be written for them. That blocks half of `F-2` and `PLT-302`.

### Verdict

Design-grade. Not yet enforceable. A permission system is only as strong as its weakest
unimplemented rule, and right now there is no implemented rule at all.

---

## 3. The ten capabilities

Legend — **Data**: can the schema express it today. **Code**: is it implemented.

| #   | Capability                           | Data | Code | Notes and what is missing                                                                                                                                                                                                                                 |
| --- | ------------------------------------ | ---- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Authentication**                   | ✅   | ❌   | `User` has `passwordHash`, `passwordAlgorithm`, `failedLoginAttempts`, `lockedUntil`, `lastLoginAt`, `mustChangePassword` — the columns are all correct. No hasher, no route, no lockout logic. `PLT-101`                                                 |
| 2   | **OAuth login**                      | ⚠️   | ❌   | See §5. `User.email` is unique per school and `NOT NULL` _by design_ — the schema comment calls nullable-unique a trap. So an OAuth user must still get an email, or the identity link is a new table. **This is the one place OAuth is not a free add.** |
| 3   | **Roles and permissions**            | ✅   | ❌   | `Role`, `Permission`, `RolePermission` all exist, FK-enforced, seeded. No catalogue in code, no resolution service                                                                                                                                        |
| 4   | **Page-level access**                | ⚠️   | ❌   | No route→permission mapping table, and none is needed — it belongs in the code catalogue (`ADR-012`). Must live somewhere queryable, or the admin UI cannot render it                                                                                     |
| 5   | **Module-level access**              | ✅   | ❌   | `ModuleRegistry` + `License` exist. Blocked for 6 capabilities by `ARC-10`                                                                                                                                                                                |
| 6   | **View / Create / Edit / Delete**    | ✅   | ❌   | Straight `MODULE_ACTION` rows: `STUDENT_VIEW`, `STUDENT_CREATE`, `STUDENT_EDIT`, `STUDENT_DELETE`. The model was designed for exactly this                                                                                                                |
| 7   | **Print / export permissions**       | ✅   | ❌   | Same mechanism: `STUDENT_EXPORT_PRINT`. Worth its own action keys — print and export have different data-exposure risk, and `AGENTS.md` §2.13 treats data minimisation as a privacy requirement, not a preference                                         |
| 8   | **API / backend authorization**      | ✅   | ❌   | NestJS guards, zero implemented. This is the boundary; everything else is convenience                                                                                                                                                                     |
| 9   | **Dynamic permissions via admin UI** | ✅   | ❌   | CRUD over `Role`/`Permission`/`RolePermission`. Two constraints: `isSystemRole` roles are immutable (`ADR-012`), and every change must be `@Audited`. An admin UI that silently edits a system role is a lockout vector                                   |
| 10  | **Route protection**                 | ✅   | ❌   | §2.3 already specifies the exact shape. The **UI-side** half is _done and enforced_: `apps/web/src/config/ui-primitive-rules.spec.ts` (9 cases) proves the raw-element ban fires, which was the P3 human gate                                             |
| 11  | **UI button/menu visibility**        | ✅   | ❌   | Straightforward once #3 lands. §2.3 is explicit that this is UX and never the security boundary — so a hidden button is not a control, and the test must prove the _server_ still rejects the request                                                     |

**Score: 11 of 11 expressible in the data model, 1 of 11 partly blocked (OAuth identity), 0 of 11
implemented in the API.**

That is the honest shape of the project right now: a well-designed foundation with no building on
it. It is a good position to be in _before_ `PLT-EPIC-01` starts, and a bad one to discover later.

---

## 4. The UUID issue

Two distinct things share that name. Both are handled; one is fully closed and one is open by
design.

### 4.1 Closed — foreign keys were unbuildable

Every model `id` carried `@db.Uuid`; **no relation scalar did.** All 11 (`User.roleId`,
`RolePermission.roleId`/`.permissionId`, `Session.userId`, `RefreshToken.userId`/`.sessionId`,
`SchoolSettings.updatedById`, `NotificationPreference.userId`, `NotificationDelivery.userId`/
`.notificationPreferenceId`, `StoredFile.uploadedById`) were plain `String`, so `text` referenced
`uuid` and PostgreSQL refused:

```
ERROR: foreign key constraint "users_role_id_fkey" cannot be implemented
DETAIL: ... "role_id" ... and "id" ... are of incompatible types: text and uuid
```

**Why no gate caught it:** `prisma-schema.spec.ts` passed throughout, because Prisma _accepts_
the schema and only refuses at apply time. A schema that parses is not a schema that applies.

**How it stays closed:** `database-contract.integration.spec.ts` asserts 11 foreign keys exist,
that `roles.id` is `uuid` and not `text`, and — the part that matters — that a user with a missing
role is _rejected_. A future regression in the source now fails a mandatory gate instead of
waiting for the next human to run `db push`.

**Prevention:** fixed in `schema-source.mjs` (the ARC-01 source), not the generated
`schema.prisma`. The rule used to find them is mechanical: an `attrs` array holding an `@map`
whose next line is `kind: 'relation'`.

### 4.2 Open by design — `schoolId`

`seed.mjs` hard-codes `00000000-0000-4000-8000-000000000001` as the school id, overridable by
`SEED_SCHOOL_ID`. That is deliberate but it is a **development convenience, and it is the one
place the single-tenant design has a rough edge.**

`AGENTS.md` §2.1 is explicit that `schoolId` is **metadata, not a security control**: no query is
scoped by it, no guard reads it, there is no `School` table and no foreign key. Isolation is
physical — one database per school. So a fixed constant is _harmless_ today.

It is also the reason three things are non-obvious, and each will bite later:

1. **Uniqueness is scoped by `schoolId`** (`@@unique([schoolId, email])`). That is correct and
   necessary, but it means a _wrong_ `schoolId` is a silent second identity, not an error.
2. **Production must not inherit the constant.** If a deployment ever seeds with the dev default,
   two schools could share an id — harmless under §2.1, but it would invalidate any future licence
   portability. The seed is dev-only; `PLT-107` is the production path.
3. **It is not a licence boundary.** If per-school data ever _does_ need isolation that
   `§2.1` no longer provides, this constant is where it would first be wrong.

**Recommendation, deliberately not implemented here:** a `SEED_SCHOOL_ID` that is **required** in
CI (so an integration test can never silently use the dev default), while staying defaulted
locally. One assertion, in the integration suite, closes it. Deferred because it is a
convenience rather than a defect, and inventing urgency is worse than a recorded one.

---

## 5. OAuth — the one place this is not a free add

`AGENTS.md` §13 forbids implementing real Google/Microsoft/Apple/Facebook OAuth without
confirming which client credentials and redirect URIs are configured for the current environment.
That stands and was not bypassed here.

**The schema complication.** `User.email` is `NOT NULL` and unique per school, and the schema
comment says why: _"Nullable-unique is a trap: PostgreSQL treats NULLs as distinct, so
`email String?` with a `@@unique` would constrain nothing and two accounts could collide."_ So an
OAuth-only user with no email has nowhere to go, and making it nullable would _remove_ a
constraint rather than add one.

**The two viable shapes:**

| Shape                                           | What it needs                                                                                                          | Cost                                                                                                                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — link to an existing account**             | OAuth identity table keyed to `userId`; user signs up with email+password first, then links a provider                 | Smallest. No schema change. Cannot be the _first_ login — which conflicts with a bootstrap admin                                                                           |
| **B — provider identity as a first-class link** | `ExternalIdentity { provider, providerSubject, userId }` with a **unique constraint on `(provider, providerSubject)`** | The provider subject, not the email, is the stable key — provider emails change and are unverified in some flows. This is what `PLT-101` should build if OAuth is in scope |

**Recommendation: B, built inside `PLT-101`, and not before.** A is a retrofit; identity
linkage done twice is how duplicate accounts appear. The real sequencing constraint is that
`PLT-107`'s setup token is the _first_ login of a fresh install — so OAuth cannot be the bootstrap
path regardless of shape.

**Credentials remain unconfirmed.** No client id, secret or redirect URI for any provider is
present in this repository or environment, and none was invented. This is blocked on you.

---

## 6. What this means for sequencing

```
PLT-101  auth + identity      ──> needs: argon2id, ExternalIdentity (B), lockout, PLT-107 token
PLT-202  RBAC engine          ──> needs: permission catalogue, guards, ownership policy
ARC-10   6 licence keys       ──> needs: canonical payload + verifier change  (blocks F-2)
D-4.1    UserRole join        ──> needs: schema + ERD tripwire, ONE commit
```

The dependency that is easiest to get wrong: **role checks are not ownership checks.** A guard that
verifies `STUDENT_EDIT` and nothing else is a correct-looking guard that lets any teacher edit any
student. `IOwnershipPolicy` (`§2.3`) is the part that stops it, and it is the part with no test
yet, because there is no test file for a policy that does not exist.

---

## 7. Open questions for the owner

| #   | Question                                                                                                   | Blocks                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | Which OAuth providers, and can you supply client id/secret/redirect URI per environment?                   | `PLT-101` scope                                                         |
| 2   | Approve `ADR-024` (Money wire, option C) — decided 2026-09-30, still unwritten                             | `PLT-301`                                                               |
| 3   | Approve `PLT-107` (first-admin setup token) — decided, still unwritten                                     | `PLT-101`                                                               |
| 4   | `ARC-10` — add the 6 missing licence keys, or defer `F-2`?                                                 | `F-2`, `PLT-302`                                                        |
| 5   | `D-4.1` `UserRole` join — confirm it lands with the ERD tripwire amendment in one commit                   | `PLT-201`                                                               |
| 6   | `audit-immutability.sql` is never applied by `db push`. Wire it in, or run it as a documented manual step? | the `REVOKE` proof `TODO.md:128` has awaited since the `REVOKE` shipped |

**Refs:** `AGENTS.md` §2.1 §2.3 §13 · `ADR-003` `ADR-007` `ADR-009` `ADR-012` · `PLT-101`
`PLT-107` `PLT-201` `PLT-202` `F-2` · `ARC-06` `ARC-10` `D-4.1` `D-4.2` `D-4.3`
