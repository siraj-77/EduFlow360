import { describe, expect, it, vi } from 'vitest';
import {
  passwordResetConfirmBody,
  classifyPasswordResetConfirm,
  PASSWORD_RESET_CONFIRM_PATH,
  sendPasswordResetConfirm,
} from './password-reset-confirm';

/**
 * The reset-confirm wire contract, as pure functions (`PLT-105` T2's route,
 * `PLT-105` T3's screen).
 *
 * ## The two refusals, and why they collapse into one
 *
 * The API answers different 400 bodies for a policy failure ("that password
 * does not meet policy") and for a dead link ("that reset link is not
 * valid"). The UI collapses both to `refused` on purpose: parsing the
 * server's English prose to distinguish them would put an untranslated
 * string in front of the i18n rule, and would break the day the API's copy
 * changes. The screen's own message covers both honestly — a caller whose
 * password was too weak is told the link may still be good.
 *
 * ## What the token is
 *
 * The plaintext from the emailed link, passed through the query string. The
 * client never stores it: it lives in the URL for one redemption, and the
 * store holds only the SHA-256.
 */

describe('passwordResetConfirmBody', () => {
  it('sends exactly the token and the password, projected explicitly', () => {
    expect(passwordResetConfirmBody({ token: 'abc', password: 'pw' })).toEqual({
      token: 'abc',
      password: 'pw',
    });
  });
});

describe('classifyPasswordResetConfirm', () => {
  it('answers reset on 200', () => {
    expect(classifyPasswordResetConfirm(200).kind).toBe('reset');
  });

  it('collapses both 400s into one refusal, without reading the body', () => {
    // The policy refusal and the token refusal answer different prose, and
    // this classifier reads NEITHER: `body` is accepted and ignored, so the
    // day the API's copy changes, nothing here breaks.
    expect(
      classifyPasswordResetConfirm(400, { message: 'That password does not meet policy.' }).kind,
    ).toBe('refused');
    expect(
      classifyPasswordResetConfirm(400, { message: 'That reset link is not valid.' }).kind,
    ).toBe('refused');
  });

  it('answers throttled on 429', () => {
    expect(classifyPasswordResetConfirm(429, null, '30').kind).toBe('throttled');
  });

  it('answers csrf on 403 and network on a missing answer', () => {
    expect(classifyPasswordResetConfirm(403).kind).toBe('csrf');
    expect(classifyPasswordResetConfirm(null).kind).toBe('network');
  });
});

describe('the request', () => {
  it('carries the CSRF header and the credentials the cookie needs', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    await sendPasswordResetConfirm({ token: 'tok', password: 'pw' }, 'http://localhost:3500');

    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:3500' + PASSWORD_RESET_CONFIRM_PATH);
    expect((init.headers as Record<string, string>)['x-eduflow-csrf']).toBeTruthy();
    expect(init.credentials).toBe('include');
    expect(JSON.parse(String(init.body))).toEqual({ token: 'tok', password: 'pw' });
    fetchSpy.mockRestore();
  });
});
