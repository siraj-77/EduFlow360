import type { PrismaClient } from '@prisma/client';
import type {
  IAllowedEmailDomainStore,
  StoredEmailDomainAllowlist,
} from '../../domain/ports/allowed-email-domain-store.js';

/**
 * The Prisma implementation of `IAllowedEmailDomainStore`.
 *
 * ## A missing settings row is LOCKED, and that is the point
 *
 * `D49` is fail-closed when the list is empty, and a freshly provisioned
 * database has no settings row at all — the row is written when a school is
 * configured, not when the schema is applied. So "no row" is not an error and it
 * is emphatically not an empty allowlist meaning "anyone may sign in"; it is a
 * school that has configured nothing, which is the locked state.
 *
 * Returning `null` for it rather than `[]` keeps the store honest about what it
 * found. It reports; it does not decide. `decideEmailDomain` maps both to the
 * same refusal, and that mapping is a tested rule rather than a quiet line in a
 * repository.
 *
 * ## `schoolId`
 *
 * Carried on every lookup because `AGENTS.md` §2.1 says so even though isolation
 * here is physical. It is metadata, and it is what the `@@unique([schoolId])` on
 * `school_settings` keys the read on. Two schools sharing a database in a test
 * are the case that proves the lookup is scoped: without it, configuring one
 * school silently unblocks the other.
 */
export class PrismaAllowedEmailDomainStore implements IAllowedEmailDomainStore {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly schoolId: string,
  ) {}

  async readAllowlist(): Promise<StoredEmailDomainAllowlist> {
    const row = await this.prisma.schoolSettings.findUnique({
      where: { schoolId: this.schoolId },
      // One column. The settings blob beside it is the long tail and is not
      // where an authorisation control lives, because a value nobody queries
      // by is a value nobody notices has been emptied.
      select: { allowedEmailDomains: true },
    });

    return row === null ? null : row.allowedEmailDomains;
  }
}
