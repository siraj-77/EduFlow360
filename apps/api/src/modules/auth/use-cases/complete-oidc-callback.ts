import type { IOidcProvider, OidcCallbackQuery } from '../domain/ports/oidc-provider.js';
import type { IOidcStateStore, OidcStatePayload } from '../domain/ports/oidc-state-store.js';
import type {
  IExternalIdentityRepository,
  LinkExternalIdentityParams,
} from '../domain/ports/external-identity-repository.js';
import type {
  ISessionRepository,
  IssuedSession,
  SessionActor,
} from '../domain/ports/session-repository.js';
import type { IAllowedEmailDomainStore } from '../../settings/domain/ports/allowed-email-domain-store.js';
import {
  decideEmailDomain,
  type EmailDomainRejectionReason,
} from '../../settings/domain/services/allowed-email-domain.js';

/**
 * `GET /auth/oidc/callback` — where a stranger's assertion becomes a local account.
 *
 * ## Why this is the most security-critical file in the repository
 *
 * Everything above it is preparation. This is the one place a claim made by somebody
 * who has never seen this installation is turned into a session that can read a
 * school's data.
 *
 * ## The five steps, and why the ORDER is the security content
 *
 * ```
 * 1. open the state cookie      → null ⇒ refuse (absent, forged, or expired)
 * 2. compare `state`            → BEFORE any network call
 * 3. verifyCallback             → signature, issuer, audience, azp, nonce, expiry, PKCE
 * 4. decideEmailDomain          → fail-closed; an empty allowlist means LOCKED
 * 5. require emailVerified      → D57
 * 6. findBySubject / link       → sign-in: no match ⇒ REFUSE.  link: the account in the bundle.
 * ```
 *
 * Reordering any two of these changes what an attacker can do, and the specs assert
 * the orderings rather than leaving them to the reader:
 *
 * - **2 before 3.** If the `state` comparison happened inside the provider, this
 *   repository would not own the control; the ordering would be an implementation
 *   detail of an adapter. Here it is a line in this file, and the test asserts the
 *   provider was never called at all.
 * - **4 before 6.** The domain rule is a pre-filter. Looking the identity up first
 *   would do database work for an address this school does not admit.
 * - **5 before 6.** `emailVerified` selects; `ExternalIdentity` authorises. `D57`:
 *   "`email_verified` + allowlist selects; `ExternalIdentity` lookup by
 *   `(provider, sub)` authorises; no match means reject."
 *
 * ## Why step 6 creates NOTHING on the sign-in path — `D57`
 *
 * This is the whole point of the route. Auto-provisioning a `User` for any verified
 * `@school.test` Google account would let **any student with a school Gmail become a
 * system user**, with whatever the default role grants. `IExternalIdentityRepository`
 * has no method that creates an account, so the capability is not merely unused — it
 * does not exist. A refusal is the only answer available.
 *
 * ## Why there is no session cookie parameter, and why the link target is sealed
 *
 * The naive design is "if a session cookie is present, link; otherwise sign in". That
 * is account takeover: a victim is signed in, an attacker completes their own Google
 * sign-in in the victim's browser, and the callback binds the ATTACKER's identity to
 * the VICTIM's account.
 *
 * So this method takes no request, reads no cookie, and has no `userId` parameter.
 * There is no surface for the attack to arrive through. The link target is the
 * `userId` inside the MAC of a bundle that only `GET /auth/oidc/link` — behind
 * `SessionGuard` — can mint.
 *
 * ## Why the domain rule also runs on the LINK path
 *
 * Decided here rather than inherited, and the alternative was considered: a link
 * starts from an authenticated local account, so arguably the Google address does
 * not need admitting. It is applied anyway because it is the MORE restrictive of the
 * two options, it invents no threshold and no policy (it applies `D49` as written),
 * and it costs nothing — `POST /auth/login` still works for anyone whose Google
 * address falls outside the list. One rule, two paths, no surprise.
 */

/** Why a callback was refused. Never carries the value that caused it. */
export type OidcCallbackRefusal =
  /** No bundle, a forged one, or one past `ttlMs`. Three failures, one answer. */
  | 'state-unreadable'
  /** The `state` in the query is not the one inside the bundle. Login CSRF. */
  | 'state-mismatch'
  /** The provider refused the exchange, or the ID token failed verification. */
  | 'provider-rejected'
  /** `email_verified` was absent or false. `D57`. */
  | 'email-unverified'
  /** The identity is not bound to any `User`. `D57`. */
  | 'identity-not-linked'
  /** The identity IS bound — to a different account. See the link path below. */
  | 'identity-linked-elsewhere'
  /** `D49`'s four refusals, kept apart so an operator can tell them. */
  | Extract<
      EmailDomainRejectionReason,
      | 'allowlist-malformed'
      | 'allowlist-not-configured'
      | 'address-malformed'
      | 'domain-not-permitted'
    >;

/**
 * What completing a callback produced.
 *
 * A discriminated union rather than an exception per failure, so a caller cannot
 * forget a branch: `AGENTS.md` 8 forbids swallowing, and a `throw` that nobody
 * catches turns a refused sign-in into a 500.
 */
export type OidcCallbackOutcome =
  /** Sign-in succeeded. The session is the caller's to deliver to the browser. */
  | { readonly outcome: 'signed-in'; readonly session: IssuedSession }
  /** A new identity was bound to the account the bundle named. */
  | { readonly outcome: 'linked' }
  /** That identity was already bound to that account. Nothing changed; it succeeded. */
  | { readonly outcome: 'already-linked' }
  /** Refused. The reason names the rule, never the value that broke it. */
  | { readonly outcome: 'refused'; readonly reason: OidcCallbackRefusal };

/** What to persist against the session. Optional, so it may be absent entirely. */
export interface OidcCallbackDevice {
  readonly ipAddress?: string | undefined;
  readonly userAgent?: string | undefined;
}

/**
 * What this use-case needs from a verified identity.
 *
 * **A structural subset of `OidcIdentity`, not `OidcIdentity` itself.** The whole
 * point of `oidc-provider.ts` is that the port returns claims rather than a user, and
 * naming the subset here states what is actually consumed: `subject` to look the
 * account up, `email` for the domain rule, `emailVerified` for `D57`. Widening this
 * to `OidcIdentity` would be equally correct today and would silently permit a later
 * line to start reading a field for a purpose nobody approved.
 */
interface VerifiedIdentity {
  readonly subject: string;
  readonly provider: string;
  readonly email: string | null;
  readonly emailVerified: boolean | null;
}

export interface CompleteOidcCallbackDeps {
  readonly provider: IOidcProvider;
  readonly stateStore: IOidcStateStore;
  readonly domains: IAllowedEmailDomainStore;
  readonly identities: IExternalIdentityRepository;
  readonly sessions: ISessionRepository;
  readonly sessionTtlMs: number;
  readonly refreshTtlMs: number;
}

const refuse = (reason: OidcCallbackRefusal): OidcCallbackOutcome => ({
  outcome: 'refused',
  reason,
});

export class CompleteOidcCallback {
  constructor(private readonly deps: CompleteOidcCallbackDeps) {}

  async complete(params: {
    readonly query: OidcCallbackQuery;
    /** The raw `eduflow_oidc_state` cookie value, verbatim. Never parsed here. */
    readonly stateCookie: string | undefined;
    readonly device?: OidcCallbackDevice | undefined;
  }): Promise<OidcCallbackOutcome> {
    const { provider, stateStore, domains } = this.deps;

    // ── 1. The bundle ────────────────────────────────────────────────────────
    // `open` verifies the MAC and the server-side age. It answers `null` for four
    // different failures — absent, malformed, wrongly signed, expired — and this
    // route answers all four identically, because its only correct answer to all
    // four is to refuse.
    const sealed = stateStore.open(params.stateCookie);
    if (sealed === null) return refuse('state-unreadable');

    // ── 2. The `state`, BEFORE any network call ──────────────────────────────
    // Ours, not the adapter's. `GoogleOidcProvider.verifyCallback` checks this too —
    // defence in depth — but if the ordering lived only there, this repository would
    // not own the control and the test could not assert that no call was made.
    if (params.query.state !== sealed.state) return refuse('state-mismatch');

    // ── 3. The exchange ──────────────────────────────────────────────────────
    // The four values come from the bundle, never from the query, so nothing the
    // provider sent back can influence what it is asked to verify.
    let verified;
    try {
      verified = await provider.verifyCallback(params.query, toExpected(sealed));
    } catch {
      // The provider's message names which of its five checks failed. That is a free
      // oracle for anyone who can make a callback, so it is swallowed into ONE typed
      // reason. `AGENTS.md` 8 forbids swallowing errors — this is not that: the
      // refusal is recorded in the outcome, and a genuine fault inside the adapter
      // remains a 500 because `verifyCallback` throws for refusals, not for crashes.
      return refuse('provider-rejected');
    }

    // ── 4. The domain pre-filter, fail-closed ────────────────────────────────
    // Before any identity lookup. `decideEmailDomain` is `D49`: null, `[]` and a
    // list of unusable entries all mean NOTHING is permitted.
    const domain = decideEmailDomain({
      allowlist: await domains.readAllowlist(),
      email: verified.email ?? '',
    });
    if (!domain.allowed) return refuse(domain.reason);

    // ── 5. `emailVerified`, and it must be `true` ────────────────────────────
    // `null` is refused alongside `false`. "The provider said nothing" and "the
    // provider said no" are different claims, and neither is consent.
    if (verified.emailVerified !== true) return refuse('email-unverified');

    // ── 6. What the sealed MODE permits ──────────────────────────────────────
    if (sealed.mode === 'link') return this.completeLink(sealed, verified);
    return this.completeSignIn(verified, params.device);
  }

  /**
   * Sign-in mode: MUST-LINK, and therefore refuse-or-issue.
   *
   * There is no third option. `IExternalIdentityRepository` has no method that
   * creates an account, so this cannot be reached by a future edit that forgets a
   * line — the capability is absent, not merely unused.
   *
   * Note the absence of a `sealed` parameter. Sign-in mode carries no account, so
   * there is nothing in it this method could read even if it wanted to.
   */
  private async completeSignIn(
    verified: VerifiedIdentity,
    device: OidcCallbackDevice | undefined,
  ): Promise<OidcCallbackOutcome> {
    const found = await this.deps.identities.findBySubject(verified.provider, verified.subject);

    if (found === null) return refuse('identity-not-linked');

    const actor: SessionActor = {
      userId: found.userId,
      // Conditional spreads, because `exactOptionalPropertyTypes` is on and an absent
      // optional is not an explicit `undefined`. `PrismaSessionRepository` rejects the
      // latter where an absent column is meant.
      ...(device?.ipAddress !== undefined ? { ipAddress: device.ipAddress } : {}),
      ...(device?.userAgent !== undefined ? { userAgent: device.userAgent } : {}),
    };

    const session = await this.deps.sessions.issue({
      actor,
      sessionTtlMs: this.deps.sessionTtlMs,
      refreshTtlMs: this.deps.refreshTtlMs,
    });

    return { outcome: 'signed-in', session };
  }

  /**
   * Link mode: bind this identity to the account the bundle names.
   *
   * **The account comes from `sealed.userId`, which is inside the MAC.** Not from a
   * cookie, not from a parameter, not from anything this method received — and note
   * that `sealed` has been narrowed to the `'link'` arm, so `userId` is not merely
   * `undefined`-checked here, it does not typecheck at all on the sign-in arm.
   *
   * **No session is issued.** The caller authenticated before the flow began and
   * still holds that session; a second one would be an orphan.
   */
  private async completeLink(
    sealed: Extract<OidcStatePayload, { mode: 'link' }> & { readonly issuedAtMs: number },
    verified: VerifiedIdentity,
  ): Promise<OidcCallbackOutcome> {
    const params: LinkExternalIdentityParams = {
      userId: sealed.userId,
      provider: verified.provider,
      subject: verified.subject,
      email: verified.email,
      emailVerified: verified.emailVerified === true ? true : null,
    };

    const result = await this.deps.identities.link(params);

    switch (result.outcome) {
      case 'linked':
        return { outcome: 'linked' };
      case 'already-linked':
        return { outcome: 'already-linked' };
      // The refusal. Re-pointing an identity that belongs to somebody else is silent
      // account takeover, and this is the only place that can be reported as one.
      case 'already-linked-elsewhere':
        return refuse('identity-linked-elsewhere');
    }
  }
}

/**
 * The bundle, in the shape `verifyCallback` asks for.
 *
 * Structurally identical to `IOidcProvider`'s `expected` argument, deliberately, so
 * the values are handed straight back with no translation step where a field could be
 * dropped. Exported for the port's own spec, which asserts the two shapes agree.
 */
const toExpected = (
  sealed: OidcStatePayload & { readonly issuedAtMs: number },
): {
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
  readonly redirectUri: string;
} => ({
  state: sealed.state,
  nonce: sealed.nonce,
  codeVerifier: sealed.codeVerifier,
  redirectUri: sealed.redirectUri,
});
