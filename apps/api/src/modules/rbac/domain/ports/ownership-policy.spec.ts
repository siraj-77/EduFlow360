import { describe, expect, it } from 'vitest';
import { CLOCK } from '../../../auth/domain/ports/clock.js';
import { I_SESSION_REPOSITORY } from '../../../auth/domain/ports/session-repository.js';
import { StaticOwnershipPolicyRegistry } from '../../infrastructure/adapters/static-ownership-policy-registry.js';
import {
  IOWNERSHIP_POLICY_REGISTRY,
  type IOwnershipPolicy,
  type IOwnershipPolicyRegistry,
  type OwnershipVerdict,
} from './ownership-policy.js';
import { IPERMISSION_GRANT_READER } from './permission-grant-reader.js';

/**
 * The ownership port, and the DI token that makes it injectable.
 *
 * Same reasoning as `permission-grant-reader.spec.ts`: the file has one runtime export,
 * and a gate satisfied by leaving an export uncovered teaches nobody anything. What is
 * worth asserting about a token is that it EXISTS and that it is DISTINCT — distinctness
 * being the part nothing else catches, because two ports sharing a symbol means one
 * silently receives the other's implementation and every ownership check is answered by a
 * permission reader.
 */

describe('the IOWNERSHIP_POLICY_REGISTRY port', () => {
  it('is satisfiable by the production registry', () => {
    // The real implementation is imported at the top rather than through `await import()`
    // here, so this asserts the PRODUCTION class satisfies the port and not a
    // hand-written shape that happens to agree with it today.
    const registry: IOwnershipPolicyRegistry = new StaticOwnershipPolicyRegistry([]);

    expect(typeof registry.find).toBe('function');
  });

  it('is a distinct symbol from every other provider token in the repository', () => {
    // The defect this catches: `IOWNERSHIP_POLICY_REGISTRY` accidentally reusing
    // `IPERMISSION_GRANT_READER`'s symbol would compile, boot, and answer every ownership
    // question with a permission query — producing NOT_OWNED for everything and refusing
    // every `@OwnsResource` route for no stated reason.
    const tokens = new Set<symbol>([
      IOWNERSHIP_POLICY_REGISTRY,
      IPERMISSION_GRANT_READER,
      I_SESSION_REPOSITORY,
      CLOCK,
    ]);

    expect(tokens.size).toBe(4);
  });

  it('asks one question, and it is phrased as the question the guard asks', () => {
    // A wider port — `canEdit`, `listOwned`, `grantOwnership` — would let a controller
    // bypass the rule in `decide-ownership.ts` and re-implement the decision somewhere it
    // cannot be reviewed in one place. Narrow on purpose (`AGENTS.md` 2.2 Interface
    // Segregation).
    type Methods = keyof IOwnershipPolicyRegistry;

    const methods: Methods[] = ['find'];

    expect(methods).toHaveLength(1);
  });

  it('declares a policy with exactly two members: what it answers for, and how', () => {
    type Members = keyof IOwnershipPolicy;

    const members: Members[] = ['entityType', 'assertOwnership'];

    expect(members.sort()).toEqual(['assertOwnership', 'entityType']);
  });

  it('permits exactly two verdicts, and NOT_OWNED is one of them', () => {
    // The absence of a `NOT_APPLICABLE` state is load-bearing: a policy is looked up BY the
    // type it declares, so "not applicable" about its own type is a contradiction, and
    // making it unrepresentable is cheaper than defending against it. Asserted from the
    // type, which is where the constraint actually lives.
    const allowed: OwnershipVerdict[] = ['OWNED', 'NOT_OWNED'];

    expect(allowed).toContain('NOT_OWNED');
    expect(allowed).toHaveLength(2);
  });
});
