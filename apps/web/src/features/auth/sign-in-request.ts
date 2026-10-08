import { apiUrl } from '@/lib/api-base-url';
import { signInHeaders } from './csrf-header';

/**
 * The sign-in wire contract, as pure functions.
 *
 * Nothing here touches React, the DOM or `fetch`. That is deliberate: the two
 * things this file decides - what the request looks like, and what each possible
 * answer MEANS - are the two things a reader of the sign-in page most needs to be
 * able to check, and they are only checkable if they are separable from the
 * component that renders the fields.
 *
 * ## The route, read from the API rather than guessed
 *
 * `apps/api/src/modules/auth/controllers/password-sign-in.controller.ts`:
 *
 *   POST /auth/login   200 { signedIn: true } + `eduflow_session` cookie
 *                      400 `fields: ['identifier', 'password']`
 *                      401 ONE frozen body for every refusal
 *                      429 + `Retry-After` (seconds)
 *
 * and `dto/password-sign-in.dto.ts`:
 *
 *   { identifier: string, password: string }.strict()
 *
 * `.strict()` is why this form sends exactly two fields and no third. The DTO
 * rejects unknown keys, so the `auth.rememberMe` string that has been sitting in
 * `en.json` since the scaffold cannot be rendered as a checkbox on this screen:
 * sending it would be a 400. That is a real omission and it is recorded rather
 * than worked around - see the report.
 */

/** `POST /auth/login`. */
export const LOGIN_PATH = '/auth/login';

/** The only two body fields `PasswordSignInBody` accepts. */
export type CredentialField = 'identifier' | 'password';

export interface SignInCredentials {
  readonly identifier: string;
  readonly password: string;
}

/**
 * The body, frozen to the DTO's shape.
 *
 * Built by an explicit projection rather than by passing an object through, so
 * a field added to the component's state cannot silently widen the request.
 * `.strict()` on the far side means one extra key is a 400, and a 400 on a
 * sign-in form is indistinguishable from bad credentials to the user.
 */
export function signInBody(credentials: SignInCredentials): SignInCredentials {
  return { identifier: credentials.identifier, password: credentials.password };
}

/**
 * Why a sign-in did not succeed, in the terms the UI needs.
 *
 * `credentials` is the important one, and it is the ONLY outcome for a 401.
 * Deliberately: the classifier never reads the body of a 401, so it *cannot*
 * distinguish "no such user" from "wrong password" even if a future change made
 * the API say so. The account-enumeration defence is structural here rather
 * than a matter of remembering to keep the messages the same.
 */
export type SignInRefusalKind =
  /** 400 - the API rejected the body. Field names come back in `fields`. */
  | 'rejected'
  /** 401 - refused. Identical for every cause, by construction. */
  | 'credentials'
  /** 429 - too many attempts. `Retry-After` carries the wait. */
  | 'throttled'
  /** 403 - `CsrfGuard` refused the request. Should be impossible; see the report. */
  | 'csrf'
  /** The request never got an answer: offline, DNS, CORS, TLS. */
  | 'network'
  /** Any other status. */
  | 'unexpected';

export interface SignInRefusal {
  readonly kind: SignInRefusalKind;
  /**
   * Which fields the API named, narrowed to the two it accepts.
   *
   * Narrowed because the value arrives from the network: an unrecognised field
   * name is not a field, and rendering it into a component's state is how a
   * server-driven string ends up in the DOM.
   */
  readonly fields: readonly CredentialField[];
  /** Seconds to wait, from `Retry-After`. `null` when absent or unparseable. */
  readonly retryAfterSeconds: number | null;
}

const CREDENTIAL_FIELDS: ReadonlySet<string> = new Set<CredentialField>(['identifier', 'password']);

/**
 * Read `Retry-After` as a whole number of seconds.
 *
 * `Math.max(1, ...)` because the API rounds UP and never emits zero, and because
 * a `0` here would render "Try again in 0 seconds." - a message that tells the
 * user to do something impossible. The day it ever does arrive, one second is
 * still the smallest true answer.
 *
 * Only the integer-seconds form is accepted. The HTTP-date form is legal but
 * this API does not emit it, and a wrong number here is worse than none: it
 * would state a wait the server never promised.
 */
export function retryAfterSeconds(header: string | null | undefined): number | null {
  if (header === null || header === undefined) return null;

  const trimmed = header.trim();
  if (!/^\d+$/.test(trimmed)) return null;

  return Math.max(1, Number.parseInt(trimmed, 10));
}

/** Narrow an untrusted field list to the two the form owns. */
function credentialFieldsOf(value: unknown): readonly CredentialField[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (entry): entry is CredentialField => typeof entry === 'string' && CREDENTIAL_FIELDS.has(entry),
  );
}

/**
 * Turn an answer into a decision.
 *
 * `body` is read for **exactly one** status - 400 - and is `unknown` rather than
 * a parsed type, because nothing about it can be trusted and only the field
 * names are used. Every other status is answered from the status code alone.
 */
export function classifySignInResponse(
  status: number,
  body: unknown,
  retryAfter: string | null,
): SignInRefusal {
  if (status === 400) {
    const fields = credentialFieldsOf((body as { fields?: unknown } | null)?.fields);

    return { kind: 'rejected', fields, retryAfterSeconds: null };
  }

  if (status === 401) {
    return { kind: 'credentials', fields: [], retryAfterSeconds: null };
  }

  if (status === 429) {
    return { kind: 'throttled', fields: [], retryAfterSeconds: retryAfterSeconds(retryAfter) };
  }

  if (status === 403) {
    return { kind: 'csrf', fields: [], retryAfterSeconds: null };
  }

  return { kind: 'unexpected', fields: [], retryAfterSeconds: null };
}

/** A network-level failure, which has no status to classify. */
export function networkRefusal(): SignInRefusal {
  return { kind: 'network', fields: [], retryAfterSeconds: null };
}

/** Everything `fetch` needs, with no header a caller can forget. */
export function buildSignInRequest(
  credentials: SignInCredentials,
  options: { readonly signal?: AbortSignal; readonly baseUrl?: string } = {},
): RequestInit {
  return {
    method: 'POST',
    headers: signInHeaders(),
    // `credentials: 'include'` is required for the session cookie to survive a
    // CROSS-origin login - without it the response body arrives and the cookie
    // is dropped, which produces a 200 that signed nobody in. It is a no-op for
    // the same-origin production shape. The API's CORS allow-list does not send
    // `Access-Control-Allow-Credentials`; see the report, because that makes the
    // cross-origin shape unusable for sign-in and is an API-side decision.
    credentials: 'include',
    body: JSON.stringify(signInBody(credentials)),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  };
}

/** The absolute (or root-relative) URL of the sign-in route. */
export function signInEndpoint(baseUrl?: string): string {
  return apiUrl(LOGIN_PATH, baseUrl);
}
