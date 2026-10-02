import {
  type IOidcProvider,
  type OidcAuthorizationRequest,
  type OidcCallbackQuery,
  type OidcIdentity,
} from '../modules/auth/domain/ports/oidc-provider.js';

/**
 * A fake provider for use-case tests.
 *
 * It records what it was asked, so a use-case test can assert the security
 * parameters actually travelled rather than asserting only the outcome. The
 * outcome alone would pass even if `state` were never checked, because a
 * correct identity can be produced by an implementation that never looked at
 * it.
 *
 * Defaults are the *safe* failure: `sub-unclaimed` is a subject no real
 * identity would match, and `rejectEveryCallback` is how error paths get
 * reached. A use-case that forgets to wire the security parameters therefore
 * fails loudly instead of passing quietly.
 *
 * No `vitest` import on purpose. This is test-support code that production
 * and specs both may load, and a module that pulls in the runner cannot be
 * imported outside a test without dragging it along. The tests for it live in
 * `fake-oidc-provider.spec.ts`.
 */
export class FakeOidcProvider implements IOidcProvider {
  readonly calls: Array<
    | { readonly method: 'beginAuthorization' }
    | {
        readonly method: 'verifyCallback';
        readonly query: OidcCallbackQuery;
        readonly expected: {
          readonly state: string;
          readonly nonce: string;
          readonly codeVerifier: string;
          readonly redirectUri: string;
        };
      }
  > = [];

  /** What `verifyCallback` resolves to. */
  identity: OidcIdentity = {
    subject: 'sub-unclaimed',
    email: 'nobody@example.test',
    emailVerified: null,
    provider: 'fake',
  };

  /** When set, `verifyCallback` rejects with it. */
  rejectEveryCallback: Error | null = null;

  /** Overrides for the authorization request, so a test can pin values. */
  authorization: OidcAuthorizationRequest = {
    authorizationUrl: 'https://provider.test/authorize?x=1',
    state: 'state-fixed',
    nonce: 'nonce-fixed',
    codeVerifier: 'verifier-fixed',
    redirectUri: 'https://app.test/auth/oidc/callback',
  };

  constructor(readonly key: string = 'fake') {}

  async beginAuthorization(): Promise<OidcAuthorizationRequest> {
    this.calls.push({ method: 'beginAuthorization' });
    return this.authorization;
  }

  async verifyCallback(
    query: OidcCallbackQuery,
    expected: {
      readonly state: string;
      readonly nonce: string;
      readonly codeVerifier: string;
      readonly redirectUri: string;
    },
  ): Promise<OidcIdentity> {
    this.calls.push({ method: 'verifyCallback', query, expected });
    if (this.rejectEveryCallback) throw this.rejectEveryCallback;
    return this.identity;
  }

  /** The most recent `verifyCallback` call, for assertions. */
  get lastVerify() {
    return [...this.calls].reverse().find((c) => c.method === 'verifyCallback');
  }
}
