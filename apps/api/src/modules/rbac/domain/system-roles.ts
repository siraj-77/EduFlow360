import type { PermissionKey } from './permission-catalogue.js';

/**
 * The system roles — the corpus §DoR for `PLT-EPIC-02`, verbatim:
 *
 * > "Role catalog (**School Admin, Teacher, Student, Parent, Staff** + custom roles —
 * > **`Super Admin` removed**, `ADR-003`) and initial permission taxonomy agreed."
 *
 * ## Why five and not one
 *
 * The seed created **only `SCHOOL_ADMIN`**, which made a permission matrix impossible: with
 * one role there is no *role* dimension, so "Role × Module × Action" collapses to one row per
 * action and every row must be `ALLOW` for the only role that exists. A matrix with no denials
 * is a matrix that tests nothing.
 *
 * So the four missing roles are added here. They cost four rows and their grants — **no new
 * relationships, no invented domain**, unlike `PLT-203`'s ownership policies which needed
 * class and guardian tables that do not exist.
 *
 * ## `SUPER_ADMIN` is absent, and `system-roles.spec.ts` asserts it stays absent
 *
 * `ADR-003`: *"Do not add a `SUPER_ADMIN` cross-tenant role. There is nothing to be
 * cross-tenant about."* `AGENTS.md` 2.1 makes data isolation physical — one database per
 * school — so there is no tenant above a school to administer. `prisma-schema.spec.ts`
 * already asserts the word is absent from the schema; this file is where it would actually
 * reappear, because a role is created by *name*.
 *
 * ## Why the four non-admin roles hold exactly ONE key
 *
 * Not an oversight, and not laziness. There is **no attendance, finance,
 * grading or transport module** to grant anything on, so any module key
 * here would be a permission with no route behind it — a key the admin UI
 * lists, an operator can assign, and that does nothing.
 *
 * `PERMISSION_READ_OWN` is the exception, and it is a platform-core
 * capability rather than a module one: `PLT-204` lets every signed-in
 * account read its own permission set, so the route that serves it
 * (`GET /permissions/me`) must be reachable by every role. It is the one
 * grant these roles hold until their modules ship, at which point
 * `permission-catalogue.spec.ts`'s usage test is what forces the next
 * addition.
 *
 * It also keeps the matrix honest in the other direction: the four roles
 * are not empty, so a "does this role hold anything" question has a real
 * answer from day one.
 *
 * ## `SCHOOL_ADMIN` deliberately does NOT hold `PERMISSION_ASSIGN`
 *
 * Owner decision, 2026-10-04, option A of the `PLT-205` plan: **no self-escalation**. A role
 * that can grant itself `PERMISSION_ASSIGN` makes the permission system advisory — an
 * administrator who wants a key can simply take it, and the audit trail records a
 * housekeeping action rather than a privilege escalation.
 *
 * It is withheld rather than granted to one of the other four because none of them is a
 * plausible owner: a teacher, a student, a parent and a general staff role should not be able
 * to redesign the school's permission model. So the capability exists, is seeded as a
 * `Permission` row, and is **granted to nobody**.
 *
 * That has a real consequence, stated here rather than discovered later: **until a role can be
 * granted at runtime, nobody can hold `PERMISSION_ASSIGN`.** `PLT-201` Task 5 (the role
 * management UI) owns that, and until it exists the seed is the only way permissions are
 * assigned at all. An operator who needs the capability edits `SCHOOL_ADMIN`'s grants, which
 * is a one-line, reviewable, git-visible change — and that is the intended trade.
 *
 * ## The other three withheld from `SCHOOL_ADMIN`, and why they are still granted
 *
 * `LICENCE_APPLY`, `LICENCE_UPGRADE` and `AUDIT_READ` **are** granted, because the corpus
 * assigns those actions to the School Admin explicitly: `PLT-303`/`PLT-304` open *"As a School
 * Admin I want to activate my serial key"*, and `PLT-403` opens *"As an Admin I want to search
 * audit records."* Withholding them would leave an instance that cannot be licensed and an
 * audit trail nobody can read.
 *
 * Option A's *principle* is no self-escalation; its effect is the removal of
 * `PERMISSION_ASSIGN` specifically. That is a deliberate reading of the principle, not a
 * silent reinterpretation of the wording.
 */

/** One system role, as this repository declares it. */
export interface SystemRoleDefinition {
  /** The `Role.name` value. `@@unique([schoolId, name])`, so exact. */
  readonly name: string;
  /** What the role is for, in a sentence an operator can read. */
  readonly description: string;
  /**
   * The permission keys this role holds **at seed time**.
   *
   * `SCHOOL_ADMIN` holds the platform-core set an instance is set up
   * with. The other four hold exactly `PERMISSION_READ_OWN` — the one
   * platform-core capability every signed-in account needs — until their
   * modules ship. See the header.
   */
  readonly permissions: readonly PermissionKey[];
}

/**
 * The five system roles, in a fixed order.
 *
 * `SCHOOL_ADMIN` first because it is the bootstrap role: `PLT-107`'s setup token creates the
 * first administrator and that account must land on a role that exists.
 *
 * `Object.freeze` on the array and on each `permissions` array, because these are read by the
 * seed, by the matrix fixture and by tests, and a mutation in one of them would silently change
 * what another sees.
 */
export const SYSTEM_ROLES: readonly SystemRoleDefinition[] = Object.freeze([
  {
    name: 'SCHOOL_ADMIN',
    description:
      'In-school administrator. The highest role; there is no cross-tenant super admin (ADR-003).',
    permissions: Object.freeze([
      // Bootstrapping and everyday administration. An instance with none of these cannot be
      // set up, so they are granted from the first seed.
      'PLATFORM_MODULE_MANAGE',
      'SCHOOL_SETTINGS_MANAGE',
      'USER_CREATE',
      'USER_INVITE',
      // The corpus assigns these to the School Admin explicitly — PLT-303/304 (activate a
      // serial key) and PLT-403 (read audit records). Withholding them would leave an
      // instance that cannot be licensed and an audit trail nobody can read.
      'LICENCE_APPLY',
      'LICENCE_UPGRADE',
      'AUDIT_READ',
      // The one gated route in the repository. **This is the key the seed was missing**, which
      // is why `GET /auth/oidc/link` returned 403 for the bootstrap administrator until
      // `PLT-205` T1. Named here so removing it is visibly deliberate.
      'AUTH_LINK_EXTERNAL_IDENTITY',
      // Every signed-in account reads its own permission set (PLT-204), so the
      // route that serves it must be reachable by the administrator too.
      'PERMISSION_READ_OWN',
    ] as readonly PermissionKey[]),
    // `PERMISSION_ASSIGN` is deliberately absent. See the header: no self-escalation.
  },
  {
    name: 'TEACHER',
    description:
      'Teaching staff. Holds the platform-core read key only, until the academic modules ship.',
    permissions: Object.freeze(['PERMISSION_READ_OWN'] as readonly PermissionKey[]),
  },
  {
    name: 'STUDENT',
    description:
      'Student accounts. Hold the platform-core read key only, until the academic modules ship.',
    permissions: Object.freeze(['PERMISSION_READ_OWN'] as readonly PermissionKey[]),
  },
  {
    name: 'PARENT',
    description:
      'Parent or guardian accounts. Hold the platform-core read key only, until the family modules ship.',
    permissions: Object.freeze(['PERMISSION_READ_OWN'] as readonly PermissionKey[]),
  },
  {
    name: 'STAFF',
    description:
      'Non-teaching staff. Hold the platform-core read key only, until the workforce modules ship.',
    permissions: Object.freeze(['PERMISSION_READ_OWN'] as readonly PermissionKey[]),
  },
] as const satisfies readonly SystemRoleDefinition[]);

/** Every system role name, in declaration order. */
export const SYSTEM_ROLE_NAMES: readonly string[] = Object.freeze(
  SYSTEM_ROLES.map((role) => role.name),
);

/** The bootstrap role. The account `PLT-107`'s setup token creates. */
export const BOOTSTRAP_ROLE_NAME = 'SCHOOL_ADMIN';

/**
 * The permission keys deliberately granted to **nobody**.
 *
 * Recorded as data rather than as a comment so `system-roles.spec.ts` can assert it — and so
 * the day `PLT-201` Task 5 ships a role-management UI, there is a single named thing to wire
 * an "unassigned capability" report to, instead of someone re-deriving the reasoning.
 */
export const UNASSIGNED_PERMISSION_KEYS: readonly PermissionKey[] = Object.freeze([
  'PERMISSION_ASSIGN',
] as readonly PermissionKey[]);
