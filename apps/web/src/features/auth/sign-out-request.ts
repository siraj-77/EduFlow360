import { apiUrl } from '@/lib/api-base-url';
import { signOutHeaders } from './csrf-header';

/**
 * The sign-out wire contract, as pure functions.
 *
 * ## The defect this file exists to make impossible
 *
 * Sign-out was broken for a session without any test saying so. The handler
 * called `fetch('/auth/sign-out')` — a ROOT-RELATIVE URL — which the browser
 * resolves against the WEB APP's own origin rather than the API's. In
 * development that is two different ports (`:3500` and `:3001`), so the request
 * went to Next.js, which answered a 404 HTML page. The handler read no status,
 * so it redirected the user to the sign-in screen and told them they had signed
 * out, while the server-side session row stayed live and the cookie stayed
 * valid.
 *
 * Two things make that class of defect structurally impossible here:
 *
 *  1. **The URL comes from `apiUrl`**, the one module that knows where the API
 *     lives. There is no literal path at any call site to get wrong.
 *  2. **The response is classified and the classification is acted on.** A
 *     caller cannot redirect without an outcome that means "the session is
 *     ended", because there is exactly one such outcome and it is `signedOut`.
 *
 * ## Why 200 is the only success, and why that is safe
 *
 * `POST /auth/sign-out` is deliberately **idempotent**: no cookie, a dead
 * cookie, or a token matching no live session all answer `200
 * { signedOut: true }` (`sign-out.controller.ts`). A caller with no session has
 * already achieved what they asked for, so 200 always means "your session is
 * ended" — which is exactly the one condition under which it is safe to send a
 * user to the sign-in screen.
 *
 * The 403 branch is the important one. `CsrfGuard` runs globally on every
 * non-safe method, so a sign-out that refuses did not reach the handler and
 * revoked nothing. Redirecting there is the lie the old code told.
 */

/** `POST /auth/sign-out`. */
export const SIGN_OUT_PATH = '/auth/sign-out';

/**
 * What a sign-out attempt achieved, in the terms the UI needs.
 *
 * `signedOut` is the ONLY outcome that means the session is ended, and it is
 * the only one on which a caller may leave the authenticated area. There is no
 * "probably" state, and no body is read to manufacture one.
 */
export type SignOutOutcome =
  /** 200 — the session is ended (or was already gone). Safe to redirect. */
  | { readonly kind: 'signedOut' }
  /** 403 — `CsrfGuard` refused. A wiring fault, and nothing was revoked. */
  | { readonly kind: 'csrf' }
  /** The request never got an answer: offline, DNS, CORS, TLS. */
  | { readonly kind: 'network' }
  /** Any other status. The session is very much alive. */
  | { readonly kind: 'unexpected' };

/**
 * Turn a status into an outcome.
 *
 * `null` is the network case, which has no status to read — the shape matches
 * `classifyPasswordResetRequest` so the two contracts read the same way.
 */
export function classifySignOutResponse(status: number | null): SignOutOutcome {
  if (status === null) return { kind: 'network' };
  if (status === 200) return { kind: 'signedOut' };
  if (status === 403) return { kind: 'csrf' };
  return { kind: 'unexpected' };
}

/** Everything `fetch` needs, with no header a caller can forget. */
export function buildSignOutRequest(options: { readonly signal?: AbortSignal } = {}): RequestInit {
  return {
    method: 'POST',
    headers: signOutHeaders(),
    // `include`, for the same reason as sign-in: the session cookie IS the
    // credential being revoked, so a request that drops it revokes nothing.
    credentials: 'include',
    body: '{}',
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  };
}

/** The absolute (or root-relative) URL of the sign-out route. */
export function signOutEndpoint(baseUrl?: string): string {
  return apiUrl(SIGN_OUT_PATH, baseUrl);
}

/**
 * POST the sign-out.
 *
 * Separate from the pure functions so a component test can stub `fetch` once,
 * and so the wire shape stays assertable without a network — the same
 * arrangement as `sendPasswordResetRequest`.
 */
export async function sendSignOut(
  baseUrl?: string,
  options: { readonly signal?: AbortSignal } = {},
): Promise<SignOutOutcome> {
  try {
    const response = await fetch(signOutEndpoint(baseUrl), {
      ...buildSignOutRequest(options),
    });
    return classifySignOutResponse(response.status);
  } catch {
    return { kind: 'network' };
  }
}
