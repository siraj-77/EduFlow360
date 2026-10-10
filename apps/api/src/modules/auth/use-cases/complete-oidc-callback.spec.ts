import { describe, expect, it } from 'vitest';
import { FakeAllowedEmailDomainStore } from '../../../testing/fake-allowed-email-domain-store.js';
import { FakeExternalIdentityRepository } from '../../../testing/fake-external-identity-repository.js';
import { FakeClock } from '../../../testing/fake-clock.js';
import { FakeOidcProvider } from '../../../testing/fake-oidc-provider.js';
import { FakeSessionRepository } from '../../../testing/fake-session-repository.js';
import { HmacOidcStateStore } from '../infrastructure/adapters/oidc-state-store.js';
import type { IOidcStateStore } from '../domain/ports/oidc-state-store.js';
import type { ISessionRepository } from '../domain/ports/session-repository.js';
import {
  CompleteOidcCallback,
  type CompleteOidcCallbackDeps,
  type OidcCallbackOutcome,
} from './complete-oidc-callback.js';

/**
 * `CompleteOidcCallback` — where a stranger's assertion becomes a local account.
 *
 * ## The five steps, and why the order IS the security content
 *
 * ```
 * 1. open the state cookie          → null ⇒ refuse (absent, forged, or expired)
 * 2. verifyCallback                 → state compared BEFORE any network call
 * 3. decideEmailDomain              → fail-closed; empty allowlist means LOCKED
 * 4. require emailVerified === true → D57
 * 5. findBySubject                  → no match ⇒ REFUSE. Never create a User.
 * ```
 *
 * Reordering any two of these changes what an attacker can do, and three of the
 * orderings are asserted here directly rather than left to the reading of the code.
 *
 * ## What is real and what is a double, and why
 *
 * **Real:** `HmacOidcStateStore`, with a `FakeClock`. The state cookie is the control
 * that decides which callbacks belong to this server, and a double for it would
 * assert that the use-case called a function.
 *
 * **Double:** the provider, the identity repository, the session repository and the
 * domain store. Each stands in for something outside this use-case's concern. The
 * identity fake is the one that matters most: it faithfully reproduces the REFUSAL to
 * re-point an identity, because a collaborator that cannot refuse proves nothing.
 */

const NOW = '2026-10-03T09:00:00.000Z';
const TTL = 600_000;
const SECRET = 'localdev-test-signing-key-0123456789';

const USER_ID = '2f6a1d0c-8e4b-4a1e-9c2f-3d4e5f6a7b8c';
const SUBJECT = 'google-subject-000000000001';
const LINKED_USER_ID = '7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f';

const SCHOOL_DOMAIN = 'school.test';

const store = (clock = new FakeClock(NOW)): HmacOidcStateStore =>
  new HmacOidcStateStore({ clock, secret: SECRET, ttlMs: TTL });

interface Harness {
  readonly useCase: CompleteOidcCallback;
  readonly provider: FakeOidcProvider;
  readonly identities: FakeExternalIdentityRepository;
  readonly sessions: FakeSessionRepository;
  readonly domains: FakeAllowedEmailDomainStore;
  readonly clock: FakeClock;
  readonly stateStore: IOidcStateStore;
}

/** A verified Google identity whose address is in this school's allowlist. */
const verifiedIdentity = (overrides?: {
  readonly email?: string | null;
  readonly emailVerified?: boolean | null;
  readonly subject?: string;
}): Record<string, unknown> => ({
  subject: overrides?.subject ?? SUBJECT,
  email: overrides?.email === undefined ? `teacher@${SCHOOL_DOMAIN}` : overrides.email,
  emailVerified: overrides?.emailVerified === undefined ? true : overrides.emailVerified,
  provider: 'fake',
});

function harness(overrides?: Partial<CompleteOidcCallbackDeps>): Harness {
  const clock = new FakeClock(NOW);
  const provider = new FakeOidcProvider();
  const identities = new FakeExternalIdentityRepository();
  const sessions = new FakeSessionRepository({ now: clock.now(), userId: USER_ID });
  const domains = new FakeAllowedEmailDomainStore([SCHOOL_DOMAIN]);
  const stateStore = store(clock);

  provider.identity = {
    subject: SUBJECT,
    email: `teacher@${SCHOOL_DOMAIN}`,
    emailVerified: true,
    provider: 'fake',
  };

  const useCase = new CompleteOidcCallback({
    provider,
    stateStore,
    domains,
    identities,
    sessions,
    sessionTtlMs: 3_600_000,
    refreshTtlMs: 1_209_600_000,
    ...overrides,
  });

  return { useCase, provider, identities, sessions, domains, clock, stateStore };
}

/** A real signed bundle, in sign-in mode unless `userId` names a link. */
const sealed = (
  stateStore: IOidcStateStore,
  options?: { readonly mode?: 'sign-in' | 'link'; readonly userId?: string },
): { readonly cookie: string; readonly state: string } => {
  const values = {
    state: 'state-abc123',
    nonce: 'nonce-abc123',
    codeVerifier: 'verifier-abc123',
    redirectUri: 'https://api.school.test/auth/oidc/callback',
  };
  const payload =
    options?.mode === 'link' && options.userId !== undefined
      ? ({ mode: 'link', userId: options.userId, ...values } as const)
      : ({ mode: 'sign-in', ...values } as const);

  const cookie = stateStore.seal(payload);

  return { cookie: cookie.value, state: values.state };
};

const query = (state: string) => ({
  code: 'auth-code',
  state,
  error: null,
  errorDescription: null,
});

const refused = (outcome: OidcCallbackOutcome, reason: string): boolean =>
  outcome.outcome === 'refused' && outcome.reason === reason;

// ═══════════════════════════════════════════════════════════════════════════
// Step 1 — the state cookie. Absent, forged and expired all land here.
// ═══════════════════════════════════════════════════════════════════════════
describe('step 1 — opening the state cookie', () => {
  it('refuses when no state cookie was presented', async () => {
    const h = harness();
    const bundle = sealed(h.stateStore);

    const outcome = await h.useCase.complete({
      query: query(bundle.state),
      stateCookie: undefined,
    });

    expect(refused(outcome, 'state-unreadable')).toBe(true);
  });

  it('refuses a forged bundle, and never asks the provider anything', async () => {
    const h = harness();
    const bundle = sealed(h.stateStore);
    const [payload, signature] = bundle.cookie.split('.') as [string, string];
    const forged = `${payload.slice(0, -1)}${payload.endsWith('A') ? 'B' : 'A'}.${signature}`;

    const outcome = await h.useCase.complete({
      query: query(bundle.state),
      stateCookie: forged,
    });

    expect(refused(outcome, 'state-unreadable')).toBe(true);
    // No network call. A guard that reached the provider before checking the bundle
    // would hand a stranger's `state` to Google's token endpoint.
    expect(h.provider.lastVerify).toBeUndefined();
  });

  it('refuses an EXPIRED bundle, from the server-side clock rather than the browser', async () => {
    const h = harness();
    const bundle = sealed(h.stateStore);
    h.clock.advance(TTL);

    const outcome = await h.useCase.complete({
      query: query(bundle.state),
      stateCookie: bundle.cookie,
    });

    expect(refused(outcome, 'state-unreadable')).toBe(true);
    expect(h.provider.lastVerify).toBeUndefined();
  });

  it('refuses a bundle minted by a different key', async () => {
    const h = harness();
    const bundle = sealed(h.stateStore);
    const attacker = new HmacOidcStateStore({
      clock: h.clock,
      secret: 'a-different-test-only-signing-key-0123456789abcd',
      ttlMs: TTL,
    });
    const theirs = attacker.seal({
      mode: 'sign-in',
      state: bundle.state,
      nonce: 'nonce-attacker',
      codeVerifier: 'verifier-attacker',
      redirectUri: 'https://evil.test/auth/oidc/callback',
    });

    const outcome = await h.useCase.complete({
      query: query(bundle.state),
      stateCookie: theirs.value,
    });

    expect(refused(outcome, 'state-unreadable')).toBe(true);
  });

  it('issues no session and creates no identity on any of those', async () => {
    const h = harness();
    h.identities.arrange({ userId: USER_ID, provider: 'fake', subject: SUBJECT });

    await h.useCase.complete({ query: query('state-abc123'), stateCookie: undefined });

    expect(h.sessions.issueCalls).toHaveLength(0);
    expect(h.identities.findCalls).toHaveLength(0);
    expect(h.identities.linkCalls).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Step 2 — `state`, before ANY network call.
//
// The naive ordering is "hand everything to the provider and let it decide". This
// route does not: the comparison happens here, so it is this repository's control
// and not the adapter's, and the assertion is that the adapter was never called.
// ═══════════════════════════════════════════════════════════════════════════
describe('step 2 — the state comparison happens before any network call', () => {
  it('refuses a callback whose state is not the one we sealed', async () => {
    const h = harness();
    const bundle = sealed(h.stateStore);

    const outcome = await h.useCase.complete({
      query: query('state-the-attacker-chose'),
      stateCookie: bundle.cookie,
    });

    expect(refused(outcome, 'state-mismatch')).toBe(true);
    expect(h.provider.lastVerify).toBeUndefined();
  });

  it('refuses a callback with NO state at all, rather than passing null through', async () => {
    const h = harness();
    const bundle = sealed(h.stateStore);

    const outcome = await h.useCase.complete({
      query: { code: 'auth-code', state: null, error: null, errorDescription: null },
      stateCookie: bundle.cookie,
    });

    expect(refused(outcome, 'state-mismatch')).toBe(true);
    expect(h.provider.lastVerify).toBeUndefined();
  });

  it('hands the provider our own four values, never the ones the query carried', async () => {
    const h = harness();
    const bundle = sealed(h.stateStore);

    await h.useCase.complete({ query: query(bundle.state), stateCookie: bundle.cookie });

    const expected = h.provider.lastVerify?.expected;
    // `state` is ours, `nonce` and `codeVerifier` came out of the sealed bundle and
    // were never in the query, and `redirectUri` is the one the flow was started with.
    expect(expected?.state).toBe(bundle.state);
    expect(expected?.nonce).toBe('nonce-abc123');
    expect(expected?.codeVerifier).toBe('verifier-abc123');
    expect(expected?.redirectUri).toBe('https://api.school.test/auth/oidc/callback');
  });

  it('refuses when the provider rejects the exchange, and names no provider detail', async () => {
    const h = harness();
    const bundle = sealed(h.stateStore);
    h.provider.rejectEveryCallback = new Error('ID token was rejected: signature invalid');

    const outcome = await h.useCase.complete({
      query: query(bundle.state),
      stateCookie: bundle.cookie,
    });

    expect(refused(outcome, 'provider-rejected')).toBe(true);
    // The typed reason is the whole message. A provider error string quoted back to a
    // caller tells them which of the five checks failed, which is a free oracle.
    expect(outcome.outcome === 'refused' && outcome.reason).toBe('provider-rejected');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Steps 3 and 4 — the domain pre-filter and `emailVerified`. D49 and D57.
// ═══════════════════════════════════════════════════════════════════════════
describe('step 3 — the domain allowlist is fail-closed', () => {
  it.each([
    { case: 'null (no settings row)', allowlist: null, reason: 'allowlist-not-configured' },
    { case: 'an empty list', allowlist: [], reason: 'allowlist-not-configured' },
    {
      case: 'a list whose every entry is unusable',
      allowlist: ['   ', 'teacher@school.test'],
      reason: 'allowlist-not-configured',
    },
    {
      case: 'a value that is not a list at all',
      allowlist: { domains: ['school.test'] },
      reason: 'allowlist-malformed',
    },
    {
      case: 'a real address in a domain nobody configured',
      allowlist: ['other.test'],
      reason: 'domain-not-permitted',
    },
    {
      case: 'a subdomain of a configured domain',
      allowlist: [SCHOOL_DOMAIN],
      email: `teacher@staff.${SCHOOL_DOMAIN}`,
      reason: 'domain-not-permitted',
    },
    {
      case: 'an address that only ends with a configured domain',
      allowlist: [SCHOOL_DOMAIN],
      email: `teacher@evil${SCHOOL_DOMAIN}`,
      reason: 'domain-not-permitted',
    },
  ])('refuses $case', async ({ allowlist, reason, email }) => {
    // The reasons are `decideEmailDomain`'s OWN strings, forwarded verbatim. That is
    // the property being asserted: the route does not invent a parallel vocabulary
    // for a rule somebody else owns, so a change to `D49` shows up here as a changed
    // reason rather than as a branch nobody wrote.
    const h = harness();
    if (email !== undefined)
      h.provider.identity = { ...verifiedIdentity({ email }), provider: 'fake' } as never;
    h.domains.set(allowlist);
    const bundle = sealed(h.stateStore);

    const outcome = await h.useCase.complete({
      query: query(bundle.state),
      stateCookie: bundle.cookie,
    });

    expect(refused(outcome, reason)).toBe(true);
    // Nothing was issued and nothing was written, whichever way the rule refused.
    expect(h.sessions.issueCalls).toHaveLength(0);
    expect(h.identities.findCalls).toHaveLength(0);
  });

  it('refuses when the provider asserted no address at all', async () => {
    const h = harness();
    h.provider.identity = { ...verifiedIdentity(), email: null } as never;
    const bundle = sealed(h.stateStore);

    const outcome = await h.useCase.complete({
      query: query(bundle.state),
      stateCookie: bundle.cookie,
    });

    expect(refused(outcome, 'address-malformed')).toBe(true);
  });

  it('never looks an identity up once the domain has refused', async () => {
    // Ordering, not decoration: the domain rule is a pre-filter, and a callback that
    // looked the identity up first would do database work for an address this school
    // does not admit.
    const h = harness();
    h.domains.set(null);
    const bundle = sealed(h.stateStore);

    await h.useCase.complete({ query: query(bundle.state), stateCookie: bundle.cookie });

    expect(h.identities.findCalls).toHaveLength(0);
  });
});

describe('step 4 — emailVerified must be true, not merely truthy', () => {
  it.each([
    { case: 'false', emailVerified: false },
    { case: 'null (the provider said nothing)', emailVerified: null },
  ])('refuses when emailVerified is $case', async ({ emailVerified }) => {
    const h = harness();
    h.provider.identity = { ...verifiedIdentity(), emailVerified } as never;
    const bundle = sealed(h.stateStore);

    const outcome = await h.useCase.complete({
      query: query(bundle.state),
      stateCookie: bundle.cookie,
    });

    expect(refused(outcome, 'email-unverified')).toBe(true);
    expect(h.sessions.issueCalls).toHaveLength(0);
    expect(h.identities.findCalls).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Step 5 — `D57`. MUST-LINK. This is the point of the whole route.
// ═══════════════════════════════════════════════════════════════════════════
describe('step 5 — sign-in mode', () => {
  const signedInIdentity = async (
    h: Harness,
  ): Promise<{ readonly bundle: { cookie: string; state: string } }> => {
    h.identities.arrange({ userId: USER_ID, provider: 'fake', subject: SUBJECT });
    const bundle = sealed(h.stateStore);
    await h.useCase.complete({ query: query(bundle.state), stateCookie: bundle.cookie });
    return { bundle };
  };

  it('issues a session when the identity is already linked', async () => {
    const h = harness();

    const { bundle } = await signedInIdentity(h);

    expect(h.sessions.issueCalls).toHaveLength(1);
    expect(h.sessions.issueCalls[0]?.actor.userId).toBe(USER_ID);
    expect(bundle.state).toBe('state-abc123');
  });

  it('looks the account up by SUBJECT and never by address', async () => {
    const h = harness();

    await signedInIdentity(h);

    expect(h.identities.findCalls).toEqual([{ provider: 'fake', subject: SUBJECT }]);
  });

  it('REFUSES an unknown subject and creates NOTHING — D57', async () => {
    // THE test. Auto-provisioning here would let any student holding a
    // `@school.test` Gmail become a system user with a session.
    const h = harness();
    const bundle = sealed(h.stateStore);

    const outcome = await h.useCase.complete({
      query: query(bundle.state),
      stateCookie: bundle.cookie,
    });

    expect(refused(outcome, 'identity-not-linked')).toBe(true);
    expect(h.sessions.issueCalls).toHaveLength(0);
    // And no link was attempted either: there is no identity repository method that
    // creates a User, and none was called that writes anything.
    expect(h.identities.linkCalls).toHaveLength(0);
    expect(h.identities.size).toBe(0);
  });

  it('refuses a session cookie being present — it must not change the outcome', async () => {
    // THE TAKEOVER. The naive design is "if a session cookie is present, link".
    // A victim is signed in, an attacker completes their own Google sign-in in the
    // victim's browser, and the callback binds the ATTACKER's identity to the
    // VICTIM's account.
    //
    // This use-case has no parameter through which a session cookie could arrive, so
    // the attack has no surface at all — and the assertion is that an extra, ignored
    // parameter does not change one word of the flow.
    const h = harness();
    const bundle = sealed(h.stateStore);

    const outcome = await h.useCase.complete({
      query: query(bundle.state),
      stateCookie: bundle.cookie,
      // A cookie the attacker hopes the implementation reads. There is nowhere for it
      // to go: `complete` takes no request and no session.
      sessionCookie: `eduflow_session=the-victim's-live-token`,
      userId: LINKED_USER_ID,
    } as never);

    expect(refused(outcome, 'identity-not-linked')).toBe(true);
    expect(h.identities.linkCalls).toHaveLength(0);
    expect(h.sessions.issueCalls).toHaveLength(0);
  });

  it('never links in sign-in mode, whatever the sealed bundle carries', async () => {
    // A sign-in bundle cannot even NAME an account — `SealedOidcState` is a union
    // and `userId` is not a member of the sign-in arm. Reaching this at all is a
    // compile error; the runtime assertion is that no link call happened.
    const h = harness();
    const bundle = sealed(h.stateStore, { mode: 'sign-in' });

    await h.useCase.complete({ query: query(bundle.state), stateCookie: bundle.cookie });

    expect(h.identities.linkCalls).toHaveLength(0);
  });

  it('passes the device context to the session, so "who is signed in, from where" works', async () => {
    const h = harness();
    h.identities.arrange({ userId: USER_ID, provider: 'fake', subject: SUBJECT });
    const bundle = sealed(h.stateStore);

    await h.useCase.complete({
      query: query(bundle.state),
      stateCookie: bundle.cookie,
      device: { ipAddress: '10.0.0.7', userAgent: 'EduFlow-HTTP-Harness/1.0' },
    });

    expect(h.sessions.issueCalls[0]?.actor).toMatchObject({
      userId: USER_ID,
      ipAddress: '10.0.0.7',
      userAgent: 'EduFlow-HTTP-Harness/1.0',
    });
  });

  it('issues a session with no device at all rather than failing', async () => {
    const h = harness();
    h.identities.arrange({ userId: USER_ID, provider: 'fake', subject: SUBJECT });
    const bundle = sealed(h.stateStore);

    await h.useCase.complete({ query: query(bundle.state), stateCookie: bundle.cookie });

    expect(h.sessions.issueCalls).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LINK mode. Reachable ONLY from a bundle `GET /auth/oidc/link` sealed behind
// SessionGuard, and bound to that account rather than to whoever is signed in now.
// ═══════════════════════════════════════════════════════════════════════════
describe('link mode', () => {
  const linkBundle = (h: Harness, userId = LINKED_USER_ID): string =>
    sealed(h.stateStore, { mode: 'link', userId }).cookie;

  const linkState = 'state-abc123';

  it('links the identity to the account the bundle names', async () => {
    const h = harness();

    const outcome = await h.useCase.complete({
      query: query(linkState),
      stateCookie: linkBundle(h),
    });

    expect(outcome).toEqual({ outcome: 'linked' });
    expect(h.identities.linkCalls).toEqual([
      {
        userId: LINKED_USER_ID,
        provider: 'fake',
        subject: SUBJECT,
        email: `teacher@${SCHOOL_DOMAIN}`,
        emailVerified: true,
      },
    ]);
  });

  it('issues NO session on a link, because the caller already has one', async () => {
    const h = harness();

    await h.useCase.complete({ query: query(linkState), stateCookie: linkBundle(h) });

    expect(h.sessions.issueCalls).toHaveLength(0);
  });

  it('reports an already-linked identity as a success, and changes nothing', async () => {
    const h = harness();
    h.identities.arrange({
      userId: LINKED_USER_ID,
      provider: 'fake',
      subject: SUBJECT,
    });

    const outcome = await h.useCase.complete({
      query: query(linkState),
      stateCookie: linkBundle(h),
    });

    expect(outcome).toEqual({ outcome: 'already-linked' });
    expect(h.identities.size).toBe(1);
  });

  it('REFUSES to re-point an identity bound to a different account', async () => {
    const h = harness();
    h.identities.arrange({ userId: USER_ID, provider: 'fake', subject: SUBJECT });

    const outcome = await h.useCase.complete({
      query: query(linkState),
      stateCookie: linkBundle(h),
    });

    expect(refused(outcome, 'identity-linked-elsewhere')).toBe(true);
    // Still the victim's own account, byte for byte.
    expect(h.identities.rows.get(`fake|${SUBJECT}`)?.userId).toBe(USER_ID);
  });

  it('links to the account in the BUNDLE, never to one passed alongside it', async () => {
    // The takeover, in its precise form. An attacker who can make a link bundle get
    // signed in the victim's browser must not be able to choose the target account.
    const h = harness();

    await h.useCase.complete({
      query: query(linkState),
      stateCookie: linkBundle(h, USER_ID),
      userId: LINKED_USER_ID,
    } as never);

    expect(h.identities.linkCalls[0]?.userId).toBe(USER_ID);
  });

  it('still applies the domain allowlist and emailVerified, so a personal Gmail cannot be linked', async () => {
    // One rule, applied on both paths. Decided here rather than inherited: it is the
    // MORE restrictive of the two options, it adds no threshold and invents no policy
    // (it applies D49 as written), and it costs nothing — `POST /auth/login` still
    // works for anyone whose Google address is outside the list.
    const h = harness();
    h.domains.set(['other.test']);

    const outcome = await h.useCase.complete({
      query: query(linkState),
      stateCookie: linkBundle(h),
    });

    expect(refused(outcome, 'domain-not-permitted')).toBe(true);
    expect(h.identities.linkCalls).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The shape of the answer.
// ═══════════════════════════════════════════════════════════════════════════
describe('the outcome', () => {
  it('is a discriminated union, so a caller cannot forget to handle a branch', async () => {
    const h = harness();
    h.identities.arrange({ userId: USER_ID, provider: 'fake', subject: SUBJECT });
    const bundle = sealed(h.stateStore);

    const outcome: OidcCallbackOutcome = await h.useCase.complete({
      query: query(bundle.state),
      stateCookie: bundle.cookie,
    });

    expect(outcome.outcome).toBe('signed-in');
    if (outcome.outcome !== 'signed-in') throw new Error('unreachable');
    // The session token is the caller's to deliver and the use-case returns it
    // rather than setting a cookie: it has no response to set one on.
    expect(outcome.session.sessionTokenPlaintext).toBeTruthy();
  });

  it('carries no credential and no address in a refusal', async () => {
    const h = harness();
    const bundle = sealed(h.stateStore);

    const outcome = await h.useCase.complete({
      query: query(bundle.state),
      stateCookie: bundle.cookie,
    });

    // `AGENTS.md` 2.13: a refusal that echoes the address would tell a caller what
    // this school admits, and a refusal that echoed the token would put a live
    // credential in a log line.
    expect(JSON.stringify(outcome)).not.toContain(`teacher@${SCHOOL_DOMAIN}`);
    expect(JSON.stringify(outcome)).not.toContain('verifier-abc123');
  });

  it('propagates a repository failure rather than reporting it as a refusal', async () => {
    // A refused sign-in and a broken database are different facts, and collapsing
    // them would make an outage look like a user error. This is the one place a
    // throw is right.
    const h = harness();
    const sessions: ISessionRepository = {
      ...h.sessions,
      findByToken: async () => null,
      issue: async () => {
        throw new Error('database is down');
      },
      findForRotation: async () => ({ found: false }),
      rotate: async () => {
        throw new Error('unused');
      },
      revokeFamily: async () => ({ tokensRevoked: 0 }),
      revokeSession: async () => undefined,
      revokeExpired: async () => 0,
    };
    const wired = harness({ sessions });
    wired.identities.arrange({ userId: USER_ID, provider: 'fake', subject: SUBJECT });
    const bundle = sealed(wired.stateStore);

    await expect(
      wired.useCase.complete({ query: query(bundle.state), stateCookie: bundle.cookie }),
    ).rejects.toThrow(/database is down/);
    void sessions;
  });
});
