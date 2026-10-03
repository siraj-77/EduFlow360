import { describe, expect, it } from 'vitest';
import { OIDC_STATE_COOKIE_NAME } from '../../domain/ports/oidc-state-store.js';
import { FakeClock } from '../../../../testing/fake-clock.js';
import { instant, instantAfter } from '../../../../testing/instant.js';
import { HmacOidcStateStore, InvalidOidcStateStoreError } from './oidc-state-store.js';

/**
 * The signed-cookie state store.
 *
 * These tests use **real HMAC** — no stubbed `crypto` — because the property
 * under test *is* the signature. A test that mocked the signer would assert that
 * a function was called, which is a different claim from "a forged cookie does
 * not open".
 *
 * Every rejection case is written as a *forgery*, not as a malformed string,
 * because a malformed string is a self-inflicted wound and a forgery is the
 * attack. Both land in the same bucket; the point is that the attack lands there
 * too.
 */

/** 43 base64url characters, which is what a real S256 PKCE verifier looks like. */
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

/**
 * The four values the PROVIDER produced, and nothing of ours.
 *
 * Split out from the payload because the payload now carries something of ours —
 * the flow mode — and mixing the two in one fixture makes it impossible to see
 * which half a change touched.
 */
const FLOW = {
  state: 'hT4pQ0nQx1sR2vJ8wZ6yB3',
  nonce: 'K9mL2pQ7xR4tV6nJ0wZ8yB3',
  codeVerifier: VERIFIER,
  redirectUri: 'https://api.school.test/auth/oidc/callback',
} as const;

/** What `GET /auth/oidc/redirect` seals: sign-in, and no account. */
const PAYLOAD = { mode: 'sign-in', ...FLOW } as const;

/** What `GET /auth/oidc/link` seals: link mode, bound to ONE account. */
const LINK_USER_ID = '6f1b0c1a-2f3b-4c5d-8e9f-0a1b2c3d4e5f';
const LINK_PAYLOAD = { mode: 'link', userId: LINK_USER_ID, ...FLOW } as const;

const TTL = 600_000;
const NOW = '2026-10-02T09:00:00.000Z';
const SECRET = 'a-test-signing-key-of-adequate-length-0123456789';

interface Overrides {
  readonly ttlMs?: number;
  readonly secret?: string;
  readonly clock?: FakeClock;
}

const makeStore = (overrides: Overrides = {}): HmacOidcStateStore =>
  new HmacOidcStateStore({
    clock: overrides.clock ?? new FakeClock(NOW),
    secret: overrides.secret ?? SECRET,
    ttlMs: overrides.ttlMs ?? TTL,
  });

/** Flip one character of a segment, keeping the length identical. */
const tamper = (segment: string, at = 0): string =>
  segment.slice(0, at) + (segment[at] === 'A' ? 'B' : 'A') + segment.slice(at + 1);

/** The two segments of a sealed value, split. */
const segments = (value: string): [string, string] => {
  const [payload, signature] = value.split('.');
  return [payload, signature];
};

/**
 * Rewrite the `"m"` field of a sealed payload segment, keeping the signature.
 *
 * This is the forgery, expressed as a helper: it edits the bytes an attacker can
 * edit and leaves the MAC alone. It knows nothing about the store's key or its
 * MAC construction — only that the mode is stored as a JSON field, which it reads
 * back out of the value the store itself produced.
 */
const retag = (payloadSegment: string, modeFragment: string): string => {
  const wire = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8')) as {
    m: string;
  };

  return Buffer.from(JSON.stringify({ ...wire, m: modeFragment }), 'utf8').toString('base64url');
};

/**
 * Point a link bundle at a different account, keeping the signature.
 *
 * The payload segment is base64url, so the uuid is not findable in it by a string
 * replacement — the JSON has to be decoded, edited and re-encoded. That is exactly
 * what an attacker with a JSON-aware tool would do, and it is why this forgery is
 * a *semantic* one rather than the byte-flip the generic tamper case already covers.
 */
const rewriteAccount = (payloadSegment: string, userId: string): string => {
  const wire = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8')) as {
    u: string;
  };

  return Buffer.from(JSON.stringify({ ...wire, u: userId }), 'utf8').toString('base64url');
};

describe('HmacOidcStateStore — sealing', () => {
  it('names the cookie for the OIDC flow, and not the session cookie', () => {
    const cookie = makeStore().seal(PAYLOAD);

    expect(cookie.name).toBe(OIDC_STATE_COOKIE_NAME);
    expect(cookie.name).not.toBe('eduflow_session');
  });

  it('writes a cookie a script cannot read, over TLS only, sent on the callback navigation', () => {
    const { attributes } = makeStore().seal(PAYLOAD);

    expect(attributes.httpOnly).toBe(true);
    expect(attributes.secure).toBe(true);
    // `Strict` would withhold the cookie from the top-level navigation arriving
    // from accounts.google.com, so every sign-in would render signed-out.
    expect(attributes.sameSite).toBe('lax');
    expect(attributes.path).toBe('/auth/oidc');
  });

  it('expires it at now plus the configured window, read from the injected clock', () => {
    const clock = new FakeClock(NOW);

    expect(makeStore({ clock }).seal(PAYLOAD).attributes.expiresAt).toEqual(
      instantAfter(TTL, clock.now()),
    );
  });

  it('does not put the verifier, the nonce or the state into the cookie value in the clear', () => {
    const { value } = makeStore().seal(PAYLOAD);

    // `httpOnly` keeps a script out of the cookie, but the value still travels in
    // a request header, is captured by access logs and proxies, and is readable
    // by anyone who can read those. A plaintext encoding of the bundle would put
    // the PKCE verifier in a log file, which is where it must never be.
    expect(value).not.toContain(PAYLOAD.codeVerifier);
    expect(value).not.toContain(PAYLOAD.state);
    expect(value).not.toContain(PAYLOAD.nonce);
  });

  it('produces a value that is safe to put in a Set-Cookie header unencoded', () => {
    // No `;`, `,` or space: those separate cookie attributes and header values.
    expect(makeStore().seal(PAYLOAD).value).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it('is deterministic, because the signature is over content and not over fresh entropy', () => {
    // Stated rather than left implicit. The store's job is integrity, not
    // unpredictability: the unpredictable parts are the provider's `state`,
    // `nonce` and verifier, and those are what make a stolen cookie useless
    // without a matching authorization code.
    expect(makeStore().seal(PAYLOAD).value).toBe(makeStore().seal(PAYLOAD).value);
  });

  it('seals a different value for a different payload', () => {
    const a = makeStore().seal(PAYLOAD).value;
    const b = makeStore().seal({ ...PAYLOAD, state: 'somethingElseEntirely0000' }).value;

    expect(a).not.toBe(b);
  });
});

describe('HmacOidcStateStore — opening', () => {
  it('round-trips every field the callback needs', () => {
    const store = makeStore();

    expect(store.open(store.seal(PAYLOAD).value)).toEqual({
      ...PAYLOAD,
      issuedAtMs: Date.parse(NOW),
    });
  });

  it('carries the flow mode, so the callback cannot be told which flow it is completing', () => {
    // THE control. `mode` is inside the MAC, so it cannot arrive on the query
    // string: a caller who appends `?mode=link` to the callback changes nothing,
    // because the mode the callback reads is the one this server sealed.
    const store = makeStore();

    expect(store.open(store.seal(PAYLOAD).value)?.mode).toBe('sign-in');
    expect(store.open(store.seal(LINK_PAYLOAD).value)?.mode).toBe('link');
  });

  it('carries the account a link flow is bound to, so the callback need not trust the session', () => {
    // Without this the callback would have exactly one candidate account to link
    // to — whoever is signed in when it runs — which is the account-takeover
    // shape. The account is proved by `GET /auth/oidc/link` and travels inside
    // the MAC from there.
    const store = makeStore();

    expect(store.open(store.seal(LINK_PAYLOAD).value)?.userId).toBe(LINK_USER_ID);
  });

  it('gives a sign-in flow no account at all, so there is nothing for it to link', () => {
    const opened = makeStore().open(makeStore().seal(PAYLOAD).value);

    // The property is structural and it is asserted as absence: `userId` is not
    // merely `undefined`, it is not a member of the sign-in arm of the union.
    expect(opened).not.toBeNull();
    expect(opened?.mode === 'link').toBe(false);
    expect('userId' in (opened ?? {})).toBe(false);
  });

  it('refuses a bundle whose bytes were edited to turn sign-in into link', () => {
    // The forgery an attacker can actually perform: no key, so edit the payload
    // segment and keep the old signature. If the mode lived outside the MAC — in a
    // second cookie, or read off the query string — this edit would succeed.
    const store = makeStore();
    const [payload, signature] = segments(store.seal(PAYLOAD).value);

    expect(store.open(`${retag(payload, '"link"')}.${signature}`)).toBeNull();
    expect(store.open(`${retag(payload, '"link","u":"anyone"')}.${signature}`)).toBeNull();
  });

  it('refuses a link bundle whose account was pointed at somebody else', () => {
    // The other direction of the same forgery: keep `mode: "link"` and change the
    // uuid. This is the exact edit that turns "link to my account" into "link to
    // the victim's account", so it is asserted on its own rather than relying on
    // the generic tamper case above.
    const store = makeStore();
    const [payload, signature] = segments(store.seal(LINK_PAYLOAD).value);
    const attacker = '00000000-0000-4000-8000-000000000001';

    expect(store.open(`${rewriteAccount(payload, attacker)}.${signature}`)).toBeNull();
  });

  it('stamps the issue time from the injected clock rather than ambient time', () => {
    const clock = new FakeClock(NOW);
    const store = makeStore({ clock });

    expect(store.open(store.seal(PAYLOAD).value)?.issuedAtMs).toBe(clock.now().getTime());
  });

  describe('refuses', () => {
    it('an absent cookie', () => {
      expect(makeStore().open(undefined)).toBeNull();
    });

    it('an empty value', () => {
      expect(makeStore().open('')).toBeNull();
    });

    it('a value that is not exactly two segments', () => {
      const store = makeStore();
      const signed = store.seal(PAYLOAD).value;

      expect(store.open(signed.replace('.', ''))).toBeNull();
      expect(store.open(`${signed}.extra`)).toBeNull();
    });

    it('a tampered payload — the attack this signature exists to stop', () => {
      const store = makeStore();
      const [payload, signature] = segments(store.seal(PAYLOAD).value);

      // The attacker has no key, so they can only edit the bytes and keep the old
      // signature. This is the whole forgery surface.
      expect(store.open(`${tamper(payload)}.${signature}`)).toBeNull();
    });

    it('a tampered signature', () => {
      const store = makeStore();
      const [payload, signature] = segments(store.seal(PAYLOAD).value);

      expect(store.open(`${payload}.${tamper(signature)}`)).toBeNull();
    });

    it('a signature of the wrong length, rather than throwing on the comparison', () => {
      const store = makeStore();
      const [payload, signature] = segments(store.seal(PAYLOAD).value);

      // A constant-time comparison needs equal-length inputs, so the length check
      // is load-bearing: without it a forger's short signature would raise and
      // become an unhandled 500 instead of a refused sign-in.
      expect(store.open(`${payload}.${signature.slice(0, -1)}`)).toBeNull();
      expect(store.open(`${payload}.${signature}x`)).toBeNull();
    });

    it('a bundle from a different flow pasted into the browser', () => {
      // The realistic forgery: the attacker runs their own sign-in, then hands
      // the victim's browser their own bundle. Login CSRF in one move.
      const victim = makeStore();
      const attacker = makeStore();
      const [attackerPayload] = segments(attacker.seal(PAYLOAD).value);
      const [, victimSignature] = segments(
        victim.seal({ ...PAYLOAD, state: 'victimState00000000000000' }).value,
      );

      expect(victim.open(`${attackerPayload}.${victimSignature}`)).toBeNull();
    });

    it('a value sealed with a different key', () => {
      const mine = makeStore();
      const theirs = makeStore({ secret: 'a-completely-different-key-0123456789abcdef' });

      expect(mine.open(theirs.seal(PAYLOAD).value)).toBeNull();
    });
  });

  describe('expiry, at the boundary', () => {
    const openedAfter = (elapsedMs: number): unknown => {
      const clock = new FakeClock(NOW);
      const store = makeStore({ clock });
      const sealed = store.seal(PAYLOAD).value;
      clock.advance(elapsedMs);
      return store.open(sealed);
    };

    it('one millisecond inside the window', () => {
      expect(openedAfter(TTL - 1)).not.toBeNull();
    });

    it('exactly on the boundary', () => {
      // Expires AT the window, not after it: `now - issuedAt >= ttl` is the rule,
      // so a bundle is spent at precisely the instant its `Expires` arrives. The
      // other comparison would leave a one-millisecond window where the server
      // honours a cookie the browser has already discarded.
      expect(openedAfter(TTL)).toBeNull();
    });

    it('one millisecond outside the window', () => {
      expect(openedAfter(TTL + 1)).toBeNull();
    });

    it('a bundle sealed under a longer policy, opened by a store holding a shorter one', () => {
      // The window is a property of the store, not of the value. A longer-lived
      // cookie cannot be smuggled past a shorter policy.
      const clock = new FakeClock(NOW);
      const sealed = makeStore({ clock }).seal(PAYLOAD).value;
      clock.advance(TTL - 1);

      expect(makeStore({ clock, ttlMs: 1_000 }).open(sealed)).toBeNull();
    });
  });
});

describe('HmacOidcStateStore — clearing', () => {
  it('issues an already-dead cookie with the identical name, path and attributes', () => {
    // A clear differing in name or path removes nothing, leaving a bundle in the
    // browser that still looks valid.
    const store = makeStore();
    const issued = store.seal(PAYLOAD);
    const cleared = store.expired();

    expect(cleared.name).toBe(issued.name);
    expect(cleared.attributes.path).toBe(issued.attributes.path);
    expect(cleared.attributes.httpOnly).toBe(issued.attributes.httpOnly);
    expect(cleared.attributes.secure).toBe(issued.attributes.secure);
    expect(cleared.attributes.sameSite).toBe(issued.attributes.sameSite);
  });

  it('expires behind every plausible device clock, so the browser discards it', () => {
    // The epoch rather than `now`: a server whose clock is behind the browser's
    // would compute a "past" date that is still in the future on the client, and
    // the browser would silently keep the cookie.
    expect(makeStore().expired().attributes.expiresAt).toEqual(instant('1970-01-01T00:00:00.000Z'));
  });
});

describe('HmacOidcStateStore — refusing to be built wrong', () => {
  it.each([
    { case: 'an empty key', secret: '' },
    { case: 'a whitespace-only key', secret: '   ' },
    { case: 'a key too short to be a secret', secret: 'short' },
  ])('refuses $case', ({ secret }) => {
    expect(() => makeStore({ secret })).toThrow(InvalidOidcStateStoreError);
  });

  it('names the variable in the message, because AGENTS.md 11 requires failing loudly', () => {
    // The offending value is deliberately absent from the message.
    expect(() => makeStore({ secret: '' })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it.each([
    { case: 'zero', ttlMs: 0 },
    { case: 'a negative window', ttlMs: -1 },
    { case: 'a fractional window', ttlMs: 1.5 },
    { case: 'NaN', ttlMs: Number.NaN },
  ])('refuses $case as the window', ({ ttlMs }) => {
    // A window that is not a positive whole number of milliseconds produces an
    // `Expires` the browser cannot parse, and a browser that discards the
    // attribute leaves a cookie with no expiry at all.
    expect(() => makeStore({ ttlMs })).toThrow(InvalidOidcStateStoreError);
  });

  it('refuses a cleartext cookie without the acknowledgement that names the exception', () => {
    expect(
      () =>
        new HmacOidcStateStore({
          clock: new FakeClock(NOW),
          secret: SECRET,
          ttlMs: TTL,
          config: { secure: false },
        }),
    ).toThrow(InvalidOidcStateStoreError);
  });

  it('allows the acknowledged local-development exception', () => {
    const store = new HmacOidcStateStore({
      clock: new FakeClock(NOW),
      secret: SECRET,
      ttlMs: TTL,
      config: { secure: false, acknowledgeInsecureLocalhostOnly: true },
    });

    expect(store.seal(PAYLOAD).attributes.secure).toBe(false);
  });

  it('produces `secure` by default, because a never-written config must be the safe one', () => {
    expect(makeStore().seal(PAYLOAD).attributes.secure).toBe(true);
  });
});
