import { describe, expect, it } from 'vitest';
import {
  decideOwnershipAccess,
  type OwnershipDecision,
  type OwnershipFacts,
  type OwnershipRequirement,
  type OwnershipVerdict,
} from './decide-ownership.js';

/**
 * The ownership rule — `PLT-203`.
 *
 * ## The property under test is FAIL CLOSED, exactly as `decide-permission.spec.ts` is
 *
 * A permission answers "may this ROLE do this?". Ownership answers "may this USER touch
 * THIS RECORD?". The second question is the one that stops a teacher editing another
 * teacher's class, and it is the question `PermissionGuard` could not ask before this
 * file existed — so every refusal row below is a way the answer could accidentally
 * become "allowed".
 *
 * There is exactly **one** way to be allowed: the route named a resource, a policy was
 * found for that resource's type, and that policy positively confirmed ownership.
 *
 * ## The refusal that matters most is NO_POLICY_FOR_ENTITY
 *
 * A route declares `@OwnsResource('student')` and nobody registered a student policy.
 * The intuitive answer is "no policy, no check, allow" — and it is an authentication
 * bypass, because the route *said* it was ownership-scoped and the engine silently did
 * not scope it. `NO_POLICY_FOR_ENTITY` refuses, and it is classed as a wiring fault so an
 * operator is sent to the module registry rather than to a role.
 *
 * ## Why the rule OWNS the lookup, for the same reason decidePermissionAccess does
 *
 * The policy arrives as a **function this rule calls**. Otherwise a caller could consult
 * the policy before the cheap preconditions, putting a lookup in front of every route that
 * has no resource at all. Both properties are asserted below by counting invocations.
 */

const RESOURCE: OwnershipRequirement = { kind: 'resource', entityType: 'student' };
const UNSCOPED: OwnershipRequirement = { kind: 'unscoped' };

/** The one shape that is allowed, and it is not an unscoped route. */
const everythingSatisfied = {
  requirement: RESOURCE,
  hasPrincipal: true,
  resolve: () => Promise.resolve({ verdict: 'OWNED' } as const),
} as const;

/** A counting resolver, so "was the policy consulted?" is answerable rather than assumed. */
function countingResolver(verdict: OwnershipVerdict): {
  resolve: OwnershipFacts['resolve'];
  calls: () => number;
} {
  let calls = 0;
  return {
    resolve: () => {
      calls += 1;
      return Promise.resolve({ verdict } as const);
    },
    calls: () => calls,
  };
}

describe('decideOwnershipAccess', () => {
  describe('the refusals — every one a way the answer could become "allowed"', () => {
    it('refuses when no principal is attached', async () => {
      const policy = countingResolver('OWNED');
      const decision = await decideOwnershipAccess({
        requirement: RESOURCE,
        hasPrincipal: false,
        resolve: policy.resolve,
      });
      expect(decision).toEqual({ allowed: false, reason: 'NO_PRINCIPAL' });
      expect(policy.calls()).toBe(0);
    });

    it('refuses when no policy registry is wired', async () => {
      const decision = await decideOwnershipAccess({
        requirement: RESOURCE,
        hasPrincipal: true,
        resolve: undefined,
      });
      expect(decision).toEqual({ allowed: false, reason: 'NO_POLICY_REGISTRY' });
    });

    it('refuses when a resource is named but no policy exists for its type', async () => {
      const decision = await decideOwnershipAccess({
        requirement: RESOURCE,
        hasPrincipal: true,
        resolve: () => Promise.resolve(undefined),
      });
      expect(decision).toEqual({ allowed: false, reason: 'NO_POLICY_FOR_ENTITY' });
    });

    it('refuses a blank entity type rather than looking it up', async () => {
      const policy = countingResolver('OWNED');
      const decision = await decideOwnershipAccess({
        requirement: { kind: 'resource', entityType: '   ' },
        hasPrincipal: true,
        resolve: policy.resolve,
      });
      expect(decision).toEqual({ allowed: false, reason: 'BLANK_ENTITY_TYPE' });
      expect(policy.calls()).toBe(0);
    });

    it('refuses when the policy says the caller does not own the record', async () => {
      const decision = await decideOwnershipAccess({
        requirement: RESOURCE,
        hasPrincipal: true,
        resolve: () => Promise.resolve({ verdict: 'NOT_OWNED' }),
      });
      expect(decision).toEqual({ allowed: false, reason: 'RESOURCE_NOT_OWNED' });
    });

    it('refuses any verdict that is not exactly OWNED — a truthy verdict must not open a record', async () => {
      // A policy is third-party code from the guard's point of view. Its answer arrives
      // wrapped as `{ verdict }`, so a policy returning `undefined`, a string, a number or
      // a differently-shaped object must not read as ownership.
      //
      // Note what is deliberately NOT in this list: a bare `undefined`. That is the
      // resolver's "no policy is registered for this type" signal, so it is a *wiring*
      // outcome (`NO_POLICY_FOR_ENTITY`) and is covered by its own test above. Conflating
      // the two would make a missing module indistinguishable from a policy saying no —
      // the exact confusion `OwnershipResolution` exists to prevent.
      for (const bogus of [
        undefined,
        null,
        'owned',
        'Owned',
        'NOT_OWNED',
        'NOT_APPLICABLE',
        '',
        ' ',
        1,
        0,
        true,
        false,
        { owned: true },
        { verdict: 'owned' },
        { verdict: 'NOT_APPLICABLE' },
        { verdict: null },
        [],
      ] as unknown[]) {
        const decision = await decideOwnershipAccess({
          requirement: RESOURCE,
          hasPrincipal: true,
          resolve: () => Promise.resolve({ verdict: bogus } as OwnershipVerdict),
        });
        expect(decision).toEqual({ allowed: false, reason: 'RESOURCE_NOT_OWNED' });
      }
    });
  });

  describe('the single allowance', () => {
    it('allows a route that carries no resource at all', async () => {
      const policy = countingResolver('OWNED');
      const decision = await decideOwnershipAccess({
        requirement: UNSCOPED,
        hasPrincipal: false,
        resolve: policy.resolve,
      });
      expect(decision).toEqual({ allowed: true });
      // An unscoped route must not reach a policy — otherwise every route in the
      // application carries a lookup it does not need.
      expect(policy.calls()).toBe(0);
    });

    it('allows an owned resource', async () => {
      const policy = countingResolver('OWNED');
      const decision = await decideOwnershipAccess({
        requirement: RESOURCE,
        hasPrincipal: true,
        resolve: policy.resolve,
      });
      expect(decision).toEqual({ allowed: true });
      expect(policy.calls()).toBe(1);
    });
  });

  describe('invocation discipline — the same property decidePermissionAccess has', () => {
    it('consults the policy exactly once per request', async () => {
      const policy = countingResolver('OWNED');
      await decideOwnershipAccess({
        requirement: RESOURCE,
        hasPrincipal: true,
        resolve: policy.resolve,
      });
      expect(policy.calls()).toBe(1);
    });

    it.each([
      ['no principal', { hasPrincipal: false }, 'NO_PRINCIPAL'],
      ['no registry', { resolve: undefined }, 'NO_POLICY_REGISTRY'],
      [
        'no such entity type',
        { resolve: () => Promise.resolve(undefined) },
        'NO_POLICY_FOR_ENTITY',
      ],
      [
        'a blank entity type',
        { requirement: { kind: 'resource', entityType: '' } },
        'BLANK_ENTITY_TYPE',
      ],
    ] satisfies ReadonlyArray<readonly [string, Partial<OwnershipFacts>, string]>)(
      'never consults a policy when %s',
      async (_label, override, expectedReason) => {
        const policy = countingResolver('OWNED');
        const decision = await decideOwnershipAccess({
          requirement: RESOURCE,
          hasPrincipal: true,
          resolve: policy.resolve,
          ...override,
        });
        expect(decision).toEqual({ allowed: false, reason: expectedReason });
        expect(policy.calls()).toBe(0);
      },
    );
  });

  describe('errors are not answers', () => {
    it('propagates a policy failure rather than folding it into a refusal', async () => {
      // Mirrors decidePermissionAccess: an outage is not an ownership decision, and
      // turning one into a 403 would hide it behind a refusal that reads like policy.
      await expect(
        decideOwnershipAccess({
          requirement: RESOURCE,
          hasPrincipal: true,
          resolve: () => Promise.reject(new Error('policy store unreachable')),
        }),
      ).rejects.toThrow('policy store unreachable');
    });
  });

  describe('the table, so a new denial reason cannot be added unnoticed', () => {
    const table: ReadonlyArray<readonly [string, OwnershipFacts, OwnershipDecision]> = [
      [
        'unscoped route',
        { requirement: UNSCOPED, hasPrincipal: false, resolve: undefined },
        { allowed: true },
      ],
      ['owned student', everythingSatisfied, { allowed: true }],
      [
        'student not owned',
        {
          requirement: RESOURCE,
          hasPrincipal: true,
          resolve: () => Promise.resolve({ verdict: 'NOT_OWNED' }),
        },
        { allowed: false, reason: 'RESOURCE_NOT_OWNED' },
      ],
      [
        'unregistered entity type',
        {
          requirement: { kind: 'resource', entityType: 'outlet' },
          hasPrincipal: true,
          resolve: () => Promise.resolve(undefined),
        },
        { allowed: false, reason: 'NO_POLICY_FOR_ENTITY' },
      ],
      [
        'policy store missing',
        { requirement: RESOURCE, hasPrincipal: true, resolve: undefined },
        { allowed: false, reason: 'NO_POLICY_REGISTRY' },
      ],
      [
        'no principal',
        {
          requirement: RESOURCE,
          hasPrincipal: false,
          resolve: () => Promise.resolve({ verdict: 'OWNED' }),
        },
        { allowed: false, reason: 'NO_PRINCIPAL' },
      ],
      [
        'blank entity type',
        {
          requirement: { kind: 'resource', entityType: ' ' },
          hasPrincipal: true,
          resolve: () => Promise.resolve({ verdict: 'OWNED' }),
        },
        { allowed: false, reason: 'BLANK_ENTITY_TYPE' },
      ],
    ];

    it.each(table)('%s', async (_label, facts, expected) => {
      expect(await decideOwnershipAccess(facts)).toEqual(expected);
    });
  });
});
