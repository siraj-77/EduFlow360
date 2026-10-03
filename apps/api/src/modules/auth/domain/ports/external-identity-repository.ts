/**
 * `ExternalIdentity`, as the application layer sees it.
 *
 * ## What was missing before this file existed
 *
 * The `ExternalIdentity` **model** has been in `schema.prisma` since `PLT-101`
 * tranche 1. Nothing read it. There was no port, no implementation, and no
 * `domain/ports/` file for it at all — so `D57`'s must-link rule ("an identity is
 * authorised by an `ExternalIdentity` lookup") was a policy with no mechanism behind
 * it, which is the exact state `AGENTS.md` §2.3 calls a defect.
 *
 * ## The identifier rule, which is the whole point of the file
 *
 * **`subject` is the only lookup key. Never the email address.**
 *
 * Google's `sub` is immutable for a person. An address is not: it can be recycled,
 * and a school moving its Workspace domain rewrites every staff address at once.
 * Sign in by address and a recycled mailbox silently becomes another human's
 * account, with their children's data attached. `AGENTS.md` §2.13.
 *
 * So `providerEmail` appears below exactly once — as a **snapshot on `link`**,
 * recorded so a human reading a "connected accounts" screen sees something. It is
 * deliberately not unique in the schema and it is deliberately not a parameter of
 * `findBySubject`. `database-contract.integration.spec.ts` holds the "two people may
 * share an address" line with a test against the real database.
 *
 * ## Why the DI token lives here and not in `auth.module.ts`
 *
 * `CLOCK` set the precedent and the reason is structural: a token has to be
 * importable by the thing that *consumes* it. The callback controller imports this
 * port for the token, and `auth.module.ts` imports that controller — so a token
 * declared in the module would close an import cycle. Declared here, the dependency
 * points one way.
 */

/**
 * DI token for this port.
 *
 * A symbol rather than the interface, because a TypeScript `interface` has no
 * runtime value for Nest to resolve against. `@Inject(I_EXTERNAL_IDENTITY_REPOSITORY)`
 * is how a consumer names it.
 */
export const I_EXTERNAL_IDENTITY_REPOSITORY = Symbol('IExternalIdentityRepository');

/** One linked external identity, as far as authorisation is concerned. */
export interface ExternalIdentityRecord {
  /** The local account this identity is bound to. THE answer to "who is this?" */
  readonly userId: string;
  /** The provider that vouched for it. Data, so a second provider is a row. */
  readonly provider: string;
  /** The provider's immutable id for that person. */
  readonly subject: string;
}

/** What a link attempt is asking for. */
export interface LinkExternalIdentityParams {
  /** The account being linked TO. Supplied by the authenticated route. */
  readonly userId: string;
  /** Provider key, e.g. `google`. Never hard-coded at a use site (`AGENTS.md` 2). */
  readonly provider: string;
  /** The provider's immutable id. The identity being bound. */
  readonly subject: string;
  /**
   * The address the provider reported, for display.
   *
   * `string | null` rather than `string` because a provider may assert no address,
   * and "none" must be representable. Snapshot only — see the header.
   */
  readonly email: string | null;
  /**
   * What the provider claimed about that address at link time.
   *
   * A snapshot, never re-read as a current fact, and `null` is "the provider said
   * nothing" rather than "unverified". Collapsing those two would lose a distinction
   * `oidc-provider.ts` deliberately preserves.
   */
  readonly emailVerified: boolean | null;
}

/**
 * What `link` did.
 *
 * ## Why there are three answers, and which one is the security decision
 *
 * `(provider, subject)` is unique in the schema. `link` may therefore arrive for a
 * pair that already exists, and there are two genuinely different cases:
 *
 * | outcome                   | when                                          | correct response |
 * |---------------------------|-----------------------------------------------|------------------|
 * | `linked`                  | no row for this `(provider, subject)`        | write it         |
 * | `already-linked`          | a row exists, bound to the **same** `userId` | succeed, change nothing |
 * | `already-linked-elsewhere`| a row exists, bound to a **different** account | **REFUSE**    |
 *
 * **`already-linked-elsewhere` must never re-point the identity, and that is the
 * whole decision.**
 *
 * An `upsert` here would be silent account takeover. The attacker signs in as
 * themselves, links their own Google, then triggers a re-link that moves that row
 * onto the victim's account — and from then on the attacker signs in *as the
 * victim*. Re-pointing an identity is therefore not a repair, not a convenience and
 * not idempotence; it is a credential reassignment, and nothing in this system has
 * the authority to perform one.
 *
 * `already-linked` is reported separately rather than folded into `linked` because a
 * caller that retries a link must be able to tell "I wrote it" from "it was already
 * there, and by somebody". Both succeed; they are different facts.
 *
 * ## What happens on a genuine race
 *
 * Two concurrent links for one `(provider, subject)` can both read "no row" and both
 * try to insert. The schema's `@@unique([schoolId, provider, providerSubject])` is
 * what settles it — the loser gets a unique-constraint violation, not a second row.
 * See `prisma-external-identity-repository.ts`.
 */
export type LinkExternalIdentityOutcome =
  | { readonly outcome: 'linked' }
  | { readonly outcome: 'already-linked' }
  | { readonly outcome: 'already-linked-elsewhere' };

/**
 * The port.
 *
 * Two verbs, and no third. Notably absent:
 *
 * - **`findByEmail`.** See the header. Its absence is the control.
 * - **`unlink`.** Out of scope for this story and a real gap: a user who links the
 *   wrong Google account has no way to undo it, and the only remedy today is an
 *   administrator editing the row. Recorded as a gap rather than quietly omitted.
 */
export interface IExternalIdentityRepository {
  /**
   * Find the local account this identity belongs to, or `null`.
   *
   * `null` is the answer that decides `D57`: no match means **reject the sign-in**,
   * never create a `User`. Auto-provisioning here would let any student with a
   * school Gmail become a system user.
   */
  findBySubject(provider: string, subject: string): Promise<ExternalIdentityRecord | null>;

  /**
   * Bind this identity to `userId`, or report why not.
   *
   * MUST NOT overwrite an existing `(provider, subject)`. See the outcome table —
   * `already-linked-elsewhere` exists so that a caller cannot mistake a refusal for
   * a write.
   */
  link(params: LinkExternalIdentityParams): Promise<LinkExternalIdentityOutcome>;
}
