/**
 * Password hashing, as the application layer sees it.
 *
 * `ADR-007` decides **argon2id, behind this port**, and records why: memory-hard
 * so GPU cracking gains far less than it does against bcrypt; parameters read
 * from configuration rather than hard-coded, because argon2 is tuned for memory
 * hardness and a factor picked on a laptop is wrong for a small school VM
 * (`AGENTS.md` 2.14); a timing-safe comparison, because a naive `===` on a hash
 * leaks through response time; and verify-and-rehash, so a legacy bcrypt hash
 * admitted under the reuse whitelist is upgraded on login instead of forcing a
 * reset.
 *
 * ## ⚠️ THERE IS NO IMPLEMENTATION, AND THAT IS A KNOWN GAP
 *
 * `argon2` is a native module and is NOT installed. `AGENTS.md` 8 forbids adding
 * a library without the owner's explicit instruction, so `PLT-107` ships the port
 * and the rest of the setup flow, and stops there. Nothing in this repository
 * hashes a password yet, which is why the bootstrap admin is `INVITED` with a
 * null `passwordHash` rather than holding a credential invented by a seed
 * script.
 *
 * The seam exists so that the algorithm is a decision rather than an import.
 * `ADR-007`'s own wording is that the port makes a swap "a new implementation,
 * not a refactor" — and a swap that had to rewrite a use-case would not be one.
 *
 * ## What `verify` is shaped around
 *
 * Verify-and-rehash cannot be built if `verify` returns a bare boolean, because
 * the caller then has no way to learn which algorithm matched or whether the cost
 * parameters are still current. So it returns a verdict that carries both. A
 * caller that ignores `needsRehash` still works; a caller that honours it can
 * migrate without a password reset and without a second column.
 *
 * Note that a *failed* verification must not reveal the stored algorithm: it is
 * `null` on the failure branch below, so a wrong password cannot be used to probe
 * which algorithm a hash was written with.
 */

/**
 * Cost parameters for one hash.
 *
 * An opaque bag of numbers rather than named fields, deliberately. The knobs
 * belong to the ALGORITHM — `m`/`t`/`p` for argon2, a single cost for bcrypt —
 * so a port that named them would have to change shape when the algorithm
 * changes, which is precisely the coupling the port exists to remove. `ADR-007`
 * requires the values to come from school settings; resolving them is the
 * caller's job, not the hasher's.
 */
export type PasswordHashParameters = Readonly<Record<string, number>>;

/** A hash, and the label ADR-007's verify-and-rehash needs to read back. */
export interface HashedPassword {
  /**
   * The hash to store in `User.passwordHash`.
   *
   * Never returned in an API response and never logged (`ADR-007`;
   * `AGENTS.md` 2.13) — not truncated, not masked, absent.
   */
  readonly hash: string;
  /**
   * The label to store alongside it in `User.passwordAlgorithm`.
   *
   * A string rather than an enum on purpose, for the same reason the licence
   * edition is a string: an algorithm added later must not require a migration.
   */
  readonly algorithm: string;
}

/**
 * The outcome of checking a password against a stored hash.
 *
 * `algorithm` and `needsRehash` are only meaningful on the `verified` branch.
 */
export type PasswordVerification =
  /** The password matched. */
  | {
      readonly verified: true;
      /** The algorithm the STORED hash was written with. */
      readonly algorithm: string;
      /**
       * Whether the stored hash should be replaced with a fresh one at the
       * current parameters. An older algorithm or a weaker cost both set this.
       */
      readonly needsRehash: boolean;
    }
  /** The password did not match. Carries nothing, so it cannot be probed. */
  | { readonly verified: false };

export interface IPasswordHasher {
  /**
   * Hash a plaintext at the given cost parameters.
   *
   * `parameters` is required rather than defaulted: `ADR-007` rejected a
   * hard-coded cost factor outright, and an optional argument with an internal
   * default is a hard-coded cost factor with extra steps.
   */
  hash(plaintext: string, parameters: PasswordHashParameters): Promise<HashedPassword>;

  /**
   * Check a plaintext against a stored hash.
   *
   * `algorithm` is the label read back from `User.passwordAlgorithm`, and is
   * what lets one implementation verify a legacy bcrypt hash while writing only
   * argon2id — the migration path `ADR-007` describes, with no second hasher.
   *
   * The comparison must be timing-safe (`ADR-007`). `hash` and `algorithm` are
   * both attacker-supplied on the login path, so neither may reach the underlying
   * comparison unchecked.
   */
  verify(plaintext: string, hash: string, algorithm: string): Promise<PasswordVerification>;
}
