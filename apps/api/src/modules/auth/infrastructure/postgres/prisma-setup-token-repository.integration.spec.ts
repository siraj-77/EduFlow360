import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeClock } from '../../../../testing/fake-clock.js';
import { instant, instantAfter } from '../../../../testing/instant.js';
import { decideSetupToken } from '../../domain/services/setup-token.js';
import { SetupTokenService } from '../../use-cases/setup-token-service.js';
import { PrismaSetupTokenRepository } from './prisma-setup-token-repository.js';

/**
 * The single-use claim, proved against a real PostgreSQL.
 *
 * This runs here rather than in a unit spec because the claim IS a database
 * claim. "Two concurrent claims cannot both succeed" is not a property of any
 * TypeScript — it is a property of one SQL statement's execution, and a fake
 * repository returns whatever the test tells it to return, so a fake would
 * prove nothing about it.
 *
 * Every assertion goes through the repository or the use-case, never through
 * Prisma directly, because the repository is the thing whose atomicity is in
 * question. Prisma appears only to READ the stored row back, which is a
 * different kind of assertion: that the plaintext is not there.
 */
/**
 * Every test gets its OWN school id, and therefore its own repository.
 *
 * That is not tidiness, it is the story's premise. Option (b) of `PLT-107` is
 * "two columns on the one `INVITED` row" because the first administrator is
 * singular — exactly one bootstrap per database, ever. A single shared school id
 * across this file would put a dozen users in one "deployment", several of them
 * holding setup tokens at once, which is a state the design says cannot exist.
 * It would also make the deployment-state assertions order-dependent: whether a
 * deployment reads as `token-issued` would depend on what some earlier test left
 * on its row.
 *
 * One database per school is also one bootstrap, so a fresh school id per test is
 * the honest way to model a deployment.
 */
const ONE_HOUR_MS = 3_600_000;
const AT = instant('2026-10-02T09:00:00.000Z');

/**
 * The only two answers a caller that did NOT win the token may receive here.
 *
 * Deliberately a set rather than one verdict. `reject-unclaimed` and
 * `reject-consumed` are both refusals; which one a given concurrent caller gets
 * depends on whether its inspection landed before or after the winner's UPDATE
 * committed, and the row cannot distinguish those two moments. See the
 * concurrent-claim test below and `SetupTokenService.consume`.
 */
const REFUSALS_A_LOSER_MAY_RECEIVE: readonly string[] = ['reject-consumed', 'reject-unclaimed'];

let prisma: PrismaClient;

/** A fresh deployment: one school, one `INVITED` user with no credential. */
async function aFreshDeployment(): Promise<{
  userId: string;
  schoolId: string;
  repo: PrismaSetupTokenRepository;
}> {
  const schoolId = randomUUID();
  const userId = (
    await prisma.user.create({
      data: {
        schoolId,
        email: `setup-${randomUUID()}@example.test`,
        username: `setup-${randomUUID()}`,
      },
      select: { id: true },
    })
  ).id;

  return { userId, schoolId, repo: new PrismaSetupTokenRepository(prisma, schoolId) };
}

/** A second `INVITED` account in the same deployment. */
async function anotherUserIn(schoolId: string): Promise<string> {
  return (
    await prisma.user.create({
      data: {
        schoolId,
        email: `second-${randomUUID()}@example.test`,
        username: `second-${randomUUID()}`,
      },
      select: { id: true },
    })
  ).id;
}

/** Mark the bootstrap claimed, as the completion use-case will in its transaction. */
async function markBootstrapClaimed(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } });
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. This suite needs a real PostgreSQL - the claim under ' +
        'test is that consuming a setup token is atomic, and a fake repository cannot ' +
        'demonstrate atomicity.',
    );
  }
  prisma = new PrismaClient();
  await prisma.$connect();
});

afterAll(async () => {
  await prisma?.$disconnect();
});

describe('issuing a setup token', () => {
  it('never stores the token in the clear', async () => {
    // A setup token is an UNAUTHENTICATED route to the administrator account,
    // so a dump containing it in the clear is a dump containing the school's
    // only administrator credential (AGENTS.md 2.13).
    const { userId, repo } = await aFreshDeployment();

    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: AT });

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { setupTokenHash: true },
    });

    expect(stored.setupTokenHash).not.toBe(issued.setupTokenPlaintext);
    expect(stored.setupTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(issued.setupTokenPlaintext).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('puts the expiry on the row at issue-time plus the caller TTL', async () => {
    const { userId, repo } = await aFreshDeployment();

    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: AT });

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { setupTokenExpiresAt: true },
    });
    expect(stored.setupTokenExpiresAt?.getTime()).toBe(issued.setupTokenExpiresAt.getTime());
    expect(stored.setupTokenExpiresAt?.getTime()).toBe(AT.getTime() + ONE_HOUR_MS);
  });

  it('mints a different token every time, so one issued token cannot be guessed from another', async () => {
    const { userId, repo } = await aFreshDeployment();

    const first = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: AT });
    const second = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: AT });

    expect(second.setupTokenPlaintext).not.toBe(first.setupTokenPlaintext);
  });

  it('replaces any token already on the row, leaving exactly one live way in', async () => {
    const { userId, repo } = await aFreshDeployment();
    const first = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: AT });

    await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: AT });

    const presented = await repo.inspect(first.setupTokenPlaintext);
    expect(presented.match, 'the superseded token must not still match').toBeNull();
  });
});

describe('inspecting a setup token', () => {
  it('matches the token it issued, and nothing else', async () => {
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: AT });

    const good = await repo.inspect(issued.setupTokenPlaintext);
    expect(good.match?.userId).toBe(userId);
    expect(good.match?.expiresAt?.getTime()).toBe(issued.setupTokenExpiresAt.getTime());

    const bad = await repo.inspect('never-issued-by-anyone');
    expect(bad.match).toBeNull();
  });

  it('reports an unenrolled deployment as having issued nothing', async () => {
    // The story's 404 case: a deployment that has never been enrolled must not
    // advertise that the endpoint exists.
    const { repo } = await aFreshDeployment();

    const presented = await repo.inspect('never-issued-by-anyone');

    expect(presented.match).toBeNull();
    expect(presented.deployment).toBe('no-token-issued');
    expect(decideSetupToken(presented, AT).action).toBe('reject-unclaimed');
  });

  it('reports a token as issued once one exists, so a wrong token is wrong rather than absent', async () => {
    const { userId, repo } = await aFreshDeployment();
    await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: AT });

    const presented = await repo.inspect('never-issued-by-anyone');

    expect(presented.deployment).toBe('token-issued');
    expect(decideSetupToken(presented, AT).action).toBe('reject-invalid');
  });

  it('reports the bootstrap as claimed once the account holds a credential', async () => {
    // The replay case. Consumption alone cannot be observed — option (b) nulls
    // the hash, which looks identical to "never issued" — so the claimed state
    // is read off the account, exactly as `PLT-107`'s completion use-case will
    // leave it.
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: AT });
    await repo.consume({ setupTokenPlaintext: issued.setupTokenPlaintext, now: AT });
    await markBootstrapClaimed(userId);

    const presented = await repo.inspect(issued.setupTokenPlaintext);

    expect(presented.deployment).toBe('bootstrap-claimed');
    expect(decideSetupToken(presented, AT).action).toBe('reject-consumed');
  });

  it('reports the bootstrap as UNCLAIMED after consumption alone, until the account carries a credential', async () => {
    // The other half of the test above, and the reason that one needs
    // `markBootstrapClaimed` at all.
    //
    // Option (b) spends the token by NULLING the two token columns. So after
    // `consume` and before the completion use-case's transaction commits, this row
    // is BYTE-IDENTICAL to a deployment that was never enrolled: `setupTokenHash`
    // null, `status` INVITED, `passwordHash` null. Nothing in the database tells
    // them apart, so `deploymentState` reports `no-token-issued` and
    // `decideSetupToken` answers `reject-unclaimed`.
    //
    // This is executable rather than commentary on purpose: it is the reason the
    // concurrent-claim test below cannot assert `reject-consumed` for every loser.
    // A loser whose inspection lands after the winner's UPDATE commits is in
    // exactly the state asserted here. No concurrency is needed to reach it — a
    // plain second `consume` call reproduces it every time.
    //
    // The production route is unaffected. `PrismaBootstrapClaimRepository.claim`
    // spends the token and writes the credential in ONE transaction, so a real
    // post-claim reader sees `bootstrap-claimed` and every loser gets 409 — proved
    // over a real socket in `setup-complete-over-http.integration.spec.ts`,
    // "refuses every loser with 409, never with 400 or 404".
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: AT });
    await repo.consume({ setupTokenPlaintext: issued.setupTokenPlaintext, now: AT });

    const presented = await repo.inspect(issued.setupTokenPlaintext);

    expect(presented.match).toBeNull();
    expect(presented.deployment).toBe('no-token-issued');
    expect(decideSetupToken(presented, AT).action).toBe('reject-unclaimed');
  });

  it('still matches an EXPIRED token, because expiry is decided by the rule and not by the query', async () => {
    // If `inspect` filtered on the expiry, an expired token would be
    // indistinguishable from a forgery — which is fine for the verdict but not
    // for this assertion, and more importantly it would put a security decision
    // in a query string, which is what `refresh-token-rotation.ts` exists to
    // avoid.
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: -1000, now: AT });

    const presented = await repo.inspect(issued.setupTokenPlaintext);

    expect(presented.match).not.toBeNull();
    expect(decideSetupToken(presented, AT).action).toBe('reject-invalid');
  });
});

describe('consuming a setup token', () => {
  it('spends the token, clearing both columns', async () => {
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: AT });

    const result = await repo.consume({ setupTokenPlaintext: issued.setupTokenPlaintext, now: AT });

    expect(result.consumed).toBe(true);
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { setupTokenHash: true, setupTokenExpiresAt: true },
    });
    expect(stored.setupTokenHash, 'the hash is what makes it single-use').toBeNull();
    expect(stored.setupTokenExpiresAt).toBeNull();
  });

  it('refuses a second consumption of the same token', async () => {
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: AT });

    const first = await repo.consume({ setupTokenPlaintext: issued.setupTokenPlaintext, now: AT });
    const second = await repo.consume({ setupTokenPlaintext: issued.setupTokenPlaintext, now: AT });

    expect(first.consumed).toBe(true);
    expect(second.consumed).toBe(false);
  });

  it('refuses a token that expired, and leaves the stored hash in place', async () => {
    // The hash stays, deliberately: an expired token is not spent, it merely
    // dead. Clearing it would make "expired" and "already consumed" the same
    // answer, which is the error-shape distinction the story asks for.
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: -1000, now: AT });

    const result = await repo.consume({ setupTokenPlaintext: issued.setupTokenPlaintext, now: AT });

    expect(result.consumed).toBe(false);
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { setupTokenHash: true },
    });
    expect(stored.setupTokenHash).not.toBeNull();
  });

  it('refuses a token whose expiry is exactly now, not only one in the past', async () => {
    // The boundary, against the database rather than against the pure rule: a
    // `gte` in the WHERE clause would let a token live at the exact millisecond
    // it was due to die, and no unit test would see it.
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: 0, now: AT });

    expect(issued.setupTokenExpiresAt.getTime()).toBe(AT.getTime());
    const result = await repo.consume({ setupTokenPlaintext: issued.setupTokenPlaintext, now: AT });

    expect(result.consumed).toBe(false);
  });

  it('refuses a wrong token without touching the live one', async () => {
    // "A rejected attempt does not burn the school's only way in."
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: AT });

    const result = await repo.consume({ setupTokenPlaintext: 'not-the-token', now: AT });

    expect(result.consumed).toBe(false);
    const afterwards = await repo.inspect(issued.setupTokenPlaintext);
    expect(afterwards.match, 'the live token must survive a failed claim').not.toBeNull();
  });

  it('consumes only the row the presented token was issued to', async () => {
    const { userId, schoolId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: AT });
    // A second account in the same deployment, still holding its own token. One
    // database is one bootstrap, so this stands in for the row that must be left
    // alone by a claim aimed at someone else.
    const secondUserId = await anotherUserIn(schoolId);
    await repo.issue({ userId: secondUserId, ttlMs: ONE_HOUR_MS, now: AT });

    const result = await repo.consume({ setupTokenPlaintext: issued.setupTokenPlaintext, now: AT });

    expect(result.consumed).toBe(true);
    const other = await prisma.user.findUniqueOrThrow({
      where: { id: secondUserId },
      select: { setupTokenHash: true },
    });
    expect(other.setupTokenHash, "another account's token must be untouched").not.toBeNull();
  });
});

describe('two concurrent claims for the same token', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // THE acceptance criterion. The story calls this "the case a naive
  // implementation passes and this one must not", and it is why
  // `consume` is one conditional UPDATE whose affected-row count is the verdict
  // rather than a findUnique followed by an update.
  // ═══════════════════════════════════════════════════════════════════════════
  const CONTENDERS = 8;

  it('lets exactly one caller win, at the repository level', async () => {
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: AT });

    // Every claim is dispatched before any of them is awaited, so all N
    // statements are in flight on separate pooled connections at the same time.
    // PostgreSQL takes a row lock for the winner and re-evaluates the WHERE
    // clause against the committed row for the losers, so `setup_token_hash`
    // being NULL is what stops them — not the order they arrived in.
    const results = await Promise.all(
      Array.from({ length: CONTENDERS }, () =>
        repo.consume({ setupTokenPlaintext: issued.setupTokenPlaintext, now: AT }),
      ),
    );

    const winners = results.filter((r) => r.consumed);
    expect(
      winners,
      `${winners.length} of ${CONTENDERS} concurrent claims were accepted`,
    ).toHaveLength(1);
  });

  it('lets exactly one caller win through the whole use-case', async () => {
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: AT });
    const service = new SetupTokenService(repo, new FakeClock(AT));

    const verdicts = await Promise.all(
      Array.from({ length: CONTENDERS }, () => service.consume(issued.setupTokenPlaintext)),
    );

    const accepted = verdicts.filter((v) => v.action === 'accept');
    const refused = verdicts.filter((v) => v.action !== 'accept');

    expect(accepted, 'the story allows exactly one administrator to be created').toHaveLength(1);
    expect(accepted[0]).toEqual({ action: 'accept', userId });
    expect(refused).toHaveLength(CONTENDERS - 1);

    // What holds in EVERY interleaving, and is the security content: a loser is
    // never handed an identity, and is never told the token was forged.
    // `reject-invalid` is the verdict meaning "expired, or never recognised while
    // one is issued" — the one answer forbidden here, because it would confirm to
    // a caller that a setup token existed on this deployment.
    //
    // WHICH of the two remaining refusals a given loser gets is NOT decided here,
    // because it cannot be. `SetupTokenService.consume` writes nothing to the
    // account, so a loser that inspects AFTER the winner's UPDATE has committed
    // finds the row indistinguishable from an unenrolled deployment and is told
    // `reject-unclaimed`; one that inspected before it is told `reject-consumed`.
    // Both are refusals, neither admits anybody, and the earlier version of this
    // assertion — `reject-consumed` for all seven — was asserting something the
    // decided data model cannot deliver. It failed roughly 1 run in 16 under full
    // suite load and never failed in isolation, which is the signature of a
    // timing-dependent half-truth rather than of a broken guard.
    //
    // The `accept` count above is the invariant that matters and it is exact. The
    // mechanism behind the two refusals is asserted deterministically, with no
    // concurrency at all, in "reports the bootstrap as UNCLAIMED after consumption
    // alone, until the account carries a credential".
    for (const loser of refused) {
      expect(Object.keys(loser), 'a loser is never handed a user id').toEqual(['action']);
      expect(REFUSALS_A_LOSER_MAY_RECEIVE).toContain(loser.action);
    }
  });

  it('leaves exactly one row consumed, whatever the interleaving was', async () => {
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: AT });

    await Promise.all(
      Array.from({ length: CONTENDERS }, () =>
        repo.consume({ setupTokenPlaintext: issued.setupTokenPlaintext, now: AT }),
      ),
    );

    const withToken = await prisma.user.count({
      where: { id: userId, setupTokenHash: { not: null } },
    });
    expect(withToken).toBe(0);
  });
});

describe('a claim does not burn the token for a later, legitimate attempt', () => {
  it('still accepts a valid claim after refusals that were not its fault', async () => {
    // The story's "a rejected attempt does not burn the school's only way in",
    // end to end: a burst of wrong guesses, and a token that is still claimable.
    const { userId, repo } = await aFreshDeployment();
    const issued = await repo.issue({ userId, ttlMs: ONE_HOUR_MS, now: AT });
    const clock = new FakeClock(AT);
    const service = new SetupTokenService(repo, clock);

    for (const guess of ['guess-1', 'guess-2', 'guess-3']) {
      expect((await service.consume(guess)).action).not.toBe('accept');
    }

    clock.set(instantAfter(ONE_HOUR_MS / 2, AT));
    expect(await service.consume(issued.setupTokenPlaintext)).toEqual({
      action: 'accept',
      userId,
    });
  });
});
