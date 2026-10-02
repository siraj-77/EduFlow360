import argon2 from 'argon2';
import { beforeAll, describe, expect, it } from 'vitest';
import type { HashedPassword, PasswordHashParameters } from '../../domain/ports/password-hasher.js';
import { Argon2PasswordHasher } from './argon2-password-hasher.js';

/**
 * The argon2id hasher, against the real native binding.
 *
 * No fake, and no stub of the crypto. Argon2's whole value is in what the native
 * code does with a cost parameter and a salt, so a suite that replaced it would
 * be asserting that this class forwards to whatever it was given — which is
 * precisely the claim that broke, and is the subject of the third describe
 * block below.
 *
 * The cost parameters here are argon2's own minimum (8 KiB, one pass, one lane)
 * rather than the documented default. Argon2 is deliberately expensive: at
 * 19 MiB × 2 a single hash costs tens of milliseconds and the suite adds up
 * fast, and none of these assertions are about how strong a hash is. The
 * parameters are injected per test precisely so this is possible — which is
 * itself part of what is being tested.
 */

/** Cheap enough to hash hundreds of times, and legal per argon2's own floors. */
const FAST: PasswordHashParameters = { memoryCost: 8, timeCost: 1, parallelism: 1 };

/**
 * Read the algorithm and costs back out of an encoded digest.
 *
 * Written out rather than imported from the adapter, so that asserting on the
 * digest tests the STRING argon2 actually produced and not the adapter's own
 * opinion of it. An assertion that shared the adapter's parser would pass even
 * if the parser were wrong in the same way twice.
 */
function readEncoded(encoded: string): { algorithm: string; costs: Record<string, string> } {
  const [, algorithm, , params] = encoded.split('$');
  const costs: Record<string, string> = {};
  for (const pair of (params ?? '').split(',')) {
    const [key, value] = pair.split('=');
    if (key !== undefined && value !== undefined) costs[key] = value;
  }
  return { algorithm: algorithm ?? '', costs };
}

/** Hash at the given parameters, at argon2's own floors by default. */
function hashAt(
  plaintext: string,
  parameters: PasswordHashParameters = FAST,
): Promise<HashedPassword> {
  return new Argon2PasswordHasher({ currentParameters: parameters }).hash(plaintext, parameters);
}

/**
 * Verify as though `current` were the configured cost for this school.
 *
 * The constructor parameters, not the per-call ones, are what `verify` compares
 * against — see the adapter header for why the port forces that split.
 */
function verifyWith(stored: HashedPassword, current: PasswordHashParameters, plaintext = 'pw') {
  return new Argon2PasswordHasher({ currentParameters: current }).verify(
    plaintext,
    stored.hash,
    stored.algorithm,
  );
}

describe('hashing and verifying', () => {
  const hasher = new Argon2PasswordHasher({ currentParameters: FAST });

  it('verifies a password against the hash it just produced', async () => {
    const stored = await hasher.hash('correct horse battery', FAST);

    expect(await hasher.verify('correct horse battery', stored.hash, stored.algorithm)).toEqual({
      verified: true,
      algorithm: 'argon2id',
      needsRehash: false,
    });
  });

  it('refuses a wrong password', async () => {
    const { hash, algorithm } = await hasher.hash('correct horse battery', FAST);

    expect(await hasher.verify('Correct horse battery', hash, algorithm)).toEqual({
      verified: false,
    });
    expect(await hasher.verify('', hash, algorithm)).toEqual({ verified: false });
    expect(await hasher.verify('correct horse batteryy', hash, algorithm)).toEqual({
      verified: false,
    });
  });

  it('writes argon2id and labels it argon2id', async () => {
    // The label goes in `User.passwordAlgorithm`, so a wrong label is a wrong
    // algorithm in the database rather than a cosmetic error.
    const { hash, algorithm } = await hasher.hash('pw', FAST);

    expect(readEncoded(hash).algorithm).toBe('argon2id');
    expect(algorithm).toBe('argon2id');
  });

  it('salts each hash, so one password is not one digest', async () => {
    // A shared salt across users is one breach away from one rainbow table for
    // the whole school. The salt is left to argon2, which draws it from
    // node:crypto; this asserts the outcome rather than the mechanism.
    const first = await hasher.hash('same password', FAST);
    const second = await hasher.hash('same password', FAST);

    expect(first.hash).not.toBe(second.hash);
    expect(await hasher.verify('same password', first.hash, first.algorithm)).toMatchObject({
      verified: true,
    });
    expect(await hasher.verify('same password', second.hash, second.algorithm)).toMatchObject({
      verified: true,
    });
  });

  it('treats surrounding whitespace in the password as significant', async () => {
    // No trimming anywhere. A login form that trims on one screen and not
    // another would otherwise produce a hash that verifies on neither.
    const { hash, algorithm } = await hasher.hash(' pw ', FAST);

    expect(await hasher.verify(' pw ', hash, algorithm)).toMatchObject({ verified: true });
    expect(await hasher.verify('pw', hash, algorithm)).toEqual({ verified: false });
  });
});

/**
 * The block this suite mostly exists for.
 *
 * node-argon2 SILENTLY IGNORES an option key it does not recognise: measured on
 * 0.45.1, `{ m: 9999999 }` passed alongside the real option names produced a
 * digest at the library default with no error and no warning. An adapter that
 * read `m`/`t`/`p` from settings and passed them through would therefore look
 * like it honoured the configuration, while writing every hash at 64 MiB × 3 —
 * and a test that only asserted "hash then verify" would pass the whole time.
 *
 * So these assert the costs are present IN THE DIGEST, which is the only place
 * the claim is actually checkable.
 */
describe('the injected parameters reach argon2', () => {
  it('writes the memory, passes and lanes it was given', async () => {
    const { hash } = await hashAt('pw', { memoryCost: 1024, timeCost: 2, parallelism: 2 });

    expect(readEncoded(hash).costs).toEqual({ m: '1024', t: '2', p: '2' });
  });

  it('writes DIFFERENT costs for different injected parameters', async () => {
    // The stronger of the two claims. A digest that ignored its input would
    // still satisfy the assertion above whenever the injected value happened to
    // equal the library default; neither of these two equals it, and they differ
    // from each other, so an ignored input cannot produce both.
    const cheap = await hashAt('pw', { memoryCost: 8, timeCost: 1, parallelism: 1 });
    const dearer = await hashAt('pw', { memoryCost: 1024, timeCost: 2, parallelism: 2 });

    expect(readEncoded(cheap.hash).costs).toEqual({ m: '8', t: '1', p: '1' });
    expect(readEncoded(dearer.hash).costs).toEqual({ m: '1024', t: '2', p: '2' });
  });

  it('does not fall back to the library default when given a cheap configuration', async () => {
    // argon2's own defaults are 64 MiB / 3 passes / 4 lanes. A digest at exactly
    // those numbers would mean the injected configuration was discarded — the
    // silent-ignore failure with its mask on.
    const { hash } = await hashAt('pw', FAST);
    const encoded = readEncoded(hash);

    expect(encoded.costs).not.toEqual({ m: '65536', t: '3', p: '4' });
  });

  it('uses the configured parameters as the bar for the rehash decision', async () => {
    const stored = await hashAt('pw', FAST);

    expect(await verifyWith(stored, { memoryCost: 4096, timeCost: 1, parallelism: 1 })).toEqual({
      verified: true,
      algorithm: 'argon2id',
      needsRehash: true,
    });
    expect(await verifyWith(stored, FAST)).toEqual({
      verified: true,
      algorithm: 'argon2id',
      needsRehash: false,
    });
  });
});

describe('verify-and-rehash, which is the migration path', () => {
  it('reports an argon2i hash as needing a rehash rather than accepting it as current', async () => {
    // The case ADR-007's verify-and-rehash exists for: a legacy hash admitted
    // under the reuse whitelist, upgraded on next login with no reset. The
    // library's own needsRehash cannot see this — it destructures `id` and never
    // uses it — which is why the algorithm is read from the digest here.
    const legacy = await argon2.hash('pw', { type: argon2.argon2i, ...FAST });
    const hasher = new Argon2PasswordHasher({ currentParameters: FAST });

    expect(await hasher.verify('pw', legacy, 'argon2i')).toEqual({
      verified: true,
      algorithm: 'argon2i',
      needsRehash: true,
    });
  });

  it('reports an argon2d hash the same way', async () => {
    const legacy = await argon2.hash('pw', { type: argon2.argon2d, ...FAST });
    const hasher = new Argon2PasswordHasher({ currentParameters: FAST });

    expect(await hasher.verify('pw', legacy, 'argon2d')).toEqual({
      verified: true,
      algorithm: 'argon2d',
      needsRehash: true,
    });
  });

  it('asks for a rehash when the stored hash is weaker in ANY one dimension', async () => {
    const stored = await hashAt('pw', { memoryCost: 1024, timeCost: 2, parallelism: 2 });

    for (const current of [
      { memoryCost: 2048, timeCost: 2, parallelism: 2 },
      { memoryCost: 1024, timeCost: 3, parallelism: 2 },
      { memoryCost: 1024, timeCost: 2, parallelism: 4 },
    ]) {
      expect(await verifyWith(stored, current)).toEqual({
        verified: true,
        algorithm: 'argon2id',
        needsRehash: true,
      });
    }
  });

  it('does NOT downgrade a stored hash that is stronger than the current setting', async () => {
    // The reason this adapter does not use argon2.needsRehash, which compares
    // for exact equality and would answer `true` here. A school that lowers its
    // cost while under load would otherwise strip strength from every account
    // that signed in while it was lowered, permanently and invisibly.
    const strong = await hashAt('pw', { memoryCost: 4096, timeCost: 3, parallelism: 4 });

    expect(await verifyWith(strong, FAST)).toEqual({
      verified: true,
      algorithm: 'argon2id',
      needsRehash: false,
    });
  });

  it('trusts the digest over the algorithm column, so a mislabelled row still verifies', async () => {
    const real = await argon2.hash('pw', { type: argon2.argon2i, ...FAST });
    const hasher = new Argon2PasswordHasher({ currentParameters: FAST });

    // The column claims argon2id; the digest is argon2i. The digest is what was
    // actually computed, so it is what is reported — and the hash is queued for
    // upgrade instead of being taken on trust.
    expect(await hasher.verify('pw', real, 'argon2id')).toEqual({
      verified: true,
      algorithm: 'argon2i',
      needsRehash: true,
    });
  });
});

describe('a malformed or tampered stored hash', () => {
  const hasher = new Argon2PasswordHasher({ currentParameters: FAST });
  let genuine = '';

  beforeAll(async () => {
    genuine = (await hasher.hash('pw', FAST)).hash;
  });

  /**
   * Shapes measured to make argon2.verify THROW on 0.45.1, plus two that merely
   * return false, plus two real hashes that were altered. All must produce the
   * same answer, because a throw on the login path becomes a 500 and a 500 is
   * distinguishable from a 401.
   *
   * Built from a function rather than an array of strings so the tampered rows
   * are derived from the hash made in `beforeAll` — an array evaluated at
   * collection time would have sliced an empty string and produced two rows
   * identical to the empty-string row, passing for the wrong reason.
   */
  const MALFORMED: ReadonlyArray<readonly [string, (hash: string) => string]> = [
    ['no leading dollar sign', () => 'not-a-digest'],
    ['an empty string', () => ''],
    ['a payload that decodes to nothing', () => '$argon2id$v=19$m=8,p=1,t=1$tooshort'],
    ['a short salt', () => '$argon2id$v=19$m=8,p=1,t=1$AAAA$BBBB'],
    ['a known algorithm with no parameters', () => '$argon2id$v=19$$$'],
    ['an algorithm argon2 has never heard of', () => '$argon2zz$v=19$m=8,p=1,t=1$c29tZQ$c29tZQ'],
    ['a bcrypt digest, which this adapter cannot read', () => '$2b$12$abcdefghijklmnopqrstuv'],
    ['a bare dollar', () => '$'],
    ['only dollars', () => '$$$$$$'],
    ['a real hash with its last four characters cut', (hash) => hash.slice(0, hash.length - 4)],
    [
      'a real hash with its salt swapped',
      (hash) => hash.replace(/\$[A-Za-z0-9+/=]+\$/, '$ZmFrZXNhbHQ$'),
    ],
    ['a real hash with its digest zeroed', (hash) => hash.replace(/\$[A-Za-z0-9+/=]+$/, '$AAAA')],
  ];

  it.each(MALFORMED)('returns not-verified for %s, and does not throw', async (_label, build) => {
    await expect(hasher.verify('pw', build(genuine), 'argon2id')).resolves.toEqual({
      verified: false,
    });
  });

  it('still verifies the untampered hash, so the rows above are not passing vacuously', async () => {
    // Without this, a `verify` that refused everything would satisfy the whole
    // table above and the suite would call it a pass.
    await expect(hasher.verify('pw', genuine, 'argon2id')).resolves.toMatchObject({
      verified: true,
    });
  });

  it('gives the identical answer for a corrupt hash and a wrong password', async () => {
    // The property the table above exists to protect: an attacker who can write
    // a garbage hash learns nothing from the response, because there is no
    // difference in it to learn.
    const corrupt = await hasher.verify('pw', 'not-a-digest', 'argon2id');
    const wrong = await hasher.verify('not-the-password', genuine, 'argon2id');

    expect(corrupt).toEqual({ verified: false });
    expect(corrupt).toEqual(wrong);
  });

  it('reports no algorithm on failure, so a corrupt row cannot be probed', async () => {
    // A digest that verified but whose algorithm could not be read would report
    // it. Nothing is reported here, which is the whole of the contract.
    const result = await hasher.verify(
      'pw',
      '$argon2zz$v=19$m=8,p=1,t=1$c29tZQ$c29tZQ',
      'argon2id',
    );

    expect(Object.keys(result)).toEqual(['verified']);
  });
});

describe('empty and whitespace-only passwords', () => {
  const hasher = new Argon2PasswordHasher({ currentParameters: FAST });

  it("hashes an empty password, because the policy is not the adapter's to set", async () => {
    const { hash, algorithm } = await hasher.hash('', FAST);

    expect(await hasher.verify('', hash, algorithm)).toEqual({
      verified: true,
      algorithm: 'argon2id',
      needsRehash: false,
    });
  });

  it('hashes a whitespace-only password, and tells it apart from an empty one', async () => {
    // The demonstration that this seam has to be closed by the caller: the
    // adapter can distinguish '   ' from '', but it has no basis on which to
    // refuse either. "Should this account be allowed an empty password" is a
    // policy question belonging to registration and password reset, and a check
    // here would be a second, divergent opinion about it.
    const spaces = await hasher.hash('   ', FAST);
    const empty = await hasher.hash('', FAST);

    expect(spaces.hash).not.toBe(empty.hash);
    expect(await hasher.verify('   ', spaces.hash, spaces.algorithm)).toMatchObject({
      verified: true,
    });
    expect(await hasher.verify('', spaces.hash, spaces.algorithm)).toEqual({ verified: false });
    expect(await hasher.verify('', empty.hash, empty.algorithm)).toMatchObject({ verified: true });
  });
});

describe('secrets do not escape', () => {
  const hasher = new Argon2PasswordHasher({ currentParameters: FAST });
  const SECRET =
    'Tr0ub4dor-and-3-unused-words-much-longer-than-72-bytes-so-a-bcrypt-limit-would-show';

  it('never puts the plaintext in the returned hash', async () => {
    const { hash } = await hasher.hash(SECRET, FAST);

    expect(hash).not.toContain(SECRET);
  });

  it('never puts the plaintext in a verification result', async () => {
    const { hash, algorithm } = await hasher.hash(SECRET, FAST);

    for (const result of [
      await hasher.verify(SECRET, hash, algorithm),
      await hasher.verify('wrong', hash, algorithm),
      await hasher.verify(SECRET, 'not-a-digest', algorithm),
    ]) {
      expect(JSON.stringify(result)).not.toContain(SECRET);
      expect(Object.keys(result).join(',')).not.toContain(SECRET);
    }
  });

  it('does not put the plaintext in an error when the digest is unusable', async () => {
    // A thrown argon2 error reaches a logger and possibly an error response, so
    // the message is treated as an output surface. Measured messages are things
    // like "Memory cost is too small"; this asserts the invariant holds.
    let message = '';
    try {
      await hasher.verify(SECRET, 'not-a-digest', 'argon2id');
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).not.toContain(SECRET);
  });

  it("hashes a password longer than bcrypt's 72-byte limit without complaint", async () => {
    // ADR-007 rejected bcrypt partly because it silently truncates here. The
    // encoded digest must be a real argon2 hash, not a truncated one.
    const { hash, algorithm } = await hasher.hash(SECRET, FAST);

    expect(readEncoded(hash).algorithm).toBe('argon2id');
    expect(await hasher.verify(SECRET, hash, algorithm)).toMatchObject({ verified: true });
    expect(await hasher.verify(SECRET.slice(0, 60), hash, algorithm)).toEqual({ verified: false });
  });
});
