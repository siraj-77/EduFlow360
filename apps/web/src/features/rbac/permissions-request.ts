import { apiUrl } from '@/lib/api-base-url';

/**
 * The permission-set wire contract, as pure functions.
 *
 * Nothing here touches React, the DOM or `fetch`. That is deliberate:
 * the two things this file decides - what the request looks like, and
 * what each possible answer MEANS - are the two things a reader of the
 * permission-aware UI most needs to be able to check, and they are only
 * checkable if they are separable from the hook that renders nothing.
 *
 * ## The route, read from the API rather than guessed
 *
 * `apps/api/src/modules/rbac/controllers/permissions.controller.ts`:
 *
 *   GET /permissions/me   200 { permissions: string[] }  (sorted, deduplicated)
 *                         401 no session
 *                         403 the caller's roles do not hold PERMISSION_READ_OWN
 *
 * The 200 body is `MyPermissions` from
 * `apps/api/src/modules/rbac/use-cases/read-my-permissions.ts`:
 * exactly one key, `permissions`, an array of strings. Nothing else.
 *
 * ## Why there is no CSRF header here
 *
 * `CsrfGuard` enforces state-CHANGING requests. A GET is a safe method
 * under the HTTP specification - it cannot mutate anything - so the
 * guard does not run on it and a header would be dead weight. The
 * sign-in form sends `x-eduflow-csrf` because it POSTs; this request
 * reads. The distinction is the guard's own, and it is asserted below
 * rather than left as a comment someone can delete.
 *
 * ## Why `credentials: 'include'`
 *
 * The session is an httpOnly cookie. Without `include`, a
 * cross-origin deployment (local development, two services behind one
 * hostname) would get the response body and drop the cookie - a 200
 * that authenticated nobody. It is a no-op for the same-origin
 * production shape, which is the deployment a school actually runs.
 */

/** `GET /permissions/me`. */
export const PERMISSIONS_PATH = '/permissions/me';

/**
 * The answer, frozen to the use-case's shape.
 *
 * `readonly string[]` rather than `string[]` because the set is
 * consumed as a `ReadonlySet` and a caller that could mutate the
 * array would be mutating the answer the API gave.
 */
export interface MyPermissionsResponse {
  readonly permissions: readonly string[];
}

/**
 * Why the permission set could not be read, in the terms the UI needs.
 *
 * `unauthenticated` and `denied` are the two the API can produce, and
 * they are NOT the same answer: the first means "no session at all",
 * the second means "a session, but its roles do not hold the read key".
 * Collapsing them would send a signed-in teacher to the sign-in screen.
 */
export type PermissionsRefusalKind =
  /** 401 - no session. The caller is not signed in. */
  | 'unauthenticated'
  /** 403 - a session whose roles do not hold `PERMISSION_READ_OWN`. */
  | 'denied'
  /** The request never got an answer: offline, DNS, CORS, TLS. */
  | 'network'
  /** Any other status. */
  | 'unexpected';

export interface PermissionsRefusal {
  readonly kind: PermissionsRefusalKind;
}

/**
 * Turn a status into a decision.
 *
 * The body is never read. The API's 401 and 403 bodies are error
 * envelopes, and nothing about the caller's permission set can be
 * learned from them - so the classifier answers from the status code
 * alone and cannot be led astray by a body a proxy rewrote.
 */
export function classifyPermissionsResponse(status: number): PermissionsRefusal {
  if (status === 401) {
    return { kind: 'unauthenticated' };
  }

  if (status === 403) {
    return { kind: 'denied' };
  }

  return { kind: 'unexpected' };
}

/** A network-level failure, which has no status to classify. */
export function networkRefusal(): PermissionsRefusal {
  return { kind: 'network' };
}

/**
 * Narrow an untrusted answer body to the keys it carries.
 *
 * The value arrives from the network: an entry that is not a string is
 * not a permission key, and a set built from server-driven values is
 * how an unexpected string ends up deciding what a user may see. The
 * whole array is dropped if it is not an array, rather than answered
 * with a half-built set that reads like a policy decision.
 */
export function parsePermissionsBody(body: unknown): readonly string[] {
  if (typeof body !== 'object' || body === null) return [];

  const permissions = (body as { permissions?: unknown }).permissions;
  if (!Array.isArray(permissions)) return [];

  return permissions.filter((key): key is string => typeof key === 'string');
}

/**
 * Everything `fetch` needs, with no header a caller can forget.
 *
 * No CSRF header: a GET is a safe method and `CsrfGuard` does not run
 * on it. `Accept` is still sent, so a cross-origin request is
 * preflighted and the response is negotiated as JSON rather than
 * whatever a proxy decides to return.
 */
export function buildPermissionsRequest(
  options: { readonly signal?: AbortSignal } = {},
): RequestInit {
  return {
    method: 'GET',
    headers: { Accept: 'application/json' },
    // Required for the session cookie to survive a CROSS-origin read;
    // a no-op for the same-origin production shape.
    credentials: 'include',
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  };
}

/** The absolute (or root-relative) URL of the permission route. */
export function permissionsEndpoint(baseUrl?: string): string {
  return apiUrl(PERMISSIONS_PATH, baseUrl);
}
