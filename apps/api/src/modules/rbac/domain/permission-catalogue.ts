/**
 * The permission catalogue — `ADR-012`, `PLT-201`.
 *
 * ## Why the keys live here and not in `prisma/seed.mjs`
 *
 * `ADR-012` (Accepted 2026-09-30) asks for exactly this: a catalogue *declared in code*,
 * synced to the database at deploy time, with system roles immutable. Before this file the
 * keys lived in a hand-written array in `prisma/seed.mjs`, which is a different thing:
 *
 * - **Nothing reconciled it with the routes.** `GET /auth/oidc/link` gated on
 *   `AUTH_LINK_EXTERNAL_IDENTITY`, and that key was not among the seed's eight — so the only
 *   permission-gated route in the repository returned 403 for the bootstrap administrator.
 *   Correct fail-closed behaviour, on a route nobody could reach.
 * - **Nothing type-checked it.** `@RequirePermission('X')` accepted any string, so a typo
 *   was a runtime 403 rather than a compile error.
 *
 * `permission-catalogue.spec.ts` now reconciles the two directions against the real source
 * tree, and `PermissionKey` below is a union, so a typo in a decorator **does not compile**.
 *
 * ## Why only keys in USE are listed
 *
 * `PLT-201` Task 2 names `ATTENDANCE_MARK` and `FINANCE_INVOICE_REVERSE`; `PLT-203` names
 * `GRADE_ENTER`. None is here, because **no route gates on any of them** — there is no
 * attendance, finance or grading module, and `AGENTS.md` §6 forbids inventing one.
 *
 * Every entry is seeded into `permissions`, grantable to a role, and checked by the usage
 * test. A speculative entry would therefore be a permission the admin UI lists, an operator
 * can assign, and that does nothing. They are added when their module lands — which is what
 * `PLT-201`'s *"living document"* criterion means in practice rather than in prose.
 *
 * ## Why `reservedFor` exists on every entry
 *
 * Six of the nine keys gate **no route today**. They are capabilities the platform needs
 * before any module is enabled — without `USER_CREATE` or `PLATFORM_MODULE_MANAGE` an
 * instance cannot be set up at all — and their routes belong to stories that have not been
 * built.
 *
 * So each such entry must say *why it is not gated yet*. That is what stops "not gated" from
 * meaning two different things: **deliberately reserved**, and **a typo**. The usage test
 * fails on an entry with neither a route nor a stated reservation.
 */

/**
 * The shape every entry must have.
 *
 * `key` is a plain `string` here **on purpose**. The exported `PermissionKey` below is derived
 * from the array literal itself, so this shape must not reference it — a `PermissionDefinition`
 * whose `key` is typed `PermissionKey` is circular, and TypeScript rejects it
 * (`TS2502`/`TS2456`). Deriving both types from the literal is what keeps the union honest
 * *and* the declaration acyclic.
 */
interface PermissionDefinitionShape {
  /**
   * The `MODULE_ACTION` key — `ADR-012`.
   *
   * The exported `PermissionKey` union is derived from the array, so this field cannot hold
   * anything the catalogue does not declare: a typo at a `@RequirePermission` call site is a
   * compile error rather than a route that 403s for every role.
   */
  readonly key: string;
  /** The module segment, stored separately so the admin UI can group without parsing. */
  readonly module: string;
  /** The action segment. */
  readonly action: string;
  /** What an administrator is granting, in a sentence. Never a bare restatement of the key. */
  readonly description: string;
  /**
   * Why this key gates no route yet, or `undefined` when it does gate one.
   *
   * Required by `permission-catalogue.spec.ts` for every ungated entry. See the header.
   */
  readonly reservedFor?: string;
}

/**
 * Every permission this repository knows about, **sorted**.
 *
 * Sorted so a diff shows what changed rather than where an insertion moved everything else.
 * `permission-catalogue.spec.ts` asserts the order, so an unsorted append fails the build
 * instead of quietly making every future diff noisy.
 *
 * `as const satisfies readonly PermissionDefinitionShape[]` is doing two jobs: `as const`
 * gives each `key` its literal type (which is what makes the union below exact), and
 * `satisfies` checks every entry against the shape without widening those literals away.
 */
export const PERMISSION_CATALOGUE = [
  {
    key: 'ADMIN_CONSOLE_ACCESS',
    module: 'ADMIN',
    action: 'CONSOLE_ACCESS',
    description: 'Open the admin console (PLT-1002).',
    // Gated today: `GET /admin`, the API-side mirror of the web guard. Recorded as
    // `undefined` on purpose — its ABSENCE is the signal, and the usage test reads it.
  },
  {
    key: 'AUDIT_READ',
    module: 'AUDIT',
    action: 'READ',
    description: 'Read audit records (PLT-EPIC-04).',
    reservedFor:
      'PLT-403 (Admin Audit Log Viewer) has not shipped, so no route gates on it. The ' +
      'bootstrap administrator needs it the moment that viewer exists.',
  },
  {
    key: 'AUTH_LINK_EXTERNAL_IDENTITY',
    module: 'AUTH',
    action: 'LINK_EXTERNAL_IDENTITY',
    description: 'Link an external identity to the signed-in account (PLT-101).',
    // Gated today: `GET /auth/oidc/link`. Recorded as `undefined` on purpose — its ABSENCE
    // is the signal, and the usage test reads it.
  },
  {
    key: 'LICENCE_APPLY',
    module: 'LICENCE',
    action: 'APPLY',
    description: 'Apply a signed licence certificate (PLT-EPIC-03).',
    reservedFor:
      'PLT-303 (Online Activation Flow) has not shipped. An instance cannot be licensed ' +
      'without it, so the bootstrap administrator holds it from the first seed.',
  },
  {
    key: 'LICENCE_UPGRADE',
    module: 'LICENCE',
    action: 'UPGRADE',
    description: 'Upgrade the applied licence edition (PLT-EPIC-03).',
    reservedFor:
      'PLT-303 (Online Activation Flow) has not shipped. An instance cannot change edition ' +
      'without it, so the bootstrap administrator holds it from the first seed.',
  },
  {
    key: 'PERMISSION_ASSIGN',
    module: 'PERMISSION',
    action: 'ASSIGN',
    description: 'Grant and revoke permissions on a role (PLT-EPIC-02).',
    reservedFor:
      'PLT-201 Task 5 (role management UI) has not shipped. Deliberately NOT granted to ' +
      'SCHOOL_ADMIN — see system-roles.ts, which records why a self-escalation capability ' +
      'has no safe default owner yet.',
  },
  {
    key: 'PERMISSION_READ_OWN',
    module: 'PERMISSION',
    action: 'READ_OWN',
    description: "Read the caller's own permission keys (PLT-204).",
    // Gated today: `GET /permissions/me`. Recorded as `undefined` on
    // purpose — its ABSENCE is the signal, and the usage test reads it.
  },
  {
    key: 'PLATFORM_MODULE_MANAGE',
    module: 'PLATFORM',
    action: 'MODULE_MANAGE',
    description: 'Enable and disable licensed modules (PLT-EPIC-06).',
    reservedFor:
      'PLT-601 (Module Registry) has not shipped. Without it an instance cannot choose which ' +
      'of its licensed modules are active.',
  },
  {
    key: 'SCHOOL_SETTINGS_MANAGE',
    module: 'SCHOOL',
    action: 'SETTINGS_MANAGE',
    description: 'Change school settings (PLT-EPIC-06).',
    reservedFor:
      'PLT-602 (School Configuration) has not shipped. The row exists and two ports read it; ' +
      'no route is gated on the key yet.',
  },
  {
    key: 'USER_CREATE',
    module: 'USER',
    action: 'CREATE',
    description: 'Create another user (PLT-EPIC-01).',
    reservedFor:
      'PLT-101 completes for the bootstrap account only. No user-administration route exists ' +
      'yet, so nothing gates on this key.',
  },
  {
    key: 'USER_INVITE',
    module: 'USER',
    action: 'INVITE',
    description: 'Invite a user who sets their own credential (PLT-104).',
    reservedFor:
      'PLT-104 (OTP / self-service) is milestone 2 per ADR-005, so no route gates on it yet.',
  },
] as const satisfies readonly PermissionDefinitionShape[];

/** One catalogue entry, with its `key` narrowed to its own literal. */
export type PermissionDefinition = (typeof PERMISSION_CATALOGUE)[number];

/**
 * The union of every declared key.
 *
 * **This is the point of the file.** `@RequirePermission(permission: PermissionKey)` accepts
 * only these strings, so `RequirePermission('ATTENDANCE_MARAK')` is a compile error rather
 * than a route that 403s for every role in the system.
 */
export type PermissionKey = PermissionDefinition['key'];

/** Every declared key, sorted. What the sync iterates and the tests reconcile. */
export const PERMISSION_KEYS: readonly PermissionKey[] = Object.freeze(
  PERMISSION_CATALOGUE.map((permission) => permission.key),
);

/**
 * Is this a key the catalogue knows?
 *
 * Exists for the places that legitimately receive an unvalidated string — a cache entry, a
 * request parameter, a database row read back — and where a type assertion would be a lie.
 * Everywhere else, the **type** is the check and this function is unnecessary.
 */
export function isPermissionKey(candidate: string): candidate is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(candidate);
}
