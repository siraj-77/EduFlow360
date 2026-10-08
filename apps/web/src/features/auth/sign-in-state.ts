import type { CredentialField, SignInRefusal } from './sign-in-request';

/**
 * The sign-in state machine, as a pure reducer.
 *
 * ## Why the transitions live here and not in the component
 *
 * Three properties of this screen are easy to state and easy to lose:
 *
 *   1. A submit is not sent twice.
 *   2. A field error survives until the field is edited, and disappears when it
 *      is - but not while the user is still typing in it.
 *   3. A refusal is replaced wholesale, never merged, so two failures cannot
 *      stack into a message that describes neither.
 *
 * Each is a transition rule rather than a rendering concern, and a rendering
 * concern cannot be tested without a browser. So the rules are here, the fetch is
 * in the hook, and the component only draws.
 *
 * ## Messages are stored as KEYS, never as text
 *
 * A locale switch is a navigation in this app (`/en/sign-in` to `/ta/sign-in`),
 * so the locale is fixed for the lifetime of this state - which means a message
 * captured as text could never be wrong about its language, and capturing it as a
 * key costs nothing. It is still the key, because the alternative is a component
 * that has to be handed a translator to build an error, and the next three auth
 * screens would each re-invent that.
 */

/** Translation keys under `signIn` this screen produces. */
export const SIGN_IN_MESSAGE_KEYS = {
  identifierRequired: 'signIn.validation.identifierRequired',
  passwordRequired: 'signIn.validation.passwordRequired',
  rejected: 'signIn.validation.rejected',
  csrf: 'signIn.refusals.csrf',
  network: 'signIn.refusals.network',
  throttled: 'signIn.refusals.throttled',
} as const;

export type SignInFieldErrors = Readonly<Partial<Record<CredentialField, string>>>;

export type SignInPhase = 'idle' | 'submitting';

export interface SignInState {
  readonly phase: SignInPhase;
  /**
   * Per-field message keys.
   *
   * A client-side validation failure and a server-named field both land here, so
   * an error is always drawn next to the control that caused it rather than in a
   * single banner at the bottom.
   */
  readonly fieldErrors: SignInFieldErrors;
  /**
   * A message key for something that is not one field's fault, or `null`.
   *
   * Never both "there is a form message" and "a field is invalid" for the same
   * refusal: a 400 names its fields and goes to `fieldErrors`, and everything
   * else goes here.
   */
  readonly formMessageKey: string | null;
  /** Present only when `formMessageKey` is the throttled message. */
  readonly retryAfterSeconds: number | null;
  /** Set on success, purely so the live region can say something before navigating. */
  readonly signedIn: boolean;
}

export const INITIAL_SIGN_IN_STATE: SignInState = {
  phase: 'idle',
  fieldErrors: {},
  formMessageKey: null,
  retryAfterSeconds: null,
  signedIn: false,
};

export type SignInAction =
  | { readonly type: 'submit' }
  | { readonly type: 'invalid'; readonly fieldErrors: SignInFieldErrors }
  | { readonly type: 'refused'; readonly refusal: SignInRefusal }
  | { readonly type: 'succeeded' }
  | { readonly type: 'edit'; readonly field: CredentialField };

/**
 * Which refusal goes in the field column and which goes in the form column.
 *
 * The split is by CAUSE, not by convenience. A 400 names the fields the API would
 * not accept, so it belongs beside them. A 401 and a 429 are about the attempt,
 * not about a value, so they belong in one place above the button.
 */
function refusedFieldErrors(refusal: SignInRefusal): SignInFieldErrors {
  const errors: Record<string, string> = {};

  for (const field of refusal.fields) {
    errors[field] = SIGN_IN_MESSAGE_KEYS.rejected;
  }

  return errors as SignInFieldErrors;
}

function refusedFormMessage(refusal: SignInRefusal): string | null {
  switch (refusal.kind) {
    case 'credentials':
      // `auth.invalidCredentials`, not a `signIn.*` key: the API answers a
      // refused sign-in with ONE message for every cause and that string already
      // exists, translated, in all four locales. Reusing it is what keeps a
      // translator from fixing the message in one namespace and not the other.
      return 'auth.invalidCredentials';
    case 'throttled':
      return SIGN_IN_MESSAGE_KEYS.throttled;
    case 'csrf':
      return SIGN_IN_MESSAGE_KEYS.csrf;
    case 'network':
      return SIGN_IN_MESSAGE_KEYS.network;
    case 'rejected':
      // Already spoken for by the field errors, if it named any. A 400 that
      // named none has nothing to point at, so it is worth saying here too.
      return refusal.fields.length > 0 ? null : 'signIn.refusals.rejected';
    case 'unexpected':
      return 'errors.serverError';
  }
}

export function signInReducer(state: SignInState, action: SignInAction): SignInState {
  switch (action.type) {
    case 'submit':
      // A new attempt clears the previous outcome entirely. Merging would let a
      // stale 401 sit under a fresh 400 and describe a request that was never
      // made.
      return { ...INITIAL_SIGN_IN_STATE, phase: 'submitting' };

    case 'invalid':
      return {
        ...state,
        phase: 'idle',
        fieldErrors: action.fieldErrors,
        formMessageKey: null,
        retryAfterSeconds: null,
      };

    case 'refused':
      return {
        phase: 'idle',
        fieldErrors: refusedFieldErrors(action.refusal),
        formMessageKey: refusedFormMessage(action.refusal),
        retryAfterSeconds: action.refusal.retryAfterSeconds,
        signedIn: false,
      };

    case 'succeeded':
      return { ...INITIAL_SIGN_IN_STATE, signedIn: true };

    case 'edit':
      // Editing a field clears ITS error only. The other field's error is still
      // true, and a form-wide message is still true, so neither is touched.
      if (state.fieldErrors[action.field] === undefined) return state;

      return {
        ...state,
        fieldErrors: { ...state.fieldErrors, [action.field]: undefined },
      };
  }
}

/**
 * Client-side validation.
 *
 * Presence only, and that is a decision rather than an omission.
 *
 * `PasswordSignInBody` sets `password: z.string().min(1)` and its own file
 * comment explains why there is no length or composition rule on this route: a
 * policy constrains what a credential may BE, not what may be PRESENTED. An
 * account may predate the policy or have been set by a console procedure, and a
 * client-side `minLength` would lock such a user out of signing in while
 * appearing to help. Inventing a minimum here would also be inventing a
 * requirement - `AGENTS.md` 6 requires a gap to stay visible.
 *
 * The upper bounds are the DTO's own transport guards (320 and 1024), asserted
 * here so an over-long paste is caught before it reaches argon2 rather than
 * after.
 */
export function validateCredentials(credentials: {
  readonly identifier: string;
  readonly password: string;
}): SignInFieldErrors {
  const errors: Record<string, string> = {};

  if (credentials.identifier.trim() === '') {
    errors.identifier = SIGN_IN_MESSAGE_KEYS.identifierRequired;
  } else if (credentials.identifier.length > 320) {
    errors.identifier = SIGN_IN_MESSAGE_KEYS.rejected;
  }

  if (credentials.password === '') {
    errors.password = SIGN_IN_MESSAGE_KEYS.passwordRequired;
  } else if (credentials.password.length > 1024) {
    errors.password = SIGN_IN_MESSAGE_KEYS.rejected;
  }

  return errors as SignInFieldErrors;
}

/** The first field that should receive focus after a refused attempt. */
export function firstInvalidField(state: SignInState): CredentialField | null {
  if (state.fieldErrors.identifier !== undefined) return 'identifier';
  if (state.fieldErrors.password !== undefined) return 'password';

  return null;
}
