import { describe, expect, it } from 'vitest';
import { I_EXTERNAL_IDENTITY_REPOSITORY } from './external-identity-repository.js';
import { I_SESSION_REPOSITORY } from './session-repository.js';
import { CLOCK } from './clock.js';
import { I_ALLOWED_EMAIL_DOMAIN_STORE } from '../../../settings/domain/ports/allowed-email-domain-store.js';

/**
 * `IExternalIdentityRepository` — the port nothing implemented until the OIDC callback.
 *
 * ## Why a spec for a file with almost no behaviour
 *
 * Two reasons, and the second is the real one.
 *
 * 1. `AGENTS.md` 4 makes coverage a gate. The `domain/**` tier is measured in *lines*,
 *    and this file has a runtime export (the DI token), so an untested one is an
 *    uncovered line in a tier that is already the tightest in the repository.
 * 2. A port is where the **rules about identifiers** are written down, and the rules
 *    are the security content. `subject` is the only lookup key; `providerEmail` is a
 *    snapshot. That claim is asserted here against the TYPE, because the type is the
 *    thing a future contributor reads — and a comment that a later edit can delete is
 *    not a control.
 */
describe('I_EXTERNAL_IDENTITY_REPOSITORY', () => {
  it('is a symbol, because an interface has no runtime value to resolve against', () => {
    expect(typeof I_EXTERNAL_IDENTITY_REPOSITORY).toBe('symbol');
  });

  it('is named after the port it satisfies, so a DI error names something readable', () => {
    // The string is what appears in a Nest resolution failure. An anonymous or
    // empty description turns a wiring mistake into a puzzle — the same reason
    // `clock.spec.ts` asserts `CLOCK.description`.
    expect(I_EXTERNAL_IDENTITY_REPOSITORY.description).toBe('IExternalIdentityRepository');
  });

  it('is distinct from every other provider token', () => {
    // Distinctness is the part that matters and the part nothing else catches: two
    // ports accidentally sharing a symbol means one silently receives the other's
    // implementation.
    const tokens = [
      I_EXTERNAL_IDENTITY_REPOSITORY,
      I_SESSION_REPOSITORY,
      I_ALLOWED_EMAIL_DOMAIN_STORE,
      CLOCK,
    ];

    expect(new Set(tokens).size, 'two DI tokens share an identity').toBe(tokens.length);
  });
});

describe('the identity key, as the port types it', () => {
  it('is the provider subject, and the port has no way to look an identity up by email', () => {
    // This is the load-bearing structural claim (`AGENTS.md` 2.13). `providerEmail`
    // is stored, deliberately non-unique, and must never be a lookup key: two
    // unrelated people can share an address, and signing one of them in as the
    // other attaches the wrong family's children to an account.
    //
    // Asserted as the ABSENCE of a parameter rather than the presence of a
    // prohibition, because a prohibition in a comment is prose and an absent
    // parameter is a compile error.
    const repository = {
      findBySubject: async (_provider: string, _subject: string) => null,
    } as unknown as IExternalIdentityRepositoryShape;

    expect(Object.keys(repository)).toEqual(['findBySubject']);
    expect(repository.findBySubject.length).toBe(2);
  });

  it('takes the email as a snapshot on link, and never asks to find by it', () => {
    // `link` receives the provider's address because a human will read it on a
    // "connected accounts" screen. What it must not do is make it authoritative.
    const repository = {
      findBySubject: async (_provider: string, _subject: string) => null,
      link: async (_params: unknown) => ({ outcome: 'linked' }),
    } as unknown as IExternalIdentityRepositoryShape;

    expect(Object.keys(repository)).toEqual(['findBySubject', 'link']);
  });
});

/**
 * The port's method names, read off a literal object rather than imported types.
 *
 * A structural stand-in rather than an import so the assertions above are about the
 * SHAPE the port commits to. Importing the real interface and reflecting on it would
 * prove TypeScript erased the types, which is true and says nothing.
 */
interface IExternalIdentityRepositoryShape {
  findBySubject(provider: string, subject: string): Promise<unknown>;
  link?(params: unknown): Promise<unknown>;
}
