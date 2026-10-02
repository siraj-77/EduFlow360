import { describe, expect, it } from 'vitest';
import { PasswordSignInBody } from './password-sign-in.dto.js';

/**
 * The body of `POST /auth/login`.
 *
 * ## One schema, one identifier, two accepted spellings — and that is the point
 *
 * `PLT-101` is "Email/Username + Password", so the field is `identifier` and the
 * repository decides whether it named an email or a username. Two fields
 * (`email?`, `username?`) would be worse: a caller who sends both would need a rule
 * for which wins, and a caller who sends the wrong one would get a different
 * answer than a caller who sent the right one — which is a small enumeration oracle
 * for free.
 *
 * ## Why the shape of a REFUSAL carries nothing account-dependent
 *
 * Every failure below is a property of the request, never of whether an account
 * exists. That is what lets the controller answer 400 for a malformed body and 401
 * for a wrong password without the difference leaking anything: a caller who
 * already knows the field is wrong learns nothing about any account from being told
 * so.
 */
describe('the identifier', () => {
  it('is required and non-empty', () => {
    expect(PasswordSignInBody.safeParse({ password: 'a-long-enough-password' }).success).toBe(
      false,
    );
    expect(PasswordSignInBody.safeParse({ identifier: '', password: 'x'.repeat(12) }).success).toBe(
      false,
    );
  });

  it('is not required to look like an email', () => {
    // A username is equally valid, so requiring email shape would refuse half the
    // accounts this route exists to serve.
    expect(
      PasswordSignInBody.safeParse({ identifier: 'principal', password: 'x'.repeat(12) }).success,
    ).toBe(true);
  });

  it('is bounded, so a megabyte-long identifier cannot be pushed through', () => {
    expect(
      PasswordSignInBody.safeParse({ identifier: 'x'.repeat(4096), password: 'x'.repeat(12) })
        .success,
    ).toBe(false);
  });
});

describe('the password', () => {
  it('is required', () => {
    expect(PasswordSignInBody.safeParse({ identifier: 'principal@school.test' }).success).toBe(
      false,
    );
  });

  it('is NOT length-checked here, because the policy has nothing to say on login', async () => {
    // A one-character password is perfectly legitimate at the LOGIN boundary: it
    // only had to satisfy the policy when it was SET, and an account may predate
    // the policy. Refusing short values at this DTO would lock such an account out
    // of its own sign-in and teach nobody anything.
    expect(PasswordSignInBody.safeParse({ identifier: 'principal', password: 'a' }).success).toBe(
      true,
    );
  });

  it('is bounded for transport, well above anything a policy would allow', () => {
    expect(
      PasswordSignInBody.safeParse({ identifier: 'principal', password: 'x'.repeat(1025) }).success,
    ).toBe(false);
  });
});

describe('the schema as a whole', () => {
  it('refuses an unknown key, rather than ignoring it', () => {
    // On a credential route an ignored field is a silent contract violation: a
    // client posting `{ identifier, password, skipLockout: true }` would be told
    // nothing and would reasonably believe it worked.
    expect(
      PasswordSignInBody.safeParse({
        identifier: 'principal',
        password: 'x'.repeat(12),
        admin: true,
      }).success,
    ).toBe(false);
  });

  it.each([
    { label: 'a string', body: 'a string' },
    { label: 'null', body: null },
    { label: 'an array', body: ['principal', 'x'.repeat(12)] },
    { label: 'a number', body: 7 },
  ])('refuses $label as a body', ({ body }) => {
    expect(PasswordSignInBody.safeParse(body).success).toBe(false);
  });
});
