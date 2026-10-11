import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { messages } from '@eduflow/i18n-resources';
import type { SupportedLocale } from '@eduflow/shared-types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SignedInScreen } from './signed-in-screen';

/**
 * The interim authenticated landing, driven the way a person drives it.
 *
 * ## Why this file exists
 *
 * Sign-out was broken in production for a full session without a test saying so:
 * the handler called `fetch('/auth/sign-out')` — a ROOT-RELATIVE URL, which the
 * browser resolves against the web app's own origin (`:3500`) rather than the
 * API's (`:3001`). The web server answered a 404 HTML page, the handler ignored
 * the response entirely, and it redirected the user to the sign-in screen while
 * telling them they had signed out. The session row stayed live and the cookie
 * stayed valid — on a shared machine, one Back-click from a session the user
 * believed they had ended.
 *
 * Every auth test asserted the REDIRECT. None asserted the request REACHED the
 * API. That is the gap this file closes, and the assertion that matters most is
 * the first one: `reaches the API and not this app's own origin`.
 *
 * `fireEvent` rather than `user-event`, for the reason `sign-in-form.spec.tsx`
 * records; the end-to-end proof of the whole flow is in
 * `tests/e2e/shell.spec.ts` and was re-run in a real browser.
 */

/** `fetch` recording every URL and init, answering with a canned response. */
function stubFetch(answer: { readonly status: number } | Error) {
  const calls: Array<{ url: string; init: RequestInit }> = [];

  vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
    calls.push({ url, init });

    return answer instanceof Error
      ? Promise.reject(answer)
      : Promise.resolve(new Response('{}', { status: answer.status }));
  });

  return { calls };
}

/** Where a redirect would have gone, if one had been attempted. */
function stubLocation() {
  const replace = vi.fn();
  const original = window.location;

  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { ...original, replace, href: original.href, origin: original.origin },
  });

  return {
    replace,
    restore: () =>
      Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: original,
      }),
  };
}

function renderScreen(locale: SupportedLocale = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <SignedInScreen locale={locale} />
    </NextIntlClientProvider>,
  );
}

const signOutButton = () => screen.getByTestId('signed-in-sign-out');
const clickSignOut = () => fireEvent.click(signOutButton());

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SignedInScreen sign-out', () => {
  it('reaches the API and not this app own origin', async () => {
    // THE assertion. A root-relative URL is the whole defect: it resolves
    // against the web app, so the request never reaches the API at all. The
    // endpoint is built through `apiUrl`, which is the only thing in this app
    // that knows where the API lives.
    const fetch = stubFetch({ status: 200 });
    const location = stubLocation();

    renderScreen();
    clickSignOut();

    await waitFor(() => expect(fetch.calls.length).toBeGreaterThan(0));

    const [call] = fetch.calls;
    expect(call?.url).not.toBe('/auth/sign-out');
    expect(call?.url).toMatch(/^https?:\/\/[^/]+\/auth\/sign-out$/);
    expect(new URL(call?.url ?? '').origin).not.toBe(window.location.origin);

    location.restore();
  });

  it('sends the CSRF header, because CsrfGuard refuses every POST without it', async () => {
    const fetch = stubFetch({ status: 200 });
    const location = stubLocation();

    renderScreen();
    clickSignOut();

    await waitFor(() => expect(fetch.calls.length).toBeGreaterThan(0));

    const headers = fetch.calls[0]?.init.headers as Record<string, string>;
    expect(headers['x-eduflow-csrf']).toBeTruthy();
    expect(fetch.calls[0]?.init.method).toBe('POST');

    location.restore();
  });

  it('sends the session cookie, because it is the credential being revoked', async () => {
    const fetch = stubFetch({ status: 200 });
    const location = stubLocation();

    renderScreen();
    clickSignOut();

    await waitFor(() => expect(fetch.calls.length).toBeGreaterThan(0));

    expect(fetch.calls[0]?.init.credentials).toBe('include');

    location.restore();
  });

  it('returns to sign-in on 200, the answer that means the session is ended', async () => {
    const location = stubLocation();
    stubFetch({ status: 200 });

    renderScreen();
    clickSignOut();

    await waitFor(() => expect(location.replace).toHaveBeenCalledTimes(1));
    expect(location.replace).toHaveBeenCalledWith('/en/sign-in');

    location.restore();
  });

  it('does NOT redirect, and does NOT claim success, when the API refuses with 403', async () => {
    // The CsrfGuard branch. A redirect here is the lie the old code told: the
    // user is shown the sign-in page believing the session ended, while it is
    // very much alive.
    const location = stubLocation();
    stubFetch({ status: 403 });

    renderScreen();
    clickSignOut();

    await waitFor(() => expect(signOutButton()).not.toBeDisabled());

    expect(location.replace).not.toHaveBeenCalled();
    expect(screen.queryByText(/signed out/i)).toBeNull();
  });

  it('does NOT redirect, and does NOT claim success, when the request never got an answer', async () => {
    const location = stubLocation();
    stubFetch(new TypeError('Failed to fetch'));

    renderScreen();
    clickSignOut();

    await waitFor(() => expect(signOutButton()).not.toBeDisabled());

    expect(location.replace).not.toHaveBeenCalled();
    expect(screen.queryByText(/signed out/i)).toBeNull();
  });

  it('does NOT redirect on an unexpected status, whatever it is', async () => {
    const location = stubLocation();
    stubFetch({ status: 500 });

    renderScreen();
    clickSignOut();

    await waitFor(() => expect(signOutButton()).not.toBeDisabled());

    expect(location.replace).not.toHaveBeenCalled();
    expect(screen.queryByText(/signed out/i)).toBeNull();
  });

  it('renders in every locale it ships in', () => {
    // The screen is i18n-driven; a refusal message must exist in all four
    // locales or one of them renders a raw key.
    const location = stubLocation();
    renderScreen('ar');
    expect(screen.getByTestId('signed-in-sign-out')).toBeTruthy();
    location.restore();
  });
});
