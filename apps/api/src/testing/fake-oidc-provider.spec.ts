import { describe, expect, it } from 'vitest';
import { type IClock } from '../modules/auth/domain/ports/clock.js';
import { type IOidcProvider } from '../modules/auth/domain/ports/oidc-provider.js';
import { FakeClock } from './fake-clock.js';
import { FakeOidcProvider } from './fake-oidc-provider.js';

const GOOD_QUERY = {
  code: 'auth-code',
  state: 'state-fixed',
  error: null,
  errorDescription: null,
};

const GOOD_EXPECTED = {
  state: 'state-fixed',
  nonce: 'nonce-fixed',
  codeVerifier: 'verifier-fixed',
  redirectUri: 'https://app.test/auth/oidc/callback',
};

/**
 * A port has no behaviour, so what is testable is that a fake can satisfy it
 * and that the defaults fail safe. The defaults matter more than they look:
 * `sub-unclaimed` is a subject no real identity matches, so a use-case that
 * forgets to wire `state` or `nonce` produces a test failure rather than a
 * pass.
 */
describe('IOidcProvider, through its fake', () => {
  it('is satisfied by the fake', () => {
    const provider: IOidcProvider = new FakeOidcProvider();
    expect(provider.key).toBe('fake');
  });

  it('exposes a stable provider key, because that string is what is stored', () => {
    // `ExternalIdentity.provider` holds this. Derived from a class name or an
    // enum, changing a provider would become a migration and a data rewrite.
    expect(new FakeOidcProvider('google').key).toBe('google');
  });

  it('cannot produce an authorization request without state, nonce and PKCE', async () => {
    // A type-level guarantee: the return type has all three, so a caller
    // cannot start a flow without producing them. Asserted so that widening
    // the interface has to notice.
    const request = await new FakeOidcProvider().beginAuthorization();

    expect(request.state).toBeTruthy();
    expect(request.nonce).toBeTruthy();
    expect(request.codeVerifier).toBeTruthy();
    expect(request.authorizationUrl).toMatch(/^https:\/\//);
    expect(request.redirectUri).toMatch(/^https:\/\//);
  });

  it('never sends the PKCE verifier to the browser-facing URL', async () => {
    // The verifier is the thing PKCE protects. If it appeared in the URL the
    // browser is sent to, the browser would know it and PKCE would stop
    // protecting anything.
    const request = await new FakeOidcProvider().beginAuthorization();
    expect(request.authorizationUrl).not.toContain(request.codeVerifier);
  });

  it('defaults to an identity no real provider would claim', async () => {
    const identity = await new FakeOidcProvider().verifyCallback(GOOD_QUERY, GOOD_EXPECTED);
    expect(identity.subject).toBe('sub-unclaimed');
  });

  it('records the security parameters it was handed, so a use-case can be held to them', async () => {
    const provider = new FakeOidcProvider();
    await provider.verifyCallback(GOOD_QUERY, GOOD_EXPECTED);

    expect(provider.lastVerify?.expected.state).toBe('state-fixed');
    expect(provider.lastVerify?.expected.nonce).toBe('nonce-fixed');
    expect(provider.lastVerify?.expected.codeVerifier).toBe('verifier-fixed');
  });

  it('passes the callback query through verbatim, error included', async () => {
    // A use-case must be able to see `error` without a second provider call.
    const provider = new FakeOidcProvider();
    const failed = { code: null, state: 's', error: 'access_denied', errorDescription: 'no' };
    await provider.verifyCallback(failed, GOOD_EXPECTED);

    expect(provider.lastVerify?.query.error).toBe('access_denied');
    expect(provider.lastVerify?.query.code).toBeNull();
  });

  it('can be made to reject, so error paths are reachable', async () => {
    const provider = new FakeOidcProvider();
    provider.rejectEveryCallback = new Error('provider refused');
    await expect(provider.verifyCallback(GOOD_QUERY, GOOD_EXPECTED)).rejects.toThrow(
      'provider refused',
    );
  });

  it('defaults emailVerified to null rather than false', async () => {
    // "unknown" and "unverified" are different claims, and collapsing them
    // loses the distinction between a Workspace tenant that asserts
    // verification and one that says nothing.
    const identity = await new FakeOidcProvider().verifyCallback(GOOD_QUERY, GOOD_EXPECTED);
    expect(identity.emailVerified).toBeNull();
  });
});

/**
 * The two ports a use-case needs together. `AGENTS.md` 2.4 applies: nothing
 * in the application layer may read the ambient clock.
 */
describe('IClock and IOidcProvider together', () => {
  it('lets a use-case reason about expiry without ambient time', () => {
    const clock: IClock = new FakeClock('2026-10-02T09:00:00.000Z');
    const expiresAt = new Date(clock.now().getTime() + 7 * 24 * 3600 * 1000);

    clock.advance(8 * 24 * 3600 * 1000);

    expect(clock.now() > expiresAt).toBe(true);
  });
});
