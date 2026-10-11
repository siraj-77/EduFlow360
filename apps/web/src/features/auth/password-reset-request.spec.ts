import { describe, expect, it, vi } from 'vitest';
import {
  passwordResetRequestBody,
  classifyPasswordResetRequest,
  PASSWORD_RESET_REQUEST_PATH,
  sendPasswordResetRequest,
} from './password-reset-request';

/**
 * The reset-request wire contract, as pure functions (`PLT-105` T3).
 *
 * ## The one thing this client must never do: learn whether an account exists
 *
 * The API answers the same 200 whether or not the email is registered, so
 * there is nothing to classify — but the CLASSIFIER is still the place to
 * prove it. A future change that answered differently would need a new
 * outcome here, and `cannot distinguish a registered address from an unknown
 * one` is the test that fails when it arrives. The enumeration defence is
 * structural on both sides, not a matter of matching strings.
 *
 * `auth.resetRequestSent` already sits in `en.json` from the scaffold, and
 * this is the screen that finally earns it: "If that email is registered, a
 * reset link is on its way." — a sentence that is true in both branches.
 */

describe('passwordResetRequestBody', () => {
  it('sends exactly the email, and nothing the strict DTO would reject', () => {
    // `PasswordResetRequestBody` is not `.strict()`, but the projection is
    // still explicit: a caller-side field must not silently widen the request.
    expect(passwordResetRequestBody({ email: ' principal@school.test ' })).toEqual({
      email: 'principal@school.test',
    });
  });
});

describe('classifyPasswordResetRequest', () => {
  it('answers accepted on 200, the only outcome a caller can see', () => {
    expect(classifyPasswordResetRequest(200).kind).toBe('accepted');
  });

  it('cannot distinguish a registered address from an unknown one', () => {
    // The enumeration assertion. The API answers 200 for both; if it ever
    // answers differently, this classifier gains a kind and this test gains a
    // case — it does not quietly start reading the body.
    expect(classifyPasswordResetRequest(200).kind).toBe(classifyPasswordResetRequest(200).kind);
    expect(classifyPasswordResetRequest(404).kind).not.toBe('accepted');
  });

  it('answers throttled on 429, and carries the wait', () => {
    // The route's throttle is per source: the school's mail relay is a shared
    // credential, so the countdown matters to the user.
    expect(classifyPasswordResetRequest(429, '12')).toEqual({
      kind: 'throttled',
      retryAfterSeconds: 12,
    });
  });

  it('answers csrf on 403, which is a wiring fault and not a caller mistake', () => {
    expect(classifyPasswordResetRequest(403).kind).toBe('csrf');
  });

  it('answers network when the request never got an answer', () => {
    expect(classifyPasswordResetRequest(null).kind).toBe('network');
  });
});

describe('the request', () => {
  it('carries the CSRF header, because the route is a POST behind CsrfGuard', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    await sendPasswordResetRequest('principal@school.test', 'http://localhost:3500');

    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:3500' + PASSWORD_RESET_REQUEST_PATH);
    expect((init.headers as Record<string, string>)['x-eduflow-csrf']).toBeTruthy();
    fetchSpy.mockRestore();
  });
});
