import { describe, expect, it } from 'vitest';
import { OWNS_RESOURCE_KEY, OwnsResource } from './owns-resource.decorator.js';

/**
 * `@OwnsResource` — `PLT-203`.
 *
 * ## The two halves of the contract
 *
 * A decorator that reads like a control is the failure this repository has already paid for
 * once: `@RequirePermission` sat on `GET /auth/oidc/link` for days looking exactly like an
 * implemented control while nothing read it. So this file asserts what the decorator
 * actually does — it records a string in metadata — and the refusal behaviour lives in
 * `decide-ownership.spec.ts` where it can be tested without Nest.
 *
 * The half worth defending hard is the **throw on a blank type**. A route carrying
 * `@OwnsResource('')` looks ownership-scoped, resolves to nothing, and would be refused
 * forever with a diagnosis pointing at the wrong thing — or, if a future change ever
 * treated "blank" as "no resource", would silently run unscoped.
 */

/** Apply the decorator to a throwaway method and read back what it recorded. */
function metadataFor(entityType: string): unknown {
  class Target {
    handler(): void {
      // The decorator's return value is the method it replaced; nothing else is needed here.
    }
  }

  const decorated = OwnsResource(entityType);
  decorated(
    Target.prototype,
    'handler',
    Object.getOwnPropertyDescriptor(Target.prototype, 'handler') as PropertyDescriptor,
  );

  return Reflect.getMetadata(OWNS_RESOURCE_KEY, Target.prototype.handler);
}

describe('OwnsResource', () => {
  it('records the entity type under OWNS_RESOURCE_KEY', () => {
    expect(metadataFor('class')).toBe('class');
  });

  it('trims the type, so a stray space is not a different entity type', () => {
    // Trimming here is safe precisely because `decideOwnershipAccess` ALSO trims before
    // refusing a blank type — trimming twice would put a second opinion on the same
    // decision, so the rule is the only one that decides and the decorator only tidies.
    expect(metadataFor('  class  ')).toBe('class');
  });

  it('does NOT normalise case', () => {
    // `'Class'` and `'class'` are different keys and at most one is registered. Case
    // folding here would silently make a typo resolve against a real policy, which is the
    // one outcome a security control must not produce by accident.
    expect(metadataFor('Class')).toBe('Class');
  });

  it('uses a metadata key nothing else reads', () => {
    // Distinct from PERMISSION_KEY / ENTITLEMENT_KEY / AUDIT_KEY / PUBLIC_ROUTE_KEY. A
    // collision would make an `@OwnsResource` route read as exempt or as permission-gated
    // by a guard that knows nothing about ownership.
    expect(OWNS_RESOURCE_KEY).toBe('eduflow:owns-resource');
  });

  describe('the throw, which is the load-bearing half', () => {
    it.each([
      ['an empty string', ''],
      ['a single space', ' '],
      ['a tab', '\t'],
      ['a newline', '\n'],
    ])('refuses %s at the call site', (_label, entityType) => {
      expect(() => OwnsResource(entityType)).toThrow(/non-empty entity type/);
    });

    it('names AGENTS.md 2.3, so the reader knows which rule they broke', () => {
      expect(() => OwnsResource('')).toThrow(/AGENTS\.md 2\.3/);
    });

    it('says what to use instead', () => {
      // The most useful sentence in the error: most callers reaching for this decorator on
      // a route that owns no record should be using nothing at all.
      expect(() => OwnsResource('')).toThrow(/@RequirePermission alone/);
    });

    it('throws at DECORATION time, so the application cannot boot into it', () => {
      // Not at request time. A decorator that failed on first call would ship.
      expect(() => OwnsResource('')).toThrow();
    });
  });
});
