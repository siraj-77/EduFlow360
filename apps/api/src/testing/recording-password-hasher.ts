import type {
  HashedPassword,
  IPasswordHasher,
  PasswordHashParameters,
  PasswordVerification,
} from '../modules/auth/domain/ports/password-hasher.js';

/**
 * Counts what a use-case asked the hasher to do, and delegates to a real one.
 *
 * ## Why a recorder over a real hasher rather than a stub
 *
 * Because the enumeration argument is about WORK, not about return values. A stub
 * that returns `{ verified: false }` immediately cannot distinguish "the use-case
 * verified once" from "the use-case skipped verification entirely" — and skipping
 * it for an unknown user is the exact defect the dummy-hash mitigation exists to
 * prevent.
 *
 * So this wraps the REAL `Argon2PasswordHasher` and only counts. Tests construct
 * it with deliberately cheap cost parameters (8 KiB, one pass, one lane — the
 * library's own floor), which keeps a suite that performs a dozen verifications
 * fast while leaving the timing characteristic of argon2 intact.
 *
 * ## What it deliberately does NOT do
 *
 * It does not make verification fast, and it must not. A recorder that skipped the
 * delegate would make the over-HTTP timing test in
 * `login-over-http.integration.spec.ts` meaningless, because that test's whole
 * claim is that argon2 runs on the missing-user path too.
 */
export class RecordingPasswordHasher implements IPasswordHasher {
  readonly hashCalls: Array<{ plaintext: string; parameters: PasswordHashParameters }> = [];
  readonly verifyCalls: Array<{ plaintext: string; hash: string; algorithm: string }> = [];

  constructor(private readonly inner: IPasswordHasher) {}

  /** How many verifications were performed. The enumeration-relevant number. */
  get verifyCount(): number {
    return this.verifyCalls.length;
  }

  /** The hashes verification was attempted against, in order. */
  verifiedHashes(): string[] {
    return this.verifyCalls.map((call) => call.hash);
  }

  async hash(plaintext: string, parameters: PasswordHashParameters): Promise<HashedPassword> {
    this.hashCalls.push({ plaintext, parameters });
    return this.inner.hash(plaintext, parameters);
  }

  async verify(plaintext: string, hash: string, algorithm: string): Promise<PasswordVerification> {
    this.verifyCalls.push({ plaintext, hash, algorithm });
    return this.inner.verify(plaintext, hash, algorithm);
  }
}
