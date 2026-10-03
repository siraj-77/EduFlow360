import { describe, expect, it, vi } from 'vitest';
import {
  decidePermissionAccess,
  type PermissionDecision,
  type PermissionRequirement,
} from './decide-permission.js';

/**
 * The permission rule.
 *
 * ## Why the rule OWNS the lookup rather than being handed its answer
 *
 * The first version of this took `granted?: boolean` and made the guard call the
 * reader before consulting it. That is correct only if the guard checks every
 * precondition first, and a guard that forgets is a guard that puts a database round
 * trip in front of a `@Public` route — where no principal exists and none is needed.
 *
 * So the lookup is a **function the rule calls**, not a value the rule reads. Two
 * properties follow structurally instead of by convention:
 *
 * - the reader cannot be consulted before every precondition has passed, and
 * - it cannot be consulted twice, or not at all when it must be.
 *
 * Both are asserted below by counting invocations, which is the only honest way to
 * test "was the database touched".
 *
 * ## The property under test is FAIL CLOSED
 *
 * Every refusal row is a way the answer could accidentally become "allowed". There
 * is exactly one way to be allowed that is not a `@Public` route: hold the grant,
 * having presented a principal, on a route naming a non-blank key, with a reader
 * actually wired and actually answering yes.
 */

const GRANTED: PermissionRequirement = { kind: 'permission', key: 'AUTH_LINK_EXTERNAL_IDENTITY' };
const PUBLIC: PermissionRequirement = { kind: 'public' };
const UNMARKED: PermissionRequirement = { kind: 'unmarked' };

/** The one shape that is allowed and is not a public route. */
const everythingSatisfied = {
  requirement: GRANTED,
  hasPrincipal: true,
  lookup: async (): Promise<boolean> => true,
} as const;

const decide = (input: Parameters<typeof decidePermissionAccess>[0]): Promise<PermissionDecision> =>
  decidePermissionAccess(input);

/** A lookup that answers `answer` and records that it was called. */
const aLookup = (answer: boolean) => {
  const calls: string[] = [];
  return {
    calls,
    lookup: async (key: string): Promise<boolean> => {
      calls.push(key);
      return answer;
    },
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// Allowed.
// ═══════════════════════════════════════════════════════════════════════════
describe('decidePermissionAccess — allowed', () => {
  it('allows a principal whose role grants the named permission', async () => {
    expect(await decide(everythingSatisfied)).toEqual({ allowed: true });
  });

  it('passes the ROUTE-SHOWN key to the lookup, never one of its own', async () => {
    // If the rule looked the key up from anywhere but the metadata, a route could be
    // gated on something other than what it declares.
    const { calls, lookup } = aLookup(true);

    await decide({ ...everythingSatisfied, lookup });

    expect(calls).toEqual(['AUTH_LINK_EXTERNAL_IDENTITY']);
  });

  it('allows a @Public route without a principal, a reader, or a lookup', async () => {
    // The exemption has to be total. A public route is reachable before a session
    // exists, so demanding any of these would make sign-in impossible — and the
    // failure would look like a broken route rather than a broken guard.
    const decision = await decide({ requirement: PUBLIC, hasPrincipal: false });

    expect(decision.allowed).toBe(true);
  });

  it('allows a @Public route even when the caller DOES hold grants', async () => {
    // Sign-in while signed in. The exemption is about the route, not the caller.
    const { calls, lookup } = aLookup(true);

    const decision = await decide({ requirement: PUBLIC, hasPrincipal: true, lookup });

    expect(decision.allowed).toBe(true);
    expect(calls).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Refused. Each row is a way the guard could fall through to "allowed".
// ═══════════════════════════════════════════════════════════════════════════
describe('decidePermissionAccess — refused, and never by falling through', () => {
  it('refuses a route that names neither a permission nor @Public', async () => {
    // The rule AGENTS.md 2.3 calls a defect. `check-route-guards` fails the build on
    // it, but a static check and a runtime check are different instruments: this is
    // the one that holds for a file the checker never scanned. Reading "no
    // requirement" as "no check" is fail-OPEN, and this is where that would live.
    const decision = await decide({ ...everythingSatisfied, requirement: UNMARKED });

    expect(decision).toEqual({ allowed: false, reason: 'NO_PERMISSION_REQUIRED' });
  });

  it('refuses an unmarked route even when a principal and a live lookup are present', async () => {
    // Stated separately because it is the seductive case: everything else looks
    // permissive, so a rule written as "deny only when not granted" would allow it.
    const { calls, lookup } = aLookup(true);

    const decision = await decide({ ...everythingSatisfied, requirement: UNMARKED, lookup });

    expect(decision.allowed).toBe(false);
    expect(calls).toEqual([]);
  });

  it.each([
    { case: 'an empty key', key: '' },
    { case: 'a whitespace-only key', key: '   ' },
    { case: 'a key that is only a tab', key: '\t' },
  ])('refuses $case, because a blank key checks for nothing', async ({ key }) => {
    // `@RequirePermission` already refuses a blank key at the call site, so this is
    // unreachable through the decorator. It is here because metadata can also be set
    // by other means, and a guard that trusted the decorator to have validated it
    // would be trusting a convention rather than a check.
    const decision = await decide({
      ...everythingSatisfied,
      requirement: { kind: 'permission', key },
    });

    expect(decision).toEqual({ allowed: false, reason: 'BLANK_PERMISSION_KEY' });
  });

  it('refuses when there is no principal, without touching the reader', async () => {
    // In a correctly wired application `SessionGuard` has already refused, so this is
    // a WIRING fault rather than a user error. It still refuses.
    const { calls, lookup } = aLookup(true);

    const decision = await decide({ ...everythingSatisfied, hasPrincipal: false, lookup });

    expect(decision).toEqual({ allowed: false, reason: 'NO_PRINCIPAL' });
    expect(calls).toEqual([]);
  });

  it('refuses when no reader is wired, rather than calling that "no grant"', async () => {
    // A Google-only deployment registers no database and therefore no reader. The
    // honest answer is "we cannot evaluate this"; both "no" and "yes" would be a lie.
    const decision = await decide({ requirement: GRANTED, hasPrincipal: true });

    expect(decision).toEqual({ allowed: false, reason: 'NO_GRANT_READER' });
  });

  it('refuses when the roles do not grant the key', async () => {
    const decision = await decide({ ...everythingSatisfied, lookup: aLookup(false).lookup });

    expect(decision).toEqual({ allowed: false, reason: 'NOT_GRANTED' });
  });

  it.each([
    { case: 'a reader answering undefined', answer: undefined },
    { case: 'a reader answering null', answer: null },
    { case: 'a reader answering the string "true"', answer: 'true' },
    { case: 'a reader answering 1', answer: 1 },
  ])('refuses $case, because only a real boolean true is a grant', async ({ answer }) => {
    // `=== true`, not truthiness. A reader that returned a truthy non-boolean is
    // either a broken adapter or a compromised one, and neither should be able to
    // open a route by accident.
    const decision = await decide({
      ...everythingSatisfied,
      lookup: async (): Promise<never> => answer as never,
    });

    expect(decision).toEqual({ allowed: false, reason: 'NOT_GRANTED' });
  });

  it('consults the reader exactly once', async () => {
    // Two lookups would be two chances for the answer to differ, and one wasted round
    // trip on every permitted request.
    const { calls, lookup } = aLookup(true);

    await decide({ ...everythingSatisfied, lookup });

    expect(calls).toHaveLength(1);
  });

  it('lets a reader failure propagate, because an outage is not a permission decision', async () => {
    // A 500 rather than a 403. Folding a database error into `false` would hide an
    // outage behind a refusal that reads like policy — and an operator would go
    // looking at a role instead of at the database.
    const boom = new Error('the database is not answering');

    await expect(
      decide({
        ...everythingSatisfied,
        lookup: async (): Promise<never> => {
          throw boom;
        },
      }),
    ).rejects.toBe(boom);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Ordering, because the reasons are what an operator reads.
// ═══════════════════════════════════════════════════════════════════════════
describe('decidePermissionAccess — which refusal is reported', () => {
  it('names the missing marker before the missing principal', async () => {
    // An unmarked route is a defect in the source. An operator reading "no principal"
    // would go looking at the cookie, and the cookie is fine.
    const decision = await decide({
      requirement: UNMARKED,
      hasPrincipal: false,
      lookup: aLookup(true).lookup,
    });

    expect(decision).toEqual({ allowed: false, reason: 'NO_PERMISSION_REQUIRED' });
  });

  it('names the blank key before the missing principal', async () => {
    const decision = await decide({
      requirement: { kind: 'permission', key: '' },
      hasPrincipal: false,
      lookup: aLookup(true).lookup,
    });

    expect(decision).toEqual({ allowed: false, reason: 'BLANK_PERMISSION_KEY' });
  });

  it('names the missing principal before the missing reader', async () => {
    // Both are wiring faults, and the principal is the one closer to the request: it
    // is what the guard running immediately before this one would have supplied.
    const decision = await decide({ requirement: GRANTED, hasPrincipal: false });

    expect(decision).toEqual({ allowed: false, reason: 'NO_PRINCIPAL' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The invariant the whole file exists to protect.
// ═══════════════════════════════════════════════════════════════════════════
describe('decidePermissionAccess — the exhaustive table', () => {
  it('allows ONLY the public route and the fully-satisfied grant', async () => {
    // Every combination of every input, checked against the one rule that matters:
    // `allowed` is true if and only if the route is public, or every precondition is
    // satisfied AND the lookup positively confirmed. Nothing else may allow.
    const requirements: readonly PermissionRequirement[] = [PUBLIC, GRANTED, UNMARKED];
    const booleans = [true, false] as const;
    const answers = [true, false] as const;

    const allowedCombinations: string[] = [];
    const consultedWhenAllowed: string[] = [];

    for (const requirement of requirements) {
      for (const hasPrincipal of booleans) {
        for (const readerWired of booleans) {
          for (const answer of answers) {
            const { calls, lookup } = aLookup(answer);
            const input = {
              requirement,
              hasPrincipal,
              ...(readerWired ? { lookup } : {}),
            };

            const label = JSON.stringify({ requirement, hasPrincipal, readerWired, answer });
            if ((await decidePermissionAccess(input)).allowed) {
              allowedCombinations.push(label);
              consultedWhenAllowed.push(`${label} called ${calls.length}x`);
            }
          }
        }
      }
    }

    // 8 public combinations (2 hasPrincipal x 2 readerWired x 2 answers), plus 1.
    expect(allowedCombinations).toHaveLength(8 + 1);
    expect(allowedCombinations.filter((c) => c.includes('"kind":"public"'))).toHaveLength(8);
    expect(allowedCombinations.filter((c) => c.includes('"kind":"permission"'))).toEqual([
      JSON.stringify({
        requirement: GRANTED,
        hasPrincipal: true,
        readerWired: true,
        answer: true,
      }),
    ]);
    // And the reader was consulted for exactly the one non-public allow, once.
    expect(consultedWhenAllowed.filter((c) => !c.includes('"kind":"public"'))).toEqual([
      `${JSON.stringify({
        requirement: GRANTED,
        hasPrincipal: true,
        readerWired: true,
        answer: true,
      })} called 1x`,
    ]);
  });

  it('never consults the reader for a public route, in any combination', async () => {
    // The regression this shape exists to prevent: a database round trip in front of
    // `GET /auth/oidc/redirect`, on a route a browser reaches before signing in.
    const lookup = vi.fn(async (): Promise<boolean> => true);

    for (const hasPrincipal of [true, false]) {
      await decidePermissionAccess({ requirement: PUBLIC, hasPrincipal, lookup });
    }

    expect(lookup).not.toHaveBeenCalled();
  });
});
