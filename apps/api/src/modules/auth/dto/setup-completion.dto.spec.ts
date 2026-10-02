import { describe, expect, it } from 'vitest';
import { SetupCompletionBody } from './setup-completion.dto.js';

/**
 * The body of `POST /auth/setup/complete`.
 *
 * ## The important property is what this schema REFUSES to accept
 *
 * `.strict()`, so an unknown key is a 400 rather than a silently ignored field.
 * On this route in particular that matters more than usual: a client that posts
 * `{ token, password, isAdmin: true }` and receives 200 has been told its extra
 * field was understood, and a future maintainer reading that has been told the
 * body shape is open. Unknown input on an unauthenticated write is exactly where
 * "we will add it later" quietly becomes a bypass.
 *
 * ## Why the transport bounds are looser than the password policy
 *
 * `password` accepts up to 1024 characters here and the policy then refuses
 * anything over `PASSWORD_MAX_LENGTH`. The two are different jobs: this bound is
 * a guard on the request BODY, so a caller cannot stream megabytes into a route
 * that will refuse them anyway; the policy bound is the security rule. Collapsing
 * them would make the DTO the security policy, which `argon2-password-hasher.ts`
 * argues against at length: "Can this value be hashed" is a question about the
 * function, "may this account be created with this password" is a policy question
 * and belongs in the rule that can be tested on its own.
 */
describe('the token', () => {
  it('is required and non-empty', () => {
    expect(SetupCompletionBody.safeParse({ password: 'a-long-enough-password' }).success).toBe(
      false,
    );
    expect(
      SetupCompletionBody.safeParse({ token: '', password: 'a-long-enough-password' }).success,
    ).toBe(false);
  });

  it('is bounded, so the body cannot be used to push megabytes through the route', () => {
    expect(
      SetupCompletionBody.safeParse({ token: 'x'.repeat(4096), password: 'a-long-enough-password' })
        .success,
    ).toBe(false);
  });
});

describe('the password', () => {
  it('is required', () => {
    expect(SetupCompletionBody.safeParse({ token: 'a-token' }).success).toBe(false);
  });

  it('is bounded above the policy ceiling, not at it', () => {
    // 200 characters: over the policy's 128, so the POLICY must be what refuses it
    // rather than this schema. Asserting the boundary here would make the two
    // indistinguishable and quietly move a security rule into a DTO.
    expect(
      SetupCompletionBody.safeParse({ token: 'a-token', password: 'x'.repeat(200) }).success,
    ).toBe(true);
  });

  it('is not length-checked here at all, so a six-character value reaches the policy', () => {
    expect(SetupCompletionBody.safeParse({ token: 'a-token', password: 'short' }).success).toBe(
      true,
    );
  });
});

describe('the optional login identifiers', () => {
  it('are optional, because the token already identifies exactly one account', () => {
    expect(
      SetupCompletionBody.safeParse({ token: 'a-token', password: 'long-enough-here' }).success,
    ).toBe(true);
  });

  it('accepts an email that looks like one', () => {
    expect(
      SetupCompletionBody.safeParse({
        token: 'a-token',
        password: 'long-enough-here',
        email: 'principal@school.test',
      }).success,
    ).toBe(true);
  });

  it('refuses an email that does not, rather than writing it to the row', () => {
    // The row's `email` is unique and NOT NULL and is a login identifier. Writing a
    // malformed value would create an account nobody can sign in to.
    expect(
      SetupCompletionBody.safeParse({
        token: 'a-token',
        password: 'long-enough-here',
        email: 'not-an-email',
      }).success,
    ).toBe(false);
  });

  it('accepts a username alone, without an email', () => {
    expect(
      SetupCompletionBody.safeParse({
        token: 'a-token',
        password: 'long-enough-here',
        username: 'principal',
      }).success,
    ).toBe(true);
  });

  it('refuses an empty username, which would collide with nothing and identify nobody', () => {
    expect(
      SetupCompletionBody.safeParse({
        token: 'a-token',
        password: 'long-enough-here',
        username: '',
      }).success,
    ).toBe(false);
  });
});

describe('the schema as a whole', () => {
  it('refuses an unknown key, rather than ignoring it', () => {
    expect(
      SetupCompletionBody.safeParse({
        token: 'a-token',
        password: 'long-enough-here',
        mustChangePassword: false,
      }).success,
    ).toBe(false);
  });

  it.each([
    { label: 'a string', body: 'a string' },
    { label: 'null', body: null },
    { label: 'an array', body: ['a-token', 'long-enough-here'] },
    { label: 'a number', body: 42 },
  ])('refuses $label as a body', ({ body }) => {
    expect(SetupCompletionBody.safeParse(body).success).toBe(false);
  });
});
