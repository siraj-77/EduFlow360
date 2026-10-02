import { createHash } from 'node:crypto';
import { SignJWT, generateKeyPair } from 'jose';
import { describe, expect, it } from 'vitest';
import { GoogleOidcProvider, OidcVerificationError } from './google-oidc-provider.js';

/**
 * Every test runs against a locally generated RSA key and a stubbed token
 * endpoint. Nothing touches Google and nothing touches the network, so the
 * suite is deterministic, needs no credentials, and still exercises **real**
 * signature verification rather than a mock of it.
 *
 * The forged-token cases are the point. A suite that only asserts the happy
 * path would pass against an adapter that verified nothing at all, so each of
 * the five checks gets a test that forges exactly the thing it defends
 * against.
 */

const CLIENT_ID = '123.apps.googleusercontent.com';
const CLIENT_SECRET = 'secret-value';
const REDIRECT = 'http://localhost:3001/auth/oidc/callback';
const ISSUER = 'https://accounts.google.com';

interface Harness {
  readonly provider: GoogleOidcProvider;
  readonly privateKey: CryptoKey;
  readonly foreignKey: CryptoKey;
  readonly seen: { url?: string; body?: URLSearchParams; headers?: Record<string, string> };
  readonly issued: { state: string; nonce: string; codeVerifier: string };
}

interface Options {
  /** Merged over the default good claims. `undefined` deletes a claim. */
  readonly claims?: Record<string, unknown>;
  /** Replace the whole signed token, e.g. one signed by a foreign key. */
  readonly token?: string;
  readonly postFormThrows?: boolean;
  readonly tokenResponse?: unknown;
  /** Sign with a key the adapter was not given, while keeping the nonce right. */
  readonly signWithForeignKey?: boolean;
}

async function harness(options: Options = {}): Promise<Harness> {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const foreign = await generateKeyPair('RS256');
  const seen: Harness['seen'] = {};

  // The stubbed token endpoint must sign with the nonce belonging to the flow
  // under test, so it is filled in once that flow has been started. Calling
  // beginAuthorization() again inside the stub would mint a second nonce and
  // every case would fail on a nonce mismatch instead of on the thing it is
  // actually testing.
  let flowNonce = '';

  const provider = new GoogleOidcProvider(
    { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, redirectUri: REDIRECT },
    {
      // A local public key. jose accepts one directly, so there is no JWKS
      // endpoint to stand up.
      jwks: publicKey,
      postForm: async (url, body, headers) => {
        seen.url = url;
        seen.body = body;
        seen.headers = headers;
        if (options.postFormThrows) throw new Error('network down');

        const now = Math.floor(Date.now() / 1000);

        const claims: Record<string, unknown> = {
          iss: ISSUER,
          aud: CLIENT_ID,
          sub: 'google-subject-123',
          email: 'teacher@example.test',
          email_verified: true,
          exp: now + 3600,
          iat: now,
          nonce: flowNonce,
          ...options.claims,
        };

        const token =
          options.token ??
          // `exp` and `iat` go in the claims rather than through
          // setExpirationTime, because those setters OVERWRITE whatever is
          // already there - so an overridden exp would be silently replaced
          // and the expiry case would pass without ever testing expiry.
          (await new SignJWT(claims)
            .setProtectedHeader({ alg: 'RS256' })
            .sign(options.signWithForeignKey ? foreign.privateKey : privateKey));

        return (
          options.tokenResponse ?? { id_token: token, access_token: 'at', token_type: 'Bearer' }
        );
      },
    },
  );

  const auth = await provider.beginAuthorization();
  flowNonce = auth.nonce;

  return {
    provider,
    privateKey,
    foreignKey: foreign.privateKey,
    seen,
    issued: { state: auth.state, nonce: auth.nonce, codeVerifier: auth.codeVerifier },
  };
}

const query = (state: string) => ({
  code: 'auth-code',
  state,
  error: null as string | null,
  errorDescription: null as string | null,
});

const expectedFor = (h: Harness) => ({
  state: h.issued.state,
  nonce: h.issued.nonce,
  codeVerifier: h.issued.codeVerifier,
  redirectUri: REDIRECT,
});

describe('GoogleOidcProvider — a genuine token', () => {
  it('returns the provider subject, which is the only account key', async () => {
    const h = await harness();
    const identity = await h.provider.verifyCallback(query(h.issued.state), expectedFor(h));

    expect(identity.subject).toBe('google-subject-123');
    expect(identity.provider).toBe('google');
  });

  it('reads email as a display snapshot, never as identity', async () => {
    const h = await harness();
    const identity = await h.provider.verifyCallback(query(h.issued.state), expectedFor(h));

    expect(identity.email).toBe('teacher@example.test');
    expect(identity.subject).not.toBe(identity.email);
  });

  it('preserves a null emailVerified rather than defaulting it to false', async () => {
    // "unknown" and "unverified" are different claims. A Workspace tenant
    // that says nothing must not be recorded as having said no.
    const h = await harness({ claims: { email_verified: undefined } });
    const identity = await h.provider.verifyCallback(query(h.issued.state), expectedFor(h));
    expect(identity.emailVerified).toBeNull();
  });

  it('accepts a token with no email at all', async () => {
    const h = await harness({ claims: { email: undefined } });
    const identity = await h.provider.verifyCallback(query(h.issued.state), expectedFor(h));
    expect(identity.subject).toBe('google-subject-123');
    expect(identity.email).toBeNull();
  });
});

describe('GoogleOidcProvider — PKCE, proved both ways', () => {
  it('sends only the S256 challenge in the browser-facing URL', async () => {
    const h = await harness();
    const auth = await h.provider.beginAuthorization();

    expect(auth.authorizationUrl).toContain('code_challenge_method=S256');
    expect(auth.authorizationUrl).toContain(
      'code_challenge=' + createHash('sha256').update(auth.codeVerifier).digest('base64url'),
    );
    // The verifier itself must never appear where the browser can read it, or
    // PKCE protects nothing.
    expect(auth.authorizationUrl).not.toContain(auth.codeVerifier);
  });

  it('sends the verifier in the token exchange', async () => {
    const h = await harness();
    await h.provider.verifyCallback(query(h.issued.state), expectedFor(h));
    expect(h.seen.body?.get('code_verifier')).toBe(h.issued.codeVerifier);
  });

  it('mints a distinct state, nonce and verifier per authorization', async () => {
    const h = await harness();
    const a = await h.provider.beginAuthorization();
    const b = await h.provider.beginAuthorization();

    expect(a.state).not.toBe(b.state);
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.codeVerifier).not.toBe(b.codeVerifier);
  });
});

describe('GoogleOidcProvider — each of the five checks, forged', () => {
  it('1. rejects a callback whose state does not match (login CSRF)', async () => {
    const h = await harness();
    await expect(h.provider.verifyCallback(query('attacker'), expectedFor(h))).rejects.toThrow(
      /state did not match/i,
    );
    // And it never reached the token endpoint.
    expect(h.seen.url).toBeUndefined();
  });

  it('2. rejects a token signed by a key it does not trust', async () => {
    // Claims are otherwise perfect - right issuer, right audience, right
    // nonce, not expired - so the ONLY thing wrong is the signature. That is
    // what makes it a test of the signature check specifically.
    const h = await harness({ signWithForeignKey: true });
    await expect(h.provider.verifyCallback(query(h.issued.state), expectedFor(h))).rejects.toThrow(
      /rejected/i,
    );
  });

  it('3. rejects a token whose issuer is not Google', async () => {
    const h = await harness({ claims: { iss: 'https://evil.test' } });
    await expect(h.provider.verifyCallback(query(h.issued.state), expectedFor(h))).rejects.toThrow(
      /rejected/i,
    );
  });

  it('4. rejects a token minted for a different client', async () => {
    const h = await harness({ claims: { aud: 'another.apps.googleusercontent.com' } });
    await expect(h.provider.verifyCallback(query(h.issued.state), expectedFor(h))).rejects.toThrow(
      /rejected/i,
    );
  });

  it('5. rejects a token whose nonce is not the one this server issued', async () => {
    const h = await harness({ claims: { nonce: 'someone-elses-nonce' } });
    await expect(h.provider.verifyCallback(query(h.issued.state), expectedFor(h))).rejects.toThrow(
      /nonce/i,
    );
  });

  it('rejects an expired token', async () => {
    const h = await harness({ claims: { exp: Math.floor(Date.now() / 1000) - 60 } });
    await expect(h.provider.verifyCallback(query(h.issued.state), expectedFor(h))).rejects.toThrow(
      /rejected/i,
    );
  });

  it('rejects a token whose authorized party is another client', async () => {
    const h = await harness({ claims: { azp: 'another.apps.googleusercontent.com' } });
    await expect(h.provider.verifyCallback(query(h.issued.state), expectedFor(h))).rejects.toThrow(
      /authorized party/i,
    );
  });

  it('rejects a token with no subject', async () => {
    const h = await harness({ claims: { sub: undefined } });
    await expect(h.provider.verifyCallback(query(h.issued.state), expectedFor(h))).rejects.toThrow(
      /no subject/i,
    );
  });
});

describe('GoogleOidcProvider — failure paths are typed and specific', () => {
  it('surfaces a provider refusal rather than reading it as success', async () => {
    const h = await harness();
    await expect(
      h.provider.verifyCallback(
        {
          code: null,
          state: h.issued.state,
          error: 'access_denied',
          errorDescription: 'user declined',
        },
        expectedFor(h),
      ),
    ).rejects.toThrow(/refused.*access_denied/i);
  });

  it('rejects a callback carrying no authorization code', async () => {
    const h = await harness();
    await expect(
      h.provider.verifyCallback(
        { code: null, state: h.issued.state, error: null, errorDescription: null },
        expectedFor(h),
      ),
    ).rejects.toThrow(/no authorization code/i);
  });

  it('rejects when the token exchange itself fails', async () => {
    const h = await harness({ postFormThrows: true });
    await expect(h.provider.verifyCallback(query(h.issued.state), expectedFor(h))).rejects.toThrow(
      /token exchange failed/i,
    );
  });

  it('rejects a token response with no ID token in it', async () => {
    const h = await harness({ tokenResponse: { access_token: 'at' } });
    await expect(h.provider.verifyCallback(query(h.issued.state), expectedFor(h))).rejects.toThrow(
      /no ID token/i,
    );
  });

  it('gives a typed reason, not a bare Error, so a caller can branch', async () => {
    const h = await harness();
    try {
      await h.provider.verifyCallback(query('wrong'), expectedFor(h));
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(OidcVerificationError);
      expect((e as OidcVerificationError).reason).toBe('state-mismatch');
    }
  });
});
