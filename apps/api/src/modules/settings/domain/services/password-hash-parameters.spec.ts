import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PASSWORD_HASH_PARAMETERS,
  PASSWORD_HASH_PARAMETER_CEILINGS,
  resolvePasswordHashParameters,
} from './password-hash-parameters.js';

/**
 * The cost-parameter resolution rule, as tables.
 *
 * The rule has one job and a surprising number of ways to get it wrong, so it is
 * table-driven per `AGENTS.md` §4.1. Every bound asserted here was MEASURED
 * against `argon2@0.45.1` rather than read off a specification, and the two that
 * are ours rather than argon2's are marked as such in the row.
 *
 * The property that matters most is the last table: a value that reaches the
 * native library unvalidated does not always produce an error. `timeCost: -1`
 * was measured and it does not throw — it does not return either, which is a
 * wedged login path and not a slow one.
 */

const DEFAULT = DEFAULT_PASSWORD_HASH_PARAMETERS as {
  memoryCost: number;
  timeCost: number;
  parallelism: number;
};

/** Configurations a school may legitimately choose, honoured verbatim. */
const HONOURED: ReadonlyArray<readonly [string, unknown]> = [
  ['the documented default, spelled out', { memoryCost: 19456, timeCost: 2, parallelism: 1 }],
  // Below the OWASP default on purpose. A modest VM needs a cost it can serve,
  // and clamping a school UP would defeat the reason this is configurable at all.
  ['a deliberately cheap configuration', { memoryCost: 8192, timeCost: 1, parallelism: 1 }],
  ["argon2's own minimum memory", { memoryCost: 8, timeCost: 1, parallelism: 1 }],
  ['more than one lane', { memoryCost: 256, timeCost: 1, parallelism: 4 }],
  ['exactly eight times the lanes, the boundary', { memoryCost: 32, timeCost: 1, parallelism: 4 }],
  [
    'the memory ceiling exactly',
    { memoryCost: PASSWORD_HASH_PARAMETER_CEILINGS.memoryCost, timeCost: 1, parallelism: 1 },
  ],
  [
    'the pass ceiling exactly',
    { memoryCost: 256, timeCost: PASSWORD_HASH_PARAMETER_CEILINGS.timeCost, parallelism: 1 },
  ],
];

/**
 * Values that must be replaced, what the result becomes, and which keys the
 * caller is told about.
 *
 * The expected parameters are written out per row rather than asserted as "the
 * default", because a bad value in ONE key must not discard the two that are
 * good. A school that chose a sensible memory and mistyped the pass count keeps
 * its memory; substituting all three would silently retune a decision it made
 * correctly.
 *
 * `replaced` is in RESOLUTION order — lanes first, then memory, then passes —
 * because memory's floor depends on the lane count. That order is the
 * implementation's and this table pins it, since a stable order is the only
 * thing that makes the list usable in a log line.
 */
const REPLACED: ReadonlyArray<
  readonly [
    string,
    unknown,
    { memoryCost: number; timeCost: number; parallelism: number },
    readonly string[],
  ]
> = [
  ['nothing configured at all', null, DEFAULT, ['parallelism', 'memoryCost', 'timeCost']],
  ['undefined', undefined, DEFAULT, ['parallelism', 'memoryCost', 'timeCost']],
  ['an empty object', {}, DEFAULT, ['parallelism', 'memoryCost', 'timeCost']],
  // Measured failures: "Memory cost is too small", "Time cost is too small",
  // "Too few lanes", "Parallelism is too large".
  [
    "memory below argon2's floor of 8",
    { memoryCost: 7, timeCost: 2, parallelism: 1 },
    { memoryCost: 19456, timeCost: 2, parallelism: 1 },
    ['memoryCost'],
  ],
  // 31 KiB over 4 lanes: one below the eight-per-lane floor, measured as
  // rejected while 32 is accepted. The sharpest boundary in the whole rule.
  [
    'memory one below eight times the lanes',
    { memoryCost: 31, timeCost: 1, parallelism: 4 },
    { memoryCost: 19456, timeCost: 1, parallelism: 4 },
    ['memoryCost'],
  ],
  [
    'memory of zero',
    { memoryCost: 0, timeCost: 2, parallelism: 1 },
    { memoryCost: 19456, timeCost: 2, parallelism: 1 },
    ['memoryCost'],
  ],
  // Only the pass count is bad here, so the memory the school chose survives.
  [
    'zero passes, memory left alone',
    { memoryCost: 8192, timeCost: 0, parallelism: 1 },
    { memoryCost: 8192, timeCost: 2, parallelism: 1 },
    ['timeCost'],
  ],
  // The measured wedge. Negative passes do not error; the call never returns.
  [
    'negative passes',
    { memoryCost: 8192, timeCost: -1, parallelism: 1 },
    { memoryCost: 8192, timeCost: 2, parallelism: 1 },
    ['timeCost'],
  ],
  [
    'zero lanes',
    { memoryCost: 8192, timeCost: 2, parallelism: 0 },
    { memoryCost: 8192, timeCost: 2, parallelism: 1 },
    ['parallelism'],
  ],
  [
    'negative lanes',
    { memoryCost: 8192, timeCost: 2, parallelism: -1 },
    { memoryCost: 8192, timeCost: 2, parallelism: 1 },
    ['parallelism'],
  ],
  // Lanes above 2^24 are refused as "Parallelism is too large". Memory is then
  // judged against the SUBSTITUTED lane count, so 8192 stays usable.
  [
    'lanes above 2^24',
    { memoryCost: 8192, timeCost: 2, parallelism: 16777216 },
    { memoryCost: 8192, timeCost: 2, parallelism: 1 },
    ['parallelism'],
  ],
  // Measured: accepted, and written into the digest as `t=1.5`. A fractional
  // pass count round-trips cleanly enough to look valid later, so it is refused.
  [
    'a fractional pass count',
    { memoryCost: 8192, timeCost: 1.5, parallelism: 1 },
    { memoryCost: 8192, timeCost: 2, parallelism: 1 },
    ['timeCost'],
  ],
  [
    'a numeric string',
    { memoryCost: '8192', timeCost: 2, parallelism: 1 },
    { memoryCost: 19456, timeCost: 2, parallelism: 1 },
    ['memoryCost'],
  ],
  [
    'a boolean',
    { memoryCost: true, timeCost: 2, parallelism: 1 },
    { memoryCost: 19456, timeCost: 2, parallelism: 1 },
    ['memoryCost'],
  ],
  [
    'null in place of a number',
    { memoryCost: null, timeCost: 2, parallelism: 1 },
    { memoryCost: 19456, timeCost: 2, parallelism: 1 },
    ['memoryCost'],
  ],
  // `Json` constrains nothing, so these are real states rather than theoretical
  // ones — the same cost the email-domain column already records.
  ['an array', [8192, 2, 1], DEFAULT, ['parallelism', 'memoryCost', 'timeCost']],
  ['a bare number', 8192, DEFAULT, ['parallelism', 'memoryCost', 'timeCost']],
  ['a bare string', 'm=8192,t=2,p=1', DEFAULT, ['parallelism', 'memoryCost', 'timeCost']],
  [
    'one key missing',
    { memoryCost: 8192, timeCost: 2 },
    { memoryCost: 8192, timeCost: 2, parallelism: 1 },
    ['parallelism'],
  ],
  // Ours, not argon2's. A ceiling exists because a fat-fingered settings value
  // otherwise becomes an outage rather than a slow login.
  [
    'memory above the ceiling',
    { memoryCost: PASSWORD_HASH_PARAMETER_CEILINGS.memoryCost + 1, timeCost: 2, parallelism: 1 },
    { memoryCost: 19456, timeCost: 2, parallelism: 1 },
    ['memoryCost'],
  ],
  [
    'passes above the ceiling',
    { memoryCost: 8192, timeCost: PASSWORD_HASH_PARAMETER_CEILINGS.timeCost + 1, parallelism: 1 },
    { memoryCost: 8192, timeCost: 2, parallelism: 1 },
    ['timeCost'],
  ],
  [
    'NaN',
    { memoryCost: Number.NaN, timeCost: 2, parallelism: 1 },
    { memoryCost: 19456, timeCost: 2, parallelism: 1 },
    ['memoryCost'],
  ],
  [
    'Infinity',
    { memoryCost: 8192, timeCost: Number.POSITIVE_INFINITY, parallelism: 1 },
    { memoryCost: 8192, timeCost: 2, parallelism: 1 },
    ['timeCost'],
  ],
];

describe('a school that configured usable parameters', () => {
  it.each(HONOURED)('honours %j', (_label, stored) => {
    const resolution = resolvePasswordHashParameters(stored);

    expect(resolution.parameters).toEqual(stored as Record<string, number>);
    expect(resolution.origin).toBe('configured');
    expect(resolution.replaced).toEqual([]);
  });

  it('recomputes the memory floor from the configured lane count', () => {
    // 24 KiB over 4 lanes is refused by the native library ("Memory cost is too
    // small") while 8 KiB over 1 lane is accepted. A floor that ignored the
    // lane count would let the first through and turn a setting into a 500.
    expect(
      resolvePasswordHashParameters({ memoryCost: 24, timeCost: 1, parallelism: 4 }).origin,
    ).toBe('default');
    expect(
      resolvePasswordHashParameters({ memoryCost: 8, timeCost: 1, parallelism: 1 }).origin,
    ).toBe('configured');
  });

  it('ignores keys it does not know rather than failing on them', () => {
    // A settings blob shared with a future algorithm must not break today's
    // resolution. Unknown keys are simply not read.
    const resolution = resolvePasswordHashParameters({
      memoryCost: 8192,
      timeCost: 2,
      parallelism: 1,
      hashLength: 64,
      version: 19,
    });

    expect(resolution.parameters).toEqual({ memoryCost: 8192, timeCost: 2, parallelism: 1 });
    expect(resolution.origin).toBe('configured');
  });
});

describe('a school that configured nothing usable', () => {
  it.each(REPLACED)('replaces the bad values in %j', (_label, stored, expected, replaced) => {
    const resolution = resolvePasswordHashParameters(stored);

    expect(resolution.parameters).toEqual(expected);
    expect(resolution.origin).toBe('default');
    expect(resolution.replaced).toEqual(replaced);
  });

  it('always returns a complete set, never a partial one', () => {
    // The hasher takes one parameter object and passes it straight through, so a
    // missing key here would become argon2's own default — silently, and at
    // 64 MiB, which is the outcome §2.14 exists to prevent.
    for (const stored of [null, {}, { memoryCost: 8192 }, { timeCost: 2 }, { parallelism: 1 }]) {
      expect(Object.keys(resolvePasswordHashParameters(stored).parameters).sort()).toEqual([
        'memoryCost',
        'parallelism',
        'timeCost',
      ]);
    }
  });

  it('substitutes the bad lane count first, then judges memory against it', () => {
    // With parallelism replaced by 1, a memory of 16 over 4 requested lanes
    // becomes usable. Judging memory against the REQUESTED lanes would report a
    // replacement the library would not have complained about, and would hide
    // that the lane count itself was wrong.
    const resolution = resolvePasswordHashParameters({
      memoryCost: 16,
      timeCost: 1,
      parallelism: 0,
    });

    expect(resolution.replaced).toEqual(['parallelism']);
    expect(resolution.parameters.parallelism).toBe(1);
    expect(resolution.parameters.memoryCost).toBe(16);
  });
});

describe('the default itself', () => {
  it('is frozen, so nothing can widen it in place at runtime', () => {
    expect(Object.isFrozen(DEFAULT_PASSWORD_HASH_PARAMETERS)).toBe(true);
  });

  it('sits inside every bound the rule enforces', () => {
    // A default the rule would reject is worse than no default: the rule would
    // replace it with itself, forever, and the failure would look like a no-op.
    const resolution = resolvePasswordHashParameters(DEFAULT_PASSWORD_HASH_PARAMETERS);

    expect(resolution.origin).toBe('configured');
    expect(resolution.replaced).toEqual([]);
  });

  it("is weaker than a hash written at argon2's own memory floor times more passes", () => {
    // Not a rule — a reminder of what the number means. The default is a
    // published recommendation, so a deployment should log in faster and weaker
    // than this before anything else.
    const resolution = resolvePasswordHashParameters(DEFAULT_PASSWORD_HASH_PARAMETERS);
    expect(resolution.parameters.memoryCost).toBeGreaterThan(8);
  });
});
