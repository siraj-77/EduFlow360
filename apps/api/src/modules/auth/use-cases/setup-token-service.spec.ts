import { describe, expect, it } from 'vitest';
import { FakeClock } from '../../../testing/fake-clock.js';
import { FakeSetupTokenRepository } from '../../../testing/fake-setup-token-repository.js';
import { instant, instantAfter } from '../../../testing/instant.js';
import type { SetupTokenDeploymentState } from '../domain/services/setup-token.js';
import { SetupTokenService } from './setup-token-service.js';

/**
 * The application half of `PLT-107`: orchestrating the rule with a repository
 * and a clock.
 *
 * The two behaviours worth a test here are the ones a controller cannot be
 * trusted to get right:
 *
 *   1. **Inspection does not consume.** `PLT-101` will reject a password that
 *      fails the policy, and the story requires the token to survive that
 *      rejection — it is the school's only way in. So verification and
 *      consumption are two separate calls, and only the second one burns.
 *   2. **The atomic guard has the last word.** `consume` does verify-then-guard,
 *      and the guard is what makes that safe: if the conditional update matched
 *      no row, another request won the token in between, and this caller must
 *      report "too late" rather than "accepted".
 *
 * The claim that the guard is genuinely atomic is a DATABASE claim, so it is
 * proved in `prisma-setup-token-repository.integration.spec.ts` against real
 * PostgreSQL. This file proves only that the use-case honours the guard's
 * contract.
 */
const AT = instant('2026-10-02T09:00:00.000Z');
const ONE_HOUR_MS = 3_600_000;
const USER_ID = 'user-under-test';

function aService(options?: {
  readonly deployment?: SetupTokenDeploymentState;
  readonly expiresAt?: Date | null;
}): {
  readonly service: SetupTokenService;
  readonly repo: FakeSetupTokenRepository;
  readonly clock: FakeClock;
} {
  const clock = new FakeClock(AT);
  const repo = new FakeSetupTokenRepository({
    ...(options?.deployment !== undefined ? { deployment: options.deployment } : {}),
    ...(options?.expiresAt !== undefined ? { expiresAt: options.expiresAt } : {}),
  });
  return { service: new SetupTokenService(repo, clock), repo, clock };
}

describe('SetupTokenService — issuing', () => {
  it('mints through the repository and hands back the plaintext exactly once', async () => {
    const { service } = aService();

    const issued = await service.issue({ userId: USER_ID, ttlMs: ONE_HOUR_MS });

    expect(issued.setupTokenPlaintext).toBeTruthy();
    expect(issued.setupTokenExpiresAt.getTime()).toBe(AT.getTime() + ONE_HOUR_MS);
  });

  it('takes "now" from the injected clock, not from the machine', async () => {
    // If this read ambient time, an expiry test could only be written by
    // sleeping, and the boundary the story cares about would be untestable.
    const { service, repo } = aService();

    await service.issue({ userId: USER_ID, ttlMs: ONE_HOUR_MS });

    expect(repo.issueCalls).toHaveLength(1);
    expect(repo.issueCalls[0]?.now.getTime()).toBe(AT.getTime());
  });

  it('passes the caller TTL through instead of choosing one', async () => {
    // AGENTS.md 2.14: thresholds and windows are school settings, not constants.
    const { service, repo } = aService();

    await service.issue({ userId: USER_ID, ttlMs: 90_000 });

    expect(repo.issueCalls[0]?.ttlMs).toBe(90_000);
  });
});

describe('SetupTokenService — verifying without burning', () => {
  it('accepts a live, unexpired token and names the user', async () => {
    const { service } = aService({ expiresAt: instantAfter(ONE_HOUR_MS, AT) });

    expect(await service.verify('fake-setup-token-1')).toEqual({
      action: 'accept',
      userId: USER_ID,
    });
  });

  it('leaves the token intact, because a failed password check must not burn it', async () => {
    // The acceptance criterion: "a rejected attempt does not burn the school's
    // only way in". The controller validates the password AFTER this call and
    // consumes only once the password is accepted, so verification has to be
    // inert.
    const { service, repo } = aService({ expiresAt: instantAfter(ONE_HOUR_MS, AT) });

    await service.verify('fake-setup-token-1');

    expect(repo.consumeCalls).toHaveLength(0);
    expect(repo.storedHash()).not.toBeNull();
  });

  it('still verifies a token that time has moved past', async () => {
    const { service, clock } = aService({ expiresAt: instantAfter(ONE_HOUR_MS, AT) });
    clock.advance(ONE_HOUR_MS);

    expect((await service.verify('fake-setup-token-1')).action).toBe('reject-invalid');
  });
});

describe('SetupTokenService — consuming', () => {
  it('consumes a live token and accepts the claim', async () => {
    const { service, repo } = aService({ expiresAt: instantAfter(ONE_HOUR_MS, AT) });

    const verdict = await service.consume('fake-setup-token-1');

    expect(verdict).toEqual({ action: 'accept', userId: USER_ID });
    expect(repo.consumeCalls).toHaveLength(1);
    expect(repo.storedHash(), 'consumption is what nulls the hash').toBeNull();
  });

  it('evaluates expiry at claim time, not at issue time', async () => {
    // Issued an hour out, claimed two hours later: the guard must see the
    // clock's NOW, or a token would stay usable for its original window no
    // matter how long the deployment sat unclaimed.
    const { service, repo, clock } = aService({ expiresAt: instantAfter(ONE_HOUR_MS, AT) });
    clock.advance(2 * ONE_HOUR_MS);

    const verdict = await service.consume('fake-setup-token-1');

    expect(verdict.action).toBe('reject-invalid');
    expect(repo.consumeCalls, 'an expired token never reaches the guard').toHaveLength(0);
    expect(repo.storedHash(), 'an expired token is still on the row').not.toBeNull();
  });

  it('reports "too late" when the atomic guard matched no row', async () => {
    // THE concurrency outcome, at the application layer. The guard returned
    // zero rows, which means a concurrent request consumed the token between
    // this caller's inspection and its update. Accepting here is precisely the
    // bug the story calls out.
    const { service, repo } = aService({ expiresAt: instantAfter(ONE_HOUR_MS, AT) });
    repo.refuseNextConsume();

    expect(await service.consume('fake-setup-token-1')).toEqual({ action: 'reject-consumed' });
  });

  it('does not touch the guard for a token that could never be accepted', async () => {
    for (const options of [
      { expiresAt: instantAfter(-1, AT) },
      { deployment: 'no-token-issued' as const },
      { deployment: 'bootstrap-claimed' as const },
    ]) {
      const { service, repo } = aService(options);

      const verdict = await service.consume('fake-setup-token-1');

      expect(verdict.action).not.toBe('accept');
      expect(repo.consumeCalls, 'a refusal must not run the guard').toHaveLength(0);
    }
  });

  it('lets exactly one of two sequential claims win, and never both', async () => {
    // The single-claim invariant, checkable without a database. The real
    // concurrent version lives in the integration spec, because THAT is where
    // the atomicity claim is actually made.
    const { service } = aService({ expiresAt: instantAfter(ONE_HOUR_MS, AT) });

    const first = await service.consume('fake-setup-token-1');
    const second = await service.consume('fake-setup-token-1');

    expect(first.action).toBe('accept');
    expect(second.action).toBe('reject-consumed');
  });
});
