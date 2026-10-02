/**
 * This school's argon2id cost parameters, as the application layer sees them.
 *
 * `AGENTS.md` §2.2: a repository is a port, and its Prisma implementation lives
 * in `infrastructure/postgres/`. This mirrors
 * `IAllowedEmailDomainStore` deliberately — the column is `Json?` in both cases,
 * so the same two failure modes have to be handled the same way, and having one
 * answer for "what does an untyped settings column mean" is worth more than
 * having two.
 *
 * ## Why the port returns `unknown`
 *
 * Because the column is `Json`, the value genuinely can be anything JSON holds —
 * an object, a number, a string, null, an array. Typing it as the resolved
 * parameters would put the narrowing where the compiler cannot check it, since
 * the value arrives from a database column through an ORM. The honest type is
 * `unknown`, and the narrowing happens once, in `resolvePasswordHashParameters`,
 * where it is tested as a rule.
 *
 * That is the recorded cost of choosing `Json`, and it is the same trade the
 * email-domain column already made: nothing in the database constrains the
 * contents, so the reader is the only thing that can notice a nonsense value.
 * Here the nonsense is a cost parameter, and a cost parameter that reaches the
 * native library unvalidated does not merely read wrong — a negative pass count
 * does not error, it never returns.
 */
export type StoredPasswordHashParameters = unknown;

export interface IPasswordHashParameterStore {
  /**
   * Read this school's configured argon2id cost parameters, verbatim.
   *
   * Verbatim is the contract, for the reason it is on the allowlist store:
   * validation is a security decision and it belongs in a tested rule, not
   * smeared across a repository. A reader that clamped here would give a second,
   * untested opinion about what a usable cost is, in the layer that is supposed
   * to know nothing.
   *
   * A school with no settings row, or a row with a null column, returns `null`.
   * That is not an error: it is a school that has configured nothing, which
   * `resolvePasswordHashParameters` maps to the documented default while
   * reporting `origin: 'default'` so the fallback is visible.
   */
  readParameters(): Promise<StoredPasswordHashParameters>;
}
