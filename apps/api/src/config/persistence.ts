import type { AppConfig } from './env.js';

/**
 * Whether this deployment has a database, and which school it serves.
 *
 * ## Why this is its own file
 *
 * `AuthModule` grew this and `RbacModule` needs the identical answer, down to the
 * refusal on the half-configured case. Duplicating it would give the repository two
 * descriptions of when persistence counts as configured, and they would drift the way
 * two `configureApp` functions drifted — which `create-app.ts` records as the reason
 * it extracts that one.
 *
 * The import it would otherwise create is the reason it is not simply exported from
 * `auth.module.ts`: a feature module reaching into the auth module for one helper
 * drags `@prisma/client` and every auth controller into its graph. That is the same
 * reasoning `I_SESSION_REPOSITORY`'s own comment gives for declaring a token in its
 * port file rather than in the module.
 *
 * ## Why the refusals are here and not at first use
 *
 * `AGENTS.md` 11: start-up must fail fast naming the missing variable, with no silent
 * defaults. Both halves of that are load-bearing:
 *
 * - `DATABASE_URL` set without `SCHOOL_ID`: every repository filters by `schoolId`
 *   (`AGENTS.md` 2.1), so a school id with no database identifies nothing and every
 *   query matches no row. The symptom without this check is a sign-in form that always
 *   fails, discovered by a user.
 * - `SCHOOL_ID` set without `DATABASE_URL`: a half-finished install whose symptom is
 *   the same always-failing form, from the other direction.
 *
 * Neither is worth a clearer error message; both are worth refusing at boot, where an
 * operator is looking.
 */

/** A deployment that has both halves. */
export interface PersistenceConfig {
  readonly databaseUrl: string;
  readonly schoolId: string;
}

/** A trimmed non-empty string, or `null`. Absent and blank are the same answer. */
const presentValue = (value: string | undefined): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

/**
 * Resolve persistence configuration, or `null` when there is none.
 *
 * @throws when exactly one of `DATABASE_URL` / `SCHOOL_ID` is present. Half a
 *   configuration is refused rather than ignored, and the message names the variable
 *   that is missing.
 */
export function readPersistenceConfig(config: AppConfig): PersistenceConfig | null {
  const databaseUrl = presentValue(config.DATABASE_URL);
  const schoolId = presentValue(config.SCHOOL_ID);

  if (databaseUrl === null) {
    if (schoolId !== null) {
      throw new Error(
        'SCHOOL_ID is set but DATABASE_URL is not. Every repository scopes its reads and writes ' +
          'by schoolId, so a school id with no database identifies nothing. Set DATABASE_URL, or ' +
          'unset SCHOOL_ID. (AGENTS.md 11: fail fast, name the variable.)',
      );
    }
    return null;
  }

  if (schoolId === null) {
    throw new Error(
      'DATABASE_URL is set but SCHOOL_ID is not. Every credential repository filters by ' +
        'schoolId (AGENTS.md 2.1), so without it a login would match no account and the ' +
        'installation would be silently unusable. Set SCHOOL_ID to the uuid the rows were ' +
        'written with — seed.mjs documents its own default for local use.',
    );
  }

  return { databaseUrl, schoolId };
}
