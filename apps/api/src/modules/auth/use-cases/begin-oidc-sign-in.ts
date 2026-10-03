import type { IOidcProvider } from '../domain/ports/oidc-provider.js';
import type { IOidcStateStore, OidcStateCookie } from '../domain/ports/oidc-state-store.js';
import { isTrustedAuthorizationUrl } from '../domain/services/oidc-authorization-target.js';

/**
 * Beginning an OIDC sign-in.
 *
 * ## Why this exists rather than being three lines in the controller
 *
 * Three things happen here and none of them belong in a controller:
 *
 * 1. **Ask the provider for a fresh authorization request.** Its four values come
 *    back together because the port insists on it, and they are used together.
 * 2. **Decide whether this server will actually send a browser to that URL.**
 * 3. **Seal the bundle** so the callback can prove the flow belongs to us.
 *
 * `AGENTS.md` 2 puts orchestration in `use-cases/` and rules in `domain/`, and
 * this is the first route where both halves are needed: the rule lives in
 * `oidc-authorization-target.ts`, the orchestration is here, and the controller
 * is left holding a URL and a cookie it did not build.
 *
 * ## Why the redirect target is checked here and not in the controller
 *
 * Because the controller is the wrong place to ask. A check the controller owns is
 * a check that has to be repeated in the next controller, and the next one will
 * not remember. Here it is a constructor argument, so a caller that forgot to
 * supply the policy cannot construct this class at all.
 *
 * ## Why nothing is read from the request
 *
 * `begin()` takes no arguments. That is the whole defence against
 * `?state=`, `?return_to=` and `?redirect_uri=` on this route, and it is
 * deliberate that there is no parameter to read them from. `AGENTS.md` 2.13 and
 * the port's own note agree: a redirect route that accepts an inbound `state` is
 * an open redirect and a login-CSRF primitive, and the cheapest way to make that
 * impossible is for the code to be unable to express it.
 */

/**
 * A provider URL this server will not redirect to.
 *
 * Thrown rather than returned as a verdict, because this is never a normal
 * outcome — the provider builds its URL from its own configuration, so reaching
 * here means a misconfiguration or a broken adapter, and both are things an
 * operator must see as a failure rather than as a redirect to somewhere
 * unhelpful.
 *
 * The URL is deliberately **not** in the message. It carries `state`, `nonce`,
 * `code_challenge` and `redirect_uri`; `AGENTS.md` 2.13 is about not writing those
 * into a log line that happens to be an exception message, and a message is a log
 * line. The operator's next step is to check the configured authorization endpoint,
 * which the boot banner and `.env` both name.
 */
export class UntrustedAuthorizationUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UntrustedAuthorizationUrlError';
  }
}

/**
 * A link flow was asked for without naming the account it may attach to.
 *
 * Its own class rather than reusing `UntrustedAuthorizationUrlError`, because the two
 * failures have nothing in common operationally: one means "check the provider
 * configuration", this one means "check the controller that called `beginLink`".
 * Collapsing them would leave an operator debugging the wrong file.
 */
export class UnlinkableAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnlinkableAccountError';
  }
}

/**
 * The half of a payload this server decides; the provider supplies the other half.
 *
 * Declared as its own union rather than `Pick<OidcStatePayload, …>` because `Pick`
 * over a union does not distribute the way this needs: it collapses to the keys
 * common to both arms and silently drops `userId`, which is exactly the field this
 * type exists to keep.
 */
export type OidcFlowIntent =
  { readonly mode: 'sign-in' } | { readonly mode: 'link'; readonly userId: string };

export interface BeginOidcSignInResult {
  /** Where to send the browser. Already checked against the allowed origin. */
  readonly redirectTo: string;
  /** The signed bundle, for the callback. Not yet written to a response. */
  readonly stateCookie: OidcStateCookie;
}

export class BeginOidcSignIn {
  constructor(
    private readonly provider: IOidcProvider,
    private readonly stateStore: IOidcStateStore,
    /**
     * The one origin this deployment will send a browser to, as an origin string.
     *
     * A single origin and not a list of providers. See
     * `oidc-authorization-target.ts` for why, and for the honest statement that
     * this value is derived from the same configuration the provider builds its
     * URL from — defence in depth today, load-bearing the day a second provider
     * exists or an adapter is replaced.
     */
    private readonly allowedAuthorizationOrigin: string,
  ) {}

  /**
   * Start a SIGN-IN flow.
   *
   * Takes no arguments, and that is deliberate — see the header. The sealed bundle
   * carries `mode: 'sign-in'` and therefore **no account at all**, which is what
   * makes the callback unable to link on this path even if a session cookie is
   * sitting in the browser.
   */
  async begin(): Promise<BeginOidcSignInResult> {
    return this.beginFlow({ mode: 'sign-in' });
  }

  /**
   * Start a LINK flow, bound to one already-authenticated account.
   *
   * ## Why this is a second named method and not a parameter on `begin()`
   *
   * A `begin(mode, userId)` signature is the obvious refactor and it is worse in
   * three ways that each cost something real:
   *
   * 1. `begin()` has a test asserting it takes **zero** parameters
   *    (`begin-oidc-sign-in.spec.ts`). That arity is not cosmetic: it is what makes
   *    it a compile error to add `?state=` or `?mode=` handling here. Widening it
   *    to take a mode undoes a control that already exists and is already tested.
   * 2. Two names cannot be confused at a call site. `begin()` and `beginLink(userId)`
   *    read differently at a glance; `begin(true)` does not, and a route reaching
   *    for the wrong one is a link-CSRF.
   * 3. Only `beginLink` takes an account, so "sign-in mode carries an account" is
   *    not merely discouraged — it is unrepresentable.
   *
   * ## Why the account is an argument rather than read from the session
   *
   * The caller is `GET /auth/oidc/link`, which `SessionGuard` has already
   * authenticated. It passes the principal it read. The use-case does not receive a
   * request, cannot read a cookie, and has no other source for a user id — so the
   * account cannot come from anywhere except the authenticated route. That is the
   * whole of the defence against "session cookie present, therefore link".
   */
  async beginLink(userId: string): Promise<BeginOidcSignInResult> {
    if (typeof userId !== 'string' || userId.trim().length === 0) {
      throw new UnlinkableAccountError(
        'Refusing to begin a link flow with no account. A link bundle names the account it may ' +
          'attach an identity to; one without an account is the shape a forged bundle takes to ' +
          'make the callback fall back to whoever is signed in, so this is refused here rather ' +
          'than sealed and refused later. Only GET /auth/oidc/link, behind SessionGuard, may ' +
          'begin a link.',
      );
    }

    return this.beginFlow({ mode: 'link', userId });
  }

  /**
   * The one body both flows share: ask the provider, refuse an untrusted
   * destination, then seal the bundle it produced.
   *
   * The provider's four values are spread LAST, so a field can only ever be
   * overwritten by the provider and never by `intent` — and `intent` carries only
   * `mode` and, for a link, `userId`.
   */
  private async beginFlow(intent: OidcFlowIntent): Promise<BeginOidcSignInResult> {
    const authorization = await this.provider.beginAuthorization();

    /**
     * Checked before anything is sealed. A signed bundle for a redirect that never
     * happens is a credential sitting in a browser with no flow to complete, and
     * there is no reason to mint one.
     */
    if (
      !isTrustedAuthorizationUrl(authorization.authorizationUrl, this.allowedAuthorizationOrigin)
    ) {
      throw new UntrustedAuthorizationUrlError(
        'Refusing to redirect: the identity provider returned an authorization URL that is ' +
          'not https on the one origin this deployment is configured to use. Nothing was sent ' +
          'to the browser and no state cookie was issued. Check the provider configuration ' +
          '(GOOGLE_CLIENT_ID and the authorization endpoint it implies) rather than the URL ' +
          'itself, which is deliberately not repeated here.',
      );
    }

    return {
      redirectTo: authorization.authorizationUrl,
      stateCookie: this.stateStore.seal({
        ...intent,
        state: authorization.state,
        nonce: authorization.nonce,
        codeVerifier: authorization.codeVerifier,
        redirectUri: authorization.redirectUri,
      }),
    };
  }
}
