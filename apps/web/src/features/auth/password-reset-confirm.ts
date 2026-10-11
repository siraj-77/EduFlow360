import { apiUrl } from '@/lib/api-base-url';
import { signInHeaders } from './csrf-header';

/**
 * The reset-confirm wire contract, as pure functions (`PLT-105` T2's route,
 * `PLT-105` T3's screen).
 *
 * ## The two refusals collapse into one, on purpose
 *
 * The API answers different 400 bodies for a policy failure and for a dead
 * link. This client reads NEITHER — `body` is accepted and ignored — because
 * parsing the server's English prose would put an untranslated string in
 * front of the i18n rule (`AGENTS.md` §2.8) and would break the day the API's
 * copy changes. The screen's own message covers both honestly: a caller
 * whose password was too weak is told the link may still be good, which is
 * true — the token is not consumed until the policy accepts.
 *
 * ## The token's one journey
 *
 * Plaintext from the emailed link, through the query string, into this body,
 * and nowhere else: the client never stores it, the API keeps only the
 * SHA-256, and a consumed or expired token is refused by the guarded UPDATE.
 */

/** `POST /auth/password-reset/confirm`. */
export const PASSWORD_RESET_CONFIRM_PATH = '/auth/password-reset/confirm';

export interface PasswordResetConfirmBodyShape {
  readonly token: string;
  readonly password: string;
}

/** The body, projected to exactly the DTO's shape. */
export function passwordResetConfirmBody(params: {
  readonly token: string;
  readonly password: string;
}): PasswordResetConfirmBodyShape {
  return { token: params.token.trim(), password: params.password };
}

export type PasswordResetConfirmOutcome =
  | { readonly kind: 'reset' }
  /** 400 — a policy refusal or a dead link, indistinguishable by design. */
  | { readonly kind: 'refused' }
  | { readonly kind: 'throttled'; readonly retryAfterSeconds: number | null }
  | { readonly kind: 'csrf' }
  | { readonly kind: 'network' }
  | { readonly kind: 'unexpected' };

/** The same `Retry-After` reader the sign-in contract uses. */
export function retryAfterSeconds(header: string | null | undefined): number | null {
  if (header === null || header === undefined) return null;
  const trimmed = header.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Math.max(1, Number.parseInt(trimmed, 10));
}

/**
 * Turn an answer into the outcome.
 *
 * The parameter is accepted and deliberately unused — see the header. Its
 * presence in the signature is the reminder that a body existed, which is
 * the only thing a future change needs to know before deciding to read it.
 */
export function classifyPasswordResetConfirm(
  status: number | null,
  _body?: unknown,
  retryAfter: string | null = null,
): PasswordResetConfirmOutcome {
  if (status === null) return { kind: 'network' };
  if (status === 200) return { kind: 'reset' };
  if (status === 400) return { kind: 'refused' };
  if (status === 429) {
    return { kind: 'throttled', retryAfterSeconds: retryAfterSeconds(retryAfter) };
  }
  if (status === 403) return { kind: 'csrf' };
  return { kind: 'unexpected' };
}

/** Everything `fetch` needs, with no header a caller can forget. */
export function buildPasswordResetConfirmRequest(
  params: { readonly token: string; readonly password: string },
  options: { readonly signal?: AbortSignal } = {},
): RequestInit {
  return {
    method: 'POST',
    headers: signInHeaders(),
    credentials: 'include',
    body: JSON.stringify(passwordResetConfirmBody(params)),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  };
}

/** The absolute (or root-relative) URL of the reset-confirm route. */
export function passwordResetConfirmEndpoint(baseUrl?: string): string {
  return apiUrl(PASSWORD_RESET_CONFIRM_PATH, baseUrl);
}

/** POST the confirmation. */
export async function sendPasswordResetConfirm(
  params: { readonly token: string; readonly password: string },
  baseUrl?: string,
  options: { readonly signal?: AbortSignal } = {},
): Promise<PasswordResetConfirmOutcome> {
  try {
    const response = await fetch(passwordResetConfirmEndpoint(baseUrl), {
      ...buildPasswordResetConfirmRequest(params, options),
    });
    return classifyPasswordResetConfirm(
      response.status,
      await response.json().catch(() => null),
      response.headers.get('retry-after'),
    );
  } catch {
    return { kind: 'network' };
  }
}
