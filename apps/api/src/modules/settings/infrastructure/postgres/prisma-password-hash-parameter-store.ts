import type { PrismaClient } from '@prisma/client';
import type {
  IPasswordHashParameterStore,
  StoredPasswordHashParameters,
} from '../../domain/ports/password-hash-parameter-store.js';

/**
 * The Prisma implementation of `IPasswordHashParameterStore`.
 *
 * ## Absent settings is a DEFAULT here, and the contrast with the allowlist is deliberate
 *
 * `PrismaAllowedEmailDomainStore` returns `null` for a missing settings row and
 * the rule above it treats that as LOCKED — fail-closed, because with no
 * configured domain the safe reading is "nobody may sign in".
 *
 * This reader returns `null` for the same state and the rule above it treats it
 * as "use the documented default". Both are null and both are deliberate, and
 * they point in opposite directions. Worth stating plainly, because two readers
 * that return the same value for a missing row and resolve it in opposite
 * directions is exactly the sort of pairing a later reader will assume is a bug
 * in one of them.
 *
 * The difference is what is being protected. A missing allowlist means an
 * authentication DECISION has no policy behind it, and the conservative reading
 * is to refuse. A missing cost parameter means a hash has no cost behind it, and
 * the conservative reading would be... to log nobody in, forever, on a
 * deployment that was simply never configured. There is no attacker who gains
 * anything from a school that cannot sign anyone in, so the fail-closed instinct
 * buys nothing here and costs the whole product.
 *
 * ## `schoolId`
 *
 * Carried on the lookup because `AGENTS.md` §2.1 says so even though isolation
 * here is physical. It is metadata, and it is what the `@@unique([schoolId])` on
 * `school_settings` keys the read on. This is the case that proves the scoping:
 * two schools sharing a database in the integration suite, where tuning one
 * school must not silently retune the other.
 */
export class PrismaPasswordHashParameterStore implements IPasswordHashParameterStore {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly schoolId: string,
  ) {}

  async readParameters(): Promise<StoredPasswordHashParameters> {
    const row = await this.prisma.schoolSettings.findUnique({
      where: { schoolId: this.schoolId },
      // One column. The long-tail `settings` blob beside it is not where a
      // credential cost lives, because a value nobody queries by is a value
      // nobody notices having been emptied.
      select: { passwordHashParameters: true },
    });

    return row === null ? null : row.passwordHashParameters;
  }
}
