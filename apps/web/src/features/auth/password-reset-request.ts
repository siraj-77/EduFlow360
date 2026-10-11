import { apiUrl } from '@/lib/api-base-url';
import { signInHeaders } from './csrf-header';

/**
 * The reset-request wire contract, as pure functions (`PLT-105` T1's route,
 * `PLT-105` T3's screen).
 *
 * ## Why the response is not classified beyond "200 or not"
 *
 * `POST /auth/password-reset/request` answers the same 200 whether or not the
 * address is registered — the account-enumeration defence on the API side.
 * The classifier therefore has ONE informative outcome, and that is the
 * point: this file is where a future change that answered differently would
 * have to add a kind, and `classifyPasswordResetRequest`'s spec is what
 * would fail. The defence is structural rather than a matter of everyone
 * remembering to keep the bodies equal.
 *
 * What IS classified is the ordinary failure set: a throttle (the route
 * bounds outbound mail per source), a CSRF fault (wiring, not the caller),
 * a network failure, and anything unexpected. None of them distinguishes
 * "registered" from "unknown" either, because none of them is the 200 path.
 */

/** `POST /auth/password-reset/request`. */
export const PASSWORD_RESET_REQUEST_PATH = '/auth/password-reset/request';

export interface PasswordResetRequestBodyShape {
  readonly email: string;
}

/**
 * The body, projected to exactly the DTO's shape.
 *
 * `PasswordResetRequestBody` is `z.object({ email: z.string().trim().min(3).max(320) })`,
 * and `.trim()` is the reason the email arrives trimmed: an address with
 * trailing whitespace is a different key on the far side, and the
 * "if registered" answer would be given for the wrong string.
 */
export function passwordResetRequestBody(params: {
  readonly email: string;
}): PasswordResetRequestBodyShape {
  return { email: params.email.trim() };
}

export type PasswordResetRequestOutcome =
  /** 200 — the only answer a caller can see, and it means nothing either way. */
  | { readonly kind: 'accepted' }
  /** 429 — the source is throttled. `retryAfterSeconds` carries the wait. */
  | { readonly kind: 'throttled'; readonly retryAfterSeconds: number | null }
  /** 403 — the CSRF header was refused. A wiring fault. */
  | { readonly kind: 'csrf' }
  /** The request never got an answer: offline, DNS, CORS, TLS. */
  | { readonly kind: 'network' }
  /** Any other status. */
  | { readonly kind: 'unexpected' };

/** The same `Retry-After` reader the sign-in contract uses. */
export function retryAfterSeconds(header: string | null | undefined): number | null {
  if (header === null || header === undefined) return null;
  const trimmed = header.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Math.max(1, Number.parseInt(trimmed, 10));
}

/**
 * Turn a status into the outcome.
 *
 * `body` is accepted and deliberately IGNORED: there is nothing in it a
 * caller may learn, which is the whole contract.
 */
export function classifyPasswordResetRequest(
  status: number | null,
  retryAfter: string | null = null,
): PasswordResetRequestOutcome {
  if (status === null) return { kind: 'network' };
  if (status === 200) return { kind: 'accepted' };
  if (status === 429) {
    return { kind: 'throttled', retryAfterSeconds: retryAfterSeconds(retryAfter) };
  }
  if (status === 403) return { kind: 'csrf' };
  return { kind: 'unexpected' };
}

/** Everything `fetch` needs, with no header a caller can forget. */
export function buildPasswordResetRequest(
  params: { readonly email: string },
  options: { readonly signal?: AbortSignal } = {},
): RequestInit {
  return {
    method: 'POST',
    headers: signInHeaders(),
    // `include`, for the same reason as sign-in: a future SameSite change
    // must not silently drop the response.
    credentials: 'include',
    body: JSON.stringify(passwordResetRequestBody(params)),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  };
}

/** The absolute (or root-relative) URL of the reset-request route. */
export function passwordResetRequestEndpoint(baseUrl?: string): string {
  return apiUrl(PASSWORD_RESET_REQUEST_PATH, baseUrl);
}

/**
 * POST the request.
 *
 * Kept separate from the pure functions so a component test can stub `fetch`
 * once, and so the wire shape stays assertable without a network.
 */
export async function sendPasswordResetRequest(
  email: string,
  baseUrl?: string,
  options: { readonly signal?: AbortSignal } = {},
): Promise<PasswordResetRequestOutcome> {
  try {
    const response = await fetch(passwordResetRequestEndpoint(baseUrl), {
      ...buildPasswordResetRequest({ email }, options),
    });
    return classifyPasswordResetRequest(response.status, response.headers.get('retry-after'));
  } catch {
    return { kind: 'network' };
  }
}
