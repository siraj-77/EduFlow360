import { describe, expect, it, vi } from 'vitest';
import { instant } from '../../../testing/instant.js';
import { FakeClock } from '../../../testing/fake-clock.js';
import { FakeUserCredentialRepository } from '../../../testing/fake-user-credential-repository.js';
import { FakePasswordResetTokenRepository } from '../../../testing/fake-password-reset-token-repository.js';
import { RecordingEmailAdapter } from '../infrastructure/adapters/recording-email-adapter.js';
import { RequestPasswordReset } from './request-password-reset.js';

/**
 * `RequestPasswordReset` — half of `PLT-105` T1.
 *
 * ## The property this suite is really about: the answer never changes
 *
 * The route answers the same 200 whether or not an account exists. That is
 * not politeness — it is the user-enumeration control the sign-in route
 * implements at the credential layer, applied here at the request layer. If
 * a future change makes the two paths answer differently, `answers
 * identically for an address with no account` fails, and that failure is the
 * whole point of the file.
 *
 * ## Why an unknown address still performs the work
 *
 * The account lookup is the same indexed read either way (the credential
 * repository guarantees it), so no timing difference opens. What is NOT equal
 * is the mail: sending a reset link to an address with no account would mail
 * a stranger, and NOT sending one is the only honest option.
 */

// `instant()`, not `new Date()`: the ESLint rule banning `new Date()` under
// `use-cases/` is absolute on purpose, and `src/testing/instant.ts` is where a
// fixed timestamp is made.
const AT = instant('2026-10-11T09:00:00.000Z');

const deps = (options: { email?: string; active?: boolean } = {}) => {
  const users = new FakeUserCredentialRepository({
    record: {
      userId: 'user-under-test',
      passwordHash: '$argon2id$v=19$m=1,t=1,p=1$c2FsdA$aGFzaA',
      passwordAlgorithm: 'argon2id',
      status: options.active === false ? 'SUSPENDED' : 'ACTIVE',
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
  users.identifier = options.email ?? 'principal@school.test';
  const tokens = new FakePasswordResetTokenRepository();
  const email = new RecordingEmailAdapter();
  const clock = new FakeClock(AT);
  return { users, tokens, email, clock };
};

const request = (useCase: RequestPasswordReset, email: string) =>
  useCase.request({ email, sourceAddress: '203.0.113.9', deviceContext: { userAgent: 'test' } });

describe('RequestPasswordReset — an address with an account', () => {
  it('issues a token and mails exactly one reset link', async () => {
    const { users, tokens, email, clock } = deps();
    const useCase = new RequestPasswordReset({ users, tokens, email, clock });

    await request(useCase, 'principal@school.test');

    expect(tokens.issued).toHaveLength(1);
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]?.to).toBe('principal@school.test');
  });

  it('the mailed link carries the token, and the token is the minted one', async () => {
    // The link must contain the plaintext — it is what the user clicks — and
    // the plaintext must be the one the store issued, or the link redeems a
    // credential nobody stored.
    const { users, tokens, email, clock } = deps();
    const useCase = new RequestPasswordReset({ users, tokens, email, clock });

    await request(useCase, 'principal@school.test');

    expect(email.sent[0]?.textBody).toContain(tokens.issued[0]?.tokenPlaintext);
    expect(email.sent[0]?.subject).toMatch(/password/i);
  });

  it('the token is good for the configured window, measured on the injected clock', async () => {
    // `AGENTS.md` 2.4: the expiry is computed from the CLOCK, not from
    // `Date.now()`, so a test can see the window it was given.
    const { users, tokens, email, clock } = deps();
    const useCase = new RequestPasswordReset({ users, tokens, email, clock }, { ttlMs: 3_600_000 });

    await request(useCase, 'principal@school.test');

    expect(tokens.issued[0]?.expiresAt.getTime()).toBe(AT.getTime() + 3_600_000);
  });
});

describe('RequestPasswordReset — an address with no account', () => {
  it('answers identically: no token, no mail, no throw', async () => {
    // The enumeration control. A different answer here is a different status
    // code out there, and that is the oracle this closes.
    const { users, tokens, email, clock } = deps();
    const useCase = new RequestPasswordReset({ users, tokens, email, clock });

    await expect(request(useCase, 'nobody@school.test')).resolves.toBeUndefined();

    expect(tokens.issued).toEqual([]);
    expect(email.sent).toEqual([]);
  });

  it('a suspended account gets no reset link either', async () => {
    // A suspended account is a real account with no working credential; a
    // reset link would be a way around the suspension.
    const { users, tokens, email, clock } = deps({ active: false });
    const useCase = new RequestPasswordReset({ users, tokens, email, clock });

    await request(useCase, 'principal@school.test');

    expect(tokens.issued).toEqual([]);
    expect(email.sent).toEqual([]);
  });
});

describe('RequestPasswordReset — the mail fails', () => {
  it('still answers accepted, and says so loudly where a logger will live', async () => {
    // The caller must not learn whether mail went out (enumeration again),
    // but the deployment must know: a reset nobody received is the ticket
    // that says "the button did nothing".
    const { users, tokens, clock } = deps();
    const failing = {
      send: async () => {
        throw new Error('smtp refused');
      },
      sent: [],
    };
    const useCase = new RequestPasswordReset({ users, tokens, email: failing, clock });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      await expect(request(useCase, 'principal@school.test')).resolves.toBeUndefined();
      expect(errors).toHaveBeenCalled();
      // The token was still issued: the account holder can retry the link
      // from the mailbox if the mail is a late problem, and the store keeps
      // the credential valid.
      expect(tokens.issued).toHaveLength(1);
    } finally {
      errors.mockRestore();
    }
  });

  it('never logs the token, whatever else it logs', async () => {
    // `AGENTS.md` 2.13. The log line names the account and the failure, and
    // the token stays in the mailbox.
    const { users, tokens, clock } = deps();
    const failing = {
      send: async () => {
        throw new Error('smtp refused');
      },
      sent: [],
    };
    const useCase = new RequestPasswordReset({ users, tokens, email: failing, clock });
    const logged: string[] = [];
    const errors = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      logged.push(args.join(' '));
    });

    try {
      await request(useCase, 'principal@school.test');
      expect(logged.join('\n')).not.toContain(tokens.issued[0]?.tokenPlaintext ?? '');
    } finally {
      errors.mockRestore();
    }
  });
});
