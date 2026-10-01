/**
 * ARC-01 — Platform Core data model. THE SINGLE SOURCE OF TRUTH.
 *
 * `render-prisma.mjs` turns this into `apps/api/prisma/schema.prisma`.
 * `render-erd.mjs` turns this into the Excalidraw element list. Both read the
 * same field lists, so the diagram and the schema cannot disagree — which is
 * the failure D22 was worried about when it left the schema empty: a
 * plausible-looking diagram and a plausible-looking schema that describe
 * different systems.
 *
 * Nothing here is invented. Every field traces to a governing document; the
 * trace is in the comment on the field. Where the corpus is silent, the field
 * carries a `GAP` marker and the open question is listed in
 * `docs/diagrams/ERD_PLATFORM_CORE.md` rather than resolved by guessing.
 *
 * `docs/work/TODO.md` item 3 fixes the entity set at fourteen. PLT-203 and
 * PLT-801 build ownership and file-access policies against abstract ports with
 * fakes, so there is deliberately no Student, Class or Teacher here
 * (`AGENTS.md` §13).
 */

/**
 * AGENTS.md §2.1 / ADR-003: every school is served by its own PostgreSQL
 * database. Isolation is physical, so no `WHERE` clause can leak across
 * schools and there is nothing for tenant scoping to defend.
 *
 * `school_id` is therefore METADATA — kept for auditability and licence
 * portability — and it is injected into every model by the renderers, so it
 * cannot be forgotten on the fifteenth table. It is deliberately NOT a foreign
 * key: there is no `School` table in this milestone, and inventing one would
 * create a second tenancy concept, which is the exact drift `AGENTS.md` §6
 * warns about.
 */
const SCHOOL_ID = {
  name: 'schoolId',
  type: 'String',
  attrs: ['@map("school_id")'],
  kind: 'scalar',
  comment: [
    'Which school this row belongs to. METADATA ONLY.',
    'One database per school (ADR-003), so no query is scoped by it and no guard',
    'reads it. There is no `School` table and no foreign key: isolation is',
    'physical. It exists for auditability and licence portability.',
  ],
};

/** UTC in storage, school timezone at the edges (`AGENTS.md` §8). */
const CREATED_AT = {
  name: 'createdAt',
  type: 'DateTime',
  attrs: ['@default(now())', '@map("created_at")'],
  kind: 'scalar',
};
const UPDATED_AT = {
  name: 'updatedAt',
  type: 'DateTime',
  attrs: ['@updatedAt', '@map("updated_at")'],
  kind: 'scalar',
};
const ID = {
  name: 'id',
  type: 'String',
  attrs: ['@id', '@default(uuid())', '@db.Uuid'],
  kind: 'id',
};

export const ENUMS = [
  {
    name: 'UserStatus',
    comment: [
      'Account lifecycle. Lockout is NOT a status: it is `lockedUntil` plus',
      '`failedLoginAttempts`, because a cooldown has an end time and a status',
      'would have to be recomputed to expire.',
    ],
    values: ['INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED'],
  },
  {
    name: 'RoundingMode',
    comment: 'Per-school rounding (`AGENTS.md` §2.5). Never a constant (`ADR-002`).',
    values: ['HALF_UP', 'HALF_EVEN', 'HALF_DOWN', 'UP', 'DOWN', 'CEILING', 'FLOOR'],
  },
  {
    name: 'LicenseStatus',
    comment: [
      '`ADR-009`: expired, invalid-signature and schema-error are three',
      'different administrative states with three different remedies, so they',
      'must never collapse into one status or one error.',
      '`GRACE` is `PLT-305`: the activation server is unreachable but the',
      'countdown has not run out.',
    ],
    values: ['PENDING', 'ACTIVE', 'GRACE', 'EXPIRED', 'INVALID', 'REVOKED'],
  },
  {
    name: 'LogSeverity',
    comment: '`PLT-501` levels. ERROR and CRITICAL are also written to `error_logs`.',
    values: ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRRITICAL'],
  },
  {
    name: 'NotificationChannel',
    comment: [
      '`AGENTS.md` §2.2. EMAIL is the default the router falls back to.',
      'SMS and WHATSAPP are per-message billed, which is why `PLT-701`',
      'requires per-recipient rate limiting and digesting for them.',
    ],
    values: ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'],
  },
  {
    name: 'NotificationUrgency',
    comment: '`PLT-701`: EMERGENCY bypasses digesting and batching.',
    values: ['NORMAL', 'EMERGENCY'],
  },
  {
    name: 'NotificationDeliveryStatus',
    comment: '`PLT-702` delivery-status tracking. PENDING covers digest-held sends.',
    values: ['PENDING', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED'],
  },
  {
    name: 'FileScanStatus',
    comment: [
      '`ADR-015` malware scan is a port with a no-op adapter until the real',
      'scanner ships, so `SKIPPED` is a legitimate value and not a bug:',
      'the seam exists so no module assumes scanning is inline.',
    ],
    values: ['PENDING', 'CLEAN', 'INFECTED', 'SKIPPED', 'FAILED'],
  },
];

export const MODELS = [
  // ── PLT-EPIC-01 Authentication ──────────────────────────────────────────
  {
    name: 'User',
    table: 'users',
    comment: [
      'A person who can authenticate.',
      '',
      '`D-4.1`: roles are a JOIN, not a single foreign key. `ERD:84` recorded',
      'that "a teacher who is also a parent cannot be expressed" - and that is',
      'not a cosmetic gap, because such a user could not log in as both at all.',
      'The owner confirmed multi-role on 2026-09-30.',
      '',
      'There is deliberately NO primary-role flag. A user with three roles holds',
      'the UNION of their permissions, because `AGENTS.md` 2.3 makes the',
      'permission the only thing that gates a route. A `isPrimary` column would',
      'introduce a second source of truth for "what can this user do", and the',
      'two would disagree the first time an admin reordered anything.',
      '',
      'A user holds NO student/teacher/parent data here: `PLT-203` resolves',
      'ownership through abstract ports, and the domains that would own those',
      'relationships do not exist yet.',
    ],
    erd: { x: 520, y: 140 },
    fields: [
      ID,
      {
        name: 'email',
        type: 'String',
        attrs: [],
        kind: 'scalar',
        comment: [
          'NOT NULL, and unique per school. Nullable-unique is a trap:',
          'PostgreSQL treats NULLs as distinct, so `email String?` with a',
          '`@@unique` would constrain nothing and two accounts could collide.',
        ],
      },
      {
        name: 'username',
        type: 'String',
        attrs: [],
        kind: 'scalar',
        comment: 'Second login identifier. NOT NULL for the same reason as `email`.',
      },
      {
        name: 'passwordHash',
        type: 'String',
        attrs: ['?'],
        kind: 'scalar',
        comment: [
          '`ADR-007`: argon2id behind `IPasswordHasher`. Nullable because an',
          'INVITED user has no password yet and `PLT-104` OTP is milestone 2.',
          'Never returned in a response and never logged.',
        ],
      },
      {
        name: 'passwordAlgorithm',
        type: 'String',
        attrs: ['?'],
        kind: 'scalar',
        comment: [
          '`ADR-007` verify-and-rehash needs to know which algorithm a hash was',
          'written with, so a legacy bcrypt hash can be upgraded on login',
          'without a second column or a forced reset.',
        ],
      },
      {
        name: 'passwordUpdatedAt',
        type: 'DateTime',
        attrs: ['?'],
        kind: 'scalar',
        comment: '`NFR` password-age policy reads this.',
      },
      { name: 'mustChangePassword', type: 'Boolean', attrs: ['@default(false)'], kind: 'scalar' },
      { name: 'status', type: 'UserStatus', attrs: ['@default(INVITED)'], kind: 'scalar' },
      {
        name: 'failedLoginAttempts',
        type: 'Int',
        attrs: ['@default(0)'],
        kind: 'scalar',
        comment: '`PLT-101` lockout counter. Threshold and cooldown are settings.',
      },
      { name: 'lockedUntil', type: 'DateTime', attrs: ['?'], kind: 'scalar' },
      { name: 'lastLoginAt', type: 'DateTime', attrs: ['?'], kind: 'scalar' },
      {
        name: 'preferredLocale',
        type: 'String',
        attrs: ['?'],
        kind: 'scalar',
        comment: [
          'Master Plan §5.3: per-user language preference, defaulting to the',
          "school's configured default. Nullable on purpose — a `DEFAULT 'en'`",
          'would hard-code English into every deployment (`AGENTS.md` §8).',
        ],
      },
      {
        name: 'roles',
        type: 'UserRole[]',
        attrs: ['@relation("fk_user_role")'],
        kind: 'relation',
        to: 'UserRole',
        relation: 'role',
        inverse: true,
        invisible: true,
        comment: 'Multi-role per `D-4.1`. The join rows carry the grants.',
      },
      {
        name: 'sessions',
        type: 'Session[]',
        attrs: ['@relation("fk_session_user")'],
        kind: 'relation',
        to: 'Session',
        relation: 'user',
        inverse: true,
        invisible: true,
      },
      {
        name: 'refreshTokens',
        type: 'RefreshToken[]',
        attrs: ['@relation("fk_refresh_token_user")'],
        kind: 'relation',
        to: 'RefreshToken',
        relation: 'user',
        inverse: true,
        invisible: true,
      },
      {
        name: 'schoolSettingsUpdates',
        type: 'SchoolSettings[]',
        attrs: ['@relation("fk_school_settings_updated_by")'],
        kind: 'relation',
        to: 'SchoolSettings',
        relation: 'updatedBy',
        inverse: true,
        invisible: true,
      },
      {
        name: 'notificationPreferences',
        type: 'NotificationPreference[]',
        attrs: ['@relation("fk_notification_preference_user")'],
        kind: 'relation',
        to: 'NotificationPreference',
        relation: 'user',
        inverse: true,
        invisible: true,
      },
      {
        name: 'notificationDeliveries',
        type: 'NotificationDelivery[]',
        attrs: ['@relation("fk_notification_delivery_user")'],
        kind: 'relation',
        to: 'NotificationDelivery',
        relation: 'user',
        inverse: true,
        invisible: true,
      },
      {
        name: 'storedFiles',
        type: 'StoredFile[]',
        attrs: ['@relation("fk_stored_file_uploaded_by")'],
        kind: 'relation',
        to: 'StoredFile',
        relation: 'uploadedBy',
        inverse: true,
        invisible: true,
      },
      CREATED_AT,
      UPDATED_AT,
    ],
    indexes: ['@@index([status])', '@@index([lockedUntil])'],
    uniques: ['@@unique([schoolId, email])', '@@unique([schoolId, username])'],
  },

  {
    name: 'Role',
    table: 'roles',
    comment: [
      'A named bundle of permissions. `ADR-012`: the code catalogue decides',
      'which permissions EXIST; this table decides which roles HOLD them.',
      '',
      'DEVIATION FROM THE CORPUS, flagged not silently applied: `PLT-201` says',
      '`school_id nullable for system roles`. That is a multi-tenant artefact —',
      'it describes a role belonging to no school, which cannot happen when one',
      'database is one school (`ADR-003`), and a nullable column in a unique',
      'constraint does not constrain. `school_id` is therefore NOT NULL here and',
      'system roles are marked with `isSystemRole` instead.',
    ],
    erd: { x: 0, y: 700 },
    fields: [
      ID,
      { name: 'name', type: 'String', attrs: [], kind: 'scalar' },
      { name: 'description', type: 'String', attrs: ['?'], kind: 'scalar' },
      {
        name: 'isSystemRole',
        type: 'Boolean',
        attrs: ['@default(false)'],
        kind: 'scalar',
        comment: [
          '`ADR-012`: system roles are immutable — cannot be deleted or stripped',
          'of core permissions, enforced server-side, not by hiding UI.',
          'The highest role is an in-school administrator; there is no',
          'cross-tenant super admin (`ADR-003`).',
        ],
      },
      {
        name: 'users',
        type: 'UserRole[]',
        attrs: ['@relation("fk_role_user_role")'],
        kind: 'relation',
        to: 'UserRole',
        relation: 'role',
        inverse: true,
        invisible: true,
      },
      {
        name: 'permissions',
        type: 'RolePermission[]',
        attrs: ['@relation("fk_role_permission_role")'],
        kind: 'relation',
        to: 'RolePermission',
        relation: 'role',
        inverse: true,
        invisible: true,
      },
      CREATED_AT,
      UPDATED_AT,
    ],
    indexes: ['@@index([isSystemRole])'],
    uniques: ['@@unique([schoolId, name])'],
  },

  {
    name: 'Permission',
    table: 'permissions',
    comment: [
      'One `MODULE_ACTION` key from the code catalogue (`ADR-012`), synced to',
      'this table on deploy. Populated by the sync, never by a school admin, and',
      'never by hand-typed strings in a role definition.',
    ],
    erd: { x: 0, y: 140 },
    fields: [
      ID,
      {
        name: 'key',
        type: 'String',
        attrs: [],
        kind: 'scalar',
        comment: '`MODULE_ACTION`, e.g. `FINANCE_INVOICE_REVERSE`.',
      },
      {
        name: 'module',
        type: 'String',
        attrs: [],
        kind: 'scalar',
        comment: 'The owning module. A namespace, not a tenancy or a hierarchy.',
      },
      { name: 'action', type: 'String', attrs: [], kind: 'scalar' },
      { name: 'description', type: 'String', attrs: ['?'], kind: 'scalar' },
      {
        name: 'roles',
        type: 'RolePermission[]',
        attrs: ['@relation("fk_role_permission_permission")'],
        kind: 'relation',
        to: 'RolePermission',
        relation: 'permission',
        inverse: true,
        invisible: true,
      },
      CREATED_AT,
      UPDATED_AT,
    ],
    indexes: ['@@index([module])'],
    uniques: ['@@unique([schoolId, key])'],
  },

  {
    name: 'RolePermission',
    table: 'role_permissions',
    comment: 'The grant. Composite key, so the same grant cannot be inserted twice.',
    erd: { x: 0, y: 470 },
    fields: [
      {
        name: 'roleId',
        type: 'String',
        attrs: ['@map("role_id")', '@db.Uuid'],
        kind: 'relation',
        to: 'Role',
        fk: 'fk_role_permission_role',
        relation: 'role',
        comment:
          'A role holding a permission that no longer exists is a sync-time error, not a silent orphan (`ADR-012`).',
      },
      {
        name: 'role',
        type: 'Role',
        attrs: [
          '@relation("fk_role_permission_role", fields: [roleId], references: [id], onDelete: Cascade)',
        ],
        kind: 'relation',
        to: 'Role',
        relation: 'role',
        invisible: true,
      },
      {
        name: 'permissionId',
        type: 'String',
        attrs: ['@map("permission_id")', '@db.Uuid'],
        kind: 'relation',
        to: 'Permission',
        fk: 'fk_role_permission_permission',
        relation: 'permission',
      },
      {
        name: 'permission',
        type: 'Permission',
        attrs: [
          '@relation("fk_role_permission_permission", fields: [permissionId], references: [id], onDelete: Cascade)',
        ],
        kind: 'relation',
        to: 'Permission',
        relation: 'permission',
        invisible: true,
      },
      {
        name: 'grantedAt',
        type: 'DateTime',
        attrs: ['@default(now())'],
        kind: 'scalar',
        comment:
          'Who granted it is answered by `audit_records` (`PLT-402`), not by a nullable column here.',
      },
    ],
    idAttr: '@@id([schoolId, roleId, permissionId])',
    indexes: ['@@index([permissionId])'],
  },

  {
    name: 'UserRole',
    table: 'user_roles',
    comment: [
      'Which roles a user holds (`D-4.1`, owner-confirmed 2026-09-30).',
      '',
      'Replaces `User.roleId`, a single foreign key, which could not express',
      'a teacher who is also a parent - the case `ERD:84` named.',
      '',
      'NO primary flag and no validity window, both deliberate. Permissions UNION',
      'across every row here, because `AGENTS.md` 2.3 makes the permission the',
      'only thing that gates a route. A `isPrimary` or `expiresAt` column would',
      'add a second source of truth for "what can this user do", and the two',
      'would disagree the first time an admin changed either.',
      '',
      'Grant and expiry are answered by `audit_records` (`PLT-402`), which is',
      'append-only by construction.',
    ],
    erd: { x: 0, y: 210 },
    fields: [
      {
        name: 'userId',
        type: 'String',
        attrs: ['@map("user_id")', '@db.Uuid'],
        kind: 'relation',
        to: 'User',
        fk: 'fk_user_role',
        relation: 'role',
        comment:
          'Restrict, not Cascade: `onDelete: Cascade` here is harmless, but the inverse matters - see the model comment.',
      },
      {
        name: 'user',
        type: 'User',
        attrs: ['@relation("fk_user_role", fields: [userId], references: [id], onDelete: Cascade)'],
        kind: 'relation',
        to: 'User',
        relation: 'role',
        invisible: true,
      },
      {
        name: 'roleId',
        type: 'String',
        attrs: ['@map("role_id")', '@db.Uuid'],
        kind: 'relation',
        to: 'Role',
        fk: 'fk_role_user_role',
        relation: 'role',
        comment:
          'Restrict. Deleting a role that still has users must fail rather than silently strip a school of an administrator - the same reasoning as the old single-FK shape.',
      },
      {
        name: 'role',
        type: 'Role',
        attrs: [
          '@relation("fk_role_user_role", fields: [roleId], references: [id], onDelete: Restrict)',
        ],
        kind: 'relation',
        to: 'Role',
        relation: 'role',
        invisible: true,
      },
      { name: 'grantedAt', type: 'DateTime', attrs: ['@default(now())'], kind: 'scalar' },
    ],
    idAttr: '@@id([schoolId, userId, roleId])',
    indexes: ['@@index([roleId])'],
  },

  {
    name: 'Session',
    table: 'sessions',
    comment: [
      'One server-side record per login. `ADR-008`: stateless-only JWTs cannot',
      'be revoked before expiry, and `PLT-103` requires a revoked session to be',
      'invalid on the NEXT request, and a role change to force re-auth within',
      'one request cycle. That is why this table exists at all.',
    ],
    erd: { x: 1120, y: 140 },
    fields: [
      ID,
      {
        name: 'userId',
        type: 'String',
        attrs: ['@map("user_id")', '@db.Uuid'],
        kind: 'relation',
        to: 'User',
        fk: 'fk_session_user',
        relation: 'user',
      },
      {
        name: 'user',
        type: 'User',
        attrs: [
          '@relation("fk_session_user", fields: [userId], references: [id], onDelete: Cascade)',
        ],
        kind: 'relation',
        to: 'User',
        relation: 'user',
        invisible: true,
      },
      {
        name: 'deviceLabel',
        type: 'String',
        attrs: ['?'],
        kind: 'scalar',
        comment:
          '`ADR-008`: device tracking, so an administrator can answer "who is logged in, from where".',
      },
      { name: 'ipAddress', type: 'String', attrs: ['?'], kind: 'scalar' },
      { name: 'userAgent', type: 'String', attrs: ['?'], kind: 'scalar' },
      { name: 'createdAt', type: 'DateTime', attrs: ['@default(now())'], kind: 'scalar' },
      { name: 'lastActiveAt', type: 'DateTime', attrs: ['@default(now())'], kind: 'scalar' },
      { name: 'expiresAt', type: 'DateTime', attrs: [], kind: 'scalar' },
      {
        name: 'revokedAt',
        type: 'DateTime',
        attrs: ['?'],
        kind: 'scalar',
        comment:
          'Set the moment revocation takes effect, so the guard is a comparison and not a cache invalidation.',
      },
      { name: 'revokedReason', type: 'String', attrs: ['?'], kind: 'scalar' },
      {
        name: 'refreshTokens',
        type: 'RefreshToken[]',
        attrs: ['@relation("fk_refresh_token_session")'],
        kind: 'relation',
        to: 'RefreshToken',
        relation: 'session',
        inverse: true,
        invisible: true,
      },
    ],
    indexes: ['@@index([userId])', '@@index([expiresAt])', '@@index([lastActiveAt])'],
  },

  {
    name: 'RefreshToken',
    table: 'refresh_tokens',
    comment: [
      'Opaque, single-use, rotating (`ADR-008`). `familyId` is the load-bearing',
      'column: presenting an already-rotated token revokes the WHOLE family,',
      'which turns silent theft into a detectable, recoverable event. Without',
      'it, a stolen token is valid for its full lifetime and nobody notices.',
    ],
    erd: { x: 1120, y: 430 },
    fields: [
      ID,
      {
        name: 'sessionId',
        type: 'String',
        attrs: ['@map("session_id")', '@db.Uuid'],
        kind: 'relation',
        to: 'Session',
        fk: 'fk_refresh_token_session',
        relation: 'session',
      },
      {
        name: 'session',
        type: 'Session',
        attrs: [
          '@relation("fk_refresh_token_session", fields: [sessionId], references: [id], onDelete: Cascade)',
        ],
        kind: 'relation',
        to: 'Session',
        relation: 'session',
        invisible: true,
      },
      {
        name: 'userId',
        type: 'String',
        attrs: ['@map("user_id")', '@db.Uuid'],
        kind: 'relation',
        to: 'User',
        fk: 'fk_refresh_token_user',
        relation: 'user',
        comment:
          'Denormalised from the session so revoking every token for a user is one indexed query.',
      },
      {
        name: 'user',
        type: 'User',
        attrs: [
          '@relation("fk_refresh_token_user", fields: [userId], references: [id], onDelete: Cascade)',
        ],
        kind: 'relation',
        to: 'User',
        relation: 'user',
        invisible: true,
      },
      {
        name: 'familyId',
        type: 'String',
        attrs: ['@map("family_id")'],
        kind: 'scalar',
        comment:
          'Shared by every token issued from one login. The unit that reuse detection revokes.',
      },
      {
        name: 'tokenHash',
        type: 'String',
        attrs: ['@map("token_hash")'],
        kind: 'scalar',
        comment:
          'A refresh token is a bearer credential, so it is hashed at rest and never logged (`AGENTS.md` §2.13).',
      },
      { name: 'issuedAt', type: 'DateTime', attrs: ['@default(now())'], kind: 'scalar' },
      { name: 'expiresAt', type: 'DateTime', attrs: [], kind: 'scalar' },
      {
        name: 'usedAt',
        type: 'DateTime',
        attrs: ['?'],
        kind: 'scalar',
        comment: [
          'Set on rotation. A usedAt that comes back is a replay — except for',
          'the concurrent-refresh race, which `ADR-008` calls out as a mandatory',
          'test: a mobile client retrying on a flaky network must not have its',
          'family revoked. Either both sides check the window, or the loser is',
          'detected another way. GAP — resolved in PLT-102, not here.',
        ],
      },
      { name: 'revokedAt', type: 'DateTime', attrs: ['?'], kind: 'scalar' },
      { name: 'revokedReason', type: 'String', attrs: ['?'], kind: 'scalar' },
      {
        name: 'replacedByTokenId',
        type: 'String',
        attrs: ['?', '@map("replaced_by_token_id")'],
        kind: 'scalar',
        comment: [
          'Points at the token that replaced this one. Deliberately NOT a Prisma',
          'relation: a rotation chain is a DAG, and declaring it one-to-one would',
          'force a @unique that describes a modelling artefact rather than a rule,',
          'and a many-to-one that would imply a token can be replaced twice. The',
          'successor is one indexed lookup by primary key, so navigation is not',
          'needed. Indexed below because revocation walks the family, not the chain.',
        ],
      },
    ],
    indexes: [
      '@@index([sessionId])',
      '@@index([userId])',
      '@@index([familyId])',
      '@@index([replacedByTokenId])',
      '@@index([expiresAt])',
    ],
  },

  // ── PLT-EPIC-04 Audit · PLT-EPIC-05 Diagnostics ───────────────────────
  {
    name: 'AuditRecord',
    table: 'audit_records',
    comment: [
      'APPEND-ONLY (`AGENTS.md` §2.7). There is no updatedAt and no deletedAt',
      'because a timestamp that changes is the first step towards an update',
      'path. The repository exposes only create() and query();',
      '`apps/api/prisma/hardening/audit-immutability.sql` revokes UPDATE and',
      'DELETE from the application role, because a rule nothing enforces is a',
      'suggestion.',
      '',
      'No relation to `users`, deliberately. A foreign key would either block a',
      'user deletion or cascade the audit row away, and both destroy evidence.',
      'The actor is recorded by value.',
    ],
    erd: { x: 1120, y: 2184 },
    fields: [
      ID,
      {
        name: 'occurredAt',
        type: 'DateTime',
        attrs: ['@default(now())'],
        kind: 'scalar',
        comment: 'UTC in storage, rendered in the school timezone (`AGENTS.md` §8).',
      },
      {
        name: 'actorId',
        type: 'String',
        attrs: ['?'],
        kind: 'softref',
        to: 'User',
        comment: 'A snapshot, not a foreign key. See the model comment.',
      },
      {
        name: 'actorRole',
        type: 'String',
        attrs: ['?'],
        kind: 'scalar',
        comment:
          'Also a snapshot: the role held at the time, which is what an auditor asks about — not the role the user has now.',
      },
      { name: 'ipAddress', type: 'String', attrs: ['?'], kind: 'scalar' },
      { name: 'deviceInfo', type: 'String', attrs: ['?'], kind: 'scalar' },
      {
        name: 'correlationId',
        type: 'String',
        attrs: ['@map("correlation_id")'],
        kind: 'scalar',
        comment: 'Joins this row to the request and to `error_logs` (`PLT-501`).',
      },
      {
        name: 'action',
        type: 'String',
        attrs: [],
        kind: 'scalar',
        comment: "The `@Audited('<ACTION_KEY>')` argument.",
      },
      { name: 'module', type: 'String', attrs: [], kind: 'scalar' },
      { name: 'entityType', type: 'String', attrs: ['?'], kind: 'scalar' },
      { name: 'entityId', type: 'String', attrs: ['?'], kind: 'scalar' },
      { name: 'beforeValue', type: 'Json', attrs: ['?'], kind: 'scalar' },
      { name: 'afterValue', type: 'Json', attrs: ['?'], kind: 'scalar' },
      {
        name: 'reason',
        type: 'String',
        attrs: ['?'],
        kind: 'scalar',
        comment: [
          'Mandatory for the high-sensitivity subset (`PLT-402`), rejected with',
          '400 BEFORE the transaction opens. Also mandatory for manual journal',
          'entries (`AGENTS.md` §2.6).',
        ],
      },
    ],
    indexes: [
      '@@index([occurredAt])',
      '@@index([module, action])',
      '@@index([actorId])',
      '@@index([correlationId])',
      '@@index([entityType, entityId])',
    ],
  },

  {
    name: 'ErrorLog',
    table: 'error_logs',
    comment: [
      'The database half of `AGENTS.md` §2.15: every ERROR and CRITICAL goes to',
      'the rotating file log AND here. Without the DB half, a critical error',
      'becomes unqueryable the moment rotation purges it, which is exactly what',
      '`PLT-504` needs to survive.',
      '',
      'No relation to `users`, for the same reason as `audit_records`: a log must',
      'not fail a write because an account was deleted, and logs outlive the',
      'retention window of any individual user.',
    ],
    erd: { x: 1120, y: 2500 },
    fields: [
      ID,
      { name: 'occurredAt', type: 'DateTime', attrs: ['@default(now())'], kind: 'scalar' },
      { name: 'severity', type: 'LogSeverity', attrs: [], kind: 'scalar' },
      { name: 'correlationId', type: 'String', attrs: ['@map("correlation_id")'], kind: 'scalar' },
      { name: 'userId', type: 'String', attrs: ['?'], kind: 'softref', to: 'User' },
      { name: 'module', type: 'String', attrs: ['?'], kind: 'scalar' },
      { name: 'httpMethod', type: 'String', attrs: ['?'], kind: 'scalar' },
      { name: 'route', type: 'String', attrs: ['?'], kind: 'scalar' },
      {
        name: 'message',
        type: 'String',
        attrs: [],
        kind: 'scalar',
        comment: [
          'Redacted before it gets here (`PLT-502`): passwords, tokens, card',
          'data, secret keys and biometric templates never reach this column.',
        ],
      },
      { name: 'errorClass', type: 'String', attrs: ['?'], kind: 'scalar' },
      { name: 'stackTrace', type: 'String', attrs: ['?'], kind: 'scalar' },
      { name: 'context', type: 'Json', attrs: ['?'], kind: 'scalar' },
    ],
    indexes: [
      '@@index([occurredAt])',
      '@@index([severity, occurredAt])',
      '@@index([correlationId])',
      '@@index([userId])',
    ],
  },

  // ── PLT-EPIC-06 Settings · PLT-EPIC-03 Licensing ──────────────────────
  {
    name: 'SchoolSettings',
    table: 'school_settings',
    comment: [
      'The single canonical home for school-specific values (`AGENTS.md` §2.14).',
      '`PLT-602`: a setting change takes effect without a restart and every',
      'module reads it through one shared service.',
      '',
      'One row per school, and one school per database (`ADR-003`) — so the',
      '`@@unique([schoolId])` is what a school-specific query keys on, not a',
      'tenant partition.',
      '',
      'No defaults on timezone, currency or locale. A `DEFAULT` here would be a',
      'silent default, and `AGENTS.md` §11 requires start-up to fail naming what',
      'is missing rather than assume.',
    ],
    erd: { x: 1120, y: 1862 },
    fields: [
      ID,
      { name: 'name', type: 'String', attrs: [], kind: 'scalar' },
      { name: 'legalName', type: 'String', attrs: ['?', '@map("legal_name")'], kind: 'scalar' },
      {
        name: 'timezone',
        type: 'String',
        attrs: [],
        kind: 'scalar',
        comment: 'Never hard-coded (`AGENTS.md` §8).',
      },
      { name: 'defaultLocale', type: 'String', attrs: ['@map("default_locale")'], kind: 'scalar' },
      {
        name: 'currencyCode',
        type: 'String',
        attrs: ['@map("currency_code")'],
        kind: 'scalar',
        comment: '`ADR-002`. Explicit on every money value; never a product-wide constant.',
      },
      {
        name: 'minorUnitScale',
        type: 'Int',
        attrs: ['@map("minor_unit_scale")'],
        kind: 'scalar',
        comment: '`ADR-002`. 2 for most currencies, 0 or 3 elsewhere. Per school, not per code.',
      },
      {
        name: 'roundingMode',
        type: 'RoundingMode',
        attrs: ['@map("rounding_mode")'],
        kind: 'scalar',
        comment:
          '`ADR-002` / `AGENTS.md` §2.5. A per-school setting, so a jurisdiction that mandates a mode is a config change.',
      },
      {
        name: 'academicYearStartMonth',
        type: 'Int',
        attrs: ['@map("academic_year_start_month")'],
        kind: 'scalar',
        comment: "Never hard-code a school's academic calendar (`AGENTS.md` §8).",
      },
      {
        name: 'settings',
        type: 'Json',
        attrs: [],
        kind: 'scalar',
        comment: [
          'The long tail, grouped by category (General, Academic Defaults,',
          'Notifications, Branding) and read through typed accessors',
          '(`PLT-602`). Typed columns stay above for the values that finance',
          'and every other module depend on, so they can be constrained.',
        ],
      },
      {
        name: 'updatedById',
        type: 'String',
        attrs: ['?', '@map("updated_by_id")', '@db.Uuid'],
        kind: 'relation',
        to: 'User',
        fk: 'fk_school_settings_updated_by',
        relation: 'updatedBy',
      },
      {
        name: 'updatedBy',
        type: 'User?',
        attrs: [
          '@relation("fk_school_settings_updated_by", fields: [updatedById], references: [id], onDelete: SetNull)',
        ],
        kind: 'relation',
        to: 'User',
        relation: 'updatedBy',
        invisible: true,
      },
      CREATED_AT,
      UPDATED_AT,
    ],
    indexes: ['@@index([updatedById])'],
    uniques: ['@@unique([schoolId])'],
  },

  {
    name: 'ModuleRegistry',
    table: 'module_registry',
    comment: [
      'Which modules this school has switched ON (`PLT-601`).',
      '',
      'There is deliberately no `active` / `is_enabled` column. The resolved',
      'state is licence entitlement AND this admin toggle, and storing the',
      'result would create a second source of truth that disagrees with the',
      'certificate the moment a licence is renewed. Compute it.',
    ],
    erd: { x: 0, y: 1420 },
    fields: [
      ID,
      {
        name: 'moduleKey',
        type: 'String',
        attrs: ['@map("module_key")'],
        kind: 'scalar',
        comment: 'Matches an `allowed_modules` entry in the signed certificate (Master Plan §4.2).',
      },
      {
        name: 'displayNameKey',
        type: 'String',
        attrs: ['@map("display_name_key")'],
        kind: 'scalar',
        comment:
          'An i18n key, not the label. A literal here would be an untranslatable string (`AGENTS.md` §2.8).',
      },
      { name: 'adminEnabled', type: 'Boolean', attrs: ['@default(true)'], kind: 'scalar' },
      { name: 'enabledAt', type: 'DateTime', attrs: ['?'], kind: 'scalar' },
      { name: 'disabledAt', type: 'DateTime', attrs: ['?'], kind: 'scalar' },
      CREATED_AT,
      UPDATED_AT,
    ],
    indexes: ['@@index([adminEnabled])'],
    uniques: ['@@unique([schoolId, moduleKey])'],
  },

  {
    name: 'License',
    table: 'licenses',
    comment: [
      'The signed certificate, verified locally against the embedded public key',
      '(`ADR-009`). The private signing key never enters this repository, tests',
      'included — `ADR-010` puts activation on an external vendor service.',
      '',
      'One row per school. A renewal replaces the certificate in place; the',
      'history of activations is answered by `audit_records`, which is append-only',
      'by construction.',
    ],
    erd: { x: 0, y: 1010 },
    fields: [
      ID,
      {
        name: 'licenseId',
        type: 'String',
        attrs: ['@map("license_id")'],
        kind: 'scalar',
        comment: 'From the certificate payload (Master Plan §4.2).',
      },
      {
        name: 'edition',
        type: 'String',
        attrs: [],
        kind: 'scalar',
        comment: [
          'A string, NOT an enum, on purpose. `ADR-009` forbids hard-coding an',
          'edition name in a guard; an enum would put the same four names in a',
          'compile-time constant in the database and make a fifth edition a',
          'migration. Gating is by feature key from the certificate, never by',
          'edition name.',
        ],
      },
      {
        name: 'serialKeyHash',
        type: 'String',
        attrs: ['?', '@map("serial_key_hash")'],
        kind: 'scalar',
        comment: 'The serial is never stored in the clear, and never logged (`AGENTS.md` §2.13).',
      },
      {
        name: 'certificate',
        type: 'Json',
        attrs: [],
        kind: 'scalar',
        comment:
          'The signed payload, schema-validated BEFORE the signature is checked (`ADR-009`), so a malformed certificate fails as a schema error rather than a signature error.',
      },
      { name: 'signature', type: 'String', attrs: [], kind: 'scalar' },
      {
        name: 'keyId',
        type: 'String',
        attrs: ['@map("key_id")'],
        kind: 'scalar',
        comment:
          'Lets a rotated key overlap the old one without invalidating historical certificates.',
      },
      {
        name: 'canonicalizationVersion',
        type: 'Int',
        attrs: ['@map("canonicalization_version")'],
        kind: 'scalar',
        comment:
          '`ADR-009`: part of the signed material, so the canonicalisation can change later without invalidating issued certificates.',
      },
      { name: 'status', type: 'LicenseStatus', attrs: ['@default(PENDING)'], kind: 'scalar' },
      { name: 'issuedAt', type: 'DateTime', attrs: ['@map("issued_at")'], kind: 'scalar' },
      {
        name: 'activatedAt',
        type: 'DateTime',
        attrs: ['?', '@map("activated_at")'],
        kind: 'scalar',
      },
      { name: 'expiresAt', type: 'DateTime', attrs: ['@map("expires_at")'], kind: 'scalar' },
      {
        name: 'lastValidatedAt',
        type: 'DateTime',
        attrs: ['?', '@map("last_validated_at")'],
        kind: 'scalar',
        comment:
          '`PLT-301` caches the verification result; `PLT-305` runs the grace countdown from it.',
      },
      {
        name: 'installId',
        type: 'String',
        attrs: ['?', '@map("install_id")'],
        kind: 'scalar',
        comment: [
          '`ADR-011`: a stable install id generated once and stored, NOT a MAC',
          'address. A container gets a new MAC on every restart, so a MAC-bound',
          'licence breaks on a routine infrastructure restart.',
        ],
      },
      {
        name: 'hostHash',
        type: 'String',
        attrs: ['?', '@map("host_hash")'],
        kind: 'scalar',
        comment:
          '`ADR-011` secondary signal only. Never the sole binding — it is the part most likely to change.',
      },
      CREATED_AT,
      UPDATED_AT,
    ],
    indexes: ['@@index([expiresAt])', '@@index([status])'],
    uniques: ['@@unique([schoolId])'],
  },

  // ── PLT-EPIC-07 Notifications · PLT-EPIC-08 Storage ──────────────────
  {
    name: 'NotificationPreference',
    table: 'notification_preferences',
    comment: [
      'Per-user channel resolution for `PLT-701`. The router falls back to EMAIL',
      '(`AGENTS.md` §2.2); `isDefault` marks which channel wins for an event',
      'type when a user has not overridden it.',
      '',
      'Digesting exists because SMS and WhatsApp are per-message billed.',
    ],
    erd: { x: 1120, y: 736 },
    fields: [
      ID,
      {
        name: 'userId',
        type: 'String',
        attrs: ['@map("user_id")', '@db.Uuid'],
        kind: 'relation',
        to: 'User',
        fk: 'fk_notification_preference_user',
        relation: 'user',
      },
      {
        name: 'user',
        type: 'User',
        attrs: [
          '@relation("fk_notification_preference_user", fields: [userId], references: [id], onDelete: Cascade)',
        ],
        kind: 'relation',
        to: 'User',
        relation: 'user',
        invisible: true,
      },
      { name: 'eventType', type: 'String', attrs: ['@map("event_type")'], kind: 'scalar' },
      { name: 'channel', type: 'NotificationChannel', attrs: [], kind: 'scalar' },
      { name: 'enabled', type: 'Boolean', attrs: ['@default(true)'], kind: 'scalar' },
      { name: 'isDefault', type: 'Boolean', attrs: ['@default(false)'], kind: 'scalar' },
      {
        name: 'digestEnabled',
        type: 'Boolean',
        attrs: ['@default(false)'],
        kind: 'scalar',
        comment: 'Never applies to an EMERGENCY event — those bypass digesting (`PLT-701`).',
      },
      {
        name: 'deliveries',
        type: 'NotificationDelivery[]',
        attrs: ['@relation("fk_notification_delivery_preference")'],
        kind: 'relation',
        to: 'NotificationDelivery',
        relation: 'preference',
        inverse: true,
        invisible: true,
      },
      {
        name: 'digestHour',
        type: 'Int',
        attrs: ['?', '@map("digest_hour")'],
        kind: 'scalar',
        comment: '0-23 in the SCHOOL timezone, not UTC.',
      },
      {
        name: 'quietHoursStart',
        type: 'Int',
        attrs: ['?', '@map("quiet_hours_start")'],
        kind: 'scalar',
      },
      {
        name: 'quietHoursEnd',
        type: 'Int',
        attrs: ['?', '@map("quiet_hours_end")'],
        kind: 'scalar',
      },
      CREATED_AT,
      UPDATED_AT,
    ],
    indexes: ['@@index([userId, eventType])'],
    uniques: ['@@unique([schoolId, userId, eventType, channel])'],
  },

  {
    name: 'NotificationDelivery',
    table: 'notification_deliveries',
    comment: [
      'One row per channel per recipient event (`PLT-702` status tracking).',
      '',
      'There is NO money column, and that is deliberate. SMS and WhatsApp are',
      'per-message billed, but the bill is a financial transaction and every',
      'financial transaction posts through `ILedgerPostingRule`',
      '(`AGENTS.md` §2.6). Putting a cost here would be a second, unbudgeted',
      'place where money lives, in the school currency when the vendor bills in',
      'its own — which is the FX question `ADR-002` puts out of scope.',
    ],
    erd: { x: 1120, y: 1074 },
    fields: [
      ID,
      {
        name: 'userId',
        type: 'String',
        attrs: ['@map("user_id")', '@db.Uuid'],
        kind: 'relation',
        to: 'User',
        fk: 'fk_notification_delivery_user',
        relation: 'user',
      },
      {
        name: 'user',
        type: 'User',
        attrs: [
          '@relation("fk_notification_delivery_user", fields: [userId], references: [id], onDelete: Cascade)',
        ],
        kind: 'relation',
        to: 'User',
        relation: 'user',
        invisible: true,
      },
      {
        name: 'notificationPreferenceId',
        type: 'String',
        attrs: ['?', '@map("notification_preference_id")', '@db.Uuid'],
        kind: 'relation',
        to: 'NotificationPreference',
        fk: 'fk_notification_delivery_preference',
        relation: 'preference',
        comment:
          'Nullable: an EMERGENCY broadcast reaches a user who never configured a preference.',
      },
      {
        name: 'preference',
        type: 'NotificationPreference?',
        attrs: [
          '@relation("fk_notification_delivery_preference", fields: [notificationPreferenceId], references: [id], onDelete: SetNull)',
        ],
        kind: 'relation',
        to: 'NotificationPreference',
        relation: 'preference',
        inverse: true,
        invisible: true,
      },
      { name: 'eventType', type: 'String', attrs: ['@map("event_type")'], kind: 'scalar' },
      { name: 'channel', type: 'NotificationChannel', attrs: [], kind: 'scalar' },
      { name: 'urgency', type: 'NotificationUrgency', attrs: ['@default(NORMAL)'], kind: 'scalar' },
      {
        name: 'status',
        type: 'NotificationDeliveryStatus',
        attrs: ['@default(PENDING)'],
        kind: 'scalar',
      },
      { name: 'subject', type: 'String', attrs: ['?'], kind: 'scalar' },
      {
        name: 'bodyPreview',
        type: 'String',
        attrs: ['?', '@map("body_preview")'],
        kind: 'scalar',
        comment:
          "A truncated preview for diagnostics, not the rendered body — a stored body becomes a stored copy of children's data (`AGENTS.md` §2.13).",
      },
      {
        name: 'digestKey',
        type: 'String',
        attrs: ['?', '@map("digest_key")'],
        kind: 'scalar',
        comment: 'Non-null means the row is held for a digest batch rather than being sent.',
      },
      { name: 'attempts', type: 'Int', attrs: ['@default(0)'], kind: 'scalar' },
      {
        name: 'providerMessageId',
        type: 'String',
        attrs: ['?', '@map("provider_message_id")'],
        kind: 'scalar',
      },
      {
        name: 'lastAttemptAt',
        type: 'DateTime',
        attrs: ['?', '@map("last_attempt_at")'],
        kind: 'scalar',
      },
      { name: 'sentAt', type: 'DateTime', attrs: ['?', '@map("sent_at")'], kind: 'scalar' },
      {
        name: 'deliveredAt',
        type: 'DateTime',
        attrs: ['?', '@map("delivered_at")'],
        kind: 'scalar',
      },
      { name: 'failedAt', type: 'DateTime', attrs: ['?', '@map("failed_at")'], kind: 'scalar' },
      {
        name: 'failureReason',
        type: 'String',
        attrs: ['?', '@map("failure_reason")'],
        kind: 'scalar',
      },
      { name: 'correlationId', type: 'String', attrs: ['@map("correlation_id")'], kind: 'scalar' },
      CREATED_AT,
      UPDATED_AT,
    ],
    indexes: [
      '@@index([userId])',
      '@@index([status])',
      '@@index([correlationId])',
      '@@index([digestKey])',
    ],
  },

  {
    name: 'StoredFile',
    table: 'stored_files',
    comment: [
      'Metadata for an object in S3-compatible storage (`ADR-015`). The bytes',
      'are never in PostgreSQL — the Document/Print engine produces large PDFs',
      'and videos, and `bytea` would bloat every backup.',
      '',
      "No parent-entity reference. `ADR-015` says a file's access follows its",
      'parent entity, and no such entity exists in Platform Core — `PLT-801`',
      'builds `IFileAccessPolicy` against fakes precisely so this table is not',
      'guessing at Student or Homework. GAP: the owning module adds its own',
      'link when it ships.',
    ],
    erd: { x: 1120, y: 1524 },
    fields: [
      ID,
      {
        name: 'scope',
        type: 'String',
        attrs: [],
        kind: 'scalar',
        comment:
          'A tag such as `id-photo` or `homework-submission`, so retention and access rules apply per scope instead of per bucket (`ADR-015`).',
      },
      {
        name: 'storageProvider',
        type: 'String',
        attrs: ['@map("storage_provider")'],
        kind: 'scalar',
        comment:
          'Recorded per object so a provider change does not require backfilling a constant.',
      },
      {
        name: 'bucket',
        type: 'String',
        attrs: [],
        kind: 'scalar',
        comment:
          'Private bucket, always. Retrieval is by signed time-limited URL, never by public read (`ADR-015`).',
      },
      { name: 'objectKey', type: 'String', attrs: ['@map("object_key")'], kind: 'scalar' },
      {
        name: 'originalFilename',
        type: 'String',
        attrs: ['@map("original_filename")'],
        kind: 'scalar',
      },
      {
        name: 'contentType',
        type: 'String',
        attrs: ['@map("content_type")'],
        kind: 'scalar',
        comment:
          'Validated by content sniffing, not by extension — a `.exe` renamed `.jpg` is the case that prevents (`PLT-802`).',
      },
      {
        name: 'sizeBytes',
        type: 'Int',
        attrs: ['@map("size_bytes")'],
        kind: 'scalar',
        comment: [
          'Int, not BigInt: a deliberate 2 GB per-file ceiling, below which the',
          'per-scope max size in `PLT-802` already rejects. Not bytes of money —',
          '`ADR-002` does not apply, so this is not a monetary value.',
        ],
      },
      { name: 'checksum', type: 'String', attrs: [], kind: 'scalar' },
      {
        name: 'scanStatus',
        type: 'FileScanStatus',
        attrs: ['@default(PENDING)', '@map("scan_status")'],
        kind: 'scalar',
      },
      { name: 'scannedAt', type: 'DateTime', attrs: ['?', '@map("scanned_at")'], kind: 'scalar' },
      {
        name: 'uploadedById',
        type: 'String',
        attrs: ['?', '@map("uploaded_by_id")', '@db.Uuid'],
        kind: 'relation',
        to: 'User',
        fk: 'fk_stored_file_uploaded_by',
        relation: 'uploadedBy',
      },
      {
        name: 'uploadedBy',
        type: 'User?',
        attrs: [
          '@relation("fk_stored_file_uploaded_by", fields: [uploadedById], references: [id], onDelete: SetNull)',
        ],
        kind: 'relation',
        to: 'User',
        relation: 'uploadedBy',
        inverse: true,
        invisible: true,
      },
      {
        name: 'retentionUntil',
        type: 'DateTime',
        attrs: ['?', '@map("retention_until")'],
        kind: 'scalar',
        comment: 'Per scope, from the retention policy. Archival, not deletion (`PLT-404`).',
      },
      { name: 'purgedAt', type: 'DateTime', attrs: ['?', '@map("purged_at")'], kind: 'scalar' },
      CREATED_AT,
    ],
    indexes: ['@@index([scope])', '@@index([uploadedById])', '@@index([scanStatus])'],
    uniques: ['@@unique([schoolId, objectKey])'],
  },
];

/** Enum-typed fields, so the renderer can link the types. */
export const ENUM_TYPES = ENUMS.map((e) => e.name);

/** The three tables that carry no foreign key, and why. */
export const FK_FREE_MODELS = [
  {
    model: 'License',
    why: 'The certificate is a signed document about this deployment. The school it names is the value being verified, not a row to point at.',
  },
  {
    model: 'ModuleRegistry',
    why: '`PLT-601`: a row here resolves against the certificate payload, which is JSON, not a relation.',
  },
  {
    model: 'AuditRecord',
    why: 'Append-only. A foreign key to `users` would either block a user delete or cascade the evidence away.',
  },
];

export { SCHOOL_ID };

/** Every model, with `schoolId` injected as the first field if not present. */
export function modelsWithSchoolId() {
  return MODELS.map((m) => {
    const has = m.fields.some((f) => f.name === 'schoolId');
    return has ? m : { ...m, fields: [SCHOOL_ID, ...m.fields] };
  });
}
