import { argon2id, hash as argon2Hash, verify as argon2Verify, type HashOptions } from 'argon2';
import type {
  HashedPassword,
  IPasswordHasher,
  PasswordHashParameters,
  PasswordVerification,
} from '../../domain/ports/password-hasher.js';

/**
 * argon2id, as `IPasswordHasher`.
 *
 * `ADR-007` chose argon2id and chose this port. Nothing here reopens either
 * decision; the file is the mechanical execution of them, and the interesting
 * content is in the three places where the library's behaviour is not what its
 * signature suggests.
 *
 * ## The library's `needsRehash` is not used, and both reasons were measured
 *
 * `argon2.needsRehash` is the obvious tool for the rehash decision and it is
 * wrong for `ADR-007`'s purpose in two independent ways.
 *
 * **It compares cost parameters for exact equality, so it downgrades.** Read at
 * `argon2.cjs` lines 143-160 it returns true when any of `v`/`m`/`t`/`p` differs,
 * in BOTH directions. Measured: a digest written at 64 MiB × 3 against a current
 * configuration of 8 MiB × 1 reports `true`, and a caller that obeyed it would
 * replace a stronger hash with a weaker one on the next successful login. A
 * parameter that is lowered temporarily — on a small VM, during load tests, by
 * a migration — would then silently and permanently weaken every account that
 * logged in while it was lowered. `ADR-007` asks for a rehash when the stored
 * hash is *older or weaker*, which is one-directional, and that comparison is
 * written out below instead.
 *
 * **It cannot see the algorithm at all.** `id` is destructured from the digest
 * and then never used, and the options type has no `type` field to compare it
 * against. Measured: an argon2i digest verified against argon2id options reports
 * `false`. That is precisely the migration `ADR-007` exists to make possible —
 * a legacy bcrypt or argon2i hash admitted under the reuse whitelist, upgraded
 * on login — and this function would report that nothing needs doing. So the
 * algorithm label is read from the encoded digest here, which is why the
 * self-describing encoding matters and why no custom envelope is wrapped around
 * argon2's output.
 *
 * ## The encoded digest is the format, not a wrapper around it
 *
 * `hash` returns argon2's own PHC string —
 * dollar, algorithm id, version, comma-separated parameters, salt, digest — and
 * nothing else. Re-implementing that would add a second format that has to be
 * migrated, and would lose the property that makes the migration work: each
 * hash states the algorithm and cost it was written with, so a stored hash can
 * be classified without a schema change and without a migration project.
 *
 * ## Why `verify` cannot throw
 *
 * `argon2.verify` throws on a malformed digest. Measured against 0.45.1, four
 * distinct failures come out of the deserializer: a digest with no leading
 * dollar sign, an empty string, one whose payload is too short, and one whose
 * payload decodes to nothing. Returning `false` is not optional tidiness here.
 * An exception on the login path becomes a 500, and a 500 is distinguishable
 * from a 401 — which tells an attacker that the stored hash is corrupt rather
 * than that the password was wrong. So the malformed case is caught and
 * collapsed into the same `{ verified: false }` a wrong password produces.
 *
 * The comparison itself is timing-safe because argon2's `verify` ends in
 * `timingSafeEqual` (`argon2.cjs` line 202), which is where `ADR-007`'s
 * timing-safety requirement is discharged. No second comparison is written
 * here: two comparisons, one of them hand-rolled, is how a naive one gets added
 * later and becomes the weaker of the pair.
 *
 * ## Parameters are injected, and the adapter holds no default
 *
 * `hash` takes them per call because the port demands it, and the constructor
 * takes the SAME resolved settings because the port's `verify` has nowhere else
 * to learn what "current" means. That asymmetry is forced by a port this file
 * does not own, and it is a real sharp edge: a caller that passes different
 * parameters to `hash` than it constructed the adapter with gets a rehash
 * decision computed against the constructor's copy. Both must come from the
 * same `resolvePasswordHashParameters` result. Worth revisiting in the port.
 *
 * ## Empty and whitespace-only passwords: the seam, and where it is NOT
 *
 * `hash('')`, `hash('   ')` and everything between are accepted, and this
 * adapter cannot and does not judge them. That is deliberate. "Can this value be
 * hashed" is a question about the function; "may this account be created with
 * this password" is a policy question, and policy belongs in the caller that
 * owns registration and password reset — not in an adapter that is handed a
 * string on a login path and cannot tell an empty password from any other.
 *
 * Putting a length check here would look like hardening and would be a
 * correctness bug twice over: it would make the hasher a partial validation
 * layer whose rules differ from the Zod schema at the DTO boundary, and it
 * would make `verify` unable to check a hash whose password a legacy row
 * genuinely has, locking that user out of their own account with no way to
 * recover. The spec proves both halves — that an empty password hashes and
 * verifies, and that it is distinguishable from whitespace — because the point
 * being made is that the adapter is the wrong place to decide.
 */

/**
 * The label `ADR-007` chose, and the only one this adapter writes.
 *
 * A constant, unlike the cost parameters, because the ALGORITHM is not a
 * deployment concern. `AGENTS.md` §2.14 puts hardware-dependent values in
 * settings; it does not put the choice of memory-hard KDF in a school admin's
 * hands.
 */
const ALGORITHM = 'argon2id';

/**
 * The algorithm variants argon2's `verify` will accept a digest for.
 *
 * Used only to refuse a digest we cannot check, never to decide a rehash. The
 * rehash decision is made from the digest's own id, which is the whole point:
 * an argon2i or argon2d row verifies and is then upgraded, rather than being
 * rejected or silently accepted as current.
 */
const READABLE_ALGORITHMS: ReadonlySet<string> = new Set(['argon2id', 'argon2i', 'argon2d']);

/**
 * `argon2id` as the option `hash` expects, which is the numeric constant.
 *
 * The shipped type declaration is wrong about this. `HashOptions.type` is
 * declared `keyof typeof names`, i.e. the string union
 * 'argon2d' | 'argon2i' | 'argon2id', but `argon2.cjs` line 126 indexes
 * `names[type]`, which needs the NUMBER. Measured on 0.45.1: passing
 * `'argon2id'` throws `id must be a string` from the PHC serialiser, because
 * `names['argon2id']` is undefined. Passing the exported constant produces
 * `$argon2id$…`.
 *
 * So the cast below is not laziness, it is the only spelling that works. It is
 * narrow, it is stated once, and it is deliberate — `AGENTS.md` §8 forbids
 * `@ts-ignore` and `@ts-expect-error`, and this is neither. It should be
 * re-checked when argon2 is next upgraded, because a future version fixing the
 * declaration is the moment this line can be deleted.
 */
const ARGON2ID_TYPE = argon2id as unknown as NonNullable<HashOptions['type']>;

/** The cost fields of a PHC-encoded argon2 digest. */
interface DigestParameters {
  readonly algorithm: string;
  readonly memoryCost?: number;
  readonly timeCost?: number;
  readonly parallelism?: number;
}

/**
 * Read the algorithm and cost out of an encoded digest, or `null`.
 *
 * `null` covers every unreadable shape rather than throwing, because the input
 * is attacker-supplied on the login path. Deliberately tolerant about LENGTHS
 * and deliberately strict about KEYS: a digest whose costs cannot be read is
 * still a digest whose algorithm can be, and refusing to hash 'argon2i' because
 * the parameter segment is odd would turn a migration into a lockout.
 *
 * The cost fields are optional because "the algorithm is argon2i and I could not
 * read its cost" is a real state, and the rehash decision below handles it
 * explicitly instead of guessing.
 */
function readDigest(encoded: string): DigestParameters | null {
  // A PHC string opens with a dollar sign. Checked before splitting so the
  // segment positions below are only read when they mean something.
  if (!encoded.startsWith('$')) return null;

  const parts = encoded.split('$');
  // '', id, version, params, salt, digest — six segments. A shorter string has
  // no parameters and no salt and cannot be a hash argon2 produced.
  if (parts.length < 6) return null;

  const algorithm = parts[1];
  if (algorithm === undefined || algorithm.length === 0) return null;

  // The parameter segment is identified by content, not by position: argon2i
  // digests written at version 0x10 and argon2id digests at 0x13 both put
  // `m=…,t=…,p=…` in the same slot, but scanning for it means a future variant
  // that adds a segment cannot shift the costs into the salt.
  const costs: { memoryCost?: number; timeCost?: number; parallelism?: number } = {};
  for (const segment of parts) {
    if (!segment.startsWith('m=') && !segment.startsWith('t=') && !segment.startsWith('p='))
      continue;
    for (const pair of segment.split(',')) {
      const [key, value] = pair.split('=');
      if (key === undefined || value === undefined) continue;
      const parsed = Number(value);
      // Number('') is 0 and Number('abc') is NaN; neither is a cost argon2 wrote.
      if (!Number.isInteger(parsed)) continue;
      if (key === 'm') costs.memoryCost = parsed;
      if (key === 't') costs.timeCost = parsed;
      if (key === 'p') costs.parallelism = parsed;
    }
  }

  return { algorithm, ...costs };
}

/**
 * Does the stored digest deserve replacing with one at `current`?
 *
 * One-directional by design: older algorithm OR weaker in ANY dimension. A
 * digest that is equal or stronger on all three is left alone, so lowering a
 * school's setting cannot strip cost from hashes that already carry more —
 * which is the failure `argon2.needsRehash` has, described in the header.
 *
 * An unreadable cost is treated as "leave it alone" rather than "rewrite it".
 * Rewriting is the action that can destroy cost, so when the information needed
 * to prove a rewrite is an improvement is missing, the answer is no.
 */
function rehashNeeded(stored: DigestParameters, current: PasswordHashParameters): boolean {
  if (stored.algorithm !== ALGORITHM) return true;

  const { memoryCost, timeCost, parallelism } = stored;
  if (memoryCost === undefined || timeCost === undefined || parallelism === undefined) return false;

  return (
    memoryCost < (current.memoryCost ?? memoryCost) ||
    timeCost < (current.timeCost ?? timeCost) ||
    parallelism < (current.parallelism ?? parallelism)
  );
}

export interface Argon2PasswordHasherConfig {
  /**
   * The cost a NEW hash should be written at, and the bar a stored hash is
   * compared against on verification.
   *
   * Required, with no default in this class: `AGENTS.md` §2.14 forbids
   * thresholds as constants, and a default here would be a cost factor picked on
   * whatever machine the author was using. It is the output of
   * `resolvePasswordHashParameters`, so it is per-school.
   */
  readonly currentParameters: PasswordHashParameters;
}

export class Argon2PasswordHasher implements IPasswordHasher {
  private readonly currentParameters: PasswordHashParameters;

  constructor(config: Argon2PasswordHasherConfig) {
    this.currentParameters = config.currentParameters;
  }

  /**
   * Hash at the parameters the caller resolved for this school.
   *
   * The salt is left to argon2, which generates 16 bytes from `node:crypto`'s
   * `randomBytes` (`argon2.cjs` line 90). Passing one in would be a mistake: a
   * fixed or predictable salt defeats the salt, and `Math.random` is banned
   * outright (`AGENTS.md` §2.4). Two hashes of one password therefore differ,
   * which is asserted in the spec.
   */
  async hash(plaintext: string, parameters: PasswordHashParameters): Promise<HashedPassword> {
    // Option names are node-argon2's, spelled out rather than abbreviated to
    // `m`/`t`/`p`. Measured on 0.45.1: an option key the library does not
    // recognise is SILENTLY IGNORED — `{ m: 9999999 }` beside the real names
    // produced a digest at the library default with no error and no warning. A
    // compact spelling would therefore have looked configured, been ignored, and
    // written every hash at 64 MiB × 3 while the settings row claimed
    // otherwise. The spec reads the encoded costs back out of a digest to prove
    // the names are right, which is the only reason this is not a silent bug.
    const encoded = await argon2Hash(plaintext, {
      type: ARGON2ID_TYPE,
      memoryCost: parameters.memoryCost,
      timeCost: parameters.timeCost,
      parallelism: parameters.parallelism,
    });

    return { hash: encoded, algorithm: ALGORITHM };
  }

  /**
   * Check a password, and report whether the stored hash should be replaced.
   *
   * `_algorithm` is `User.passwordAlgorithm`, and the underscore is the whole
   * point rather than a lint concession. It is unused in this implementation,
   * on purpose: the digest states the algorithm it was actually computed with,
   * and a column that disagrees with the digest it labels is a data fault in the
   * column.
   *
   * Trusting the digest means a mislabelled row still verifies and still gets
   * migrated. Trusting the label instead would let a row claiming argon2id hold
   * an argon2i hash that is then never upgraded — which is the one failure
   * `ADR-007`'s verify-and-rehash exists to prevent, reintroduced through the
   * column. There is a test for exactly this: a digest written as argon2i and
   * labelled argon2id verifies, reports `argon2i`, and asks to be rehashed.
   *
   * It becomes load-bearing the moment a bcrypt reader lands, which is what
   * `ADR-007` anticipates for the legacy reuse whitelist: at that point the
   * label is what selects the reader, and the digest is what the argon2 branch
   * checks itself against.
   */
  async verify(plaintext: string, hash: string, _algorithm: string): Promise<PasswordVerification> {
    const stored = readDigest(hash);
    if (stored === null) return { verified: false };
    if (!READABLE_ALGORITHMS.has(stored.algorithm)) return { verified: false };

    let matches: boolean;
    try {
      matches = await argon2Verify(hash, plaintext);
    } catch {
      // A malformed or truncated digest. Collapsed into the same answer a wrong
      // password gets, so that "the stored hash is corrupt" is not
      // distinguishable from "the password was wrong" — see the header.
      return { verified: false };
    }
    if (!matches) return { verified: false };

    return {
      verified: true,
      algorithm: stored.algorithm,
      needsRehash: rehashNeeded(stored, this.currentParameters),
    };
  }
}
