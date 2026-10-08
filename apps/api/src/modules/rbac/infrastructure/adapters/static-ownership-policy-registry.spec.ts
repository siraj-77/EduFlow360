import { describe, expect, it } from 'vitest';
import type { IOwnershipPolicy, OwnershipVerdict } from '../../domain/ports/ownership-policy.js';
import { StaticOwnershipPolicyRegistry } from './static-ownership-policy-registry.js';

/**
 * The registry `PermissionGuard` resolves entity types against.
 *
 * ## What is worth testing here
 *
 * Two properties, both of which are security properties rather than conveniences:
 *
 * 1. **A duplicate claim is refused at construction.** Two policies for one entity type
 *    means one is unreachable, and nothing at runtime would ever say so — every lookup
 *    would succeed and one policy would simply never be consulted.
 * 2. **Lookup is exact and case-sensitive.** A case-folding lookup would turn a typo into a
 *    successful check against the *wrong* rule, which is the one outcome a security control
 *    must never produce by accident.
 */

class StubPolicy implements IOwnershipPolicy {
  readonly entityType: string;

  constructor(
    entityType: string,
    private readonly verdict: OwnershipVerdict = 'OWNED',
  ) {
    this.entityType = entityType;
  }

  async assertOwnership(): Promise<OwnershipVerdict> {
    return this.verdict;
  }
}

describe('StaticOwnershipPolicyRegistry', () => {
  it('resolves a registered policy', async () => {
    const policy = new StubPolicy('class');
    const registry = new StaticOwnershipPolicyRegistry([policy]);

    expect(await registry.find('class')).toBe(policy);
  });

  it('returns undefined for an unregistered type — never a default-deny policy', async () => {
    // Returning a deny-all policy here would make a missing registration indistinguishable
    // from a real policy saying no, and the operator log would name the wrong fault.
    const registry = new StaticOwnershipPolicyRegistry([new StubPolicy('class')]);

    expect(await registry.find('student')).toBeUndefined();
  });

  it('is empty-safe', async () => {
    // The state `RbacModule` actually boots in today, since no school domain has shipped.
    const registry = new StaticOwnershipPolicyRegistry([]);

    expect(await registry.find('class')).toBeUndefined();
    expect(registry.registeredEntityTypes()).toEqual([]);
  });

  describe('exact, case-sensitive lookup', () => {
    it.each([
      ['Student', 'a capital S is a different key'],
      ['STUDENT', 'an upper-case key is a different key'],
      [' student', 'a leading space is a different key'],
      ['student ', 'a trailing space is a different key'],
    ])('does not resolve %j — %s', async (spelling) => {
      const registry = new StaticOwnershipPolicyRegistry([new StubPolicy('student')]);

      expect(await registry.find(spelling)).toBeUndefined();
    });

    it('resolves the exact spelling it was registered with', async () => {
      const policy = new StubPolicy('student');
      const registry = new StaticOwnershipPolicyRegistry([policy]);

      expect(await registry.find('student')).toBe(policy);
    });
  });

  describe('duplicate registration is a boot failure, not a shadowing bug', () => {
    it('refuses two policies claiming the same entity type', () => {
      expect(
        () =>
          new StaticOwnershipPolicyRegistry([
            new StubPolicy('class', 'OWNED'),
            new StubPolicy('class', 'NOT_OWNED'),
          ]),
      ).toThrow(/both claim entityType 'class'/);
    });

    it('names BOTH policies in the error', () => {
      // "One of these two is unreachable" is only actionable if you know which pair.
      expect(
        () =>
          new StaticOwnershipPolicyRegistry([
            new StubPolicy('class', 'OWNED'),
            new StubPolicy('class', 'NOT_OWNED'),
          ]),
      ).toThrow(/StubPolicy and StubPolicy/);
    });

    it('allows two DIFFERENT entity types', () => {
      expect(
        () =>
          new StaticOwnershipPolicyRegistry([new StubPolicy('class'), new StubPolicy('student')]),
      ).not.toThrow();
    });
  });

  describe('registeredEntityTypes', () => {
    it('lists them sorted, so the boot warning can name them', () => {
      const registry = new StaticOwnershipPolicyRegistry([
        new StubPolicy('student'),
        new StubPolicy('class'),
        new StubPolicy('outlet'),
      ]);

      // Sorted because a boot message that changes order between runs is a message nobody
      // can diff.
      expect(registry.registeredEntityTypes()).toEqual(['class', 'outlet', 'student']);
    });
  });
});
