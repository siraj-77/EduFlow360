'use client';

import { useEffect, useReducer, useRef } from 'react';

import {
  buildSignInRequest,
  classifySignInResponse,
  networkRefusal,
  signInEndpoint,
  type CredentialField,
  type SignInCredentials,
} from '../sign-in-request';
import {
  INITIAL_SIGN_IN_STATE,
  firstInvalidField,
  signInReducer,
  validateCredentials,
  type SignInState,
} from '../sign-in-state';

/**
 * Everything the sign-in form does, minus what it looks like - and minus what the
 * DOM already owns.
 *
 * ## The double-submit guard is two mechanisms, not one
 *
 * `disabled` on the button is the one a reader expects, and on its own it is not
 * enough: a second `Enter` in the same tick reaches the submit handler before
 * React has committed the disabled state, and a second click on a button the
 * browser has not yet repainted does the same. So `inFlight.current` is checked
 * **synchronously, before any await and before any state is read**, and it is a
 * ref rather than state precisely because state is not updated synchronously - a
 * ref is.
 *
 * A sign-in is not idempotent. Two POSTs spend two of the five attempts
 * `LOGIN_MAX_FAILED_ATTEMPTS` allows, so a double click that looked like a UI
 * hiccup would be a lockout the user did not cause.
 *
 * ## Why this hook holds no field values
 *
 * An earlier version kept the identifier and the password in `useState`. That is
 * the obvious shape and it has a consequence worth naming: **React writes a
 * controlled input's `value` into the DOM as an ATTRIBUTE**, so
 * `document.documentElement.outerHTML` contained the plaintext password - visible
 * to anything that serialises the page, such as a DOM snapshot, an extension, or
 * `page.content()` in a test. The field masks it on screen and nothing else
 * exposed it, but "not in the URL, not in storage, not in a log" is a weaker
 * guarantee than it looks when the value is also in the markup.
 *
 * So the DOM owns both values, `submit` reads them from the form's refs, and this
 * hook only holds state it derived rather than received. Two smaller wins come
 * with it: keystrokes no longer re-render the form, which matters on the low-end
 * phone this product is actually used on, and there is no longer a stale closure
 * to reason about - `submit` cannot read a stale value because it is handed the
 * current one.
 *
 * ## The password's lifetime
 *
 * It lives in the password field for as long as the form is on screen, goes out
 * in the request body, and is never written anywhere else: not the URL, not
 * `localStorage` or `sessionStorage`, not a log, not an error message, not the
 * serialised DOM. There is no `console.*` call in this file and no error path
 * interpolates the credentials, so there is nothing to redact. The inputs carry
 * no `name`, which is the last of it: a submission that somehow reached the
 * browser's own form handling would send no field values at all, because unnamed
 * controls are not *successful*. Password managers key off `autocomplete`, not
 * `name`, so this costs nothing.
 */
export interface UseSignInOptions {
  /** Called after the API has issued a session. */
  readonly onSignedIn: () => void;
  /** Overrides the API base URL. Tests only. */
  readonly endpoint?: string;
}

export interface UseSignIn {
  readonly state: SignInState;
  readonly submit: (credentials: SignInCredentials) => void;
  /** Clears a field's error. Called on every keystroke. */
  readonly edit: (field: CredentialField) => void;
}

export function useSignIn({ onSignedIn, endpoint }: UseSignInOptions): UseSignIn {
  const [state, dispatch] = useReducer(signInReducer, INITIAL_SIGN_IN_STATE);

  const inFlight = useRef(false);
  const abort = useRef<AbortController | null>(null);

  // An unmount mid-request must not dispatch onto a component that is gone, and
  // must not leave an AbortController holding the request open.
  useEffect(() => {
    return () => {
      abort.current?.abort();
      abort.current = null;
    };
  }, []);

  const edit = (field: CredentialField) => dispatch({ type: 'edit', field });

  const submit = (credentials: SignInCredentials) => {
    // Synchronous, before any await. See the header.
    if (inFlight.current) return;

    const fieldErrors = validateCredentials(credentials);

    if (Object.keys(fieldErrors).length > 0) {
      dispatch({ type: 'invalid', fieldErrors });
      return;
    }

    inFlight.current = true;
    dispatch({ type: 'submit' });

    const controller = new AbortController();
    abort.current = controller;

    void (async () => {
      try {
        const response = await fetch(signInEndpoint(endpoint), {
          ...buildSignInRequest(credentials, { signal: controller.signal }),
        });

        // Read once, defensively: a proxy that answers 200 with a body that is
        // not JSON must not turn a successful sign-in into a parse error.
        const body: unknown = await response.json().catch(() => null);

        if (response.status === 200) {
          dispatch({ type: 'succeeded' });
          onSignedIn();
          return;
        }

        dispatch({
          type: 'refused',
          refusal: classifySignInResponse(
            response.status,
            body,
            response.headers.get('Retry-After'),
          ),
        });
      } catch {
        // Offline, DNS, TLS, or a CORS rejection all arrive here as a thrown
        // `TypeError` with no status, and all of them mean the same thing to
        // someone standing in a corridor: the request did not land.
        dispatch({ type: 'refused', refusal: networkRefusal() });
      } finally {
        inFlight.current = false;
        abort.current = null;
      }
    })();
  };

  return { state, submit, edit };
}

/**
 * Where focus goes after a refused attempt.
 *
 * The first invalid FIELD, because that is the one the user has to change. With
 * no field error, the form-level message - which is then the only thing wrong -
 * gets focus, so a screen reader lands on the explanation instead of returning
 * the user to the top of a form they have already filled in.
 *
 * Only ever consulted on submit. Moving focus on every keystroke is the single
 * most hostile thing a form can do.
 */
export function focusTargetFor(state: SignInState): CredentialField | 'message' | null {
  return firstInvalidField(state) ?? (state.formMessageKey === null ? null : 'message');
}
