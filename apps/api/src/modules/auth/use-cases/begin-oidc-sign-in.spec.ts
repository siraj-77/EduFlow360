import { describe, expect, it } from 'vitest';
import { GoogleOidcProvider } from '../infrastructure/adapters/google-oidc-provider.js';
import { HmacOidcStateStore } from '../infrastructure/adapters/oidc-state-store.js';
import type {
  IOidcStateStore,
  OidcStateCookie,
  OidcStatePayload,
  SealedOidcState,
} from '../domain/ports/oidc-state-store.js';
import { FakeClock } from '../../../testing/fake-clock.js';
import { FakeOidcProvider } from '../../../testing/fake-oidc-provider.js';
import { BeginOidcSignIn, UntrustedAuthorizationUrlError } from './begin-oidc-sign-in.js';

/**
 * Beginning an OIDC sign-in.
 *
 * ## Where the real collaborators are used, and why it matters here
 *
 * Two of these tests drive the **real** `GoogleOidcProvider` rather than
 * `FakeOidcProvider`. `beginAuthorization()` is entirely offline — it builds a
 * URL from `randomBytes` — so using the production adapter costs nothing and buys
 * the only claim that actually matters about freshness: that the state which goes
 * into the browser is a real CSPRNG value, and a different one every time.
 * `FakeOidcProvider` returns a fixed `state-fixed`, so it cannot demonstrate that
 * at all, and a test asserting "the use-case calls `beginAuthorization`" would
 * pass with a use-case that then reused the value.
 */

const ORIGIN = 'https://accounts.google.com';
const NOW = '2026-10-02T09:00:00.000Z';
const TTL = 600_000;
const SECRET = 'a-test-signing-key-of-adequate-length-0123456789';

const PAYLOAD: OidcStatePayload = {
  state: 'state-fixed',
  nonce: 'nonce-fixed',
  codeVerifier: 'verifier-fixed',
  redirectUri: 'https://api.school.test/auth/oidc/callback',
};

const realStore = (): HmacOidcStateStore =>
  new HmacOidcStateStore({ clock: new FakeClock(NOW), secret: SECRET, ttlMs: TTL });

const fakeProvider = (
  authorizationUrl = `${ORIGIN}/o/oauth2/v2/auth?client_id=x`,
): FakeOidcProvider => {
  const provider = new FakeOidcProvider();
  provider.authorization = { ...PAYLOAD, authorizationUrl };
  return provider;
};

const realGoogle = (): GoogleOidcProvider =>
  new GoogleOidcProvider({
    clientId: 'test-client-id.apps.googleusercontent.com',
    clientSecret: 'test-client-secret',
    redirectUri: 'http://localhost:3001/auth/oidc/callback',
  });

describe('BeginOidcSignIn', () => {
  it('redirects to the provider URL and seals the bundle in a cookie', async () => {
    const provider = fakeProvider();
    const store = realStore();

    const result = await new BeginOidcSignIn(provider, store, ORIGIN).begin();

    expect(result.redirectTo).toBe(provider.authorization.authorizationUrl);
    // The bundle really travelled: opened with the same key, it is the payload
    // the provider produced, field for field.
    expect(store.open(result.stateCookie.value)).toEqual({
      ...PAYLOAD,
      issuedAtMs: Date.parse(NOW),
    });
  });

  it('takes no arguments at all, so no inbound value can reach it', () => {
    // Structural, and deliberately so. The alternative — accepting a query object
    // and ignoring one field — is a rule a later refactor can quietly break, and
    // an open redirect or a replayed `state` is what it would cost. Zero
    // parameters makes it a compile error instead.
    expect(BeginOidcSignIn.prototype.begin.length).toBe(0);
  });

  it('uses the state the provider generated, and never one it could have been handed', async () => {
    const provider = fakeProvider();
    const store = realStore();

    const result = await new BeginOidcSignIn(provider, store, ORIGIN).begin();

    expect(store.open(result.stateCookie.value)?.state).toBe(provider.authorization.state);
  });

  it('carries the redirect URI the provider was configured with, for the callback to echo back', async () => {
    const store = realStore();

    const result = await new BeginOidcSignIn(fakeProvider(), store, ORIGIN).begin();

    // `IOidcProvider.verifyCallback` takes the redirect URI in `expected`, and a
    // token exchange fails if it does not match the one in the authorization
    // request. Taking it from the sealed bundle rather than from configuration a
    // second time is what keeps the two in step.
    expect(store.open(result.stateCookie.value)?.redirectUri).toBe(PAYLOAD.redirectUri);
  });

  it('begins exactly one authorization per call', async () => {
    const provider = fakeProvider();

    await new BeginOidcSignIn(provider, realStore(), ORIGIN).begin();

    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]).toEqual({ method: 'beginAuthorization' });
  });

  it('does not verify anything — the callback does that, with the same bundle', async () => {
    const provider = fakeProvider();

    await new BeginOidcSignIn(provider, realStore(), ORIGIN).begin();

    // A use-case that called `verifyCallback` here would have nothing to verify.
    expect(provider.calls.some((call) => call.method === 'verifyCallback')).toBe(false);
  });

  describe('against the real Google provider', () => {
    it('mints a different state, nonce and verifier on every request', async () => {
      const useCase = new BeginOidcSignIn(realGoogle(), realStore(), ORIGIN);
      const store = realStore();

      const first = store.open((await useCase.begin()).stateCookie.value);
      const second = store.open((await useCase.begin()).stateCookie.value);

      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      expect(first?.state).not.toBe(second?.state);
      expect(first?.nonce).not.toBe(second?.nonce);
      expect(first?.codeVerifier).not.toBe(second?.codeVerifier);
    });

    it('sends the browser to Google over https, and the state in the URL is the sealed one', async () => {
      const store = realStore();

      const result = await new BeginOidcSignIn(realGoogle(), store, ORIGIN).begin();
      const sent = new URL(result.redirectTo);
      const sealed = store.open(result.stateCookie.value);

      expect(sent.origin).toBe(ORIGIN);
      expect(sent.protocol).toBe('https:');
      expect(sent.searchParams.get('state')).toBe(sealed?.state);
      // PKCE: the verifier is in the sealed bundle and nowhere else.
      expect(sent.searchParams.get('code_verifier')).toBeNull();
      expect(sent.searchParams.get('code_challenge_method')).toBe('S256');
    });
  });

  describe('refuses a redirect target it does not trust', () => {
    it.each([
      { case: 'another host entirely', url: 'https://evil.test/steal' },
      { case: 'a subdomain of the trusted host', url: `${ORIGIN}.evil.test/o/oauth2/v2/auth` },
      {
        case: 'plain http on the trusted host',
        url: 'http://accounts.google.com/o/oauth2/v2/auth',
      },
      { case: 'a javascript: URL', url: 'javascript:alert(document.cookie)' },
      { case: 'a string that is not a URL', url: 'accounts.google.com/o/oauth2/v2/auth' },
    ])('$case, rather than redirecting to it', async ({ url }) => {
      const useCase = new BeginOidcSignIn(fakeProvider(url), realStore(), ORIGIN);

      await expect(useCase.begin()).rejects.toThrow(UntrustedAuthorizationUrlError);
    });

    it('names the check that failed, and does not echo the URL back', async () => {
      // The URL carries `state`, `nonce`, `code_challenge` and `redirect_uri`.
      // AGENTS.md 2.13 is about not writing those into a log line that happens to
      // be an exception message.
      const useCase = new BeginOidcSignIn(
        fakeProvider('https://evil.test/?state=secret-state'),
        realStore(),
        ORIGIN,
      );

      await expect(useCase.begin()).rejects.toThrow(/authorization URL/);
      await expect(useCase.begin()).rejects.not.toThrow(/secret-state/);
    });

    it('never asks the store to seal anything, so no cookie is issued for a refused redirect', async () => {
      // A recording double for the port, in the shape `FakeOidcProvider` already
      // uses: the claim here is about *collaboration* — that `seal` is not called
      // — and a real signing store cannot report that.
      const store = new RecordingStateStore();
      const useCase = new BeginOidcSignIn(fakeProvider('https://evil.test/steal'), store, ORIGIN);

      await expect(useCase.begin()).rejects.toThrow(UntrustedAuthorizationUrlError);

      // Ordering, not decoration: a signed bundle for a redirect that never
      // happened is a credential sitting in a browser with no flow to complete.
      expect(store.sealCalls).toBe(0);
    });
  });
});

/** Counts `seal` calls; delegates nothing else, because nothing else is reached. */
class RecordingStateStore implements IOidcStateStore {
  sealCalls = 0;

  seal(_payload: OidcStatePayload): OidcStateCookie {
    this.sealCalls += 1;
    throw new Error('seal must not be called for an untrusted authorization URL');
  }

  open(_raw: string | undefined): SealedOidcState | null {
    return null;
  }

  expired(): OidcStateCookie {
    throw new Error('not reached');
  }
}
