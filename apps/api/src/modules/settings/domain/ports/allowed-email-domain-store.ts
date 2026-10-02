/**
 * The allowed-email-domain list, as the application layer sees it.
 *
 * `AGENTS.md` §2.2: a repository is a port, and its Prisma implementation lives
 * in `infrastructure/postgres/`. Nothing above this line knows a database
 * exists, and `domain/` may not so much as name `@prisma/client`.
 *
 * ## Why the port returns `unknown`
 *
 * The column is `Json`, so the value really can be anything JSON can hold — an
 * object, a number, a string, null. Typing this as `string[] | null` would put
 * the narrowing somewhere the compiler cannot check, because the value arrives
 * from a database column through an ORM. The type that makes the failure mode
 * visible is the honest one, and the narrowing happens once, in
 * `decideEmailDomain`, where it is tested.
 *
 * This is the cost of choosing `Json` over a list column, recorded rather than
 * glossed: the port is untyped and the caller is obliged to cope. What it buys
 * is that a null arriving from a raw migration is a state the code is forced to
 * handle, rather than one the type system says cannot happen.
 */

/**
 * Whatever the settings column holds, untyped.
 *
 * `unknown` rather than `any` on purpose: `any` would propagate into the caller
 * and switch off checking there too.
 */
export type StoredEmailDomainAllowlist = unknown;

export interface IAllowedEmailDomainStore {
  /**
   * Read this school's configured domains, verbatim.
   *
   * Verbatim is the contract. The store must NOT normalise, trim or
   * de-duplicate: normalisation is a security decision and it lives in
   * `decideEmailDomain`, which is unit-tested as a rule. A reader that tidied
   * the value on the way out would put a second, untested opinion about what a
   * domain looks like in the layer that is supposed to know nothing.
   *
   * A school with no settings row returns `null`, which is the same
   * fail-closed state as an empty list — see `decideEmailDomain`.
   */
  readAllowlist(): Promise<StoredEmailDomainAllowlist>;
}
