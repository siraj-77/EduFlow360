import { describe, expect, it } from 'vitest';

import {
  INITIAL_SIGN_IN_STATE,
  SIGN_IN_MESSAGE_KEYS,
  firstInvalidField,
  signInReducer,
  validateCredentials,
  type SignInState,
} from './sign-in-state';
import { classifySignInResponse, networkRefusal } from './sign-in-request';

/**
 * The sign-in state machine.
 *
 * Pure, so the rules can be stated without a browser: a submit clears the
 * previous outcome, editing a field clears ITS error and no other, and a refusal
 * is replaced wholesale rather than merged.
 */
const IDENTIFIER_REQUIRED = SIGN_IN_MESSAGE_KEYS.identifierRequired;
const PASSWORD_REQUIRED = SIGN_IN_MESSAGE_KEYS.passwordRequired;
const REJECTED = SIGN_IN_MESSAGE_KEYS.rejected;

describe('validateCredentials', () => {
  it('requires both fields', () => {
    expect(validateCredentials({ identifier: '', password: '' })).toEqual({
      identifier: IDENTIFIER_REQUIRED,
      password: PASSWORD_REQUIRED,
    });
  });

  it('treats whitespace as an empty identifier', () => {
    expect(validateCredentials({ identifier: '   ', password: 'x' })).toEqual({
      identifier: IDENTIFIER_REQUIRED,
    });
  });

  it('accepts a username as readily as an email', () => {
    // The DTO says the identifier is never required to look like an email. A
    // client-side `type="email"` rule would lock a valid username out.
    for (const identifier of ['amara', 'amara@school.lk', 'a.b+c', '0123456789']) {
      expect(validateCredentials({ identifier, password: 'x' })).toEqual({});
    }
  });

  it('does NOT apply a password policy to a password being presented', () => {
    // `PasswordSignInBody`'s own comment: a policy constrains what a credential
    // may BE, not what may be PRESENTED. An account may predate the policy or
    // have been set by a console procedure, and a client-side minimum would lock
    // such a user out while appearing to help.
    expect(validateCredentials({ identifier: 'a', password: 'x' })).toEqual({});
    expect(validateCredentials({ identifier: 'a', password: ' a-very-long-passphrase ' })).toEqual(
      {},
    );
  });

  it('applies the DTO own transport bounds', () => {
    // 320 and 1024 come from `password-sign-in.dto.ts`. Catching an over-long
    // paste here is cheaper than streaming it into argon2.
    expect(validateCredentials({ identifier: 'a'.repeat(321), password: 'x' })).toEqual({
      identifier: REJECTED,
    });
    expect(validateCredentials({ identifier: 'a', password: 'x'.repeat(1025) })).toEqual({
      password: REJECTED,
    });
    expect(
      validateCredentials({ identifier: 'a'.repeat(320), password: 'x'.repeat(1024) }),
    ).toEqual({});
  });
});

describe('the reducer', () => {
  const refused = (
    state: SignInState,
    refusal: Parameters<typeof signInReducer>[1] extends never
      ? never
      : ReturnType<typeof classifySignInResponse>,
  ) => signInReducer(state, { type: 'refused', refusal });

  it('marks the form busy on submit and drops the previous outcome', () => {
    // Merging would let a stale 401 sit under a fresh 400 and describe a request
    // that was never made.
    const stale = signInReducer(INITIAL_SIGN_IN_STATE, {
      type: 'refused',
      refusal: classifySignInResponse(401, null, null),
    });
    const next = signInReducer(stale, { type: 'submit' });

    expect(next).toEqual({ ...INITIAL_SIGN_IN_STATE, phase: 'submitting' });
    expect(next.formMessageKey).toBeNull();
  });

  it('renders a 401 as the existing translated auth message', () => {
    // Not a `signIn.*` key: `auth.invalidCredentials` already exists, translated,
    // in all four locales, and reusing it is what stops a translator fixing the
    // message in one namespace and not the other.
    expect(refused(INITIAL_SIGN_IN_STATE, classifySignInResponse(401, null, null))).toEqual({
      phase: 'idle',
      fieldErrors: {},
      formMessageKey: 'auth.invalidCredentials',
      retryAfterSeconds: null,
      signedIn: false,
    });
  });

  it('routes a 400 to the fields it named, and says nothing at form level', () => {
    // The message sits next to the control that caused it. A form-wide banner
    // for a single bad field sends a screen-reader user hunting.
    const state = refused(
      INITIAL_SIGN_IN_STATE,
      classifySignInResponse(400, { fields: ['password'] }, null),
    );

    expect(state.fieldErrors).toEqual({ password: REJECTED });
    expect(state.formMessageKey).toBeNull();
  });

  it('says something at form level when a 400 named no field', () => {
    // Otherwise there is nothing on screen to explain the failure.
    const state = refused(INITIAL_SIGN_IN_STATE, classifySignInResponse(400, {}, null));

    expect(state.fieldErrors).toEqual({});
    expect(state.formMessageKey).toBe('signIn.refusals.rejected');
  });

  it('maps every refusal kind to exactly one message', () => {
    expect(
      refused(INITIAL_SIGN_IN_STATE, classifySignInResponse(403, null, null)).formMessageKey,
    ).toBe(SIGN_IN_MESSAGE_KEYS.csrf);
    expect(refused(INITIAL_SIGN_IN_STATE, networkRefusal()).formMessageKey).toBe(
      SIGN_IN_MESSAGE_KEYS.network,
    );
    expect(
      refused(INITIAL_SIGN_IN_STATE, classifySignInResponse(500, null, null)).formMessageKey,
    ).toBe('errors.serverError');
  });

  it('carries the throttled wait next to its message', () => {
    const state = refused(INITIAL_SIGN_IN_STATE, classifySignInResponse(429, null, '7'));

    expect(state.formMessageKey).toBe(SIGN_IN_MESSAGE_KEYS.throttled);
    expect(state.retryAfterSeconds).toBe(7);
  });

  it('clears only the edited field, leaving the others true', () => {
    const both = signInReducer(INITIAL_SIGN_IN_STATE, {
      type: 'invalid',
      fieldErrors: { identifier: IDENTIFIER_REQUIRED, password: PASSWORD_REQUIRED },
    });

    const afterIdentifier = signInReducer(both, { type: 'edit', field: 'identifier' });

    expect(afterIdentifier.fieldErrors.identifier).toBeUndefined();
    // The password is still empty. Clearing that too would tell the user their
    // field is fine when it is not.
    expect(afterIdentifier.fieldErrors.password).toBe(PASSWORD_REQUIRED);
  });

  it('returns the same object when the edited field has no error', () => {
    // Identity, so React bails out of the re-render on every keystroke in a
    // field that is already valid.
    const state = signInReducer(INITIAL_SIGN_IN_STATE, { type: 'edit', field: 'password' });

    expect(state).toBe(INITIAL_SIGN_IN_STATE);
  });

  it('announces success without carrying an error', () => {
    expect(signInReducer(INITIAL_SIGN_IN_STATE, { type: 'succeeded' })).toEqual({
      ...INITIAL_SIGN_IN_STATE,
      signedIn: true,
    });
  });
});

describe('firstInvalidField', () => {
  it('puts the identifier first, because the caret starts there', () => {
    expect(
      firstInvalidField({
        ...INITIAL_SIGN_IN_STATE,
        fieldErrors: { password: 'p', identifier: 'i' },
      }),
    ).toBe('identifier');
  });

  it('finds the password when only it is wrong', () => {
    expect(firstInvalidField({ ...INITIAL_SIGN_IN_STATE, fieldErrors: { password: 'p' } })).toBe(
      'password',
    );
  });

  it('finds nothing when both are fine', () => {
    expect(firstInvalidField(INITIAL_SIGN_IN_STATE)).toBeNull();
  });
});
