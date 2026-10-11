import { describe, expect, it, vi } from 'vitest';
import { instant } from '../../../testing/instant.js';
import { FakeClock } from '../../../testing/fake-clock.js';
import { FakeSessionRepository } from '../../../testing/fake-session-repository.js';
import { FakeUserCredentialRepository } from '../../../testing/fake-user-credential-repository.js';
import { FakePasswordResetTokenRepository } from '../../../testing/fake-password-reset-token-repository.js';
import { RecordingPasswordHasher } from '../../../testing/recording-password-hasher.js';
import { DEFAULT_PASSWORD_HASH_PARAMETERS } from '../../settings/domain/services/password-hash-parameters.js';
import { DEFAULT_PASSWORD_POLICY } from '../domain/services/password-policy.js';
import { Argon2PasswordHasher } from '../infrastructure/adapters/argon2-password-hasher.js';
import { ConfirmPasswordReset } from './confirm-password-reset.js';

/**
 * `ConfirmPasswordReset` — half of `PLT-105` T2, and the story's two
 * acceptance criteria live here.
 *
 * AC-1 "single-use, expires after configurable window" is the token store's
 * property, exercised for real against PostgreSQL in
 * `prisma-password-reset-token-repository.integration.spec.ts`. What THIS
 * suite owns is the consequence: a refused redemption writes NOTHING.
 *
 * AC-2 "invalidates all prior sessions" is `revokeAllForUser`'s integration
 * spec. What this suite owns is that a successful reset CALLS it, with the
 * reason named, and that the credential is written first — a reset that
 * signs the user out without changing the password has locked them out of
 * the account it was meant to recover.
 */

// `instant()`, not `new Date()` — the ESLint rule under `use-cases/` is
// absolute on purpose; see `src/testing/instant.ts`.
const AT = instant('2026-10-11T09:00:00.000Z');
const GOOD_PASSWORD = 'a-sufficiently-long-new-password';

/** The argon2 floor — cheap enough for a suite, real enough to stay argon2. */
const CHEAP = Object.freeze({ memoryKiB: 8, iterations: 1, parallelism: 1 });

const deps = () => {
  const users = new FakeUserCredentialRepository();
  users.identifier = 'principal@school.test';
  const tokens = new FakePasswordResetTokenRepository();
  const sessions = new FakeSessionRepository({ now: AT });
  // A recorder over the REAL hasher, with the library's own floor for cost.
  const hasher = new RecordingPasswordHasher(
    new Argon2PasswordHasher({ currentParameters: CHEAP }),
  );
  const clock = new FakeClock(AT);
  const useCase = new ConfirmPasswordReset({
    users,
    tokens,
    sessions,
    hasher,
    clock,
    policy: DEFAULT_PASSWORD_POLICY,
    hashParameters: DEFAULT_PASSWORD_HASH_PARAMETERS,
  });
  return { users, tokens, sessions, hasher, clock, useCase };
};

describe('ConfirmPasswordReset — a valid redemption', () => {
  it('writes the new credential and answers reset', async () => {
    const { users, tokens, useCase } = deps();
    const issued = await tokens.seedIssued({
      userId: 'user-under-test',
      ttlMs: 3_600_000,
      now: AT,
    });

    const outcome = await useCase.confirm({
      token: issued.tokenPlaintext,
      newPassword: GOOD_PASSWORD,
    });

    expect(outcome).toEqual({ outcome: 'reset' });
    expect(users.replacements).toHaveLength(1);
    expect(users.replacements[0]?.userId).toBe('user-under-test');
  });

  it('invalidates every prior session, named with the reason', async () => {
    // AC-2. The reason string is what an auditor reads on the revoked rows.
    const { tokens, sessions, useCase } = deps();
    const issued = await tokens.seedIssued({
      userId: 'user-under-test',
      ttlMs: 3_600_000,
      now: AT,
    });

    await useCase.confirm({ token: issued.tokenPlaintext, newPassword: GOOD_PASSWORD });

    expect(sessions.revokedUsers).toEqual([
      { userId: 'user-under-test', reason: 'password-reset' },
    ]);
  });

  it('hashes at the school parameters, so the cost is configuration not code', async () => {
    const { tokens, hasher, useCase } = deps();
    const issued = await tokens.seedIssued({
      userId: 'user-under-test',
      ttlMs: 3_600_000,
      now: AT,
    });

    await useCase.confirm({ token: issued.tokenPlaintext, newPassword: GOOD_PASSWORD });

    expect(hasher.hashCalls).toHaveLength(1);
    expect(hasher.hashCalls[0]?.parameters).toEqual(DEFAULT_PASSWORD_HASH_PARAMETERS);
  });

  it('consumes the token, so the same link cannot be used twice', async () => {
    const { tokens, useCase } = deps();
    const issued = await tokens.seedIssued({
      userId: 'user-under-test',
      ttlMs: 3_600_000,
      now: AT,
    });

    await useCase.confirm({ token: issued.tokenPlaintext, newPassword: GOOD_PASSWORD });

    expect(tokens.consumeCalls).toEqual([issued.tokenPlaintext]);
  });
});

describe('ConfirmPasswordReset — a refused redemption', () => {
  it('an unknown token writes nothing and answers refused', async () => {
    const { users, sessions, useCase } = deps();

    const outcome = await useCase.confirm({
      token: 'a-token-nobody-issued',
      newPassword: GOOD_PASSWORD,
    });

    expect(outcome).toEqual({ outcome: 'token-refused' });
    expect(users.replacements).toEqual([]);
    expect(sessions.revokedUsers).toEqual([]);
  });

  it('an already-used token is refused, because single-use is a write not a read', async () => {
    const { tokens, useCase } = deps();
    const issued = await tokens.seedIssued({
      userId: 'user-under-test',
      ttlMs: 3_600_000,
      now: AT,
    });
    tokens.markConsumed(issued.tokenPlaintext);

    const outcome = await useCase.confirm({
      token: issued.tokenPlaintext,
      newPassword: GOOD_PASSWORD,
    });

    expect(outcome).toEqual({ outcome: 'token-refused' });
  });

  it('an expired token is refused', async () => {
    const { tokens, useCase } = deps();
    const issued = await tokens.seedIssued({ userId: 'user-under-test', ttlMs: -1000, now: AT });

    const outcome = await useCase.confirm({
      token: issued.tokenPlaintext,
      newPassword: GOOD_PASSWORD,
    });

    expect(outcome).toEqual({ outcome: 'token-refused' });
  });
});

describe('ConfirmPasswordReset — the password policy', () => {
  it('is checked BEFORE the token, so a weak password cannot burn a link', async () => {
    // The `complete-first-administrator-setup.ts` ordering, and the reason is
    // the same: the cheapest check first, and a refusal that spends nothing.
    const { tokens, useCase } = deps();
    const issued = await tokens.seedIssued({
      userId: 'user-under-test',
      ttlMs: 3_600_000,
      now: AT,
    });

    const outcome = await useCase.confirm({ token: issued.tokenPlaintext, newPassword: 'short' });

    expect(outcome).toEqual({ outcome: 'password-refused', refusal: 'too-short' });
    expect(tokens.consumeCalls).toEqual([]);
  });

  it('a refused password answers with the code and never the candidate', async () => {
    // `AGENTS.md` 2.13: the verdict is a code, never the string that caused
    // it. The candidate is chosen so it is not a substring of any refusal
    // code — 'too-short' contains 'short', and a test that only checked
    // "does the response contain the password" would pass on a coincidence.
    const { useCase } = deps();

    const outcome = await useCase.confirm({ token: 'x', newPassword: 'tiny' });

    expect(JSON.stringify(outcome)).not.toContain('tiny');
  });
});

describe('ConfirmPasswordReset — the revocation fails', () => {
  it('still answers reset, because the password is already changed', async () => {
    // Order settled on purpose: credential first, revocation second. A reset
    // that reports refusal after the password changed is a user locked out
    // of an account they just recovered — the worst of both answers. The
    // failure is logged instead.
    const { tokens, useCase, sessions } = deps();
    const issued = await tokens.seedIssued({
      userId: 'user-under-test',
      ttlMs: 3_600_000,
      now: AT,
    });
    sessions.revokeAllFailure = new Error('database refused');
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const outcome = await useCase.confirm({
        token: issued.tokenPlaintext,
        newPassword: GOOD_PASSWORD,
      });

      expect(outcome).toEqual({ outcome: 'reset' });
      expect(errors).toHaveBeenCalled();
    } finally {
      errors.mockRestore();
    }
  });
});
