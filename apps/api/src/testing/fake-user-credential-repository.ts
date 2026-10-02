import type {
  FailedSignInOutcome,
  IUserCredentialRepository,
  UserCredentialRecord,
} from '../modules/auth/domain/repositories/user-credential-repository.js';

/**
 * An in-memory `IUserCredentialRepository`, for tests that are not about the
 * database.
 *
 * It lives in `src/testing/` for the same reason `fake-clock.ts` does: it needs to
 * construct instants and generate identifiers, and `AGENTS.md` 2.4's ESLint rule
 * bans both under `domain/` and `use-cases/`.
 *
 * ## What this double is honest about
 *
 * It reproduces the port's contract and nothing else:
 *
 *   - `findByIdentifier` matches either identifier exactly, as the real
 *     repository does — no case folding, no trimming;
 *   - `recordFailedSignIn` increments, locks at the threshold, and resets the
 *     counter when it locks;
 *   - it RECORDS how many times it was asked to count a failure, because the
 *     enumeration argument depends on that call happening for an unknown
 *     identifier exactly as it does for a wrong password. A double that quietly
 *     skipped it for a miss would let an implementation with the oracle pass.
 */
export interface FakeUserCredentialOptions {
  /** The account this fake knows about, or `null` for a deployment with none. */
  readonly record?: Partial<UserCredentialRecord> | null;
  /** Now, for the default `lastLoginAt` on a seeded record. */
  readonly now?: Date;
}

export class FakeUserCredentialRepository implements IUserCredentialRepository {
  /** One entry per call, so a test can assert a failure was counted at all. */
  readonly failureCountingCalls: Array<{ identifier: string; now: Date }> = [];
  readonly successfulSignIns: Array<{ userId: string; now: Date }> = [];
  readonly replacements: Array<{
    userId: string;
    passwordHash: string;
    passwordAlgorithm: string;
    now: Date;
  }> = [];

  private record: UserCredentialRecord | null;

  constructor(options: FakeUserCredentialOptions = {}) {
    const seed = options.record;
    this.record =
      seed === null || seed === undefined
        ? null
        : {
            userId: seed.userId ?? 'user-under-test',
            passwordHash: seed.passwordHash ?? '$argon2id$v=19$m=1,t=1,p=1$c2FsdA$aGFzaA',
            passwordAlgorithm: seed.passwordAlgorithm ?? 'argon2id',
            status: seed.status ?? 'ACTIVE',
            failedLoginAttempts: seed.failedLoginAttempts ?? 0,
            lockedUntil: seed.lockedUntil ?? null,
          };
  }

  /** The identifier the seeded account answers to. Overridable for two-identifier tests. */
  identifier = 'principal@school.test';

  /** Replace the account mid-test, e.g. to apply a lockout. */
  setRecord(record: UserCredentialRecord | null): void {
    this.record = record;
  }

  /** Read the account back, for assertions about what the use-case left behind. */
  current(): UserCredentialRecord | null {
    return this.record;
  }

  async findByIdentifier(
    identifier: string,
  ): Promise<{ matched: true; record: UserCredentialRecord } | { matched: false }> {
    if (this.record === null) return { matched: false };
    if (identifier !== this.identifier && identifier !== this.record.userId) {
      return { matched: false };
    }
    return { matched: true, record: { ...this.record } };
  }

  async recordFailedSignIn(params: {
    readonly identifier: string;
    readonly now: Date;
    readonly maxAttempts: number;
    readonly lockoutMs: number;
  }): Promise<FailedSignInOutcome> {
    this.failureCountingCalls.push({ identifier: params.identifier, now: params.now });

    if (this.record === null) return { outcome: 'unknown-identifier' };
    if (params.identifier !== this.identifier && params.identifier !== this.record.userId) {
      return { outcome: 'unknown-identifier' };
    }

    const next = this.record.failedLoginAttempts + 1;
    if (next >= params.maxAttempts) {
      const lockedUntil = new Date(params.now.getTime() + params.lockoutMs);
      this.record = { ...this.record, failedLoginAttempts: 0, lockedUntil };
      return { outcome: 'locked', lockedUntil };
    }

    this.record = { ...this.record, failedLoginAttempts: next };
    return { outcome: 'counted', failedLoginAttempts: next };
  }

  async recordSuccessfulSignIn(params: { userId: string; now: Date }): Promise<void> {
    this.successfulSignIns.push({ userId: params.userId, now: params.now });
    if (this.record === null || this.record.userId !== params.userId) return;
    this.record = {
      ...this.record,
      failedLoginAttempts: 0,
      lockedUntil: null,
    };
  }

  async replaceCredential(params: {
    readonly userId: string;
    readonly passwordHash: string;
    readonly passwordAlgorithm: string;
    readonly now: Date;
  }): Promise<void> {
    this.replacements.push(params);
    if (this.record === null || this.record.userId !== params.userId) return;
    this.record = {
      ...this.record,
      passwordHash: params.passwordHash,
      passwordAlgorithm: params.passwordAlgorithm,
    };
  }
}
