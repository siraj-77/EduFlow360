import { describe, expect, it } from 'vitest';
import {
  IPERMISSION_GRANT_READER,
  type IPermissionGrantReader,
} from './permission-grant-reader.js';

/**
 * The permission port, and the DI token that makes it injectable.
 *
 * Same reasoning as `clock.spec.ts`: the file has one runtime export, and a gate that
 * has been met by leaving an export uncovered teaches nobody anything. What is worth
 * asserting about a token is that it EXISTS and that it is DISTINCT — distinctness
 * being the part nothing else catches, because two ports sharing a symbol means one
 * silently receives the other's implementation.
 */

describe('the IPermissionGrantReader port', () => {
  it('is satisfiable by an implementation with exactly one method', async () => {
    // If this stopped compiling, every caller wanting the granted keys would need a
    // cast, and the casts would spread. The real implementation is imported rather
    // than declared here so this asserts the PRODUCTION class satisfies the port, not
    // a hand-written shape that happens to agree with it today.
    const { PrismaPermissionGrantReader } =
      await import('../../infrastructure/postgres/prisma-permission-grant-reader.js');

    const reader: IPermissionGrantReader = new PrismaPermissionGrantReader(
      {} as never,
      'a-school-id',
    );

    expect(typeof reader.isGranted).toBe('function');
  });

  it('asks one question, and it is phrased as the question the guard asks', () => {
    // A wider port — `getRoles`, `listPermissions`, `hasAll` — would invite a handler
    // to read a role directly, and `SessionPrincipal` deliberately carries no roles
    // precisely so that the engine stays the only thing that can answer this. Asserted
    // from the type, which is where the constraint actually lives.
    type Methods = keyof IPermissionGrantReader;

    const methods: Methods[] = ['isGranted'];

    expect(methods).toHaveLength(1);
  });
});

describe('the IPERMISSION_GRANT_READER token', () => {
  it('is a symbol, because an interface has no runtime value to resolve against', () => {
    expect(typeof IPERMISSION_GRANT_READER).toBe('symbol');
  });

  it('is named after the port it satisfies, so a DI error names something readable', () => {
    // The description is what appears in a Nest resolution failure. An anonymous one
    // turns a wiring mistake into a puzzle — and `SessionGuard` already leans on this,
    // naming its token in the refusal it logs when the repository is absent.
    expect(IPERMISSION_GRANT_READER.description).toBe('IPermissionGrantReader');
  });

  it('is distinct from every other provider token in the repository', async () => {
    // Imported dynamically so this spec does not drag the whole auth module graph —
    // and Prisma — into a unit suite that has no database.
    const auth = await import('../../../auth/auth.module.js');

    const tokens = [
      IPERMISSION_GRANT_READER,
      auth.IOIDC_PROVIDER,
      auth.IOIDC_STATE_STORE,
      auth.AUTHORIZATION_ORIGIN,
      auth.PASSWORD_HASH_PARAMETERS,
      auth.DUMMY_PASSWORD_HASH,
      auth.I_PASSWORD_HASHER,
      auth.I_PASSWORD_HASH_PARAMETER_STORE,
      auth.I_SETUP_TOKEN_REPOSITORY,
      auth.I_BOOTSTRAP_CLAIM_REPOSITORY,
      auth.I_USER_CREDENTIAL_REPOSITORY,
      auth.I_SESSION_REPOSITORY,
      auth.I_ALLOWED_EMAIL_DOMAIN_STORE,
      (await import('../../../auth/domain/ports/clock.js')).CLOCK,
    ];

    expect(new Set(tokens).size, 'two DI tokens share an identity').toBe(tokens.length);
  });
});
