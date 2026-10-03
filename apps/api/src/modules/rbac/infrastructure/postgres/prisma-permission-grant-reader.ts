import type { PrismaClient } from '@prisma/client';
import type { IPermissionGrantReader } from '../../domain/ports/permission-grant-reader.js';

/**
 * The Prisma implementation of the permission port.
 *
 * ## The query, and why it is an existence check
 *
 * One `findFirst` against `role_permissions`, filtered by the permission key and by
 * the roles this user actually holds. That mirrors the schema exactly:
 *
 *     User ──< UserRole >── Role ──< RolePermission >── Permission
 *
 * and it is an **existence** question because the schema grants nothing else. There
 * is no deny row to subtract, no wildcard to expand and no role hierarchy to walk —
 * `Permission` rows are the catalogue (`ADR-012`) and `RolePermission` rows are the
 * only thing that confers anything. An implementation that computed a set and compared
 * it would be computing a model the database does not have.
 *
 * `findFirst` rather than `findMany`, because "does a grant exist" does not need the
 * grants. Fetching every key a user holds to answer one question would put an
 * unbounded result set in front of a request that wants a boolean.
 *
 * ## The filter is on BOTH ends, and that is the security property
 *
 * `permission: { key }` alone would answer `true` for **every user in the school**,
 * because the grant row does not know who holds the role — `Role.users` does. The
 * `role: { users: { some: { userId } } }` clause is what makes it this user's grant
 * rather than the school's, and
 * `prisma-permission-grant-reader.integration.spec.ts` asserts the negative directly:
 * a stranger to a granted key is refused. A unit test with a fake reader could not
 * catch a join that was too generous, because a fake returns what the test says.
 *
 * ## No trimming, no case folding, no normalisation
 *
 * `Permission.key` is a `MODULE_ACTION` string written by a deploy-time sync
 * (`ADR-012`) and compared here with `===` semantics by Prisma. Normalising either
 * side would make `finance_invoice_reverse` and `FINANCE_INVOICE_REVERSE` the same
 * permission, and a catalogue is a set of identifiers: two spellings of one key is a
 * sync bug, and papering over it would hide the bug while creating a second way to
 * name a permission. The blank key is likewise not special-cased here — it matches no
 * `Permission` row and therefore resolves to `false`, which is the fail-closed answer.
 * `decidePermissionAccess` refuses a blank key before it ever gets here.
 *
 * ## `schoolId`
 *
 * Carried on every write and in the filter, exactly as `PrismaSessionRepository`
 * does. `AGENTS.md` 2.1 calls it metadata rather than a security control — isolation
 * is physical, one database per school — but both tables involved have composite
 * primary keys that include it (`UserRole` is `[schoolId, userId, roleId]`,
 * `RolePermission` is `[schoolId, roleId, permissionId]`), so a row written without it
 * would violate no useful constraint and could collide across schools in a shared
 * test database. It is applied because the keys require it, not as tenancy
 * machinery: there is no `schoolId` in the guard, in the port, or in the rule.
 */
export class PrismaPermissionGrantReader implements IPermissionGrantReader {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly schoolId: string,
  ) {}

  /**
   * @throws whatever Prisma throws. Deliberately not caught and not folded into
   *   `false`: a database outage is not a permission decision, and the guard lets this
   *   propagate so the request surfaces as a 500 rather than a 403 that reads like
   *   policy. See the port's "Errors are not answers".
   */
  async isGranted(params: { userId: string; permissionKey: string }): Promise<boolean> {
    const grant = await this.prisma.rolePermission.findFirst({
      where: {
        schoolId: this.schoolId,
        permission: { key: params.permissionKey },
        // The user's own roles, and no others'. See the file header.
        role: { users: { some: { userId: params.userId } } },
      },
      // Only enough to know a row exists. Nothing here reads the columns.
      select: { roleId: true },
    });

    return grant !== null;
  }
}
